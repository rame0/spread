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
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';

export default function Dashboard() {
  const { cardId } = useParams<{ cardId: string }>();
  if (!cardId) return null;
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [data, setData] = useState<DashboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getDashboard(cardId)
      .then(setData)
      .catch(() => setError(t('dashboard.loadError')))
      .finally(() => setLoading(false));
  }, [cardId, t]);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  const asOf = new Date().toISOString().slice(0, 10);
  const nextDue = data.nextDueDate
    ? format(new Date(data.nextDueDate), 'd MMMM yyyy', { locale })
    : null;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('dashboard.title', {
          date: format(new Date(asOf), 'P', { locale }),
        })}
      </Typography>

      <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
        <Typography variant="subtitle2">
          {t('dashboard.currentMonth.title')}
        </Typography>
        <Typography variant="h4" component="p">
          {data.currentMonthAmount > 0
            ? `${data.currentMonthAmount.toFixed(2)} ₽`
            : t('dashboard.currentMonth.zero')}
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
          {t('dashboard.currentMonth.hint')}
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography color="text.secondary">{t('dashboard.nextDue.label')}</Typography>
        <Typography variant="h6">
          {nextDue ?? t('dashboard.nextDue.none')}
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography color="text.secondary">{t('dashboard.totalRemaining')}</Typography>
        <Typography variant="h6">{data.totalRemaining.toFixed(2)} ₽</Typography>
      </Paper>

      {data.buckets.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {t('dashboard.buckets.title')}
          </Typography>
          {data.buckets.map((b) => (
            <Box key={b.id} sx={{ mb: 1 }}>
              <Typography variant="body2">
                {t('dashboard.buckets.line', {
                  period: `${b.statementPeriodStart.year}-${b.statementPeriodStart.month}`,
                  date: format(new Date(b.dueDate), 'P', { locale }),
                  amount: b.principalRemaining.toFixed(2),
                  status: t(`dashboard.status.${b.status}`, {
                    defaultValue: b.status,
                  }),
                })}
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
