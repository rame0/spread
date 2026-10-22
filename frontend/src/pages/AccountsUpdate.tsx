import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, InputAdornment, Paper, Stack, TextField, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { currencySymbol, formatCurrency, formatMoneyWhole } from '../formatMoney';
import { getDateFnsLocale } from '../i18n';
import { getAccounts, getNetWorth, saveAccountBalances } from '../services/api';
import type { Account, NetWorthAssetLine } from '../types/v2';
import { balanceAge, groupOf } from './Accounts';

const ORDER = { liquid: 0, invested: 1, property: 2 };

const parseAmount = (value: string) => Number(value.replace(/\s/g, '').replace(',', '.'));

/** Today's balances of all accounts in one form; empty fields stay as they are. */
export default function AccountsUpdate() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [lines, setLines] = useState<NetWorthAssetLine[] | null>(null);
  const [synced, setSynced] = useState<Account[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const today = new Date();

  useEffect(() => {
    Promise.all([getAccounts(), getNetWorth(0)])
      .then(([accounts, netWorth]) => {
        const external = new Set(accounts.filter((account) => account.externalSource).map((account) => account.id));
        setSynced(accounts.filter((account) => external.has(account.id) && !account.archivedAt));
        setLines(
          netWorth.assets.lines
            .filter((line) => !external.has(line.accountId))
            .sort((a, b) => ORDER[groupOf(a)] - ORDER[groupOf(b)])
        );
      })
      .catch(() => setError(t('accounts.loadError')));
  }, [t]);

  if (!lines) return error ? <Alert severity="error">{error}</Alert> : <CircularProgress />;

  const changed = lines.filter((line) => {
    const raw = values[line.accountId]?.trim();
    return raw && Number.isFinite(parseAmount(raw));
  });
  // Rubles per unit, from the converted amount; RUB needs no rate.
  const rate = (line: NetWorthAssetLine) =>
    line.currency === 'RUB' ? 1 : line.amount && line.rubAmount !== null ? line.rubAmount / line.amount : null;
  const liquidDelta = changed
    .filter((line) => groupOf(line) === 'liquid')
    .reduce((sum, line) => sum + (parseAmount(values[line.accountId]) - (line.amount ?? 0)) * (rate(line) ?? 0), 0);

  const meta = (line: NetWorthAssetLine) => {
    const current = line.amount === null ? t('accounts.noBalance') : formatCurrency(line.amount, line.currency);
    if (line.computed) return { text: t('money.update.computed', { amount: current }) };
    if (line.kind === 'property') return { text: t('money.update.estimate', { amount: current }) };
    if (!line.balanceDate) return { text: current, color: 'warning.main' };
    return { text: `${balanceAge(line.balanceDate, locale, t)} · ${current}`, color: line.stale ? 'warning.main' : undefined };
  };

  const save = () => {
    setSaving(true);
    setError('');
    saveAccountBalances(
      format(today, 'yyyy-MM-dd'),
      changed.map((line) => ({ accountId: line.accountId, amount: parseAmount(values[line.accountId]) }))
    )
      .then(() => navigate('/accounts', { state: { saved: t('money.update.saved', { count: changed.length }) } }))
      .catch(() => setError(t('accounts.balanceError')))
      .finally(() => setSaving(false));
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 720, pb: 10 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/accounts')} sx={{ ml: -1 }}>
          {t('nav.money')}
        </Button>
      </Stack>
      <Box>
        <Typography variant="h4">{t('money.update.title')}</Typography>
        <Typography color="text.secondary" variant="body2">
          {format(today, 'd MMMM', { locale })} · {t('money.update.hint')}
        </Typography>
      </Box>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      <Paper sx={{ px: 2, py: 0.5 }}>
        <Box sx={{ '& > * + *': { borderTop: '1px solid var(--border)' } }}>
          {lines.map((line) => {
            const { text, color } = meta(line);
            return (
              <Stack key={line.accountId} direction="row" spacing={2} alignItems="center" sx={{ py: 1.25 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 500 }} noWrap>{line.name}</Typography>
                  <Typography variant="caption" sx={{ color: color ?? 'text.secondary', display: 'block' }} noWrap>{text}</Typography>
                </Box>
                <TextField
                  size="small"
                  inputMode="decimal"
                  value={values[line.accountId] ?? ''}
                  onChange={(event) => setValues((current) => ({ ...current, [line.accountId]: event.target.value }))}
                  inputProps={{ inputMode: 'decimal', 'aria-label': t('accounts.newBalance', { name: line.name }), style: { textAlign: 'right' } }}
                  InputProps={{ endAdornment: <InputAdornment position="end">{currencySymbol(line.currency)}</InputAdornment> }}
                  error={Boolean(values[line.accountId]?.trim()) && !Number.isFinite(parseAmount(values[line.accountId]))}
                  sx={{ width: { xs: 150, sm: 200 }, flex: 'none' }}
                />
              </Stack>
            );
          })}
        </Box>
      </Paper>

      {synced.length > 0 && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary', px: 0.5 }}>
          <SyncRoundedIcon fontSize="small" sx={{ color: 'primary.main' }} />
          <Typography variant="body2">{t('money.update.synced', { names: synced.map((account) => account.name).join(', ') })}</Typography>
        </Stack>
      )}

      <Paper
        sx={{
          position: 'fixed',
          left: { xs: 16, md: 'calc(224px + 36px)' },
          right: 16,
          bottom: { xs: 'calc(60px + 12px + env(safe-area-inset-bottom))', md: 16 },
          maxWidth: { md: 720 },
          zIndex: (theme) => theme.zIndex.appBar + 1,
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          boxShadow: '0 12px 32px rgba(0, 0, 0, .25)',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">{t('money.update.changed', { count: changed.length, total: lines.length })}</Typography>
          {changed.length > 0 && (
            <Typography sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {t('money.update.delta', { amount: `${liquidDelta >= 0 ? '+' : '−'}${formatMoneyWhole(Math.abs(liquidDelta))}` })}
            </Typography>
          )}
        </Box>
        <Button variant="contained" disabled={changed.length === 0 || saving} onClick={save} sx={{ px: 3 }}>
          {t('common.save')}
        </Button>
      </Paper>
    </Stack>
  );
}
