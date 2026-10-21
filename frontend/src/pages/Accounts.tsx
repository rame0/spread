import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import AccountForm, { ACCOUNT_KINDS } from '../components/AccountForm';
import RateWarnings from '../components/RateWarnings';
import { formatCurrency, formatMoney } from '../formatMoney';
import { getDateFnsLocale } from '../i18n';
import { createAccount, getAccounts, getInterestTax, getNetWorth, saveAccountBalance } from '../services/api';
import type { Account, InterestTaxEstimate, NetWorthAssetLine, NetWorthResult } from '../types/v2';

type Locale = ReturnType<typeof getDateFnsLocale>;

const parseDate = (value: string) => new Date(`${value}T00:00:00`);

export default function Accounts() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [netWorth, setNetWorth] = useState<NetWorthResult | null>(null);
  const [interestTax, setInterestTax] = useState<InterestTaxEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const newKind = ACCOUNT_KINDS.find((kind) => kind === searchParams.get('new'));
  const [addOpen, setAddOpen] = useState(Boolean(newKind));
  const closeAdd = () => {
    setAddOpen(false);
    if (newKind) setSearchParams({}, { replace: true });
  };

  const load = () =>
    Promise.all([getAccounts(), getNetWorth(0)])
      .then(([nextAccounts, nextNetWorth]) => {
        setAccounts(nextAccounts);
        setNetWorth(nextNetWorth);
      })
      .catch(() => setError(t('accounts.loadError')))
      .finally(() => setLoading(false));

  const loadTax = () =>
    getInterestTax()
      .then(setInterestTax)
      .catch(() => setInterestTax(null));

  useEffect(() => {
    load();
    loadTax();
  }, [t]);

  if (loading) return <CircularProgress />;
  if (!netWorth) return error ? <Alert severity="error">{error}</Alert> : null;

  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const archived = accounts.filter((account) => !netWorth.assets.lines.some((line) => line.accountId === account.id));
  const notify = (message: string) => {
    setSuccess(message);
    load();
    loadTax();
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'flex-start' }}>
        <Box>
          <Typography variant="h5">{t('accounts.title')}</Typography>
          <Typography color="text.secondary">{t('accounts.subtitle')}</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setAddOpen(true)}>
          {t('accounts.add')}
        </Button>
      </Stack>
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <RateWarnings netWorth={netWorth} />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
        <Stat title={t('accounts.total')} value={formatMoney(netWorth.assets.total)} />
        <Stat title={t('accounts.liquid')} value={formatMoney(netWorth.assets.liquidTotal)} hint={t('accounts.liquidHint')} />
      </Box>

      {interestTax && interestTax.accounts > 0 && <InterestTaxCard estimate={interestTax} />}

      {accounts.length === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary">{t('accounts.empty')}</Typography>
        </Paper>
      )}

      {ACCOUNT_KINDS.map((kind) => {
        const lines = netWorth.assets.lines.filter((line) => line.kind === kind);
        if (lines.length === 0) return null;
        const subtotal = lines.reduce((sum, line) => sum + (line.rubAmount ?? 0), 0);
        return (
          <Paper key={kind} sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="h6">{t(`accounts.kinds.${kind}`)}</Typography>
              <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatMoney(subtotal)}
              </Typography>
            </Stack>
            {lines.map((line) => (
              <AccountRow
                key={line.accountId}
                line={line}
                institution={accountById.get(line.accountId)?.institution ?? null}
                locale={locale}
                onOpen={() => navigate(`/accounts/${line.accountId}`)}
                onSaved={() => notify(t('accounts.balanceSaved'))}
                onError={() => setError(t('accounts.balanceError'))}
              />
            ))}
          </Paper>
        );
      })}

      {archived.length > 0 && (
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
            <Typography color="text.secondary">{t('accounts.archived', { count: archived.length })}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={1}>
              {archived.map((account) => (
                <Link key={account.id} component="button" onClick={() => navigate(`/accounts/${account.id}`)} sx={{ alignSelf: 'flex-start' }}>
                  {account.name}
                </Link>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}

      <Dialog open={addOpen} onClose={closeAdd} maxWidth="sm" fullWidth>
        <DialogTitle>{t('accounts.add')}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <AccountForm
              initialKind={newKind}
              submitLabel={t('accounts.form.create')}
              onSubmit={(values) =>
                createAccount(values).then(() => {
                  closeAdd();
                  notify(t('accounts.created'));
                })
              }
            />
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

/** Account with its last balance and an inline field to enter today's balance. */
function AccountRow({
  line,
  institution,
  locale,
  onOpen,
  onSaved,
  onError,
}: {
  line: NetWorthAssetLine;
  institution: string | null;
  locale: Locale;
  onOpen: () => void;
  onSaved: () => void;
  onError: () => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(value.replace(',', '.'));
    if (value.trim() === '' || !Number.isFinite(amount)) return;
    setSaving(true);
    saveAccountBalance(line.accountId, format(new Date(), 'yyyy-MM-dd'), { amount })
      .then(() => {
        setValue('');
        onSaved();
      })
      .catch(onError)
      .finally(() => setSaving(false));
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto 260px' },
        gap: { xs: 1, md: 2 },
        alignItems: 'center',
        py: 1.5,
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Link component="button" onClick={onOpen} fontWeight={600} sx={{ textAlign: 'left' }}>
          {line.name}
        </Link>
        <Typography variant="body2" color={line.stale ? 'warning.main' : 'text.secondary'}>
          {[
            institution,
            line.computed
              ? t('accounts.computed')
              : line.balanceDate
              ? t('accounts.updated', { date: format(parseDate(line.balanceDate), 'd MMMM yyyy', { locale }) })
              : t('accounts.noBalance'),
          ]
            .filter(Boolean)
            .join(' · ')}
        </Typography>
      </Box>
      <Box sx={{ textAlign: { md: 'right' } }}>
        <Typography fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {line.amount === null ? '—' : formatCurrency(line.amount, line.currency)}
        </Typography>
        {line.currency !== 'RUB' && line.rubAmount !== null && (
          <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            ≈ {formatMoney(line.rubAmount)}
          </Typography>
        )}
      </Box>
      <Stack component="form" direction="row" spacing={1} onSubmit={save}>
        <TextField
          size="small"
          fullWidth
          type="number"
          inputProps={{ step: 0.01, 'aria-label': t('accounts.newBalance', { name: line.name }) }}
          placeholder={t(line.kind === 'property' ? 'accounts.newValuePlaceholder' : 'accounts.newBalancePlaceholder', { currency: line.currency })}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Tooltip title={t('accounts.saveToday')}>
          <span>
            <IconButton type="submit" color="primary" disabled={saving || value.trim() === ''} aria-label={t('accounts.saveToday')}>
              <CheckRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  );
}

function InterestTaxCard({ estimate }: { estimate: InterestTaxEstimate }) {
  const { t } = useTranslation();
  return (
    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack spacing={2}>
        <Typography variant="h6">{t('interestTax.title', { year: estimate.year })}</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' }, gap: 2 }}>
          <TaxFigure title={t('interestTax.incomeToDate')} value={formatMoney(estimate.incomeToDate)} />
          <TaxFigure title={t('interestTax.incomeForecast')} value={formatMoney(estimate.incomeForecast)} />
          <TaxFigure
            title={t('interestTax.limit')}
            value={formatMoney(estimate.limit)}
            hint={estimate.maxKeyRate === null ? undefined : t('interestTax.limitHint', { rate: estimate.maxKeyRate })}
          />
          <TaxFigure title={t('interestTax.tax')} value={formatMoney(estimate.tax)} tone={estimate.tax > 0 ? 'warning' : 'default'} />
        </Box>
        <Typography variant="caption" color="text.secondary">
          {t('interestTax.hint')}
        </Typography>
        {estimate.keyRateStale && <Alert severity="warning">{t('interestTax.keyRateStale')}</Alert>}
        {estimate.excludedCurrencies.length > 0 && (
          <Alert severity="info">{t('interestTax.excluded', { currencies: estimate.excludedCurrencies.join(', ') })}</Alert>
        )}
      </Stack>
    </Paper>
  );
}

function TaxFigure({ title, value, hint, tone = 'default' }: { title: string; value: string; hint?: string; tone?: 'default' | 'warning' }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
      <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: tone === 'warning' ? 'warning.main' : 'text.primary' }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
  );
}

function Stat({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography color="text.secondary">{title}</Typography>
      <Typography sx={{ fontSize: { xs: '1.75rem', md: '2rem' }, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
      {hint && <Typography color="text.secondary">{hint}</Typography>}
    </Paper>
  );
}
