import React, { useState } from 'react';
import { Alert, Autocomplete, Box, Button, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { Account, AccountInput, AccountKind } from '../types/v2';
import { FormField, LabeledTextField } from './FormField';

export const ACCOUNT_KINDS: AccountKind[] = ['debit', 'cash', 'savings', 'deposit', 'brokerage', 'property', 'other'];
const CURRENCIES = ['RUB', 'USD', 'EUR', 'KZT', 'CNY', 'GBP', 'TRY', 'AED', 'GEL', 'AMD'];
/** Deposits, brokerage accounts and property are not money for everyday spending. */
const liquidByDefault = (kind: AccountKind) => kind === 'debit' || kind === 'cash' || kind === 'savings' || kind === 'other';

export type AccountFormValues = AccountInput & { initialBalance?: { date: string; amount: number } };

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleKindChange = (next: AccountKind) => {
    setKind(next);
    if (!liquidTouched) setIsLiquid(liquidByDefault(next));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = currency.trim().toUpperCase();
    const balance = initialBalance.trim() === '' ? null : Number(initialBalance.replace(',', '.'));
    if (!name.trim() || !/^[A-Z]{3}$/.test(code) || (balance !== null && !Number.isFinite(balance))) {
      setError(t('accounts.form.validation'));
      return;
    }
    const values: AccountFormValues = { name: name.trim(), kind, currency: code, institution: institution.trim() || null, isLiquid };
    if (!initial && balance !== null) values.initialBalance = { date: format(new Date(), 'yyyy-MM-dd'), amount: balance };
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
