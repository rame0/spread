import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';
import NetWorthChart from '../components/NetWorthChart';
import RateWarnings from '../components/RateWarnings';
import { Row, RowIcon, Rows } from '../components/Row';
import { formatMoney, formatMoneyWhole } from '../formatMoney';
import { getMainDashboard, getNetWorth } from '../services/api';
import type { MainDashboardResult, NetWorthResult } from '../types/v2';

const PERIODS = [12, 24, 60];
const signed = (value: number) => `${value >= 0 ? '+' : '−'}${formatMoneyWhole(Math.abs(value))}`;

/** Net worth: assets minus debts, how it changed, and property next to its mortgage. */
export default function Capital() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [months, setMonths] = useState(12);
  const [netWorth, setNetWorth] = useState<NetWorthResult | null>(null);
  const [debts, setDebts] = useState<MainDashboardResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    getNetWorth(months)
      .then(setNetWorth)
      .catch(() => setError(t('accounts.loadError')));
  }, [months, t]);

  useEffect(() => {
    getMainDashboard().then(setDebts).catch(() => setDebts(null));
  }, []);

  if (!netWorth) return error ? <Alert severity="error">{error}</Alert> : <CircularProgress />;

  const history = netWorth.history.filter((point) => point.netWorth !== null);
  const first = history[0]?.netWorth ?? null;
  const delta = first === null ? null : netWorth.netWorth - first;
  const lines = netWorth.assets.lines;
  const sum = (predicate: (line: (typeof lines)[number]) => boolean) => lines.filter(predicate).reduce((total, line) => total + (line.rubAmount ?? 0), 0);
  const liquid = sum((line) => line.kind !== 'property' && line.isLiquid);
  const invested = sum((line) => line.kind !== 'property' && !line.isLiquid);
  const properties = lines.filter((line) => line.kind === 'property');
  const mortgages = debts?.cards.filter((card) => card.kind === 'mortgage') ?? [];
  const muted = (text: string) => <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>{text}</Box>;

  const breakdown = (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="subtitle1" sx={{ mb: 0.5 }}>{t('capital.breakdown')}</Typography>
      <Rows>
        <Row leading={<RowIcon><AccountBalanceWalletOutlinedIcon /></RowIcon>} title={t('money.groups.liquid')} trailing={formatMoneyWhole(liquid)} onClick={() => navigate('/accounts')} />
        <Row leading={<RowIcon><ShowChartRoundedIcon /></RowIcon>} title={t('money.groups.invested')} trailing={formatMoneyWhole(invested)} onClick={() => navigate('/accounts')} />
        <Row leading={<RowIcon><HomeOutlinedIcon /></RowIcon>} title={t('capital.property')} trailing={formatMoneyWhole(netWorth.assets.propertyTotal)} alignWithLinks />
        <Row title={<Box component="span" sx={{ fontWeight: 600 }}>{t('netWorth.assets')}</Box>} trailing={formatMoneyWhole(netWorth.assets.total)} alignWithLinks />
        <Row leading={<RowIcon><CreditCardOutlinedIcon /></RowIcon>} title={t('capital.cardDebts')} trailing={`−${formatMoneyWhole(netWorth.debts.cards)}`} onClick={() => navigate('/debts')} />
        <Row leading={<RowIcon><HomeOutlinedIcon /></RowIcon>} title={t('capital.mortgages')} trailing={`−${formatMoneyWhole(netWorth.debts.mortgages)}`} onClick={() => navigate('/debts')} />
        <Row title={<Box component="span" sx={{ fontWeight: 600 }}>{t('netWorth.debts')}</Box>} trailing={`−${formatMoneyWhole(netWorth.debts.total)}`} alignWithLinks />
        <Row title={<Box component="span" sx={{ fontWeight: 600 }}>{t('netWorth.netWorth')}</Box>} trailing={<Box component="span" sx={{ color: netWorth.netWorth < 0 ? 'error.main' : undefined }}>{formatMoneyWhole(netWorth.netWorth)}</Box>} alignWithLinks />
      </Rows>
    </Paper>
  );

  const realEstate = (
    <Paper sx={{ p: 2.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="subtitle1">{t('capital.property')}</Typography>
        <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => navigate('/accounts?new=property')}>{t('capital.addProperty')}</Button>
      </Stack>
      {properties.length === 0 && mortgages.length === 0 ? (
        <Typography color="text.secondary">{t('capital.noPropertyYet')}</Typography>
      ) : (
        <>
          {properties.length === 0 && <Alert severity="warning" sx={{ mb: 1 }}>{t('netWorth.noProperty')}</Alert>}
          <Rows>
            {properties.map((line) => (
              <Row
                key={line.accountId}
                leading={<RowIcon><HomeOutlinedIcon /></RowIcon>}
                title={line.name}
                meta={t('capital.valuation')}
                trailing={line.rubAmount === null ? '—' : formatMoneyWhole(line.rubAmount)}
                onClick={() => navigate(`/accounts/${line.accountId}`)}
              />
            ))}
            {mortgages.map((mortgage) => (
              <Row
                key={mortgage.id}
                leading={<RowIcon><CreditCardOutlinedIcon /></RowIcon>}
                title={mortgage.name}
                meta={t('capital.mortgageLeft')}
                trailing={`−${formatMoneyWhole(mortgage.totalRemaining)}`}
                onClick={() => navigate(`/mortgages/${mortgage.id}`)}
              />
            ))}
            <Row
              title={muted(t('capital.equity'))}
              meta={netWorth.realEstate.value > 0 ? t('capital.equityShare', { percent: Math.round((netWorth.realEstate.equity / netWorth.realEstate.value) * 100) }) : undefined}
              trailing={<Box component="span" sx={{ color: netWorth.realEstate.equity < 0 ? 'error.main' : undefined }}>{formatMoneyWhole(netWorth.realEstate.equity)}</Box>}
              alignWithLinks
            />
          </Rows>
        </>
      )}
    </Paper>
  );

  return (
    <Stack spacing={2}>
      <Typography variant="h4">{t('capital.title')}</Typography>
      <RateWarnings netWorth={netWorth} />

      <Paper sx={{ p: 2.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
          <Box>
            <Typography color="text.secondary">{t('capital.formula')}</Typography>
            <Typography sx={{ fontSize: { xs: 30, md: 36 }, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
              {formatMoneyWhole(netWorth.netWorth)}
            </Typography>
            {delta !== null && (
              <Typography variant="body2" color="text.secondary">
                <Box component="span" sx={{ color: delta >= 0 ? 'success.main' : 'error.main' }}>{signed(delta)}</Box>{' '}
                {t('capital.since', { date: format(new Date(`${history[0].date}T12:00:00`), 'MMMM yyyy', { locale: getDateFnsLocale(i18n.language) }) })}
              </Typography>
            )}
          </Box>
          <ToggleButtonGroup exclusive size="small" value={months} onChange={(_, next: number | null) => next && setMonths(next)} sx={{ alignSelf: { sm: 'flex-start' } }}>
            {PERIODS.map((value) => (
              <ToggleButton key={value} value={value}>{t('capital.period', { count: value })}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
        {history.length > 1 && (
          <Box sx={{ mx: -1.5, mt: 1 }}>
            <NetWorthChart data={history} formatValue={formatMoney} series={[{ key: 'netWorth', label: t('netWorth.netWorth'), color: 'var(--status-ok)' }]} />
          </Box>
        )}
      </Paper>

      {isDesktop ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, alignItems: 'start' }}>
          {breakdown}
          {realEstate}
        </Box>
      ) : (
        <>
          {breakdown}
          {realEstate}
        </>
      )}
    </Stack>
  );
}
