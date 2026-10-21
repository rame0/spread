import { cardDebtOn, historyDates, valueAssets, type AssetValuation, type BalanceSnapshot, type DebtMovement } from '../domain/net-worth';
import { simulateMortgage } from '../domain/mortgage-schedule';
import { findAccountsByUserId, findBalancesByAccountIds } from '../repositories/accountRepository';
import { findCardsByUserId } from '../repositories/cardRepository';
import { findDepositsByCardId } from '../repositories/depositRepository';
import { findEventsByMortgageId, findMortgagesByUserId } from '../repositories/mortgageRepository';
import { findPurchasesByCardId } from '../repositories/purchaseRepository';
import { findReconciliationsByCardId } from '../repositories/reconciliationRepository';
import { getMainDashboard } from './dashboardService';
import { getRates } from './exchangeRateService';
import { toDomainEvent, toTerms } from './mortgageService';

export interface NetWorthDebts {
  total: number;
  /** Credit and installment cards. */
  cards: number;
  mortgages: number;
}

export interface NetWorthResult {
  asOf: string;
  assets: AssetValuation;
  /** Some currency was valued at an old rate because CBR could not be reached. */
  ratesStale: boolean;
  debts: NetWorthDebts;
  netWorth: number;
  /** Month ends followed by `asOf`; assets are null before the first entered balance. */
  history: Array<{ date: string; assets: number | null; debts: number; netWorth: number | null }>;
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Debts on past dates: card debt rebuilt from its movements, mortgage balance from its schedule. */
async function loadDebtHistory(userId: string) {
  const cards = await findCardsByUserId(userId);
  const cardMovements = await Promise.all(cards.map(async (card): Promise<DebtMovement[]> => {
    const [purchases, deposits, reconciliations] = await Promise.all([
      findPurchasesByCardId(card.id),
      findDepositsByCardId(card.id),
      findReconciliationsByCardId(card.id),
    ]);
    return [
      ...purchases.map((row) => ({ date: row.purchaseDate, amount: row.amount + row.installmentFee })),
      ...deposits.map((row) => ({ date: row.depositDate, amount: -row.amount })),
      ...reconciliations.map((row) => ({ date: row.reconciliationDate, amount: row.difference })),
    ];
  }));
  const mortgages = await Promise.all((await findMortgagesByUserId(userId)).map(async (mortgage) => ({
    terms: toTerms(mortgage),
    events: (await findEventsByMortgageId(mortgage.id)).map(toDomainEvent),
  })));
  return (date: string): NetWorthDebts => {
    const cardsDebt = round2(cardMovements.reduce((sum, movements) => sum + cardDebtOn(movements, date), 0));
    const mortgagesDebt = round2(mortgages.reduce(
      (sum, { terms, events }) => (date < terms.issueDate ? sum : sum + simulateMortgage(terms, events, date).balance),
      0
    ));
    return { total: round2(cardsDebt + mortgagesDebt), cards: cardsDebt, mortgages: mortgagesDebt };
  };
}

export async function getNetWorth(userId: string, months: number, asOf = new Date().toISOString().slice(0, 10)): Promise<NetWorthResult> {
  const accounts = await findAccountsByUserId(userId);
  const snapshotsByAccount = new Map<string, BalanceSnapshot[]>();
  for (const row of await findBalancesByAccountIds(accounts.map((account) => account.id))) {
    const list = snapshotsByAccount.get(row.accountId) ?? [];
    list.push({ date: row.balanceDate, amount: row.amount });
    snapshotsByAccount.set(row.accountId, list);
  }
  const currencies = [...new Set(accounts.map((account) => account.currency))];
  const valueOn = async (date: string) => {
    const { rates, stale } = await getRates(date, currencies);
    return { valuation: valueAssets(accounts, snapshotsByAccount, (currency) => rates[currency] ?? null, date), stale };
  };

  // Today's debts come from the dashboard so both pages show the same numbers.
  const dashboard = await getMainDashboard(userId, asOf);
  const mortgagesDebt = round2(dashboard.cards.filter((card) => card.kind === 'mortgage').reduce((sum, card) => sum + card.totalRemaining, 0));
  const debts: NetWorthDebts = { total: dashboard.totalRemaining, cards: round2(dashboard.totalRemaining - mortgagesDebt), mortgages: mortgagesDebt };
  const current = await valueOn(asOf);

  const debtsOn = await loadDebtHistory(userId);
  const history: NetWorthResult['history'] = [];
  for (const date of historyDates(asOf, months)) {
    const point = date === asOf ? { valuation: current.valuation, debts } : { valuation: (await valueOn(date)).valuation, debts: debtsOn(date) };
    const assets = point.valuation.hasBalances ? point.valuation.total : null;
    history.push({
      date,
      assets,
      debts: point.debts.total,
      netWorth: assets === null ? null : round2(assets - point.debts.total),
    });
  }

  return {
    asOf,
    assets: current.valuation,
    ratesStale: current.stale,
    debts,
    netWorth: round2(current.valuation.total - debts.total),
    history,
  };
}
