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
} from '@mui/material';
import { getCard, patchCardSettings } from '../services/api';
import type { Card } from '../types/v2';

export default function CardSettings() {
  const { cardId } = useParams<{ cardId: string }>();
  if (!cardId) return null;
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportDay, setReportDay] = useState('');
  const [graceDueDay, setGraceDueDay] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCard(cardId)
      .then((c) => {
        setCard(c);
        setReportDay(String(c.reportDay));
        setGraceDueDay(String(c.graceDueDay));
      })
      .catch(() => setError('Не удалось загрузить карту'))
      .finally(() => setLoading(false));
  }, [cardId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!card) return;
    const rd = parseInt(reportDay, 10);
    const gdd = parseInt(graceDueDay, 10);
    if (isNaN(rd) || rd < 1 || rd > 31) {
      setError('День отчёта: число от 1 до 31');
      return;
    }
    if (isNaN(gdd) || gdd < 1 || gdd > 31) {
      setError('День закрытия грейса: число от 1 до 31');
      return;
    }
    setSubmitting(true);
    setError('');
    patchCardSettings(cardId, { reportDay: rd, graceDueDay: gdd })
      .then((c) => {
        setCard(c);
        setReportDay(String(c.reportDay));
        setGraceDueDay(String(c.graceDueDay));
      })
      .catch(() => setError('Не удалось сохранить'))
      .finally(() => setSubmitting(false));
  };

  if (loading) return <CircularProgress />;
  if (!card) return null;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Настройки карты: {card.name}
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
            label="День отчёта (1–31)"
            type="number"
            inputProps={{ min: 1, max: 31 }}
            value={reportDay}
            onChange={(e) => setReportDay(e.target.value)}
            margin="normal"
            helperText="День месяца, на который закрывается отчётный период"
          />
          <TextField
            fullWidth
            label="День закрытия грейса (1–31)"
            type="number"
            inputProps={{ min: 1, max: 31 }}
            value={graceDueDay}
            onChange={(e) => setGraceDueDay(e.target.value)}
            margin="normal"
            helperText="К какому числу нужно закрыть пачку (обычно = дню отчёта)"
          />
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            sx={{ mt: 2 }}
          >
            Сохранить
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
