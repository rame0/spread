import React, {useState, useEffect} from 'react';
import {
    Paper, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, CircularProgress, Box, Chip
} from '@mui/material';
import {getPurchases} from '../services/api';
import {Purchase} from '../types';

const PurchaseList: React.FC = () => {
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const fetchPurchases = async () => {
            try {
                setLoading(true);
                const data = await getPurchases();
                setPurchases(data);
            } catch (err) {
                console.error('Error fetching purchases:', err);
                setError('Failed to load purchases. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchPurchases();
    }, []);

    // Calculate days until payment deadline
    const getDaysUntilDeadline = (deadlineStr: string): number => {
        const today = new Date();
        const deadline = new Date(deadlineStr);
        const diffTime = deadline.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // Get status chip based on days until deadline
    const getStatusChip = (daysLeft: number) => {
        if (daysLeft < 0) {
            return <Chip label="Просрочено" color="error" size="small"/>;
        } else if (daysLeft < 30) {
            return <Chip label="Приближается" color="warning" size="small"/>;
        } else {
            return <Chip label="По плану" color="success" size="small"/>;
        }
    };

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

    if (purchases.length === 0) {
        return (
            <Paper sx={{p: 3, mb: 3}}>
                <Typography variant="h6">No purchases found</Typography>
                <Typography variant="body1" sx={{mt: 2}}>
                    Добавьте новую покупку с помощью вкладки "Добавить покупку".
                </Typography>
            </Paper>
        );
    }

    return (
        <Paper sx={{p: 3, mb: 3}}>
            <Typography variant="h5" component="h2" gutterBottom>
                Невыплаченные покупки
            </Typography>

            <TableContainer>
                <Table aria-label="purchases table">
                    <TableHead>
                        <TableRow>
                            <TableCell>ID</TableCell>
                            <TableCell align="right">Сумма</TableCell>
                            <TableCell align="right">Осталось</TableCell>
                            <TableCell>Дата покупки</TableCell>
                            <TableCell>Дата возврата</TableCell>
                            <TableCell>Статус</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {purchases.map((purchase) => {
                            const daysLeft = getDaysUntilDeadline(purchase.paymentDeadline);

                            return (
                                <TableRow key={purchase.id} hover>
                                    <TableCell
                                        sx={{
                                            maxWidth: 150,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {purchase.id}
                                    </TableCell>
                                    <TableCell align="right">{purchase.amount.toFixed(2)} ₽</TableCell>
                                    <TableCell align="right">{purchase.remainingAmount.toFixed(2)} ₽</TableCell>
                                    <TableCell>{purchase.date}</TableCell>
                                    <TableCell>{purchase.paymentDeadline}</TableCell>
                                    <TableCell>
                                        {getStatusChip(daysLeft)} {daysLeft > 0 ? `${daysLeft}` : `${Math.abs(daysLeft)}`} дн осталось
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
};

export default PurchaseList;
