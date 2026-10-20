/**
 * Installment plan of a single purchase (Yandex Split-like cards).
 * Pure domain — no DB.
 */

import { addCalendarMonths } from './card-grace';

export type InstallmentInterval = 'week' | '2weeks' | 'month';

export const INSTALLMENT_INTERVALS: readonly InstallmentInterval[] = ['week', '2weeks', 'month'];

export interface InstallmentPlanInput {
  amount: number;
  /** Total overpayment for the whole plan, spread evenly over the payments. */
  fee: number;
  count: number;
  interval: InstallmentInterval;
  /** YYYY-MM-DD */
  firstPaymentDate: string;
}

export interface InstallmentPayment {
  number: number;
  /** YYYY-MM-DD */
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

/** Due date of the payment with zero-based `index`; months are counted from the first date to avoid drift. */
export function installmentDueDate(
  firstPaymentDate: string,
  interval: InstallmentInterval,
  index: number
): string {
  const first = parseDate(firstPaymentDate);
  if (interval === 'month') return formatDate(addCalendarMonths(first, index));
  const days = interval === 'week' ? 7 : 14;
  return formatDate(new Date(first.getFullYear(), first.getMonth(), first.getDate() + days * index));
}

/** Default first payment: one interval after the purchase. */
export function defaultFirstPaymentDate(purchaseDate: string, interval: InstallmentInterval): string {
  return installmentDueDate(purchaseDate, interval, 1);
}

/**
 * Splits amount + fee into `count` equal payments rounded to kopecks;
 * the rounding remainder goes to the last payment.
 */
export function buildInstallmentSchedule(input: InstallmentPlanInput): InstallmentPayment[] {
  if (!Number.isInteger(input.count) || input.count < 1) throw new Error('installmentCount must be a positive integer');
  if (!(input.amount > 0)) throw new Error('amount must be positive');
  if (!(input.fee >= 0)) throw new Error('installmentFee must not be negative');

  const totalCents = Math.round((input.amount + input.fee) * 100);
  const regularCents = Math.floor(totalCents / input.count);
  const lastCents = totalCents - regularCents * (input.count - 1);

  return Array.from({ length: input.count }, (_, index) => ({
    number: index + 1,
    dueDate: installmentDueDate(input.firstPaymentDate, input.interval, index),
    amount: (index === input.count - 1 ? lastCents : regularCents) / 100,
  }));
}
