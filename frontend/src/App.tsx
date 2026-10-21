import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import MainLayout from './pages/MainLayout';
import Dashboard from './pages/Dashboard';
import Purchases from './pages/Purchases';
import Deposits from './pages/Deposits';
import CardSettings from './pages/CardSettings';
import Mortgage from './pages/Mortgage';
import Accounts from './pages/Accounts';
import Account from './pages/Account';
import { CircularProgress } from '@mui/material';

const colorTokens = {
  bg: '#0F1015',
  surface: '#17181F',
  surfaceInput: '#1F212B',
  border: 'rgba(255,255,255,.07)',
  textPrimary: '#E9EAF0',
  textSecondary: '#9497A6',
  accent: '#7C5CFF',
  accentHover: '#8E73FF',
  statusOk: '#34D399',
  statusWarning: '#FBBF24',
  statusDanger: '#F87171',
} as const;

const inputSurfaceStyles = {
  borderRadius: 'var(--radius)',
  backgroundColor: 'var(--surface-input)',
};

const inputBorderStyles = {
  borderColor: 'var(--border)',
};

export const theme = createTheme({
  shape: {
    borderRadius: 14,
  },
  palette: {
    mode: 'dark',
    primary: {
      main: colorTokens.accent,
      light: colorTokens.accentHover,
      dark: colorTokens.accent,
      contrastText: colorTokens.textPrimary,
    },
    secondary: {
      main: colorTokens.accent,
      light: colorTokens.accentHover,
      dark: colorTokens.accent,
      contrastText: colorTokens.textPrimary,
    },
    success: {
      main: colorTokens.statusOk,
      light: colorTokens.statusOk,
      dark: colorTokens.statusOk,
      contrastText: colorTokens.bg,
    },
    warning: {
      main: colorTokens.statusWarning,
      light: colorTokens.statusWarning,
      dark: colorTokens.statusWarning,
      contrastText: colorTokens.bg,
    },
    error: {
      main: colorTokens.statusDanger,
      light: colorTokens.statusDanger,
      dark: colorTokens.statusDanger,
      contrastText: colorTokens.bg,
    },
    background: {
      default: colorTokens.bg,
      paper: colorTokens.surface,
    },
    text: {
      primary: colorTokens.textPrimary,
      secondary: colorTokens.textSecondary,
    },
    divider: colorTokens.border,
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: {
      fontSize: '1.75rem',
      fontWeight: 700,
      lineHeight: 1.1,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.15,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.2,
    },
    subtitle1: {
      fontSize: '0.9375rem',
      fontWeight: 600,
    },
    body1: {
      fontSize: '0.875rem',
    },
    body2: {
      fontSize: '0.875rem',
    },
    caption: {
      fontSize: '0.75rem',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          colorScheme: 'dark',
          '--bg': colorTokens.bg,
          '--surface': colorTokens.surface,
          '--surface-input': colorTokens.surfaceInput,
          '--border': colorTokens.border,
          '--text-primary': colorTokens.textPrimary,
          '--text-secondary': colorTokens.textSecondary,
          '--accent': colorTokens.accent,
          '--accent-hover': colorTokens.accentHover,
          '--status-ok': colorTokens.statusOk,
          '--status-warning': colorTokens.statusWarning,
          '--status-danger': colorTokens.statusDanger,
          '--radius': '12px',
        },
        body: {
          backgroundColor: 'var(--bg)',
        },
        '#root': {
          minHeight: '100vh',
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          boxShadow: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'var(--surface)',
          boxShadow: 'none',
          borderBottom: '1px solid var(--border)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius)',
          minHeight: 44,
          textTransform: 'none',
          fontWeight: 600,
          boxShadow: 'none',
        },
        contained: {
          boxShadow: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'filled',
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: {
          ...inputSurfaceStyles,
          border: '1px solid var(--border)',
          overflow: 'hidden',
          '&:before, &:after': {
            display: 'none',
          },
          '&:hover': {
            backgroundColor: 'var(--surface-input)',
          },
          '&.Mui-focused': {
            backgroundColor: 'var(--surface-input)',
            borderColor: 'var(--accent)',
            boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent)',
          },
        },
        input: {
          paddingTop: 12,
          paddingBottom: 12,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: 'var(--text-secondary)',
          '&.Mui-focused, &.MuiFormLabel-filled': {
            color: 'var(--text-secondary)',
          },
        },
        filled: {
          transform: 'translate(14px, 16px) scale(1)',
          '&.MuiInputLabel-shrink': {
            transform: 'translate(14px, -7px) scale(0.75)',
          },
        },
        outlined: {
          transform: 'translate(14px, 16px) scale(1)',
          '&.MuiInputLabel-shrink': {
            transform: 'translate(14px, -7px) scale(0.75)',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          ...inputSurfaceStyles,
          '& fieldset': {
            ...inputBorderStyles,
          },
          '&:hover fieldset': {
            borderColor: 'color-mix(in srgb, var(--text-primary) 16%, transparent)',
          },
          '&.Mui-focused fieldset': {
            borderColor: 'var(--accent)',
          },
        },
        input: {
          paddingTop: 12,
          paddingBottom: 12,
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        variant: 'filled',
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: 'var(--border)',
          paddingTop: 12,
          paddingBottom: 12,
        },
        head: {
          color: 'var(--text-secondary)',
          fontWeight: 600,
          position: 'sticky',
          top: 0,
          zIndex: 1,
          backgroundColor: 'var(--surface)',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'color-mix(in srgb, var(--text-primary) 3%, transparent)',
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius)',
        },
        standardInfo: {
          color: 'var(--text-secondary)',
          backgroundColor: 'var(--surface-input)',
          border: 0,
          borderLeft: '3px solid var(--accent)',
          '& .MuiAlert-icon': {
            color: 'var(--accent)',
          },
        },
      },
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={null} />
              <Route path="cards/:cardId" element={<Dashboard />} />
              <Route path="cards/:cardId/purchases" element={<Purchases />} />
              <Route path="cards/:cardId/deposits" element={<Deposits />} />
              <Route path="cards/:cardId/settings" element={<CardSettings />} />
              <Route path="mortgages/:mortgageId" element={<Mortgage />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="accounts/:accountId" element={<Account />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
