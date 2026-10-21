import { getPurchaseDueDate, resolveCardSettings } from '../domain/card-grace';
import { buildForecast, planVsFact, type PlanItem, type PlanVsFactPeriod } from '../domain/forecast';
import { simulateMortgage } from '../domain/mortgage-schedule';
import { balanceOn } from '../domain/net-worth';
import { addMonths } from '../domain/savings';
import { findAccountsByUserId, findBalancesByAccountIds, findEventsByAccountIds } from '../repositories/accountRepository';
import { findCardsByUserId, type CardRow } from '../repositories/cardRepository';
import { findDepositsByCardId } from '../repositories/depositRepository';
import { findBucketsByCardId } from '../repositories/graceBucketRepository';
import { findEventsByMortgageId, findMortgagesByUserId } from '../repositories/mortgageRepository';
import { findPlanItemsByUserId } from '../repositories/planRepository';
import { findPurchasesByCardId } from '../repositories/purchaseRepository';
import { rowToBucket } from './dashboardService';
import { getRates } from './exchangeRateService';
import { toDomainEvent, toTerms } from './mortgageService';
import { getNetWorth } from './netWorthService';
import { toSavingsEvent, toSavingsTerms } from './savingsService';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
/** Months of plan versus fact shown before today. */
const PLAN_VS_FACT_MONTHS = 6;

/** Repayment date of a purchase on a grace card; installment cards are paid at once. */
function cardDueDates(cards: CardRow[], startDatesByCard: Map<string, Date[]>) {
  return (cardId: string, date: string): string | null => {
    const card = cards.find((row) => row.id === cardId);
    if (!card || card.kind !== 'credit') return null;
    const settings = resolveCardSettings({
      graceModel: card.graceModel as 'legacy_months' | 'statement_periods' | 'ozon_anchor',
      reportDay: card.reportDay,
      gracePeriods: card.gracePeriods,
      graceDueDay: card.graceDueDay,
      graceStatementPeriods: card.graceStatementPeriods,
      paymentDueOffsetDays: card.paymentDueOffsetDays,
    });
    const startDates = startDatesByCard.get(cardId) ?? [];
    const { periodStartDate, dueDate } = getPurchaseDueDate(new Date(date), settings, startDates);
    // Later purchases fall into the periods opened by earlier ones, as real purchases do.
    if (!startDates.some((start) => start.getTime() === periodStartDate.getTime())) startDatesByCard.set(cardId, [...startDates, periodStartDate]);
    return dueDate.toISOString().slice(0, 10);
  };
}

export async function getForecast(userId: string, months: number, today = new Date().toISOString().slice(0, 10)) {
  const until = addMonths(today, months);
  const accounts = (await findAccountsByUserId(userId)).filter((account) => !account.archivedAt || account.archivedAt > today);
  const ids = accounts.map((account) => account.id);
  const [balances, events, itemRows, cards, mortgages] = await Promise.all([
    findBalancesByAccountIds(ids),
    findEventsByAccountIds(ids),
    findPlanItemsByUserId(userId),
    findCardsByUserId(userId),
    findMortgagesByUserId(userId),
  ]);
  const currencies = [...new Set([...accounts.map((account) => account.currency), ...itemRows.map((row) => row.currency)])];
  const { rates } = await getRates(today, currencies);
  const missingRates = new Set<string>();
  const rateOf = (currency: string) => {
    const rate = rates[currency];
    if (rate === undefined) missingRates.add(currency);
    return rate;
  };

  // Accounts: interest-earning ones are simulated, the rest keep their last balance.
  let liquidCash = 0;
  let fixedAssets = 0;
  const savings = [];
  const plainAccounts = [];
  for (const account of accounts) {
    const rate = rateOf(account.currency);
    if (rate === undefined) continue;
    const snapshots = balances.filter((row) => row.accountId === account.id).map((row) => ({ date: row.balanceDate, amount: row.amount }));
    const terms = toSavingsTerms(account);
    if (terms) {
      savings.push({
        id: account.id,
        liquid: account.isLiquid,
        rate,
        terms,
        events: events.filter((row) => row.accountId === account.id).map(toSavingsEvent),
        snapshots,
      });
      continue;
    }
    plainAccounts.push({ id: account.id, liquid: account.isLiquid });
    const value = (balanceOn(snapshots, today)?.amount ?? 0) * rate;
    if (account.isLiquid) liquidCash += value;
    else fixedAssets += value;
  }

  // Existing card debt is repaid by the grace deadlines, overdue debt today.
  const debtPayments: Array<{ date: string; amount: number; kind: 'card' | 'mortgage' }> = [];
  const startDatesByCard = new Map<string, Date[]>();
  let cardDebt = 0;
  for (const card of cards) {
    const buckets = (await findBucketsByCardId(card.id))
      .map((row) => rowToBucket(row, new Date(today)))
      .filter((bucket) => (bucket.status === 'active' || bucket.status === 'overdue') && bucket.principalRemaining > 0);
    startDatesByCard.set(card.id, buckets.map((bucket) => bucket.periodStartDate));
    for (const bucket of buckets) {
      const due = bucket.dueDate.toISOString().slice(0, 10);
      debtPayments.push({ date: due < today ? today : due, amount: bucket.principalRemaining, kind: 'card' });
      cardDebt += bucket.principalRemaining;
    }
  }

  // Mortgages follow their schedules; the combined principal is tracked by date.
  let mortgageDebt = 0;
  const schedules: Array<{ start: number; rows: Array<{ date: string; balance: number }> }> = [];
  const mortgageEvents = await Promise.all(mortgages.map((mortgage) => findEventsByMortgageId(mortgage.id)));
  mortgages.forEach((mortgage, index) => {
    const simulation = simulateMortgage(toTerms(mortgage), mortgageEvents[index].map(toDomainEvent), today);
    mortgageDebt += simulation.balance;
    if (simulation.overdueAmount > 0) debtPayments.push({ date: today, amount: simulation.overdueAmount, kind: 'mortgage' });
    const planned = simulation.rows.filter((row) => row.kind === 'scheduled' && row.status === 'planned' && row.date >= today && row.date <= until);
    for (const row of planned) debtPayments.push({ date: row.date, amount: row.expected, kind: 'mortgage' });
    schedules.push({ start: simulation.balance, rows: planned.map((row) => ({ date: row.date, balance: row.balanceAfter })) });
  });
  const mortgageDates = [...new Set(schedules.flatMap((schedule) => schedule.rows.map((row) => row.date)))].sort();
  const mortgageBalances = mortgageDates.map((date) => ({
    date,
    balance: round2(
      schedules.reduce((sum, schedule) => sum + (schedule.rows.filter((row) => row.date <= date).pop()?.balance ?? schedule.start), 0)
    ),
  }));

  const items: PlanItem[] = [];
  for (const row of itemRows) {
    const rate = rateOf(row.currency);
    if (rate === undefined) continue;
    items.push({
      id: row.id,
      kind: row.kind as PlanItem['kind'],
      amount: row.amount * rate,
      frequency: row.frequency as PlanItem['frequency'],
      interval: row.interval,
      startDate: row.startDate,
      endDate: row.endDate,
      spread: row.spread,
      cardId: row.cardId,
      targetAccountId: row.targetAccountId,
    });
  }

  const forecast = buildForecast({
    today,
    until,
    liquidCash,
    fixedAssets,
    savings,
    plainAccounts,
    debtPayments,
    cardDebt,
    mortgageDebt,
    mortgageBalances,
    items,
    cardDueDate: cardDueDates(cards, startDatesByCard),
  });

  return {
    today,
    until,
    ...forecast,
    planVsFact: await getPlanVsFact(userId, today, items, accounts, balances, cards, mortgageEvents.flat()),
    missingRates: [...missingRates].sort(),
  };
}

async function getPlanVsFact(
  userId: string,
  today: string,
  items: PlanItem[],
  accounts: Awaited<ReturnType<typeof findAccountsByUserId>>,
  balances: Awaited<ReturnType<typeof findBalancesByAccountIds>>,
  cards: CardRow[],
  mortgageEvents: Awaited<ReturnType<typeof findEventsByMortgageId>>
) {
  const history = (await getNetWorth(userId, PLAN_VS_FACT_MONTHS, today)).history;
  const from = history[0].date;
  const [deposits, purchases] = await Promise.all([
    Promise.all(cards.map((card) => findDepositsByCardId(card.id, from, today))).then((rows) => rows.flat()),
    Promise.all(cards.map((card) => findPurchasesByCardId(card.id))).then((rows) => rows.flat()),
  ]);
  const enteredLiquid = new Set(accounts.filter((account) => account.isLiquid && !toSavingsTerms(account)).map((account) => account.id));
  const inPeriod = (date: string, period: { from: string; to: string }) => date > period.from && date <= period.to;

  const periods: PlanVsFactPeriod[] = history.slice(1).map((point, index) => {
    const period = { from: history[index].date, to: point.date };
    const repaidCards = deposits.filter((row) => inPeriod(row.depositDate, period)).reduce((sum, row) => sum + row.amount, 0);
    const repaidMortgage = mortgageEvents
      .filter((row) => (row.kind === 'payment' || row.kind === 'prepayment') && inPeriod(row.eventDate, period))
      .reduce((sum, row) => sum + (row.amount ?? 0), 0);
    return {
      ...period,
      liquidFrom: history[index].liquid,
      liquidTo: point.liquid,
      debtRepaid: round2(repaidCards + repaidMortgage),
      cardPurchases: round2(purchases.filter((row) => inPeriod(row.purchaseDate, period)).reduce((sum, row) => sum + row.amount, 0)),
      balancesEntered: balances.some((row) => enteredLiquid.has(row.accountId) && inPeriod(row.balanceDate, period)),
    };
  });
  return planVsFact(items, periods, new Set(accounts.filter((account) => account.isLiquid).map((account) => account.id)));
}
