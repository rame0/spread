import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { addMonths, format } from 'date-fns';
import { getDateFnsLocale } from '../i18n';
import { useTranslation } from 'react-i18next';
import { formatMoney, formatMoneyWhole } from '../formatMoney';
import { invalidateCategories, useCategories } from '../categories';
import {
  backfillCategories,
  createCategory,
  getCategoryMonth,
  deleteCategory,
  getReferenceCategories,
  getUncategorizedPurchases,
  updateCategory,
} from '../services/api';
import type { Category, CategoryMonthRow, CategoryReviewGroup } from '../types/v2';
import CategoryTag from '../components/CategoryTag';
import { FormField } from '../components/FormField';
import { DateBadge, Row, Rows } from '../components/Row';

const SHOWN = 15;

/** Purchases waiting for a category and the user's categories with their reference mapping. */
export default function PlanCategories() {
  const { t } = useTranslation();
  const categories = useCategories();
  const [pending, setPending] = useState<CategoryReviewGroup[] | null>(null);
  const [reference, setReference] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [dialog, setDialog] = useState<{ category?: Category } | null>(null);

  const reload = useCallback(() => {
    getUncategorizedPurchases()
      .then(setPending)
      .catch(() => setError(t('categories.review.loadError')));
  }, [t]);

  useEffect(() => {
    reload();
    getReferenceCategories().then(setReference).catch(() => undefined);
  }, [reload]);

  const backfill = () => {
    setBackfilling(true);
    backfillCategories()
      .then((result) => {
        setMessage(t('categories.review.backfillDone', result));
        reload();
      })
      .catch(() => setError(t('categories.review.backfillError')))
      .finally(() => setBackfilling(false));
  };

  const shown = pending && (showAll ? pending : pending.slice(0, SHOWN));

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      <CategoryMonth categories={categories ?? []} reloadKey={pending} />

      <Paper sx={{ p: 2.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
          <Box>
            <Typography variant="subtitle1">
              {t('categories.review.title')}
              {pending && pending.length > 0 && ` · ${pending.length}`}
            </Typography>
            <Typography variant="body2" color="text.secondary">{t('categories.review.subtitle')}</Typography>
          </Box>
          <Button variant="outlined" startIcon={<AutoFixHighRoundedIcon />} disabled={backfilling} onClick={backfill} sx={{ flex: 'none' }}>
            {t('categories.review.backfill')}
          </Button>
        </Stack>
        {!shown ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}><CircularProgress size={24} /></Box>
        ) : shown.length === 0 ? (
          <Typography color="text.secondary" sx={{ pt: 2 }}>{t('categories.review.empty')}</Typography>
        ) : (
          <Rows>
            {shown.map((group) => (
              <Row
                key={group.pattern}
                leading={<DateBadge date={group.lastDate} />}
                title={<span title={group.description ?? undefined}>{group.label || t('purchases.emptyDescription')}</span>}
                meta={
                  <>
                    <CategoryTag cardId={group.cardId} purchaseId={group.purchaseId} categoryId={null} onChanged={reload} />
                    {' · '}
                    {group.count > 1 ? t('categories.review.purchases', { count: group.count }) : group.cardName}
                  </>
                }
                trailing={formatMoney(group.total)}
              />
            ))}
          </Rows>
        )}
        {pending && pending.length > SHOWN && (
          <Button size="small" sx={{ ml: -1, mt: 0.5 }} onClick={() => setShowAll((current) => !current)}>
            {showAll ? t('mainDashboard.showLess') : t('mainDashboard.showAll', { count: pending.length })}
          </Button>
        )}
      </Paper>

      <Paper sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle1">{t('categories.list.title')}</Typography>
          <Button startIcon={<AddRoundedIcon />} onClick={() => setDialog({})}>{t('categories.list.add')}</Button>
        </Stack>
        {!categories ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}><CircularProgress size={24} /></Box>
        ) : (
          <Rows>
            {categories.map((category) => (
              <Row
                key={category.id}
                title={category.name}
                meta={
                  category.referenceCategories.length === 0
                    ? t('categories.list.referenceNone')
                    : category.referenceCategories.length === 1 && category.referenceCategories[0] === category.name
                      ? t('categories.list.referenceSame')
                      : t('categories.list.reference', { names: category.referenceCategories.join(', ') })
                }
                onClick={() => setDialog({ category })}
              />
            ))}
          </Rows>
        )}
      </Paper>

      <CategoryDialog
        open={dialog !== null}
        category={dialog?.category}
        categories={categories ?? []}
        reference={reference}
        onClose={() => setDialog(null)}
        onSaved={() => {
          setDialog(null);
          invalidateCategories();
          reload();
        }}
      />

      <Snackbar open={Boolean(message)} autoHideDuration={4000} onClose={() => setMessage('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setMessage('')} sx={{ width: '100%' }}>{message}</Alert>
      </Snackbar>
    </Stack>
  );
}

/** Card spending of each category in a month against the plan items of that category. */
function CategoryMonth({ categories, reloadKey }: { categories: Category[]; reloadKey: unknown }) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [month, setMonth] = useState(() => new Date());
  const [rows, setRows] = useState<CategoryMonthRow[] | null>(null);
  const key = format(month, 'yyyy-MM');
  const current = key === format(new Date(), 'yyyy-MM');

  useEffect(() => {
    setRows(null);
    getCategoryMonth(key).then(setRows).catch(() => setRows([]));
  }, [key, reloadKey]);

  const name = (categoryId: string | null) =>
    categoryId === null ? t('categories.none') : categories.find((category) => category.id === categoryId)?.name ?? '—';
  const fact = rows?.reduce((sum, row) => sum + row.fact, 0) ?? 0;
  // Plan items without a category have no purchases to compare with; they are listed apart.
  const unlinked = rows?.find((row) => row.categoryId === null)?.plan ?? 0;
  const plan = (rows?.reduce((sum, row) => sum + row.plan, 0) ?? 0) - unlinked;
  const shown = rows?.filter((row) => row.categoryId !== null || row.fact > 0) ?? [];

  return (
    <Paper sx={{ p: 2.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={1}>
        <Box>
          <Typography variant="subtitle1">{t('categories.month.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {plan > 0
              ? t('categories.month.total', { fact: formatMoneyWhole(fact), plan: formatMoneyWhole(plan) })
              : t('categories.month.spent', { fact: formatMoneyWhole(fact) })}
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" sx={{ alignSelf: { xs: 'center', sm: 'auto' } }}>
          <IconButton size="small" aria-label={t('categories.month.previous')} onClick={() => setMonth((value) => addMonths(value, -1))}>
            <ChevronLeftRoundedIcon />
          </IconButton>
          <Typography sx={{ minWidth: 96, textAlign: 'center', fontWeight: 500 }}>{format(month, 'LLLL yyyy', { locale })}</Typography>
          <IconButton size="small" aria-label={t('categories.month.next')} disabled={current} onClick={() => setMonth((value) => addMonths(value, 1))}>
            <ChevronRightRoundedIcon />
          </IconButton>
        </Stack>
      </Stack>
      {!rows ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}><CircularProgress size={24} /></Box>
      ) : shown.length === 0 ? (
        <Typography color="text.secondary" sx={{ pt: 2 }}>{t('categories.month.empty')}</Typography>
      ) : (
        <Stack spacing={1.25} sx={{ pt: 2 }}>
          {shown.map((row) => {
            const planned = row.categoryId === null ? 0 : row.plan;
            const over = planned > 0 && row.fact > planned;
            return (
              <Box key={row.categoryId ?? 'none'}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography noWrap sx={{ fontWeight: 500, color: row.categoryId ? undefined : 'text.secondary' }}>{name(row.categoryId)}</Typography>
                  <Typography sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: over ? 'error.main' : undefined }}>
                    {formatMoneyWhole(row.fact)}
                    {planned > 0 && (
                      <Box component="span" sx={{ color: 'text.secondary' }}> {t('categories.month.of', { plan: formatMoneyWhole(planned) })}</Box>
                    )}
                  </Typography>
                </Stack>
                {planned > 0 && (
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, (row.fact / planned) * 100)}
                    color={over ? 'error' : 'primary'}
                    sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
                  />
                )}
              </Box>
            );
          })}
        </Stack>
      )}
      {unlinked > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {t('categories.month.unlinked', { amount: formatMoneyWhole(unlinked) })}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>{t('categories.month.hint')}</Typography>
    </Paper>
  );
}

function CategoryDialog({
  open,
  category,
  categories,
  reference,
  onClose,
  onSaved,
}: {
  open: boolean;
  category?: Category;
  categories: Category[];
  reference: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [mapped, setMapped] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setMapped(category?.referenceCategories ?? []);
    setConfirmDelete(false);
    setError('');
  }, [open, category]);

  /** Which other category a reference category feeds now; picking it here moves it. */
  const owner = (referenceCategory: string) =>
    categories.find((other) => other.id !== category?.id && other.referenceCategories.includes(referenceCategory))?.name;

  const failed = (cause: unknown) => {
    const status = (cause as { response?: { status?: number; data?: { error?: string } } })?.response;
    setError(status?.data?.error === 'Category already exists' ? t('categories.dialog.exists') : t('categories.dialog.error'));
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError('');
    const request = category
      ? updateCategory(category.id, { name: trimmed, referenceCategories: mapped })
      : createCategory({ name: trimmed, referenceCategories: mapped });
    request.then(onSaved).catch(failed).finally(() => setSaving(false));
  };

  const remove = () => {
    if (!category) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    deleteCategory(category.id).then(onSaved).catch(failed).finally(() => setSaving(false));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{category ? t('categories.dialog.edit') : t('categories.dialog.add')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <FormField label={t('categories.dialog.name')}>
            <TextField fullWidth value={name} onChange={(event) => setName(event.target.value)} inputProps={{ maxLength: 64, 'aria-label': t('categories.dialog.name') }} />
          </FormField>
          <FormField label={t('categories.dialog.reference')}>
            <Autocomplete
              multiple
              options={reference}
              value={mapped}
              onChange={(_, next) => setMapped(next)}
              disableCloseOnSelect
              renderOption={({ key, ...props }, option) => (
                <li key={key} {...props}>
                  <Box>
                    {option}
                    {owner(option) && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {t('categories.dialog.referenceOwner', { name: owner(option) })}
                      </Typography>
                    )}
                  </Box>
                </li>
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...props } = getTagProps({ index });
                  return <Chip key={key} label={option} size="small" {...props} />;
                })
              }
              renderInput={(params) => <TextField {...params} inputProps={{ ...params.inputProps, 'aria-label': t('categories.dialog.reference') }} />}
            />
            <Typography variant="caption" color="text.secondary">{t('categories.dialog.referenceHelp')}</Typography>
          </FormField>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: category ? 'space-between' : 'flex-end' }}>
        {category && (
          <Button color="error" disabled={saving} onClick={remove}>
            {confirmDelete ? t('categories.dialog.deleteConfirm') : t('categories.dialog.delete')}
          </Button>
        )}
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>{t('categories.dialog.cancel')}</Button>
          <Button variant="contained" disabled={saving || !name.trim()} onClick={save}>{t('categories.dialog.save')}</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
