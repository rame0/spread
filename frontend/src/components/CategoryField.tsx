import { useEffect, useState } from 'react';
import { MenuItem, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useCategories } from '../categories';
import { suggestCategory } from '../services/api';
import type { CategorySuggestion } from '../types/v2';
import { FormField } from './FormField';

const DEBOUNCE_MS = 400;

/** What the backend would pick for this description, refreshed while the user types. */
function useSuggestion(description: string): CategorySuggestion | null {
  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null);
  useEffect(() => {
    const text = description.trim();
    if (!text) {
      setSuggestion(null);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      suggestCategory(text)
        .then((next) => alive && setSuggestion(next))
        .catch(() => alive && setSuggestion(null));
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [description]);
  return suggestion;
}

/**
 * Category of a purchase being entered. Without a choice the backend assigns its confident guess
 * by itself; `value` is set only when the user picks, and the form then confirms it after saving.
 */
export default function CategoryField({
  description,
  value,
  onChange,
}: {
  description: string;
  value: string | null;
  onChange: (categoryId: string | null) => void;
}) {
  const { t } = useTranslation();
  const categories = useCategories();
  const suggestion = useSuggestion(description);
  const guess = categories?.find((category) => category.id === suggestion?.categoryId);
  const shown = value ?? (suggestion?.confident ? guess?.id : undefined) ?? '';

  let helper = '';
  if (!value && guess) helper = suggestion?.confident ? t('categories.field.auto') : t('categories.field.maybe', { name: guess.name });

  return (
    <FormField label={t('categories.field.label')}>
      <TextField
        select
        fullWidth
        value={shown}
        onChange={(event) => onChange(event.target.value || null)}
        helperText={helper || ' '}
        inputProps={{ 'aria-label': t('categories.field.label') }}
        SelectProps={{ displayEmpty: true, renderValue: (selected) => (selected ? categories?.find((c) => c.id === selected)?.name : t('categories.field.empty')) }}
      >
        {(categories ?? []).map((category) => (
          <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>
        ))}
      </TextField>
    </FormField>
  );
}
