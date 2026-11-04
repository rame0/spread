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
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { differenceInCalendarDays, format, formatDistanceToNowStrict } from 'date-fns';
import { useTranslation } from 'react-i18next';
import AccountForm, { ACCOUNT_KINDS, BENEFIT_KINDS } from '../components/AccountForm';
import RateWarnings from '../components/RateWarnings';
import { LabeledTextField } from '../components/FormField';
import { Row, RowIcon, Rows } from '../components/Row';
import { formatCurrency, formatMoneyWhole } from '../formatMoney';
import { getDateFnsLocale } from '../i18n';
import { createAccount, getAccounts, getInterestTax, getNetWorth, getTaxBenefits, saveTaxYear } from '../services/api';
import type { Account, InterestTaxEstimate, NetWorthAssetLine, NetWorthResult, TaxBenefits } from '../types/v2';
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
  const [benefits, setBenefits] = useState<TaxBenefits | null>(null);
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
        if (nextAccounts.some((account) => BENEFIT_KINDS.includes(account.kind))) {
          getTaxBenefits(benefits?.summary.year).then(setBenefits).catch(() => setBenefits(null));
        }
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
  // Property is shown with its mortgage on the capital page.
  const groups: Group[] = ['liquid', 'invested'];

  const meta = (line: NetWorthAssetLine): { text: string; color?: string } => {
    const account = accountById.get(line.accountId);
    const parts = [account?.institution, t(`money.kindOne.${line.kind}`)];
    if (account?.maturityDate) parts.push(t('money.until', { date: format(asLocalDate(account.maturityDate), 'd MMMM yyyy', { locale }) }));
    if (account?.unlockDate) parts.push(t('money.lockedUntil', { date: format(asLocalDate(account.unlockDate), 'd MMMM yyyy', { locale }) }));
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
      {benefits && (
        <TaxBenefitsCard
          benefits={benefits}
          onYearChange={(year) => getTaxBenefits(year).then(setBenefits).catch(() => setError(t('taxBenefits.loadError')))}
          onSaved={() => getTaxBenefits(benefits.summary.year).then(setBenefits).catch(() => setError(t('taxBenefits.loadError')))}
          onError={() => setError(t('taxBenefits.saveError'))}
        />
      )}
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
                  // Property is listed on the capital page, not here.
                  if (values.kind === 'property') navigate('/capital');
                  else {
                    setSuccess(t('accounts.created'));
                    load();
                  }
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

const parseAmount = (value: string) => (value.trim() === '' ? null : Number(value.replace(/\s/g, '').replace(',', '.')));

/** ПДС co-financing and the deduction for contributions of a year, with the income they depend on. */
function TaxBenefitsCard({
  benefits,
  onYearChange,
  onSaved,
  onError,
}: {
  benefits: TaxBenefits;
  onYearChange: (year: number) => void;
  onSaved: () => void;
  onError: () => void;
}) {
  const { t } = useTranslation();
  const { summary, taxYear } = benefits;
  const [income, setIncome] = useState(taxYear.annualIncome === null ? '' : String(taxYear.annualIncome));
  const [other, setOther] = useState(taxYear.otherDeductible ? String(taxYear.otherDeductible) : '');
  const [refund, setRefund] = useState(taxYear.refundReceived === null ? '' : String(taxYear.refundReceived));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIncome(taxYear.annualIncome === null ? '' : String(taxYear.annualIncome));
    setOther(taxYear.otherDeductible ? String(taxYear.otherDeductible) : '');
    setRefund(taxYear.refundReceived === null ? '' : String(taxYear.refundReceived));
  }, [taxYear]);

  const values = { annualIncome: parseAmount(income), otherDeductible: parseAmount(other) ?? 0, refundReceived: parseAmount(refund) };
  const valid = [values.annualIncome, values.otherDeductible, values.refundReceived].every((value) => value === null || (Number.isFinite(value) && value >= 0));
  const changed =
    values.annualIncome !== taxYear.annualIncome || values.otherDeductible !== taxYear.otherDeductible || values.refundReceived !== taxYear.refundReceived;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    saveTaxYear(summary.year, values)
      .then(onSaved)
      .catch(onError)
      .finally(() => setSaving(false));
  };

  const line = (label: string, value: number, color?: string) => (
    <Row
      title={<Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>{label}</Box>}
      trailing={<Box component="span" sx={{ color }}>{formatMoneyWhole(value)}</Box>}
    />
  );
  const { cofinancing, deduction } = summary;
  return (
    <Paper sx={{ p: 2.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="subtitle1">{t('taxBenefits.cardTitle')}</Typography>
        <TextField select size="small" value={summary.year} onChange={(e) => onYearChange(Number(e.target.value))} SelectProps={{ native: true }} inputProps={{ 'aria-label': t('taxBenefits.year') }}>
          {benefits.years.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </TextField>
      </Stack>
      {!summary.rulesKnown ? (
        <Typography variant="body2" color="text.secondary">{t('taxBenefits.rulesUnknown', { year: summary.year })}</Typography>
      ) : (
        <Rows>
          {cofinancing && line(t('taxBenefits.pdsContributions'), cofinancing.contributions)}
          {cofinancing && line(t('taxBenefits.cofinancingRatio', { ratio: cofinancing.ratio === 1 ? '1:1' : cofinancing.ratio === 0.5 ? '1:2' : '1:4' }), cofinancing.expected, cofinancing.expected > 0 ? 'success.main' : undefined)}
          {cofinancing && cofinancing.toMax > 0 && line(t('taxBenefits.toMax'), cofinancing.toMax, 'warning.main')}
          {line(t('taxBenefits.deductible', { limit: formatMoneyWhole(deduction.limit) }), deduction.contributions + deduction.other)}
          {line(t('taxBenefits.refund'), deduction.refund, deduction.refund > 0 ? 'success.main' : undefined)}
        </Rows>
      )}
      <Stack component="form" spacing={1.5} onSubmit={save} sx={{ mt: 1.5 }}>
        <LabeledTextField fullWidth label={t('taxBenefits.income', { year: summary.year })} value={income} onChange={(e) => setIncome(e.target.value)} inputProps={{ inputMode: 'decimal' }} helperText={t('taxBenefits.incomeHint')} />
        <LabeledTextField fullWidth label={t('taxBenefits.other')} value={other} onChange={(e) => setOther(e.target.value)} inputProps={{ inputMode: 'decimal' }} helperText={t('taxBenefits.otherHint')} />
        <LabeledTextField fullWidth label={t('taxBenefits.refundReceived')} value={refund} onChange={(e) => setRefund(e.target.value)} inputProps={{ inputMode: 'decimal' }} />
        {changed && (
          <Button type="submit" variant="outlined" size="small" disabled={!valid || saving} sx={{ alignSelf: 'flex-start' }}>
            {t('taxBenefits.save')}
          </Button>
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {t('taxBenefits.hint')}
      </Typography>
    </Paper>
  );
}
