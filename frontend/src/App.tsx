import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import MainLayout from './pages/MainLayout';
import Mortgage from './pages/Mortgage';
import Accounts from './pages/Accounts';
import Account from './pages/Account';
import AccountsUpdate from './pages/AccountsUpdate';
import Capital from './pages/Capital';
import FinancePlan from './pages/FinancePlan';
import DebtsLayout, { DebtsIndex } from './pages/debts/DebtsLayout';
import CardDebt from './pages/debts/CardDebt';
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
              <Route element={<DebtsLayout />}>
                <Route path="debts" element={<DebtsIndex />} />
                <Route path="cards/:cardId/:tab?" element={<CardDebt />} />
                <Route path="mortgages/:mortgageId/:tab?" element={<Mortgage />} />
              </Route>
              <Route path="accounts" element={<Accounts />} />
              <Route path="accounts/update" element={<AccountsUpdate />} />
              <Route path="accounts/:accountId" element={<Account />} />
              <Route path="plan/:tab?" element={<FinancePlan />} />
              <Route path="capital" element={<Capital />} />
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
