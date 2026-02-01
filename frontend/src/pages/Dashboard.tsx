import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  LinearProgress,
  Alert,
  CircularProgress,
} from '@mui/material';
import { getDashboard } from '../services/api';
import type { DashboardResult } from '../types/v2';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function Dashboard() {
  const { cardId } = useParams<{ cardId: string }>();
  if (!cardId) return null;
  const [data, setData] = useState<DashboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getDashboard(cardId)
      .then(setData)
      .catch(() => setError('Не удалось загрузить дашборд'))
      .finally(() => setLoading(false));
  }, [cardId]);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  const asOf = new Date().toISOString().slice(0, 10);
  const nextDue = data.nextDueDate
    ? format(new Date(data.nextDueDate), 'd MMMM yyyy', { locale: ru })
    : null;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Дашборд (на {format(new Date(asOf), 'd.MM.yyyy')})
      </Typography>

      <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
        <Typography variant="subtitle2">Сколько вносить в этом месяце</Typography>
        <Typography variant="h4" component="p">
          {data.currentMonthAmount > 0
            ? `${data.currentMonthAmount.toFixed(2)} ₽`
            : '0 ₽'}
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
          Чтобы не выйти из грейса и не платить проценты
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography color="text.secondary">До какого числа внести</Typography>
        <Typography variant="h6">
          {nextDue ?? 'Нет активных задолженностей'}
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography color="text.secondary">Всего остаток</Typography>
        <Typography variant="h6">{data.totalRemaining.toFixed(2)} ₽</Typography>
      </Paper>

      {data.buckets.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Пачки (детализация)
          </Typography>
          {data.buckets.map((b) => (
            <Box key={b.id} sx={{ mb: 1 }}>
              <Typography variant="body2">
                Период {b.statementPeriodStart.year}-{b.statementPeriodStart.month} → до {format(new Date(b.dueDate), 'd.MM.yyyy')} • {b.principalRemaining.toFixed(2)} ₽ • {b.status}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={
                  b.principalRemaining > 0
                    ? Math.min(100, (b.principalRemaining / 100) * 10)
                    : 0
                }
                sx={{ mt: 0.5 }}
              />
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
}
