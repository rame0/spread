import type { InstallmentInterval } from './types/v2';

/** Mirrors backend/src/domain/installment-schedule.ts for the form preview. */
export interface InstallmentPaymentPreview {
  number: number;
  dueDate: string;
  amount: number;
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function addCalendarMonths(date: Date, delta: number): Date {
  const targetMonth = date.getMonth() + delta;
  const lastDay = new Date(date.getFullYear(), targetMonth + 1, 0).getDate();
  return new Date(date.getFullYear(), targetMonth, Math.min(date.getDate(), lastDay));
}

export function installmentDueDate(firstPaymentDate: string, interval: InstallmentInterval, index: number): string {
  const first = parseDate(firstPaymentDate);
  if (interval === 'month') return formatDate(addCalendarMonths(first, index));
  const days = interval === 'week' ? 7 : 14;
  return formatDate(new Date(first.getFullYear(), first.getMonth(), first.getDate() + days * index));
}

export function defaultFirstPaymentDate(purchaseDate: string, interval: InstallmentInterval): string {
  return installmentDueDate(purchaseDate, interval, 1);
}

export function buildInstallmentSchedule(input: {
  amount: number;
  fee: number;
  count: number;
  interval: InstallmentInterval;
  firstPaymentDate: string;
}): InstallmentPaymentPreview[] {
  if (!Number.isInteger(input.count) || input.count < 1 || !(input.amount > 0) || !(input.fee >= 0)) return [];
  const totalCents = Math.round((input.amount + input.fee) * 100);
  const regularCents = Math.floor(totalCents / input.count);
  const lastCents = totalCents - regularCents * (input.count - 1);
  return Array.from({ length: input.count }, (_, index) => ({
    number: index + 1,
    dueDate: installmentDueDate(input.firstPaymentDate, input.interval, index),
    amount: (index === input.count - 1 ? lastCents : regularCents) / 100,
  }));
}
