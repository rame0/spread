import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
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
import FinancePlan from './pages/FinancePlan';
import Debts from './pages/Debts';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import { PageLoading } from './components/Brand';
import { theme } from './theme';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <PageLoading />;
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider theme={theme} defaultMode="system">
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
              <Route path="plan" element={<FinancePlan />} />
              <Route path="debts" element={<Debts />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
