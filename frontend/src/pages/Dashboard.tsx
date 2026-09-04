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
import { differenceInCalendarDays, format } from 'date-fns';
import DepositForm from '../components/DepositForm';
import PurchaseForm from '../components/PurchaseForm';
import ReconciliationForm from '../components/ReconciliationForm';
import { getDashboard, getPlan, getReconciliations } from '../services/api';
import type { BalanceReconciliation, DashboardResult, PeriodPlanRow } from '../types/v2';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';
import { formatMoney, formatMoneyValue } from '../formatMoney';

type DueTone = 'default' | 'warning' | 'danger';

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
  const dueTone = getDueTone(data.nextDueDate, asOf);
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
              ? formatMoney(data.currentMonthAmount)
              : t('dashboard.currentMonth.zero')
          }
          subtitle={t('dashboard.currentMonth.hint')}
          supporting={t('dashboard.recommendedDeposit', {
            amount: formatMoneyValue(data.recommendedDeposit),
          })}
          accent
          sx={{ gridColumn: { lg: 'span 6' } }}
        />
        <StatCard
          title={t('dashboard.nextDue.label')}
          value={nextDue ?? t('dashboard.nextDue.none')}
          subtitle={
            dueTone === 'danger'
              ? t('dashboard.nextDue.overdue')
              : dueTone === 'warning'
                ? t('dashboard.nextDue.soon')
                : t('dashboard.nextDue.supporting')
          }
          tone={dueTone}
          sx={{ gridColumn: { lg: 'span 3' } }}
        />
        <StatCard
          title={t('dashboard.totalRemaining')}
          value={formatMoney(data.totalRemaining)}
          subtitle={t('dashboard.totalRemainingHint')}
          sx={{ gridColumn: { lg: 'span 3' } }}
        />

        <SectionCard sx={{ gridColumn: { lg: 'span 6' } }}>
          <PurchaseForm cardId={cardId} title={t('dashboard.quickActions.purchase')} onSubmitted={load} buttonVariant="outlined" compact />
        </SectionCard>
        <SectionCard sx={{ gridColumn: { lg: 'span 6' } }}>
          <DepositForm cardId={cardId} title={t('dashboard.quickActions.deposit')} onSubmitted={load} buttonVariant="outlined" compact />
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
                <Box><Typography>{format(new Date(item.reconciliationDate), 'd MMMM yyyy', { locale })}</Typography><Typography variant="caption" color="text.secondary">{t('reconciliation.before', { amount: formatMoneyValue(item.calculatedDebtBefore) })}</Typography></Box>
                <Box sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><Typography sx={{ fontWeight: 700 }}>{formatMoney(item.actualDebt)}</Typography><Typography variant="caption" color={item.difference === 0 ? 'text.secondary' : item.difference > 0 ? 'error.main' : 'success.main'}>{item.difference > 0 ? '+' : ''}{formatMoney(item.difference)}</Typography></Box>
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
                    amount: formatMoneyValue(planPreview[0].amount),
                    date: format(new Date(planPreview[0].dueDate), 'd MMM', { locale }),
                  })}
                  color="primary"
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
                      borderColor: index === 0 ? 'var(--accent)' : 'divider',
                      bgcolor: index === 0
                        ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))'
                        : 'var(--surface)',
                    }}
                  >
                    <Typography variant="subtitle1">
                      {format(new Date(row.year, row.month - 1, 1), 'LLLL yyyy', { locale })}
                    </Typography>
                    <Typography color="text.secondary">
                      {format(new Date(row.dueDate), 'd MMMM yyyy', { locale })}
                    </Typography>
                    <Typography sx={{ textAlign: { sm: 'right' }, fontWeight: 700 }}>
                      {formatMoney(row.amount)}
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
                      bgcolor: 'var(--surface)',
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
                      <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(bucket.principalRemaining)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('dashboard.buckets.remainingLabel')}
                      </Typography>
                    </Box>
                    <Chip
                      label={t(`dashboard.status.${bucket.status}`, { defaultValue: bucket.status })}
                      color={bucket.status === 'overdue' ? 'error' : bucket.status === 'closed' ? 'success' : 'primary'}
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
  tone = 'default',
  sx,
}: {
  title: string;
  value: string;
  subtitle: string;
  supporting?: string;
  accent?: boolean;
  tone?: DueTone;
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
        bgcolor: accent
          ? 'color-mix(in srgb, var(--accent) 8%, var(--surface))'
          : 'background.paper',
        borderColor:
          tone === 'danger'
            ? 'var(--status-danger)'
            : tone === 'warning'
              ? 'var(--status-warning)'
              : 'divider',
        ...sx,
      }}
    >
      <Stack spacing={1.5}>
        <Typography color="text.secondary">{title}</Typography>
        <Typography
          sx={{
            fontSize: accent ? { xs: '2rem', md: '2.5rem' } : { xs: '1.5rem', md: '1.75rem' },
            fontWeight: 700,
            lineHeight: 1.1,
            color: tone === 'danger' ? 'error.main' : tone === 'warning' ? 'warning.main' : 'text.primary',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </Typography>
      </Stack>
      <Stack spacing={1}>
        <Typography color="text.secondary">{subtitle}</Typography>
        {supporting && (
          <Chip
            label={supporting}
            color={accent ? 'primary' : 'default'}
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
        minHeight: 168,
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
          minHeight: 64,
          borderRadius: 4,
          border: '1px dashed',
          borderColor: 'divider',
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'var(--surface-input)',
        }}
      >
        <Typography color="text.secondary">{t('dashboard.monthly.placeholder')}</Typography>
      </Box>
    </Paper>
  );
}

function getDueTone(dueDate: string | null, today: Date): DueTone {
  if (!dueDate) return 'default';
  const due = new Date(dueDate);
  const remainingDays = differenceInCalendarDays(due, today);
  if (remainingDays < 0) return 'danger';
  if (remainingDays <= 7) return 'warning';
  return 'default';
}
