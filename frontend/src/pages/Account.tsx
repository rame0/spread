import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import AccountForm, { INTEREST_KINDS } from '../components/AccountForm';
import SavingsSection from '../components/SavingsSection';
import PortfolioCard from '../components/PortfolioCard';
import { FormField, LabeledTextField } from '../components/FormField';
import NetWorthChart from '../components/NetWorthChart';
import { formatCurrency } from '../formatMoney';
import { getDateFnsLocale } from '../i18n';
import {
  deleteAccount,
  deleteAccountBalance,
  getAccount,
  getAccountBalances,
  getAccountPortfolio,
  getSavings,
  patchAccount,
  saveAccountBalance,
} from '../services/api';
import type { Account as AccountType, AccountBalance, AccountPortfolio, SavingsSummary } from '../types/v2';

const parseDate = (value: string) => new Date(`${value}T00:00:00`);
const todayString = () => format(new Date(), 'yyyy-MM-dd');

export default function Account() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [account, setAccount] = useState<AccountType | null>(null);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [savings, setSavings] = useState<SavingsSummary | null>(null);
  const [portfolio, setPortfolio] = useState<AccountPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [balanceDate, setBalanceDate] = useState<Date | null>(new Date());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const load = () => {
    if (!accountId) return;
    Promise.all([getAccount(accountId), getAccountBalances(accountId)])
      .then(async ([nextAccount, nextBalances]) => {
        setSavings(INTEREST_KINDS.includes(nextAccount.kind) ? await getSavings(accountId) : null);
        setPortfolio(nextAccount.externalSource ? await getAccountPortfolio(accountId) : null);
        setAccount(nextAccount);
        setBalances(nextBalances);
      })
      .catch(() => setError(t('accounts.loadError')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [accountId]);

  if (!accountId) return null;
  if (loading) return <CircularProgress />;
  if (!account) return <Alert severity="error">{error || t('accounts.notFound')}</Alert>;

  const notify = (message: string) => {
    setSuccess(message);
    load();
  };

  const saveBalance = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount.replace(',', '.'));
    if (!balanceDate || amount.trim() === '' || !Number.isFinite(value)) {
      setError(t('accounts.form.validation'));
      return;
    }
    saveAccountBalance(account.id, format(balanceDate, 'yyyy-MM-dd'), { amount: value, note: note.trim() || null })
      .then(() => {
        setAmount('');
        setNote('');
        notify(t('accounts.balanceSaved'));
      })
      .catch(() => setError(t('accounts.balanceError')));
  };

  const editBalance = (balance: AccountBalance) => {
    setBalanceDate(parseDate(balance.balanceDate));
    setAmount(String(balance.amount));
    setNote(balance.note ?? '');
  };

  const newestFirst = [...balances].reverse();
  const reconciliationByDate = new Map((savings?.savings?.reconciliations ?? []).map((row) => [row.date, row]));
  const showReconciliation = reconciliationByDate.size > 0;

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="h5">{account.name}</Typography>
          <Chip size="small" variant="outlined" label={t(`accounts.kinds.${account.kind}`)} />
          <Chip size="small" variant="outlined" label={account.currency} />
          {account.externalSource === 'tinvest' && <Chip size="small" color="primary" variant="outlined" label={t('portfolio.synced')} />}
          {account.archivedAt && (
            <Chip size="small" color="warning" label={t('accounts.archivedSince', { date: format(parseDate(account.archivedAt), 'd MMMM yyyy', { locale }) })} />
          )}
        </Stack>
        {account.institution && <Typography color="text.secondary">{account.institution}</Typography>}
      </Stack>
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {portfolio && <PortfolioCard portfolio={portfolio} />}

      {savings && <SavingsSection account={account} summary={savings} onChanged={notify} onError={setError} />}

      <Paper sx={{ p: 3 }}>
        <Stack component="form" spacing={2} onSubmit={saveBalance}>
          <Box>
            <Typography variant="h6">{savings?.savings ? t('savings.bankBalanceTitle') : t('accounts.page.balanceTitle')}</Typography>
            <Typography color="text.secondary">{savings?.savings ? t('savings.bankBalanceHint') : t('accounts.page.balanceHint')}</Typography>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2 }}>
            <FormField label={t('accounts.page.date')}>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={locale}>
                <DatePicker value={balanceDate} onChange={setBalanceDate} disableFuture slotProps={{ textField: { fullWidth: true } }} />
              </LocalizationProvider>
            </FormField>
            <LabeledTextField
              fullWidth
              label={t('accounts.page.amount', { currency: account.currency })}
              type="number"
              inputProps={{ step: 0.01 }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <LabeledTextField fullWidth label={t('accounts.page.note')} value={note} onChange={(e) => setNote(e.target.value)} />
          </Box>
          <Button type="submit" variant="contained" sx={{ alignSelf: 'flex-start' }}>
            {t('accounts.page.save')}
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">{t('accounts.page.historyTitle')}</Typography>
          {balances.length === 0 ? (
            <Typography color="text.secondary">{t('accounts.noBalance')}</Typography>
          ) : (
            <>
              {balances.length > 1 && (
                <Box sx={{ mx: -2 }}>
                  <NetWorthChart
                    data={balances.map((balance) => ({ date: balance.balanceDate, amount: balance.amount }))}
                    series={[{ key: 'amount', label: account.name, color: 'var(--accent)' }]}
                    formatValue={(value) => formatCurrency(value, account.currency)}
                  />
                </Box>
              )}
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('accounts.page.date')}</TableCell>
                      <TableCell align="right">{t('accounts.page.balance')}</TableCell>
                      {showReconciliation && <TableCell align="right">{t('savings.expected')}</TableCell>}
                      {showReconciliation && <TableCell align="right">{t('savings.difference')}</TableCell>}
                      <TableCell align="right">{t('accounts.page.change')}</TableCell>
                      <TableCell>{t('accounts.page.note')}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {newestFirst.map((balance, index) => {
                      const previous = newestFirst[index + 1];
                      const change = previous ? Math.round((balance.amount - previous.amount) * 100) / 100 : null;
                      const reconciliation = reconciliationByDate.get(balance.balanceDate);
                      return (
                        <TableRow key={balance.id} hover onClick={() => editBalance(balance)} sx={{ cursor: 'pointer' }}>
                          <TableCell>{format(parseDate(balance.balanceDate), 'd MMMM yyyy', { locale })}</TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(balance.amount, account.currency)}
                          </TableCell>
                          {showReconciliation && (
                            <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>
                              {reconciliation ? formatCurrency(reconciliation.expected, account.currency) : '—'}
                            </TableCell>
                          )}
                          {showReconciliation && (
                            <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: reconciliation && Math.abs(reconciliation.difference) >= 0.01 ? 'warning.main' : 'text.secondary' }}>
                              {reconciliation ? `${reconciliation.difference > 0 ? '+' : ''}${formatCurrency(reconciliation.difference, account.currency)}` : '—'}
                            </TableCell>
                          )}
                          <TableCell
                            align="right"
                            sx={{ fontVariantNumeric: 'tabular-nums', color: change === null || change === 0 ? 'text.secondary' : change > 0 ? 'success.main' : 'error.main' }}
                          >
                            {change === null ? '—' : `${change > 0 ? '+' : ''}${formatCurrency(change, account.currency)}`}
                          </TableCell>
                          <TableCell>{balance.note}</TableCell>
                          <TableCell align="right">
                            <Tooltip title={t('accounts.page.deleteBalance')}>
                              <IconButton
                                size="small"
                                aria-label={t('accounts.page.deleteBalance')}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteAccountBalance(account.id, balance.balanceDate)
                                    .then(() => notify(t('accounts.page.balanceDeleted')))
                                    .catch(() => setError(t('accounts.balanceError')));
                                }}
                              >
                                <DeleteOutlineRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
            </>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">{t('accounts.page.settingsTitle')}</Typography>
          <AccountForm
            key={account.id}
            initial={account}
            submitLabel={t('accounts.form.save')}
            onSubmit={(values) => patchAccount(account.id, values).then(() => notify(t('accounts.page.saved')))}
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              onClick={() =>
                patchAccount(account.id, { archivedAt: account.archivedAt ? null : todayString() })
                  .then(() => notify(account.archivedAt ? t('accounts.page.restored') : t('accounts.page.archivedDone')))
                  .catch(() => setError(t('accounts.form.error')))
              }
            >
              {account.archivedAt ? t('accounts.page.restore') : t('accounts.page.archive')}
            </Button>
            <Button color="error" variant="outlined" onClick={() => setDeleteOpen(true)}>
              {t('accounts.page.delete')}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {t('accounts.page.archiveHint')}
          </Typography>
        </Stack>
      </Paper>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>{t('accounts.page.deleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('accounts.page.deleteText', { count: balances.length })}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>{t('accounts.page.cancel')}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() =>
              deleteAccount(account.id)
                .then(() => navigate('/accounts', { replace: true }))
                .catch(() => {
                  setDeleteOpen(false);
                  setError(t('accounts.form.error'));
                })
            }
          >
            {t('accounts.page.deleteConfirm')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(success)} autoHideDuration={3000} onClose={() => setSuccess('')}>
        <Alert severity="success" onClose={() => setSuccess('')}>
          {success}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
