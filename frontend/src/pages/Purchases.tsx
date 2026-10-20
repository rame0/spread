import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Alert,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import PurchaseForm from '../components/PurchaseForm';
import { getPurchases } from '../services/api';
import type { Purchase } from '../types/v2';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';
import { formatMoney } from '../formatMoney';
import { useCurrentCard } from '../cardContext';

export default function Purchases() {
  const { cardId } = useParams<{ cardId: string }>();
  const card = useCurrentCard();
  if (!cardId) return null;
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [list, setList] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    getPurchases(cardId)
      .then(setList)
      .catch(() => setError(t('purchases.loadError')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [cardId]);

  if (loading) return <CircularProgress />;
  const isInstallment = card?.kind === 'installment';

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h5">{t('purchases.title')}</Typography>
        <Typography color="text.secondary">{t('purchases.subtitle')}</Typography>
      </Stack>
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Stack spacing={3}>
        <Paper sx={{ p: 3 }}>
          <PurchaseForm cardId={cardId} cardKind={card?.kind} title={t('purchases.add.title')} onSubmitted={load} />
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">{t('purchases.historyTitle')}</Typography>
              <Typography color="text.secondary">{t('purchases.historySubtitle')}</Typography>
            </Box>
            <Box sx={{ overflow: 'auto', maxHeight: 'min(65vh, 720px)' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('purchases.table.date')}</TableCell>
                    <TableCell align="right">{t('purchases.table.amount')}</TableCell>
                    <TableCell>{t('purchases.table.description')}</TableCell>
                    {isInstallment && <TableCell>{t('purchases.table.plan')}</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isInstallment ? 4 : 3} sx={{ py: 6, color: 'text.secondary', textAlign: 'center' }}>
                        {t('purchases.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    list.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell>{format(new Date(purchase.purchaseDate), 'P', { locale })}</TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatMoney(purchase.amount)}
                        </TableCell>
                        <TableCell>{purchase.description ?? t('purchases.emptyDescription')}</TableCell>
                        {isInstallment && (
                          <TableCell sx={{ minWidth: 220 }}>
                            {purchase.installments && <InstallmentProgress progress={purchase.installments} locale={locale} />}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Box>
          </Stack>
        </Paper>
      </Stack>
    </Stack>
  );
}

function InstallmentProgress({
  progress,
  locale,
}: {
  progress: NonNullable<Purchase['installments']>;
  locale: ReturnType<typeof getDateFnsLocale>;
}) {
  const { t } = useTranslation();
  if (!progress.nextDueDate) {
    return <Chip size="small" color="success" variant="outlined" label={t('installment.completed')} />;
  }
  return (
    <Stack spacing={0.5} alignItems="flex-start">
      <Typography variant="body2">{t('installment.progress', { paid: progress.paid, count: progress.count })}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {t('installment.nextPayment', {
          date: format(new Date(`${progress.nextDueDate}T00:00:00`), 'd MMM yyyy', { locale }),
          amount: formatMoney(progress.nextDueAmount),
        })}
      </Typography>
      {progress.overdue && <Chip size="small" color="error" label={t('installment.overdue')} />}
    </Stack>
  );
}
