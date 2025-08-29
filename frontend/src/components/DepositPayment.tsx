import React, {useState} from 'react';
import {
    TextField, Button, Grid, Paper, Typography, Snackbar, Alert
} from '@mui/material';
import {DatePicker} from '@mui/x-date-pickers/DatePicker';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDateFns} from '@mui/x-date-pickers/AdapterDateFns';
import {processDeposit} from '../services/api';

const DepositPayment: React.FC = () => {
    const [amount, setAmount] = useState<string>('');
    const [date, setDate] = useState<Date | null>(new Date());
    const [loading, setLoading] = useState<boolean>(false);
    const [successMsg, setSuccessMsg] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string>('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!amount) {
            setErrorMsg('Пожалуйста, введите сумму депозита');
            return;
        }

        try {
            setLoading(true);
            const amountValue = parseFloat(amount);
            if (isNaN(amountValue) || amountValue <= 0) {
                setErrorMsg('Пожалуйста, введите корректную сумму.');
                setLoading(false);
                return;
            }

            const formattedDate = date?.toISOString().split('T')[0];
            const result = await processDeposit(amountValue, formattedDate);

            if (result.success) {
                setSuccessMsg(`Депозит обработан успешно! ${result.message}`);
                setAmount('');
                setDate(new Date());
            } else {
                setErrorMsg(result.message);
            }
        } catch (error) {
            console.error('Не удалось обработать депозит:', error);
            setErrorMsg('Не удалось обработать депозит. Пожалуйста, попробуйте снова.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Paper sx={{p: 3, mb: 3}}>
            <Typography variant="h5" component="h2" gutterBottom>
                Внести депозит на кредитную карту
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                Сумма будет автоматически распределена по покупкам, начиная с самых ранних сроков оплаты
            </Typography>

            <form onSubmit={handleSubmit}>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <TextField
                            label="Сумма депозита (в ₽)"
                            fullWidth
                            type="number"
                            InputProps={{inputProps: {min: 0, step: "0.01"}}}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                            InputLabelProps={{shrink: true}}
                            placeholder="Введите сумму депозита"
                        />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker
                                label="Дата депозита"
                                value={date}
                                onChange={(newDate) => setDate(newDate)}
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
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
                            sx={{mt: 2}}
                        >
                            {loading ? 'Обработка...' : 'Внести депозит'}
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

export default DepositPayment;
