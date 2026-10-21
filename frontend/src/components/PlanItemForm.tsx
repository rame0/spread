import React, { useState } from 'react';
import { Alert, Box, Button, FormControlLabel, MenuItem, Stack, Switch, Typography } from '@mui/material';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { Account, Card, PlanFrequency, PlanItem, PlanItemInput, PlanItemKind } from '../types/v2';
import { LabeledTextField } from './FormField';

const KINDS: PlanItemKind[] = ['income', 'expense', 'transfer'];
const FREQUENCIES: PlanFrequency[] = ['monthly', 'weekly', 'yearly', 'once'];
const CURRENCIES = ['RUB', 'USD', 'EUR', 'KZT', 'CNY'];

type PlanItemFormProps = {
  initial?: PlanItem;
  initialKind?: PlanItemKind;
  cards: Card[];
  accounts: Account[];
  submitLabel: string;
  onSubmit: (values: PlanItemInput) => Promise<unknown>;
};

export default function PlanItemForm({ initial, initialKind, cards, accounts, submitLabel, onSubmit }: PlanItemFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<PlanItemKind>(initial?.kind ?? initialKind ?? 'expense');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'RUB');
  const [frequency, setFrequency] = useState<PlanFrequency>(initial?.frequency ?? 'monthly');
  const [interval, setInterval] = useState(String(initial?.interval ?? 1));
  const [startDate, setStartDate] = useState(initial?.startDate ?? format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(initial?.endDate ?? '');
  const [spread, setSpread] = useState(initial?.spread ?? false);
  const [cardId, setCardId] = useState(initial?.cardId ?? '');
  const [targetAccountId, setTargetAccountId] = useState(initial?.targetAccountId ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const repeating = frequency !== 'once';
  const targets = accounts.filter((account) => !account.archivedAt && account.kind !== 'property');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount.replace(',', '.'));
    const step = Number(interval);
    if (!name.trim() || !(value > 0) || !startDate || (repeating && !(Number.isInteger(step) && step >= 1)) || (endDate && endDate < startDate)) {
      setError(t('financePlan.form.validation'));
      return;
    }
    setSubmitting(true);
    setError('');
    onSubmit({
      name: name.trim(),
      kind,
      amount: value,
      currency,
      frequency,
      interval: repeating ? step : 1,
      startDate,
      endDate: repeating && endDate ? endDate : null,
      spread: kind === 'expense' && repeating && spread,
      cardId: kind === 'expense' && cardId ? cardId : null,
      targetAccountId: kind === 'transfer' && targetAccountId ? targetAccountId : null,
      note: note.trim() || null,
    })
      .catch(() => setError(t('financePlan.form.error')))
      .finally(() => setSubmitting(false));
  };

  return (
    <Box component="form" onSubmit={submit}>
      <Stack spacing={2}>
        {error && (
          <Alert severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2 }}>
          <LabeledTextField select fullWidth label={t('financePlan.form.kind')} value={kind} onChange={(e) => setKind(e.target.value as PlanItemKind)}>
            {KINDS.map((value) => (
              <MenuItem key={value} value={value}>
                {t(`financePlan.kinds.${value}`)}
              </MenuItem>
            ))}
          </LabeledTextField>
          <LabeledTextField fullWidth label={t('financePlan.form.name')} placeholder={t(`financePlan.form.namePlaceholder.${kind}`)} value={name} onChange={(e) => setName(e.target.value)} required />
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 2 }}>
          <LabeledTextField fullWidth label={t('financePlan.form.amount')} type="number" inputProps={{ step: 0.01, min: 0 }} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <LabeledTextField select fullWidth label={t('financePlan.form.currency')} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {[...new Set([...CURRENCIES, currency])].map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </LabeledTextField>
          <LabeledTextField select fullWidth label={t('financePlan.form.frequency')} value={frequency} onChange={(e) => setFrequency(e.target.value as PlanFrequency)}>
            {FREQUENCIES.map((value) => (
              <MenuItem key={value} value={value}>
                {t(`financePlan.frequencies.${value}`)}
              </MenuItem>
            ))}
          </LabeledTextField>
          {repeating && (
            <LabeledTextField
              fullWidth
              label={t(`financePlan.form.interval.${frequency}`)}
              type="number"
              inputProps={{ min: 1, max: 120 }}
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            />
          )}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2 }}>
          <LabeledTextField fullWidth label={repeating ? t('financePlan.form.startDate') : t('financePlan.form.date')} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          {repeating && <LabeledTextField fullWidth label={t('financePlan.form.endDate')} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />}
          {kind === 'expense' && (
            <LabeledTextField select fullWidth label={t('financePlan.form.card')} value={cardId} onChange={(e) => setCardId(e.target.value)}>
              <MenuItem value="">{t('financePlan.form.noCard')}</MenuItem>
              {cards.map((card) => (
                <MenuItem key={card.id} value={card.id}>
                  {card.name}
                </MenuItem>
              ))}
            </LabeledTextField>
          )}
          {kind === 'transfer' && (
            <LabeledTextField select fullWidth label={t('financePlan.form.target')} value={targetAccountId} onChange={(e) => setTargetAccountId(e.target.value)}>
              <MenuItem value="">{t('financePlan.form.noTarget')}</MenuItem>
              {targets.map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.name}
                </MenuItem>
              ))}
            </LabeledTextField>
          )}
        </Box>
        {kind === 'expense' && repeating && (
          <Stack spacing={0.5}>
            <FormControlLabel control={<Switch checked={spread} onChange={(_, checked) => setSpread(checked)} />} label={t('financePlan.form.spread')} />
            <Typography variant="caption" color="text.secondary">
              {t('financePlan.form.spreadHelp')}
            </Typography>
          </Stack>
        )}
        {kind === 'expense' && cardId && (
          <Typography variant="caption" color="text.secondary">
            {t('financePlan.form.cardHelp')}
          </Typography>
        )}
        <LabeledTextField fullWidth label={t('financePlan.form.note')} value={note} onChange={(e) => setNote(e.target.value)} />
        <Button type="submit" variant="contained" disabled={submitting} sx={{ alignSelf: 'flex-start' }}>
          {submitLabel}
        </Button>
      </Stack>
    </Box>
  );
}
