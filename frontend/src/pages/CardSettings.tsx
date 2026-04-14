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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { getCard, patchCardSettings, exportCard, importCard } from '../services/api';
import { detectPreset, presetDefaults, type GracePreset } from '../cardGrace';
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
  const [preset, setPreset] = useState<GracePreset>('sber_120');
  const [gracePeriods, setGracePeriods] = useState('4');
  const [graceDueDay, setGraceDueDay] = useState('');
  const [graceStatementPeriods, setGraceStatementPeriods] = useState('4');
  const [paymentDueOffsetDays, setPaymentDueOffsetDays] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    getCard(cardId)
      .then((c) => {
        setCard(c);
        setReportDay(String(c.reportDay));
        setPreset(detectPreset(c));
        setGracePeriods(String(c.gracePeriods));
        setGraceDueDay(String(c.graceDueDay));
        setGraceStatementPeriods(String(c.graceStatementPeriods));
        setPaymentDueOffsetDays(String(c.paymentDueOffsetDays));
      })
      .catch(() => setError(t('settings.loadError')))
      .finally(() => setLoading(false));
  }, [cardId, t]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!card) return;
    const rd = parseInt(reportDay, 10);
    const gp = parseInt(gracePeriods, 10);
    const gdd = parseInt(graceDueDay, 10);
    const gsp = parseInt(graceStatementPeriods, 10);
    const pdo = parseInt(paymentDueOffsetDays, 10);
    if (isNaN(rd) || rd < 1 || rd > 31) {
      setError(t('settings.validation.reportDay'));
      return;
    }
    if (preset === 'legacy_months' && (isNaN(gp) || gp < 1 || gp > 36)) {
      setError(t('settings.validation.gracePeriods'));
      return;
    }
    if (preset === 'legacy_months' && (isNaN(gdd) || gdd < 1 || gdd > 31)) {
      setError(t('settings.validation.graceDueDay'));
      return;
    }
    if (preset !== 'legacy_months' && (isNaN(gsp) || gsp < 1 || gsp > 12)) {
      setError(t('settings.validation.graceStatementPeriods'));
      return;
    }
    if (preset !== 'legacy_months' && (isNaN(pdo) || pdo < 0 || pdo > 31)) {
      setError(t('settings.validation.paymentDueOffsetDays'));
      return;
    }
    setSubmitting(true);
    setError('');
    patchCardSettings(cardId, {
      reportDay: rd,
      graceModel:
        preset === 'legacy_months'
          ? 'legacy_months'
          : preset === 'ozon_78'
            ? 'ozon_anchor'
            : 'statement_periods',
      gracePeriods: preset === 'legacy_months' ? gp : undefined,
      graceDueDay: preset === 'legacy_months' ? gdd : undefined,
      graceStatementPeriods: preset !== 'legacy_months' ? gsp : undefined,
      paymentDueOffsetDays: preset !== 'legacy_months' ? pdo : undefined,
    })
      .then((c) => {
        setCard(c);
        setReportDay(String(c.reportDay));
        setPreset(detectPreset(c));
        setGracePeriods(String(c.gracePeriods));
        setGraceDueDay(String(c.graceDueDay));
        setGraceStatementPeriods(String(c.graceStatementPeriods));
        setPaymentDueOffsetDays(String(c.paymentDueOffsetDays));
        setSuccess(t('settings.saveSuccess'));
      })
      .catch(() => setError(t('settings.saveError')))
      .finally(() => setSubmitting(false));
  };

  const handleExport = async () => {
    if (!card) return;
    setExporting(true);
    try {
      const payload = await exportCard(cardId);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = card.name.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase();
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `grace-card-${safeName || card.id}-${date}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setSuccess(t('settings.exportSuccess'));
    } catch (e) {
      setImportError(
        (e as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || t('settings.exportError')
      );
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (file: File | null) => {
    if (!file) return;
    setImportError('');
    setImporting(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as Parameters<typeof importCard>[1];
      const result = await importCard(cardId, payload);
      setSuccess(
        t('settings.importSuccess', {
          purchases: result.importedPurchases,
          deposits: result.importedDeposits,
        })
      );
    } catch (e) {
      setImportError(
        (e as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || t('settings.importError')
      );
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <CircularProgress />;
  if (!card) return null;

  const applyPreset = (nextPreset: GracePreset, nextReportDay: number) => {
    const defaults = presetDefaults(nextPreset, nextReportDay);
    setPreset(nextPreset);
    setGracePeriods(defaults.gracePeriods);
    setGraceDueDay(defaults.graceDueDay);
    setGraceStatementPeriods(defaults.graceStatementPeriods);
    setPaymentDueOffsetDays(defaults.paymentDueOffsetDays);
  };

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
          <FormControl fullWidth margin="normal">
            <InputLabel id="settings-grace-preset-label">
              {t('settingsForm.presetLabel')}
            </InputLabel>
            <Select
              labelId="settings-grace-preset-label"
              value={preset}
              label={t('settingsForm.presetLabel')}
              onChange={(e) => applyPreset(e.target.value as GracePreset, parseInt(reportDay, 10) || card.reportDay)}
            >
              <MenuItem value="sber_120">{t('main.createCard.presets.sber120')}</MenuItem>
              <MenuItem value="ozon_78">{t('main.createCard.presets.ozon78')}</MenuItem>
              <MenuItem value="custom_statement">{t('main.createCard.presets.customStatement')}</MenuItem>
              <MenuItem value="legacy_months">{t('main.createCard.presets.legacyMonths')}</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label={t('settingsForm.reportDayLabel')}
            type="number"
            inputProps={{ min: 1, max: 31 }}
            value={reportDay}
            onChange={(e) => {
              const nextValue = e.target.value;
              setReportDay(nextValue);
              const nextReportDay = parseInt(nextValue, 10);
              if (!Number.isNaN(nextReportDay) && ['sber_120', 'ozon_78', 'legacy_months'].includes(preset)) {
                applyPreset(preset, nextReportDay);
              }
            }}
            margin="normal"
            helperText={t('settingsForm.reportDayHelp')}
          />
          {preset === 'legacy_months' ? (
            <>
              <TextField
                fullWidth
                label={t('settingsForm.gracePeriodsLabel')}
                type="number"
                inputProps={{ min: 1, max: 36 }}
                value={gracePeriods}
                onChange={(e) => setGracePeriods(e.target.value)}
                margin="normal"
                helperText={t('settingsForm.gracePeriodsHelp')}
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
            </>
          ) : (
            <>
              <TextField
                fullWidth
                label={t('settingsForm.graceStatementPeriodsLabel')}
                type="number"
                inputProps={{ min: 1, max: 12 }}
                value={graceStatementPeriods}
                onChange={(e) => setGraceStatementPeriods(e.target.value)}
                margin="normal"
                helperText={t('settingsForm.graceStatementPeriodsHelp')}
              />
              <TextField
                fullWidth
                label={t('settingsForm.paymentDueOffsetDaysLabel')}
                type="number"
                inputProps={{ min: 0, max: 31 }}
                value={paymentDueOffsetDays}
                onChange={(e) => setPaymentDueOffsetDays(e.target.value)}
                margin="normal"
                helperText={t('settingsForm.paymentDueOffsetDaysHelp')}
              />
            </>
          )}
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
      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          {t('settings.importExport.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('settings.importExport.hint')}
        </Typography>
        {importError && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setImportError('')}>
            {importError}
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
          <Button
            variant="outlined"
            onClick={handleExport}
            disabled={exporting}
          >
            {t('settings.importExport.export')}
          </Button>
          <Button variant="contained" component="label" disabled={importing}>
            {t('settings.importExport.import')}
            <input
              type="file"
              hidden
              accept="application/json"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                e.currentTarget.value = '';
                handleImport(file);
              }}
            />
          </Button>
        </Box>
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
