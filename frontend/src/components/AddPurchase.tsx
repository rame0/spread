import React, { useState } from 'react';
import { TextField, Button, Grid, Paper, Typography, Snackbar, Alert } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { addPurchase } from '../services/api';

const AddPurchase: React.FC = () => {
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || !date) {
      setErrorMsg('Пожалуйста, заполните все поля');
      return;
    }

    try {
      setLoading(true);
      const amountValue = parseFloat(amount);
      if (isNaN(amountValue) || amountValue <= 0) {
        setErrorMsg('Введите корректную сумму');
        setLoading(false);
        return;
      }

      const formattedDate = date.toISOString().split('T')[0];
      const purchase = await addPurchase(amountValue, formattedDate);

      setSuccessMsg(`Покупка на ${amountValue.toFixed(2)} ₽ успешно добавлена!`);
      setAmount('');
      setDate(new Date());
    } catch (error) {
      console.error('Не удалось добавить покупку:', error);
      setErrorMsg('Ошибка при добавлении покупки. Пожалуйста, попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Добавить новую покупку по кредитной карте
      </Typography>

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Суmма покупки (в ₽)"
              fullWidth
              type="number"
              InputProps={{ inputProps: { min: 0, step: "0.01" } }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              InputLabelProps={{ shrink: true }}
              placeholder="Введите сумму покупки"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Дата покупки"
                value={date}
                onChange={(newDate) => setDate(newDate)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                  },
                }}
              />
            </LocalizationProvider>
          </Grid>

          <Grid item xs={12}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? 'Добавление...' : 'Добавить'}
            </Button>
          </Grid>
        </Grid>
      </form>

      <Snackbar open={!!successMsg} autoHideDuration={6000} onClose={() => setSuccessMsg('')}>
        <Alert onClose={() => setSuccessMsg('')} severity="success" variant="filled">
          {successMsg}
        </Alert>
      </Snackbar>

      <Snackbar open={!!errorMsg} autoHideDuration={6000} onClose={() => setErrorMsg('')}>
        <Alert onClose={() => setErrorMsg('')} severity="error" variant="filled">
          {errorMsg}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default AddPurchase;
