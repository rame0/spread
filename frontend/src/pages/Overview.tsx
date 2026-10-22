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
  ToggleButton,
  ToggleButtonGroup,
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
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import { addMonths, differenceInCalendarDays, format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';
import { formatMoney, formatMoneyCompact, formatMoneyWhole } from '../formatMoney';
import Sparkline from '../components/Sparkline';
import { ChartLegend, CompositionBar, MonthBars, MonthPairs, StackedHistory, type Series } from '../components/OverviewCharts';
import { DateBadge, Row, RowIcon, Rows } from '../components/Row';
import { getAccounts, getForecast, getMainDashboard, getNetWorth, getOverviewCharts, getPlanItems } from '../services/api';
import type { Account, Card, ForecastResult, MainDashboardResult, NetWorthResult, OverviewChartsResult, PlanItem } from '../types/v2';
import { debtIcon } from './debts/DebtsLayout';

const PAYMENTS_SHOWN = 4;
const FORECAST_MONTHS = 3;
/** Months ahead for the cash flow and debt charts, and behind for card spending. */
const CHART_MONTHS = 12;
const CAPITAL_DELTA_MONTHS = 3;
/** Deposits ending within this many days are worth a reminder. */
const MATURITY_NOTICE_DAYS = 45;

const asLocalDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`);
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

type Attention = { key: string; icon: React.ReactElement; color: string; title: string; meta?: string; path: string };
type Payment = MainDashboardResult['payments'][number];

/** The forecast cut to its first months, with the lowest balance within them. */
function nearTerm(forecast: ForecastResult, months: number): ForecastResult {
  const until = format(addMonths(asLocalDate(forecast.today), months), 'yyyy-MM-dd');
  const daily = forecast.daily.filter((day) => day.date <= until);
  if (daily.length === 0) return forecast;
  const minLiquid = daily.reduce((min, day) => (day.liquid < min.amount ? { date: day.date, amount: day.liquid } : min), { date: daily[0].date, amount: daily[0].liquid });
  return { ...forecast, until, daily, minLiquid };
}

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
  const [charts, setCharts] = useState<OverviewChartsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = () => {
    setError('');
    // The dashboard is required; the rest only adds blocks and may fail on its own.
    Promise.all([
      getMainDashboard(),
      getNetWorth(12).catch(() => null),
      getForecast(CHART_MONTHS).catch(() => null),
      getPlanItems().catch(() => []),
      getAccounts().catch(() => []),
      getOverviewCharts(CHART_MONTHS).catch(() => null),
    ])
      .then(([nextDashboard, nextNetWorth, nextForecast, nextItems, nextAccounts, nextCharts]) => {
        setDashboard(nextDashboard);
        setNetWorth(nextNetWorth);
        setForecast(nextForecast);
        setPlanItems(nextItems);
        setAccounts(nextAccounts);
        setCharts(nextCharts);
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

  const freeMoney = <FreeMoneyCard netWorth={netWorth} forecast={forecast && nearTerm(forecast, FORECAST_MONTHS)} shortDate={shortDate} hero={isDesktop} />;
  const payments = <PaymentsCard dashboard={dashboard} today={today} shortDate={shortDate} />;
  const cashFlow = forecast && <CashFlowCard forecast={forecast} hasPlan={planItems.length > 0} />;
  const debts = <DebtsCard dashboard={dashboard} load={charts?.debtLoad ?? null} />;
  const spending = charts && <SpendingCard spending={charts.cardSpending} />;
  const capital = <CapitalCard netWorth={netWorth} />;
  const attentionCard = attention.length > 0 && (
    <Paper sx={{ p: 2.5 }}>
      <CardHeader title={t('overview.attention.title')} />
      <Rows>
        {attention.map((item) => (
          <Row key={item.key} leading={<RowIcon color={item.color}>{item.icon}</RowIcon>} title={item.title} meta={item.meta} onClick={() => navigate(item.path)} />
        ))}
      </Rows>
    </Paper>
  );
  const columns = { display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: 2 };

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
          <Box sx={columns}>
            {freeMoney}
            {payments}
          </Box>
          <Box sx={{ ...columns, alignItems: 'start' }}>
            <Stack spacing={2}>
              {cashFlow}
              {debts}
            </Stack>
            <Stack spacing={2}>
              {capital}
              {spending}
              <MonthPlanCard items={planItems} forecast={forecast} />
              {attentionCard}
            </Stack>
          </Box>
        </>
      ) : (
        <>
          {freeMoney}
          {payments}
          {cashFlow}
          {debts}
          {spending}
          {capital}
          <Paper sx={{ px: 2, py: 0.5 }}>
            <Rows>
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
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{t('overview.free.hint')}</Typography>
      {forecast && (
        <Typography sx={{ mt: 0.5, color: gap ? 'error.main' : 'text.secondary' }}>
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
      {forecast && forecast.daily.length > 1 && <MonthAxis dates={forecast.daily.map((day) => day.date)} />}
    </Paper>
  );
}

function PaymentsCard({ dashboard, today, shortDate }: { dashboard: MainDashboardResult; today: Date; shortDate: (date: string) => string }) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const navigate = useNavigate();
  const total = dashboard.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const shown = dashboard.payments.slice(0, PAYMENTS_SHOWN);
  const daysTo = (payment: Payment) => differenceInCalendarDays(asLocalDate(payment.dueDate), today);
  const when = (days: number) => (days === 0 ? t('overview.payments.today') : days === 1 ? t('overview.payments.tomorrow') : t('overview.payments.inDays', { count: days }));
  const next = dashboard.payments.find((payment) => payment.status !== 'overdue');

  const detail = (payment: Payment) => {
    const parts: string[] = [];
    if (payment.installment) {
      if (payment.installment.description) parts.push(payment.installment.description);
      parts.push(t('overview.payments.installment', { number: payment.installment.number, count: payment.installment.count }));
    } else if (payment.period) {
      parts.push(t('overview.payments.period', { month: format(new Date(payment.period.year, payment.period.month - 1, 1), 'LLLL', { locale }) }));
    } else if (payment.mortgage) {
      parts.push(t('overview.payments.mortgage', { number: payment.mortgage.number, interest: formatMoneyWhole(payment.mortgage.interest) }));
    } else {
      parts.push(t(`mainDashboard.kinds.${payment.kind}`));
    }
    if (payment.parts > 1) parts.push(t('overview.payments.more', { count: payment.parts - 1 }));
    return parts.join(' · ');
  };
  const meta = (payment: Payment) => {
    if (payment.status === 'overdue') return { text: `${t('overview.payments.overdue', { date: shortDate(payment.dueDate) })} · ${detail(payment)}`, color: 'error.main' };
    const days = daysTo(payment);
    return days <= 3 ? { text: `${when(days)} · ${detail(payment)}`, color: 'warning.main' } : { text: detail(payment), color: undefined };
  };

  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography color="text.secondary">{t('overview.payments.title')}</Typography>
      <BigMoney value={total} size={28} />
      {dashboard.payments.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
          {next ? t('overview.payments.summary', { count: dashboard.payments.length, when: when(daysTo(next)) }) : t('overview.attention.overdue', { amount: formatMoney(dashboard.overdueAmount) })}
        </Typography>
      )}
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
      {dashboard.payments.length > 0 && (
        <Link component="button" onClick={() => navigate('/debts')} sx={{ mt: 1.5 }}>
          {t('overview.payments.all')} →
        </Link>
      )}
    </Paper>
  );
}

/** Debt totals and each debt with its next payment. */
function DebtsCard({ dashboard, load }: { dashboard: MainDashboardResult; load: OverviewChartsResult['debtLoad'] | null }) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const navigate = useNavigate();
  const kinds: Series[] = [
    { key: 'mortgage', label: t('debts.groups.mortgage'), color: 'var(--chart-3)' },
    { key: 'credit', label: t('debts.groups.credit'), color: 'var(--chart-1)' },
    { key: 'installment', label: t('debts.groups.installment'), color: 'var(--chart-4)' },
  ].filter((kind) => load?.some((month) => month[kind.key as 'credit'] > 0));
  const remaining: Series = { key: 'cardDebtEnd', label: t('overview.debts.remaining'), color: 'var(--chart-5)' };
  const hasCardDebt = load?.some((month) => month.cardDebtEnd > 0) ?? false;
  const lastCardMonth = load ? [...load].reverse().find((month) => month.credit + month.installment > 0)?.month : undefined;

  if (dashboard.cards.length === 0) {
    return (
      <Paper sx={{ p: 2.5 }}>
        <CardHeader title={t('overview.debts.title')} />
        <Typography color="text.secondary" sx={{ mb: 1.5 }}>{t('overview.debts.empty')}</Typography>
        <Button variant="outlined" onClick={() => navigate('/debts')}>{t('overview.debts.add')}</Button>
      </Paper>
    );
  }

  const figures = [
    { key: 'total', label: t('overview.debts.total'), value: formatMoneyCompact(dashboard.totalRemaining, i18n.language) },
    { key: 'month', label: t('overview.debts.month'), value: formatMoneyWhole(dashboard.dueThisMonth), note: t('overview.debts.monthHint') },
    { key: 'planned', label: t('overview.debts.planned'), value: formatMoneyWhole(dashboard.plannedThisMonth), note: t('overview.debts.plannedHint') },
    ...(dashboard.overdueAmount > 0 ? [{ key: 'overdue', label: t('overview.debts.overdue'), value: formatMoneyWhole(dashboard.overdueAmount), color: 'error.main' }] : []),
  ];

  return (
    <Paper sx={{ p: 2.5 }}>
      <CardHeader title={t('overview.debts.title')} action={<Link component="button" onClick={() => navigate('/debts')}>{t('overview.more')}</Link>} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: `repeat(${Math.min(figures.length, 3)}, minmax(0, 1fr))`, sm: `repeat(${figures.length}, minmax(0, 1fr))` }, gap: { xs: 1.5, sm: 2 }, mb: 1 }}>
        {figures.map((figure) => (
          <Box key={figure.key} sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary">{figure.label}</Typography>
            <Typography sx={{ fontSize: { xs: 17, sm: 20 }, fontWeight: 600, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: figure.color }}>{figure.value}</Typography>
            {figure.note && <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, lineHeight: 1.3 }}>{figure.note}</Typography>}
          </Box>
        ))}
      </Box>
      {load && kinds.length > 0 && (
        <Box sx={{ my: 1.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {t('overview.debts.chartHint', { count: load.length })}
            {lastCardMonth && lastCardMonth !== load[load.length - 1].month && (
              <> · {t('overview.debts.cardsDone', { month: format(asLocalDate(`${lastCardMonth}-15`), 'LLLL yyyy', { locale }) })}</>
            )}
          </Typography>
          <MonthBars data={load} bars={kinds} line={hasCardDebt ? remaining : undefined} lineAxis="right" total={t('overview.debts.paymentsTotal')} />
          <ChartLegend series={kinds} line={hasCardDebt ? remaining : undefined} />
        </Box>
      )}
      <Rows>
        {dashboard.cards.map((debt) => {
          const overdue = debt.overdueAmount > 0;
          const meta = overdue
            ? t('debts.overdue', { amount: formatMoneyWhole(debt.overdueAmount) })
            : debt.nextDueDate
              ? t('debts.next', { amount: formatMoneyWhole(debt.nextDueAmount), date: format(asLocalDate(debt.nextDueDate), 'd MMM', { locale }) })
              : t('debts.nothingDue');
          return (
            <Row
              key={debt.id}
              leading={<RowIcon>{debtIcon(debt.kind)}</RowIcon>}
              title={debt.name}
              meta={meta}
              metaColor={overdue ? 'error.main' : undefined}
              trailing={formatMoneyWhole(debt.totalRemaining)}
              onClick={() => navigate(debt.kind === 'mortgage' ? `/mortgages/${debt.id}` : `/cards/${debt.id}`)}
            />
          );
        })}
      </Rows>
    </Paper>
  );
}

/** "Today" and month starts under a daily chart, placed by their position in the series. */
function MonthAxis({ dates }: { dates: string[] }) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const last = dates.length - 1;
  const marks = dates
    .map((date, index) => ({ date, index }))
    .filter(({ date, index }) => date.endsWith('-01') && index / last > 0.12 && index / last < 0.94);
  return (
    <Box sx={{ position: 'relative', height: 18, mt: 0.75 }}>
      <Typography variant="caption" color="text.disabled" sx={{ position: 'absolute', left: 0 }}>{t('overview.payments.today')}</Typography>
      {marks.map(({ date, index }) => (
        <Typography key={date} variant="caption" color="text.disabled" sx={{ position: 'absolute', left: `${(index / last) * 100}%`, transform: 'translateX(-50%)' }}>
          {format(asLocalDate(date), 'LLLL', { locale })}
        </Typography>
      ))}
    </Box>
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

  const sumLines = (match: (line: NetWorthResult['assets']['lines'][number]) => boolean) =>
    netWorth.assets.lines.filter((line) => line.kind !== 'property' && match(line)).reduce((sum, line) => sum + (line.rubAmount ?? 0), 0);
  const parts = [
    { key: 'free', label: t('overview.capital.parts.free'), color: 'var(--chart-1)', value: sumLines((line) => line.isLiquid) },
    { key: 'savings', label: t('overview.capital.parts.savings'), color: 'var(--chart-2)', value: sumLines((line) => !line.isLiquid && (line.kind === 'savings' || line.kind === 'deposit')) },
    { key: 'invest', label: t('overview.capital.parts.invest'), color: 'var(--chart-4)', value: sumLines((line) => !line.isLiquid && line.kind === 'brokerage') },
    { key: 'other', label: t('overview.capital.parts.other'), color: 'var(--chart-6)', value: sumLines((line) => !line.isLiquid && !['savings', 'deposit', 'brokerage'].includes(line.kind)) },
    { key: 'property', label: t('overview.capital.parts.property'), color: 'var(--chart-3)', value: netWorth.realEstate.equity },
  ];
  const history = netWorth.history
    .filter((point) => point.assets !== null && point.netWorth !== null)
    .map((point) => ({ date: point.date, assets: point.assets as number, realEstate: Math.max(0, point.realEstate), netWorth: point.netWorth as number }));
  const areas: Series[] = [
    { key: 'assets', label: t('overview.capital.parts.accounts'), color: 'var(--chart-2)' },
    ...(history.some((point) => point.realEstate > 0) ? [{ key: 'realEstate', label: t('overview.capital.parts.property'), color: 'var(--chart-3)' }] : []),
  ];
  const netWorthLine: Series = { key: 'netWorth', label: t('overview.capital.title'), color: 'var(--text-primary)' };

  return (
    <Paper sx={{ p: 2.5 }}>
      <CardHeader title={t('overview.capital.title')} action={<Link component="button" onClick={() => navigate('/capital')}>{t('overview.more')}</Link>} />
      <BigMoney value={netWorth.netWorth} size={24} />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}><CapitalDelta netWorth={netWorth} /></Typography>
      <CompositionBar parts={parts} formatValue={(value) => formatMoneyWhole(value)} />
      {netWorth.debts.cards > 0 && (
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.75, pt: 0.75, borderTop: '1px solid var(--border)' }}>
          <Typography variant="body2" color="text.secondary">{t('overview.capital.parts.cardDebts')}</Typography>
          <Typography variant="body2" sx={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>−{formatMoneyWhole(netWorth.debts.cards)}</Typography>
        </Stack>
      )}
      {history.length > 1 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{t('overview.capital.history')}</Typography>
          <StackedHistory data={history} areas={areas} line={netWorthLine} />
          <ChartLegend series={areas} line={netWorthLine} />
        </Box>
      )}
    </Paper>
  );
}

/** Money in and out by month ahead, or plan against fact for the months behind. */
function CashFlowCard({ forecast, hasPlan }: { forecast: ForecastResult; hasPlan: boolean }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isWide = useMediaQuery(theme.breakpoints.up('sm'));
  const [view, setView] = useState<'forecast' | 'fact'>('forecast');
  const bars: Series[] = [
    { key: 'income', label: t('overview.cashflow.income'), color: 'var(--chart-2)' },
    { key: 'expenses', label: t('overview.cashflow.expenses'), color: 'var(--chart-1)' },
    { key: 'debts', label: t('overview.cashflow.debts'), color: 'var(--chart-5)' },
    { key: 'savings', label: t('overview.cashflow.savings'), color: 'var(--chart-4)' },
  ];
  const liquid: Series = { key: 'liquid', label: t('overview.cashflow.liquid'), color: 'var(--chart-3)' };
  const data = forecast.months.map((month) => ({
    month: month.month,
    income: month.income + month.interest,
    expenses: -month.expenses,
    debts: -month.debtPayments,
    savings: -month.transfers,
    liquid: month.liquidEnd,
  }));
  const shownBars = bars.filter((bar) => data.some((month) => month[bar.key as 'income'] !== 0));
  const income = forecast.months.reduce((sum, month) => sum + month.income + month.interest, 0);
  const outflow = forecast.months.reduce((sum, month) => sum + month.expenses + month.debtPayments + month.transfers, 0);
  const last = forecast.months[forecast.months.length - 1];

  const pairs: [Series, Series] = [
    { key: 'plan', label: t('overview.cashflow.plan'), color: 'color-mix(in srgb, var(--text-secondary) 45%, transparent)' },
    { key: 'fact', label: t('overview.cashflow.fact'), color: 'var(--chart-1)' },
  ];
  const facts = forecast.planVsFact.map((row) => ({ month: row.month, plan: row.plan, fact: row.fact }));
  const hasFacts = facts.some((row) => row.fact !== null);

  const figure = (label: string, value: number, color?: string) => (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography sx={{ fontSize: { xs: 17, sm: 20 }, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color }}>
        {isWide ? formatMoneyWhole(value) : formatMoneyCompact(value, i18n.language)}
      </Typography>
    </Box>
  );

  return (
    <Paper sx={{ p: 2.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1">{t('overview.cashflow.title')}</Typography>
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, next) => next && setView(next)} sx={{ '& .MuiToggleButton-root': { whiteSpace: 'nowrap', flex: { xs: 1, sm: 'none' } } }}>
          <ToggleButton value="forecast">{t('overview.cashflow.forecast')}</ToggleButton>
          <ToggleButton value="fact">{t('overview.cashflow.planFact')}</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      {view === 'forecast' ? (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: { xs: 1.5, sm: 2 }, mb: 1 }}>
            {figure(t('overview.cashflow.incomeTotal'), income, 'success.main')}
            {figure(t('overview.cashflow.outflowTotal'), outflow)}
            {last && figure(t('overview.cashflow.liquidEnd'), last.liquidEnd, last.liquidEnd < 0 ? 'error.main' : undefined)}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {t('overview.cashflow.forecastHint')}
            {!hasPlan && (
              <>
                {' '}
                <Link component="button" onClick={() => navigate('/plan/items')} sx={{ verticalAlign: 'baseline' }}>{t('overview.cashflow.addPlan')}</Link>
              </>
            )}
          </Typography>
          <MonthBars data={data} bars={shownBars} line={liquid} lineAxis="right" absolute />
          <ChartLegend series={shownBars} line={liquid} />
        </>
      ) : hasFacts ? (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{t('overview.cashflow.factHint')}</Typography>
          <MonthPairs data={facts} bars={pairs} />
          <ChartLegend series={pairs} />
        </>
      ) : (
        <Typography color="text.secondary" sx={{ py: 2 }}>{t('overview.cashflow.noFact')}</Typography>
      )}
    </Paper>
  );
}

/** Card purchases per month for the last year, split by card. */
function SpendingCard({ spending }: { spending: OverviewChartsResult['cardSpending'] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (spending.cards.length === 0) return null;
  const palette = ['var(--chart-1)', 'var(--chart-4)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-6)', 'var(--chart-5)'];
  const bars: Series[] = spending.cards.map((card, index) => ({ key: card.id, label: card.name, color: palette[index % palette.length] }));
  const data = spending.months.map((month) => ({ month: month.month, ...Object.fromEntries(spending.cards.map((card) => [card.id, month.byCard[card.id] ?? 0])) }));
  const current = spending.months[spending.months.length - 1];
  const past = spending.months.slice(0, -1);
  // Average over the months since the first purchase, so a new user is not averaged with empty months.
  const firstActive = past.findIndex((month) => month.total > 0);
  const active = firstActive < 0 ? [] : past.slice(firstActive);
  const average = active.length > 0 ? active.reduce((sum, month) => sum + month.total, 0) / active.length : 0;

  return (
    <Paper sx={{ p: 2.5 }}>
      <CardHeader title={t('overview.spending.title')} action={<Link component="button" onClick={() => navigate('/debts')}>{t('overview.more')}</Link>} />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2, mb: 1 }}>
        <Box>
          <Typography variant="body2" color="text.secondary">{t('overview.spending.thisMonth')}</Typography>
          <Typography sx={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatMoneyWhole(current?.total ?? 0)}</Typography>
        </Box>
        {average > 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary">{t('overview.spending.average')}</Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatMoneyWhole(average)}</Typography>
          </Box>
        )}
      </Box>
      <MonthBars data={data} bars={bars} total={t('overview.spending.total')} />
      <ChartLegend series={bars} />
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
