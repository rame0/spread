import { CreditCardMinimumPaymentPlanner } from '../utils/minimum-payment-planner';
import path from 'path';

interface PaymentPlanJSON {
  totalDebt: number;
  monthlyPayments: {
    month: number;
    year: number;
    monthName: string;
    totalAmount: number;
    breakdown: {
      purchaseId: string;
      purchaseDate: string;
      originalAmount: number;
      remainingAmount: number;
      paymentDeadline: string;
      monthlyContribution: number;
    }[];
  }[];
}

export class PaymentService {
  private planner: CreditCardMinimumPaymentPlanner;

  constructor() {
    // Use a consistent DB path - could be configurable via env var
    const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'credit_card.sqlite');
    this.planner = new CreditCardMinimumPaymentPlanner(dbPath);
  }

  public async initialize(): Promise<void> {
    await this.planner.initialize();
  }

  public async close(): Promise<void> {
    await this.planner.close();
  }

  public async addPurchase(amount: number, date: string): Promise<any> {
    return this.planner.addPurchase(amount, date);
  }

  public async recordPayment(purchaseId: string, amount: number, date?: string): Promise<boolean> {
    return this.planner.recordPayment(purchaseId, amount, date);
  }

  public async getUnpaidPurchases(): Promise<any[]> {
    const purchases = await this.planner.getUnpaidPurchases();

    // Format dates for easier consumption by frontend
    return purchases.map(p => ({
      ...p,
      date: p.date.toISOString().split('T')[0],
      paymentDeadline: p.paymentDeadline.toISOString().split('T')[0]
    }));
  }

  public async getAllPurchases(): Promise<any[]> {
    const purchases = await this.planner.getAllPurchases();

    // Format dates for easier consumption by frontend
    return purchases.map(p => ({
      ...p,
      date: p.date.toISOString().split('T')[0],
      paymentDeadline: p.paymentDeadline.toISOString().split('T')[0]
    }));
  }

  public async getPaidPurchases(): Promise<any[]> {
    const purchases = await this.planner.getPaidPurchases();

    // Format dates for easier consumption by frontend
    return purchases.map(p => ({
      ...p,
      date: p.date.toISOString().split('T')[0],
      paymentDeadline: p.paymentDeadline.toISOString().split('T')[0]
    }));
  }

  public async getTotalDebt(): Promise<number> {
    return this.planner.getTotalDebt();
  }

  // Generate JSON version of payment plan (easier for frontend to consume)
  public async getPaymentPlanJson(): Promise<PaymentPlanJSON> {
    const monthlyPayments = await this.planner.calculateMinimumPayments();
    const totalDebt = await this.planner.getTotalDebt();

    return {
      totalDebt,
      monthlyPayments: monthlyPayments.map(payment => ({
        month: payment.month,
        year: payment.year,
        monthName: payment.monthName,
        totalAmount: payment.totalAmount,
        breakdown: payment.breakdown.map(item => ({
          purchaseId: item.purchaseId,
          purchaseDate: item.purchaseDate,
          originalAmount: item.originalAmount,
          remainingAmount: item.amountToPay,
          paymentDeadline: item.paymentDeadline,
          monthlyContribution: item.monthlyContribution
        }))
      }))
    };
  }

  // Process a deposit by automatically distributing payments to purchases
  // starting from the earliest deadline until deposit amount is exhausted
  public async processDeposit(amount: number, date?: string): Promise<{
    success: boolean;
    message: string;
    distributedPayments: Array<{purchaseId: string, amount: number}>;
  }> {
    return this.planner.processDeposit(amount, date);
  }

  // Get payments made this month
  public async getPaymentsThisMonth(): Promise<{
    totalAmount: number;
    payments: Array<{
      id: string;
      purchaseId: string;
      amount: number;
      paymentDate: string;
      purchaseDate: string;
      originalAmount: number;
    }>;
  }> {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Get payments from the 10th of current month to 9th of next month
    const periodStart = new Date(currentYear, currentMonth, 10);
    const periodEnd = new Date(currentYear, currentMonth + 1, 9);
    
    const payments = await this.planner.getPaymentsInPeriod(periodStart, periodEnd);
    const allPurchases = await this.planner.getAllPurchases();
    
    const purchaseMap = new Map(allPurchases.map(p => [p.id, p]));
    
    const formattedPayments = payments.map(payment => {
      const purchase = purchaseMap.get(payment.purchase_id as string);
      return {
        id: payment.id,
        purchaseId: payment.purchase_id as string,
        amount: payment.amount,
        paymentDate: payment.payment_date.split('T')[0],
        purchaseDate: purchase?.date.toISOString().split('T')[0] || '',
        originalAmount: purchase?.amount || 0
      };
    });
    
    const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
    
    return {
      totalAmount,
      payments: formattedPayments
    };
  }

  // Get all payments made
  public async getAllPayments(): Promise<Array<{
    id: string;
    purchaseId: string;
    amount: number;
    paymentDate: string;
    purchaseDate: string;
    originalAmount: number;
    remainingAmount: number;
  }>> {
    const allPurchases = await this.planner.getAllPurchases();
    const purchaseMap = new Map(allPurchases.map(p => [p.id, p]));
    
    // Get all payments by querying the database directly
    const allPayments = await this.planner.getAllPayments();
    
    return allPayments.map(payment => {
      const purchase = purchaseMap.get(payment.purchase_id as string);
      return {
        id: payment.id,
        purchaseId: payment.purchase_id as string,
        amount: payment.amount,
        paymentDate: payment.payment_date.split('T')[0],
        purchaseDate: purchase?.date.toISOString().split('T')[0] || '',
        originalAmount: purchase?.amount || 0,
        remainingAmount: purchase?.remainingAmount || 0
      };
    });
  }
}
