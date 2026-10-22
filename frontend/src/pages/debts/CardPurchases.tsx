import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../../i18n';
import { formatMoney } from '../../formatMoney';
import { getPurchases } from '../../services/api';
import type { Purchase } from '../../types/v2';
import { DateBadge, Row, Rows } from '../../components/Row';
import type { CardTabProps } from './CardDebt';

export default function CardPurchases({ card, version, onAddPurchase }: CardTabProps) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [list, setList] = useState<Purchase[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    getPurchases(card.id)
      .then(setList)
      .catch(() => setError(t('purchases.loadError')));
  }, [card.id, version, t]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!list) return <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}><CircularProgress size={24} /></Box>;

  const needle = query.trim().toLowerCase();
  const shown = needle ? list.filter((purchase) => (purchase.description ?? '').toLowerCase().includes(needle) || String(purchase.amount).includes(needle)) : list;

  const meta = (purchase: Purchase) => {
    const progress = purchase.installments;
    if (!progress) return { text: format(new Date(purchase.purchaseDate), 'd MMMM yyyy', { locale }) };
    if (!progress.nextDueDate) return { text: t('installment.completed'), color: 'success.main' };
    const next = t('installment.nextPayment', {
      date: format(new Date(`${progress.nextDueDate}T12:00:00`), 'd MMM', { locale }),
      amount: formatMoney(progress.nextDueAmount),
    });
    return { text: `${t('installment.progress', { paid: progress.paid, count: progress.count })} · ${next}`, color: progress.overdue ? 'error.main' : undefined };
  };

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 1 }}>
        <TextField size="small" placeholder={t('debts.purchases.search')} value={query} onChange={(event) => setQuery(event.target.value)} sx={{ flex: 1 }} inputProps={{ 'aria-label': t('debts.purchases.search') }} />
        <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={onAddPurchase}>{t('debts.purchases.add')}</Button>
      </Stack>
      {shown.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2 }}>{t('purchases.empty')}</Typography>
      ) : (
        <Rows>
          {shown.map((purchase) => {
            const { text, color } = meta(purchase);
            return (
              <Row
                key={purchase.id}
                leading={<DateBadge date={purchase.purchaseDate} />}
                title={purchase.description || t('purchases.emptyDescription')}
                meta={text}
                metaColor={color}
                trailing={formatMoney(purchase.amount)}
              />
            );
          })}
        </Rows>
      )}
    </Stack>
  );
}
