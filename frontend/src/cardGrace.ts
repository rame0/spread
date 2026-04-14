import type { Card } from './types/v2';

export type GracePreset =
  | 'sber_120'
  | 'ozon_78'
  | 'custom_statement'
  | 'legacy_months';

export interface GraceFormValues {
  graceModel: 'legacy_months' | 'statement_periods';
  gracePeriods: string;
  graceDueDay: string;
  graceStatementPeriods: string;
  paymentDueOffsetDays: string;
}

export function presetDefaults(preset: GracePreset, reportDay: number): GraceFormValues {
  if (preset === 'sber_120') {
    return {
      graceModel: 'statement_periods',
      gracePeriods: '4',
      graceDueDay: String(reportDay),
      graceStatementPeriods: '4',
      paymentDueOffsetDays: '0',
    };
  }

  if (preset === 'ozon_78') {
    return {
      graceModel: 'statement_periods',
      gracePeriods: '2',
      graceDueDay: String(reportDay),
      graceStatementPeriods: '2',
      paymentDueOffsetDays: '16',
    };
  }

  if (preset === 'legacy_months') {
    return {
      graceModel: 'legacy_months',
      gracePeriods: '4',
      graceDueDay: String(reportDay),
      graceStatementPeriods: '4',
      paymentDueOffsetDays: '0',
    };
  }

  return {
    graceModel: 'statement_periods',
    gracePeriods: '2',
    graceDueDay: String(reportDay),
    graceStatementPeriods: '2',
    paymentDueOffsetDays: '16',
  };
}

export function detectPreset(card: Pick<Card, 'graceModel' | 'graceStatementPeriods' | 'paymentDueOffsetDays'>): GracePreset {
  if (card.graceModel === 'legacy_months') return 'legacy_months';
  if (card.graceStatementPeriods === 4 && card.paymentDueOffsetDays === 0) return 'sber_120';
  if (card.graceStatementPeriods === 2 && card.paymentDueOffsetDays === 16) return 'ozon_78';
  return 'custom_statement';
}
