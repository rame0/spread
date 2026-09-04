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
