import {Router} from 'express';
import {PaymentService} from '../services/paymentService';

const router = Router();
const paymentService = new PaymentService();

// Initialize DB on startup
(async () => {
    try {
        await paymentService.initialize();
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Failed to initialize database:', error);
    }
})();

// Get all unpaid purchases
router.get('/purchases', async (req, res) => {
    try {
        const purchases = await paymentService.getUnpaidPurchases();
        res.json(purchases);
    } catch (error) {
        console.error('Error getting purchases:', error);
        res.status(500).json({error: 'Failed to retrieve purchases'});
    }
});

// Get all purchases (both paid and unpaid)
router.get('/purchases/all', async (req, res) => {
    try {
        const purchases = await paymentService.getAllPurchases();
        res.json(purchases);
    } catch (error) {
        console.error('Error getting all purchases:', error);
        res.status(500).json({error: 'Failed to retrieve all purchases'});
    }
});

// Get only paid purchases
router.get('/purchases/paid', async (req, res) => {
    try {
        const purchases = await paymentService.getPaidPurchases();
        res.json(purchases);
    } catch (error) {
        console.error('Error getting paid purchases:', error);
        res.status(500).json({error: 'Failed to retrieve paid purchases'});
    }
});

// Add a new purchase
router.post('/purchases', async (req: any, res: any) => {
    try {
        const {amount, date} = req.body;
        if (!amount || !date) {
            return res.status(400).json({error: 'Amount and date are required'});
        }

        const purchase = await paymentService.addPurchase(Number(amount), date);
        res.status(201).json(purchase);
    } catch (error) {
        console.error('Error adding purchase:', error);
        res.status(500).json({error: 'Failed to add purchase'});
    }
});

// Record a payment
router.post('/payments', async (req: any, res: any) => {
    try {
        const {purchaseId, amount, date} = req.body;
        if (!purchaseId || !amount) {
            return res.status(400).json({error: 'Purchase ID and amount are required'});
        }

        const success = await paymentService.recordPayment(purchaseId, Number(amount), date);
        if (success) {
            res.status(201).json({success: true, message: 'Payment recorded successfully'});
        } else {
            res.status(404).json({success: false, message: 'Purchase not found'});
        }
    } catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({error: 'Failed to record payment'});
    }
});

// Get payment plan
router.get('/payment-plan', async (req, res) => {
    try {
        const plan = await paymentService.getPaymentPlanJson();
        res.json(plan);
    } catch (error) {
        console.error('Error generating payment plan:', error);
        res.status(500).json({error: 'Failed to generate payment plan'});
    }
});

// Get total debt
router.get('/total-debt', async (req, res) => {
    try {
        const totalDebt = await paymentService.getTotalDebt();
        res.json({totalDebt});
    } catch (error) {
        console.error('Error getting total debt:', error);
        res.status(500).json({error: 'Failed to retrieve total debt'});
    }
});

// Process a deposit - automatically distribute payments to purchases
router.post('/deposit', async (req: any, res: any) => {
    try {
        const {amount, date} = req.body;
        if (!amount) {
            return res.status(400).json({error: 'Amount is required'});
        }

        const result = await paymentService.processDeposit(Number(amount), date);
        if (result.success) {
            res.status(201).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error processing deposit:', error);
        res.status(500).json({error: 'Failed to process deposit'});
    }
});

// Get payments made this month
router.get('/payments/this-month', async (req, res) => {
    try {
        const payments = await paymentService.getPaymentsThisMonth();
        res.json(payments);
    } catch (error) {
        console.error('Error getting this month payments:', error);
        res.status(500).json({error: 'Failed to retrieve this month payments'});
    }
});

// Get all payments made
router.get('/payments/all', async (req, res) => {
    try {
        const payments = await paymentService.getAllPayments();
        res.json(payments);
    } catch (error) {
        console.error('Error getting all payments:', error);
        res.status(500).json({error: 'Failed to retrieve all payments'});
    }
});

export default router;
