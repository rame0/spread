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
  CircularProgress,
  Alert,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { getCards, createCard } from '../services/api';
import type { Card } from '../types/v2';

const tabPaths = ['', 'purchases', 'deposits', 'plan', 'settings'];

export default function MainLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { cardId } = useParams<{ cardId: string }>();
  const location = useLocation();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getCards()
      .then(setCards)
      .catch(() => setError('Не удалось загрузить карты'))
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 4 }} />;
  if (error) return <Alert severity="error">{error}</Alert>;

  if (cards.length === 0) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Grace Planner
            </Typography>
            <Typography variant="body2">{user?.email}</Typography>
            <Button color="inherit" onClick={handleLogout} sx={{ ml: 2 }}>
              Выход
            </Button>
          </Toolbar>
        </AppBar>
        <Container maxWidth="sm" sx={{ mt: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Нет карт
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Создайте первую карту (день отчёта — число месяца, на которое закрывается отчётный период).
            </Typography>
            <CreateCardForm
              onCreated={(card) => {
                setCards([card]);
                navigate(`/cards/${card.id}`);
              }}
            />
          </Paper>
        </Container>
      </Box>
    );
  }

  if (!cardId && cards[0]) {
    navigate(`/cards/${cards[0].id}`, { replace: true });
    return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 4 }} />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Grace Planner
          </Typography>
          <FormControl size="small" sx={{ minWidth: 200 }} variant="standard">
            <InputLabel id="card-select-label" sx={{ color: 'white' }}>
              Карта
            </InputLabel>
            <Select
              labelId="card-select-label"
              value={selectedCardId || ''}
              onChange={handleCardChange}
              label="Карта"
              sx={{ color: 'white', '& .MuiSvgIcon-root': { color: 'white' } }}
            >
              {cards.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="body2" sx={{ ml: 2 }}>
            {user?.email}
          </Typography>
          <Button color="inherit" onClick={handleLogout} sx={{ ml: 1 }}>
            Выход
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
            <Tab label="Дашборд" />
            <Tab label="Покупки" />
            <Tab label="Депозиты" />
            <Tab label="План" />
            <Tab label="Настройки" />
          </Tabs>
          <Box p={3}>
            <Outlet />
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

function CreateCardForm({
  onCreated,
}: {
  onCreated: (card: Card) => void;
}) {
  const [name, setName] = useState('');
  const [reportDay, setReportDay] = useState('10');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rd = parseInt(reportDay, 10);
    if (!name.trim() || isNaN(rd) || rd < 1 || rd > 31) {
      setError('Укажите название и день отчёта (1–31)');
      return;
    }
    setSubmitting(true);
    setError('');
    createCard({ name: name.trim(), reportDay: rd })
      .then(onCreated)
      .catch(() => setError('Не удалось создать карту'))
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
        label="Название карты"
        value={name}
        onChange={(e) => setName(e.target.value)}
        margin="normal"
        required
      />
      <TextField
        fullWidth
        label="День отчёта (1–31)"
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
        Создать карту
      </Button>
    </form>
  );
}
