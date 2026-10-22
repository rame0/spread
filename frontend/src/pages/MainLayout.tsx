import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { createMortgage, getCards, getMortgages } from '../services/api';
import type { Card, Mortgage } from '../types/v2';
import type { CardsOutletContext } from '../cardContext';
import { Brand, PageLoading } from '../components/Brand';
import CreateCardForm from '../components/CreateCardForm';
import MortgageForm from '../components/MortgageForm';
import QuickAdd from '../components/QuickAdd';
import Overview from './Overview';

const RAIL_WIDTH = 224;
const BOTTOM_BAR_HEIGHT = 60;

type Section = 'overview' | 'money' | 'debts' | 'plan' | 'capital' | 'settings';

const SECTIONS: { key: Exclude<Section, 'settings'>; path: string; icon: React.ReactElement }[] = [
  { key: 'overview', path: '/', icon: <GridViewOutlinedIcon /> },
  { key: 'money', path: '/accounts', icon: <AccountBalanceWalletOutlinedIcon /> },
  { key: 'debts', path: '/debts', icon: <CreditCardOutlinedIcon /> },
  { key: 'plan', path: '/plan', icon: <TimelineOutlinedIcon /> },
  { key: 'capital', path: '/capital', icon: <ShowChartRoundedIcon /> },
];

/** The phone bar keeps the everyday sections; net worth opens from the overview. */
const BOTTOM_SECTIONS = SECTIONS.filter((section) => section.key !== 'capital');

function sectionOf(pathname: string): Section | null {
  if (pathname === '/') return 'overview';
  if (pathname.startsWith('/accounts')) return 'money';
  if (pathname.startsWith('/debts') || pathname.startsWith('/cards/') || pathname.startsWith('/mortgages/')) return 'debts';
  if (pathname.startsWith('/plan')) return 'plan';
  if (pathname.startsWith('/capital')) return 'capital';
  if (pathname.startsWith('/settings')) return 'settings';
  return null;
}

export default function MainLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { cardId } = useParams<{ cardId: string }>();
  const location = useLocation();
  const { t } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [cards, setCards] = useState<Card[]>([]);
  const [mortgages, setMortgages] = useState<Mortgage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [addCardDialogOpen, setAddCardDialogOpen] = useState(false);
  const [addMortgageDialogOpen, setAddMortgageDialogOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  // Remounting the page after a quick operation makes it load fresh numbers.
  const [contentKey, setContentKey] = useState(0);

  useEffect(() => {
    Promise.all([getCards(), getMortgages()])
      .then(([nextCards, nextMortgages]) => {
        setCards(nextCards);
        setMortgages(nextMortgages);
      })
      .catch(() => setError(t('main.loadCardsError')))
      .finally(() => setLoading(false));
  }, [t]);

  const reloadMortgages = () => {
    getMortgages().then(setMortgages).catch(() => setError(t('main.loadCardsError')));
  };

  useEffect(() => {
    if (!loading && cardId && cards.length > 0 && !cards.some((card) => card.id === cardId)) {
      navigate(`/cards/${cards[0].id}`, { replace: true });
    }
  }, [loading, cards, cardId, navigate]);

  const section = sectionOf(location.pathname);

  const successSnackbar = (
    <Snackbar
      open={Boolean(success)}
      autoHideDuration={3000}
      onClose={() => setSuccess('')}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ bottom: { xs: BOTTOM_BAR_HEIGHT + 16, md: 24 } }}
    >
      <Alert severity="success" onClose={() => setSuccess('')} sx={{ width: '100%' }}>
        {success}
      </Alert>
    </Snackbar>
  );

  if (loading) return <PageLoading />;

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (cards.length === 0 && mortgages.length === 0) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
        <Paper sx={{ width: '100%', maxWidth: 640, p: { xs: 3, md: 4 } }}>
          <Stack spacing={1.5} sx={{ mb: 3 }}>
            <Brand />
            <Typography variant="h5" sx={{ pt: 1 }}>
              {t('main.noCards.title')}
            </Typography>
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
        {successSnackbar}
      </Box>
    );
  }

  const context: CardsOutletContext = {
    cards,
    mortgages,
    reloadMortgages,
    openAddCard: () => setAddCardDialogOpen(true),
    openAddMortgage: () => setAddMortgageDialogOpen(true),
    openQuickAdd: () => setQuickAddOpen(true),
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {isDesktop ? (
        <Rail section={section} email={user?.email ?? ''} />
      ) : (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2, pt: 'calc(10px + env(safe-area-inset-top))', pb: 0.5 }}
        >
          <Brand size={26} />
          <IconButton
            aria-label={t('nav.settings')}
            onClick={() => navigate('/settings')}
            sx={{ bgcolor: section === 'settings' ? 'var(--surface-2)' : undefined, color: 'text.secondary' }}
          >
            <SettingsOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}

      <Box
        component="main"
        sx={{
          ml: isDesktop ? `${RAIL_WIDTH}px` : 0,
          px: { xs: 2, md: 4.5 },
          pt: { xs: 1.5, md: 3.5 },
          pb: { xs: `calc(${BOTTOM_BAR_HEIGHT + 24}px + env(safe-area-inset-bottom))`, md: 6 },
          maxWidth: { md: `calc(1280px + ${RAIL_WIDTH}px)` },
        }}
      >
        <Box key={contentKey}>
          {location.pathname === '/' ? <Overview cards={cards} onQuickAdd={() => setQuickAddOpen(true)} /> : <Outlet context={context} />}
        </Box>
      </Box>

      {!isDesktop && <BottomBar section={section} onAdd={() => setQuickAddOpen(true)} />}
      <QuickAdd
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onDone={(message) => {
          setSuccess(message);
          setContentKey((current) => current + 1);
        }}
        cards={cards}
        mortgages={mortgages}
      />

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
      <Dialog open={addMortgageDialogOpen} onClose={() => setAddMortgageDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('mortgage.add')}</DialogTitle>
        <DialogContent>
          <MortgageForm
            submitLabel={t('mortgage.form.create')}
            onSubmit={(values) =>
              createMortgage(values).then((mortgage) => {
                setAddMortgageDialogOpen(false);
                reloadMortgages();
                navigate(`/mortgages/${mortgage.id}`);
                setSuccess(t('mortgage.created'));
              })
            }
          />
        </DialogContent>
      </Dialog>
      {successSnackbar}
    </Box>
  );
}

function Rail({ section, email }: { section: Section | null; email: string }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const item = (key: Section, path: string, icon: React.ReactElement) => (
    <ListItemButton key={key} selected={section === key} onClick={() => navigate(path)} sx={{ py: 0.9, mb: 0.25 }}>
      <ListItemIcon sx={{ minWidth: 32, color: section === key ? 'text.primary' : 'text.secondary', '& svg': { fontSize: 20 } }}>
        {icon}
      </ListItemIcon>
      <ListItemText
        primary={t(`nav.${key}`)}
        primaryTypographyProps={{ fontWeight: 500, color: section === key ? 'text.primary' : 'text.secondary' }}
      />
    </ListItemButton>
  );

  return (
    <Box
      component="nav"
      sx={{
        position: 'fixed',
        inset: '0 auto 0 0',
        width: RAIL_WIDTH,
        borderRight: '1px solid var(--border)',
        px: 1.5,
        py: 2.5,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ px: 1.25, pb: 3 }}>
        <Brand />
      </Box>
      <List disablePadding>{SECTIONS.map(({ key, path, icon }) => item(key, path, icon))}</List>
      <Box sx={{ flexGrow: 1 }} />
      <List disablePadding>{item('settings', '/settings', <SettingsOutlinedIcon />)}</List>
      <Typography
        variant="caption"
        color="text.secondary"
        noWrap
        sx={{ px: 1.25, pt: 1.5, mt: 1, borderTop: '1px solid var(--border)' }}
      >
        {email}
      </Typography>
    </Box>
  );
}

function BottomBar({ section, onAdd }: { section: Section | null; onAdd: () => void }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        pb: 'env(safe-area-inset-bottom)',
        borderTop: '1px solid var(--border)',
        bgcolor: 'color-mix(in srgb, var(--surface) 92%, transparent)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <BottomNavigation showLabels value={section === 'settings' || section === 'capital' ? false : section}>
        {BOTTOM_SECTIONS.flatMap(({ key, path, icon }, index) => [
          ...(index === 2
            ? [
                <BottomNavigationAction
                  key="add"
                  value="add"
                  aria-label={t('quickAdd.open')}
                  onClick={onAdd}
                  icon={
                    <Box sx={{ width: 46, height: 46, borderRadius: '14px', display: 'grid', placeItems: 'center', bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                      <AddRoundedIcon />
                    </Box>
                  }
                />,
              ]
            : []),
          <BottomNavigationAction key={key} value={key} label={t(`nav.${key}`)} icon={icon} onClick={() => navigate(path)} />,
        ])}
      </BottomNavigation>
    </Box>
  );
}
