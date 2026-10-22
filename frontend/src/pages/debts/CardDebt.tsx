import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { differenceInCalendarDays, format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../../i18n';
import { formatMoney, formatMoneyWhole } from '../../formatMoney';
import { getDueTone, dueToneColor } from '../../dueTone';
import { getDashboard } from '../../services/api';
import type { Card, DashboardResult } from '../../types/v2';
import PurchaseForm from '../../components/PurchaseForm';
import DepositForm from '../../components/DepositForm';
import ReconciliationForm from '../../components/ReconciliationForm';
import { RowIcon } from '../../components/Row';
import CardSettings from '../CardSettings';
import CardSchedule from './CardSchedule';
import CardPurchases from './CardPurchases';
import CardHistory from './CardHistory';
import { debtIcon, type DebtsOutletContext } from './DebtsLayout';

export type CardTab = '' | 'purchases' | 'history' | 'settings';
const TABS: CardTab[] = ['', 'purchases', 'history', 'settings'];

type Operation = 'purchase' | 'payment' | 'reconciliation';

/** What a card tab gets from the page: the card, its summary and a counter that changes after each operation. */
export interface CardTabProps {
  card: Card;
  summary: DashboardResult;
  version: number;
  onChanged: () => void;
  onAddPurchase: () => void;
}

export default function CardDebt() {
  const { cardId, tab = '' } = useParams<{ cardId: string; tab: string }>();
  const context = useOutletContext<DebtsOutletContext>();
  const card = context.cards.find((item) => item.id === cardId) ?? null;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [loaded, setLoaded] = useState<{ cardId: string; summary: DashboardResult } | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!cardId) return;
    let current = true;
    setError('');
    getDashboard(cardId)
      .then((next) => current && setLoaded({ cardId, summary: next }))
      .catch(() => current && setError(t('dashboard.loadError')));
    return () => {
      current = false;
    };
  }, [cardId, version, t]);

  // Keep showing the previous summary of the same card while it reloads.
  const summary = loaded?.cardId === cardId ? loaded.summary : null;

  if (tab === 'deposits') return <Navigate to={`/cards/${cardId}/history`} replace />;
  if (!TABS.includes(tab as CardTab)) return <Navigate to={`/cards/${cardId}`} replace />;
  if (!card) return null;

  const changed = (message?: string) => {
    setVersion((current) => current + 1);
    context.reloadDebts();
    if (message) setSuccess(message);
  };
  const finish = (message: string) => {
    setOperation(null);
    changed(message);
  };
  const isInstallment = card.kind === 'installment';

  return (
    <Stack spacing={2}>
      {!isDesktop && (
        <Box>
          <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/debts')} sx={{ ml: -1 }}>
            {t('nav.debts')}
          </Button>
        </Box>
      )}

      <Paper sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <RowIcon>{debtIcon(card.kind)}</RowIcon>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h5" noWrap>{card.name}</Typography>
            <Typography variant="body2" color="text.secondary">{t(`main.createCard.kinds.${card.kind}`)}</Typography>
          </Box>
          {isDesktop && (
            <>
              <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => setOperation('purchase')}>{t('overview.purchase')}</Button>
              <Button variant="contained" startIcon={<PaymentsOutlinedIcon />} onClick={() => setOperation('payment')}>{t('overview.payment')}</Button>
            </>
          )}
          <IconButton aria-label={t('debts.more')} onClick={(event) => setMenuAnchor(event.currentTarget)}>
            <MoreHorizRoundedIcon />
          </IconButton>
          <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
            <MenuItem onClick={() => { setMenuAnchor(null); setOperation('reconciliation'); }}>
              <ListItemIcon><FactCheckOutlinedIcon fontSize="small" /></ListItemIcon>
              {t('debts.reconcile')}
            </MenuItem>
            {!isInstallment && (
              <MenuItem onClick={() => { setMenuAnchor(null); navigate(`/cards/${card.id}/history`); }}>
                <ListItemIcon><UploadFileOutlinedIcon fontSize="small" /></ListItemIcon>
                {t('debts.importStatement')}
              </MenuItem>
            )}
          </Menu>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}
        {!summary ? (
          !error && <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}><CircularProgress size={24} /></Box>
        ) : (
          <CardFigures card={card} summary={summary} />
        )}

        {!isDesktop && (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 2 }}>
            <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => setOperation('purchase')}>{t('overview.purchase')}</Button>
            <Button variant="contained" startIcon={<PaymentsOutlinedIcon />} onClick={() => setOperation('payment')}>{t('overview.payment')}</Button>
          </Box>
        )}
      </Paper>

      <Paper sx={{ px: 2.5, pb: 2.5 }}>
        <Tabs
          value={tab}
          onChange={(_, next: CardTab) => navigate(next ? `/cards/${card.id}/${next}` : `/cards/${card.id}`)}
          variant="scrollable"
          scrollButtons={false}
          sx={{ mb: 1 }}
        >
          <Tab value="" label={t('debts.tabs.schedule')} />
          <Tab value="purchases" label={t('debts.tabs.purchases')} />
          <Tab value="history" label={t('debts.tabs.history')} />
          <Tab value="settings" label={t('debts.tabs.settings')} />
        </Tabs>
        {summary && (
          <>
            {tab === '' && <CardSchedule card={card} summary={summary} version={version} onChanged={changed} onAddPurchase={() => setOperation('purchase')} />}
            {tab === 'purchases' && <CardPurchases card={card} summary={summary} version={version} onChanged={changed} onAddPurchase={() => setOperation('purchase')} />}
            {tab === 'history' && <CardHistory card={card} summary={summary} version={version} onChanged={changed} onAddPurchase={() => setOperation('purchase')} />}
          </>
        )}
        {tab === 'settings' && <CardSettings onChanged={() => changed()} />}
      </Paper>

      <Dialog open={operation !== null} onClose={() => setOperation(null)} fullWidth maxWidth="sm" fullScreen={!isDesktop && operation === 'purchase' && isInstallment}>
        <DialogTitle>
          {operation === 'purchase' ? t('overview.purchase') : operation === 'payment' ? t('overview.payment') : t('debts.reconcile')}
          <Typography variant="body2" color="text.secondary">{card.name}</Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {operation === 'purchase' && <PurchaseForm cardId={card.id} cardKind={card.kind} onSubmitted={() => finish(t('mainDashboard.purchaseAdded'))} />}
            {operation === 'payment' && <DepositForm cardId={card.id} onSubmitted={() => finish(t('mainDashboard.depositAdded'))} />}
            {operation === 'reconciliation' && summary && <ReconciliationForm cardId={card.id} calculatedDebt={summary.totalRemaining} onSubmitted={() => finish(t('debts.reconciled'))} />}
          </Box>
        </DialogContent>
      </Dialog>
      <Snackbar open={Boolean(success)} autoHideDuration={3000} onClose={() => setSuccess('')}>
        <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>
      </Snackbar>
    </Stack>
  );
}

function CardFigures({ card, summary }: { card: Card; summary: DashboardResult }) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const today = new Date();
  const tone = getDueTone(summary.nextDueDate, today);
  const days = summary.nextDueDate ? differenceInCalendarDays(new Date(`${summary.nextDueDate}T12:00:00`), today) : null;
  const when =
    days === null ? '' : days < 0 ? t('debts.figures.overdue') : days === 0 ? t('overview.payments.today') : t('overview.payments.inDays', { count: days });

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
      <Figure
        label={t('debts.figures.next')}
        value={summary.nextDueDate ? formatMoney(summary.recommendedDeposit) : '—'}
        note={summary.nextDueDate ? `${format(new Date(`${summary.nextDueDate}T12:00:00`), 'd MMMM', { locale })} · ${when}` : t('debts.nothingDue')}
        noteColor={dueToneColor[tone]}
        sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
      />
      <Figure label={t('debts.figures.remaining')} value={formatMoneyWhole(summary.totalRemaining)} />
      <Figure
        label={t(card.kind === 'installment' ? 'debts.figures.month' : 'debts.figures.recommended')}
        value={formatMoneyWhole(summary.currentMonthAmount)}
        note={t(card.kind === 'installment' ? 'debts.figures.monthHint' : 'debts.figures.recommendedHint')}
      />
    </Box>
  );
}

function Figure({ label, value, note, noteColor, sx }: { label: string; value: string; note?: string; noteColor?: string; sx?: object }) {
  return (
    <Box sx={sx}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography sx={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</Typography>
      {note && <Typography variant="caption" sx={{ color: noteColor ?? 'text.secondary' }}>{note}</Typography>}
    </Box>
  );
}
