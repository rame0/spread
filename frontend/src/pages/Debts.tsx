import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Box, Button, List, ListItemButton, ListItemIcon, ListItemText, Paper, Stack, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { useTranslation } from 'react-i18next';
import type { CardsOutletContext } from '../cardContext';

/** All debts in one list: credit and installment cards, mortgages. */
export default function Debts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { cards, mortgages, openAddCard, openAddMortgage } = useOutletContext<CardsOutletContext>();

  const row = (key: string, icon: React.ReactElement, name: string, meta: string, path: string) => (
    <ListItemButton key={key} onClick={() => navigate(path)} sx={{ py: 1.1 }}>
      <ListItemIcon sx={{ minWidth: 48 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: '9px', display: 'grid', placeItems: 'center', bgcolor: 'var(--surface-2)', color: 'text.secondary', '& svg': { fontSize: 18 } }}>
          {icon}
        </Box>
      </ListItemIcon>
      <ListItemText primary={name} secondary={meta} primaryTypographyProps={{ fontWeight: 500 }} secondaryTypographyProps={{ variant: 'caption' }} />
      <ChevronRightRoundedIcon sx={{ color: 'text.disabled' }} />
    </ListItemButton>
  );

  const group = (title: string, items: React.ReactNode[], addLabel: string, onAdd: () => void) => (
    <Paper sx={{ p: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, pt: 0.5, pb: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '.05em' }}>
          {title}
        </Typography>
        <Button size="small" startIcon={<AddRoundedIcon />} onClick={onAdd}>
          {addLabel}
        </Button>
      </Stack>
      {items.length > 0 ? (
        <List disablePadding>{items}</List>
      ) : (
        <Typography color="text.secondary" sx={{ px: 1.5, py: 1.5 }}>
          {t('debts.emptyGroup')}
        </Typography>
      )}
    </Paper>
  );

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 720 }}>
      <Typography variant="h4">{t('nav.debts')}</Typography>
      {group(
        t('debts.cards'),
        cards.map((card) =>
          row(
            card.id,
            card.kind === 'installment' ? <PaymentsOutlinedIcon /> : <CreditCardOutlinedIcon />,
            card.name,
            t(`main.createCard.kinds.${card.kind}`),
            `/cards/${card.id}`
          )
        ),
        t('debts.addCard'),
        openAddCard
      )}
      {group(
        t('debts.mortgages'),
        mortgages.map((mortgage) => row(mortgage.id, <HomeOutlinedIcon />, mortgage.name, t('debts.mortgage'), `/mortgages/${mortgage.id}`)),
        t('debts.addMortgage'),
        openAddMortgage
      )}
    </Stack>
  );
}
