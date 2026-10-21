import React from 'react';
import { Box, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../formatMoney';
import { getDateFnsLocale } from '../i18n';
import type { AccountPortfolio } from '../types/v2';

/** Structure of a synced brokerage portfolio: value by asset class and yield. */
export default function PortfolioCard({ portfolio }: { portfolio: AccountPortfolio }) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const { total, parts, expectedYieldPercent, dailyYield } = portfolio.data;
  const percent = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString(i18n.language, { maximumFractionDigits: 2 })}%`;

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">{t('portfolio.title')}</Typography>
          <Typography color="text.secondary">
            {t('portfolio.syncedAt', { date: format(new Date(portfolio.syncedAt), 'd MMMM, HH:mm', { locale }) })}
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
          <Figure title={t('portfolio.total')} value={formatMoney(total)} />
          <Figure
            title={t('portfolio.yield')}
            value={expectedYieldPercent === null ? '—' : percent(expectedYieldPercent)}
            color={expectedYieldPercent === null || expectedYieldPercent === 0 ? undefined : expectedYieldPercent > 0 ? 'success.main' : 'error.main'}
          />
          <Figure
            title={t('portfolio.daily')}
            value={dailyYield === null ? '—' : `${dailyYield > 0 ? '+' : ''}${formatMoney(dailyYield)}`}
            color={dailyYield === null || dailyYield === 0 ? undefined : dailyYield > 0 ? 'success.main' : 'error.main'}
          />
        </Box>
        {parts.length > 0 && (
          <Stack spacing={1.5}>
            {parts.map((row) => {
              const share = total > 0 ? (row.amount / total) * 100 : 0;
              return (
                <Box key={row.part}>
                  <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Typography>{t(`portfolio.parts.${row.part}`)}</Typography>
                    <Typography sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatMoney(row.amount)}{' '}
                      <Typography component="span" color="text.secondary">
                        · {share.toLocaleString(i18n.language, { maximumFractionDigits: 1 })}%
                      </Typography>
                    </Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, share))} sx={{ mt: 0.5, height: 6, borderRadius: 3 }} />
                </Box>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

function Figure({ title, value, color }: { title: string; value: string; color?: string }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
      <Typography sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' }, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color }}>{value}</Typography>
    </Box>
  );
}
