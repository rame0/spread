import { describe, expect, it } from 'vitest';
import { getDueTone, getReconciliationPreview } from './Dashboard';

describe('dashboard due-date status', () => {
  const today = new Date(2026, 8, 4);

  it('marks past dates as overdue', () => {
    expect(getDueTone('2026-08-29', today)).toBe('danger');
  });

  it('warns during the final seven days', () => {
    expect(getDueTone('2026-09-11', today)).toBe('warning');
  });

  it('leaves later dates neutral', () => {
    expect(getDueTone('2026-09-12', today)).toBe('default');
  });
});

describe('reconciliation history preview', () => {
  it('keeps only the four newest reconciliations', () => {
    expect(getReconciliationPreview(['newest', 'second', 'third', 'fourth', 'older']))
      .toEqual(['newest', 'second', 'third', 'fourth']);
  });
});
