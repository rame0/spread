import { useEffect, useState } from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';
import { formatMoneyWhole } from '../formatMoney';
import { createPlanItem, dismissPlanSuggestion, getPlanSuggestions, patchPlanItem } from '../services/api';
import type { PlanSuggestion } from '../types/v2';
import { Row, Rows } from './Row';

/** Plan items proposed from recurring card purchases: add them, update their amounts or hide them. */
export default function PlanSuggestions({ reloadKey, onApplied, onError }: { reloadKey: unknown; onApplied: (message: string) => void; onError: (message: string) => void }) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [suggestions, setSuggestions] = useState<PlanSuggestion[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getPlanSuggestions().then(setSuggestions).catch(() => setSuggestions([]));
  }, [reloadKey]);

  if (suggestions.length === 0) return null;

  const apply = (suggestion: PlanSuggestion) => {
    setBusy(suggestion.key);
    const request = suggestion.action === 'update' && suggestion.planItemId
      ? patchPlanItem(suggestion.planItemId, { amount: suggestion.amount })
      : createPlanItem({
          name: suggestion.name,
          kind: 'expense',
          amount: suggestion.amount,
          currency: 'RUB',
          frequency: 'monthly',
          interval: 1,
          startDate: suggestion.startDate,
          endDate: null,
          spread: suggestion.spread,
          cardId: suggestion.cardId,
          targetAccountId: null,
          note: null,
          categoryId: suggestion.categoryId,
          sourcePattern: suggestion.sourcePattern,
        });
    request
      .then(() => onApplied(suggestion.action === 'update' ? t('financePlan.suggestions.updated') : t('financePlan.suggestions.added')))
      .catch(() => onError(t('financePlan.form.error')))
      .finally(() => setBusy(null));
  };

  const dismiss = (suggestion: PlanSuggestion) => {
    setBusy(suggestion.key);
    dismissPlanSuggestion(suggestion.key, suggestion.amount)
      .then(() => setSuggestions((current) => current.filter((other) => other.key !== suggestion.key)))
      .catch(() => onError(t('financePlan.form.error')))
      .finally(() => setBusy(null));
  };

  const basis = (suggestion: PlanSuggestion) => {
    const since = format(new Date(`${suggestion.startDate}T12:00:00`), 'd MMMM', { locale });
    const text = suggestion.kind === 'subscription'
      ? t('financePlan.suggestions.subscription', { date: since })
      : t('financePlan.suggestions.budget', { amounts: suggestion.months.map((month) => formatMoneyWhole(month.amount)).join(', ') });
    return suggestion.action === 'update' && suggestion.currentAmount !== null
      ? `${text} · ${t('financePlan.suggestions.current', { amount: formatMoneyWhole(suggestion.currentAmount) })}`
      : text;
  };

  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="subtitle1">{t('financePlan.suggestions.title')}</Typography>
      <Typography variant="body2" color="text.secondary">{t('financePlan.suggestions.subtitle')}</Typography>
      <Rows>
        {suggestions.map((suggestion) => (
          <Stack key={suggestion.key} direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={{ xs: 0, sm: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Row title={suggestion.name} meta={basis(suggestion)} trailing={formatMoneyWhole(suggestion.amount)} />
            </Box>
            <Stack direction="row" spacing={1} sx={{ pb: { xs: 1.25, sm: 0 }, flex: 'none' }}>
              <Button size="small" variant="outlined" disabled={busy === suggestion.key} onClick={() => apply(suggestion)}>
                {suggestion.action === 'update' ? t('financePlan.suggestions.update') : t('financePlan.suggestions.add')}
              </Button>
              <Button size="small" color="inherit" disabled={busy === suggestion.key} onClick={() => dismiss(suggestion)}>
                {t('financePlan.suggestions.dismiss')}
              </Button>
            </Stack>
          </Stack>
        ))}
      </Rows>
    </Paper>
  );
}
