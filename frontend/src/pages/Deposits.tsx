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
import DepositForm from '../components/DepositForm';
import { getDeposits } from '../services/api';
import type { Deposit } from '../types/v2';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';
import { formatMoney } from '../formatMoney';

export default function Deposits() {
  const { cardId } = useParams<{ cardId: string }>();
  if (!cardId) return null;
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [list, setList] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    getDeposits(cardId)
      .then(setList)
      .catch(() => setError(t('deposits.loadError')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [cardId]);

  if (loading) return <CircularProgress />;

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h5">{t('deposits.title')}</Typography>
        <Typography color="text.secondary">{t('deposits.subtitle')}</Typography>
      </Stack>
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Stack spacing={3}>
        <Paper sx={{ p: 3 }}>
          <DepositForm cardId={cardId} title={t('deposits.add.title')} onSubmitted={load} />
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">{t('deposits.historyTitle')}</Typography>
              <Typography color="text.secondary">{t('deposits.historySubtitle')}</Typography>
            </Box>
            <Box sx={{ overflow: 'auto', maxHeight: 'min(65vh, 720px)' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('deposits.table.date')}</TableCell>
                    <TableCell align="right">{t('deposits.table.amount')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} sx={{ py: 6, color: 'text.secondary', textAlign: 'center' }}>
                        {t('deposits.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    list.map((deposit) => (
                      <TableRow key={deposit.id}>
                        <TableCell>{format(new Date(deposit.depositDate), 'P', { locale })}</TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatMoney(deposit.amount)}
                        </TableCell>
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
