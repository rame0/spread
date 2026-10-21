import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';
import { connectTinvest, disconnectTinvest, getTinvestStatus, linkTinvestAccount, syncTinvest } from '../services/api';
import type { TinvestStatus } from '../types/v2';

const TOKEN_HELP_URL = 'https://developer.tbank.ru/invest/intro/intro/token';

/** Server errors are in English; the known ones get a translation. */
function useErrorText() {
  const { t } = useTranslation();
  return (message: string | null) => {
    if (!message) return '';
    if (message === 'Token is invalid or revoked') return t('tinvest.invalidToken');
    if (message.startsWith('Stored token cannot be decrypted')) return t('tinvest.undecryptable');
    return t('tinvest.syncError', { message });
  };
}

/** Connection to T-Bank Invest: token, accounts to add, sync status. */
export default function TinvestCard({ onChanged }: { onChanged: (message: string) => void }) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const navigate = useNavigate();
  const errorText = useErrorText();
  const [status, setStatus] = useState<TinvestStatus | null>(null);
  const [token, setToken] = useState('');
  const [editingToken, setEditingToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    getTinvestStatus()
      .then(setStatus)
      .catch(() => setError(t('tinvest.loadError')));

  useEffect(() => {
    load();
  }, []);

  const run = (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError('');
    action()
      .then(() => {
        onChanged(message);
        return load();
      })
      .catch((failure: { response?: { status?: number } }) => setError(failure?.response?.status === 400 ? t('tinvest.invalidToken') : t('tinvest.actionError')))
      .finally(() => setBusy(false));
  };

  const saveToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    run(
      () =>
        connectTinvest(token.trim()).then(() => {
          setToken('');
          setEditingToken(false);
        }),
      t('tinvest.connected')
    );
  };

  if (!status) {
    return (
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        {error ? <Alert severity="error">{error}</Alert> : <CircularProgress size={24} />}
      </Paper>
    );
  }

  const tokenForm = (
    <Stack component="form" direction={{ xs: 'column', sm: 'row' }} spacing={1} onSubmit={saveToken}>
      <TextField
        size="small"
        fullWidth
        type="password"
        autoComplete="off"
        placeholder={t('tinvest.tokenPlaceholder')}
        inputProps={{ 'aria-label': t('tinvest.token') }}
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      <Button type="submit" variant="contained" disabled={busy || !token.trim()} sx={{ flexShrink: 0 }}>
        {t('tinvest.connect')}
      </Button>
      {editingToken && (
        <Button onClick={() => setEditingToken(false)} sx={{ flexShrink: 0 }}>
          {t('tinvest.cancel')}
        </Button>
      )}
    </Stack>
  );

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">{t('tinvest.title')}</Typography>
          <Typography color="text.secondary">
            {status.connected
              ? status.lastSyncAt
                ? t('tinvest.lastSync', { date: format(new Date(status.lastSyncAt), 'd MMMM, HH:mm', { locale }) })
                : t('tinvest.notSynced')
              : t('tinvest.intro')}
          </Typography>
        </Box>
        {error && (
          <Alert severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {status.lastError && <Alert severity="warning">{errorText(status.lastError)}</Alert>}

        {!status.connected && (
          <>
            {tokenForm}
            <Typography variant="caption" color="text.secondary">
              {t('tinvest.tokenHelp')}{' '}
              <Link href={TOKEN_HELP_URL} target="_blank" rel="noreferrer">
                {t('tinvest.tokenHelpLink')}
              </Link>
            </Typography>
          </>
        )}

        {status.connected && (
          <>
            {status.accounts.length > 0 && (
              <Box>
                {status.accounts.map((account) => (
                  <Stack
                    key={account.id}
                    direction="row"
                    spacing={2}
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ py: 1, borderTop: '1px solid', borderColor: 'divider' }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={600}>{account.name || account.id}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t(`tinvest.types.${account.type}`, { defaultValue: t('tinvest.types.other') })}
                      </Typography>
                    </Box>
                    {account.linkedAccountId ? (
                      <Button size="small" onClick={() => navigate(`/accounts/${account.linkedAccountId}`)}>
                        {t('tinvest.open')}
                      </Button>
                    ) : (
                      <Button size="small" variant="outlined" disabled={busy} onClick={() => run(() => linkTinvestAccount(account.id), t('tinvest.linked'))}>
                        {t('tinvest.add')}
                      </Button>
                    )}
                  </Stack>
                ))}
              </Box>
            )}
            {editingToken && tokenForm}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button variant="outlined" disabled={busy || !status.accounts.some((account) => account.linkedAccountId)} onClick={() => run(syncTinvest, t('tinvest.synced'))}>
                {t('tinvest.syncNow')}
              </Button>
              {!editingToken && (
                <Button onClick={() => setEditingToken(true)} disabled={busy}>
                  {t('tinvest.replaceToken')}
                </Button>
              )}
              <Button color="error" disabled={busy} onClick={() => run(disconnectTinvest, t('tinvest.disconnected'))}>
                {t('tinvest.disconnect')}
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {t('tinvest.syncHint')}
            </Typography>
          </>
        )}
      </Stack>
    </Paper>
  );
}
