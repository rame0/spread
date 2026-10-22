import React, { useMemo, useState } from 'react';
import { Alert, Box, Button, MenuItem, Select, Snackbar, Stack, TextField, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';
import { formatMoney } from '../formatMoney';
import { buildInstallmentSchedule, defaultFirstPaymentDate } from '../installmentSchedule';
import { addPurchase } from '../services/api';
import type { CardKind, InstallmentInterval, InstallmentPlan } from '../types/v2';
import { FormField } from './FormField';

const COUNT_PRESETS = ['2', '4', '6', '12', '24'];
const INTERVALS: InstallmentInterval[] = ['week', '2weeks', 'month'];

type PurchaseFormProps = {
  cardId: string;
  cardKind?: CardKind;
  title?: string;
  onSubmitted?: () => void;
};

export default function PurchaseForm({ cardId, cardKind = 'credit', title, onSubmitted }: PurchaseFormProps) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<Date | null>(new Date());
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const isInstallment = cardKind === 'installment';
  const [countPreset, setCountPreset] = useState('4');
  const [customCount, setCustomCount] = useState('');
  const [interval, setPlanInterval] = useState<InstallmentInterval>('month');
  /** null while the first payment follows the purchase date automatically. */
  const [firstPayment, setFirstPayment] = useState<Date | null>(null);
  const [fee, setFee] = useState('0');

  const purchaseDate = date ? format(date, 'yyyy-MM-dd') : null;
  const firstPaymentDate = firstPayment
    ? format(firstPayment, 'yyyy-MM-dd')
    : purchaseDate && defaultFirstPaymentDate(purchaseDate, interval);
  const count = Number(countPreset === 'custom' ? customCount : countPreset);
  const schedule = useMemo(
    () => (isInstallment && firstPaymentDate
      ? buildInstallmentSchedule({ amount: Number(amount), fee: Number(fee || 0), count, interval, firstPaymentDate })
      : []),
    [isInstallment, firstPaymentDate, amount, fee, count, interval]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseDate || !amount) return;
    let plan: InstallmentPlan | undefined;
    if (isInstallment) {
      if (!firstPaymentDate || schedule.length === 0) return;
      if (firstPaymentDate < purchaseDate) {
        setError(t('installment.firstPaymentError'));
        return;
      }
      plan = { installmentCount: count, installmentInterval: interval, firstPaymentDate, installmentFee: Number(fee || 0) };
    }

    setSubmitting(true);
    setError('');
    addPurchase(cardId, {
      purchaseDate,
      amount: Number(amount),
      description: description || undefined,
      plan,
    })
      .then(() => {
        setAmount('');
        setDescription('');
        setDate(new Date());
        setFirstPayment(null);
        setFee('0');
        setSuccess(t('purchases.add.success'));
        onSubmitted?.();
      })
      .catch(() => setError(t('purchases.add.error')))
      .finally(() => setSubmitting(false));
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={2}>
        {title && <Typography variant="subtitle1">{title}</Typography>}
        {error && (
          <Alert severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 1.5 }}>
          <FormField label={t('purchases.add.date')}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={locale}>
              <DatePicker
                value={date}
                onChange={(nextDate) => setDate(nextDate)}
                slotProps={{ textField: { fullWidth: true, placeholder: t('purchases.add.date') } }}
              />
            </LocalizationProvider>
          </FormField>
          <FormField label={t('purchases.add.amount')}>
            <TextField
              fullWidth
              placeholder={t('purchases.add.amount')}
              type="number"
              inputProps={{ step: 0.01, min: 0 }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </FormField>
          <FormField label={t('purchases.add.description')} sx={{ gridColumn: '1 / -1' }}>
            <TextField
              fullWidth
              placeholder={t('purchases.add.description')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
        </Box>
        {isInstallment && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: 1.5,
              alignItems: 'start',
            }}
          >
            <FormField label={t('installment.count')}>
              <Stack direction="row" spacing={1}>
                <Select
                  fullWidth
                  value={countPreset}
                  inputProps={{ 'aria-label': t('installment.count') }}
                  onChange={(e) => setCountPreset(e.target.value)}
                >
                  {COUNT_PRESETS.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                  <MenuItem value="custom">{t('installment.countCustom')}</MenuItem>
                </Select>
                {countPreset === 'custom' && (
                  <TextField
                    type="number"
                    inputProps={{ min: 1, max: 36, step: 1, 'aria-label': t('installment.count') }}
                    value={customCount}
                    onChange={(e) => setCustomCount(e.target.value)}
                    required
                    sx={{ minWidth: 88 }}
                  />
                )}
              </Stack>
            </FormField>
            <FormField label={t('installment.interval')}>
              <Select
                fullWidth
                value={interval}
                inputProps={{ 'aria-label': t('installment.interval') }}
                onChange={(e) => setPlanInterval(e.target.value as InstallmentInterval)}
              >
                {INTERVALS.map((value) => (
                  <MenuItem key={value} value={value}>{t(`installment.intervals.${value}`)}</MenuItem>
                ))}
              </Select>
            </FormField>
            <FormField label={t('installment.firstPayment')}>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={locale}>
                <DatePicker
                  value={firstPayment ?? (firstPaymentDate ? new Date(`${firstPaymentDate}T00:00:00`) : null)}
                  onChange={(nextDate) => setFirstPayment(nextDate)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </FormField>
            <FormField label={t('installment.fee')}>
              <TextField
                fullWidth
                type="number"
                inputProps={{ step: 0.01, min: 0 }}
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                helperText={t('installment.feeHelp')}
              />
            </FormField>
          </Box>
        )}
        {isInstallment && schedule.length > 0 && (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {t('installment.previewTitle')} · {t('installment.previewTotal', { amount: formatMoney(schedule.reduce((sum, payment) => sum + payment.amount, 0)) })}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {schedule
                .map((payment) => `${format(new Date(`${payment.dueDate}T00:00:00`), 'd MMM yyyy', { locale })} — ${formatMoney(payment.amount)}`)
                .join(' · ')}
            </Typography>
          </Box>
        )}
        <Button type="submit" variant="contained" disabled={submitting} fullWidth>
          {t('purchases.add.submit')}
        </Button>
      </Stack>
      <Snackbar
        open={Boolean(success)}
        autoHideDuration={3000}
        onClose={() => setSuccess('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
}
