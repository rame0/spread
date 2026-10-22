import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  Dialog,
  DialogContent,
  Stack,
  SwipeableDrawer,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';
import { currencySymbol, formatCurrency, formatMoney } from '../formatMoney';
import { buildInstallmentSchedule, defaultFirstPaymentDate } from '../installmentSchedule';
import {
  addDeposit,
  addMortgageEvent,
  addPurchase,
  createAccountEvent,
  getAccounts,
  getMainDashboard,
  getNetWorth,
  getPurchaseDueDate,
  saveAccountBalance,
} from '../services/api';
import type { Account, Card, MainDashboardResult, Mortgage, NetWorthAssetLine } from '../types/v2';
import DateField from './DateField';
import { FormField } from './FormField';

export type QuickKind = 'purchase' | 'payment' | 'balance' | 'transfer';
const KINDS: Array<{ kind: QuickKind; icon: React.ReactElement }> = [
  { kind: 'purchase', icon: <ShoppingBagOutlinedIcon /> },
  { kind: 'payment', icon: <PaymentsOutlinedIcon /> },
  { kind: 'balance', icon: <RefreshRoundedIcon /> },
  { kind: 'transfer', icon: <SwapHorizRoundedIcon /> },
];
const INSTALLMENT_COUNTS = [2, 4, 6, 12, 24];

const parseAmount = (value: string) => Number(value.replace(/\s/g, '').replace(',', '.'));
const asLocalDate = (value: string) => new Date(`${value}T12:00:00`);

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with a message after something was saved. */
  onDone: (message: string) => void;
  cards: Card[];
  mortgages: Mortgage[];
}

/** One sheet for the frequent operations: purchase, payment, today's balance, transfer between accounts. */
export default function QuickAdd({ open, onClose, onDone, cards, mortgages }: Props) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const today = format(new Date(), 'yyyy-MM-dd');
  const [kind, setKind] = useState<QuickKind>('purchase');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState('');
  const [cardId, setCardId] = useState('');
  const [debtId, setDebtId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [count, setCount] = useState(4);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lines, setLines] = useState<NetWorthAssetLine[]>([]);
  const [debts, setDebts] = useState<MainDashboardResult | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setAmount('');
    setDescription('');
    setDate(today);
    Promise.all([getAccounts(), getNetWorth(0), getMainDashboard()])
      .then(([nextAccounts, netWorth, nextDebts]) => {
        setAccounts(nextAccounts);
        setLines(netWorth.assets.lines);
        setDebts(nextDebts);
      })
      .catch(() => setError(t('quickAdd.loadError')));
  }, [open]);

  useEffect(() => {
    if (!cardId && cards[0]) setCardId(cards[0].id);
    if (!debtId) setDebtId(cards[0]?.id ?? mortgages[0]?.id ?? '');
  }, [cards, mortgages]);

  // Accounts synced from a broker are not edited by hand.
  const editable = useMemo(() => {
    const external = new Set(accounts.filter((account) => account.externalSource).map((account) => account.id));
    return lines.filter((line) => !external.has(line.accountId));
  }, [accounts, lines]);
  const money = editable.filter((line) => line.kind !== 'property');
  useEffect(() => {
    if (!money.some((line) => line.accountId === accountId)) setAccountId(money[0]?.accountId ?? '');
  }, [money.length]);

  const card = cards.find((item) => item.id === cardId) ?? null;
  const line = editable.find((item) => item.accountId === accountId) ?? null;
  const target = money.find((item) => item.accountId === toAccountId) ?? null;
  const transferTargets = money.filter((item) => item.accountId !== accountId && item.currency === line?.currency);
  useEffect(() => {
    if (!transferTargets.some((item) => item.accountId === toAccountId)) setToAccountId(transferTargets[0]?.accountId ?? '');
  }, [accountId, transferTargets.length]);

  const value = parseAmount(amount);
  const valid = amount.trim() !== '' && Number.isFinite(value) && value > 0;
  const debt = debts?.cards.find((item) => item.id === debtId) ?? null;

  useEffect(() => {
    setDueDate(null);
    if (!open || kind !== 'purchase' || !card || card.kind === 'installment' || !date) return;
    let current = true;
    getPurchaseDueDate(card.id, date)
      .then((next) => current && setDueDate(next))
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [open, kind, cardId, date]);

  const installment = card?.kind === 'installment' && valid && date
    ? buildInstallmentSchedule({ amount: value, fee: 0, count, interval: 'month', firstPaymentDate: defaultFirstPaymentDate(date, 'month') })
    : [];

  const consequence = (): string | null => {
    if (!valid) return null;
    if (kind === 'purchase') {
      if (installment.length > 0) {
        return t('quickAdd.installmentPlan', { count: installment.length, amount: formatMoney(installment[0].amount), date: format(asLocalDate(installment[0].dueDate), 'd MMMM', { locale }) });
      }
      return dueDate ? t('quickAdd.payBy', { date: format(asLocalDate(dueDate), 'd MMMM yyyy', { locale }) }) : null;
    }
    if (kind === 'payment' && debt) {
      return debt.kind === 'mortgage' ? t('quickAdd.mortgagePayment') : t('quickAdd.debtAfter', { amount: formatMoney(Math.max(0, debt.totalRemaining - value)) });
    }
    if (kind === 'balance' && line) {
      const delta = value - (line.amount ?? 0);
      return t('quickAdd.balanceChange', { amount: `${delta >= 0 ? '+' : '−'}${formatCurrency(Math.abs(delta), line.currency)}` });
    }
    if (kind === 'transfer' && line && target) {
      const after = (item: NetWorthAssetLine, sign: number) => formatCurrency((item.amount ?? 0) + sign * value, item.currency);
      return t('quickAdd.transferAfter', { from: line.name, fromAmount: after(line, -1), to: target.name, toAmount: after(target, 1) });
    }
    return null;
  };

  /** Moves money in or out of an account: an event where the balance is calculated, otherwise a new balance for today. */
  const shift = (item: NetWorthAssetLine, delta: number): Promise<unknown> =>
    item.computed
      ? createAccountEvent(item.accountId, { kind: delta > 0 ? 'top_up' : 'withdrawal', eventDate: today, amount: Math.abs(delta) })
      : saveAccountBalance(item.accountId, today, { amount: Math.round(((item.amount ?? 0) + delta) * 100) / 100 });

  const submit = () => {
    if (!valid) return;
    setSaving(true);
    setError('');
    let action: Promise<unknown>;
    let message: string;
    if (kind === 'purchase' && card) {
      action = addPurchase(card.id, {
        purchaseDate: date,
        amount: value,
        description: description.trim() || undefined,
        plan: card.kind === 'installment' ? { installmentCount: count, installmentInterval: 'month', firstPaymentDate: defaultFirstPaymentDate(date, 'month'), installmentFee: 0 } : undefined,
      });
      message = t('mainDashboard.purchaseAdded');
    } else if (kind === 'payment' && debt) {
      action = debt.kind === 'mortgage'
        ? addMortgageEvent(debt.id, { kind: 'payment', eventDate: date, amount: value })
        : addDeposit(debt.id, { depositDate: date, amount: value });
      message = t('mainDashboard.depositAdded');
    } else if (kind === 'balance' && line) {
      action = saveAccountBalance(line.accountId, today, { amount: value });
      message = t('accounts.balanceSaved');
    } else if (kind === 'transfer' && line && target) {
      action = shift(line, -value).then(() => shift(target, value));
      message = t('quickAdd.transferred');
    } else {
      setSaving(false);
      return;
    }
    action
      .then(() => {
        onDone(message);
        onClose();
      })
      .catch(() => setError(t('quickAdd.saveError')))
      .finally(() => setSaving(false));
  };

  const chips = <T,>(items: T[], id: (item: T) => string, label: (item: T) => string, selected: string, onSelect: (id: string) => void) => (
    <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5, mx: -0.5, px: 0.5 }}>
      {items.map((item) => (
        <Chip
          key={id(item)}
          label={label(item)}
          onClick={() => onSelect(id(item))}
          color={id(item) === selected ? 'primary' : 'default'}
          variant={id(item) === selected ? 'filled' : 'outlined'}
          sx={{ flex: 'none' }}
        />
      ))}
    </Stack>
  );

  const currency = kind === 'balance' || kind === 'transfer' ? line?.currency ?? 'RUB' : 'RUB';
  const needsDate = kind === 'purchase' || kind === 'payment';
  const result = consequence();
  const debtOptions = [
    ...cards.map((item) => ({ id: item.id, name: item.name })),
    ...mortgages.map((item) => ({ id: item.id, name: item.name })),
  ];

  const body = (
    <Stack spacing={2}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
        {KINDS.map((item) => (
          <ButtonBase
            key={item.kind}
            onClick={() => setKind(item.kind)}
            sx={{
              flexDirection: 'column',
              gap: 0.5,
              py: 1.25,
              borderRadius: '12px',
              fontSize: 12,
              fontWeight: 500,
              bgcolor: kind === item.kind ? 'var(--accent-soft)' : 'var(--surface-2)',
              color: kind === item.kind ? 'primary.main' : 'text.secondary',
              '& svg': { fontSize: 20 },
            }}
          >
            {item.icon}
            {t(`quickAdd.kinds.${item.kind}`)}
          </ButtonBase>
        ))}
      </Box>

      <TextField
        autoFocus={isDesktop}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder="0"
        variant="standard"
        inputProps={{ inputMode: 'decimal', 'aria-label': t('quickAdd.amount'), style: { textAlign: 'center', fontSize: 36, fontWeight: 600, fontVariantNumeric: 'tabular-nums' } }}
        InputProps={{ disableUnderline: true, endAdornment: <Typography sx={{ fontSize: 28, color: 'text.secondary', ml: 1 }}>{currencySymbol(currency)}</Typography> }}
        sx={{ '& .MuiInputBase-root': { justifyContent: 'center' }, '& input': { width: '6ch', flex: 'none' } }}
      />

      {kind === 'purchase' && (
        <>
          <FormField label={t('quickAdd.paidWith')}>{chips(cards, (item) => item.id, (item) => item.name, cardId, setCardId)}</FormField>
          {card?.kind === 'installment' && (
            <FormField label={t('installment.count')}>
              {chips(INSTALLMENT_COUNTS, String, String, String(count), (next) => setCount(Number(next)))}
            </FormField>
          )}
        </>
      )}
      {kind === 'payment' && (
        <FormField label={t('quickAdd.debt')}>
          {chips(debtOptions, (item) => item.id, (item) => item.name, debtId, (next) => {
            setDebtId(next);
            const nextDebt = debts?.cards.find((item) => item.id === next);
            if (nextDebt?.nextDueAmount && !amount) setAmount(String(nextDebt.nextDueAmount));
          })}
        </FormField>
      )}
      {(kind === 'balance' || kind === 'transfer') && (
        <FormField label={kind === 'transfer' ? t('quickAdd.from') : t('quickAdd.account')}>
          {chips(money, (item) => item.accountId, (item) => item.name, accountId, setAccountId)}
        </FormField>
      )}
      {kind === 'transfer' && (
        <FormField label={t('quickAdd.to')}>
          {transferTargets.length > 0
            ? chips(transferTargets, (item) => item.accountId, (item) => item.name, toAccountId, setToAccountId)
            : <Typography variant="body2" color="text.secondary">{t('quickAdd.noTargets')}</Typography>}
        </FormField>
      )}
      {kind === 'balance' && line && (
        <Typography variant="body2" color="text.secondary">
          {t('quickAdd.was', { amount: line.amount === null ? '—' : formatCurrency(line.amount, line.currency) })}
        </Typography>
      )}

      {needsDate && (
        <Box sx={{ display: 'grid', gridTemplateColumns: kind === 'purchase' ? '1fr 1fr' : '1fr', gap: 1.5 }}>
          <DateField label={t('quickAdd.date')} value={date} onChange={setDate} />
          {kind === 'purchase' && (
            <FormField label={t('purchases.add.description')}>
              <TextField value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t('quickAdd.optional')} inputProps={{ 'aria-label': t('purchases.add.description') }} />
            </FormField>
          )}
        </Box>
      )}

      {result && <Typography variant="body2" color="text.secondary">{result}</Typography>}
      {kind === 'transfer' && <Typography variant="caption" color="text.disabled">{t('quickAdd.transferHint')}</Typography>}
      {error && <Alert severity="error">{error}</Alert>}

      <Button variant="contained" size="large" disabled={!valid || saving} onClick={submit} sx={{ minHeight: 48 }}>
        {t(`quickAdd.submit.${kind}`)}
      </Button>
    </Stack>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
        <DialogContent sx={{ pt: 3 }}>{body}</DialogContent>
      </Dialog>
    );
  }

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => undefined}
      disableSwipeToOpen
      PaperProps={{ sx: { borderRadius: '18px 18px 0 0', border: 0, borderTop: '1px solid var(--border)', maxHeight: '92vh', px: 2, pt: 1.25, pb: 'calc(16px + env(safe-area-inset-bottom))' } }}
    >
      <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'var(--border)', mx: 'auto', mb: 2 }} />
      {body}
    </SwipeableDrawer>
  );
}
