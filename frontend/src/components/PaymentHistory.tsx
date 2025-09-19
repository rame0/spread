import React, { useState, useEffect } from 'react';
import {
    Paper, Typography, Box, CircularProgress, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Chip, Card, CardContent, Grid
} from '@mui/material';
import PaymentIcon from '@mui/icons-material/Payment';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { getAllPayments } from '../services/api';

interface Payment {
    id: string;
    purchaseId: string;
    amount: number;
    paymentDate: string;
    purchaseDate: string;
    originalAmount: number;
    remainingAmount: number;
}

const PaymentHistoryComponent: React.FC = () => {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const fetchPayments = async () => {
            try {
                setLoading(true);
                const data = await getAllPayments();
                setPayments(data);
            } catch (err) {
                console.error('Error fetching payments:', err);
                setError('Failed to load payment history. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchPayments();
    }, []);

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography color="error">{error}</Typography>
            </Paper>
        );
    }

    if (payments.length === 0) {
        return (
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6">История платежей</Typography>
                <Typography variant="body1" sx={{ mt: 2 }}>
                    Платежи пока не совершались.
                </Typography>
            </Paper>
        );
    }

    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

    return (
        <div>
            <Box
                sx={{
                    bgcolor: 'success.main',
                    color: 'white',
                    p: 3,
                    borderRadius: 1,
                    mb: 3,
                    boxShadow: 3
                }}
            >
                <Typography variant="h5" gutterBottom>История платежей</Typography>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <Typography variant="subtitle1">Всего выплачено:</Typography>
                        <Typography variant="h3" component="div" sx={{ display: 'flex', alignItems: 'center' }}>
                            {totalPaid.toFixed(2)} ₽
                        </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Typography variant="subtitle1">Количество платежей:</Typography>
                        <Typography variant="h3" component="div" sx={{ display: 'flex', alignItems: 'center' }}>
                            {payments.length}
                        </Typography>
                    </Grid>
                </Grid>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Дата платежа</TableCell>
                            <TableCell>Сумма</TableCell>
                            <TableCell>Покупка</TableCell>
                            <TableCell>Оригинальная сумма</TableCell>
                            <TableCell>Остаток после платежа</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {payments.map((payment) => (
                            <TableRow key={payment.id}>
                                <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <CalendarTodayIcon sx={{ mr: 1, fontSize: 16 }} />
                                        {new Date(payment.paymentDate).toLocaleDateString('ru-RU')}
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={`${payment.amount.toFixed(2)} ₽`}
                                        color="success"
                                        icon={<PaymentIcon />}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">
                                        ID: {payment.purchaseId.substring(0, 8)}...
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Покупка от {new Date(payment.purchaseDate).toLocaleDateString('ru-RU')}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">
                                        {payment.originalAmount.toFixed(2)} ₽
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">
                                        {payment.remainingAmount.toFixed(2)} ₽
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
};

export default PaymentHistoryComponent;
