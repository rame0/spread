/** Monthly series for the overview charts: debt payments ahead and card spending behind. */

export type CardDebtKind = 'credit' | 'installment';

export interface DebtLoadInput {
  today: string;
  months: number;
  /** Unpaid card buckets; overdue ones count in the current month. */
  cardPayments: Array<{ kind: CardDebtKind; dueDate: string; amount: number }>;
  /** Each mortgage with its principal today and its unpaid scheduled payments. */
  mortgages: Array<{ balance: number; payments: Array<{ date: string; amount: number; balanceAfter: number }> }>;
}

export interface DebtLoadMonth {
  month: string;
  credit: number;
  installment: number;
  mortgage: number;
  /** Card buckets still unpaid after the month's payments. */
  cardDebtEnd: number;
  /** Mortgage principal after the month's payments. */
  mortgageEnd: number;
}

export interface CardSpendingMonth {
  month: string;
  total: number;
  byCard: Record<string, number>;
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** `count` month keys (yyyy-MM) starting `offset` months from the month of `today`. */
export function monthKeys(today: string, offset: number, count: number): string[] {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1 + offset;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month + index, 1));
    return date.toISOString().slice(0, 7);
  });
}

export function buildDebtLoad(input: DebtLoadInput): DebtLoadMonth[] {
  const keys = monthKeys(input.today, 0, input.months);
  const first = keys[0];
  const monthOf = (date: string) => (date.slice(0, 7) < first ? first : date.slice(0, 7));

  return keys.map((key) => {
    const cards = input.cardPayments.filter((payment) => monthOf(payment.dueDate) === key);
    const cardsLater = input.cardPayments.filter((payment) => monthOf(payment.dueDate) > key);
    let mortgage = 0;
    let mortgageEnd = 0;
    for (const item of input.mortgages) {
      let balance = item.balance;
      for (const payment of item.payments) {
        const month = monthOf(payment.date);
        if (month === key) mortgage += payment.amount;
        if (month <= key) balance = payment.balanceAfter;
      }
      mortgageEnd += balance;
    }
    const sum = (kind: CardDebtKind) => cards.filter((payment) => payment.kind === kind).reduce((total, payment) => total + payment.amount, 0);
    return {
      month: key,
      credit: round2(sum('credit')),
      installment: round2(sum('installment')),
      mortgage: round2(mortgage),
      cardDebtEnd: round2(cardsLater.reduce((total, payment) => total + payment.amount, 0)),
      mortgageEnd: round2(mortgageEnd),
    };
  });
}

/** Purchases per card in each of the last `months` months, the current one included. */
export function buildCardSpending(
  today: string,
  months: number,
  purchases: Array<{ cardId: string; date: string; amount: number }>
): CardSpendingMonth[] {
  const rows = monthKeys(today, 1 - months, months).map((month) => ({ month, total: 0, byCard: {} as Record<string, number> }));
  const byMonth = new Map(rows.map((row) => [row.month, row]));
  for (const purchase of purchases) {
    if (purchase.date > today) continue;
    const row = byMonth.get(purchase.date.slice(0, 7));
    if (!row) continue;
    row.byCard[purchase.cardId] = round2((row.byCard[purchase.cardId] ?? 0) + purchase.amount);
    row.total = round2(row.total + purchase.amount);
  }
  return rows;
}
