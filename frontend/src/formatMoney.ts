const wholeFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const kopecksFormatter = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Whole amounts without kopecks, otherwise always two digits: "420", "1 708,30". */
const rubleNumberFormatter = {
  format: (value: number) =>
    Math.round(Math.abs(value) * 100) % 100 === 0 ? wholeFormatter.format(value) : kopecksFormatter.format(value),
};

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

/** Sign of a currency, e.g. "₸"; unknown currencies keep their ISO code. */
export function currencySymbol(currency: string): string {
  return currencySymbols[currency] ?? currency;
}

/** Amount in the given currency, e.g. "1 500 ₸". */
export function formatCurrency(value: number, currency: string): string {
  return `${rubleNumberFormatter.format(value)} ${currencySymbol(currency)}`;
}

/** Whole rubles for summaries: "357 740 ₽". */
export function formatMoneyWhole(value: number): string {
  return `${wholeFormatter.format(Math.round(value))}\u00a0₽`;
}

const millionsFormatter = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Millions shortened for narrow places: "6,20 млн ₽"; smaller amounts in whole rubles. */
export function formatMoneyCompact(value: number, language = 'ru'): string {
  if (Math.abs(value) < 1_000_000) return formatMoneyWhole(value);
  return `${millionsFormatter.format(value / 1_000_000)}\u00a0${language.startsWith('ru') ? 'млн' : 'M'}\u00a0₽`;
}
