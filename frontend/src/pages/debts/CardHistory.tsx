import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { getDateFnsLocale } from '../../i18n';
import { formatMoney } from '../../formatMoney';
import { getActivityChart, getDeposits, getReconciliations } from '../../services/api';
import type { ActivityChartPeriod, ActivityChartResult, BalanceReconciliation, Deposit } from '../../types/v2';
import ActivityAreaChart from '../../components/ActivityAreaChart';
import StatementImport from '../../components/StatementImport';
import { DateBadge, Row, Rows } from '../../components/Row';
import type { CardTabProps } from './CardDebt';

const SHOWN = 8;

/** Payments, balance checks, statement imports and activity charts. */
export default function CardHistory({ card, version }: CardTabProps) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [deposits, setDeposits] = useState<Deposit[] | null>(null);
  const [reconciliations, setReconciliations] = useState<BalanceReconciliation[]>([]);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    Promise.all([getDeposits(card.id), getReconciliations(card.id)])
      .then(([nextDeposits, nextReconciliations]) => {
        setDeposits(nextDeposits);
        setReconciliations(nextReconciliations);
      })
      .catch(() => setError(t('deposits.loadError')));
  }, [card.id, version, t]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!deposits) return <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}><CircularProgress size={24} /></Box>;

  const shownDeposits = showAll ? deposits : deposits.slice(0, SHOWN);

  return (
    <Stack spacing={3} sx={{ pt: 1 }}>
      <Box>
        <Typography variant="subtitle1">{t('debts.history.payments')}</Typography>
        {deposits.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 1 }}>{t('deposits.empty')}</Typography>
        ) : (
          <Rows>
            {shownDeposits.map((deposit) => (
              <Row key={deposit.id} leading={<DateBadge date={deposit.depositDate} />} title={t('debts.history.payment')} meta={format(new Date(deposit.depositDate), 'yyyy', { locale })} trailing={formatMoney(deposit.amount)} />
            ))}
          </Rows>
        )}
        {deposits.length > SHOWN && (
          <Button size="small" sx={{ ml: -1, mt: 0.5 }} onClick={() => setShowAll((current) => !current)}>
            {showAll ? t('mainDashboard.showLess') : t('mainDashboard.showAll', { count: deposits.length })}
          </Button>
        )}
      </Box>

      {reconciliations.length > 0 && (
        <Box>
          <Typography variant="subtitle1">{t('reconciliation.historyTitle')}</Typography>
          <Rows>
            {reconciliations.map((item) => (
              <Row
                key={item.id}
                leading={<DateBadge date={item.reconciliationDate} />}
                title={formatMoney(item.actualDebt)}
                meta={t('reconciliation.before', { amount: formatMoney(item.calculatedDebtBefore) })}
                trailing={
                  <Box component="span" sx={{ color: item.difference === 0 ? 'text.secondary' : item.difference > 0 ? 'error.main' : 'success.main' }}>
                    {item.difference > 0 ? '+' : ''}{formatMoney(item.difference)}
                  </Box>
                }
              />
            ))}
          </Rows>
        </Box>
      )}

      <Activity cardId={card.id} version={version} />

      {card.kind !== 'installment' && <StatementImport cardId={card.id} />}
    </Stack>
  );
}

function Activity({ cardId, version }: { cardId: string; version: number }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ActivityChartPeriod>('12m');
  const [chart, setChart] = useState<ActivityChartResult | null>(null);
  const [error, setError] = useState('');
  const request = useRef(0);

  useEffect(() => {
    const current = ++request.current;
    setError('');
    getActivityChart(cardId, period)
      .then((next) => current === request.current && setChart(next))
      .catch(() => current === request.current && setError(t('dashboard.activity.loadError')));
  }, [cardId, period, version, t]);

  const granularity = t(`dashboard.activity.granularity.${chart?.granularity ?? 'week'}`);
  const empty = (data: ActivityChartResult['purchases']) => data.length === 0 || data.every((point) => point.amount === 0);

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mb: 1 }}>
        <Typography variant="subtitle1">{t('debts.history.activity')}</Typography>
        <ToggleButtonGroup value={period} exclusive size="small" onChange={(_, value: ActivityChartPeriod | null) => value && setPeriod(value)}>
          {(['6m', '12m', 'all'] as ActivityChartPeriod[]).map((value) => (
            <ToggleButton key={value} value={value}>{t(`dashboard.activity.period.${value}`)}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {chart && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
          {([['purchases', 'var(--accent)'], ['deposits', 'var(--status-ok)']] as const).map(([key, color]) => (
            <Box key={key} sx={{ minWidth: 0 }}>
              <Typography variant="body2" color="text.secondary">{t(`dashboard.activity.${key}`, { granularity })}</Typography>
              {empty(chart[key]) ? (
                <Typography color="text.secondary" sx={{ py: 4 }}>{t('dashboard.activity.empty')}</Typography>
              ) : (
                <Box sx={{ mx: -1 }}><ActivityAreaChart data={chart[key]} color={color} granularity={chart.granularity} /></Box>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
