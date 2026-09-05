import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import { differenceInCalendarDays, format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';
import { formatMoney, formatMoneyValue } from '../formatMoney';
import DepositForm from '../components/DepositForm';
import PurchaseForm from '../components/PurchaseForm';
import ActivityAreaChart from '../components/ActivityAreaChart';
import { getMainActivityChart, getMainDashboard } from '../services/api';
import type { ActivityChartPeriod, ActivityChartResult, Card, MainDashboardResult } from '../types/v2';

type Operation = 'purchase' | 'deposit' | null;

export default function MainDashboard({ cards }: { cards: Card[] }) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const navigate = useNavigate();
  const [data, setData] = useState<MainDashboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<ActivityChartPeriod>('12m');
  const [chart, setChart] = useState<ActivityChartResult | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState('');
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [operation, setOperation] = useState<Operation>(null);
  const [selectedCardId, setSelectedCardId] = useState(cards[0]?.id ?? '');
  const [success, setSuccess] = useState('');
  const chartRequest = useRef(0);

  const loadDashboard = () => {
    setLoading(true);
    setError('');
    getMainDashboard()
      .then(setData)
      .catch(() => setError(t('mainDashboard.loadError')))
      .finally(() => setLoading(false));
  };

  const loadChart = () => {
    const request = ++chartRequest.current;
    setChartLoading(true);
    setChartError('');
    getMainActivityChart(period)
      .then((nextChart) => {
        if (request === chartRequest.current) setChart(nextChart);
      })
      .catch(() => {
        if (request === chartRequest.current) setChartError(t('mainDashboard.chartLoadError'));
      })
      .finally(() => {
        if (request === chartRequest.current) setChartLoading(false);
      });
  };

  useEffect(() => { loadDashboard(); }, [t]);
  useEffect(() => { loadChart(); }, [period, t]);

  useEffect(() => {
    if (!cards.some((card) => card.id === selectedCardId)) setSelectedCardId(cards[0]?.id ?? '');
  }, [cards, selectedCardId]);

  const refresh = () => {
    loadDashboard();
    loadChart();
  };

  const completeOperation = () => {
    const message = operation === 'purchase' ? t('mainDashboard.purchaseAdded') : t('mainDashboard.depositAdded');
    setOperation(null);
    setSuccess(message);
    refresh();
  };

  if (loading) return <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (error) return <Stack spacing={2} alignItems="flex-start"><Alert severity="error">{error}</Alert><Button onClick={loadDashboard}>{t('mainDashboard.retry')}</Button></Stack>;
  if (!data) return null;

  const payments = showAllPayments ? data.payments : data.payments.slice(0, 8);
  const today = new Date();
  const openOperation = (nextOperation: Exclude<Operation, null>) => {
    setSelectedCardId((current) => current || cards[0]?.id || '');
    setOperation(nextOperation);
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'flex-start' }}>
        <Box>
          <Typography variant="h5">{t('mainDashboard.title', { date: format(today, 'P', { locale }) })}</Typography>
          <Typography color="text.secondary">{t('mainDashboard.subtitle')}</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => openOperation('purchase')}>{t('dashboard.quickActions.purchase')}</Button>
          <Button variant="contained" startIcon={<PaymentsRoundedIcon />} onClick={() => openOperation('deposit')}>{t('dashboard.quickActions.deposit')}</Button>
        </Stack>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(12, minmax(0, 1fr))' }, gap: 2 }}>
        <StatCard title={t('mainDashboard.dueThisMonth')} value={formatMoney(data.dueThisMonth)} subtitle={t('mainDashboard.dueThisMonthHint')} accent sx={{ gridColumn: { md: 'span 5' } }} />
        <StatCard title={t('mainDashboard.overdue')} value={formatMoney(data.overdueAmount)} subtitle={data.overdueAmount ? t('mainDashboard.overdueHint') : t('mainDashboard.overdueEmpty')} tone={data.overdueAmount ? 'danger' : 'default'} sx={{ gridColumn: { md: 'span 3' } }} />
        <StatCard title={t('dashboard.totalRemaining')} value={formatMoney(data.totalRemaining)} subtitle={t('dashboard.totalRemainingHint')} sx={{ gridColumn: { md: 'span 2' } }} />
        <StatCard title={t('mainDashboard.plannedThisMonth')} value={formatMoney(data.plannedThisMonth)} subtitle={t('mainDashboard.plannedHint')} sx={{ gridColumn: { md: 'span 2' } }} />

        <SectionCard sx={{ gridColumn: { md: 'span 7' } }}>
          <Stack spacing={2}>
            <Box><Typography variant="h6">{t('mainDashboard.paymentsTitle')}</Typography><Typography color="text.secondary">{t('mainDashboard.paymentsSubtitle')}</Typography></Box>
            {payments.length === 0 ? <Typography color="text.secondary">{t('mainDashboard.paymentsEmpty')}</Typography> : payments.map((payment) => {
              const overdue = payment.status === 'overdue';
              const days = differenceInCalendarDays(new Date(`${payment.dueDate}T12:00:00`), today);
              return <Box key={`${payment.cardId}-${payment.dueDate}`} sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1, alignItems: 'center', py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box><Typography fontWeight={600}>{payment.cardName}</Typography><Typography variant="body2" color={overdue ? 'error.main' : days <= 7 ? 'warning.main' : 'text.secondary'}>{overdue ? t('mainDashboard.overdueDate', { date: format(new Date(`${payment.dueDate}T12:00:00`), 'd MMMM', { locale }) }) : t('mainDashboard.dueDate', { date: format(new Date(`${payment.dueDate}T12:00:00`), 'd MMMM', { locale }) })}</Typography></Box>
                <Typography fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatMoney(payment.amount)}</Typography>
              </Box>;
            })}
            {data.payments.length > 8 && <Button variant="text" onClick={() => setShowAllPayments((current) => !current)}>{showAllPayments ? t('mainDashboard.showLess') : t('mainDashboard.showAll', { count: data.payments.length })}</Button>}
          </Stack>
        </SectionCard>

        <SectionCard sx={{ gridColumn: { md: 'span 5' } }}>
          <Stack spacing={2}>
            <Box><Typography variant="h6">{t('mainDashboard.cardsTitle')}</Typography><Typography color="text.secondary">{t('mainDashboard.cardsSubtitle')}</Typography></Box>
            {data.cards.map((card) => <Button key={card.id} variant="outlined" onClick={() => navigate(`/cards/${card.id}`)} sx={{ textAlign: 'left', display: 'block', p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" spacing={1}><Typography color="text.primary" fontWeight={700}>{card.name}</Typography><Typography color="text.primary" fontWeight={700}>{formatMoney(card.totalRemaining)}</Typography></Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>{card.overdueAmount > 0 && <Chip size="small" color="error" label={t('mainDashboard.cardOverdue', { amount: formatMoneyValue(card.overdueAmount) })} />}{card.nextDueDate && <Chip size="small" label={t('mainDashboard.cardDue', { date: format(new Date(`${card.nextDueDate}T12:00:00`), 'd MMM', { locale }), amount: formatMoneyValue(card.nextDueAmount) })} />}</Stack>
            </Button>)}
          </Stack>
        </SectionCard>

        <Box sx={{ gridColumn: '1 / -1' }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ sm: 'center' }}><Typography variant="h6">{t('mainDashboard.activityTitle')}</Typography><ToggleButtonGroup value={period} exclusive size="small" onChange={(_event, value: ActivityChartPeriod | null) => value && setPeriod(value)}>{(['6m', '12m', 'all'] as ActivityChartPeriod[]).map((value) => <ToggleButton key={value} value={value}>{t(`dashboard.activity.period.${value}`)}</ToggleButton>)}</ToggleButtonGroup></Stack></Box>
        <ChartCard title={t('dashboard.activity.purchases', { granularity: t(`dashboard.activity.granularity.${chart?.granularity ?? 'week'}`) })} data={chart?.purchases ?? []} color="var(--accent)" granularity={chart?.granularity ?? 'week'} loading={chartLoading} error={chartError} onRetry={loadChart} sx={{ gridColumn: { md: 'span 6' } }} />
        <ChartCard title={t('dashboard.activity.deposits', { granularity: t(`dashboard.activity.granularity.${chart?.granularity ?? 'week'}`) })} data={chart?.deposits ?? []} color="var(--status-ok)" granularity={chart?.granularity ?? 'week'} loading={chartLoading} error={chartError} onRetry={loadChart} sx={{ gridColumn: { md: 'span 6' } }} />
      </Box>

      <Dialog open={operation !== null} onClose={() => setOperation(null)} fullWidth maxWidth="sm">
        <DialogTitle>{operation === 'purchase' ? t('dashboard.quickActions.purchase') : t('dashboard.quickActions.deposit')}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl fullWidth><InputLabel id="operation-card-label">{t('mainDashboard.operationCard')}</InputLabel><Select labelId="operation-card-label" label={t('mainDashboard.operationCard')} value={selectedCardId} onChange={(event) => setSelectedCardId(event.target.value)}>{cards.map((card) => <MenuItem key={card.id} value={card.id}>{card.name}</MenuItem>)}</Select></FormControl>
          {operation === 'purchase' && selectedCardId && <PurchaseForm key={`purchase-${selectedCardId}`} cardId={selectedCardId} onSubmitted={completeOperation} />}
          {operation === 'deposit' && selectedCardId && <DepositForm key={`deposit-${selectedCardId}`} cardId={selectedCardId} onSubmitted={completeOperation} />}
        </Stack></DialogContent>
      </Dialog>
      <Snackbar open={Boolean(success)} autoHideDuration={3000} onClose={() => setSuccess('')}><Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert></Snackbar>
    </Stack>
  );
}

function StatCard({ title, value, subtitle, accent, tone = 'default', sx }: { title: string; value: string; subtitle: string; accent?: boolean; tone?: 'default' | 'danger'; sx?: object }) {
  return <Paper sx={{ p: 2.5, minHeight: 172, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', bgcolor: accent ? 'color-mix(in srgb, var(--accent) 8%, var(--surface))' : 'background.paper', borderColor: tone === 'danger' ? 'var(--status-danger)' : 'divider', ...sx }}><Typography color="text.secondary">{title}</Typography><Typography sx={{ fontSize: { xs: '1.75rem', md: '2rem' }, fontWeight: 700, color: tone === 'danger' ? 'error.main' : 'text.primary', fontVariantNumeric: 'tabular-nums' }}>{value}</Typography><Typography color="text.secondary">{subtitle}</Typography></Paper>;
}

function SectionCard({ children, sx }: { children: React.ReactNode; sx?: object }) { return <Paper sx={{ p: 2.5, ...sx }}>{children}</Paper>; }

function ChartCard({ title, data, color, granularity, loading, error, onRetry, sx }: { title: string; data: ActivityChartResult['purchases']; color: string; granularity: ActivityChartResult['granularity']; loading: boolean; error: string; onRetry: () => void; sx?: object }) {
  const { t } = useTranslation();
  return <Paper sx={{ p: 2.5, minWidth: 0, ...sx }}><Typography variant="h6">{title}</Typography>{loading ? <Box sx={{ minHeight: 260, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : error ? <Stack sx={{ minHeight: 260 }} justifyContent="center" alignItems="center" spacing={2}><Typography color="error.main">{error}</Typography><Button onClick={onRetry}>{t('mainDashboard.retry')}</Button></Stack> : data.length === 0 || data.every((point) => point.amount === 0) ? <Box sx={{ minHeight: 260, display: 'grid', placeItems: 'center' }}><Typography color="text.secondary">{t('dashboard.activity.empty')}</Typography></Box> : <Box sx={{ mx: -2.5 }}><ActivityAreaChart data={data} color={color} granularity={granularity} /></Box>}</Paper>;
}
