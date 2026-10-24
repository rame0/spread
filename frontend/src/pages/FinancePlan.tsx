import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  Paper,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { format } from 'date-fns';
import { Link as RouterLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import NetWorthChart from '../components/NetWorthChart';
import PlanItemForm from '../components/PlanItemForm';
import { formatCurrency, formatMoney, formatMoneyWhole } from '../formatMoney';
import { Row, Rows } from '../components/Row';
import { getDateFnsLocale } from '../i18n';
import { createPlanItem, deletePlanItem, getAccounts, getCards, getForecast, getPlanItems, patchPlanItem } from '../services/api';
import type { Account, Card, ForecastResult, PlanItem, PlanItemKind } from '../types/v2';
import PlanCategories from './PlanCategories';
import PlanSuggestions from '../components/PlanSuggestions';
import { useCategories } from '../categories';

const HORIZONS = [3, 6, 12, 24];
const THRESHOLD_KEY = 'financePlan.threshold';
const HORIZON_KEY = 'financePlan.horizon';

const parseDate = (value: string) => new Date(`${value}T00:00:00`);
const readStored = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const store = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Only a convenience: the page works without it.
  }
};

type PlanTab = '' | 'items' | 'fact' | 'categories';
const TABS: PlanTab[] = ['', 'items', 'fact', 'categories'];
type Locale = ReturnType<typeof getDateFnsLocale>;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const formatNumber = (value: number) => formatMoneyWhole(value).replace(/\s₽$/, '');
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatMoneyWhole(Math.abs(value))}`;

export default function FinancePlan() {
  const { tab = '' } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [items, setItems] = useState<PlanItem[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [horizon, setHorizon] = useState(() => Number(readStored(HORIZON_KEY)) || 12);
  const [threshold, setThreshold] = useState(() => readStored(THRESHOLD_KEY) ?? '');
  const [showNetWorth, setShowNetWorth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialog, setDialog] = useState<{ item?: PlanItem; kind?: PlanItemKind } | null>(null);
  const categories = useCategories();

  const loadForecast = (months = horizon) =>
    getForecast(months)
      .then(setForecast)
      .catch(() => setError(t('financePlan.forecastError')));

  const load = () =>
    Promise.all([getPlanItems(), getCards(), getAccounts(), loadForecast()])
      .then(([nextItems, nextCards, nextAccounts]) => {
        setItems(nextItems);
        setCards(nextCards);
        setAccounts(nextAccounts);
      })
      .catch(() => setError(t('financePlan.loadError')))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  if (!TABS.includes(tab as PlanTab)) return <Navigate to="/plan" replace />;
  if (loading) return <CircularProgress />;

  const notify = (message: string) => {
    setSuccess(message);
    load();
  };

  const changeHorizon = (months: number) => {
    setHorizon(months);
    store(HORIZON_KEY, String(months));
    loadForecast(months);
  };

  const thresholdValue = threshold.trim() === '' ? null : Number(threshold);
  const limit = thresholdValue !== null && Number.isFinite(thresholdValue) ? thresholdValue : 0;
  const firstBelow = forecast?.daily.find((point) => point.liquid < limit) ?? null;

  const rubMonthly = (kind: PlanItemKind) =>
    items.filter((item) => item.kind === kind && item.currency === 'RUB').reduce((sum, item) => sum + item.monthlyAmount, 0);
  const leftPerMonth = rubMonthly('income') - rubMonthly('expense') - rubMonthly('transfer');
  const hasForeign = items.some((item) => item.currency !== 'RUB' && item.frequency !== 'once');
  const shortDate = (value: string) => format(parseDate(value), 'd MMMM', { locale });

  const forecastTab = forecast && (
    <Stack spacing={2}>
      <Paper sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Typography color="text.secondary">{t('financePlan.liquidIn', { count: horizon })}</Typography>
          <ToggleButtonGroup value={horizon} exclusive size="small" onChange={(_, value: number | null) => value && changeHorizon(value)}>
            {HORIZONS.map((months) => (
              <ToggleButton key={months} value={months} aria-label={t('financePlan.horizon', { count: months })}>
                {isDesktop ? t('financePlan.horizon', { count: months }) : months}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
        <Typography sx={{ fontSize: { xs: 30, md: 36 }, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
          {formatMoneyWhole(forecast.daily.at(-1)?.liquid ?? 0)}
        </Typography>
        <Typography sx={{ color: firstBelow ? (firstBelow.liquid < 0 ? 'error.main' : 'warning.main') : 'text.secondary' }}>
          {firstBelow ? (
            t(limit > 0 ? 'financePlan.belowThreshold' : 'financePlan.belowZero', {
              date: format(parseDate(firstBelow.date), 'd MMMM yyyy', { locale }),
              min: formatMoney(forecast.minLiquid.amount),
              minDate: format(parseDate(forecast.minLiquid.date), 'd MMMM yyyy', { locale }),
            })
          ) : (
            <>
              <Box component="span" sx={{ color: 'success.main' }}>{t('financePlan.enoughShort')}</Box>
              {' · '}
              {t('overview.free.minimum', { amount: formatMoneyWhole(forecast.minLiquid.amount), date: shortDate(forecast.minLiquid.date) })}
            </>
          )}
        </Typography>
        {forecast.missingRates.length > 0 && <Alert severity="warning" sx={{ mt: 1 }}>{t('financePlan.missingRates', { currencies: forecast.missingRates.join(', ') })}</Alert>}
        <Box sx={{ mx: -1.5, mt: 1 }}>
          <NetWorthChart
            data={forecast.daily}
            formatValue={formatMoney}
            threshold={limit > 0 ? { value: limit, label: t('financePlan.thresholdLine') } : undefined}
            series={[
              { key: 'liquid', label: t('financePlan.liquid'), color: 'var(--accent)' },
              ...(showNetWorth ? [{ key: 'netWorth', label: t('netWorth.netWorth'), color: 'var(--status-ok)' }] : []),
            ]}
          />
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ mt: 1 }}>
          <TextField
            size="small"
            type="number"
            label={t('financePlan.threshold')}
            value={threshold}
            onChange={(e) => {
              setThreshold(e.target.value);
              store(THRESHOLD_KEY, e.target.value);
            }}
            InputProps={{ endAdornment: <InputAdornment position="end">₽</InputAdornment> }}
            sx={{ maxWidth: 280 }}
          />
          <FormControlLabel
            control={<Switch checked={showNetWorth} onChange={(e) => setShowNetWorth(e.target.checked)} />}
            label={t('financePlan.showNetWorth', { amount: formatMoneyWhole(forecast.daily.at(-1)?.netWorth ?? 0) })}
          />
        </Stack>
      </Paper>

      <Paper sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>{t('financePlan.monthsTitle')}</Typography>
        {isDesktop ? <MonthsTable forecast={forecast} limit={limit} locale={locale} /> : <MonthCards forecast={forecast} limit={limit} locale={locale} />}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>{t('financePlan.monthsHint')}</Typography>
      </Paper>
    </Stack>
  );

  const itemsTab = (
    <Stack spacing={2}>
      <PlanSuggestions reloadKey={items} onApplied={notify} onError={setError} />
      <Paper sx={{ p: 2.5 }}>
        {items.length === 0 ? (
          <Stack spacing={1.5} alignItems="flex-start">
            <Typography sx={{ fontWeight: 500 }}>{t('overview.plan.empty')}</Typography>
            <Typography color="text.secondary">{t('financePlan.empty')}</Typography>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setDialog({})}>{t('financePlan.add')}</Button>
          </Stack>
        ) : (
          <Stack spacing={2.5}>
            {(['income', 'expense', 'transfer'] as PlanItemKind[]).map((kind) => {
              const group = items.filter((item) => item.kind === kind);
              if (group.length === 0) return null;
              return (
                <Box key={kind}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 600 }}>{t(`financePlan.groups.${kind}`)}</Typography>
                    <Typography color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>{t('financePlan.perMonth', { amount: formatMoneyWhole(rubMonthly(kind)) })}</Typography>
                  </Stack>
                  <Rows>
                    {group.map((item) => (
                      <Stack key={item.id} direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Row
                            title={item.name}
                            meta={[
                              describeSchedule(item, t, locale),
                              item.categoryId && categories?.find((category) => category.id === item.categoryId)?.name,
                              item.cardId && cards.find((card) => card.id === item.cardId)?.name,
                              item.targetAccountId && `→ ${accounts.find((account) => account.id === item.targetAccountId)?.name ?? ''}`,
                            ].filter(Boolean).join(' · ')}
                            trailing={
                              <Box component="span" sx={{ display: 'block', textAlign: 'right', color: kind === 'income' ? 'success.main' : undefined }}>
                                {formatCurrency(item.amount, item.currency)}
                                {item.frequency !== 'once' && item.monthlyAmount !== item.amount && (
                                  <Box component="span" sx={{ display: 'block', fontSize: 12, fontWeight: 400, color: 'text.secondary' }}>
                                    {t('financePlan.perMonth', { amount: formatCurrency(item.monthlyAmount, item.currency) })}
                                  </Box>
                                )}
                              </Box>
                            }
                            onClick={() => setDialog({ item })}
                          />
                        </Box>
                        <Tooltip title={t('financePlan.delete')}>
                          <IconButton
                            size="small"
                            aria-label={t('financePlan.delete')}
                            onClick={() =>
                              deletePlanItem(item.id)
                                .then(() => notify(t('financePlan.deleted')))
                                .catch(() => setError(t('financePlan.form.error')))
                            }
                          >
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    ))}
                  </Rows>
                </Box>
              );
            })}
            <Stack direction="row" justifyContent="space-between" sx={{ pt: 1.5, borderTop: '1px solid var(--border)' }}>
              <Typography sx={{ fontWeight: 600 }}>{t('financePlan.summary.left')}</Typography>
              <Typography sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: leftPerMonth < 0 ? 'error.main' : undefined }}>{formatMoneyWhole(leftPerMonth)}</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {hasForeign ? t('financePlan.summary.hintForeign') : t('financePlan.summary.hint')}
            </Typography>
          </Stack>
        )}
      </Paper>
    </Stack>
  );

  const factTab = forecast && (
    <Paper sx={{ p: 2.5 }}>
      <Typography color="text.secondary" variant="body2" sx={{ mb: 1 }}>{t('financePlan.factSubtitle')}</Typography>
      <FactList forecast={forecast} locale={locale} compact={!isDesktop} />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {t('financePlan.factHint')}{' '}
        <Link component={RouterLink} to="/accounts">{t('financePlan.factHintLink')}</Link>
      </Typography>
    </Paper>
  );

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4">{t('nav.plan')}</Typography>
        <Button variant={isDesktop ? 'contained' : 'outlined'} startIcon={<AddRoundedIcon />} onClick={() => setDialog({})}>
          {t('financePlan.addShort')}
        </Button>
      </Stack>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      <ToggleButtonGroup
        exclusive
        value={tab}
        onChange={(_, next: PlanTab | null) => next !== null && navigate(next ? `/plan/${next}` : '/plan')}
        sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' }, '& .MuiToggleButton-root': { flex: { xs: 1, sm: 'none' }, px: 2 } }}
      >
        <ToggleButton value="">{t('financePlan.tabs.forecast')}</ToggleButton>
        <ToggleButton value="items">{t('financePlan.tabs.items')}</ToggleButton>
        <ToggleButton value="fact">{t('financePlan.tabs.fact')}</ToggleButton>
        <ToggleButton value="categories">{t('financePlan.tabs.categories')}</ToggleButton>
      </ToggleButtonGroup>

      {tab === '' && forecastTab}
      {tab === 'items' && itemsTab}
      {tab === 'fact' && factTab}
      {tab === 'categories' && <PlanCategories />}

      <Dialog open={dialog !== null} onClose={() => setDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{dialog?.item ? t('financePlan.edit') : t('financePlan.add')}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {dialog && (
              <PlanItemForm
                key={dialog.item?.id ?? 'new'}
                initial={dialog.item}
                initialKind={dialog.kind}
                cards={cards}
                accounts={accounts}
                submitLabel={dialog.item ? t('financePlan.form.save') : t('financePlan.form.create')}
                onSubmit={(values) =>
                  (dialog.item ? patchPlanItem(dialog.item.id, values) : createPlanItem(values)).then(() => {
                    setDialog(null);
                    notify(dialog.item ? t('financePlan.saved') : t('financePlan.created'));
                  })
                }
              />
            )}
          </Box>
        </DialogContent>
      </Dialog>

      <Snackbar open={Boolean(success)} autoHideDuration={3000} onClose={() => setSuccess('')}>
        <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>
      </Snackbar>
    </Stack>
  );
}

const monthTitle = (month: string, locale: Locale) => {
  const date = parseDate(`${month}-01`);
  return capitalize(format(date, date.getFullYear() === new Date().getFullYear() ? 'LLLL' : 'LLLL yyyy', { locale }));
};

function MonthsTable({ forecast, limit, locale }: { forecast: ForecastResult; limit: number; locale: Locale }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ '& th': { whiteSpace: 'nowrap' } }}>
        <TableHead>
          <TableRow>
            <TableCell>{t('financePlan.table.month')}</TableCell>
            <TableCell align="right">{t('financePlan.table.income')}</TableCell>
            <TableCell align="right">{t('financePlan.table.expenses')}</TableCell>
            <TableCell align="right">{t('financePlan.table.cardSpending')}</TableCell>
            <TableCell align="right">{t('financePlan.table.debtPayments')}</TableCell>
            <TableCell align="right">{t('financePlan.table.transfers')}</TableCell>
            <TableCell align="right">{t('financePlan.table.interest')}</TableCell>
            <TableCell align="right">{t('financePlan.table.liquidEnd')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {forecast.months.map((row) => (
            <TableRow key={row.month}>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{monthTitle(row.month, locale)}</TableCell>
              <MoneyCell value={row.income} />
              <MoneyCell value={row.expenses} />
              <MoneyCell value={row.cardSpending} muted />
              <MoneyCell value={row.debtPayments} />
              <MoneyCell value={row.transfers} />
              <MoneyCell value={row.interest} />
              <MoneyCell value={row.liquidEnd} strong danger={row.liquidEnd < limit} />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

/** Phone version of the monthly table: end balance and change, the breakdown on tap. */
function MonthCards({ forecast, limit, locale }: { forecast: ForecastResult; limit: number; locale: Locale }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Rows>
      {forecast.months.map((row, index) => {
        const previous = index === 0 ? forecast.start.liquid : forecast.months[index - 1].liquidEnd;
        const delta = row.liquidEnd - previous;
        const spent = row.expenses + row.debtPayments + row.transfers;
        const lines: Array<[string, number, string?]> = [
          [t('financePlan.table.income'), row.income, 'success.main'],
          [t('financePlan.table.expenses'), -row.expenses],
          [t('financePlan.table.debtPayments'), -row.debtPayments],
          [t('financePlan.table.transfers'), -row.transfers],
          [t('financePlan.table.interest'), row.interest, 'success.main'],
        ];
        return (
          <Box key={row.month}>
            <ButtonBase onClick={() => setOpen(open === row.month ? null : row.month)} sx={{ display: 'flex', width: '100%', py: 1.25, textAlign: 'left', gap: 2 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 500 }}>{monthTitle(row.month, locale)}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                  {[row.income > 0 && `+${formatNumber(row.income)}`, spent > 0 && `−${formatNumber(spent)}`].filter(Boolean).join(' · ') || '—'}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: row.liquidEnd < limit ? 'error.main' : undefined }}>{formatMoneyWhole(row.liquidEnd)}</Typography>
                <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums', color: delta > 0 ? 'success.main' : delta < 0 ? 'error.main' : 'text.secondary' }}>{signed(delta)}</Typography>
              </Box>
            </ButtonBase>
            {open === row.month && (
              <Box sx={{ pb: 1.25, pl: 1.5, borderLeft: '2px solid var(--border)' }}>
                {lines.filter(([, value]) => value !== 0).map(([label, value, color]) => (
                  <Stack key={label} direction="row" justifyContent="space-between" sx={{ py: 0.25 }}>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', color }}>{signed(value)}</Typography>
                  </Stack>
                ))}
                {row.cardSpending > 0 && (
                  <Stack direction="row" justifyContent="space-between" sx={{ py: 0.25 }}>
                    <Typography variant="body2" color="text.secondary">{t('financePlan.table.cardSpending')}</Typography>
                    <Typography variant="body2" color="text.disabled" sx={{ fontVariantNumeric: 'tabular-nums' }}>{t('financePlan.toDebts', { amount: formatMoneyWhole(row.cardSpending) })}</Typography>
                  </Stack>
                )}
              </Box>
            )}
          </Box>
        );
      })}
    </Rows>
  );
}

function FactList({ forecast, locale, compact }: { forecast: ForecastResult; locale: Locale; compact: boolean }) {
  const { t } = useTranslation();
  const rows = [...forecast.planVsFact].reverse();
  const title = (row: ForecastResult['planVsFact'][number]) =>
    `${monthTitle(row.month, locale)}${row.to.slice(0, 7) === forecast.today.slice(0, 7) ? ` ${t('financePlan.fact.toDate', { date: format(parseDate(row.to), 'd MMM', { locale }) })}` : ''}`;
  const diffColor = (value: number | null) => (value === null || value === 0 ? 'text.secondary' : value > 0 ? 'success.main' : 'error.main');
  const fact = (row: ForecastResult['planVsFact'][number]) =>
    row.fact === null ? t('financePlan.fact.noBalances') : `${formatMoneyWhole(row.fact)}${row.estimated ? ' *' : ''}`;

  if (compact) {
    return (
      <Rows>
        {rows.map((row) => (
          <Stack key={row.to} direction="row" spacing={2} alignItems="center" sx={{ py: 1.25 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 500 }} noWrap>{title(row)}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t('financePlan.fact.planShort', { amount: formatMoneyWhole(row.plan) })} · {t('financePlan.fact.factShort', { amount: fact(row) })}
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: diffColor(row.difference) }}>
              {row.difference === null ? '—' : signed(row.difference)}
            </Typography>
          </Stack>
        ))}
      </Rows>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{t('financePlan.table.month')}</TableCell>
          <TableCell align="right">{t('financePlan.fact.plan')}</TableCell>
          <TableCell align="right">{t('financePlan.fact.fact')}</TableCell>
          <TableCell align="right">{t('financePlan.fact.difference')}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.to}>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>{title(row)}</TableCell>
            <MoneyCell value={row.plan} />
            <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: row.fact === null ? 'text.secondary' : 'text.primary' }}>
              {row.estimated && row.fact !== null ? (
                <Tooltip title={t('financePlan.fact.estimated')}><span>{fact(row)}</span></Tooltip>
              ) : (
                fact(row)
              )}
            </TableCell>
            <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: diffColor(row.difference) }}>
              {row.difference === null ? '—' : signed(row.difference)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function describeSchedule(item: PlanItem, t: (key: string, options?: Record<string, unknown>) => string, locale: ReturnType<typeof getDateFnsLocale>) {
  const start = parseDate(item.startDate);
  const base =
    item.frequency === 'once'
      ? format(start, 'd MMMM yyyy', { locale })
      : item.frequency === 'weekly'
        ? t('financePlan.schedule.weekly', { count: item.interval, day: format(start, 'EEEE', { locale }) })
        : item.frequency === 'monthly'
          ? t('financePlan.schedule.monthly', { count: item.interval, day: start.getDate() })
          : t('financePlan.schedule.yearly', { count: item.interval, date: format(start, 'd MMMM', { locale }) });
  const parts = [base];
  if (item.spread) parts.push(t('financePlan.schedule.spread'));
  if (item.endDate) parts.push(t('financePlan.schedule.until', { date: format(parseDate(item.endDate), 'd MMM yyyy', { locale }) }));
  return parts.join(' · ');
}

function MoneyCell({ value, strong, muted, danger }: { value: number; strong?: boolean; muted?: boolean; danger?: boolean }) {
  return (
    <TableCell
      align="right"
      sx={{
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        fontWeight: strong ? 700 : 400,
        color: danger ? 'error.main' : muted || value === 0 ? 'text.secondary' : 'text.primary',
      }}
    >
      {value === 0 ? '—' : formatMoneyWhole(value)}
    </TableCell>
  );
}
