import { occurrences, type PlanItem } from '../domain/forecast';
import { BENEFIT_KINDS, defaultUnlockDate, lockYears, rulesetsFor, type Ruleset } from '../domain/tax-benefit-rules';
import { expectedInflows, summarizeYear, type BenefitAccount, type BenefitInflow, type YearSummary } from '../domain/tax-benefits';
import { findAccountsByUserId, findEventsByAccountIds } from '../repositories/accountRepository';
import { findPlanItemsByUserId } from '../repositories/planRepository';
import { findTaxYearsByUserId, upsertTaxYear, type TaxYearInput, type TaxYearRow } from '../repositories/taxYearRepository';

/** A ruleset as the account form shows it, with the unlock date for the opening date. */
export function describeRulesets(kind: string, openedAt: string) {
  return rulesetsFor(kind, openedAt).map((ruleset: Ruleset) => ({
    ...ruleset,
    lockYears: lockYears(ruleset, openedAt),
    unlockDate: defaultUnlockDate(ruleset, openedAt),
  }));
}

const shiftDay = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

async function loadBenefits(userId: string) {
  const accountRows = (await findAccountsByUserId(userId)).filter((account) => BENEFIT_KINDS.includes(account.kind));
  const [eventRows, taxYears, itemRows] = await Promise.all([
    findEventsByAccountIds(accountRows.map((account) => account.id)),
    findTaxYearsByUserId(userId),
    findPlanItemsByUserId(userId),
  ]);
  const accounts: BenefitAccount[] = accountRows.map((account) => ({
    id: account.id,
    kind: account.kind as BenefitAccount['kind'],
    ruleset: account.ruleset,
    openedAt: account.openedAt,
    archivedAt: account.archivedAt,
  }));
  const events = eventRows.map((row) => ({ accountId: row.accountId, kind: row.kind, date: row.eventDate, amount: row.amount ?? 0 }));
  // Contributions are counted in roubles: transfers in other currencies are left out.
  const rubIds = new Set(accountRows.filter((account) => account.currency === 'RUB').map((account) => account.id));
  const transfers: PlanItem[] = itemRows
    .filter((row) => row.kind === 'transfer' && row.currency === 'RUB' && row.targetAccountId !== null && rubIds.has(row.targetAccountId))
    .map((row) => ({
      id: row.id,
      kind: 'transfer',
      amount: row.amount,
      frequency: row.frequency as PlanItem['frequency'],
      interval: row.interval,
      startDate: row.startDate,
      endDate: row.endDate,
      spread: row.spread,
      cardId: null,
      targetAccountId: row.targetAccountId,
    }));
  return { accounts, events, taxYears, transfers };
}

type Benefits = Awaited<ReturnType<typeof loadBenefits>>;

/** Planned transfers of the year still ahead of today, by account. */
function plannedIn(transfers: PlanItem[], year: number, today: string): Map<string, number> {
  const from = shiftDay(today, 1) > `${year}-01-01` ? shiftDay(today, 1) : `${year}-01-01`;
  const planned = new Map<string, number>();
  for (const item of transfers) {
    for (const occurrence of occurrences(item, from, `${year}-12-31`)) {
      planned.set(item.targetAccountId!, (planned.get(item.targetAccountId!) ?? 0) + occurrence.amount);
    }
  }
  return planned;
}

function summarize(benefits: Benefits, year: number, today: string, incomeFallback: boolean): YearSummary {
  const row = benefits.taxYears.find((taxYear) => taxYear.year === year);
  // Future years take the latest income entered as the best guess.
  const latest = benefits.taxYears.filter((taxYear) => taxYear.year < year && taxYear.annualIncome !== null).pop();
  const income = row?.annualIncome ?? (incomeFallback ? (latest?.annualIncome ?? null) : null);
  return summarizeYear({
    year,
    accounts: benefits.accounts,
    events: benefits.events,
    annualIncome: income,
    otherDeductible: row?.otherDeductible ?? 0,
    planned: plannedIn(benefits.transfers, year, today),
  });
}

function received(benefits: Benefits) {
  return {
    // Co-financing for a year is credited during the next one.
    cofinancing: new Set(benefits.events.filter((event) => event.kind === 'cofinancing').map((event) => Number(event.date.slice(0, 4)) - 1)),
    refund: new Set(benefits.taxYears.filter((row) => row.refundReceived !== null).map((row) => row.year)),
  };
}

const toTaxYear = (year: number, row: TaxYearRow | undefined) => ({
  year,
  annualIncome: row?.annualIncome ?? null,
  otherDeductible: row?.otherDeductible ?? 0,
  refundReceived: row?.refundReceived ?? null,
});

export async function getTaxBenefits(userId: string, year: number, today = new Date().toISOString().slice(0, 10)) {
  const benefits = await loadBenefits(userId);
  const summary = summarize(benefits, year, today, false);
  return {
    today,
    summary,
    taxYear: toTaxYear(year, benefits.taxYears.find((row) => row.year === year)),
    inflows: expectedInflows([summary], received(benefits), today),
    // Years with anything to show, for the year picker.
    years: [
      ...new Set([
        ...benefits.events.map((event) => Number(event.date.slice(0, 4))),
        ...benefits.taxYears.map((row) => row.year),
        Number(today.slice(0, 4)),
      ]),
    ].sort((a, b) => b - a),
  };
}

export async function saveTaxYear(userId: string, year: number, data: TaxYearInput) {
  return toTaxYear(year, await upsertTaxYear(userId, year, data));
}

/** Co-financing and tax refunds expected up to `until`, for the forecast. */
export async function getBenefitInflows(userId: string, today: string, until: string): Promise<BenefitInflow[]> {
  const benefits = await loadBenefits(userId);
  if (benefits.accounts.length === 0) return [];
  const summaries: YearSummary[] = [];
  // Inflows land in the year after the contributions, so the last year needed is the one before `until`.
  for (let year = Number(today.slice(0, 4)) - 1; year < Number(until.slice(0, 4)); year++) summaries.push(summarize(benefits, year, today, true));
  return expectedInflows(summaries, received(benefits), today).filter((inflow) => inflow.date <= until);
}
