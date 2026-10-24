import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, TablePagination, TextField, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../../i18n';
import { formatMoney } from '../../formatMoney';
import { getPurchases } from '../../services/api';
import type { Purchase, PurchasePage } from '../../types/v2';
import { DateBadge, Row, Rows } from '../../components/Row';
import CategoryTag from '../../components/CategoryTag';
import type { CardTabProps } from './CardDebt';

const PAGE_SIZES = [25, 50, 100];
const PAGE_SIZE_KEY = 'cardPurchases.pageSize';

const readPageSize = () => {
  try {
    const stored = Number(window.localStorage.getItem(PAGE_SIZE_KEY));
    return PAGE_SIZES.includes(stored) ? stored : 50;
  } catch {
    return 50;
  }
};
const storePageSize = (value: number) => {
  try {
    window.localStorage.setItem(PAGE_SIZE_KEY, String(value));
  } catch {
    // Only a convenience: the page works without it.
  }
};

export default function CardPurchases({ card, version, onAddPurchase }: CardTabProps) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [list, setList] = useState<PurchasePage | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(readPageSize);

  // Searching on every keystroke would send a request per letter.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => setPage(0), [card.id]);

  const load = useCallback(
    () => getPurchases(card.id, { limit: pageSize, offset: page * pageSize, query: search }),
    [card.id, page, pageSize, search]
  );

  useEffect(() => {
    let cancelled = false;
    load()
      .then((result) => {
        if (!cancelled) setList(result);
      })
      .catch(() => {
        if (!cancelled) setError(t('purchases.loadError'));
      });
    return () => {
      cancelled = true;
    };
  }, [load, version, t]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!list) return <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}><CircularProgress size={24} /></Box>;

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
      {list.items.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2 }}>{t('purchases.empty')}</Typography>
      ) : (
        <Rows>
          {list.items.map((purchase) => {
            const { text, color } = meta(purchase);
            return (
              <Row
                key={purchase.id}
                leading={<DateBadge date={purchase.purchaseDate} />}
                title={purchase.description || t('purchases.emptyDescription')}
                meta={
                  <>
                    <CategoryTag
                      cardId={card.id}
                      purchaseId={purchase.id}
                      categoryId={purchase.categoryId}
                      source={purchase.categorySource}
                      onChanged={() => load().then(setList).catch(() => undefined)}
                    />
                    {' · '}
                    <Box component="span" sx={{ color }}>{text}</Box>
                  </>
                }
                trailing={formatMoney(purchase.amount)}
              />
            );
          })}
        </Rows>
      )}
      {list.total > PAGE_SIZES[0] && (
        <TablePagination
          component="div"
          count={list.total}
          page={page}
          onPageChange={(_, next) => setPage(next)}
          showFirstButton
          showLastButton
          rowsPerPage={pageSize}
          rowsPerPageOptions={PAGE_SIZES}
          onRowsPerPageChange={(event) => {
            const size = Number(event.target.value);
            storePageSize(size);
            setPageSize(size);
            setPage(0);
          }}
          labelRowsPerPage={t('debts.purchases.perPage')}
          labelDisplayedRows={({ from, to, count }) => t('debts.purchases.range', { from, to, count })}
          getItemAriaLabel={(type) => t(`debts.purchases.pageAria.${type}`)}
        />
      )}
    </Stack>
  );
}
