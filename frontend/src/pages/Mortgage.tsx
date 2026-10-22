import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import MortgageForm from '../components/MortgageForm';
import { FormField } from '../components/FormField';
import type { DebtsOutletContext } from './debts/DebtsLayout';
import { DateBadge, Row, RowIcon, Rows } from '../components/Row';
import { formatMoney, formatMoneyWhole } from '../formatMoney';
import { getDateFnsLocale } from '../i18n';
import {
  addMortgageEvent,
  deleteMortgage,
  deleteMortgageEvent,
  getMortgageSchedule,
  markMortgagePaidUntil,
  patchMortgage,
} from '../services/api';
import type {
  MortgageEvent,
  MortgageEventInput,
  MortgageEventKind,
  MortgageSchedule,
  MortgageScheduleRow,
  PrepaymentMode,
} from '../types/v2';

type Locale = ReturnType<typeof getDateFnsLocale>;

const parseDate = (value: string) => new Date(`${value}T00:00:00`);

type MortgageTab = '' | 'history' | 'settings';
const TABS: MortgageTab[] = ['', 'history', 'settings'];
type MortgageDialog = MortgageEventKind | 'markPaid' | null;

export default function Mortgage() {
  const { mortgageId, tab = '' } = useParams<{ mortgageId: string; tab: string }>();
  const navigate = useNavigate();
  const context = useOutletContext<DebtsOutletContext | undefined>();
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [data, setData] = useState<MortgageSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dialog, setDialog] = useState<MortgageDialog>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const load = () => {
    if (!mortgageId) return;
    getMortgageSchedule(mortgageId)
      .then(setData)
      .catch(() => setError(t('mortgage.page.loadError')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    setData(null);
    load();
  }, [mortgageId]);

  if (!mortgageId) return null;
  if (!TABS.includes(tab as MortgageTab)) return <Navigate to={`/mortgages/${mortgageId}`} replace />;
  if (loading) return <CircularProgress />;
  if (!data) return error ? <Alert severity="error">{error}</Alert> : null;

  const { mortgage, simulation, events } = data;
  const notify = (message: string) => {
    setDialog(null);
    setSuccess(message);
    load();
    context?.reloadDebts();
  };
  const paidShare = mortgage.principal > 0 ? Math.max(0, 1 - simulation.balance / mortgage.principal) : 0;
  const nextRow = simulation.rows.find((row) => row.kind === 'scheduled' && row.status === 'planned');
  const menuItem = (next: MortgageDialog, label: string) => (
    <MenuItem onClick={() => { setMenuAnchor(null); setDialog(next); }}>{label}</MenuItem>
  );
  const actions = (
    <>
      <Button variant="contained" onClick={() => setDialog('payment')}>{t('overview.payment')}</Button>
      <Button variant="outlined" onClick={() => setDialog('prepayment')}>{t('mortgage.page.prepay')}</Button>
    </>
  );

  return (
    <Stack spacing={2}>
      {!isDesktop && (
        <Box>
          <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/debts')} sx={{ ml: -1 }}>
            {t('nav.debts')}
          </Button>
        </Box>
      )}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      <Paper sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <RowIcon><HomeOutlinedIcon /></RowIcon>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h5" noWrap>{mortgage.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('mortgage.page.terms', {
                rate: simulation.rate,
                until: simulation.payoffDate ? format(parseDate(simulation.payoffDate), 'LLLL yyyy', { locale }) : '—',
              })}
            </Typography>
          </Box>
          {isDesktop && actions}
          <IconButton aria-label={t('debts.more')} onClick={(event) => setMenuAnchor(event.currentTarget)}>
            <MoreHorizRoundedIcon />
          </IconButton>
          <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
            {menuItem('reconciliation', t('mortgage.events.kinds.reconciliation'))}
            {menuItem('rate_change', t('mortgage.events.kinds.rate_change'))}
            {menuItem('markPaid', t('mortgage.markPaid.title'))}
            <MenuItem onClick={() => { setMenuAnchor(null); setDeleteOpen(true); }} sx={{ color: 'error.main' }}>{t('mortgage.settings.delete')}</MenuItem>
          </Menu>
        </Stack>

        {simulation.overdueAmount > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>{t('mortgage.page.overdue', { amount: formatMoney(simulation.overdueAmount) })}</Alert>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 2.5 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">{t('mortgage.page.balance')}</Typography>
            <Figure value={formatMoneyWhole(simulation.balance)} />
            <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'var(--surface-2)', overflow: 'hidden', mt: 1 }}>
              <Box sx={{ width: `${paidShare * 100}%`, height: '100%', bgcolor: 'success.main' }} />
            </Box>
            <Typography variant="caption" color="text.secondary">{t('mortgage.page.paidShare', { percent: (paidShare * 100).toFixed(1).replace('.', ',') })}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              {t('mortgage.page.nextPayment')}
              {simulation.nextPayment && ` · ${format(parseDate(simulation.nextPayment.date), 'd MMM', { locale })}`}
            </Typography>
            <Figure value={simulation.nextPayment ? formatMoney(simulation.nextPayment.amount) : t('mortgage.page.nextPaymentNone')} />
            {nextRow && nextRow.expected > 0 && (
              <>
                <Box sx={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', mt: 1 }}>
                  <Box sx={{ width: `${(nextRow.interest / nextRow.expected) * 100}%`, bgcolor: 'error.main', opacity: 0.8 }} />
                  <Box sx={{ flex: 1, bgcolor: 'success.main' }} />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {t('mortgage.page.split', { interest: formatMoneyWhole(nextRow.interest), principal: formatMoneyWhole(nextRow.principal) })}
                </Typography>
              </>
            )}
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">{t('mortgage.page.interestTitle')}</Typography>
            <Figure value={formatMoneyWhole(simulation.interestRemaining)} />
            <Typography variant="caption" color="text.secondary">{t('mortgage.page.interestPaidNote', { amount: formatMoneyWhole(simulation.interestPaid) })}</Typography>
          </Box>
        </Box>

        {!isDesktop && <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 2 }}>{actions}</Box>}
      </Paper>

      <Paper sx={{ px: 2.5, pb: 2.5 }}>
        <Tabs
          value={tab}
          onChange={(_, next: MortgageTab) => navigate(next ? `/mortgages/${mortgage.id}/${next}` : `/mortgages/${mortgage.id}`)}
          variant="scrollable"
          scrollButtons={false}
          sx={{ mb: 1.5 }}
        >
          <Tab value="" label={t('debts.tabs.schedule')} />
          <Tab value="history" label={t('debts.tabs.history')} />
          <Tab value="settings" label={t('mortgage.page.params')} />
        </Tabs>
        {tab === '' && <ScheduleByYear rows={simulation.rows} locale={locale} compact={!isDesktop} />}
        {tab === 'history' && (
          <EventHistory
            events={events}
            locale={locale}
            onDelete={(eventId) =>
              deleteMortgageEvent(mortgage.id, eventId)
                .then(() => notify(t('mortgage.events.deleted')))
                .catch(() => setError(t('mortgage.events.error')))
            }
          />
        )}
        {tab === 'settings' && (
          <Stack spacing={2}>
            <MortgageForm
              key={mortgage.id}
              initial={mortgage}
              submitLabel={t('mortgage.form.save')}
              onSubmit={(values) =>
                patchMortgage(mortgage.id, values).then(() => {
                  context?.reloadMortgages();
                  notify(t('mortgage.settings.saved'));
                })
              }
            />
            <Button color="error" variant="outlined" onClick={() => setDeleteOpen(true)} sx={{ alignSelf: 'flex-start' }}>
              {t('mortgage.settings.delete')}
            </Button>
          </Stack>
        )}
      </Paper>

      <Dialog open={dialog !== null} onClose={() => setDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {dialog === 'markPaid' ? t('mortgage.markPaid.title') : dialog === 'payment' ? t('overview.payment') : dialog ? t(`mortgage.events.kinds.${dialog}`) : ''}
          <Typography variant="body2" color="text.secondary">{mortgage.name}</Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {dialog === 'markPaid' && (
              <MarkPaidForm
                mortgageId={mortgage.id}
                rows={simulation.rows}
                locale={locale}
                onDone={(count) => notify(t('mortgage.markPaid.success', { count }))}
                onError={setError}
              />
            )}
            {dialog && dialog !== 'markPaid' && (
              <EventForm
                key={dialog}
                kind={dialog}
                mortgageId={mortgage.id}
                issueDate={mortgage.issueDate}
                suggestedPayment={simulation.nextPayment?.amount}
                locale={locale}
                onCreated={() => notify(t('mortgage.events.success'))}
                onError={setError}
              />
            )}
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>{t('mortgage.settings.deleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('mortgage.settings.deleteText')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>{t('mortgage.settings.cancel')}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() =>
              deleteMortgage(mortgage.id)
                .then(() => {
                  context?.reloadMortgages();
                  navigate('/debts', { replace: true });
                })
                .catch(() => {
                  setDeleteOpen(false);
                  setError(t('mortgage.settings.deleteError'));
                })
            }
          >
            {t('mortgage.settings.deleteConfirm')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(success)} autoHideDuration={3000} onClose={() => setSuccess('')}>
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>
    </Stack>
  );
}

function Figure({ value }: { value: string }) {
  return (
    <Typography sx={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      {value}
    </Typography>
  );
}

/** One mortgage event of the given kind: payment, prepayment, rate change or balance check. */
function EventForm({
  kind,
  mortgageId,
  issueDate,
  suggestedPayment,
  locale,
  onCreated,
  onError,
}: {
  kind: MortgageEventKind;
  mortgageId: string;
  issueDate: string;
  suggestedPayment?: number;
  locale: Locale;
  onCreated: () => void;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [date, setDate] = useState<Date | null>(new Date());
  const [value, setValue] = useState(suggestedPayment ? String(suggestedPayment) : '');
  const [mode, setMode] = useState<PrepaymentMode | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A regular payment is the usual case, so keep its field filled with the next scheduled amount.
  useEffect(() => {
    if (kind === 'payment') setValue(suggestedPayment ? String(suggestedPayment) : '');
  }, [kind, suggestedPayment]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    const eventDate = format(date, 'yyyy-MM-dd');
    if (eventDate <= issueDate) {
      onError(t('mortgage.events.dateError'));
      return;
    }
    const number = Number(value);
    let event: MortgageEventInput;
    if (kind === 'payment') event = { kind, eventDate, amount: number };
    else if (kind === 'prepayment') {
      if (!mode) return;
      event = { kind, eventDate, amount: number, prepaymentMode: mode };
    } else if (kind === 'rate_change') event = { kind, eventDate, newRate: number };
    else event = { kind, eventDate, actualBalance: number };

    setSubmitting(true);
    addMortgageEvent(mortgageId, event)
      .then(() => {
        setValue(kind === 'payment' && suggestedPayment ? String(suggestedPayment) : '');
        setMode(null);
        onCreated();
      })
      .catch(() => onError(t('mortgage.events.error')))
      .finally(() => setSubmitting(false));
  };

  const valueLabel =
    kind === 'rate_change'
      ? t('mortgage.events.newRate')
      : kind === 'reconciliation'
        ? t('mortgage.events.actualBalance')
        : t('mortgage.events.amount');

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={2}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 1.5 }}>
          <FormField label={t('mortgage.events.date')}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={locale}>
              <DatePicker value={date} onChange={setDate} slotProps={{ textField: { fullWidth: true } }} />
            </LocalizationProvider>
          </FormField>
          <FormField label={valueLabel}>
            <TextField
              fullWidth
              type="number"
              inputProps={{ min: 0, step: 0.01, 'aria-label': valueLabel }}
              value={value}
              placeholder={kind === 'payment' && suggestedPayment ? String(suggestedPayment) : ''}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </FormField>
        </Box>
        {kind === 'prepayment' && (
          <FormField label={t('mortgage.events.mode')}>
            <ToggleButtonGroup
              exclusive
              value={mode}
              onChange={(_, next: PrepaymentMode | null) => next && setMode(next)}
              aria-label={t('mortgage.events.mode')}
            >
              <ToggleButton value="reduce_term">{t('mortgage.events.modes.reduce_term')}</ToggleButton>
              <ToggleButton value="reduce_payment">{t('mortgage.events.modes.reduce_payment')}</ToggleButton>
            </ToggleButtonGroup>
          </FormField>
        )}
        <Typography variant="body2" color="text.secondary">
          {t(`mortgage.events.hints.${kind}`)}
        </Typography>
        <Button
          type="submit"
          variant="contained"
          disabled={submitting || !value || (kind === 'prepayment' && !mode)}
          fullWidth
        >
          {t('mortgage.events.submit')}
        </Button>
      </Stack>
    </Box>
  );
}

function MarkPaidForm({
  mortgageId,
  rows,
  locale,
  onDone,
  onError,
}: {
  mortgageId: string;
  rows: MortgageScheduleRow[];
  locale: Locale;
  onDone: (count: number) => void;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [until, setUntil] = useState<Date | null>(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const untilDate = until ? format(until, 'yyyy-MM-dd') : '';
  const pending = rows.filter((row) => row.kind === 'scheduled' && row.status !== 'paid' && row.date <= untilDate);
  const pendingTotal = pending.reduce((sum, row) => sum + row.expected, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!until) return;
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    setConfirmOpen(false);
    setSubmitting(true);
    markMortgagePaidUntil(mortgageId, untilDate)
      .then((result) => onDone(result.created))
      .catch(() => onError(t('mortgage.markPaid.error')))
      .finally(() => setSubmitting(false));
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          {t('mortgage.markPaid.subtitle')}
        </Typography>
        <FormField label={t('mortgage.markPaid.until')}>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={locale}>
            <DatePicker value={until} onChange={setUntil} slotProps={{ textField: { fullWidth: true } }} />
          </LocalizationProvider>
        </FormField>
        <Button type="submit" variant="contained" disabled={submitting} fullWidth>
          {t('mortgage.markPaid.submit')}
        </Button>
      </Stack>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>{t('mortgage.markPaid.confirmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pending.length > 0
              ? t('mortgage.markPaid.confirmText', {
                  count: pending.length,
                  amount: formatMoney(pendingTotal),
                  date: format(parseDate(untilDate), 'd MMMM yyyy', { locale }),
                })
              : t('mortgage.markPaid.nothing')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>{t('mortgage.settings.cancel')}</Button>
          {pending.length > 0 && (
            <Button variant="contained" onClick={handleConfirm}>
              {t('mortgage.markPaid.confirm')}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/** Schedule of one year at a time; years are picked with chips, the current one first. */
function ScheduleByYear({ rows, locale, compact }: { rows: MortgageScheduleRow[]; locale: Locale; compact: boolean }) {
  const { t } = useTranslation();
  const years = useMemo(() => {
    const byYear = new Map<number, MortgageScheduleRow[]>();
    for (const row of rows) {
      const year = Number(row.date.slice(0, 4));
      byYear.set(year, [...(byYear.get(year) ?? []), row]);
    }
    return byYear;
  }, [rows]);
  const allYears = Array.from(years.keys());
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(() => (years.has(currentYear) ? currentYear : allYears[0]));
  const yearRows = years.get(year) ?? [];
  const scheduled = yearRows.filter((row) => row.kind === 'scheduled');

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={0.75} sx={{ overflowX: 'auto', pb: 0.5 }}>
        {allYears.map((item) => (
          <Chip
            key={item}
            label={item}
            onClick={() => setYear(item)}
            color={item === year ? 'primary' : 'default'}
            variant={item === year ? 'filled' : 'outlined'}
            icon={years.get(item)?.some((row) => row.status === 'overdue') ? <ErrorOutlineRoundedIcon /> : undefined}
          />
        ))}
      </Stack>
      {yearRows.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {t('mortgage.schedule.yearSummary', {
            count: scheduled.length,
            interest: formatMoney(yearRows.reduce((sum, row) => sum + row.interest, 0)),
            principal: formatMoney(yearRows.reduce((sum, row) => sum + row.principal, 0)),
            balance: formatMoney(yearRows[yearRows.length - 1].balanceAfter),
          })}
        </Typography>
      )}
      {compact ? (
        <Rows>
          {yearRows.map((row, index) => (
            <ScheduleLine key={`${row.date}-${row.kind}-${index}`} row={row} />
          ))}
        </Rows>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ '& th': { whiteSpace: 'nowrap' } }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('mortgage.schedule.date')}</TableCell>
                <TableCell>{t('mortgage.schedule.operation')}</TableCell>
                <TableCell align="right">{t('mortgage.schedule.payment')}</TableCell>
                <TableCell align="right">{t('mortgage.schedule.interest')}</TableCell>
                <TableCell align="right">{t('mortgage.schedule.principal')}</TableCell>
                <TableCell align="right">{t('mortgage.schedule.balance')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {yearRows.map((row, index) => (
                <ScheduleRow key={`${row.date}-${row.kind}-${index}`} row={row} locale={locale} />
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Stack>
  );
}

/** Phone version of a schedule row. */
function ScheduleLine({ row }: { row: MortgageScheduleRow }) {
  const { t } = useTranslation();
  const amount = row.kind === 'scheduled' && row.status === 'overdue' ? row.expected : row.payment;
  const title =
    row.kind === 'scheduled'
      ? formatMoney(amount)
      : row.kind === 'rate_change'
        ? t('mortgage.schedule.kinds.rate_change', { rate: row.rate })
        : `${t(`mortgage.schedule.kinds.${row.kind}`)}${row.kind === 'prepayment' ? ` · ${formatMoney(amount)}` : ''}`;
  return (
    <Row
      leading={<DateBadge date={row.date} />}
      title={title}
      meta={t('mortgage.schedule.balanceAfter', { amount: formatMoney(row.balanceAfter) })}
      trailing={
        row.kind === 'scheduled' ? (
          <Chip
            size="small"
            variant={row.status === 'planned' ? 'outlined' : 'filled'}
            color={row.status === 'paid' ? 'success' : row.status === 'overdue' ? 'warning' : 'default'}
            label={t(`mortgage.schedule.statuses.${row.status}`)}
          />
        ) : undefined
      }
    />
  );
}

function ScheduleRow({ row, locale }: { row: MortgageScheduleRow; locale: Locale }) {
  const { t } = useTranslation();
  const label =
    row.kind === 'scheduled'
      ? t('mortgage.schedule.kinds.scheduled', { number: row.number })
      : row.kind === 'rate_change'
        ? t('mortgage.schedule.kinds.rate_change', { rate: row.rate })
        : t(`mortgage.schedule.kinds.${row.kind}`);
  const detail =
    row.kind === 'prepayment' && row.mode
      ? t(`mortgage.schedule.modes.${row.mode}`)
      : row.kind === 'reconciliation' && row.difference !== undefined
        ? t('mortgage.schedule.difference', { amount: formatMoney(row.difference) })
        : row.kind === 'scheduled' && row.status === 'paid' && Math.abs(row.payment - row.expected) >= 0.01
          ? t('mortgage.schedule.expected', { amount: formatMoney(row.expected) })
          : null;
  const muted = row.status === 'planned';
  const numeric = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: muted ? 'text.secondary' : undefined };
  const shown = row.kind === 'scheduled' && row.status === 'overdue' ? row.expected : row.payment;

  return (
    <TableRow>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{format(parseDate(row.date), 'd MMM', { locale })}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2">{label}</Typography>
          {row.kind === 'scheduled' && (
            <Chip
              size="small"
              variant={row.status === 'planned' ? 'outlined' : 'filled'}
              color={row.status === 'paid' ? 'success' : row.status === 'overdue' ? 'warning' : 'default'}
              label={t(`mortgage.schedule.statuses.${row.status}`)}
            />
          )}
        </Stack>
        {detail && (
          <Typography variant="caption" color="text.secondary">
            {detail}
          </Typography>
        )}
      </TableCell>
      <TableCell align="right" sx={numeric}>{row.kind === 'rate_change' || row.kind === 'reconciliation' ? '' : formatMoney(shown)}</TableCell>
      <TableCell align="right" sx={numeric}>{row.interest ? formatMoney(row.interest) : ''}</TableCell>
      <TableCell align="right" sx={numeric}>{row.principal ? formatMoney(row.principal) : ''}</TableCell>
      <TableCell align="right" sx={numeric}>{formatMoney(row.balanceAfter)}</TableCell>
    </TableRow>
  );
}

function EventHistory({
  events,
  locale,
  onDelete,
}: {
  events: MortgageEvent[];
  locale: Locale;
  onDelete: (eventId: string) => void;
}) {
  const { t } = useTranslation();
  const sorted = [...events].sort((a, b) => b.eventDate.localeCompare(a.eventDate) || b.createdAt.localeCompare(a.createdAt));
  const describe = (event: MortgageEvent) => {
    if (event.kind === 'rate_change') return `${event.newRate}%`;
    if (event.kind === 'reconciliation') return formatMoney(event.actualBalance ?? 0);
    const amount = formatMoney(event.amount ?? 0);
    return event.kind === 'prepayment' && event.prepaymentMode
      ? `${amount} · ${t(`mortgage.schedule.modes.${event.prepaymentMode}`)}`
      : amount;
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle1">{t('mortgage.events.historyTitle')}</Typography>
        <Typography color="text.secondary">{t('mortgage.events.historySubtitle')}</Typography>
      </Box>
      {sorted.length === 0 ? (
        <Typography color="text.secondary">{t('mortgage.events.historyEmpty')}</Typography>
      ) : (
        <Box sx={{ overflow: 'auto', maxHeight: 'min(50vh, 480px)' }}>
          <Table size="small">
            <TableBody>
              {sorted.map((event) => (
                <TableRow key={event.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{format(parseDate(event.eventDate), 'd MMM yyyy', { locale })}</TableCell>
                  <TableCell>{t(`mortgage.events.kinds.${event.kind}`)}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{describe(event)}</TableCell>
                  <TableCell align="right" sx={{ width: 48 }}>
                    <Tooltip title={t('mortgage.events.delete')}>
                      <IconButton size="small" aria-label={t('mortgage.events.delete')} onClick={() => onDelete(event.id)}>
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Stack>
  );
}
