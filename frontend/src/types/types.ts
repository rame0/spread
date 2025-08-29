export interface Purchase {
    id: string;
    amount: number;
    remainingAmount: number;
    date: string;
    paymentDeadline: string;
    paid: boolean;
}

export interface PaymentPlanItem {
    month: number;
    year: number;
    monthName: string;
    totalAmount: number;
    breakdown: PaymentBreakdown[];
}

export interface PaymentBreakdown {
    purchaseId: string;
    purchaseDate: string;
    originalAmount: number;
    remainingAmount: number;
    paymentDeadline: string;
    monthlyContribution: number;
}

export interface PaymentPlan {
    totalDebt: number;
    monthlyPayments: PaymentPlanItem[];
}
