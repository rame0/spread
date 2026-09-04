import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Alert,
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

export default function Purchases() {
  const { cardId } = useParams<{ cardId: string }>();
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
          <PurchaseForm cardId={cardId} title={t('purchases.add.title')} onSubmitted={load} />
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
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} sx={{ py: 6, color: 'text.secondary', textAlign: 'center' }}>
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
