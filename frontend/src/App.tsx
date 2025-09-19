import React, { useState } from 'react';
import { Container, Box, CssBaseline, AppBar, Toolbar, Typography, Paper, Tabs, Tab } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import AddPurchase from './components/AddPurchase';
import PurchaseList from './components/PurchaseList';
import PaymentPlan from './components/PaymentPlan';
import RecordPayment from './components/RecordPayment';
import DepositPayment from './components/DepositPayment';
import PaymentHistory from './components/PaymentHistory';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
});

function App() {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Планировщик платежей по кредитной карте
            </Typography>
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
          <Paper sx={{ p: 0 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              indicatorColor="primary"
              textColor="primary"
            >
              <Tab label="План выплат" />
              <Tab label="Покупки" />
              <Tab label="История платежей" />
              <Tab label="Добавить покупку" />
              <Tab label="Добавить погашение" />
              <Tab label="Внести депозит" />
            </Tabs>

            <Box p={3}>
              {activeTab === 0 && <PaymentPlan />}
              {activeTab === 1 && <PurchaseList />}
              {activeTab === 2 && <PaymentHistory />}
              {activeTab === 3 && <AddPurchase />}
              {activeTab === 4 && <RecordPayment />}
              {activeTab === 5 && <DepositPayment />}
            </Box>
          </Paper>
        </Container>

        <Box component="footer" sx={{ py: 2, bgcolor: 'background.paper', textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            © {new Date().getFullYear()} Credit Card Payment Planner
          </Typography>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
