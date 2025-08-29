import React, {useState, useEffect} from 'react';
import {
    Paper, Typography, Box, CircularProgress, Accordion, AccordionSummary,
    AccordionDetails, Card, CardContent, Grid, Divider, Chip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import {getPaymentPlan} from '../services/api';
import {PaymentPlan, PaymentPlanItem} from '../types';

const PaymentPlanComponent: React.FC = () => {
    const [paymentPlan, setPaymentPlan] = useState<PaymentPlan | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const fetchPaymentPlan = async () => {
            try {
                setLoading(true);
                const data = await getPaymentPlan();
                setPaymentPlan(data);
            } catch (err) {
                console.error('Error fetching payment plan:', err);
                setError('Failed to load payment plan. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchPaymentPlan();
    }, []);

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress/>
            </Box>
        );
    }

    if (error) {
        return (
            <Paper sx={{p: 3, mb: 3}}>
                <Typography color="error">{error}</Typography>
            </Paper>
        );
    }

    if (!paymentPlan || paymentPlan.monthlyPayments.length === 0) {
        return (
            <Paper sx={{p: 3, mb: 3}}>
                <Typography variant="h6">No payment plan available</Typography>
                <Typography variant="body1" sx={{mt: 2}}>
                    Добавьте покупку с помощью вкладки "Добавить покупку".
                </Typography>
            </Paper>
        );
    }

    // Helper to determine if a payment is due this month
    const isCurrentMonth = (payment: PaymentPlanItem): boolean => {
        const now = new Date();
        return payment.month === (now.getMonth() + 1) && payment.year === now.getFullYear();
    };

    return (
        <div>
            <Box
                sx={{
                    bgcolor: 'primary.main',
                    color: 'white',
                    p: 3,
                    borderRadius: 1,
                    mb: 3,
                    boxShadow: 3
                }}
            >
                <Typography variant="h5" gutterBottom>Обзор</Typography>
                <Typography variant="subtitle1">Осталось выплатить:</Typography>
                <Typography variant="h3" component="div" sx={{display: 'flex', alignItems: 'center'}}>
                    {paymentPlan.totalDebt.toFixed(2)} ₽
                </Typography>
            </Box>

            {paymentPlan.monthlyPayments.map((payment, index) => {
                const isThisMonth = isCurrentMonth(payment);

                return (
                    <Accordion
                        key={`${payment.year}-${payment.month}`}
                        defaultExpanded={index === 0 || isThisMonth}
                        sx={{
                            mb: 2,
                            border: isThisMonth ? '2px solid #1976d2' : 'none',
                            boxShadow: isThisMonth ? 3 : 1
                        }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon/>}>
                            <Grid container alignItems="center" spacing={2}>
                                <Grid item>
                                    <CalendarMonthIcon color="primary"/>
                                </Grid>
                                <Grid item xs>
                                    <Typography variant="h6">
                                        {payment.monthName} {payment.year}
                                        {isThisMonth && (
                                            <Chip
                                                label="Текущий месяц"
                                                color="primary"
                                                size="small"
                                                sx={{ml: 2}}
                                            />
                                        )}
                                    </Typography>
                                </Grid>
                                <Grid item>
                                    <Typography variant="h6" color="primary" fontWeight="bold">
                                        {payment.totalAmount.toFixed(2)} ₽
                                    </Typography>
                                </Grid>
                            </Grid>
                        </AccordionSummary>

                        <AccordionDetails>
                            <Typography variant="subtitle1" gutterBottom>
                                Платеж до 10-го {payment.monthName} включительно.
                            </Typography>

                            <Divider sx={{my: 2}}/>

                            <Typography variant="h6" gutterBottom>Из чего сформирован платеж:</Typography>

                            <Grid container spacing={2}>
                                {payment.breakdown.map((item, i) => (
                                    <Grid item xs={12} md={6} key={`${item.purchaseId}-${i}`}>
                                        <Card variant="outlined">
                                            <CardContent>
                                                <Box sx={{display: 'flex', justifyContent: 'space-between'}}>
                                                    <Typography color="textSecondary" gutterBottom>
                                                        Покупка от {item.purchaseDate}
                                                    </Typography>
                                                    <CreditCardIcon color="action"/>
                                                </Box>

                                                <Typography variant="h6" color="primary">
                                                    {item.monthlyContribution.toFixed(2)} ₽
                                                </Typography>

                                                <Divider sx={{my: 1}}/>

                                                <Typography variant="body2" sx={{mt: 1}}>
                                                    Взято: {item.originalAmount.toFixed(2)} ₽
                                                </Typography>
                                                <Typography variant="body2">
                                                    Осталось: {item.remainingAmount.toFixed(2)} ₽
                                                </Typography>
                                                <Typography variant="body2">
                                                    Выплатить до: {item.paymentDeadline}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        display: 'block',
                                                        mt: 1,
                                                        color: 'text.secondary',
                                                        fontSize: '0.7rem'
                                                    }}
                                                >
                                                    ID: {item.purchaseId}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        </AccordionDetails>
                    </Accordion>
                );
            })}
        </div>
    );
};

export default PaymentPlanComponent;
