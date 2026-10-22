import { differenceInCalendarDays } from 'date-fns';

export type DueTone = 'default' | 'warning' | 'danger';

/** Overdue dates are dangerous, the final seven days are a warning. */
export function getDueTone(dueDate: string | null, today: Date): DueTone {
  if (!dueDate) return 'default';
  const remainingDays = differenceInCalendarDays(new Date(`${dueDate.slice(0, 10)}T12:00:00`), today);
  if (remainingDays < 0) return 'danger';
  if (remainingDays <= 7) return 'warning';
  return 'default';
}

export const dueToneColor: Record<DueTone, string | undefined> = {
  default: undefined,
  warning: 'warning.main',
  danger: 'error.main',
};
