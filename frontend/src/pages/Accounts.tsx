import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
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
import { differenceInCalendarDays, format, formatDistanceToNowStrict } from 'date-fns';
import { useTranslation } from 'react-i18next';
import AccountForm, { ACCOUNT_KINDS } from '../components/AccountForm';
import RateWarnings from '../components/RateWarnings';
import { Row, RowIcon, Rows } from '../components/Row';
import { formatCurrency, formatMoneyWhole } from '../formatMoney';
import { getDateFnsLocale } from '../i18n';
import { createAccount, getAccounts, getInterestTax, getNetWorth } from '../services/api';
import type { Account, InterestTaxEstimate, NetWorthAssetLine, NetWorthResult } from '../types/v2';
import { accountIcon } from '../components/accountIcon';

type Locale = ReturnType<typeof getDateFnsLocale>;

const asLocalDate = (value: string) => new Date(`${value}T12:00:00`);

type Group = 'liquid' | 'invested' | 'property';

export const groupOf = (line: NetWorthAssetLine): Group => (line.kind === 'property' ? 'property' : line.isLiquid ? 'liquid' : 'invested');

/** "today", "yesterday" or "3 weeks ago" for the date a balance was entered. */
export function balanceAge(date: string, locale: Locale, t: (key: string) => string): string {
  const days = differenceInCalendarDays(new Date(), asLocalDate(date));
  if (days <= 0) return t('money.today');
  if (days === 1) return t('money.yesterday');
  return formatDistanceToNowStrict(asLocalDate(date), { locale, addSuffix: true, roundingMethod: 'floor' });
}

export default function Accounts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [netWorth, setNetWorth] = useState<NetWorthResult | null>(null);
  const [interestTax, setInterestTax] = useState<InterestTaxEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState((location.state as { saved?: string } | null)?.saved ?? '');
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

  useEffect(() => {
    load();
    getInterestTax().then(setInterestTax).catch(() => setInterestTax(null));
  }, [t]);

  if (loading) return <CircularProgress />;
  if (!netWorth) return error ? <Alert severity="error">{error}</Alert> : null;

  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const archived = accounts.filter((account) => !netWorth.assets.lines.some((line) => line.accountId === account.id));
  const invested = netWorth.assets.total - netWorth.assets.propertyTotal;
  const groups: Group[] = ['liquid', 'invested', 'property'];

  const meta = (line: NetWorthAssetLine): { text: string; color?: string } => {
    const account = accountById.get(line.accountId);
    const parts = [account?.institution, t(`money.kindOne.${line.kind}`)];
    if (account?.maturityDate) parts.push(t('money.until', { date: format(asLocalDate(account.maturityDate), 'd MMMM yyyy', { locale }) }));
    if (account?.externalSource === 'tinvest') return { text: [...parts, t('money.synced')].filter(Boolean).join(' · ') };
    if (line.computed) return { text: [...parts, t('money.computed')].filter(Boolean).join(' · ') };
    if (!line.balanceDate) return { text: [...parts, t('accounts.noBalance')].filter(Boolean).join(' · '), color: 'warning.main' };
    const age = balanceAge(line.balanceDate, locale, t);
    return { text: [...parts, age].filter(Boolean).join(' · '), color: line.stale ? 'warning.main' : undefined };
  };

  const amount = (line: NetWorthAssetLine) =>
    line.amount === null ? (
      '—'
    ) : line.currency === 'RUB' || line.rubAmount === null ? (
      formatCurrency(line.amount, line.currency)
    ) : (
      <Box component="span" sx={{ display: 'block', textAlign: 'right' }}>
        {formatCurrency(line.amount, line.currency)}
        <Box component="span" sx={{ display: 'block', fontSize: 12, fontWeight: 400, color: 'text.secondary' }}>
          ≈ {formatMoneyWhole(line.rubAmount)}
        </Box>
      </Box>
    );

  const list = (
    <Stack spacing={2.5}>
      {accounts.length === 0 && (
        <Paper sx={{ p: 2.5 }}>
          <Typography color="text.secondary">{t('accounts.empty')}</Typography>
        </Paper>
      )}
      {groups.map((group) => {
        const lines = netWorth.assets.lines.filter((line) => groupOf(line) === group);
        if (lines.length === 0) return null;
        return (
          <Box key={group}>
            <Stack direction="row" justifyContent="space-between" sx={{ px: 0.5, mb: 1 }}>
              <Typography sx={{ fontWeight: 600 }}>{t(`money.groups.${group}`)}</Typography>
              <Typography color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatMoneyWhole(lines.reduce((sum, line) => sum + (line.rubAmount ?? 0), 0))}
              </Typography>
            </Stack>
            <Paper sx={{ px: 2, py: 0.25 }}>
              <Rows>
                {lines.map((line) => {
                  const { text, color } = meta(line);
                  return (
                    <Row
                      key={line.accountId}
                      leading={<RowIcon>{accountIcon(line.kind)}</RowIcon>}
                      title={line.name}
                      meta={text}
                      metaColor={color}
                      trailing={amount(line)}
                      onClick={() => navigate(`/accounts/${line.accountId}`)}
                    />
                  );
                })}
              </Rows>
            </Paper>
          </Box>
        );
      })}
      {archived.length > 0 && (
        <Typography variant="body2" color="text.secondary">
          {t('accounts.archived', { count: archived.length })}:{' '}
          {archived.map((account, index) => (
            <React.Fragment key={account.id}>
              {index > 0 && ', '}
              <Link component="button" variant="body2" onClick={() => navigate(`/accounts/${account.id}`)} sx={{ verticalAlign: 'baseline' }}>
                {account.name}
              </Link>
            </React.Fragment>
          ))}
        </Typography>
      )}
    </Stack>
  );

  const aside = (
    <Stack spacing={2}>
      {interestTax && interestTax.accounts > 0 && <InterestTaxCard estimate={interestTax} />}
      <Paper sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" sx={{ mb: 0.5 }}>{t('accounts.liquid')}</Typography>
        <Typography variant="body2" color="text.secondary">{t('money.liquidExplained')}</Typography>
      </Paper>
    </Stack>
  );

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="flex-end">
        <Box>
          <Typography variant="h4">{t('nav.money')}</Typography>
          <Typography color="text.secondary" variant="body2">
            {t('money.summary', { liquid: formatMoneyWhole(netWorth.assets.liquidTotal), total: formatMoneyWhole(invested) })}
          </Typography>
        </Box>
        {isDesktop && (
          <Stack direction="row" spacing={1}>
            <Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={() => navigate('/accounts/update')}>{t('overview.updateBalances')}</Button>
            <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => setAddOpen(true)}>{t('money.account')}</Button>
          </Stack>
        )}
      </Stack>
      {!isDesktop && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1 }}>
          <Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={() => navigate('/accounts/update')}>{t('overview.updateBalances')}</Button>
          <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => setAddOpen(true)}>{t('money.account')}</Button>
        </Box>
      )}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      <RateWarnings netWorth={netWorth} />

      {isDesktop ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 2.5, alignItems: 'start' }}>
          {list}
          <Box sx={{ pt: 4.5 }}>{aside}</Box>
        </Box>
      ) : (
        <>
          {list}
          {aside}
        </>
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
                  setSuccess(t('accounts.created'));
                  load();
                })
              }
            />
          </Box>
        </DialogContent>
      </Dialog>

      <Snackbar open={Boolean(success)} autoHideDuration={3000} onClose={() => setSuccess('')}>
        <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>
      </Snackbar>
    </Stack>
  );
}

function InterestTaxCard({ estimate }: { estimate: InterestTaxEstimate }) {
  const { t } = useTranslation();
  const line = (label: string, value: number, color?: string) => (
    <Row
      title={<Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>{label}</Box>}
      trailing={<Box component="span" sx={{ color }}>{formatMoneyWhole(value)}</Box>}
    />
  );
  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="subtitle1" sx={{ mb: 0.5 }}>{t('money.interestTitle', { year: estimate.year })}</Typography>
      <Rows>
        {line(t('interestTax.incomeToDate'), estimate.incomeToDate)}
        {line(t('interestTax.incomeForecast'), estimate.incomeForecast)}
        {line(t('interestTax.limit'), estimate.limit)}
        {line(t('interestTax.tax'), estimate.tax, estimate.tax > 0 ? 'warning.main' : 'success.main')}
      </Rows>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {estimate.maxKeyRate === null ? t('interestTax.hint') : `${t('interestTax.limitHint', { rate: estimate.maxKeyRate })}. ${t('interestTax.hint')}`}
      </Typography>
      {estimate.keyRateStale && <Alert severity="warning" sx={{ mt: 1 }}>{t('interestTax.keyRateStale')}</Alert>}
      {estimate.excludedCurrencies.length > 0 && (
        <Alert severity="info" sx={{ mt: 1 }}>{t('interestTax.excluded', { currencies: estimate.excludedCurrencies.join(', ') })}</Alert>
      )}
    </Paper>
  );
}
