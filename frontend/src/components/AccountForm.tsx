import React, { useState } from 'react';
import { Alert, Autocomplete, Box, Button, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { Account, AccountInput, AccountKind, InterestMode } from '../types/v2';
import { FormField, LabeledTextField } from './FormField';
import DateField from './DateField';

export const ACCOUNT_KINDS: AccountKind[] = ['debit', 'cash', 'savings', 'deposit', 'brokerage', 'property', 'other'];
const CURRENCIES = ['RUB', 'USD', 'EUR', 'KZT', 'CNY', 'GBP', 'TRY', 'AED', 'GEL', 'AMD'];
/** Deposits, brokerage accounts and property are not money for everyday spending. */
const liquidByDefault = (kind: AccountKind) => kind === 'debit' || kind === 'cash' || kind === 'savings' || kind === 'other';
export const INTEREST_KINDS: AccountKind[] = ['savings', 'deposit'];
const INTEREST_MODES: InterestMode[] = ['daily', 'monthly', 'maturity'];

export type AccountFormValues = AccountInput & {
  initialBalance?: { date: string; amount: number };
  initialRate?: { date: string; rate: number };
};

const parseNumber = (value: string) => (value.trim() === '' ? null : Number(value.replace(',', '.')));

type AccountFormProps = {
  initial?: Account;
  /** Preselected kind for a new account. */
  initialKind?: AccountKind;
  submitLabel: string;
  onSubmit: (values: AccountFormValues) => Promise<unknown>;
};

export default function AccountForm({ initial, initialKind, submitLabel, onSubmit }: AccountFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<AccountKind>(initial?.kind ?? initialKind ?? 'debit');
  const [currency, setCurrency] = useState(initial?.currency ?? 'RUB');
  const [institution, setInstitution] = useState(initial?.institution ?? '');
  const [isLiquid, setIsLiquid] = useState(initial?.isLiquid ?? liquidByDefault(initialKind ?? 'debit'));
  const [liquidTouched, setLiquidTouched] = useState(Boolean(initial));
  const [initialBalance, setInitialBalance] = useState('');
  const [interestMode, setInterestMode] = useState<InterestMode | ''>(initial ? initial.interestMode ?? '' : 'daily');
  const [payoutDay, setPayoutDay] = useState(initial?.payoutDay ? String(initial.payoutDay) : '');
  const [maturityDate, setMaturityDate] = useState(initial?.maturityDate ?? '');
  const [initialRate, setInitialRate] = useState('');
  const hasInterest = INTEREST_KINDS.includes(kind);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleKindChange = (next: AccountKind) => {
    setKind(next);
    if (!liquidTouched) setIsLiquid(liquidByDefault(next));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = currency.trim().toUpperCase();
    const balance = parseNumber(initialBalance);
    const rate = parseNumber(initialRate);
    const day = parseNumber(payoutDay);
    if (
      !name.trim() ||
      !/^[A-Z]{3}$/.test(code) ||
      (balance !== null && !Number.isFinite(balance)) ||
      (hasInterest && rate !== null && !(rate >= 0 && rate <= 100)) ||
      (hasInterest && day !== null && !(Number.isInteger(day) && day >= 1 && day <= 31))
    ) {
      setError(t('accounts.form.validation'));
      return;
    }
    const today = format(new Date(), 'yyyy-MM-dd');
    const values: AccountFormValues = {
      name: name.trim(),
      kind,
      currency: code,
      institution: institution.trim() || null,
      isLiquid,
      interestMode: hasInterest && interestMode ? interestMode : null,
      payoutDay: hasInterest && interestMode === 'monthly' ? day : null,
      maturityDate: hasInterest && interestMode && maturityDate ? maturityDate : null,
    };
    if (!initial && balance !== null) values.initialBalance = { date: today, amount: balance };
    if (!initial && hasInterest && interestMode && rate !== null) values.initialRate = { date: today, rate };
    setSubmitting(true);
    setError('');
    onSubmit(values)
      .catch(() => setError(t('accounts.form.error')))
      .finally(() => setSubmitting(false));
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={2}>
        {error && (
          <Alert severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        <LabeledTextField fullWidth label={t('accounts.form.name')} value={name} onChange={(e) => setName(e.target.value)} required />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2 }}>
          <LabeledTextField select fullWidth label={t('accounts.form.kind')} value={kind} onChange={(e) => handleKindChange(e.target.value as AccountKind)}>
            {ACCOUNT_KINDS.map((value) => (
              <MenuItem key={value} value={value}>
                {t(`accounts.kinds.${value}`)}
              </MenuItem>
            ))}
          </LabeledTextField>
          <FormField label={t('accounts.form.currency')}>
            <Autocomplete
              freeSolo
              options={CURRENCIES}
              value={currency}
              onInputChange={(_, value) => setCurrency(value)}
              renderInput={(params) => <TextField {...params} inputProps={{ ...params.inputProps, maxLength: 3, 'aria-label': t('accounts.form.currency') }} />}
            />
          </FormField>
          <LabeledTextField fullWidth label={t('accounts.form.institution')} value={institution} onChange={(e) => setInstitution(e.target.value)} />
          {!initial && (
            <LabeledTextField
              fullWidth
              label={t(kind === 'property' ? 'accounts.form.initialValue' : 'accounts.form.initialBalance', { currency: currency.toUpperCase() || 'RUB' })}
              type="number"
              inputProps={{ step: 0.01 }}
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
            />
          )}
        </Box>
        {hasInterest && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2 }}>
            <LabeledTextField select fullWidth label={t('accounts.form.interestMode')} value={interestMode} onChange={(e) => setInterestMode(e.target.value as InterestMode | '')}>
              <MenuItem value="">{t('accounts.interestModes.none')}</MenuItem>
              {INTEREST_MODES.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`accounts.interestModes.${value}`)}
                </MenuItem>
              ))}
            </LabeledTextField>
            {interestMode === 'monthly' && (
              <LabeledTextField
                fullWidth
                label={t('accounts.form.payoutDay')}
                type="number"
                inputProps={{ min: 1, max: 31 }}
                placeholder={t('accounts.form.payoutDayPlaceholder')}
                value={payoutDay}
                onChange={(e) => setPayoutDay(e.target.value)}
              />
            )}
            {interestMode && (
              <DateField label={t('accounts.form.maturityDate')} value={maturityDate} onChange={setMaturityDate} />
            )}
            {!initial && interestMode && (
              <LabeledTextField
                fullWidth
                label={t('accounts.form.initialRate')}
                type="number"
                inputProps={{ step: 0.01, min: 0, max: 100 }}
                value={initialRate}
                onChange={(e) => setInitialRate(e.target.value)}
              />
            )}
          </Box>
        )}
        {hasInterest && interestMode && (
          <Typography variant="caption" color="text.secondary">
            {t(`accounts.interestModeHelp.${interestMode}`)}
          </Typography>
        )}
        <Stack spacing={0.5}>
          <FormControlLabel
            control={
              <Switch
                checked={isLiquid}
                onChange={(_, checked) => {
                  setIsLiquid(checked);
                  setLiquidTouched(true);
                }}
              />
            }
            label={t('accounts.form.isLiquid')}
          />
          <Typography variant="caption" color="text.secondary">
            {t('accounts.form.isLiquidHelp')}
          </Typography>
        </Stack>
        <Button type="submit" variant="contained" disabled={submitting} sx={{ alignSelf: 'flex-start' }}>
          {submitLabel}
        </Button>
      </Stack>
    </Box>
  );
}
