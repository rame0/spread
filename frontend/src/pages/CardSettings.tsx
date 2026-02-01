import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import { getCard, patchCardSettings } from '../services/api';
import type { Card } from '../types/v2';
import { useTranslation } from 'react-i18next';

export default function CardSettings() {
  const { cardId } = useParams<{ cardId: string }>();
  if (!cardId) return null;
  const { t } = useTranslation();
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportDay, setReportDay] = useState('');
  const [graceDueDay, setGraceDueDay] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    getCard(cardId)
      .then((c) => {
        setCard(c);
        setReportDay(String(c.reportDay));
        setGraceDueDay(String(c.graceDueDay));
      })
      .catch(() => setError(t('settings.loadError')))
      .finally(() => setLoading(false));
  }, [cardId, t]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!card) return;
    const rd = parseInt(reportDay, 10);
    const gdd = parseInt(graceDueDay, 10);
    if (isNaN(rd) || rd < 1 || rd > 31) {
      setError(t('settings.validation.reportDay'));
      return;
    }
    if (isNaN(gdd) || gdd < 1 || gdd > 31) {
      setError(t('settings.validation.graceDueDay'));
      return;
    }
    setSubmitting(true);
    setError('');
    patchCardSettings(cardId, { reportDay: rd, graceDueDay: gdd })
      .then((c) => {
        setCard(c);
        setReportDay(String(c.reportDay));
        setGraceDueDay(String(c.graceDueDay));
        setSuccess(t('settings.saveSuccess'));
      })
      .catch(() => setError(t('settings.saveError')))
      .finally(() => setSubmitting(false));
  };

  if (loading) return <CircularProgress />;
  if (!card) return null;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('settings.title', { name: card.name })}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <Paper sx={{ p: 2 }}>
        <form onSubmit={handleSave}>
          <TextField
            fullWidth
            label={t('settingsForm.reportDayLabel')}
            type="number"
            inputProps={{ min: 1, max: 31 }}
            value={reportDay}
            onChange={(e) => setReportDay(e.target.value)}
            margin="normal"
            helperText={t('settingsForm.reportDayHelp')}
          />
          <TextField
            fullWidth
            label={t('settingsForm.graceDueDayLabel')}
            type="number"
            inputProps={{ min: 1, max: 31 }}
            value={graceDueDay}
            onChange={(e) => setGraceDueDay(e.target.value)}
            margin="normal"
            helperText={t('settingsForm.graceDueDayHelp')}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            sx={{ mt: 2 }}
          >
            {t('common.save')}
          </Button>
        </form>
      </Paper>
      <Snackbar
        open={Boolean(success)}
        autoHideDuration={3000}
        onClose={() => setSuccess('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
}
