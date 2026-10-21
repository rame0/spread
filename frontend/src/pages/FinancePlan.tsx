import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Link,
  Paper,
  Snackbar,
  Stack,
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
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { format } from 'date-fns';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import NetWorthChart from '../components/NetWorthChart';
import PlanItemForm from '../components/PlanItemForm';
import { formatCurrency, formatMoney } from '../formatMoney';
import { getDateFnsLocale } from '../i18n';
import { createPlanItem, deletePlanItem, getAccounts, getCards, getForecast, getPlanItems, patchPlanItem } from '../services/api';
import type { Account, Card, ForecastResult, PlanItem, PlanItemKind } from '../types/v2';

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

export default function FinancePlan() {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [horizon, setHorizon] = useState(() => Number(readStored(HORIZON_KEY)) || 12);
  const [threshold, setThreshold] = useState(() => readStored(THRESHOLD_KEY) ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialog, setDialog] = useState<{ item?: PlanItem; kind?: PlanItemKind } | null>(null);

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

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5">{t('financePlan.title')}</Typography>
        <Typography color="text.secondary">{t('financePlan.subtitle')}</Typography>
      </Box>
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
            <Typography variant="h6">{t('financePlan.itemsTitle')}</Typography>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setDialog({})}>
              {t('financePlan.add')}
            </Button>
          </Stack>
          {items.length === 0 ? (
            <Typography color="text.secondary">{t('financePlan.empty')}</Typography>
          ) : (
            (['income', 'expense', 'transfer'] as PlanItemKind[]).map((kind) => {
              const group = items.filter((item) => item.kind === kind);
              if (group.length === 0) return null;
              return (
                <Box key={kind}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                    {t(`financePlan.groups.${kind}`)}
                  </Typography>
                  {group.map((item) => (
                    <Stack
                      key={item.id}
                      direction="row"
                      spacing={2}
                      alignItems="center"
                      sx={{ py: 1, borderTop: '1px solid', borderColor: 'divider', cursor: 'pointer' }}
                      onClick={() => setDialog({ item })}
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography fontWeight={600}>{item.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {describeSchedule(item, t, locale)}
                          {item.cardId && ` · ${cards.find((card) => card.id === item.cardId)?.name ?? ''}`}
                          {item.targetAccountId && ` · → ${accounts.find((account) => account.id === item.targetAccountId)?.name ?? ''}`}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums', color: kind === 'income' ? 'success.main' : 'text.primary' }}>
                          {formatCurrency(item.amount, item.currency)}
                        </Typography>
                        {item.frequency !== 'once' && item.monthlyAmount !== item.amount && (
                          <Typography variant="caption" color="text.secondary">
                            {t('financePlan.perMonth', { amount: formatCurrency(item.monthlyAmount, item.currency) })}
                          </Typography>
                        )}
                      </Box>
                      <Tooltip title={t('financePlan.delete')}>
                        <IconButton
                          size="small"
                          aria-label={t('financePlan.delete')}
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePlanItem(item.id)
                              .then(() => notify(t('financePlan.deleted')))
                              .catch(() => setError(t('financePlan.form.error')));
                          }}
                        >
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ))}
                </Box>
              );
            })
          )}
          {items.length > 0 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' }, gap: 2, pt: 1 }}>
              <Figure title={t('financePlan.summary.income')} value={formatMoney(rubMonthly('income'))} />
              <Figure title={t('financePlan.summary.expense')} value={formatMoney(rubMonthly('expense'))} />
              <Figure title={t('financePlan.summary.transfer')} value={formatMoney(rubMonthly('transfer'))} />
              <Figure title={t('financePlan.summary.left')} value={formatMoney(leftPerMonth)} tone={leftPerMonth < 0 ? 'danger' : 'default'} />
            </Box>
          )}
          {items.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {hasForeign ? t('financePlan.summary.hintForeign') : t('financePlan.summary.hint')}
            </Typography>
          )}
        </Stack>
      </Paper>

      {forecast && (
        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
              <Box>
                <Typography variant="h6">{t('financePlan.forecastTitle')}</Typography>
                <Typography color="text.secondary">{t('financePlan.forecastSubtitle')}</Typography>
              </Box>
              <ToggleButtonGroup value={horizon} exclusive size="small" onChange={(_, value: number | null) => value && changeHorizon(value)}>
                {HORIZONS.map((months) => (
                  <ToggleButton key={months} value={months}>
                    {t('financePlan.horizon', { count: months })}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Stack>
            {forecast.missingRates.length > 0 && <Alert severity="warning">{t('financePlan.missingRates', { currencies: forecast.missingRates.join(', ') })}</Alert>}
            {firstBelow ? (
              <Alert severity={firstBelow.liquid < 0 ? 'error' : 'warning'}>
                {t(limit > 0 ? 'financePlan.belowThreshold' : 'financePlan.belowZero', {
                  date: format(parseDate(firstBelow.date), 'd MMMM yyyy', { locale }),
                  min: formatMoney(forecast.minLiquid.amount),
                  minDate: format(parseDate(forecast.minLiquid.date), 'd MMMM yyyy', { locale }),
                })}
              </Alert>
            ) : (
              <Alert severity="success">
                {t('financePlan.enough', { min: formatMoney(forecast.minLiquid.amount), date: format(parseDate(forecast.minLiquid.date), 'd MMMM yyyy', { locale }) })}
              </Alert>
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' }, gap: 2 }}>
              <Figure title={t('financePlan.liquidNow')} value={formatMoney(forecast.start.liquid)} />
              <Figure title={t('financePlan.liquidThen', { date: format(parseDate(forecast.until), 'd MMM yyyy', { locale }) })} value={formatMoney(forecast.daily.at(-1)?.liquid ?? 0)} />
              <Figure title={t('financePlan.netWorthNow')} value={formatMoney(forecast.start.netWorth)} />
              <Figure title={t('financePlan.netWorthThen')} value={formatMoney(forecast.daily.at(-1)?.netWorth ?? 0)} />
            </Box>
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
              helperText={t('financePlan.thresholdHelp')}
              sx={{ maxWidth: 320 }}
            />
            <Box sx={{ mx: { xs: -2, sm: -3 } }}>
              <NetWorthChart
                data={forecast.daily}
                formatValue={formatMoney}
                threshold={limit > 0 ? { value: limit, label: t('financePlan.thresholdLine') } : undefined}
                series={[
                  { key: 'liquid', label: t('financePlan.liquid'), color: 'var(--accent)' },
                  { key: 'netWorth', label: t('netWorth.netWorth'), color: 'var(--status-ok)' },
                ]}
              />
            </Box>
          </Stack>
        </Paper>
      )}

      {forecast && (
        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={2}>
            <Typography variant="h6">{t('financePlan.monthsTitle')}</Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
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
                    <TableCell align="right">{t('financePlan.table.netWorthEnd')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {forecast.months.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{format(parseDate(`${row.month}-01`), 'LLLL yyyy', { locale })}</TableCell>
                      <MoneyCell value={row.income} />
                      <MoneyCell value={row.expenses} />
                      <MoneyCell value={row.cardSpending} muted />
                      <MoneyCell value={row.debtPayments} />
                      <MoneyCell value={row.transfers} />
                      <MoneyCell value={row.interest} />
                      <MoneyCell value={row.liquidEnd} strong danger={row.liquidEnd < limit} />
                      <MoneyCell value={row.netWorthEnd} />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t('financePlan.monthsHint')}
            </Typography>
          </Stack>
        </Paper>
      )}

      {forecast && (
        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">{t('financePlan.factTitle')}</Typography>
              <Typography color="text.secondary">{t('financePlan.factSubtitle')}</Typography>
            </Box>
            <Box sx={{ overflowX: 'auto' }}>
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
                  {[...forecast.planVsFact].reverse().map((row) => (
                    <TableRow key={row.to}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {format(parseDate(`${row.month}-01`), 'LLLL yyyy', { locale })}
                        {row.to.slice(0, 7) === forecast.today.slice(0, 7) && (
                          <Typography component="span" variant="caption" color="text.secondary">
                            {' '}
                            {t('financePlan.fact.toDate', { date: format(parseDate(row.to), 'd MMM', { locale }) })}
                          </Typography>
                        )}
                      </TableCell>
                      <MoneyCell value={row.plan} />
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: row.fact === null ? 'text.secondary' : 'text.primary' }}>
                        {row.fact === null ? t('financePlan.fact.noBalances') : formatMoney(row.fact)}
                        {row.fact !== null && row.estimated && (
                          <Tooltip title={t('financePlan.fact.estimated')}>
                            <Typography component="span" color="warning.main">
                              {' '}
                              *
                            </Typography>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontVariantNumeric: 'tabular-nums',
                          color: row.difference === null || row.difference === 0 ? 'text.secondary' : row.difference > 0 ? 'success.main' : 'error.main',
                        }}
                      >
                        {row.difference === null ? '—' : `${row.difference > 0 ? '+' : ''}${formatMoney(row.difference)}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t('financePlan.factHint')}{' '}
              <Link component={RouterLink} to="/accounts">
                {t('financePlan.factHintLink')}
              </Link>
            </Typography>
          </Stack>
        </Paper>
      )}

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
        <Alert severity="success" onClose={() => setSuccess('')}>
          {success}
        </Alert>
      </Snackbar>
    </Stack>
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
      {value === 0 ? '—' : formatMoney(value)}
    </TableCell>
  );
}

function Figure({ title, value, tone = 'default' }: { title: string; value: string; tone?: 'default' | 'danger' }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
      <Typography sx={{ fontSize: { xs: '1.15rem', md: '1.35rem' }, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: tone === 'danger' ? 'error.main' : 'text.primary' }}>
        {value}
      </Typography>
    </Box>
  );
}
