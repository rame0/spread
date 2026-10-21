import React from 'react';
import { Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { NetWorthResult } from '../types/v2';

/** Currencies left out of the totals and rates that could not be refreshed. */
export default function RateWarnings({ netWorth }: { netWorth: NetWorthResult }) {
  const { t } = useTranslation();
  return (
    <>
      {netWorth.assets.missingRates.length > 0 && (
        <Alert severity="warning">{t('accounts.missingRates', { currencies: netWorth.assets.missingRates.join(', ') })}</Alert>
      )}
      {netWorth.ratesStale && <Alert severity="info">{t('accounts.ratesStale')}</Alert>}
    </>
  );
}
