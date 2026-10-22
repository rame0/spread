import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { formatMoney, formatMoneyValue } from '../formatMoney';
import {
  getStatementImports,
  importStatement,
  previewStatement,
} from '../services/api';
import type { StatementImportHistoryItem, StatementPreview } from '../types/v2';

interface Props {
  cardId: string;
}

function responseError(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
}

export default function StatementImport({ cardId }: Props) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reconcile, setReconcile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [history, setHistory] = useState<StatementImportHistoryItem[]>([]);
  const [inputKey, setInputKey] = useState(0);

  const loadHistory = () => {
    getStatementImports(cardId).then(setHistory).catch(() => undefined);
  };

  useEffect(loadHistory, [cardId]);

  const selectable = useMemo(
    () => preview?.operations.filter((operation) => operation.duplicateReason !== 'already_imported') ?? [],
    [preview]
  );

  const handleFile = async (nextFile: File | null) => {
    if (!nextFile) return;
    setFile(nextFile);
    setPreview(null);
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const nextPreview = await previewStatement(cardId, nextFile);
      setPreview(nextPreview);
      setSelected(new Set(nextPreview.operations.filter((operation) => !operation.duplicate).map((operation) => operation.fingerprint)));
      setReconcile(false);
    } catch (e) {
      setFile(null);
      setError(responseError(e, t('statementImport.errors.preview')));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !preview) return;
    setImporting(true);
    setError('');
    setSuccess('');
    try {
      const result = await importStatement(cardId, file, [...selected], reconcile);
      setSuccess(t('statementImport.success', {
        purchases: result.importedPurchases,
        deposits: result.importedDeposits,
        duplicates: result.skippedDuplicates,
        reconciliation: result.reconciliationCreated ? t('common.yes') : t('common.no'),
      }));
      setPreview(null);
      setFile(null);
      setInputKey((value) => value + 1);
      loadHistory();
    } catch (e) {
      setError(responseError(e, t('statementImport.errors.import')));
    } finally {
      setImporting(false);
    }
  };

  const toggle = (fingerprint: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(fingerprint)) next.delete(fingerprint);
      else next.add(fingerprint);
      return next;
    });
  };

  return (
    <Box>
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle1">{t('statementImport.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('statementImport.hint')}
          </Typography>
        </Box>
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}
        <Button component="label" variant="outlined" disabled={loading || importing} sx={{ alignSelf: 'flex-start' }}>
          {loading ? <CircularProgress size={22} /> : t('statementImport.choose')}
          <input
            key={inputKey}
            hidden
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          />
        </Button>

        {preview && (
          <Stack spacing={2}>
            <Alert severity="info">
              {t('statementImport.summary', {
                bank: t(`statementImport.banks.${preview.bank}`),
                from: preview.periodStart,
                to: preview.periodEnd,
                debt: formatMoneyValue(preview.actualDebt),
                count: preview.operations.length,
              })}
            </Alert>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectable.length > 0 && selectable.every((operation) => selected.has(operation.fingerprint))}
                    indeterminate={selected.size > 0 && !selectable.every((operation) => selected.has(operation.fingerprint))}
                    onChange={(_, checked) => setSelected(new Set(checked ? selectable.map((operation) => operation.fingerprint) : []))}
                  />
                }
                label={t('statementImport.selectAll')}
              />
              <Typography variant="body2" color="text.secondary">
                {t('statementImport.selected', { count: selected.size })}
              </Typography>
            </Stack>
            <TableContainer sx={{ maxHeight: 460, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>{t('statementImport.table.date')}</TableCell>
                    <TableCell>{t('statementImport.table.type')}</TableCell>
                    <TableCell>{t('statementImport.table.description')}</TableCell>
                    <TableCell align="right">{t('statementImport.table.amount')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.operations.map((operation) => (
                    <TableRow key={operation.fingerprint} selected={selected.has(operation.fingerprint)}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selected.has(operation.fingerprint)}
                          disabled={operation.duplicateReason === 'already_imported'}
                          onChange={() => toggle(operation.fingerprint)}
                        />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {operation.operationDate}{operation.operationTime ? ` ${operation.operationTime}` : ''}
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5} alignItems="flex-start">
                          <Chip
                            size="small"
                            color={operation.kind === 'purchase' ? 'default' : 'success'}
                            label={t(`statementImport.types.${operation.kind}`)}
                          />
                          {operation.duplicate && (
                            <Chip size="small" variant="outlined" color="warning" label={t(`statementImport.duplicates.${operation.duplicateReason}`)} />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>{operation.description}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {formatMoney(operation.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <FormControlLabel
              control={
                <Checkbox
                  checked={reconcile}
                  disabled={!preview.reconciliationAllowed}
                  onChange={(_, checked) => setReconcile(checked)}
                />
              }
              label={t('statementImport.reconcile', { date: preview.periodEnd, debt: formatMoneyValue(preview.actualDebt) })}
            />
            {!preview.reconciliationAllowed && (
              <Alert severity="warning">
                {preview.reconciliationAlreadyImported
                  ? t('statementImport.reconcileAlreadyDone')
                  : t('statementImport.reconcileUnavailable', { date: preview.lastEventDate ?? '—' })}
              </Alert>
            )}
            <Button
              variant="outlined"
              onClick={handleImport}
              disabled={importing || (selected.size === 0 && !reconcile)}
              sx={{ alignSelf: 'flex-start' }}
            >
              {importing ? <CircularProgress size={22} /> : t('statementImport.import', { count: selected.size })}
            </Button>
          </Stack>
        )}

        {history.length > 0 && (
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>{t('statementImport.history')}</Typography>
            <Stack spacing={1}>
              {history.map((item) => (
                <Typography key={item.id} variant="body2" color="text.secondary">
                  {t('statementImport.historyLine', {
                    bank: t(`statementImport.banks.${item.bank}`),
                    from: item.periodStart ?? '—',
                    to: item.periodEnd ?? '—',
                    date: new Date(item.createdAt).toLocaleString(),
                  })}
                </Typography>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  );
}
