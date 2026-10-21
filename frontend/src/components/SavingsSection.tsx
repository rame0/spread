import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../formatMoney';
import { getDateFnsLocale } from '../i18n';
import { createAccountEvent, deleteAccountEvent } from '../services/api';
import type { Account, AccountEvent, AccountEventKind, SavingsSummary } from '../types/v2';
import { formatAxisAmount } from './ActivityAreaChart';
import { FormField, LabeledTextField } from './FormField';

const parseDate = (value: string) => new Date(`${value}T00:00:00`);
const formatRate = (rate: number) => `${rate.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%`;

type SavingsSectionProps = {
  account: Account;
  summary: SavingsSummary;
  onChanged: (message: string) => void;
  onError: (message: string) => void;
};

/** Calculated balance, income and forecast of a savings account, with its operations and rates. */
export default function SavingsSection({ account, summary, onChanged, onError }: SavingsSectionProps) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const { savings, terms } = summary;
  const money = (value: number) => formatCurrency(value, account.currency);

  if (!savings || !terms) {
    return <Alert severity="info">{t('savings.disabled')}</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">{t('savings.title')}</Typography>
            <Typography color="text.secondary">{t(`accounts.interestModeHelp.${terms.mode}`)}</Typography>
          </Box>
          {(savings.rate === null || savings.daysWithoutRate > 0) && (
            <Alert severity="warning">{savings.rate === null ? t('savings.noRate') : t('savings.daysWithoutRate', { count: savings.daysWithoutRate })}</Alert>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' }, gap: 2 }}>
            <Figure title={t('savings.balance')} value={money(savings.balance)} />
            <Figure title={t('savings.rate')} value={savings.rate === null ? '—' : formatRate(savings.rate)} />
            <Figure
              title={terms.mode === 'daily' ? t('savings.accruedDaily') : t('savings.accrued')}
              value={money(savings.accrued)}
            />
            <Figure title={t('savings.incomeThisYear')} value={money(savings.incomeThisYear)} />
          </Box>
          <Box>
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              {t('savings.forecast')}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 2 }}>
              {savings.forecast.map((point) => (
                <Box key={point.months}>
                  <Typography variant="body2" color="text.secondary">
                    {t('savings.forecastIn', { count: point.months, date: format(parseDate(point.date), 'd MMM yyyy', { locale }) })}
                  </Typography>
                  <Typography fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {money(point.balance)}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t('savings.forecastHint')}
            </Typography>
          </Box>
          {savings.incomeByMonth.some((row) => row.amount > 0) && (
            <Box>
              <Typography color="text.secondary">{t('savings.incomeByMonth')}</Typography>
              <Box sx={{ height: 220, mx: -2 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={savings.incomeByMonth} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                      tickFormatter={(value) => format(parseDate(`${value}-01`), 'LLL', { locale })}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={56}
                      tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                      tickFormatter={(value) => formatAxisAmount(Number(value), i18n.language)}
                    />
                    <ChartTooltip
                      cursor={{ fill: 'var(--border)', opacity: 0.4 }}
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <Paper sx={{ px: 1.5, py: 1 }}>
                            <Typography variant="caption" color="text.secondary" display="block">
                              {format(parseDate(`${label}-01`), 'LLLL yyyy', { locale })}
                            </Typography>
                            <Typography variant="body2" fontWeight={700}>
                              {money(Number(payload[0].value))}
                            </Typography>
                          </Paper>
                        ) : null
                      }
                    />
                    <Bar dataKey="amount" fill="var(--status-ok)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">{t('savings.eventsTitle')}</Typography>
            <Typography color="text.secondary">{t('savings.eventsHint')}</Typography>
          </Box>
          <EventForm account={account} onSaved={() => onChanged(t('savings.eventSaved'))} onError={() => onError(t('savings.eventError'))} />
          {summary.events.length > 0 && (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('accounts.page.date')}</TableCell>
                    <TableCell>{t('savings.eventKind')}</TableCell>
                    <TableCell align="right">{t('savings.eventValue')}</TableCell>
                    <TableCell>{t('accounts.page.note')}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...summary.events].reverse().map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{format(parseDate(event.eventDate), 'd MMMM yyyy', { locale })}</TableCell>
                      <TableCell>{t(`savings.kinds.${event.kind}`)}</TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontVariantNumeric: 'tabular-nums', color: event.kind === 'top_up' ? 'success.main' : event.kind === 'withdrawal' ? 'error.main' : 'text.primary' }}
                      >
                        {eventValue(event, money)}
                      </TableCell>
                      <TableCell>{event.note}</TableCell>
                      <TableCell align="right">
                        <Tooltip title={t('savings.deleteEvent')}>
                          <IconButton
                            size="small"
                            aria-label={t('savings.deleteEvent')}
                            onClick={() =>
                              deleteAccountEvent(account.id, event.id)
                                .then(() => onChanged(t('savings.eventDeleted')))
                                .catch(() => onError(t('savings.eventError')))
                            }
                          >
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
      </Paper>
    </Stack>
  );
}

function eventValue(event: AccountEvent, money: (value: number) => string) {
  if (event.kind === 'rate_change') return event.rate === null ? '—' : formatRate(event.rate);
  const amount = event.amount ?? 0;
  return `${event.kind === 'top_up' ? '+' : '−'}${money(amount)}`;
}

function EventForm({ account, onSaved, onError }: { account: Account; onSaved: () => void; onError: () => void }) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [kind, setKind] = useState<AccountEventKind>('top_up');
  const [eventDate, setEventDate] = useState<Date | null>(new Date());
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const number = Number(value.replace(',', '.'));
    const valid = eventDate && value.trim() !== '' && Number.isFinite(number) && (kind === 'rate_change' ? number >= 0 && number <= 100 : number > 0);
    setInvalid(!valid);
    if (!valid) return;
    const date = format(eventDate, 'yyyy-MM-dd');
    const trimmedNote = note.trim() || null;
    setSaving(true);
    createAccountEvent(
      account.id,
      kind === 'rate_change' ? { kind, eventDate: date, rate: number, note: trimmedNote } : { kind, eventDate: date, amount: number, note: trimmedNote }
    )
      .then(() => {
        setValue('');
        setNote('');
        onSaved();
      })
      .catch(onError)
      .finally(() => setSaving(false));
  };

  return (
    <Stack component="form" spacing={2} onSubmit={submit}>
      {invalid && <Alert severity="error">{t('savings.eventValidation')}</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 2 }}>
        <LabeledTextField select fullWidth label={t('savings.eventKind')} value={kind} onChange={(e) => setKind(e.target.value as AccountEventKind)}>
          {(['top_up', 'withdrawal', 'rate_change'] as AccountEventKind[]).map((value) => (
            <MenuItem key={value} value={value}>
              {t(`savings.kinds.${value}`)}
            </MenuItem>
          ))}
        </LabeledTextField>
        <FormField label={t('accounts.page.date')}>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={locale}>
            <DatePicker value={eventDate} onChange={setEventDate} slotProps={{ textField: { fullWidth: true } }} />
          </LocalizationProvider>
        </FormField>
        <LabeledTextField
          fullWidth
          label={kind === 'rate_change' ? t('savings.rateValue') : t('accounts.page.amount', { currency: account.currency })}
          type="number"
          inputProps={{ step: 0.01, min: 0 }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
        <LabeledTextField fullWidth label={t('accounts.page.note')} value={note} onChange={(e) => setNote(e.target.value)} />
      </Box>
      <Button type="submit" variant="contained" disabled={saving} sx={{ alignSelf: 'flex-start' }}>
        {t('savings.addEvent')}
      </Button>
    </Stack>
  );
}

function Figure({ title, value }: { title: string; value: string }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
      <Typography sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' }, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
    </Box>
  );
}
