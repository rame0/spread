import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Paper,
  Snackbar,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import CurrencyExchangeRoundedIcon from '@mui/icons-material/CurrencyExchangeRounded';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import { differenceInCalendarDays, format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';
import { formatMoney, formatMoneyCompact, formatMoneyWhole } from '../formatMoney';
import Sparkline from '../components/Sparkline';
import { DateBadge, Row, RowIcon, Rows } from '../components/Row';
import { getAccounts, getForecast, getMainDashboard, getNetWorth, getPlanItems } from '../services/api';
import type { Account, Card, ForecastResult, MainDashboardResult, NetWorthResult, PlanItem } from '../types/v2';

const PAYMENTS_SHOWN = 4;
const FORECAST_MONTHS = 3;
const CAPITAL_DELTA_MONTHS = 3;
/** Deposits ending within this many days are worth a reminder. */
const MATURITY_NOTICE_DAYS = 45;

const asLocalDate = (value: string) => new Date(`${value}T12:00:00`);
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

type Attention = { key: string; icon: React.ReactElement; color: string; title: string; meta?: string; path: string };

export default function Overview({ onQuickAdd }: { cards: Card[]; onQuickAdd: () => void }) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const navigate = useNavigate();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [dashboard, setDashboard] = useState<MainDashboardResult | null>(null);
  const [netWorth, setNetWorth] = useState<NetWorthResult | null>(null);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = () => {
    setError('');
    // The dashboard is required; the rest only adds blocks and may fail on its own.
    Promise.all([
      getMainDashboard(),
      getNetWorth(12).catch(() => null),
      getForecast(FORECAST_MONTHS).catch(() => null),
      getPlanItems().catch(() => []),
      getAccounts().catch(() => []),
    ])
      .then(([nextDashboard, nextNetWorth, nextForecast, nextItems, nextAccounts]) => {
        setDashboard(nextDashboard);
        setNetWorth(nextNetWorth);
        setForecast(nextForecast);
        setPlanItems(nextItems);
        setAccounts(nextAccounts);
      })
      .catch(() => setError(t('mainDashboard.loadError')))
      .finally(() => setLoading(false));
  };

  useEffect(load, [t]);

  if (loading) return <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (error || !dashboard) {
    return (
      <Stack spacing={2} alignItems="flex-start">
        <Alert severity="error">{error}</Alert>
        <Button onClick={load}>{t('mainDashboard.retry')}</Button>
      </Stack>
    );
  }

  const today = new Date();
  const shortDate = (value: string) => format(asLocalDate(value), 'd MMMM', { locale });
  const attention = buildAttention(dashboard);

  function buildAttention(debts: MainDashboardResult): Attention[] {
    const items: Attention[] = [];
    if (debts.overdueAmount > 0) {
      items.push({ key: 'overdue', icon: <ErrorOutlineRoundedIcon />, color: 'error.main', title: t('overview.attention.overdue', { amount: formatMoney(debts.overdueAmount) }), path: '/debts' });
    }
    if (netWorth) {
      const stale = netWorth.assets.lines.filter((line) => line.kind !== 'property' && !line.computed && (line.stale || line.balanceDate === null));
      if (stale.length > 0) {
        items.push({ key: 'stale', icon: <RefreshRoundedIcon />, color: 'warning.main', title: t('overview.attention.stale', { count: stale.length }), meta: stale.map((line) => line.name).join(', '), path: '/accounts' });
      }
      if (netWorth.assets.missingRates.length > 0) {
        items.push({ key: 'rates', icon: <CurrencyExchangeRoundedIcon />, color: 'warning.main', title: t('overview.attention.missingRates'), meta: netWorth.assets.missingRates.join(', '), path: '/accounts' });
      }
      if (netWorth.debts.mortgages > 0 && !netWorth.assets.lines.some((line) => line.kind === 'property')) {
        items.push({ key: 'property', icon: <HomeOutlinedIcon />, color: 'text.secondary', title: t('overview.attention.noProperty'), meta: t('overview.attention.noPropertyHint'), path: '/accounts?new=property' });
      }
    }
    for (const account of accounts) {
      if (!account.maturityDate) continue;
      const days = differenceInCalendarDays(asLocalDate(account.maturityDate), today);
      if (days >= 0 && days <= MATURITY_NOTICE_DAYS) {
        items.push({ key: `maturity-${account.id}`, icon: <SavingsOutlinedIcon />, color: 'primary.main', title: t('overview.attention.maturity', { date: shortDate(account.maturityDate) }), meta: account.name, path: `/accounts/${account.id}` });
      }
    }
    return items;
  }

  const freeMoney = <FreeMoneyCard netWorth={netWorth} forecast={forecast} shortDate={shortDate} hero={isDesktop} />;
  const payments = <PaymentsCard dashboard={dashboard} today={today} shortDate={shortDate} />;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="flex-end">
        <Box>
          <Typography color="text.secondary" sx={{ fontSize: 13 }}>
            {capitalize(format(today, 'EEEE, d MMMM', { locale }))}
          </Typography>
          <Typography variant="h4">{t('nav.overview')}</Typography>
        </Box>
        {isDesktop && (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => navigate('/accounts')}>
              {t('overview.updateBalances')}
            </Button>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={onQuickAdd}>
              {t('quickAdd.operation')}
            </Button>
          </Stack>
        )}
      </Stack>

      {isDesktop ? (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: 2 }}>
            {freeMoney}
            {payments}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${attention.length > 0 ? 3 : 2}, minmax(0, 1fr))`, gap: 2, alignItems: 'start' }}>
            <CapitalCard netWorth={netWorth} />
            <MonthPlanCard items={planItems} forecast={forecast} />
            {attention.length > 0 && (
              <Paper sx={{ p: 2.5 }}>
                <CardHeader title={t('overview.attention.title')} />
                <Rows>
                  {attention.map((item) => (
                    <Row key={item.key} leading={<RowIcon color={item.color}>{item.icon}</RowIcon>} title={item.title} meta={item.meta} onClick={() => navigate(item.path)} />
                  ))}
                </Rows>
              </Paper>
            )}
          </Box>
        </>
      ) : (
        <>
          {freeMoney}
          {payments}
          <Paper sx={{ px: 2, py: 0.5 }}>
            <Rows>
              {netWorth && netWorth.assets.lines.length > 0 && (
                <Row
                  leading={<RowIcon><ShowChartRoundedIcon /></RowIcon>}
                  title={t('overview.capital.title')}
                  meta={<CapitalDelta netWorth={netWorth} />}
                  trailing={formatMoneyCompact(netWorth.netWorth, i18n.language)}
                  onClick={() => navigate('/capital')}
                />
              )}
              <Row
                leading={<RowIcon><TimelineOutlinedIcon /></RowIcon>}
                title={capitalize(t('overview.plan.title', { month: format(today, 'LLLL', { locale }) }))}
                meta={planItems.length > 0 ? t('overview.plan.leftHint') : t('overview.plan.empty')}
                trailing={planItems.length > 0 ? formatMoneyWhole(monthlyPlan(planItems).left) : undefined}
                onClick={() => navigate('/plan')}
              />
              {attention.map((item) => (
                <Row key={item.key} leading={<RowIcon color={item.color}>{item.icon}</RowIcon>} title={item.title} meta={item.meta} onClick={() => navigate(item.path)} />
              ))}
            </Rows>
          </Paper>
        </>
      )}

      <Snackbar open={Boolean(success)} autoHideDuration={3000} onClose={() => setSuccess('')}>
        <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>
      </Snackbar>
    </Stack>
  );
}

function CardHeader({ title, action }: { title: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
      <Typography variant="subtitle1">{title}</Typography>
      {action}
    </Stack>
  );
}

/** Big amount with the ruble sign dimmed. */
function BigMoney({ value, size }: { value: number; size: number }) {
  const [amount] = formatMoneyWhole(value).split(/\s₽/);
  return (
    <Typography sx={{ fontSize: size, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.15, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      {amount}{' '}
      <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>₽</Box>
    </Typography>
  );
}

function FreeMoneyCard({ netWorth, forecast, shortDate, hero }: { netWorth: NetWorthResult | null; forecast: ForecastResult | null; shortDate: (date: string) => string; hero: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const liquid = forecast?.start.liquid ?? netWorth?.assets.liquidTotal ?? 0;
  const gap = forecast !== null && forecast.minLiquid.amount < 0;

  return (
    <Paper sx={{ p: 2.5, display: 'flex', flexDirection: 'column' }}>
      <Typography color="text.secondary">{t('overview.free.title')}</Typography>
      <BigMoney value={liquid} size={hero ? 40 : 34} />
      {forecast && (
        <Typography sx={{ mt: 0.75, color: gap ? 'error.main' : 'text.secondary' }}>
          {gap ? (
            <>
              {t('overview.free.gap', { amount: formatMoneyWhole(forecast.minLiquid.amount), date: shortDate(forecast.minLiquid.date) })}{' '}
              <Link component="button" onClick={() => navigate('/plan')} sx={{ verticalAlign: 'baseline' }}>{t('mainDashboard.cashGapOpen')}</Link>
            </>
          ) : (
            <>
              <Box component="span" sx={{ color: 'success.main' }}>{t('overview.free.enough', { months: FORECAST_MONTHS })}</Box>
              {' · '}
              {t('overview.free.minimum', { amount: formatMoneyWhole(forecast.minLiquid.amount), date: shortDate(forecast.minLiquid.date) })}
            </>
          )}
        </Typography>
      )}
      {forecast && forecast.daily.length > 1 && (
        <Box sx={{ mt: 1.5, ...(hero ? { flex: 1, minHeight: 96 } : { height: 56 }) }}>
          <Sparkline values={forecast.daily.map((day) => day.liquid)} color={gap ? 'var(--status-danger)' : 'var(--accent)'} height="100%" />
        </Box>
      )}
    </Paper>
  );
}

function PaymentsCard({ dashboard, today, shortDate }: { dashboard: MainDashboardResult; today: Date; shortDate: (date: string) => string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const total = dashboard.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const shown = showAll ? dashboard.payments : dashboard.payments.slice(0, PAYMENTS_SHOWN);

  const meta = (payment: MainDashboardResult['payments'][number]) => {
    if (payment.status === 'overdue') return { text: t('overview.payments.overdue', { date: shortDate(payment.dueDate) }), color: 'error.main' };
    const days = differenceInCalendarDays(asLocalDate(payment.dueDate), today);
    const when = days === 0 ? t('overview.payments.today') : days === 1 ? t('overview.payments.tomorrow') : t('overview.payments.inDays', { count: days });
    return { text: `${t(`mainDashboard.kinds.${payment.kind}`)} · ${when}`, color: days <= 3 ? 'warning.main' : undefined };
  };

  return (
    <Paper sx={{ p: 2.5 }}>
      <CardHeader
        title={t('overview.payments.title')}
        action={<Typography sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatMoneyWhole(total)}</Typography>}
      />
      {dashboard.payments.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 1 }}>{t('overview.payments.empty')}</Typography>
      ) : (
        <Rows>
          {shown.map((payment) => {
            const { text, color } = meta(payment);
            return (
              <Row
                key={`${payment.cardId}-${payment.dueDate}`}
                leading={<DateBadge date={payment.dueDate} />}
                title={payment.cardName}
                meta={text}
                metaColor={color}
                trailing={formatMoney(payment.amount)}
                onClick={() => navigate(payment.kind === 'mortgage' ? `/mortgages/${payment.cardId}` : `/cards/${payment.cardId}`)}
              />
            );
          })}
        </Rows>
      )}
      {dashboard.payments.length > PAYMENTS_SHOWN && (
        <Button size="small" sx={{ mt: 1, ml: -1 }} onClick={() => setShowAll((current) => !current)}>
          {showAll ? t('mainDashboard.showLess') : t('mainDashboard.showAll', { count: dashboard.payments.length })}
        </Button>
      )}
    </Paper>
  );
}

/** Net worth change over the last few months, colored by sign. */
function CapitalDelta({ netWorth }: { netWorth: NetWorthResult }) {
  const { t } = useTranslation();
  const points = netWorth.history.filter((point) => point.netWorth !== null);
  const past = points[points.length - 1 - CAPITAL_DELTA_MONTHS];
  if (!past || past.netWorth === null) return <>{t('overview.capital.formula')}</>;
  const delta = netWorth.netWorth - past.netWorth;
  return (
    <>
      <Box component="span" sx={{ color: delta >= 0 ? 'success.main' : 'error.main' }}>
        {delta >= 0 ? '+' : '−'}{formatMoneyWhole(Math.abs(delta))}
      </Box>{' '}
      {t('overview.capital.overMonths', { count: CAPITAL_DELTA_MONTHS })}
    </>
  );
}

function CapitalCard({ netWorth }: { netWorth: NetWorthResult | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (!netWorth || netWorth.assets.lines.length === 0) {
    return (
      <Paper sx={{ p: 2.5 }}>
        <CardHeader title={t('overview.capital.title')} />
        <Typography color="text.secondary" sx={{ mb: 1.5 }}>{t('netWorth.empty')}</Typography>
        <Button variant="outlined" onClick={() => navigate('/accounts')}>{t('netWorth.addAccounts')}</Button>
      </Paper>
    );
  }
  const history = netWorth.history.filter((point) => point.netWorth !== null).map((point) => point.netWorth as number);
  return (
    <Paper sx={{ p: 2.5 }}>
      <CardHeader title={t('overview.capital.title')} action={<Link component="button" onClick={() => navigate('/capital')}>{t('overview.more')}</Link>} />
      <BigMoney value={netWorth.netWorth} size={24} />
      <Typography variant="body2" color="text.secondary"><CapitalDelta netWorth={netWorth} /></Typography>
      {history.length > 1 && <Box sx={{ my: 1.5 }}><Sparkline values={history} color="var(--status-ok)" height={56} /></Box>}
      <Rows>
        <Row title={<Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>{t('netWorth.assets')}</Box>} trailing={formatMoneyWhole(netWorth.assets.total)} />
        <Row title={<Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>{t('netWorth.debts')}</Box>} trailing={`−${formatMoneyWhole(netWorth.debts.total)}`} />
      </Rows>
    </Paper>
  );
}

/** Monthly totals of RUB plan items, as on the plan page. */
function monthlyPlan(items: PlanItem[]) {
  const sum = (kind: PlanItem['kind']) => items.filter((item) => item.kind === kind && item.currency === 'RUB').reduce((total, item) => total + item.monthlyAmount, 0);
  const income = sum('income');
  const expense = sum('expense');
  const transfer = sum('transfer');
  return { income, expense, transfer, left: income - expense - transfer };
}

function MonthPlanCard({ items, forecast }: { items: PlanItem[]; forecast: ForecastResult | null }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const today = new Date();
  const title = capitalize(t('overview.plan.title', { month: format(today, 'LLLL', { locale: getDateFnsLocale(i18n.language) }) }));

  if (items.length === 0) {
    return (
      <Paper sx={{ p: 2.5 }}>
        <CardHeader title={title} />
        <Typography color="text.secondary" sx={{ mb: 1.5 }}>{t('overview.plan.empty')}</Typography>
        <Button variant="outlined" onClick={() => navigate('/plan/items')}>{t('overview.plan.open')}</Button>
      </Paper>
    );
  }

  const plan = monthlyPlan(items);
  const current = forecast?.planVsFact.find((row) => row.month === format(today, 'yyyy-MM'));
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const line = (label: string, value: number, bold = false, color?: string) => (
    <Row
      title={<Box component="span" sx={{ fontWeight: bold ? 600 : 400 }}>{label}</Box>}
      trailing={<Box component="span" sx={{ color, fontWeight: bold ? 600 : 500 }}>{formatMoneyWhole(value)}</Box>}
    />
  );

  return (
    <Paper sx={{ p: 2.5 }}>
      <CardHeader title={title} action={<Typography variant="caption" color="text.disabled">{t('overview.plan.days', { day: today.getDate(), total: daysInMonth })}</Typography>} />
      <Rows>
        {line(t('overview.plan.income'), plan.income, false, 'success.main')}
        {line(t('overview.plan.expense'), plan.expense)}
        {plan.transfer > 0 && line(t('overview.plan.transfer'), plan.transfer)}
        {line(t('overview.plan.left'), plan.left, true, plan.left < 0 ? 'error.main' : undefined)}
      </Rows>
      {current && current.fact !== null && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {t('overview.plan.fact', { fact: formatMoneyWhole(current.fact), plan: formatMoneyWhole(current.plan) })}{' '}
          <Link component="button" variant="caption" onClick={() => navigate('/plan/fact')} sx={{ verticalAlign: 'baseline' }}>{t('overview.plan.factLink')}</Link>
        </Typography>
      )}
    </Paper>
  );
}
