import React, { useState } from 'react';
import { Alert, Box, Button, Snackbar, Stack, TextField, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';
import { addDeposit } from '../services/api';
import { FormField } from './FormField';

type DepositFormProps = {
  cardId: string;
  title?: string;
  onSubmitted?: () => void;
};

export default function DepositForm({ cardId, title, onSubmitted }: DepositFormProps) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<Date | null>(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !amount) return;

    setSubmitting(true);
    setError('');
    addDeposit(cardId, {
      depositDate: format(date, 'yyyy-MM-dd'),
      amount: Number(amount),
    })
      .then(() => {
        setAmount('');
        setDate(new Date());
        setSuccess(t('deposits.add.success'));
        onSubmitted?.();
      })
      .catch(() => setError(t('deposits.add.error')))
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
          <FormField label={t('deposits.add.date')}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={locale}>
              <DatePicker
                value={date}
                onChange={(nextDate) => setDate(nextDate)}
                slotProps={{ textField: { fullWidth: true, placeholder: t('deposits.add.date') } }}
              />
            </LocalizationProvider>
          </FormField>
          <FormField label={t('deposits.add.amount')}>
            <TextField
              fullWidth
              placeholder={t('deposits.add.amount')}
              type="number"
              inputProps={{ step: 0.01, min: 0 }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </FormField>
        </Box>
        <Button type="submit" variant="contained" disabled={submitting} fullWidth>
          {t('deposits.add.submit')}
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
