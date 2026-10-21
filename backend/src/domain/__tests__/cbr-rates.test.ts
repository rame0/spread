import { cbrRequestDate, parseCbrDaily } from '../cbr-rates';

const xml = `<?xml version="1.0" encoding="windows-1251"?><ValCurs Date="21.10.2026" name="Foreign Currency Market">
<Valute ID="R01235"><NumCode>840</NumCode><CharCode>USD</CharCode><Nominal>1</Nominal><Name>Доллар США</Name><Value>81,4567</Value><VunitRate>81,4567</VunitRate></Valute>
<Valute ID="R01335"><NumCode>398</NumCode><CharCode>KZT</CharCode><Nominal>100</Nominal><Name>Тенге</Name><Value>15,8312</Value><VunitRate>0,158312</VunitRate></Valute>
<Valute ID="R09999"><NumCode>000</NumCode><CharCode>XXX</CharCode><Nominal>1</Nominal><Name>Broken</Name><Value></Value></Valute>
</ValCurs>`;

describe('CBR daily rates', () => {
  it('parses the date and rates per one unit', () => {
    const parsed = parseCbrDaily(xml);
    expect(parsed.date).toBe('2026-10-21');
    expect(parsed.rates.USD).toBe(81.4567);
    expect(parsed.rates.KZT).toBe(0.158312);
  });

  it('skips currencies without a value', () => {
    expect(parseCbrDaily(xml).rates).not.toHaveProperty('XXX');
  });

  it('rejects a response without a date', () => {
    expect(() => parseCbrDaily('<html>error</html>')).toThrow();
  });

  it('formats the request date', () => {
    expect(cbrRequestDate('2026-01-05')).toBe('05/01/2026');
  });
});
