/**
 * Benefits of ПДС and ИИС accounts for a calendar year: state co-financing of ПДС
 * contributions and the income tax deduction for contributions, with what is still needed
 * to get the most of them. An estimate, not a tax calculation. Pure domain — no DB.
 */
import { cofinancingRatio, findRuleset, incomeTax, taxYearRules, type BenefitAccountKind } from './tax-benefit-rules';

export interface BenefitAccount {
  id: string;
  kind: BenefitAccountKind;
  ruleset: string | null;
  openedAt: string | null;
  archivedAt: string | null;
}

/** contribution | cofinancing | pension_transfer | withdrawal of a benefit account. */
export interface BenefitEvent {
  accountId: string;
  kind: string;
  date: string;
  amount: number;
}

export interface YearInput {
  year: number;
  accounts: BenefitAccount[];
  /** All events of the accounts, of any year: the first ПДС contribution starts co-financing. */
  events: BenefitEvent[];
  /** Taxable income of the year; null when not entered. */
  annualIncome: number | null;
  /** Other contributions under the same deduction limit, e.g. to a non-state pension fund. */
  otherDeductible: number;
  /** Contributions still planned this year, by account. */
  planned?: Map<string, number>;
}

export type AccountWarning = 'no_ruleset' | 'single_iis' | 'over_contribution_cap';

export interface AccountYear {
  accountId: string;
  contributions: number;
  planned: number;
  /** Co-financing credited to the account during the year (for earlier contributions). */
  cofinancingReceived: number;
  deductible: boolean;
  warnings: AccountWarning[];
}

export type CofinancingStatus = 'ok' | 'below_minimum' | 'window_over';

export interface CofinancingYear {
  /** Own contributions to ПДС in the year, made and planned. */
  contributions: number;
  ratio: number;
  firstYear: number;
  lastYear: number;
  status: CofinancingStatus;
  /** Paid by the state in the next year. */
  expected: number;
  cap: number;
  minContribution: number;
  /** More own contributions needed for the full cap; 0 once reached or out of the window. */
  toMax: number;
  /** More own contributions needed to get anything. */
  toMinimum: number;
}

export interface DeductionYear {
  /** Own contributions to accounts with the deduction, made and planned. */
  contributions: number;
  other: number;
  limit: number;
  base: number;
  toLimit: number;
  /** Income tax returned; at the lowest rate when the income is not entered. */
  refund: number;
}

export interface YearSummary {
  year: number;
  /** False for years before the rules are known: nothing is estimated. */
  rulesKnown: boolean;
  /** No income entered: co-financing is taken at the highest ratio and the refund at the lowest rate. */
  incomeAssumed: boolean;
  accounts: AccountYear[];
  /** Null without ПДС accounts. */
  cofinancing: CofinancingYear | null;
  deduction: DeductionYear;
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const sum = (values: number[]) => round2(values.reduce((total, value) => total + value, 0));

const yearOf = (date: string) => Number(date.slice(0, 4));

/** Accounts open at some point of the year. */
function openIn(account: BenefitAccount, year: number) {
  return (account.openedAt === null || yearOf(account.openedAt) <= year) && (account.archivedAt === null || yearOf(account.archivedAt) >= year);
}

function accountWarnings(account: BenefitAccount, open: BenefitAccount[], contributions: number): AccountWarning[] {
  const ruleset = findRuleset(account.ruleset);
  if (!ruleset) return ['no_ruleset'];
  const warnings: AccountWarning[] = [];
  if (ruleset.kind === 'iis') {
    const otherIis = open.filter((other) => other.kind === 'iis' && other.id !== account.id);
    if (ruleset.single && otherIis.length > 0) warnings.push('single_iis');
    if (ruleset.contributionCap !== null && contributions > ruleset.contributionCap) warnings.push('over_contribution_cap');
  }
  return warnings;
}

export function summarizeYear(input: YearInput): YearSummary {
  const { year } = input;
  const rules = taxYearRules(year);
  const open = input.accounts.filter((account) => openIn(account, year));
  const inYear = (event: BenefitEvent) => yearOf(event.date) === year;
  const contributed = (accountId: string) =>
    sum(input.events.filter((event) => event.accountId === accountId && event.kind === 'contribution' && inYear(event)).map((event) => event.amount));

  const accounts: AccountYear[] = open.map((account) => {
    const contributions = contributed(account.id);
    const planned = round2(input.planned?.get(account.id) ?? 0);
    return {
      accountId: account.id,
      contributions,
      planned,
      cofinancingReceived: sum(
        input.events.filter((event) => event.accountId === account.id && event.kind === 'cofinancing' && inYear(event)).map((event) => event.amount)
      ),
      deductible: findRuleset(account.ruleset)?.contributionDeduction ?? false,
      warnings: accountWarnings(account, open, contributions + planned),
    };
  });
  const total = (row: AccountYear) => row.contributions + row.planned;

  if (!rules) {
    return {
      year,
      rulesKnown: false,
      incomeAssumed: input.annualIncome === null,
      accounts,
      cofinancing: null,
      deduction: { contributions: 0, other: 0, limit: 0, base: 0, toLimit: 0, refund: 0 },
    };
  }

  const income = input.annualIncome;
  let cofinancing: CofinancingYear | null = null;
  const pdsIds = new Set(input.accounts.filter((account) => account.kind === 'pds').map((account) => account.id));
  const pdsRows = accounts.filter((row) => pdsIds.has(row.accountId));
  if (pdsRows.length > 0) {
    const firstContribution = input.events
      .filter((event) => pdsIds.has(event.accountId) && event.kind === 'contribution')
      .reduce<number | null>((first, event) => (first === null || yearOf(event.date) < first ? yearOf(event.date) : first), null);
    // Without contributions yet, this year would be the first one.
    const firstYear = firstContribution === null || firstContribution > year ? year : firstContribution;
    const years = Math.max(
      ...input.accounts.filter((account) => account.kind === 'pds').map((account) => {
        const ruleset = findRuleset(account.ruleset);
        return ruleset?.kind === 'pds' ? ruleset.cofinancingYears : 0;
      })
    );
    // Co-financing is paid for 10 years from the year after the first contribution, each
    // payment for the contributions of the year before.
    const lastYear = firstYear + years - 1;
    const contributions = sum(pdsRows.map(total));
    const ratio = income === null ? rules.cofinancing.tiers[0].ratio : cofinancingRatio(rules, income);
    const { cap, minContribution } = rules.cofinancing;
    const inWindow = years > 0 && year <= lastYear;
    const reachesMinimum = contributions >= minContribution;
    const status: CofinancingStatus = !inWindow ? 'window_over' : reachesMinimum ? 'ok' : 'below_minimum';
    cofinancing = {
      contributions,
      ratio,
      firstYear,
      lastYear,
      status,
      expected: status === 'ok' ? round2(Math.min(cap, contributions * ratio)) : 0,
      cap,
      minContribution,
      toMax: inWindow ? round2(Math.max(0, cap / ratio - contributions)) : 0,
      toMinimum: inWindow ? round2(Math.max(0, minContribution - contributions)) : 0,
    };
  }

  const deductible = sum(accounts.filter((row) => row.deductible).map(total));
  const other = round2(input.otherDeductible);
  const limit = rules.deductionLimit;
  const base = round2(Math.min(limit, deductible + other));
  const refund =
    income === null ? round2(base * rules.taxScale[0].rate) : round2(incomeTax(rules, income) - incomeTax(rules, Math.max(0, income - base)));
  return {
    year,
    rulesKnown: true,
    incomeAssumed: income === null,
    accounts,
    cofinancing,
    deduction: { contributions: deductible, other, limit, base, toLimit: round2(Math.max(0, limit - deductible - other)), refund },
  };
}

export interface BenefitInflow {
  /** The year the money is for. */
  year: number;
  kind: 'cofinancing' | 'tax_refund';
  date: string;
  amount: number;
  /** Co-financing goes to the ПДС account, the refund to free money. */
  liquid: boolean;
}

/** Usual dates: the refund after a declaration filed early in the year, co-financing by summer. */
export const REFUND_DATE = '05-15';
export const COFINANCING_DATE = '07-15';

/**
 * Money expected for the summarized years, dated in the year after each. Inflows already
 * received or whose usual date has passed are left out.
 */
export function expectedInflows(
  summaries: YearSummary[],
  received: { cofinancing: Set<number>; refund: Set<number> },
  today: string
): BenefitInflow[] {
  const inflows: BenefitInflow[] = [];
  for (const summary of summaries) {
    const next = summary.year + 1;
    const cofinancing = summary.cofinancing?.expected ?? 0;
    const cofinancingDate = `${next}-${COFINANCING_DATE}`;
    if (cofinancing > 0 && !received.cofinancing.has(summary.year) && cofinancingDate >= today) {
      inflows.push({ year: summary.year, kind: 'cofinancing', date: cofinancingDate, amount: cofinancing, liquid: false });
    }
    const refundDate = `${next}-${REFUND_DATE}`;
    if (summary.deduction.refund > 0 && !received.refund.has(summary.year) && refundDate >= today) {
      inflows.push({ year: summary.year, kind: 'tax_refund', date: refundDate, amount: summary.deduction.refund, liquid: true });
    }
  }
  return inflows;
}
