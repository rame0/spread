import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || t('auth.login.error')
      );
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: 4,
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 1040,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.1fr) minmax(420px, 0.9fr)' },
          gap: 3,
          alignItems: 'stretch',
        }}
      >
        <Paper sx={{ p: { xs: 3, md: 5 }, display: 'flex', alignItems: 'flex-end', minHeight: 520 }}>
          <Stack spacing={2.5}>
            <Typography variant="caption" color="secondary.main">
              {t('app.title')}
            </Typography>
            <Typography variant="h4">{t('auth.login.heroTitle')}</Typography>
            <Typography color="text.secondary">{t('auth.login.heroSubtitle')}</Typography>
          </Stack>
        </Paper>

        <Paper sx={{ p: { xs: 3, md: 4 }, maxWidth: 520, width: '100%', justifySelf: 'center' }}>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography variant="h5">{t('auth.login.title')}</Typography>
              <Typography color="text.secondary">{t('auth.login.formSubtitle')}</Typography>
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label={t('fields.email')}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <TextField
                  fullWidth
                  label={t('fields.password')}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button type="submit" fullWidth variant="contained">
                  {t('auth.login.submit')}
                </Button>
              </Stack>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {t('auth.login.noAccount')}{' '}
              <Box component={Link} to="/register" sx={{ color: 'secondary.main', textDecoration: 'none' }}>
                {t('auth.login.registerLink')}
              </Box>
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
