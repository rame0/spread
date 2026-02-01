import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
} from '@mui/material';
import { getPlan } from '../services/api';
import type { PeriodPlanRow } from '../types/v2';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const monthNames = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export default function Plan() {
  const { cardId } = useParams<{ cardId: string }>();
  if (!cardId) return null;
  const [rows, setRows] = useState<PeriodPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getPlan(cardId)
      .then(setRows)
      .catch(() => setError('Не удалось загрузить план'))
      .finally(() => setLoading(false));
  }, [cardId]);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        План по периодам
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Сколько вносить каждый месяц, чтобы не выйти из грейса и не платить проценты
      </Typography>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Период</TableCell>
              <TableCell>Дедлайн</TableCell>
              <TableCell align="right">Сумма (₽)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>Нет активных пачек</TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={`${r.year}-${r.month}`}>
                  <TableCell>
                    {monthNames[r.month - 1]} {r.year}
                  </TableCell>
                  <TableCell>
                    {format(new Date(r.dueDate), 'd MMMM yyyy', { locale: ru })}
                  </TableCell>
                  <TableCell align="right">{r.amount.toFixed(2)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
