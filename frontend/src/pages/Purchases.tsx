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
import { ru } from 'date-fns/locale';
import { getPurchases, addPurchase } from '../services/api';
import type { Purchase } from '../types/v2';
import { format } from 'date-fns';

export default function Purchases() {
  const { cardId } = useParams<{ cardId: string }>();
  if (!cardId) return null;
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
      .catch(() => setError('Не удалось загрузить покупки'))
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
      .catch(() => setError('Не удалось добавить покупку'))
      .finally(() => setSubmitting(false));
  };

  if (loading) return <CircularProgress />;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Покупки
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Добавить покупку
        </Typography>
        <form onSubmit={handleAdd}>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
            <DatePicker
              label="Дата"
              value={date}
              onChange={(d) => setDate(d)}
              slotProps={{ textField: { fullWidth: true, margin: 'normal' } }}
            />
          </LocalizationProvider>
          <TextField
            fullWidth
            label="Сумма (₽)"
            type="number"
            inputProps={{ step: 0.01, min: 0 }}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            margin="normal"
          />
          <TextField
            fullWidth
            label="Описание"
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
            Добавить
          </Button>
        </form>
      </Paper>

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Дата</TableCell>
              <TableCell>Сумма</TableCell>
              <TableCell>Описание</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>Нет покупок</TableCell>
              </TableRow>
            ) : (
              list.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.purchaseDate}</TableCell>
                  <TableCell>{p.amount.toFixed(2)} ₽</TableCell>
                  <TableCell>{p.description ?? '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
