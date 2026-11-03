import React from 'react';
import { Alert, Box, Link, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../formatMoney';
import { getDateFnsLocale } from '../i18n';
import type { Account, AccountEvent, AccountEventKind, BenefitRuleset, TaxBenefits } from '../types/v2';
import { EventForm, EventsTable } from './SavingsSection';

const parseDate = (value: string) => new Date(`${value}T00:00:00`);

const EVENT_KINDS: Record<'pds' | 'iis', AccountEventKind[]> = {
  pds: ['contribution', 'cofinancing', 'pension_transfer', 'withdrawal'],
  iis: ['contribution', 'withdrawal'],
};

type TaxBenefitSectionProps = {
  account: Account;
  ruleset: BenefitRuleset | null;
  events: AccountEvent[];
  benefits: TaxBenefits;
  onYearChange: (year: number) => void;
  onChanged: (message: string) => void;
  onError: (message: string) => void;
};

/** Rules, contributions and the benefits of the year for a ПДС or ИИС, with its operations. */
export default function TaxBenefitSection({ account, ruleset, events, benefits, onYearChange, onChanged, onError }: TaxBenefitSectionProps) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const money = (value: number) => formatCurrency(value, account.currency);
  const longDate = (value: string) => format(parseDate(value), 'd MMMM yyyy', { locale });
  const { summary } = benefits;
  const year = summary.year;
  const row = summary.accounts.find((line) => line.accountId === account.id);
  const kind = account.kind === 'pds' ? 'pds' : 'iis';
  const cofinancing = kind === 'pds' ? summary.cofinancing : null;
  const synced = account.externalSource === 'tinvest';

  const cofinancingHint = () => {
    if (!cofinancing) return '';
    if (cofinancing.status === 'window_over') return t('taxBenefits.cofinancingOver', { year: cofinancing.lastYear });
    if (cofinancing.status === 'below_minimum') return t('taxBenefits.cofinancingBelowMinimum', { amount: money(cofinancing.toMinimum) });
    if (cofinancing.toMax > 0) return t('taxBenefits.cofinancingToMax', { amount: money(cofinancing.toMax), cap: money(cofinancing.cap) });
    return t('taxBenefits.cofinancingMax', { year: year + 1 });
  };

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h6">{t('taxBenefits.accountTitle')}</Typography>
              <Typography color="text.secondary">
                {ruleset
                  ? `${t(`taxBenefits.rulesets.${ruleset.id}.name`)} · ${t('taxBenefits.openedAt', { date: longDate(account.openedAt ?? ruleset.openedFrom) })}`
                  : t('taxBenefits.noRuleset')}
              </Typography>
            </Box>
            <TextField
              select
              size="small"
              value={year}
              onChange={(e) => onYearChange(Number(e.target.value))}
              inputProps={{ 'aria-label': t('taxBenefits.year') }}
            >
              {benefits.years.map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          {row?.warnings.map((warning) => (
            <Alert key={warning} severity="warning">
              {t(`taxBenefits.warnings.${warning}`)}
            </Alert>
          ))}
          {!summary.rulesKnown && <Alert severity="info">{t('taxBenefits.rulesUnknown', { year })}</Alert>}
          {summary.rulesKnown && summary.incomeAssumed && (
            <Alert severity="info">
              {t('taxBenefits.incomeAssumed')}{' '}
              <Link component={RouterLink} to="/accounts">
                {t('taxBenefits.enterIncome')}
              </Link>
            </Alert>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' }, gap: 2 }}>
            <Figure
              title={t('taxBenefits.contributions', { year })}
              value={money(row?.contributions ?? 0)}
              hint={row && row.planned > 0 ? t('taxBenefits.planned', { amount: money(row.planned) }) : undefined}
            />
            {cofinancing && <Figure title={t('taxBenefits.cofinancing')} value={money(cofinancing.expected)} hint={cofinancingHint()} />}
            {row?.deductible && (
              <Figure
                title={t('taxBenefits.refund')}
                value={money(summary.deduction.refund)}
                hint={t('taxBenefits.refundHint', { base: money(summary.deduction.base), limit: money(summary.deduction.limit) })}
              />
            )}
            {account.unlockDate && (
              <Figure title={t('taxBenefits.unlockDate')} value={format(parseDate(account.unlockDate), 'd MMM yyyy', { locale })} hint={t('taxBenefits.unlockHint')} />
            )}
          </Box>
          {ruleset && (
            <Typography variant="caption" color="text.secondary">
              {t(`taxBenefits.rulesets.${ruleset.id}.summary`, { years: t('taxBenefits.yearsCount', { count: ruleset.lockYears }) })} {t('taxBenefits.sources', { sources: ruleset.sources.join('; ') })}
            </Typography>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">{t('taxBenefits.eventsTitle')}</Typography>
            <Typography color="text.secondary">{t(synced ? 'taxBenefits.eventsSynced' : `taxBenefits.eventsHint.${kind}`)}</Typography>
          </Box>
          <EventForm
            account={account}
            kinds={EVENT_KINDS[kind]}
            onSaved={() => onChanged(t('savings.eventSaved'))}
            onError={() => onError(t('savings.eventError'))}
          />
          <EventsTable account={account} events={events} onChanged={onChanged} onError={onError} />
        </Stack>
      </Paper>
    </Stack>
  );
}

function Figure({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
      <Typography sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' }, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
  );
}
