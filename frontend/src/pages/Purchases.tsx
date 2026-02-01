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
import { getPurchases, addPurchase } from '../services/api';
import type { Purchase } from '../types/v2';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';

export default function Purchases() {
  const { cardId } = useParams<{ cardId: string }>();
  if (!cardId) return null;
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [list, setList] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<Date | null>(new Date());
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    getPurchases(cardId)
      .then(setList)
      .catch(() => setError(t('purchases.loadError')))
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
    addPurchase(cardId, {
      purchaseDate: format(date, 'yyyy-MM-dd'),
      amount: Number(amount),
      description: description || undefined,
    })
      .then(() => {
        setAmount('');
        setDescription('');
        setDate(new Date());
        load();
      })
      .catch(() => setError(t('purchases.add.error')))
      .finally(() => setSubmitting(false));
  };

  if (loading) return <CircularProgress />;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('purchases.title')}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          {t('purchases.add.title')}
        </Typography>
        <form onSubmit={handleAdd}>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={locale}>
            <DatePicker
              label={t('purchases.add.date')}
              value={date}
              onChange={(d) => setDate(d)}
              slotProps={{ textField: { fullWidth: true, margin: 'normal' } }}
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
            margin="normal"
          />
          <TextField
            fullWidth
            label={t('purchases.add.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            margin="normal"
          />
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            sx={{ mt: 1 }}
          >
            {t('purchases.add.submit')}
          </Button>
        </form>
      </Paper>

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('purchases.table.date')}</TableCell>
              <TableCell>{t('purchases.table.amount')}</TableCell>
              <TableCell>{t('purchases.table.description')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>{t('purchases.empty')}</TableCell>
              </TableRow>
            ) : (
              list.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {format(new Date(p.purchaseDate), 'P', { locale })}
                  </TableCell>
                  <TableCell>{p.amount.toFixed(2)} ₽</TableCell>
                  <TableCell>{p.description ?? t('purchases.emptyDescription')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
