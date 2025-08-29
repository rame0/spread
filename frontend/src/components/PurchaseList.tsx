import React, {useState, useEffect} from 'react';
import {
    Paper, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, CircularProgress, Box, Chip, Tabs, Tab,
    FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import {getPurchases, getAllPurchases, getPaidPurchases} from '../services/api';
import {Purchase} from '../types';

type PurchaseFilter = 'all' | 'unpaid' | 'paid';

const PurchaseList: React.FC = () => {
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [filter, setFilter] = useState<PurchaseFilter>('unpaid');

    useEffect(() => {
        fetchPurchases();
    }, [filter]);

    const fetchPurchases = async () => {
        try {
            setLoading(true);
            let data: Purchase[];
            
            switch (filter) {
                case 'all':
                    data = await getAllPurchases();
                    break;
                case 'paid':
                    data = await getPaidPurchases();
                    break;
                case 'unpaid':
                default:
                    data = await getPurchases();
                    break;
            }
            
            setPurchases(data);
        } catch (err) {
            console.error('Error fetching purchases:', err);
            setError('Failed to load purchases. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (event: React.SyntheticEvent, newValue: PurchaseFilter) => {
        setFilter(newValue);
    };

    // Calculate days until payment deadline
    const getDaysUntilDeadline = (deadlineStr: string): number => {
        const today = new Date();
        const deadline = new Date(deadlineStr);
        const diffTime = deadline.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // Get status chip based on days until deadline and payment status
    const getStatusChip = (purchase: Purchase) => {
        if (purchase.paid) {
            return <Chip label="Оплачено" color="success" size="small"/>;
        }

        const daysLeft = getDaysUntilDeadline(purchase.paymentDeadline);
        
        if (daysLeft < 0) {
            return <Chip label="Просрочено" color="error" size="small"/>;
        } else if (daysLeft < 30) {
            return <Chip label="Приближается" color="warning" size="small"/>;
        } else {
            return <Chip label="По плану" color="info" size="small"/>;
        }
    };

    // Get days left text
    const getDaysLeftText = (purchase: Purchase) => {
        if (purchase.paid) {
            return "Оплачено полностью";
        }

        const daysLeft = getDaysUntilDeadline(purchase.paymentDeadline);
        if (daysLeft > 0) {
            return `${daysLeft} дн осталось`;
        } else {
            return `${Math.abs(daysLeft)} дн просрочено`;
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

    const getTitle = () => {
        switch (filter) {
            case 'all': return 'Все покупки';
            case 'paid': return 'Оплаченные покупки';
            case 'unpaid': return 'Невыплаченные покупки';
            default: return 'Покупки';
        }
    };

    return (
        <Paper sx={{p: 3, mb: 3}}>
            <Typography variant="h5" component="h2" gutterBottom>
                {getTitle()}
            </Typography>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={filter} onChange={handleFilterChange} aria-label="purchase filter tabs">
                    <Tab label="Невыплаченные" value="unpaid" />
                    <Tab label="Оплаченные" value="paid" />
                    <Tab label="Все" value="all" />
                </Tabs>
            </Box>

            {purchases.length === 0 ? (
                <Typography variant="body1" sx={{mt: 2}}>
                    {filter === 'unpaid' && 'Нет невыплаченных покупок. Все покупки оплачены!'}
                    {filter === 'paid' && 'Нет оплаченных покупок.'}
                    {filter === 'all' && 'Нет покупок. Добавьте новую покупку с помощью вкладки "Добавить покупку".'}
                </Typography>
            ) : (
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
                            {purchases.map((purchase) => (
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
                                    <TableCell align="right">
                                        {purchase.paid ? '0.00' : purchase.remainingAmount.toFixed(2)} ₽
                                    </TableCell>
                                    <TableCell>{purchase.date}</TableCell>
                                    <TableCell>{purchase.paymentDeadline}</TableCell>
                                    <TableCell>
                                        {getStatusChip(purchase)} {getDaysLeftText(purchase)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Paper>
    );
};

export default PurchaseList;
