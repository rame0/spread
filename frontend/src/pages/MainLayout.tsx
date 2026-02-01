import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Box,
  Container,
  AppBar,
  Toolbar,
  Typography,
  Tabs,
  Tab,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { getCards, createCard } from '../services/api';
import type { Card } from '../types/v2';
import { useTranslation } from 'react-i18next';

const tabPaths = ['', 'purchases', 'deposits', 'plan', 'settings'];

export default function MainLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { cardId } = useParams<{ cardId: string }>();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    getCards()
      .then(setCards)
      .catch(() => setError(t('main.loadCardsError')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    if (!loading && cards.length > 0 && !cardId) {
      const id = cards[0].id;
      const timer = setTimeout(() => {
        navigate(`/cards/${id}`, { replace: true });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [loading, cards, cardId, navigate]);

  const selectedCardId = cardId || cards[0]?.id;
  const pathParts = location.pathname.split('/');
  const tabSlug = pathParts[3] || '';
  const tabIndex = Math.max(0, tabPaths.indexOf(tabSlug));

  const handleTabChange = (_: React.SyntheticEvent, v: number) => {
    const base = selectedCardId ? `/cards/${selectedCardId}` : '/';
    const path = v === 0 ? base : `${base}/${tabPaths[v]}`;
    navigate(path);
  };

  const handleCardChange = (e: { target: { value: string } }) => {
    const id = e.target.value;
    if (id) navigate(`/cards/${id}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleLanguageChange = (e: { target: { value: string } }) => {
    i18n.changeLanguage(e.target.value);
  };

  const currentLanguage = i18n.language.startsWith('ru') ? 'ru' : 'en';

  if (loading) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 4 }} />;
  if (error) return <Alert severity="error">{error}</Alert>;

  if (cards.length === 0) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              {t('app.title')}
            </Typography>
            <Typography variant="body2">{user?.email}</Typography>
            <Button color="inherit" onClick={handleLogout} sx={{ ml: 2 }}>
              {t('common.logout')}
            </Button>
          </Toolbar>
        </AppBar>
        <Container maxWidth="sm" sx={{ mt: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('main.noCards.title')}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {t('main.noCards.subtitle')}
            </Typography>
            <CreateCardForm
              onCreated={(card) => {
                setCards([card]);
                navigate(`/cards/${card.id}`);
              }}
              onSuccess={() => setSuccess(t('main.createCard.success'))}
            />
          </Paper>
        </Container>
        <Snackbar
          open={Boolean(success)}
          autoHideDuration={3000}
          onClose={() => setSuccess('')}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity="success" onClose={() => setSuccess('')} sx={{ width: '100%' }}>
            {success}
          </Alert>
        </Snackbar>
      </Box>
    );
  }

  if (cards.length > 0 && !cardId) {
    return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 4 }} />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {t('app.title')}
          </Typography>
          <FormControl size="small" sx={{ minWidth: 200 }} variant="standard">
            <InputLabel id="card-select-label" sx={{ color: 'white' }}>
              {t('main.cardSelect')}
            </InputLabel>
            <Select
              labelId="card-select-label"
              value={selectedCardId || ''}
              onChange={handleCardChange}
              label={t('main.cardSelect')}
              sx={{ color: 'white', '& .MuiSvgIcon-root': { color: 'white' } }}
            >
              {cards.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl
            size="small"
            sx={{ minWidth: 130, ml: 2 }}
            variant="standard"
          >
            <InputLabel id="language-select-label" sx={{ color: 'white' }}>
              {t('common.language')}
            </InputLabel>
            <Select
              labelId="language-select-label"
              value={currentLanguage}
              onChange={handleLanguageChange}
              label={t('common.language')}
              sx={{ color: 'white', '& .MuiSvgIcon-root': { color: 'white' } }}
            >
              <MenuItem value="ru">{t('common.languages.ru')}</MenuItem>
              <MenuItem value="en">{t('common.languages.en')}</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="body2" sx={{ ml: 2 }}>
            {user?.email}
          </Typography>
          <Button color="inherit" onClick={handleLogout} sx={{ ml: 1 }}>
            {t('common.logout')}
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 2, mb: 4, flexGrow: 1 }}>
        <Paper sx={{ p: 0 }}>
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label={t('main.tabs.dashboard')} />
            <Tab label={t('main.tabs.purchases')} />
            <Tab label={t('main.tabs.deposits')} />
            <Tab label={t('main.tabs.plan')} />
            <Tab label={t('main.tabs.settings')} />
          </Tabs>
          <Box p={3}>
            <Outlet />
          </Box>
        </Paper>
      </Container>
      <Snackbar
        open={Boolean(success)}
        autoHideDuration={3000}
        onClose={() => setSuccess('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function CreateCardForm({
  onCreated,
  onSuccess,
}: {
  onCreated: (card: Card) => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [reportDay, setReportDay] = useState('10');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rd = parseInt(reportDay, 10);
    if (!name.trim() || isNaN(rd) || rd < 1 || rd > 31) {
      setError(t('main.createCard.validationError'));
      return;
    }
    setSubmitting(true);
    setError('');
    createCard({ name: name.trim(), reportDay: rd })
      .then((card) => {
        onCreated(card);
        onSuccess();
      })
      .catch(() => setError(t('main.createCard.createError')))
      .finally(() => setSubmitting(false));
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <TextField
        fullWidth
        label={t('main.createCard.nameLabel')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        margin="normal"
        required
      />
      <TextField
        fullWidth
        label={t('main.createCard.reportDayLabel')}
        type="number"
        inputProps={{ min: 1, max: 31 }}
        value={reportDay}
        onChange={(e) => setReportDay(e.target.value)}
        margin="normal"
        required
      />
      <Button
        type="submit"
        variant="contained"
        disabled={submitting}
        sx={{ mt: 2 }}
      >
        {t('main.createCard.createButton')}
      </Button>
    </form>
  );
}
