import { embeddingText, nearestCategory, normalizeDescription, rulePattern, stripCity, transliterate } from '../categorize';

describe('categorize text preparation', () => {
  it('strips card boilerplate and the trailing country', () => {
    expect(normalizeDescription('Оплата в PYATEROCHKA 1234 Moscow RUS')).toBe('PYATEROCHKA 1234 Moscow');
    expect(normalizeDescription('Супермаркеты — MOSCOW MAGNIT 452. Операция по карте ****1234.')).toBe('Супермаркеты — MOSCOW MAGNIT 452');
  });

  it('drops the city a bank prints before the merchant', () => {
    expect(stripCity('Супермаркеты — Moscow MAGNIT 452')).toBe('Супермаркеты — MAGNIT 452');
    expect(stripCity('YANDEX TAXI KAZAN')).toBe('YANDEX TAXI');
  });

  it('transliterates Latin merchant names to Cyrillic', () => {
    expect(transliterate('MAGNIT')).toBe('магнит');
    expect(transliterate('SHAURMA')).toBe('шаурма');
    expect(embeddingText('Оплата в PYATEROCHKA Moscow RUS')).toBe('пятерочка');
  });

  it('keys rules case-insensitively on the normalized text', () => {
    expect(rulePattern('Магнит')).toBe(rulePattern('магнит'));
    expect(rulePattern('Оплата в STEAM RUS')).toBe('steam');
  });
});

describe('nearestCategory', () => {
  const a = [1, 0, 0];
  const b = [0, 1, 0];

  it('scores each category by its closest neighbour and reports the lead', () => {
    const result = nearestCategory([0.9, 0.3, 0], [
      { vector: a, categoryId: 'food' },
      { vector: b, categoryId: 'taxi' },
      { vector: [0.6, 0.8, 0], categoryId: 'taxi' },
    ]);
    expect(result?.categoryId).toBe('food');
    expect(result?.margin).toBeCloseTo(0.9 - 0.78);
  });

  it('returns null without neighbours', () => {
    expect(nearestCategory(a, [])).toBeNull();
  });
});
