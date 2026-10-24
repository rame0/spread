import React, { useState } from 'react';
import { ButtonBase, ListItemText, Menu, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useCategories } from '../categories';
import { setPurchaseCategory } from '../services/api';
import type { CategorySource } from '../types/v2';

/**
 * A purchase's category inline in a list row; a click opens the choice. Picking one is a
 * confirmation the backend turns into a rule for the same description.
 */
export default function CategoryTag({
  cardId,
  purchaseId,
  categoryId,
  source,
  onChanged,
}: {
  cardId: string;
  purchaseId: string;
  categoryId: string | null | undefined;
  source?: CategorySource | null;
  onChanged: (categoryId: string | null) => void;
}) {
  const { t } = useTranslation();
  const categories = useCategories();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [saving, setSaving] = useState(false);
  const name = categories?.find((category) => category.id === categoryId)?.name;

  const pick = (next: string | null) => {
    setAnchor(null);
    setSaving(true);
    setPurchaseCategory(cardId, purchaseId, next)
      .then(() => onChanged(next))
      .catch(() => undefined)
      .finally(() => setSaving(false));
  };

  const open = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchor(event.currentTarget);
  };

  return (
    <>
      <ButtonBase
        component="span"
        disabled={saving}
        onClick={open}
        title={source === 'model' ? t('categories.autoAssigned') : undefined}
        sx={{
          font: 'inherit',
          px: 0.75,
          borderRadius: 1,
          verticalAlign: 'baseline',
          color: name ? 'text.secondary' : 'warning.main',
          border: '1px dashed',
          borderColor: name && source !== 'model' ? 'transparent' : 'currentColor',
          bgcolor: name ? 'var(--surface-2)' : 'transparent',
        }}
      >
        {name ?? t('categories.none')}
      </ButtonBase>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} onClick={(event) => event.stopPropagation()}>
        {(categories ?? []).map((category) => (
          <MenuItem key={category.id} selected={category.id === categoryId} onClick={() => pick(category.id)}>
            <ListItemText>{category.name}</ListItemText>
          </MenuItem>
        ))}
        {categoryId && (
          <MenuItem onClick={() => pick(null)}>
            <ListItemText secondary={t('categories.clear')} />
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
