import { createHash } from 'crypto';
import { PDFParse } from 'pdf-parse';

export type StatementBank = 'sber' | 'ozon';
export type StatementOperationKind = 'purchase' | 'deposit';

export interface ParsedStatementOperation {
  fingerprint: string;
  sourceId?: string;
  operationDate: string;
  operationTime?: string;
  kind: StatementOperationKind;
  amount: number;
  description: string;
}

export interface ParsedStatement {
  bank: StatementBank;
  periodStart: string;
  periodEnd: string;
  actualDebt: number;
  operations: ParsedStatementOperation[];
}

export class StatementParseError extends Error {}

const dateLine = /^\d{2}\.\d{2}\.\d{4}$/;
const timeLine = /^\d{2}:\d{2}(?::\d{2})?$/;

function isoDate(value: string): string {
  const [day, month, year] = value.split('.');
  return `${year}-${month}-${day}`;
}

function amount(value: string): number {
  return Math.round(Number(value.replace(/\s/g, '').replace(',', '.')) * 100) / 100;
}

function cleanLines(text: string): string[] {
  return text
    .replace(/\u00a0/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}

function operationFingerprint(
  bank: StatementBank,
  operation: Omit<ParsedStatementOperation, 'fingerprint'>
): string {
  return createHash('sha256')
    .update([
      bank,
      operation.operationDate,
      operation.operationTime ?? '',
      operation.sourceId ?? '',
      operation.kind,
      operation.amount.toFixed(2),
      operation.sourceId ? '' : operation.description,
    ].join('|'))
    .digest('hex');
}

function withFingerprint(
  bank: StatementBank,
  operation: Omit<ParsedStatementOperation, 'fingerprint'>
): ParsedStatementOperation {
  return { ...operation, fingerprint: operationFingerprint(bank, operation) };
}

function parsePeriod(text: string): [string, string] | null {
  const match = text.match(/(?:За период|Период выписки:)\s*(\d{2}\.\d{2}\.\d{4})\s*[—–-]\s*(\d{2}\.\d{2}\.\d{4})/i);
  return match ? [isoDate(match[1]), isoDate(match[2])] : null;
}

function parseSber(text: string): ParsedStatement {
  const period = parsePeriod(text);
  const debtMatch = text.match(/Общая задолженность на\s*(\d{2}\.\d{2}\.\d{4})\s*([\d ]+,\d{2})\s*₽/i);
  if (!period || !debtMatch) {
    throw new StatementParseError('Не удалось прочитать период или общую задолженность из выписки Сбера');
  }

  const lines = cleanLines(text);
  const operations: ParsedStatementOperation[] = [];
  for (let i = 0; i < lines.length - 6; i += 1) {
    if (!dateLine.test(lines[i]) || !dateLine.test(lines[i + 1]) || !timeLine.test(lines[i + 2])) continue;
    const sourceId = /^\d{6}$/.test(lines[i + 3]) ? lines[i + 3] : undefined;
    if (!sourceId) continue;

    let end = i + 4;
    while (end < lines.length) {
      if (
        end > i + 4 &&
        dateLine.test(lines[end]) &&
        dateLine.test(lines[end + 1] ?? '') &&
        timeLine.test(lines[end + 2] ?? '')
      ) break;
      if (/^-- \d+ of \d+ --$/.test(lines[end])) break;
      end += 1;
    }
    const block = lines.slice(i + 4, end);
    const moneyIndex = block.findIndex((line) => /^[+]?\d[\d ]*,\d{2}\s+\d[\d ]*,\d{2}$/.test(line));
    if (moneyIndex < 0) continue;
    const moneyMatch = block[moneyIndex].match(/^([+]?\d[\d ]*,\d{2})/);
    if (!moneyMatch) continue;
    const category = block[0] ?? '';
    const details = block.slice(1, moneyIndex).join(' ');
    const description = [category, details].filter(Boolean).join(' — ').slice(0, 512);
    const signed = moneyMatch[1];
    operations.push(withFingerprint('sber', {
      sourceId,
      operationDate: isoDate(lines[i]),
      operationTime: lines[i + 2],
      kind: signed.startsWith('+') ? 'deposit' : 'purchase',
      amount: amount(signed.replace('+', '')),
      description,
    }));
    i = end - 1;
  }
  if (operations.length === 0) throw new StatementParseError('В выписке Сбера не найдено операций');
  return {
    bank: 'sber',
    periodStart: period[0],
    periodEnd: period[1],
    actualDebt: amount(debtMatch[2]),
    operations,
  };
}

function parseOzon(text: string): ParsedStatement {
  const period = parsePeriod(text);
  const debtMatch = text.match(/Исходящий остаток:\s*([\d ]+\.\d{2})\s*₽/i);
  if (!period || !debtMatch) {
    throw new StatementParseError('Не удалось прочитать период или исходящий остаток из выписки Ozon');
  }

  const lines = cleanLines(text);
  const start = /^(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2}:\d{2})\s+(\d+)\s*(.*)$/;
  const operations: ParsedStatementOperation[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const header = lines[i].match(start);
    if (!header) continue;
    let end = i + 1;
    while (end < lines.length && !start.test(lines[end])) end += 1;
    const block = lines.slice(i + 1, end);
    const moneyIndex = block.findIndex((line) => /^[+-]\s*[\d ]+\.\d{2}\s*₽/.test(line));
    if (moneyIndex < 0) continue;
    const moneyMatch = block[moneyIndex].match(/^([+-])\s*([\d ]+\.\d{2})\s*₽/);
    if (!moneyMatch) continue;

    let sourceId = header[3];
    let descriptionStart = 0;
    if (block[0] && /^\d$/.test(block[0])) {
      sourceId += block[0];
      descriptionStart = 1;
    }
    const description = [header[4], ...block.slice(descriptionStart, moneyIndex)]
      .filter((line) => line && !/^-- \d+ of \d+ --$/.test(line) && !/^\d+$/.test(line))
      .join(' ')
      .slice(0, 512);
    operations.push(withFingerprint('ozon', {
      sourceId,
      operationDate: isoDate(header[1]),
      operationTime: header[2],
      kind: moneyMatch[1] === '+' ? 'deposit' : 'purchase',
      amount: amount(moneyMatch[2]),
      description,
    }));
    i = end - 1;
  }
  if (operations.length === 0) throw new StatementParseError('В выписке Ozon не найдено операций');
  return {
    bank: 'ozon',
    periodStart: period[0],
    periodEnd: period[1],
    actualDebt: amount(debtMatch[1]),
    operations,
  };
}

export function parseStatementText(text: string): ParsedStatement {
  const parsed = /ООО «ОЗОН Банк»|Справка о движении средств/i.test(text)
    ? parseOzon(text)
    : /СберБанк|Выписка по сч[её]ту кредитной карты/i.test(text)
      ? parseSber(text)
      : null;
  if (!parsed) throw new StatementParseError('Поддерживаются только текстовые PDF-выписки Сбера и Ozon Банка');
  if (parsed.operations.length > 5000) throw new StatementParseError('В выписке слишком много операций');
  return parsed;
}

export async function parseStatementPdf(buffer: Buffer): Promise<ParsedStatement> {
  if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new StatementParseError('Файл не является PDF');
  }
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    if (!result.text.trim()) throw new StatementParseError('PDF не содержит текстового слоя');
    return parseStatementText(result.text);
  } catch (error) {
    if (error instanceof StatementParseError) throw error;
    throw new StatementParseError('Не удалось прочитать PDF');
  } finally {
    await parser.destroy();
  }
}
