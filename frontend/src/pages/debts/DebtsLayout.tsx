import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../../i18n';
import { formatMoney, formatMoneyCompact, formatMoneyWhole } from '../../formatMoney';
import { getMainDashboard } from '../../services/api';
import type { DebtKind, MainDashboardResult } from '../../types/v2';
import type { CardsOutletContext } from '../../cardContext';
import { DateBadge, Row, RowIcon } from '../../components/Row';

export interface DebtsOutletContext extends CardsOutletContext {
  /** Debt totals for the list; reload after an operation changes them. */
  debts: MainDashboardResult | null;
  reloadDebts: () => void;
}

export const DEBT_GROUPS: DebtKind[] = ['installment', 'credit', 'mortgage'];

export const debtIcon = (kind: DebtKind) =>
  kind === 'mortgage' ? <HomeOutlinedIcon /> : kind === 'installment' ? <PaymentsOutlinedIcon /> : <CreditCardOutlinedIcon />;

/** Debts section: the list of debts next to the selected one; on phones one of them at a time. */
export default function DebtsLayout() {
  const parent = useOutletContext<CardsOutletContext>();
  const { t } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const location = useLocation();
  const [debts, setDebts] = useState<MainDashboardResult | null>(null);
  const [error, setError] = useState('');

  const reloadDebts = () => {
    getMainDashboard()
      .then(setDebts)
      .catch(() => setError(t('mainDashboard.loadError')));
  };

  useEffect(reloadDebts, [t, parent.cards, parent.mortgages]);

  const context: DebtsOutletContext = { ...parent, debts, reloadDebts };
  const onIndex = location.pathname === '/debts';

  if (!isDesktop) {
    return onIndex ? <DebtList debts={debts} error={error} context={context} /> : <Outlet context={context} />;
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: 2.5, alignItems: 'start' }}>
      <Box sx={{ position: 'sticky', top: 28 }}>
        <DebtList debts={debts} error={error} context={context} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Outlet context={context} />
      </Box>
    </Box>
  );
}

function DebtList({ debts, error, context }: { debts: MainDashboardResult | null; error: string; context: DebtsOutletContext }) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const navigate = useNavigate();
  const location = useLocation();
  const { cardId, mortgageId } = useParams<{ cardId: string; mortgageId: string }>();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
  const selectedId = cardId ?? mortgageId ?? null;

  const item = (key: string, selected: boolean, icon: React.ReactElement, title: string, meta: React.ReactNode, metaColor: string | undefined, amount: string, path: string) => (
    <ButtonBase
      key={key}
      onClick={() => navigate(path)}
      sx={{ display: 'flex', width: '100%', gap: 1.5, px: 1.5, py: 1.25, borderRadius: '10px', textAlign: 'left', justifyContent: 'flex-start', bgcolor: selected ? 'var(--surface-2)' : undefined, '&:hover': { bgcolor: 'var(--surface-2)' } }}
    >
      <RowIcon>{icon}</RowIcon>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 500 }} noWrap>{title}</Typography>
        <Typography variant="caption" sx={{ color: metaColor ?? 'text.secondary', display: 'block' }} noWrap>{meta}</Typography>
      </Box>
      <Typography sx={{ fontWeight: selected ? 600 : 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{amount}</Typography>
    </ButtonBase>
  );

  return (
    <Stack spacing={isDesktop ? 1.5 : 2}>
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Typography variant="h4">{t('nav.debts')}</Typography>
          <Button size="small" startIcon={<AddRoundedIcon />} onClick={(event) => setAddAnchor(event.currentTarget)}>
            {t('debts.add')}
          </Button>
          <Menu anchorEl={addAnchor} open={Boolean(addAnchor)} onClose={() => setAddAnchor(null)}>
            <MenuItem onClick={() => { setAddAnchor(null); context.openAddCard(); }}>{t('debts.addCard')}</MenuItem>
            <MenuItem onClick={() => { setAddAnchor(null); context.openAddMortgage(); }}>{t('debts.addMortgage')}</MenuItem>
          </Menu>
        </Stack>
        {debts && (
          <Typography color="text.secondary" variant="body2">
            {t('debts.summary', { total: formatMoneyCompact(debts.totalRemaining, i18n.language), month: formatMoneyWhole(debts.dueThisMonth) })}
          </Typography>
        )}
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      <Paper sx={{ p: 0.75 }}>
        {item('all', location.pathname === '/debts', <CalendarMonthOutlinedIcon />, t('debts.calendar'), t('debts.calendarHint'), undefined, debts ? formatMoneyWhole(debts.payments.reduce((sum, payment) => sum + payment.amount, 0)) : '', '/debts')}
        {!debts ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}><CircularProgress size={22} /></Box>
        ) : (
          DEBT_GROUPS.map((kind) => {
            const rows = debts.cards.filter((card) => card.kind === kind);
            if (rows.length === 0) return null;
            return (
              <Box key={kind}>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', px: 1.5, pt: 1.5, pb: 0.5, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  {t(`debts.groups.${kind}`)}
                </Typography>
                {rows.map((debt) => {
                  const overdue = debt.overdueAmount > 0;
                  const meta = overdue
                    ? t('debts.overdue', { amount: formatMoneyWhole(debt.overdueAmount) })
                    : debt.nextDueDate
                      ? t('debts.next', { amount: formatMoneyWhole(debt.nextDueAmount), date: format(new Date(`${debt.nextDueDate.slice(0, 10)}T12:00:00`), 'd MMM', { locale }) })
                      : t('debts.nothingDue');
                  return item(
                    debt.id,
                    debt.id === selectedId,
                    debtIcon(debt.kind),
                    debt.name,
                    meta,
                    overdue ? 'error.main' : undefined,
                    formatMoneyCompact(debt.totalRemaining, i18n.language),
                    debt.kind === 'mortgage' ? `/mortgages/${debt.id}` : `/cards/${debt.id}`
                  );
                })}
              </Box>
            );
          })
        )}
      </Paper>
      {!isDesktop && debts && <DebtsCalendar debts={debts} />}
    </Stack>
  );
}

/** Upcoming payments across all debts, grouped by month. */
export function DebtsCalendar({ debts }: { debts: MainDashboardResult }) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const navigate = useNavigate();
  const byMonth = new Map<string, MainDashboardResult['payments']>();
  for (const payment of debts.payments) {
    const month = payment.status === 'overdue' ? 'overdue' : payment.dueDate.slice(0, 7);
    byMonth.set(month, [...(byMonth.get(month) ?? []), payment]);
  }

  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="subtitle1" sx={{ mb: 0.5 }}>{t('debts.calendarTitle')}</Typography>
      {debts.payments.length === 0 && <Typography color="text.secondary">{t('overview.payments.empty')}</Typography>}
      {Array.from(byMonth.entries()).map(([month, payments]) => (
        <MonthGroup
          key={month}
          title={month === 'overdue' ? t('debts.overdueGroup') : capitalizeFirst(format(new Date(`${month}-15T12:00:00`), 'LLLL', { locale }))}
          total={payments.reduce((sum, payment) => sum + payment.amount, 0)}
          danger={month === 'overdue'}
        >
          {payments.map((payment) => (
            <Row
              key={`${payment.cardId}-${payment.dueDate}`}
              leading={<DateBadge date={payment.dueDate} />}
              title={payment.cardName}
              meta={t(`mainDashboard.kinds.${payment.kind}`)}
              trailing={formatMoney(payment.amount)}
              onClick={() => navigate(payment.kind === 'mortgage' ? `/mortgages/${payment.cardId}` : `/cards/${payment.cardId}`)}
            />
          ))}
        </MonthGroup>
      ))}
    </Paper>
  );
}

export const capitalizeFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Month heading with its total, rows below. */
export function MonthGroup({ title, total, danger, children }: { title: string; total: number; danger?: boolean; children: React.ReactNode }) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" sx={{ pt: 1.75, pb: 0.5, color: danger ? 'error.main' : undefined }}>
        <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
        <Typography sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatMoneyWhole(total)}</Typography>
      </Stack>
      <Box sx={{ '& > * + *': { borderTop: '1px solid var(--border)' } }}>{children}</Box>
    </Box>
  );
}

/** Right side of the section when no debt is selected. */
export function DebtsIndex() {
  const { debts } = useOutletContext<DebtsOutletContext>();
  if (!debts) return null;
  return <DebtsCalendar debts={debts} />;
}
