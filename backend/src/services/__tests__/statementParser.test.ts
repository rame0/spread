import { parseStatementText, StatementParseError } from '../statementParser';

describe('statementParser', () => {
  it('parses Sber purchases, refunds and closing debt', () => {
    const statement = parseStatementText(`
      Заказано в СберБанк Онлайн
      Выписка по счёту кредитной карты
      За период 01.08.2026 — 02.09.2026
      Общая задолженность на
      02.09.2026
      205 853,26 ₽
      Расшифровка операций
      02.09.2026
      02.09.2026
      14:42
      721868
      Супермаркеты
      Ulyanovsk TABAK. Операция по карте ****6097
      420,00 194 146,74
      17.08.2026
      17.08.2026
      08:03
      210835
      Возврат, отмена операции
      Возврат покупки. Операция по карте ****6097
      +1 526,94 220 126,14
      -- 1 of 1 --
    `);
    expect(statement.bank).toBe('sber');
    expect(statement.actualDebt).toBe(205853.26);
    expect(statement.operations).toHaveLength(2);
    expect(statement.operations[0]).toMatchObject({ kind: 'purchase', amount: 420, sourceId: '721868' });
    expect(statement.operations[1]).toMatchObject({ kind: 'deposit', amount: 1526.94, sourceId: '210835' });
  });

  it('parses Ozon operations and joins a wrapped document number', () => {
    const statement = parseStatementText(`
      ООО «ОЗОН Банк»
      Справка о движении средств
      Период выписки: 03.06.2026 – 03.09.2026
      03.09.2026 08:57:21 13109495146 Оплата товаров/услуг
      на Платформе Ozon,
      заказ № 01892034-0114.
      - 170.00 ₽ - 170.00 ₽
      14.08.2026 11:12:13 1258169613
      0
      Погашение кредита по договору
      + 36 336.88 ₽ + 36 336.88 ₽
      Исходящий остаток: 24 914.00 ₽
    `);
    expect(statement.bank).toBe('ozon');
    expect(statement.actualDebt).toBe(24914);
    expect(statement.operations).toHaveLength(2);
    expect(statement.operations[1]).toMatchObject({
      kind: 'deposit',
      amount: 36336.88,
      sourceId: '12581696130',
    });
  });

  it('rejects unsupported documents', () => {
    expect(() => parseStatementText('some other PDF')).toThrow(StatementParseError);
  });
});
