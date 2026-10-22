import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Stack,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Snackbar,
  FormControl,
  Select,
  MenuItem,
  IconButton,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import { getCard, patchCardSettings, exportCard, importCard } from '../services/api';
import { detectPreset, presetDefaults, type GracePreset } from '../cardGrace';
import type { Card, PayoffStrategy } from '../types/v2';
import { useTranslation } from 'react-i18next';
import { LabeledTextField } from '../components/FormField';

/** Grace period settings of a card, export and import. */
export default function CardSettings({ onChanged }: { onChanged?: () => void }) {
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
  const [minPercent, setMinPercent] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [strategy, setStrategy] = useState<PayoffStrategy>('latest');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const isOzonPreset = preset === 'ozon_78';
  const isLegacyPreset = preset === 'legacy_months';
  const isStatementPreset = preset === 'sber_120' || preset === 'custom_statement';

  const showCard = (c: Card) => {
    setCard(c);
    setReportDay(String(c.reportDay));
    setPreset(detectPreset(c));
    setGracePeriods(String(c.gracePeriods));
    setGraceDueDay(String(c.graceDueDay));
    setGraceStatementPeriods(String(c.graceStatementPeriods));
    setPaymentDueOffsetDays(String(c.paymentDueOffsetDays));
    setMinPercent(c.minPaymentPercent == null ? '' : String(c.minPaymentPercent));
    setMinAmount(c.minPaymentMinimum == null ? '' : String(c.minPaymentMinimum));
    setStrategy(c.payoffStrategy);
  };

  useEffect(() => {
    getCard(cardId)
      .then(showCard)
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
    const mpp = Number(minPercent.replace(',', '.'));
    const mpm = Number(minAmount.replace(',', '.'));
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
    if (minPercent.trim() === '' || !Number.isFinite(mpp) || mpp < 0 || mpp > 100) {
      setError(t('settings.validation.minPaymentPercent'));
      return;
    }
    if (minAmount.trim() === '' || !Number.isFinite(mpm) || mpm < 0) {
      setError(t('settings.validation.minPaymentMinimum'));
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
      minPaymentPercent: mpp,
      minPaymentMinimum: mpm,
      payoffStrategy: strategy,
    })
      .then((c) => {
        showCard(c);
        setSuccess(t('settings.saveSuccess'));
        onChanged?.();
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
          reconciliations: result.importedReconciliations,
        })
      );
      onChanged?.();
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

  const isInstallment = card.kind === 'installment';
  const isDirty =
    !isInstallment && (
    reportDay !== String(card.reportDay) ||
    preset !== detectPreset(card) ||
    gracePeriods !== String(card.gracePeriods) ||
    graceDueDay !== String(card.graceDueDay) ||
    graceStatementPeriods !== String(card.graceStatementPeriods) ||
    paymentDueOffsetDays !== String(card.paymentDueOffsetDays) ||
    minPercent !== (card.minPaymentPercent == null ? '' : String(card.minPaymentPercent)) ||
    minAmount !== (card.minPaymentMinimum == null ? '' : String(card.minPaymentMinimum)) ||
    strategy !== card.payoffStrategy);

  const applyPreset = (nextPreset: GracePreset, nextReportDay: number) => {
    const defaults = presetDefaults(nextPreset, nextReportDay);
    setPreset(nextPreset);
    setGracePeriods(defaults.gracePeriods);
    setGraceDueDay(defaults.graceDueDay);
    setGraceStatementPeriods(defaults.graceStatementPeriods);
    setPaymentDueOffsetDays(defaults.paymentDueOffsetDays);
  };

  return (
    <Stack spacing={3} sx={{ pb: isDirty ? 12 : 0 }}>
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {isInstallment ? (
        <Alert severity="info">{t('settings.installmentInfo')}</Alert>
      ) : (
        <Box id="card-settings-form" component="form" onSubmit={handleSave} sx={{ display: 'grid', gap: 3, pt: 1, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' } }}>
          <Box>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle1">{t('settings.groups.presetTitle')}</Typography>
                <Typography color="text.secondary">{t('settings.groups.presetSubtitle')}</Typography>
              </Box>
              <Stack spacing={0.75}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {t('settingsForm.presetLabel')}
                </Typography>
                <FormControl fullWidth>
                <Select
                  value={preset}
                  onChange={(e) => applyPreset(e.target.value as GracePreset, parseInt(reportDay, 10) || card.reportDay)}
                >
                  <MenuItem value="sber_120">{t('main.createCard.presets.sber120')}</MenuItem>
                  <MenuItem value="ozon_78">{t('main.createCard.presets.ozon78')}</MenuItem>
                  <MenuItem value="custom_statement">{t('main.createCard.presets.customStatement')}</MenuItem>
                  <MenuItem value="legacy_months">{t('main.createCard.presets.legacyMonths')}</MenuItem>
                </Select>
                </FormControl>
              </Stack>
              <Alert severity="info">
                <Typography variant="body2">{t(`settingsForm.modelInfo.${preset}`)}</Typography>
              </Alert>
            </Stack>
          </Box>

          <Box>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle1">{t('settings.groups.statementTitle')}</Typography>
                <Typography color="text.secondary">{t('settings.groups.statementSubtitle')}</Typography>
              </Box>
              {!isOzonPreset && (
                <NumericField
                  label={t('settingsForm.reportDayLabel')}
                  min={1}
                  max={31}
                  value={reportDay}
                  onValueChange={(nextValue) => {
                    setReportDay(nextValue);
                    const nextReportDay = parseInt(nextValue, 10);
                    if (!Number.isNaN(nextReportDay) && ['sber_120', 'legacy_months'].includes(preset)) {
                      applyPreset(preset, nextReportDay);
                    }
                  }}
                  help={t('settingsForm.reportDayHelp')}
                />
              )}
              {isOzonPreset && (
                <LabeledTextField
                  fullWidth
                  label={t('settingsForm.ozonAnchorPreviewLabel')}
                  value={t('settingsForm.ozonAnchorPreviewValue')}
                  InputProps={{ readOnly: true }}
                  helperText={t('settingsForm.ozonAnchorPreviewHelp')}
                />
              )}
              {isOzonPreset && (
                <Typography variant="body2" color="text.secondary">
                  {t('settingsForm.ozonExample')}
                </Typography>
              )}
            </Stack>
          </Box>

          <Box>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle1">{t('settings.groups.paymentTitle')}</Typography>
                <Typography color="text.secondary">{t('settings.groups.paymentSubtitle')}</Typography>
              </Box>
              {isLegacyPreset ? (
                <>
                  <NumericField
                    label={t('settingsForm.gracePeriodsLabel')}
                    min={1}
                    max={36}
                    value={gracePeriods}
                    onValueChange={setGracePeriods}
                    help={t('settingsForm.gracePeriodsHelp')}
                  />
                  <NumericField
                    label={t('settingsForm.graceDueDayLabel')}
                    min={1}
                    max={31}
                    value={graceDueDay}
                    onValueChange={setGraceDueDay}
                    help={t('settingsForm.graceDueDayHelp')}
                  />
                </>
              ) : isStatementPreset ? (
                <>
                <NumericField
                  label={t('settingsForm.graceStatementPeriodsLabel')}
                  min={1}
                  max={12}
                  value={graceStatementPeriods}
                  onValueChange={setGraceStatementPeriods}
                  help={t('settingsForm.graceStatementPeriodsHelp')}
                />
                <NumericField
                  label={t('settingsForm.paymentDueOffsetDaysLabel')}
                  min={0}
                  max={31}
                  value={paymentDueOffsetDays}
                  onValueChange={setPaymentDueOffsetDays}
                  help={t('settingsForm.paymentDueOffsetDaysHelp')}
                />
                </>
              ) : (
                <Alert severity="info">{t('settings.groups.paymentOzonNotice')}</Alert>
              )}
            </Stack>
          </Box>

          <Box>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle1">{t('settings.groups.minimumTitle')}</Typography>
                <Typography color="text.secondary">{t('settings.groups.minimumSubtitle')}</Typography>
              </Box>
              <Stack direction="row" spacing={2}>
                <LabeledTextField
                  label={t('settingsForm.minPaymentPercentLabel')}
                  value={minPercent}
                  onChange={(e) => setMinPercent(e.target.value)}
                  inputProps={{ inputMode: 'decimal' }}
                  InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  sx={{ width: 140 }}
                />
                <LabeledTextField
                  label={t('settingsForm.minPaymentMinimumLabel')}
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  inputProps={{ inputMode: 'decimal' }}
                  InputProps={{ endAdornment: <InputAdornment position="end">₽</InputAdornment> }}
                  sx={{ width: 160 }}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">{t('settingsForm.minPaymentHelp')}</Typography>
            </Stack>
          </Box>

          <Box>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle1">{t('settings.groups.strategyTitle')}</Typography>
                <Typography color="text.secondary">{t('settings.groups.strategySubtitle')}</Typography>
              </Box>
              <ToggleButtonGroup exclusive size="small" value={strategy} onChange={(_, value: PayoffStrategy | null) => value && setStrategy(value)} sx={{ alignSelf: 'flex-start' }}>
                <ToggleButton value="latest">{t('settingsForm.strategy.latest')}</ToggleButton>
                <ToggleButton value="even">{t('settingsForm.strategy.even')}</ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="body2" color="text.secondary">{t(`settingsForm.strategyInfo.${strategy}`)}</Typography>
            </Stack>
          </Box>

        </Box>
      )}
      {isDirty && (
        <Paper
          sx={{
            position: 'fixed',
            bottom: 16,
            left: { xs: 16, md: 248 },
            right: { xs: 16, md: 24 },
            zIndex: 5,
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            borderColor: 'var(--accent)',
          }}
        >
          <Typography color="text.secondary">{t('settings.groups.saveSubtitle')}</Typography>
          <Button type="submit" form="card-settings-form" variant="contained" disabled={submitting}>
            {t('common.save')}
          </Button>
        </Paper>
      )}
      <Box sx={{ pt: 1, borderTop: '1px solid var(--border)' }}>
        <Stack spacing={2} sx={{ pt: 2 }}>
          <Box>
            <Typography variant="subtitle1">{t('settings.importExport.title')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('settings.importExport.hint')}
            </Typography>
          </Box>
        {importError && (
          <Alert severity="error" onClose={() => setImportError('')}>
            {importError}
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={handleExport}
            disabled={exporting}
          >
            {t('settings.importExport.export')}
          </Button>
          <Button variant="outlined" component="label" disabled={importing}>
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
        </Stack>
      </Box>
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
    </Stack>
  );
}

function NumericField({
  label,
  help,
  min,
  max,
  value,
  onValueChange,
}: {
  label: string;
  help: string;
  min: number;
  max: number;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const step = (delta: number) => {
    const current = Number.parseInt(value, 10);
    const next = Math.min(max, Math.max(min, (Number.isNaN(current) ? min : current) + delta));
    onValueChange(String(next));
  };

  return (
    <Stack spacing={0.75}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', width: 120, maxWidth: '100%' }}>
        <IconButton type="button" size="small" onClick={() => step(-1)} aria-label={`${label}: −`} sx={{ flex: '0 0 32px' }}>
          <RemoveRoundedIcon fontSize="small" />
        </IconButton>
        <TextField
          type="number"
          inputProps={{ min, max, step: 1, 'aria-label': label, style: { textAlign: 'center' } }}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          sx={{ width: 56, '& input': { px: 0.5 }, '& input::-webkit-inner-spin-button': { display: 'none' } }}
        />
        <IconButton type="button" size="small" onClick={() => step(1)} aria-label={`${label}: +`} sx={{ flex: '0 0 32px' }}>
          <AddRoundedIcon fontSize="small" />
        </IconButton>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {help}
      </Typography>
    </Stack>
  );
}
