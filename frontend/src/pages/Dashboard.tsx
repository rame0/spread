import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { format } from 'date-fns';
import DepositForm from '../components/DepositForm';
import PurchaseForm from '../components/PurchaseForm';
import ReconciliationForm from '../components/ReconciliationForm';
import { getDashboard, getPlan, getReconciliations } from '../services/api';
import type { BalanceReconciliation, DashboardResult, PeriodPlanRow } from '../types/v2';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';

export default function Dashboard() {
  const { cardId } = useParams<{ cardId: string }>();
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [data, setData] = useState<DashboardResult | null>(null);
  const [planRows, setPlanRows] = useState<PeriodPlanRow[]>([]);
  const [reconciliations, setReconciliations] = useState<BalanceReconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    if (!cardId) return;

    setLoading(true);
    setError('');

    Promise.all([getDashboard(cardId), getPlan(cardId), getReconciliations(cardId)])
      .then(([dashboard, plan, reconciliationHistory]) => {
        setData(dashboard);
        setPlanRows(plan);
        setReconciliations(reconciliationHistory);
      })
      .catch(() => setError(t('dashboard.loadError')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!cardId) return;
    load();
  }, [cardId, t]);

  if (!cardId) return null;

  const asOf = new Date();

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  const nextDue = data.nextDueDate
    ? format(new Date(data.nextDueDate), 'd MMMM yyyy', { locale })
    : null;
  const bucketPreview = data.buckets.slice(0, 15);
  const planPreview = planRows.slice(0, 6);

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h5">
          {t('dashboard.title', { date: format(asOf, 'P', { locale }) })}
        </Typography>
        <Typography color="text.secondary">{t('dashboard.overviewSubtitle')}</Typography>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(12, minmax(0, 1fr))' },
          gap: 3,
        }}
      >
        <StatCard
          title={t('dashboard.currentMonth.title')}
          value={
            data.currentMonthAmount > 0
              ? `${data.currentMonthAmount.toFixed(2)} ₽`
              : t('dashboard.currentMonth.zero')
          }
          subtitle={t('dashboard.currentMonth.hint')}
          supporting={t('dashboard.recommendedDeposit', {
            amount: data.recommendedDeposit.toFixed(2),
          })}
          accent
          sx={{ gridColumn: { lg: 'span 4' } }}
        />
        <StatCard
          title={t('dashboard.nextDue.label')}
          value={nextDue ?? t('dashboard.nextDue.none')}
          subtitle={t('dashboard.nextDue.supporting')}
          sx={{ gridColumn: { lg: 'span 4' } }}
        />
        <StatCard
          title={t('dashboard.totalRemaining')}
          value={`${data.totalRemaining.toFixed(2)} ₽`}
          subtitle={t('dashboard.totalRemainingHint')}
          sx={{ gridColumn: { lg: 'span 4' } }}
        />

        <SectionCard sx={{ gridColumn: { lg: 'span 6' } }}>
          <PurchaseForm cardId={cardId} title={t('dashboard.quickActions.purchase')} onSubmitted={load} />
        </SectionCard>
        <SectionCard sx={{ gridColumn: { lg: 'span 6' } }}>
          <DepositForm cardId={cardId} title={t('dashboard.quickActions.deposit')} onSubmitted={load} />
        </SectionCard>
        <SectionCard sx={{ gridColumn: { lg: 'span 6' } }}>
          <ReconciliationForm cardId={cardId} calculatedDebt={data.totalRemaining} onSubmitted={load} />
        </SectionCard>

        <PlaceholderCard
          title={t('dashboard.monthly.purchases.title')}
          subtitle={t('dashboard.monthly.purchases.subtitle')}
          sx={{ gridColumn: { lg: 'span 6' } }}
        />

        <SectionCard sx={{ gridColumn: { lg: 'span 6' } }}>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="h6">{t('reconciliation.historyTitle')}</Typography>
              <Typography color="text.secondary">{t('reconciliation.historySubtitle')}</Typography>
            </Box>
            {reconciliations.length === 0 ? <Typography color="text.secondary">{t('reconciliation.empty')}</Typography> : reconciliations.map((item) => (
              <Box key={item.id} sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box><Typography>{format(new Date(item.reconciliationDate), 'd MMMM yyyy', { locale })}</Typography><Typography variant="caption" color="text.secondary">{t('reconciliation.before', { amount: item.calculatedDebtBefore.toFixed(2) })}</Typography></Box>
                <Box sx={{ textAlign: 'right' }}><Typography sx={{ fontWeight: 700 }}>{item.actualDebt.toFixed(2)} ₽</Typography><Typography variant="caption" color={item.difference === 0 ? 'text.secondary' : item.difference > 0 ? 'error.main' : 'success.main'}>{item.difference > 0 ? '+' : ''}{item.difference.toFixed(2)} ₽</Typography></Box>
              </Box>
            ))}
          </Stack>
        </SectionCard>
        <PlaceholderCard
          title={t('dashboard.monthly.deposits.title')}
          subtitle={t('dashboard.monthly.deposits.subtitle')}
          sx={{ gridColumn: { lg: 'span 6' } }}
        />

        <SectionCard sx={{ gridColumn: '1 / -1' }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
              <Box>
                <Typography variant="h6">{t('plan.title')}</Typography>
                <Typography color="text.secondary">{t('dashboard.planSubtitle')}</Typography>
              </Box>
              {planPreview.length > 0 && (
                <Chip
                  label={t('dashboard.planSummary', {
                    amount: planPreview[0].amount.toFixed(2),
                    date: format(new Date(planPreview[0].dueDate), 'd MMM', { locale }),
                  })}
                  color="secondary"
                  sx={{ alignSelf: 'flex-start' }}
                />
              )}
            </Stack>

            {planPreview.length === 0 ? (
              <Typography color="text.secondary">{t('plan.empty')}</Typography>
            ) : (
              <Stack spacing={1.25}>
                {planPreview.map((row, index) => (
                  <Box
                    key={`${row.year}-${row.month}`}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1.3fr 1fr auto' },
                      gap: 1,
                      alignItems: 'center',
                      px: 2,
                      py: 1.75,
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: index === 0 ? 'rgba(139,92,246,0.45)' : 'divider',
                      bgcolor: index === 0 ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <Typography variant="subtitle1">
                      {format(new Date(row.year, row.month - 1, 1), 'LLLL yyyy', { locale })}
                    </Typography>
                    <Typography color="text.secondary">
                      {format(new Date(row.dueDate), 'd MMMM yyyy', { locale })}
                    </Typography>
                    <Typography sx={{ textAlign: { sm: 'right' }, fontWeight: 700 }}>
                      {row.amount.toFixed(2)} ₽
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </SectionCard>

        <SectionCard sx={{ gridColumn: '1 / -1' }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">{t('dashboard.buckets.title')}</Typography>
              <Typography color="text.secondary">{t('dashboard.buckets.subtitle')}</Typography>
            </Box>

            {bucketPreview.length === 0 ? (
              <Typography color="text.secondary">{t('dashboard.buckets.empty')}</Typography>
            ) : (
              <Stack spacing={1.25}>
                {bucketPreview.map((bucket) => (
                  <Box
                    key={bucket.id}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr 1fr auto' },
                      gap: 1.5,
                      alignItems: 'center',
                      px: 2,
                      py: 1.75,
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle1">
                        {format(
                          new Date(
                            bucket.statementPeriodStart.year,
                            bucket.statementPeriodStart.month - 1,
                            1
                          ),
                          'LLLL yyyy',
                          { locale }
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('dashboard.buckets.periodLabel')}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography>{format(new Date(bucket.dueDate), 'd MMMM yyyy', { locale })}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('dashboard.buckets.dueDateLabel')}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>{bucket.principalRemaining.toFixed(2)} ₽</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('dashboard.buckets.remainingLabel')}
                      </Typography>
                    </Box>
                    <Chip
                      label={t(`dashboard.status.${bucket.status}`, { defaultValue: bucket.status })}
                      color={bucket.status === 'overdue' ? 'error' : bucket.status === 'closed' ? 'success' : 'secondary'}
                      variant={bucket.status === 'active' ? 'filled' : 'outlined'}
                    />
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </SectionCard>
      </Box>
    </Stack>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  supporting,
  accent = false,
  sx,
}: {
  title: string;
  value: string;
  subtitle: string;
  supporting?: string;
  accent?: boolean;
  sx?: object;
}) {
  return (
    <Paper
      sx={{
        p: 3,
        minHeight: 220,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        bgcolor: accent ? '#342D4D' : 'background.paper',
        ...sx,
      }}
    >
      <Stack spacing={1.5}>
        <Typography color="text.secondary">{title}</Typography>
        <Typography sx={{ fontSize: { xs: '1.9rem', md: '2.2rem' }, fontWeight: 700, lineHeight: 1.1 }}>
          {value}
        </Typography>
      </Stack>
      <Stack spacing={1}>
        <Typography color="text.secondary">{subtitle}</Typography>
        {supporting && (
          <Chip
            label={supporting}
            color={accent ? 'secondary' : 'default'}
            sx={{ alignSelf: 'flex-start' }}
          />
        )}
      </Stack>
    </Paper>
  );
}

function SectionCard({ children, sx }: { children: React.ReactNode; sx?: object }) {
  return <Paper sx={{ p: 3, ...sx }}>{children}</Paper>;
}

function PlaceholderCard({ title, subtitle, sx }: { title: string; subtitle: string; sx?: object }) {
  const { t } = useTranslation();

  return (
    <Paper
      sx={{
        p: 3,
        minHeight: 240,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        ...sx,
      }}
    >
      <Stack spacing={1.5}>
        <Typography variant="h6">{title}</Typography>
        <Typography color="text.secondary">{subtitle}</Typography>
      </Stack>
      <Box
        sx={{
          minHeight: 116,
          borderRadius: 4,
          border: '1px dashed',
          borderColor: 'divider',
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'rgba(255,255,255,0.02)',
        }}
      >
        <Typography color="text.secondary">{t('dashboard.monthly.placeholder')}</Typography>
      </Box>
    </Paper>
  );
}
