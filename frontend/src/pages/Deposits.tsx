import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { getDeposits, addDeposit } from '../services/api';
import type { Deposit } from '../types/v2';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';

export default function Deposits() {
  const { cardId } = useParams<{ cardId: string }>();
  if (!cardId) return null;
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [list, setList] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<Date | null>(new Date());
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    getDeposits(cardId)
      .then(setList)
      .catch(() => setError(t('deposits.loadError')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [cardId]);

  const handleAdd = async (e: React.FormEvent) => {
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
        load();
      })
      .catch(() => setError(t('deposits.add.error')))
      .finally(() => setSubmitting(false));
  };

  if (loading) return <CircularProgress />;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('deposits.title')}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          {t('deposits.add.title')}
        </Typography>
        <form onSubmit={handleAdd}>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={locale}>
            <DatePicker
              label={t('deposits.add.date')}
              value={date}
              onChange={(d) => setDate(d)}
              slotProps={{ textField: { fullWidth: true, margin: 'normal' } }}
            />
          </LocalizationProvider>
          <TextField
            fullWidth
            label={t('deposits.add.amount')}
            type="number"
            inputProps={{ step: 0.01, min: 0 }}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            margin="normal"
          />
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            sx={{ mt: 1 }}
          >
            {t('deposits.add.submit')}
          </Button>
        </form>
      </Paper>

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('deposits.table.date')}</TableCell>
              <TableCell>{t('deposits.table.amount')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2}>{t('deposits.empty')}</TableCell>
              </TableRow>
            ) : (
              list.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    {format(new Date(d.depositDate), 'P', { locale })}
                  </TableCell>
                  <TableCell>{d.amount.toFixed(2)} ₽</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
