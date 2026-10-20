import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
  MenuItem,
  Paper,
  Select,
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
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import MortgageForm from '../components/MortgageForm';
import { FormField } from '../components/FormField';
import type { CardsOutletContext } from '../cardContext';
import { formatMoney } from '../formatMoney';
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

const EVENT_KINDS: MortgageEventKind[] = ['payment', 'prepayment', 'rate_change', 'reconciliation'];

const parseDate = (value: string) => new Date(`${value}T00:00:00`);

export default function Mortgage() {
  const { mortgageId } = useParams<{ mortgageId: string }>();
  const navigate = useNavigate();
  const context = useOutletContext<CardsOutletContext | undefined>();
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [data, setData] = useState<MortgageSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

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
  if (loading) return <CircularProgress />;
  if (!data) return error ? <Alert severity="error">{error}</Alert> : null;

  const { mortgage, simulation, events } = data;
  const notify = (message: string) => {
    setSuccess(message);
    load();
  };

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h5">{mortgage.name}</Typography>
        <Typography color="text.secondary">
          {t('mortgage.page.subtitle', {
            rate: simulation.rate,
            payment: formatMoney(simulation.currentPayment),
            date: format(parseDate(mortgage.issueDate), 'd MMMM yyyy', { locale }),
          })}
        </Typography>
      </Stack>
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {simulation.overdueAmount > 0 && (
        <Alert severity="warning">{t('mortgage.page.overdue', { amount: formatMoney(simulation.overdueAmount) })}</Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 3 }}>
        <Stat title={t('mortgage.page.balance')} value={formatMoney(simulation.balance)} hint={t('mortgage.page.balanceHint')} accent />
        <Stat
          title={t('mortgage.page.nextPayment')}
          value={simulation.nextPayment ? formatMoney(simulation.nextPayment.amount) : t('mortgage.page.nextPaymentNone')}
          hint={simulation.nextPayment ? format(parseDate(simulation.nextPayment.date), 'd MMMM yyyy', { locale }) : ''}
        />
        <Stat
          title={t('mortgage.page.payoff')}
          value={simulation.payoffDate ? format(parseDate(simulation.payoffDate), 'LLLL yyyy', { locale }) : '—'}
          hint={t('mortgage.page.payoffHint')}
        />
        <Stat
          title={t('mortgage.page.interest')}
          value={t('mortgage.page.interestValue', { paid: formatMoney(simulation.interestPaid) })}
          hint={t('mortgage.page.interestRemaining', { amount: formatMoney(simulation.interestRemaining) })}
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, gap: 3 }}>
        <Paper sx={{ p: 3 }}>
          <EventForm
            mortgageId={mortgage.id}
            issueDate={mortgage.issueDate}
            suggestedPayment={simulation.nextPayment?.amount}
            locale={locale}
            onCreated={() => notify(t('mortgage.events.success'))}
            onError={setError}
          />
        </Paper>
        <Paper sx={{ p: 3 }}>
          <MarkPaidForm
            mortgageId={mortgage.id}
            locale={locale}
            onDone={(count) => notify(t('mortgage.markPaid.success', { count }))}
            onError={setError}
          />
        </Paper>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">{t('mortgage.schedule.title')}</Typography>
            <Typography color="text.secondary">{t('mortgage.schedule.subtitle')}</Typography>
          </Box>
          <ScheduleByYear rows={simulation.rows} locale={locale} />
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <EventHistory
          events={events}
          locale={locale}
          onDelete={(eventId) =>
            deleteMortgageEvent(mortgage.id, eventId)
              .then(() => notify(t('mortgage.events.deleted')))
              .catch(() => setError(t('mortgage.events.error')))
          }
        />
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">{t('mortgage.settings.title')}</Typography>
            <Typography color="text.secondary">{t('mortgage.settings.subtitle')}</Typography>
          </Box>
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
      </Paper>

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
                  navigate('/', { replace: true });
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

      <Snackbar
        open={Boolean(success)}
        autoHideDuration={3000}
        onClose={() => setSuccess('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>
    </Stack>
  );
}

function Stat({ title, value, hint, accent = false }: { title: string; value: string; hint: string; accent?: boolean }) {
  return (
    <Paper
      sx={{
        p: 3,
        minHeight: 160,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 1.5,
        bgcolor: accent ? 'color-mix(in srgb, var(--accent) 8%, var(--surface))' : 'background.paper',
      }}
    >
      <Typography color="text.secondary">{title}</Typography>
      <Typography sx={{ fontSize: { xs: '1.5rem', md: '1.75rem' }, fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {hint}
      </Typography>
    </Paper>
  );
}

function EventForm({
  mortgageId,
  issueDate,
  suggestedPayment,
  locale,
  onCreated,
  onError,
}: {
  mortgageId: string;
  issueDate: string;
  suggestedPayment?: number;
  locale: Locale;
  onCreated: () => void;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<MortgageEventKind>('payment');
  const [date, setDate] = useState<Date | null>(new Date());
  const [value, setValue] = useState('');
  const [mode, setMode] = useState<PrepaymentMode | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        setValue('');
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
        <Typography variant="h6">{t('mortgage.events.title')}</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2 }}>
          <FormField label={t('mortgage.events.kind')}>
            <Select
              fullWidth
              value={kind}
              inputProps={{ 'aria-label': t('mortgage.events.kind') }}
              onChange={(e) => {
                const next = e.target.value as MortgageEventKind;
                setKind(next);
                setValue(next === 'payment' && suggestedPayment ? String(suggestedPayment) : '');
              }}
            >
              {EVENT_KINDS.map((item) => (
                <MenuItem key={item} value={item}>{t(`mortgage.events.kinds.${item}`)}</MenuItem>
              ))}
            </Select>
          </FormField>
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
          sx={{ alignSelf: 'flex-start' }}
        >
          {t('mortgage.events.submit')}
        </Button>
      </Stack>
    </Box>
  );
}

function MarkPaidForm({
  mortgageId,
  locale,
  onDone,
  onError,
}: {
  mortgageId: string;
  locale: Locale;
  onDone: (count: number) => void;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [until, setUntil] = useState<Date | null>(new Date());
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!until) return;
    setSubmitting(true);
    markMortgagePaidUntil(mortgageId, format(until, 'yyyy-MM-dd'))
      .then((result) => onDone(result.created))
      .catch(() => onError(t('mortgage.markPaid.error')))
      .finally(() => setSubmitting(false));
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={2}>
        <Typography variant="h6">{t('mortgage.markPaid.title')}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t('mortgage.markPaid.subtitle')}
        </Typography>
        <FormField label={t('mortgage.markPaid.until')}>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={locale}>
            <DatePicker value={until} onChange={setUntil} slotProps={{ textField: { fullWidth: true } }} />
          </LocalizationProvider>
        </FormField>
        <Button type="submit" variant="outlined" disabled={submitting} sx={{ alignSelf: 'flex-start' }}>
          {t('mortgage.markPaid.submit')}
        </Button>
      </Stack>
    </Box>
  );
}

function ScheduleByYear({ rows, locale }: { rows: MortgageScheduleRow[]; locale: Locale }) {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const byYear = new Map<number, MortgageScheduleRow[]>();
    for (const row of rows) {
      const year = Number(row.date.slice(0, 4));
      byYear.set(year, [...(byYear.get(year) ?? []), row]);
    }
    return Array.from(byYear.entries());
  }, [rows]);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([currentYear]));

  const toggle = (year: number) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });

  return (
    <Box>
      {years.map(([year, yearRows]) => {
        const scheduled = yearRows.filter((row) => row.kind === 'scheduled');
        const hasOverdue = yearRows.some((row) => row.status === 'overdue');
        return (
          <Accordion
            key={year}
            disableGutters
            expanded={expanded.has(year)}
            onChange={() => toggle(year)}
            TransitionProps={{ unmountOnExit: true }}
            sx={{ bgcolor: 'transparent', boxShadow: 'none', '&:before': { display: 'none' }, borderTop: '1px solid', borderColor: 'divider' }}
          >
            <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 0.5, md: 2 }} alignItems={{ md: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, minWidth: 56 }}>
                  {year}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {t('mortgage.schedule.yearSummary', {
                    count: scheduled.length,
                    interest: formatMoney(yearRows.reduce((sum, row) => sum + row.interest, 0)),
                    principal: formatMoney(yearRows.reduce((sum, row) => sum + row.principal, 0)),
                    balance: formatMoney(yearRows[yearRows.length - 1].balanceAfter),
                  })}
                </Typography>
                {hasOverdue && <Chip size="small" color="warning" label={t('mortgage.schedule.statuses.overdue')} />}
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0 }}>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
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
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
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
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{format(parseDate(row.date), 'd MMM yyyy', { locale })}</TableCell>
      <TableCell sx={{ minWidth: 180 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
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
        <Typography variant="h6">{t('mortgage.events.historyTitle')}</Typography>
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
