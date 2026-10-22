import React, { useState } from 'react';
import { Alert, Box, Button, FormControl, MenuItem, Select, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { presetDefaults, type GracePreset } from '../cardGrace';
import { createCard } from '../services/api';
import type { Card, CardKind } from '../types/v2';
import { FormField, LabeledTextField } from './FormField';

/** New credit or installment card with its grace period preset. */
export default function CreateCardForm({
  onCreated,
  onSuccess,
}: {
  onCreated: (card: Card) => void;
  onSuccess?: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CardKind>('credit');
  const [reportDay, setReportDay] = useState('10');
  const [preset, setPreset] = useState<GracePreset>('sber_120');
  const [gracePeriods, setGracePeriods] = useState('4');
  const [graceDueDay, setGraceDueDay] = useState('10');
  const [graceStatementPeriods, setGraceStatementPeriods] = useState('4');
  const [paymentDueOffsetDays, setPaymentDueOffsetDays] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isOzonPreset = preset === 'ozon_78';
  const isLegacyPreset = preset === 'legacy_months';
  const isStatementPreset = preset === 'sber_120' || preset === 'custom_statement';

  const applyPreset = (nextPreset: GracePreset, nextReportDay: number) => {
    const defaults = presetDefaults(nextPreset, nextReportDay);
    setPreset(nextPreset);
    setGracePeriods(defaults.gracePeriods);
    setGraceDueDay(defaults.graceDueDay);
    setGraceStatementPeriods(defaults.graceStatementPeriods);
    setPaymentDueOffsetDays(defaults.paymentDueOffsetDays);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rd = parseInt(reportDay, 10);
    const gp = parseInt(gracePeriods, 10);
    const gdd = parseInt(graceDueDay, 10);
    const gsp = parseInt(graceStatementPeriods, 10);
    const pdo = parseInt(paymentDueOffsetDays, 10);
    if (kind === 'installment') {
      if (!name.trim()) {
        setError(t('main.createCard.validationError'));
        return;
      }
      setSubmitting(true);
      setError('');
      createCard({ name: name.trim(), kind })
        .then((card) => {
          onCreated(card);
          onSuccess?.();
        })
        .catch(() => setError(t('main.createCard.createError')))
        .finally(() => setSubmitting(false));
      return;
    }
    if (!name.trim() || Number.isNaN(rd) || rd < 1 || rd > 31) {
      setError(t('main.createCard.validationError'));
      return;
    }
    if (
      preset === 'legacy_months' &&
      (Number.isNaN(gp) || gp < 1 || gp > 36 || Number.isNaN(gdd) || gdd < 1 || gdd > 31)
    ) {
      setError(t('main.createCard.validationError'));
      return;
    }
    if (
      preset !== 'legacy_months' &&
      (Number.isNaN(gsp) || gsp < 1 || gsp > 12 || Number.isNaN(pdo) || pdo < 0 || pdo > 31)
    ) {
      setError(t('main.createCard.validationError'));
      return;
    }

    setSubmitting(true);
    setError('');
    createCard({
      name: name.trim(),
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
      .then((card) => {
        onCreated(card);
        onSuccess?.();
      })
      .catch(() => setError(t('main.createCard.createError')))
      .finally(() => setSubmitting(false));
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <Stack spacing={2}>
        <LabeledTextField
          fullWidth
          label={t('main.createCard.nameLabel')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <FormField label={t('main.createCard.kindLabel')}>
          <FormControl fullWidth>
            <Select
              value={kind}
              inputProps={{ 'aria-label': t('main.createCard.kindLabel') }}
              onChange={(e) => setKind(e.target.value as CardKind)}
            >
              <MenuItem value="credit">{t('main.createCard.kinds.credit')}</MenuItem>
              <MenuItem value="installment">{t('main.createCard.kinds.installment')}</MenuItem>
            </Select>
          </FormControl>
        </FormField>
        {kind === 'installment' ? (
          <Alert severity="info">
            <Typography variant="body2">{t('main.createCard.installmentInfo')}</Typography>
          </Alert>
        ) : (
          <>
            <FormField label={t('main.createCard.presetLabel')}>
              <FormControl fullWidth>
                <Select
                  value={preset}
                  inputProps={{ 'aria-label': t('main.createCard.presetLabel') }}
                  onChange={(e) => applyPreset(e.target.value as GracePreset, parseInt(reportDay, 10) || 10)}
                >
                  <MenuItem value="sber_120">{t('main.createCard.presets.sber120')}</MenuItem>
                  <MenuItem value="ozon_78">{t('main.createCard.presets.ozon78')}</MenuItem>
                  <MenuItem value="custom_statement">{t('main.createCard.presets.customStatement')}</MenuItem>
                  <MenuItem value="legacy_months">{t('main.createCard.presets.legacyMonths')}</MenuItem>
                </Select>
              </FormControl>
            </FormField>
            <Alert severity="info">
              <Typography variant="body2">{t(`settingsForm.modelInfo.${preset}`)}</Typography>
            </Alert>
            {!isOzonPreset && (
              <LabeledTextField
                fullWidth
                label={t('main.createCard.reportDayLabel')}
                type="number"
                inputProps={{ min: 1, max: 31 }}
                value={reportDay}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setReportDay(nextValue);
                  const nextReportDay = parseInt(nextValue, 10);
                  if (!Number.isNaN(nextReportDay) && ['sber_120', 'legacy_months'].includes(preset)) {
                    applyPreset(preset, nextReportDay);
                  }
                }}
                required
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
            {isLegacyPreset ? (
              <>
                <LabeledTextField
                  fullWidth
                  label={t('settingsForm.gracePeriodsLabel')}
                  type="number"
                  inputProps={{ min: 1, max: 36 }}
                  value={gracePeriods}
                  onChange={(e) => setGracePeriods(e.target.value)}
                  helperText={t('settingsForm.gracePeriodsHelp')}
                />
                <LabeledTextField
                  fullWidth
                  label={t('settingsForm.graceDueDayLabel')}
                  type="number"
                  inputProps={{ min: 1, max: 31 }}
                  value={graceDueDay}
                  onChange={(e) => setGraceDueDay(e.target.value)}
                  helperText={t('settingsForm.graceDueDayHelp')}
                />
              </>
            ) : isStatementPreset ? (
              <>
                <LabeledTextField
                  fullWidth
                  label={t('settingsForm.graceStatementPeriodsLabel')}
                  type="number"
                  inputProps={{ min: 1, max: 12 }}
                  value={graceStatementPeriods}
                  onChange={(e) => setGraceStatementPeriods(e.target.value)}
                  helperText={t('settingsForm.graceStatementPeriodsHelp')}
                />
                <LabeledTextField
                  fullWidth
                  label={t('settingsForm.paymentDueOffsetDaysLabel')}
                  type="number"
                  inputProps={{ min: 0, max: 31 }}
                  value={paymentDueOffsetDays}
                  onChange={(e) => setPaymentDueOffsetDays(e.target.value)}
                  helperText={t('settingsForm.paymentDueOffsetDaysHelp')}
                />
              </>
            ) : null}
            {isOzonPreset && (
              <Typography variant="body2" color="text.secondary">
                {t('settingsForm.ozonExample')}
              </Typography>
            )}
          </>
        )}
        <Button type="submit" variant="contained" disabled={submitting} sx={{ alignSelf: 'flex-start' }}>
          {t('main.createCard.createButton')}
        </Button>
      </Stack>
    </Box>
  );
}
