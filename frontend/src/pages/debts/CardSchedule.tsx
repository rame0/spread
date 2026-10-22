import { useEffect, useState } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { differenceInCalendarDays, format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../../i18n';
import { formatMoney } from '../../formatMoney';
import { getPlan } from '../../services/api';
import type { DashboardResult, PeriodPlanRow } from '../../types/v2';
import { DateBadge, Row, Rows } from '../../components/Row';
import { capitalizeFirst, MonthGroup } from './DebtsLayout';
import type { CardTabProps } from './CardDebt';

type Bucket = DashboardResult['buckets'][number];

const PLAN_MONTHS = 6;

/** Unpaid payments grouped by the month they are due; paid ones are folded. */
export default function CardSchedule({ card, summary, version }: CardTabProps) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [showPaid, setShowPaid] = useState(false);
  const [plan, setPlan] = useState<PeriodPlanRow[]>([]);
  const isInstallment = card.kind === 'installment';
  const today = new Date();

  useEffect(() => {
    if (isInstallment) return;
    getPlan(card.id).then(setPlan).catch(() => setPlan([]));
  }, [card.id, isInstallment, version]);

  const open = summary.buckets.filter((bucket) => bucket.principalRemaining > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const paid = summary.buckets.filter((bucket) => bucket.principalRemaining <= 0);
  const byMonth = new Map<string, Bucket[]>();
  for (const bucket of open) {
    const month = bucket.dueDate < format(today, 'yyyy-MM-dd') ? 'overdue' : bucket.dueDate.slice(0, 7);
    byMonth.set(month, [...(byMonth.get(month) ?? []), bucket]);
  }

  const title = (bucket: Bucket) =>
    bucket.installment
      ? bucket.installment.description || t('dashboard.buckets.paymentLabel')
      : t('debts.schedule.period', { period: format(new Date(bucket.statementPeriodStart.year, bucket.statementPeriodStart.month - 1, 1), 'LLLL yyyy', { locale }) });
  const meta = (bucket: Bucket) => (bucket.installment ? t('installment.paymentLine', { number: bucket.installment.number, count: bucket.installment.count }) : undefined);
  const chip = (bucket: Bucket) => {
    const days = differenceInCalendarDays(new Date(`${bucket.dueDate}T12:00:00`), today);
    if (days < 0) return <Chip size="small" color="error" label={t('dashboard.status.overdue')} />;
    if (days <= 7) return <Chip size="small" color="warning" variant="outlined" label={days === 0 ? t('overview.payments.today') : t('overview.payments.inDays', { count: days })} />;
    return null;
  };
  // Plan rows come latest first; show the nearest months.
  const planPreview = [...plan].sort((a, b) => a.year - b.year || a.month - b.month).slice(0, PLAN_MONTHS);

  return (
    <Stack spacing={2.5}>
      {open.length === 0 ? (
        <Typography color="text.secondary" sx={{ pt: 1 }}>{t('debts.schedule.empty')}</Typography>
      ) : (
        <Box>
          {Array.from(byMonth.entries()).map(([month, buckets]) => (
            <MonthGroup
              key={month}
              title={month === 'overdue' ? t('debts.overdueGroup') : capitalizeFirst(format(new Date(`${month}-15T12:00:00`), 'LLLL yyyy', { locale }))}
              total={buckets.reduce((sum, bucket) => sum + bucket.principalRemaining, 0)}
              danger={month === 'overdue'}
            >
              {buckets.map((bucket) => (
                <Row
                  key={bucket.id}
                  leading={<DateBadge date={bucket.dueDate} />}
                  title={title(bucket)}
                  meta={meta(bucket)}
                  trailing={
                    <Stack direction="row" spacing={1.5} alignItems="center" component="span">
                      {chip(bucket)}
                      <span>{formatMoney(bucket.principalRemaining)}</span>
                    </Stack>
                  }
                />
              ))}
            </MonthGroup>
          ))}
        </Box>
      )}

      {paid.length > 0 && (
        <Box>
          <Button size="small" sx={{ ml: -1 }} onClick={() => setShowPaid((current) => !current)}>
            {showPaid ? t('debts.schedule.hidePaid') : t('debts.schedule.showPaid', { count: paid.length })}
          </Button>
          {showPaid && (
            <Rows>
              {paid.map((bucket) => (
                <Row key={bucket.id} leading={<DateBadge date={bucket.dueDate} />} title={title(bucket)} meta={meta(bucket)} trailing={<Chip size="small" color="success" variant="outlined" label={t('debts.schedule.paid')} />} />
              ))}
            </Rows>
          )}
        </Box>
      )}

      {planPreview.length > 0 && (
        <Box>
          <Typography variant="subtitle1">{t('debts.schedule.planTitle')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{t('debts.schedule.planHint')}</Typography>
          <Rows>
            {planPreview.map((row) => (
              <Row
                key={`${row.year}-${row.month}`}
                leading={<DateBadge date={row.dueDate} />}
                title={capitalizeFirst(format(new Date(row.year, row.month - 1, 1), 'LLLL yyyy', { locale }))}
                trailing={formatMoney(row.amount)}
              />
            ))}
          </Rows>
        </Box>
      )}
    </Stack>
  );
}
