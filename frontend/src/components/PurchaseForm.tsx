import React, { useState } from 'react';
import { Alert, Box, Button, Snackbar, Stack, TextField, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';
import { addPurchase } from '../services/api';

type PurchaseFormProps = {
  cardId: string;
  title?: string;
  onSubmitted?: () => void;
};

export default function PurchaseForm({ cardId, title, onSubmitted }: PurchaseFormProps) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<Date | null>(new Date());
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !amount) return;

    setSubmitting(true);
    setError('');
    addPurchase(cardId, {
      purchaseDate: format(date, 'yyyy-MM-dd'),
      amount: Number(amount),
      description: description || undefined,
    })
      .then(() => {
        setAmount('');
        setDescription('');
        setDate(new Date());
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
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={locale}>
          <DatePicker
            label={t('purchases.add.date')}
            value={date}
            onChange={(nextDate) => setDate(nextDate)}
            slotProps={{ textField: { fullWidth: true } }}
          />
        </LocalizationProvider>
        <TextField
          fullWidth
          label={t('purchases.add.amount')}
          type="number"
          inputProps={{ step: 0.01, min: 0 }}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <TextField
          fullWidth
          label={t('purchases.add.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button type="submit" variant="contained" disabled={submitting} sx={{ alignSelf: 'flex-start' }}>
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
