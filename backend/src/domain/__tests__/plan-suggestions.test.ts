import { categoryPlanVsFact, suggestPlanItems, type CategorizedPlanItem, type CategorizedPurchase } from '../plan-suggestions';

const TODAY = '2026-10-24';
const names = new Map([
  ['food', 'Продукты'],
  ['subs', 'Подписки'],
]);

function purchase(date: string, amount: number, pattern: string, categoryId: string | null = 'food'): CategorizedPurchase {
  return { date, amount, cardId: 'card', categoryId, pattern, label: pattern };
}

function item(fields: Partial<CategorizedPlanItem>): CategorizedPlanItem {
  return {
    id: 'item',
    name: 'item',
    kind: 'expense',
    amount: 1000,
    currency: 'RUB',
    frequency: 'monthly',
    interval: 1,
    startDate: '2026-01-01',
    endDate: null,
    spread: false,
    cardId: null,
    targetAccountId: null,
    categoryId: null,
    sourcePattern: null,
    ...fields,
  };
}

const plus = ['2026-06-15', '2026-07-15', '2026-08-15', '2026-09-15', '2026-10-15'].map((date) => purchase(date, 399, 'yandex plus', 'subs'));
const groceries = [
  purchase('2026-07-03', 9000, 'magnit'),
  purchase('2026-07-20', 3000, 'pyaterochka'),
  purchase('2026-08-05', 11000, 'magnit'),
  purchase('2026-09-09', 14000, 'magnit'),
];

describe('suggestPlanItems', () => {
  it('suggests a monthly charge at a steady price as a subscription from its next date', () => {
    const [suggestion] = suggestPlanItems(plus, [], [], names, TODAY).filter((s) => s.kind === 'subscription');
    expect(suggestion).toMatchObject({ action: 'add', name: 'yandex plus', amount: 399, startDate: '2026-11-15', categoryId: 'subs', sourcePattern: 'yandex plus' });
  });

  it('ignores a merchant bought from several times a month, a stale charge and a jumpy price', () => {
    const twice = [...plus, purchase('2026-09-20', 399, 'yandex plus', 'subs')];
    const stale = plus.slice(0, 3);
    const jumpy = plus.map((row, i) => ({ ...row, amount: i % 2 ? 399 : 999 }));
    for (const rows of [twice, stale, jumpy]) {
      expect(suggestPlanItems(rows, [], [], names, TODAY).filter((s) => s.kind === 'subscription')).toEqual([]);
    }
  });

  it('suggests updating a linked item when the price changed', () => {
    const items = [item({ id: 'plus', amount: 299, sourcePattern: 'yandex plus', categoryId: 'subs' })];
    const [suggestion] = suggestPlanItems(plus, items, [], names, TODAY).filter((s) => s.kind === 'subscription');
    expect(suggestion).toMatchObject({ action: 'update', planItemId: 'plus', currentAmount: 299, amount: 399 });
  });

  it('suggests a category budget at the median of the last full months', () => {
    const [suggestion] = suggestPlanItems(groceries, [], [], names, TODAY);
    expect(suggestion).toMatchObject({ kind: 'budget', action: 'add', name: 'Продукты', amount: 12000, spread: true, startDate: '2026-10-01' });
    expect(suggestion.months.map((m) => m.amount)).toEqual([12000, 11000, 14000]);
  });

  it('leaves out of a budget what other items of the category already plan', () => {
    const items = [item({ amount: 5000, categoryId: 'food', sourcePattern: 'magnit' })];
    const [suggestion] = suggestPlanItems(groceries, items, [], names, TODAY);
    expect(suggestion.amount).toBe(7000);
  });

  it('suggests updating a budget only when it is off by more than the tolerance', () => {
    const close = [item({ id: 'budget', amount: 11500, categoryId: 'food' })];
    expect(suggestPlanItems(groceries, close, [], names, TODAY)).toEqual([]);
    const far = [item({ id: 'budget', amount: 8000, categoryId: 'food' })];
    expect(suggestPlanItems(groceries, far, [], names, TODAY)[0]).toMatchObject({ action: 'update', planItemId: 'budget', amount: 12000 });
  });

  it('keeps a dismissed suggestion hidden until its amount moves', () => {
    expect(suggestPlanItems(groceries, [], [{ key: 'budget:food', amount: 12500 }], names, TODAY)).toEqual([]);
    expect(suggestPlanItems(groceries, [], [{ key: 'budget:food', amount: 8000 }], names, TODAY)).toHaveLength(1);
  });
});

describe('categoryPlanVsFact', () => {
  it('sums planned occurrences and card purchases of each category in the month', () => {
    const items = [
      item({ amount: 12000, categoryId: 'food', spread: true, startDate: '2026-09-01' }),
      item({ amount: 399, categoryId: 'subs', startDate: '2026-06-15' }),
      item({ kind: 'income', amount: 100000, categoryId: null }),
    ];
    const rows = categoryPlanVsFact(items, [...groceries, ...plus, purchase('2026-09-30', 700, 'x', null)], '2026-09');
    expect(rows).toEqual([
      { categoryId: 'food', plan: 12000, fact: 14000 },
      { categoryId: null, plan: 0, fact: 700 },
      { categoryId: 'subs', plan: 399, fact: 399 },
    ]);
  });
});
