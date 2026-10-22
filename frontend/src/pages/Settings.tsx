import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Paper, Snackbar, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import { useColorScheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import TinvestCard from '../components/TinvestCard';

type Mode = 'system' | 'light' | 'dark';

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={{ xs: 1, sm: 2 }}
      alignItems={{ sm: 'center' }}
      justifyContent="space-between"
      sx={{ py: 1.5, '& + &': { borderTop: '1px solid var(--border)' } }}
    >
      <Typography sx={{ fontWeight: 500 }}>{label}</Typography>
      <Box sx={{ '& .MuiToggleButtonGroup-root': { display: { xs: 'flex', sm: 'inline-flex' } }, '& .MuiToggleButton-root': { flex: { xs: 1, sm: 'none' } } }}>
        {children}
      </Box>
    </Stack>
  );
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { mode, setMode } = useColorScheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const language = i18n.language.startsWith('ru') ? 'ru' : 'en';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 720 }}>
      <Typography variant="h4">{t('nav.settings')}</Typography>

      <Paper sx={{ px: 2.5, py: 1 }}>
        <SettingRow label={t('appSettings.theme')}>
          <ToggleButtonGroup exclusive size="small" value={mode ?? 'system'} onChange={(_, next: Mode | null) => next && setMode(next)}>
            <ToggleButton value="system">{t('appSettings.themes.system')}</ToggleButton>
            <ToggleButton value="light">{t('appSettings.themes.light')}</ToggleButton>
            <ToggleButton value="dark">{t('appSettings.themes.dark')}</ToggleButton>
          </ToggleButtonGroup>
        </SettingRow>
        <SettingRow label={t('common.language')}>
          <ToggleButtonGroup exclusive size="small" value={language} onChange={(_, next: string | null) => next && i18n.changeLanguage(next)}>
            <ToggleButton value="ru">{t('common.languages.ru')}</ToggleButton>
            <ToggleButton value="en">{t('common.languages.en')}</ToggleButton>
          </ToggleButtonGroup>
        </SettingRow>
      </Paper>

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: '.05em' }}>
          {t('appSettings.integrations')}
        </Typography>
        <TinvestCard onChanged={setMessage} />
      </Box>

      <Paper sx={{ px: 2.5, py: 1 }}>
        <SettingRow label={t('appSettings.account')}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography color="text.secondary" noWrap>
              {user?.email}
            </Typography>
            <Button variant="outlined" startIcon={<LogoutRoundedIcon />} onClick={handleLogout}>
              {t('common.logout')}
            </Button>
          </Stack>
        </SettingRow>
      </Paper>

      <Snackbar open={Boolean(message)} autoHideDuration={3000} onClose={() => setMessage('')}>
        <Alert severity="success" onClose={() => setMessage('')} sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
