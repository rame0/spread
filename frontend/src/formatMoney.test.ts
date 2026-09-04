import { describe, expect, it } from 'vitest';
import { formatMoney, formatMoneyValue } from './formatMoney';

describe('money formatting', () => {
  it('groups thousands and keeps non-zero kopecks', () => {
    expect(formatMoney(131763.58).replace(/\u00a0/g, ' ')).toBe('131 763,58 ₽');
  });

  it('omits zero kopecks', () => {
    expect(formatMoney(420)).toBe('420 ₽');
    expect(formatMoneyValue(420)).toBe('420');
  });
});
