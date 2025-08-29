import React, {useState, useEffect} from 'react';
import {
    TextField, Button, Grid, Paper, Typography, Snackbar, Alert,
    FormControl, InputLabel, Select, MenuItem, SelectChangeEvent
} from '@mui/material';
import {DatePicker} from '@mui/x-date-pickers/DatePicker';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDateFns} from '@mui/x-date-pickers/AdapterDateFns';
import {getPurchases, recordPayment} from '../services/api';
import {Purchase} from '../types';

const RecordPayment: React.FC = () => {
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [selectedPurchase, setSelectedPurchase] = useState<string>('');
    const [amount, setAmount] = useState<string>('');
    const [date, setDate] = useState<Date | null>(new Date());
    const [loading, setLoading] = useState<boolean>(false);
    const [successMsg, setSuccessMsg] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string>('');

    useEffect(() => {
        const fetchPurchases = async () => {
            try {
                const data = await getPurchases();
                setPurchases(data);
                if (data.length > 0) {
                    setSelectedPurchase(data[0].id);
                }
            } catch (err) {
                console.error('Не удалось загрузить покупки:', err);
                setErrorMsg('Не удалось загрузить покупки. Пожалуйста, попробуйте позже.');
            }
        };

        fetchPurchases().then();
    }, []);

    const handlePurchaseChange = (event: SelectChangeEvent<string>) => {
        setSelectedPurchase(event.target.value);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedPurchase || !amount) {
            setErrorMsg('Пожалуйста, заполните все поля');
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
            await recordPayment(selectedPurchase, amountValue, formattedDate);

            setSuccessMsg(`Платеж ${amountValue.toFixed(2)}  ₽ успешно добавлен!`)
            setAmount('');
            setDate(new Date());

            // Refresh purchases after recording payment
            const updatedPurchases = await getPurchases();
            setPurchases(updatedPurchases);
            if (updatedPurchases.length > 0) {
                setSelectedPurchase(updatedPurchases[0].id);
            } else {
                setSelectedPurchase('');
            }
        } catch (error) {
            console.error('Не удалось записать платеж:', error);
            setErrorMsg('Не удалось записать платеж. Пожалуйста, попробуйте снова.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Paper sx={{p: 3, mb: 3}}>
            <Typography variant="h5" component="h2" gutterBottom>
                Добавить погашение
            </Typography>

            <form onSubmit={handleSubmit}>
                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <FormControl fullWidth>
                            <InputLabel id="purchase-select-label">Покупки</InputLabel>
                            <Select
                                labelId="purchase-select-label"
                                value={selectedPurchase}
                                label="Purchase"
                                onChange={handlePurchaseChange}
                                required
                            >
                                {purchases.map((purchase) => (
                                    <MenuItem key={purchase.id} value={purchase.id}>
                                        {purchase.date} - осталось выплатить {purchase.remainingAmount.toFixed(2)} ₽
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <TextField
                            label="Сумма платежа (в ₽)"
                            fullWidth
                            type="number"
                            InputProps={{inputProps: {min: 0, step: "0.01"}}}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                            InputLabelProps={{shrink: true}}
                            placeholder="Введите сумму платежа"
                        />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker
                                label="Дата платежа"
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
                            {loading ? 'Сохранение...' : 'Добавить погашение'}
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

export default RecordPayment;
