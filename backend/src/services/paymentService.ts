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
}
