/** CBR key rate from the KeyRateXML SOAP method of DailyInfoWebServ. Pure domain — no network. */

export interface KeyRatePoint {
  /** YYYY-MM-DD */
  date: string;
  /** Percent per year. */
  rate: number;
}

export function keyRateRequest(from: string, to: string): string {
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>' +
    `<KeyRateXML xmlns="http://web.cbr.ru/"><fromDate>${from}</fromDate><ToDate>${to}</ToDate></KeyRateXML>` +
    '</soap:Body></soap:Envelope>'
  );
}

/** Rates on working days, oldest first. */
export function parseKeyRates(xml: string): KeyRatePoint[] {
  const points: KeyRatePoint[] = [];
  for (const match of xml.matchAll(/<KR>\s*<DT>(\d{4}-\d{2}-\d{2})[^<]*<\/DT>\s*<Rate>([\d.]+)<\/Rate>\s*<\/KR>/g)) {
    points.push({ date: match[1], rate: Number(match[2]) });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}
