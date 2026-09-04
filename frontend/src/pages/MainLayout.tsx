import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  AppBar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import ShoppingCartRoundedIcon from '@mui/icons-material/ShoppingCartRounded';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../contexts/AuthContext';
import { presetDefaults, type GracePreset } from '../cardGrace';
import { createCard, getCards } from '../services/api';
import type { Card } from '../types/v2';
import { useTranslation } from 'react-i18next';

const LEFT_RAIL_WIDTH = 280;
const TOP_BAR_HEIGHT = 72;

export default function MainLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { cardId } = useParams<{ cardId: string }>();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [addCardDialogOpen, setAddCardDialogOpen] = useState(false);
  const [mobileRailOpen, setMobileRailOpen] = useState(false);

  useEffect(() => {
    getCards()
      .then(setCards)
      .catch(() => setError(t('main.loadCardsError')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    if (!loading && cardId && cards.length > 0 && !cards.some((card) => card.id === cardId)) {
      navigate(`/cards/${cards[0].id}`, { replace: true });
    }
  }, [loading, cards, cardId, navigate]);

  const currentLanguage = i18n.language.startsWith('ru') ? 'ru' : 'en';
  const selectedCard = cards.find((card) => card.id === cardId) ?? null;
  const selectedSection =
    location.pathname.includes('/purchases')
      ? 'purchases'
      : location.pathname.includes('/deposits')
        ? 'deposits'
        : location.pathname.includes('/settings')
          ? 'settings'
          : location.pathname.startsWith('/cards/')
            ? 'overview'
            : 'main';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleLanguageChange = (e: { target: { value: string } }) => {
    i18n.changeLanguage(e.target.value);
  };

  const handleCardSelect = (id: string) => {
    navigate(`/cards/${id}`);
    setMobileRailOpen(false);
  };

  const handleCardActionSelect = (slug: '' | 'purchases' | 'deposits' | 'settings') => {
    if (!selectedCard) return;
    navigate(slug ? `/cards/${selectedCard.id}/${slug}` : `/cards/${selectedCard.id}`);
    setMobileRailOpen(false);
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (cards.length === 0) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <TopBar
          currentLanguage={currentLanguage}
          email={user?.email ?? ''}
          onLanguageChange={handleLanguageChange}
          onLogout={handleLogout}
        />
        <Box sx={{ flexGrow: 1, display: 'grid', placeItems: 'center', p: 3 }}>
          <Paper sx={{ width: '100%', maxWidth: 640, p: 4 }}>
            <Stack spacing={1.5} sx={{ mb: 3 }}>
              <Typography variant="h5">{t('main.noCards.title')}</Typography>
              <Typography color="text.secondary">{t('main.noCards.subtitle')}</Typography>
            </Stack>
            <CreateCardForm
              onCreated={(card) => {
                setCards([card]);
                navigate(`/cards/${card.id}`);
              }}
              onSuccess={() => setSuccess(t('main.createCard.success'))}
            />
          </Paper>
        </Box>
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

  const rail = (
    <LeftRail
      cards={cards}
      selectedCardId={selectedCard?.id ?? null}
      selectedSection={selectedSection}
      onMainDashboard={() => {
        navigate('/');
        setMobileRailOpen(false);
      }}
      onCardSelect={handleCardSelect}
      onCardActionSelect={handleCardActionSelect}
      onAddCard={() => {
        setAddCardDialogOpen(true);
        setMobileRailOpen(false);
      }}
    />
  );

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'background.default' }}>
      {isDesktop ? (
        <Drawer
          variant="permanent"
          open
          PaperProps={{
            sx: {
              width: LEFT_RAIL_WIDTH,
              bgcolor: 'background.paper',
              borderRight: '1px solid',
              borderColor: 'divider',
              px: 2,
              py: 2,
            },
          }}
        >
          {rail}
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={mobileRailOpen}
          onClose={() => setMobileRailOpen(false)}
          ModalProps={{ keepMounted: true }}
          PaperProps={{
            sx: {
              width: LEFT_RAIL_WIDTH,
              bgcolor: 'background.paper',
              borderRight: '1px solid',
              borderColor: 'divider',
              px: 2,
              py: 2,
            },
          }}
        >
          {rail}
        </Drawer>
      )}

      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          ml: isDesktop ? `${LEFT_RAIL_WIDTH}px` : 0,
        }}
      >
        <TopBar
          currentLanguage={currentLanguage}
          email={user?.email ?? ''}
          onLanguageChange={handleLanguageChange}
          onLogout={handleLogout}
          onOpenRail={isDesktop ? undefined : () => setMobileRailOpen(true)}
        />

        <Box
          component="main"
          sx={{
            minHeight: `calc(100vh - ${TOP_BAR_HEIGHT}px)`,
            p: { xs: 2, md: 3 },
            width: '100%',
            maxWidth: 1440,
            mx: 'auto',
          }}
        >
          {location.pathname === '/' ? <MainDashboardPlaceholder /> : <Outlet />}
        </Box>
      </Box>

      <Dialog open={addCardDialogOpen} onClose={() => setAddCardDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('main.createCard.createButton')}</DialogTitle>
        <DialogContent>
          <CreateCardForm
            onCreated={(card) => {
              setAddCardDialogOpen(false);
              getCards().then(setCards).catch(() => setError(t('main.loadCardsError')));
              navigate(`/cards/${card.id}`);
              setSuccess(t('main.createCard.success'));
            }}
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

function TopBar({
  currentLanguage,
  email,
  onLanguageChange,
  onLogout,
  onOpenRail,
}: {
  currentLanguage: string;
  email: string;
  onLanguageChange: (e: { target: { value: string } }) => void;
  onLogout: () => void;
  onOpenRail?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <AppBar position="sticky" sx={{ height: TOP_BAR_HEIGHT, justifyContent: 'center' }}>
      <Toolbar
        sx={{
          minHeight: `${TOP_BAR_HEIGHT}px !important`,
          px: { xs: 2, md: 3 },
          gap: 1.5,
        }}
      >
        {onOpenRail && (
          <IconButton color="inherit" onClick={onOpenRail} edge="start">
            <MenuRoundedIcon />
          </IconButton>
        )}
        <Typography variant="subtitle1" sx={{ flexGrow: 1 }} noWrap>
          {t('app.title')}
        </Typography>
        <FormControl size="small" sx={{ minWidth: 132, '& .MuiInputBase-root': { height: 44 } }}>
          <InputLabel id="language-select-label">{t('common.language')}</InputLabel>
          <Select
            labelId="language-select-label"
            value={currentLanguage}
            label={t('common.language')}
            onChange={onLanguageChange}
          >
            <MenuItem value="ru">{t('common.languages.ru')}</MenuItem>
            <MenuItem value="en">{t('common.languages.en')}</MenuItem>
          </Select>
        </FormControl>
        <Paper
          sx={{
            px: 1.75,
            py: 1,
            borderRadius: 999,
            bgcolor: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
            display: { xs: 'none', sm: 'block' },
          }}
        >
          <Typography variant="body2" color="text.secondary" noWrap>
            {email}
          </Typography>
        </Paper>
        <Button color="inherit" variant="outlined" onClick={onLogout} startIcon={<LogoutRoundedIcon />}>
          {t('common.logout')}
        </Button>
      </Toolbar>
    </AppBar>
  );
}

function LeftRail({
  cards,
  selectedCardId,
  selectedSection,
  onMainDashboard,
  onCardSelect,
  onCardActionSelect,
  onAddCard,
}: {
  cards: Card[];
  selectedCardId: string | null;
  selectedSection: string;
  onMainDashboard: () => void;
  onCardSelect: (id: string) => void;
  onCardActionSelect: (slug: '' | 'purchases' | 'deposits' | 'settings') => void;
  onAddCard: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Stack sx={{ height: '100%' }} spacing={3}>
      <Stack spacing={1.5}>
        <RailButton
          active={selectedSection === 'main'}
          icon={<DashboardRoundedIcon fontSize="small" />}
          onClick={onMainDashboard}
        >
          {t('main.sidebar.mainDashboard')}
        </RailButton>
      </Stack>

      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            {t('main.sidebar.cards')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {cards.length}
          </Typography>
        </Stack>
        <Stack spacing={1}>
          {cards.map((card) => (
            <RailButton
              key={card.id}
              active={false}
              icon={<CreditCardRoundedIcon fontSize="small" />}
              onClick={() => onCardSelect(card.id)}
            >
              <Box component="span" sx={{ fontWeight: selectedCardId === card.id ? 700 : 500 }}>
                {card.name}
              </Box>
            </RailButton>
          ))}
        </Stack>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={onAddCard}>
          {t('main.createCard.createButton')}
        </Button>
      </Stack>

      {selectedCardId && (
        <Stack spacing={1.5} sx={{ mt: 'auto' }}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1.5 }}>
            {t('main.sidebar.cardActions')}
          </Typography>
          <Stack spacing={1}>
            <RailButton
              active={selectedSection === 'overview'}
              icon={<DashboardRoundedIcon fontSize="small" />}
              onClick={() => onCardActionSelect('')}
            >
              {t('main.sidebar.overview')}
            </RailButton>
            <RailButton
              active={selectedSection === 'purchases'}
              icon={<ShoppingCartRoundedIcon fontSize="small" />}
              onClick={() => onCardActionSelect('purchases')}
            >
              {t('main.tabs.purchases')}
            </RailButton>
            <RailButton
              active={selectedSection === 'deposits'}
              icon={<SavingsRoundedIcon fontSize="small" />}
              onClick={() => onCardActionSelect('deposits')}
            >
              {t('main.tabs.deposits')}
            </RailButton>
            <RailButton
              active={selectedSection === 'settings'}
              icon={<SettingsRoundedIcon fontSize="small" />}
              onClick={() => onCardActionSelect('settings')}
            >
              {t('main.tabs.settings')}
            </RailButton>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}

function RailButton({
  active,
  icon,
  children,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      fullWidth
      onClick={onClick}
      startIcon={icon}
      variant="contained"
      sx={{
        justifyContent: 'flex-start',
        px: 1.75,
        minHeight: 46,
        color: active ? 'text.primary' : 'text.secondary',
        bgcolor: active
          ? 'color-mix(in srgb, var(--accent) 20%, var(--surface))'
          : 'var(--surface)',
        border: '1px solid',
        borderColor: active ? 'var(--accent)' : 'divider',
        '&:hover': {
          bgcolor: active
            ? 'color-mix(in srgb, var(--accent) 26%, var(--surface))'
            : 'var(--surface-input)',
        },
      }}
    >
      {children}
    </Button>
  );
}

function MainDashboardPlaceholder() {
  const { t } = useTranslation();

  return (
    <Paper sx={{ p: { xs: 3, md: 4 } }}>
      <Stack spacing={1.5}>
        <Typography variant="h5">{t('main.placeholder.title')}</Typography>
        <Typography color="text.secondary">{t('main.placeholder.subtitle')}</Typography>
      </Stack>
    </Paper>
  );
}

function CreateCardForm({
  onCreated,
  onSuccess,
}: {
  onCreated: (card: Card) => void;
  onSuccess?: () => void;
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
  const isOzonPreset = preset === 'ozon_78';
  const isLegacyPreset = preset === 'legacy_months';
  const isStatementPreset = preset === 'sber_120' || preset === 'custom_statement';

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
    if (!name.trim() || Number.isNaN(rd) || rd < 1 || rd > 31) {
      setError(t('main.createCard.validationError'));
      return;
    }
    if (
      preset === 'legacy_months' &&
      (Number.isNaN(gp) || gp < 1 || gp > 36 || Number.isNaN(gdd) || gdd < 1 || gdd > 31)
    ) {
      setError(t('main.createCard.validationError'));
      return;
    }
    if (
      preset !== 'legacy_months' &&
      (Number.isNaN(gsp) || gsp < 1 || gsp > 12 || Number.isNaN(pdo) || pdo < 0 || pdo > 31)
    ) {
      setError(t('main.createCard.validationError'));
      return;
    }

    setSubmitting(true);
    setError('');
    createCard({
      name: name.trim(),
      reportDay: rd,
      graceModel:
        preset === 'legacy_months'
          ? 'legacy_months'
          : preset === 'ozon_78'
            ? 'ozon_anchor'
            : 'statement_periods',
      gracePeriods: preset === 'legacy_months' ? gp : undefined,
      graceDueDay: preset === 'legacy_months' ? gdd : undefined,
      graceStatementPeriods: preset !== 'legacy_months' ? gsp : undefined,
      paymentDueOffsetDays: preset !== 'legacy_months' ? pdo : undefined,
    })
      .then((card) => {
        onCreated(card);
        onSuccess?.();
      })
      .catch(() => setError(t('main.createCard.createError')))
      .finally(() => setSubmitting(false));
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <Stack spacing={2}>
        <TextField
          fullWidth
          label={t('main.createCard.nameLabel')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <FormControl fullWidth>
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
        <Alert severity="info">
          <Typography variant="body2">{t(`settingsForm.modelInfo.${preset}`)}</Typography>
        </Alert>
        {!isOzonPreset && (
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
              if (!Number.isNaN(nextReportDay) && ['sber_120', 'legacy_months'].includes(preset)) {
                applyPreset(preset, nextReportDay);
              }
            }}
            required
          />
        )}
        {isOzonPreset && (
          <TextField
            fullWidth
            label={t('settingsForm.ozonAnchorPreviewLabel')}
            value={t('settingsForm.ozonAnchorPreviewValue')}
            InputProps={{ readOnly: true }}
            helperText={t('settingsForm.ozonAnchorPreviewHelp')}
          />
        )}
        {isLegacyPreset ? (
          <>
            <TextField
              fullWidth
              label={t('settingsForm.gracePeriodsLabel')}
              type="number"
              inputProps={{ min: 1, max: 36 }}
              value={gracePeriods}
              onChange={(e) => setGracePeriods(e.target.value)}
              helperText={t('settingsForm.gracePeriodsHelp')}
            />
            <TextField
              fullWidth
              label={t('settingsForm.graceDueDayLabel')}
              type="number"
              inputProps={{ min: 1, max: 31 }}
              value={graceDueDay}
              onChange={(e) => setGraceDueDay(e.target.value)}
              helperText={t('settingsForm.graceDueDayHelp')}
            />
          </>
        ) : isStatementPreset ? (
          <>
            <TextField
              fullWidth
              label={t('settingsForm.graceStatementPeriodsLabel')}
              type="number"
              inputProps={{ min: 1, max: 12 }}
              value={graceStatementPeriods}
              onChange={(e) => setGraceStatementPeriods(e.target.value)}
              helperText={t('settingsForm.graceStatementPeriodsHelp')}
            />
            <TextField
              fullWidth
              label={t('settingsForm.paymentDueOffsetDaysLabel')}
              type="number"
              inputProps={{ min: 0, max: 31 }}
              value={paymentDueOffsetDays}
              onChange={(e) => setPaymentDueOffsetDays(e.target.value)}
              helperText={t('settingsForm.paymentDueOffsetDaysHelp')}
            />
          </>
        ) : null}
        {isOzonPreset && (
          <Typography variant="body2" color="text.secondary">
            {t('settingsForm.ozonExample')}
          </Typography>
        )}
        <Button type="submit" variant="contained" disabled={submitting} sx={{ alignSelf: 'flex-start' }}>
          {t('main.createCard.createButton')}
        </Button>
      </Stack>
    </Box>
  );
}
