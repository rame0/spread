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
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { getCards, createCard } from '../services/api';
import { presetDefaults, type GracePreset } from '../cardGrace';
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
  const [addCardDialogOpen, setAddCardDialogOpen] = useState(false);

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

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
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
          <Button
            color="inherit"
            variant="outlined"
            size="small"
            onClick={() => setAddCardDialogOpen(true)}
            sx={{ ml: 2 }}
          >
            {t('main.createCard.createButton')}
          </Button>
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
      <Dialog open={addCardDialogOpen} onClose={() => setAddCardDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('main.createCard.createButton')}</DialogTitle>
        <DialogContent>
          <CreateCardForm
            onCreated={(card) => {
              setAddCardDialogOpen(false);
              getCards().then(setCards).catch(() => {});
              navigate(`/cards/${card.id}`);
              setSuccess(t('main.createCard.success'));
            }}
            onSuccess={() => {}}
          />
        </DialogContent>
      </Dialog>
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
  const [preset, setPreset] = useState<GracePreset>('sber_120');
  const [gracePeriods, setGracePeriods] = useState('4');
  const [graceDueDay, setGraceDueDay] = useState('10');
  const [graceStatementPeriods, setGraceStatementPeriods] = useState('4');
  const [paymentDueOffsetDays, setPaymentDueOffsetDays] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const applyPreset = (nextPreset: GracePreset, nextReportDay: number) => {
    const defaults = presetDefaults(nextPreset, nextReportDay);
    setPreset(nextPreset);
    setGracePeriods(defaults.gracePeriods);
    setGraceDueDay(defaults.graceDueDay);
    setGraceStatementPeriods(defaults.graceStatementPeriods);
    setPaymentDueOffsetDays(defaults.paymentDueOffsetDays);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rd = parseInt(reportDay, 10);
    const gp = parseInt(gracePeriods, 10);
    const gdd = parseInt(graceDueDay, 10);
    const gsp = parseInt(graceStatementPeriods, 10);
    const pdo = parseInt(paymentDueOffsetDays, 10);
    if (!name.trim() || isNaN(rd) || rd < 1 || rd > 31) {
      setError(t('main.createCard.validationError'));
      return;
    }
    if (preset === 'legacy_months' && (isNaN(gp) || gp < 1 || gp > 36 || isNaN(gdd) || gdd < 1 || gdd > 31)) {
      setError(t('main.createCard.validationError'));
      return;
    }
    if (
      preset !== 'legacy_months' &&
      (isNaN(gsp) || gsp < 1 || gsp > 12 || isNaN(pdo) || pdo < 0 || pdo > 31)
    ) {
      setError(t('main.createCard.validationError'));
      return;
    }
    setSubmitting(true);
    setError('');
    createCard({
      name: name.trim(),
      reportDay: rd,
      graceModel: preset === 'legacy_months' ? 'legacy_months' : 'statement_periods',
      gracePeriods: preset === 'legacy_months' ? gp : undefined,
      graceDueDay: preset === 'legacy_months' ? gdd : undefined,
      graceStatementPeriods: preset !== 'legacy_months' ? gsp : undefined,
      paymentDueOffsetDays: preset !== 'legacy_months' ? pdo : undefined,
    })
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
      <FormControl fullWidth margin="normal">
        <InputLabel id="grace-preset-label">{t('main.createCard.presetLabel')}</InputLabel>
        <Select
          labelId="grace-preset-label"
          value={preset}
          label={t('main.createCard.presetLabel')}
          onChange={(e) => applyPreset(e.target.value as GracePreset, parseInt(reportDay, 10) || 10)}
        >
          <MenuItem value="sber_120">{t('main.createCard.presets.sber120')}</MenuItem>
          <MenuItem value="ozon_78">{t('main.createCard.presets.ozon78')}</MenuItem>
          <MenuItem value="custom_statement">{t('main.createCard.presets.customStatement')}</MenuItem>
          <MenuItem value="legacy_months">{t('main.createCard.presets.legacyMonths')}</MenuItem>
        </Select>
      </FormControl>
      <TextField
        fullWidth
        label={t('main.createCard.reportDayLabel')}
        type="number"
        inputProps={{ min: 1, max: 31 }}
        value={reportDay}
        onChange={(e) => {
          const nextValue = e.target.value;
          setReportDay(nextValue);
          const nextReportDay = parseInt(nextValue, 10);
          if (!Number.isNaN(nextReportDay) && ['sber_120', 'ozon_78', 'legacy_months'].includes(preset)) {
            applyPreset(preset, nextReportDay);
          }
        }}
        margin="normal"
        required
      />
      {preset === 'legacy_months' ? (
        <>
          <TextField
            fullWidth
            label={t('settingsForm.gracePeriodsLabel')}
            type="number"
            inputProps={{ min: 1, max: 36 }}
            value={gracePeriods}
            onChange={(e) => setGracePeriods(e.target.value)}
            margin="normal"
            helperText={t('settingsForm.gracePeriodsHelp')}
          />
          <TextField
            fullWidth
            label={t('settingsForm.graceDueDayLabel')}
            type="number"
            inputProps={{ min: 1, max: 31 }}
            value={graceDueDay}
            onChange={(e) => setGraceDueDay(e.target.value)}
            margin="normal"
            helperText={t('settingsForm.graceDueDayHelp')}
          />
        </>
      ) : (
        <>
          <TextField
            fullWidth
            label={t('settingsForm.graceStatementPeriodsLabel')}
            type="number"
            inputProps={{ min: 1, max: 12 }}
            value={graceStatementPeriods}
            onChange={(e) => setGraceStatementPeriods(e.target.value)}
            margin="normal"
            helperText={t('settingsForm.graceStatementPeriodsHelp')}
          />
          <TextField
            fullWidth
            label={t('settingsForm.paymentDueOffsetDaysLabel')}
            type="number"
            inputProps={{ min: 0, max: 31 }}
            value={paymentDueOffsetDays}
            onChange={(e) => setPaymentDueOffsetDays(e.target.value)}
            margin="normal"
            helperText={t('settingsForm.paymentDueOffsetDaysHelp')}
          />
        </>
      )}
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
