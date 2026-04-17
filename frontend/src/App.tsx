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
import { CircularProgress } from '@mui/material';

const inputSurfaceStyles = {
  borderRadius: 14,
  backgroundColor: '#342D4D',
};

const inputBorderStyles = {
  borderColor: 'rgba(255,255,255,0.08)',
};

const theme = createTheme({
  shape: {
    borderRadius: 14,
  },
  palette: {
    mode: 'dark',
    primary: { main: '#8B5CF6' },
    secondary: { main: '#38BDF8' },
    success: { main: '#34D399' },
    warning: { main: '#FBBF24' },
    error: { main: '#FB7185' },
    background: {
      default: '#1F1B2E',
      paper: '#2D2742',
    },
    text: {
      primary: '#F5F3FF',
      secondary: '#B7B0CE',
    },
    divider: 'rgba(255,255,255,0.08)',
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: {
      fontSize: '2rem',
      fontWeight: 700,
      lineHeight: 1.1,
    },
    h5: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.15,
    },
    h6: {
      fontSize: '1.25rem',
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
        },
        body: {
          backgroundColor: '#1F1B2E',
          backgroundImage:
            'radial-gradient(circle at top, rgba(139, 92, 246, 0.14), transparent 34%), linear-gradient(180deg, #241F35 0%, #1F1B2E 48%)',
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
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#241F35',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
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
          border: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden',
          '&:before, &:after': {
            display: 'none',
          },
          '&:hover': {
            backgroundColor: '#3A3356',
          },
          '&.Mui-focused': {
            backgroundColor: '#3A3356',
            borderColor: '#8B5CF6',
            boxShadow: '0 0 0 1px rgba(139,92,246,0.45)',
          },
        },
        input: {
          paddingTop: 16,
          paddingBottom: 16,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#8D86A8',
          '&.Mui-focused, &.MuiFormLabel-filled': {
            color: '#B7B0CE',
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
            borderColor: 'rgba(255,255,255,0.16)',
          },
          '&.Mui-focused fieldset': {
            borderColor: '#8B5CF6',
          },
        },
        input: {
          paddingTop: 16,
          paddingBottom: 16,
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
          borderBottomColor: 'rgba(255,255,255,0.08)',
        },
        head: {
          color: '#8D86A8',
          fontWeight: 600,
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
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
