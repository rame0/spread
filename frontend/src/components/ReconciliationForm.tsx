import React, { useMemo, useState } from 'react';
import { Alert, Box, Button, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { formatMoneyInput, formatMoneyValue } from '../formatMoney';
import { getDateFnsLocale } from '../i18n';
import { addReconciliation } from '../services/api';
import { FormField, LabeledTextField } from './FormField';

export default function ReconciliationForm({ cardId, calculatedDebt, overdueDebt = 0, onSubmitted }: {
  cardId: string; calculatedDebt: number; overdueDebt?: number; onSubmitted?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [date, setDate] = useState<Date | null>(new Date());
  const [amount, setAmount] = useState(formatMoneyInput(calculatedDebt));
  const [noOverdue, setNoOverdue] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const difference = useMemo(() => Number(amount) - calculatedDebt, [amount, calculatedDebt]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!date || amount === '') return;
    setSubmitting(true); setError('');
    try {
      await addReconciliation(cardId, { reconciliationDate: format(date, 'yyyy-MM-dd'), actualDebt: Number(amount), noOverdue });
      onSubmitted?.();
    } catch (cause) {
      const data = axios.isAxiosError(cause) ? cause.response?.data : undefined;
      setError(data?.lastAllowedDate
        ? t('reconciliation.dateError', { first: data.firstAllowedDate || '—', last: data.lastAllowedDate })
        : t('reconciliation.error'));
    } finally { setSubmitting(false); }
  };
  return <Box component="form" onSubmit={submit}><Stack spacing={2}>
    <Typography variant="subtitle1">{t('reconciliation.title')}</Typography>
    {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
    <Typography color="text.secondary">{t('reconciliation.calculated', { amount: formatMoneyValue(calculatedDebt) })}</Typography>
    <FormField label={t('reconciliation.date')}>
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={getDateFnsLocale(i18n.language)}>
        <DatePicker
          value={date}
          onChange={setDate}
          maxDate={new Date()}
          slotProps={{ textField: { fullWidth: true, inputProps: { 'aria-label': t('reconciliation.date') } } }}
        />
      </LocalizationProvider>
    </FormField>
    <LabeledTextField label={t('reconciliation.actualDebt')} type="number" required fullWidth value={amount} inputProps={{ step: 0.01, min: 0 }} onChange={(e) => setAmount(e.target.value)} />
    <Typography color="text.secondary">{t('reconciliation.difference', { amount: Number.isFinite(difference) ? formatMoneyValue(difference) : '—' })}</Typography>
    {overdueDebt > 0 && <Box>
      <FormControlLabel control={<Switch checked={noOverdue} onChange={(e) => setNoOverdue(e.target.checked)} />} label={t('reconciliation.noOverdue')} />
      <Typography variant="body2" color="text.secondary">{t('reconciliation.noOverdueHint', { amount: formatMoneyValue(overdueDebt) })}</Typography>
    </Box>}
    <Button type="submit" variant="contained" disabled={submitting}>{t('reconciliation.submit')}</Button>
  </Stack></Box>;
}
