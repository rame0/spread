const rubleNumberFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatMoney(value: number): string {
  return `${rubleNumberFormatter.format(value)} ₽`;
}

export function formatMoneyValue(value: number): string {
  return rubleNumberFormatter.format(value);
}

export function formatMoneyInput(value: number): string {
  return String(Math.round((value + Number.EPSILON) * 100) / 100);
}

const currencySymbols: Record<string, string> = { RUB: '₽', USD: '$', EUR: '€', KZT: '₸', CNY: '¥', GBP: '£' };

/** Amount in the given currency, e.g. "1 500 ₸"; unknown currencies keep their ISO code. */
export function formatCurrency(value: number, currency: string): string {
  return `${rubleNumberFormatter.format(value)} ${currencySymbols[currency] ?? currency}`;
}
