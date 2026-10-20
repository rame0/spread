import React, { useState } from 'react';
import { Alert, Box, Button, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';
import type { Mortgage, MortgageInput } from '../types/v2';
import { FormField, LabeledTextField } from './FormField';

type MortgageFormProps = {
  initial?: Mortgage;
  submitLabel: string;
  onSubmit: (values: MortgageInput) => Promise<unknown>;
};

export default function MortgageForm({ initial, submitLabel, onSubmit }: MortgageFormProps) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [name, setName] = useState(initial?.name ?? '');
  const [principal, setPrincipal] = useState(initial ? String(initial.principal) : '');
  const [issueDate, setIssueDate] = useState<Date | null>(initial ? new Date(`${initial.issueDate}T00:00:00`) : new Date());
  const [annualRate, setAnnualRate] = useState(initial ? String(initial.annualRate) : '6');
  const [termMonths, setTermMonths] = useState(initial ? String(initial.termMonths) : '360');
  const [paymentDay, setPaymentDay] = useState(initial ? String(initial.paymentDay) : '');
  const [firstPaymentInterestOnly, setFirstPaymentInterestOnly] = useState(initial?.firstPaymentInterestOnly ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const values: MortgageInput = {
      name: name.trim(),
      principal: Number(principal),
      issueDate: issueDate ? format(issueDate, 'yyyy-MM-dd') : '',
      annualRate: Number(annualRate),
      termMonths: Number(termMonths),
      // Sberbank sets the payment day to the issue day unless the contract says otherwise.
      paymentDay: paymentDay ? Number(paymentDay) : issueDate?.getDate() ?? 0,
      firstPaymentInterestOnly,
    };
    if (
      !values.name ||
      !(values.principal > 0) ||
      !values.issueDate ||
      !(values.annualRate >= 0 && values.annualRate <= 100) ||
      !Number.isInteger(values.termMonths) || values.termMonths < 1 || values.termMonths > 600 ||
      !Number.isInteger(values.paymentDay) || values.paymentDay < 1 || values.paymentDay > 31
    ) {
      setError(t('mortgage.form.validation'));
      return;
    }
    setSubmitting(true);
    setError('');
    onSubmit(values)
      .catch(() => setError(t('mortgage.form.error')))
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
        <LabeledTextField fullWidth label={t('mortgage.form.name')} value={name} onChange={(e) => setName(e.target.value)} required />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2 }}>
          <LabeledTextField
            fullWidth
            label={t('mortgage.form.principal')}
            type="number"
            inputProps={{ min: 0, step: 0.01 }}
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            required
          />
          <FormField label={t('mortgage.form.issueDate')}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={locale}>
              <DatePicker value={issueDate} onChange={setIssueDate} slotProps={{ textField: { fullWidth: true } }} />
            </LocalizationProvider>
          </FormField>
          <LabeledTextField
            fullWidth
            label={t('mortgage.form.annualRate')}
            type="number"
            inputProps={{ min: 0, max: 100, step: 0.01 }}
            value={annualRate}
            onChange={(e) => setAnnualRate(e.target.value)}
            required
          />
          <LabeledTextField
            fullWidth
            label={t('mortgage.form.termMonths')}
            type="number"
            inputProps={{ min: 1, max: 600, step: 1 }}
            value={termMonths}
            onChange={(e) => setTermMonths(e.target.value)}
            required
          />
          <LabeledTextField
            fullWidth
            label={t('mortgage.form.paymentDay')}
            type="number"
            inputProps={{ min: 1, max: 31, step: 1 }}
            placeholder={issueDate ? String(issueDate.getDate()) : ''}
            value={paymentDay}
            onChange={(e) => setPaymentDay(e.target.value)}
          />
        </Box>
        <Stack spacing={0.5}>
          <FormControlLabel
            control={<Switch checked={firstPaymentInterestOnly} onChange={(_, checked) => setFirstPaymentInterestOnly(checked)} />}
            label={t('mortgage.form.firstPaymentInterestOnly')}
          />
          <Typography variant="caption" color="text.secondary">
            {t('mortgage.form.firstPaymentHelp')}
          </Typography>
        </Stack>
        <Button type="submit" variant="contained" disabled={submitting} sx={{ alignSelf: 'flex-start' }}>
          {submitLabel}
        </Button>
      </Stack>
    </Box>
  );
}
