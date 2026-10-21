import { parseKeyRates } from '../cbr-key-rate';
import { estimateInterestTax, keyRateOn, taxFreeLimit } from '../interest-tax';

const xml =
  '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>' +
  '<KeyRateXMLResponse xmlns="http://web.cbr.ru/"><KeyRateXMLResult><KeyRate xmlns="">' +
  '<KR><DT>2026-02-16T00:00:00+03:00</DT><Rate>15.50</Rate></KR>' +
  '<KR><DT>2025-12-30T00:00:00+03:00</DT><Rate>16.00</Rate></KR>' +
  '</KeyRate></KeyRateXMLResult></KeyRateXMLResponse></soap:Body></soap:Envelope>';

describe('interest tax', () => {
  it('parses key rates from the CBR SOAP response, oldest first', () => {
    expect(parseKeyRates(xml)).toEqual([
      { date: '2025-12-30', rate: 16 },
      { date: '2026-02-16', rate: 15.5 },
    ]);
  });

  it('takes the last rate published on or before the date', () => {
    const rates = parseKeyRates(xml);
    expect(keyRateOn(rates, '2025-12-29')).toBeNull();
    expect(keyRateOn(rates, '2026-01-01')).toBe(16);
    expect(keyRateOn(rates, '2026-03-01')).toBe(15.5);
  });

  it('uses the highest rate on the first day of a month', () => {
    const rates = [
      { date: '2025-12-30', rate: 16 },
      { date: '2026-01-02', rate: 21 },
      { date: '2026-01-20', rate: 14 },
    ];
    // January 1 still has 16%, the 21% of January 2–19 never falls on a first day.
    expect(taxFreeLimit(rates, 2026, '2026-10-21')).toEqual({ limit: 160000, maxKeyRate: 16 });
  });

  it('taxes 13% of the excess and 15% above 2.4 mln', () => {
    expect(estimateInterestTax(150000, 160000)).toEqual({ taxable: 0, tax: 0 });
    expect(estimateInterestTax(260000, 160000)).toEqual({ taxable: 100000, tax: 13000 });
    expect(estimateInterestTax(2660000, 160000)).toEqual({ taxable: 2500000, tax: 312000 + 15000 });
  });
});
