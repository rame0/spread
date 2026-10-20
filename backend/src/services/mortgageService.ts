import {
  paymentsToMarkPaid,
  simulateMortgage,
  type MortgageEvent,
  type MortgageSimulation,
  type MortgageTerms,
} from '../domain/mortgage-schedule';
import {
  createMortgage,
  createMortgageEvents,
  deleteMortgage,
  deleteMortgageEvent,
  findEventsByMortgageId,
  findMortgageById,
  findMortgagesByUserId,
  updateMortgage,
  type MortgageEventInput,
  type MortgageEventRow,
  type MortgageInput,
  type MortgageRow,
} from '../repositories/mortgageRepository';

const today = () => new Date().toISOString().slice(0, 10);

/** Event that cannot belong to the mortgage, e.g. dated before the loan was issued. */
export class MortgageEventError extends Error {}

export function toTerms(mortgage: MortgageRow): MortgageTerms {
  return {
    principal: mortgage.principal,
    issueDate: mortgage.issueDate,
    annualRate: mortgage.annualRate,
    termMonths: mortgage.termMonths,
    paymentDay: mortgage.paymentDay,
    firstPaymentInterestOnly: mortgage.firstPaymentInterestOnly,
  };
}

export function toDomainEvent(row: MortgageEventRow): MortgageEvent {
  const base = { id: row.id, date: row.eventDate };
  if (row.kind === 'payment') return { ...base, kind: 'payment', amount: row.amount ?? 0 };
  if (row.kind === 'prepayment') {
    return { ...base, kind: 'prepayment', amount: row.amount ?? 0, mode: row.prepaymentMode === 'reduce_term' ? 'reduce_term' : 'reduce_payment' };
  }
  if (row.kind === 'rate_change') return { ...base, kind: 'rate_change', rate: row.newRate ?? 0 };
  return { ...base, kind: 'reconciliation', actualBalance: row.actualBalance ?? 0 };
}

async function findOwned(mortgageId: string, userId: string) {
  const mortgage = await findMortgageById(mortgageId);
  return mortgage && mortgage.userId === userId ? mortgage : null;
}

export async function listMortgages(userId: string) {
  return findMortgagesByUserId(userId);
}

export async function getMortgage(mortgageId: string, userId: string) {
  return findOwned(mortgageId, userId);
}

export async function addMortgage(userId: string, data: MortgageInput) {
  return createMortgage(userId, data);
}

export async function patchMortgage(mortgageId: string, userId: string, data: Partial<MortgageInput>) {
  if (!(await findOwned(mortgageId, userId))) return null;
  return updateMortgage(mortgageId, data);
}

export async function removeMortgage(mortgageId: string, userId: string): Promise<boolean> {
  if (!(await findOwned(mortgageId, userId))) return false;
  await deleteMortgage(mortgageId);
  return true;
}

/** Mortgage with its recomputed schedule and the raw events (for editing). */
export async function getMortgageSchedule(
  mortgageId: string,
  userId: string,
  asOf = today()
): Promise<{ mortgage: MortgageRow; events: MortgageEventRow[]; simulation: MortgageSimulation } | null> {
  const mortgage = await findOwned(mortgageId, userId);
  if (!mortgage) return null;
  const events = await findEventsByMortgageId(mortgageId);
  return { mortgage, events, simulation: simulateMortgage(toTerms(mortgage), events.map(toDomainEvent), asOf) };
}

export async function addMortgageEvent(mortgageId: string, userId: string, event: MortgageEventInput) {
  const mortgage = await findOwned(mortgageId, userId);
  if (!mortgage) return null;
  if (event.eventDate <= mortgage.issueDate) throw new MortgageEventError('Event must be dated after the issue date');
  const [row] = await createMortgageEvents(mortgageId, [event]);
  return row;
}

export async function removeMortgageEvent(mortgageId: string, userId: string, eventId: string): Promise<boolean> {
  if (!(await findOwned(mortgageId, userId))) return false;
  return deleteMortgageEvent(mortgageId, eventId);
}

/** Records every unpaid scheduled payment up to `until` as paid with its scheduled amount. */
export async function markPaidUntil(mortgageId: string, userId: string, until: string) {
  const mortgage = await findOwned(mortgageId, userId);
  if (!mortgage) return null;
  const events = await findEventsByMortgageId(mortgageId);
  const payments = paymentsToMarkPaid(toTerms(mortgage), events.map(toDomainEvent), until);
  const created = await createMortgageEvents(
    mortgageId,
    payments.map((payment) => ({ kind: 'payment' as const, eventDate: payment.date, amount: payment.amount }))
  );
  return { created: created.length };
}
