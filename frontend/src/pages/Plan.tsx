import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
} from '@mui/material';
import { getPlan } from '../services/api';
import type { PeriodPlanRow } from '../types/v2';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';

export default function Plan() {
  const { cardId } = useParams<{ cardId: string }>();
  if (!cardId) return null;
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [rows, setRows] = useState<PeriodPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getPlan(cardId)
      .then(setRows)
      .catch(() => setError(t('plan.loadError')))
      .finally(() => setLoading(false));
  }, [cardId, t]);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('plan.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {t('plan.subtitle')}
      </Typography>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('plan.table.period')}</TableCell>
              <TableCell>{t('plan.table.deadline')}</TableCell>
              <TableCell align="right">{t('plan.table.amount')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>{t('plan.empty')}</TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={`${r.year}-${r.month}`}>
                  <TableCell>
                    {format(new Date(r.year, r.month - 1, 1), 'LLLL yyyy', { locale })}
                  </TableCell>
                  <TableCell>
                    {format(new Date(r.dueDate), 'd MMMM yyyy', { locale })}
                  </TableCell>
                  <TableCell align="right">{r.amount.toFixed(2)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
