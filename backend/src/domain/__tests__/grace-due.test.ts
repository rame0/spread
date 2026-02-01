import { getGraceDueDate } from '../grace-due';

describe('getGraceDueDate', () => {
  it('January period + 4 grace periods, due day 10 → 10 May', () => {
    const periodStart = { year: 2025, month: 1 };
    const due = getGraceDueDate(periodStart, 4, 10);
    expect(due.getFullYear()).toBe(2025);
    expect(due.getMonth()).toBe(4); // May = 4 (0-based)
    expect(due.getDate()).toBe(10);
  });

  it('February period + 4, due day 10 → 10 June', () => {
    const periodStart = { year: 2025, month: 2 };
    const due = getGraceDueDate(periodStart, 4, 10);
    expect(due.getFullYear()).toBe(2025);
    expect(due.getMonth()).toBe(5);
    expect(due.getDate()).toBe(10);
  });

  it('graceDueDay 31 in February → last day of February', () => {
    const periodStart = { year: 2024, month: 11 }; // Nov 2024
    const due = getGraceDueDate(periodStart, 4, 31);
    expect(due.getFullYear()).toBe(2025);
    expect(due.getMonth()).toBe(2); // March
    expect(due.getDate()).toBe(31);
  });

  it('graceDueDay 31 for March due month → 31', () => {
    const periodStart = { year: 2023, month: 11 }; // Nov 2023 → due Mar 2024
    const due = getGraceDueDate(periodStart, 4, 31);
    expect(due.getFullYear()).toBe(2024);
    expect(due.getMonth()).toBe(2); // March
    expect(due.getDate()).toBe(31);
  });
});
