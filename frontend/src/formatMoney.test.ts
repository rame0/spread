import { describe, expect, it } from 'vitest';
import { formatMoney, formatMoneyInput, formatMoneyValue } from './formatMoney';

describe('money formatting', () => {
  it('groups thousands and keeps non-zero kopecks', () => {
    expect(formatMoney(131763.58).replace(/\u00a0/g, ' ')).toBe('131 763,58 ₽');
  });

  it('always shows two kopeck digits', () => {
    expect(formatMoney(3604987.8).replace(/\u00a0/g, ' ')).toBe('3 604 987,80 ₽');
    expect(formatMoney(-0.5).replace(/\u00a0/g, ' ')).toBe('-0,50 ₽');
  });

  it('omits zero kopecks', () => {
    expect(formatMoney(420)).toBe('420 ₽');
    expect(formatMoneyValue(420)).toBe('420');
  });

  it('uses a compact value compatible with number inputs', () => {
    expect(formatMoneyInput(420)).toBe('420');
    expect(formatMoneyInput(131763.58)).toBe('131763.58');
  });
});
