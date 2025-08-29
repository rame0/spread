import Database, { Database as DBType} from 'better-sqlite3';
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import { UUID } from 'crypto';

interface PurchaseRow {
    id: string;
    amount: number;
    remaining_amount: number;
    purchase_date: string;
    payment_deadline: string;
    paid: number;
}

interface PaymentRow {
    id: string;
    purchase_id: UUID;
    payment_date: string;
    amount: number;
}

interface TotalDebtRow {
    total: number;
}

interface Purchase {
    id: string;
    amount: number;
    date: Date;
    paymentDeadline: Date;
    paid: boolean;
    remainingAmount: number;
}

interface MonthlyPayment {
    year: number;
    month: number;
    monthName: string;
    totalAmount: number;
    breakdown: {
        purchaseId: string;
        purchaseDate: string;
        originalAmount: number;
        amountToPay: number;
        paymentDeadline: string;
        monthlyContribution: number;
    }[];
}

class CreditCardMinimumPaymentPlanner {
    private db: DBType | null = null;
    private dbPath: string;

    constructor(dbPath: string = "credit_card.sqlite") {
        this.dbPath = dbPath;
    }

    // Initialize the database
    public async initialize(): Promise<void> {
        this.db = new Database(this.dbPath, /*{ verbose: console.log }*/);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS purchases
            (
                id TEXT PRIMARY KEY,
                amount REAL NOT NULL,
                remaining_amount REAL DEFAULT 0,
                purchase_date TEXT NOT NULL,
                payment_deadline TEXT NOT NULL,
                paid INTEGER NOT NULL DEFAULT 0
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS payments
            (
                id TEXT PRIMARY KEY,
                purchase_id TEXT NOT NULL,
                payment_date TEXT NOT NULL,
                amount REAL NOT NULL,
                FOREIGN KEY (purchase_id) 
                REFERENCES purchases (id)
            )
        `);
    }

    // Close the database connection
    public close(): void {
        if (this.db) {
            this.db.close();
        }
    }

    // Fix 1: Corrected deadline calculation
    private calculatePaymentDeadline(purchaseDate: Date): Date {
        // Make a copy to avoid modifying the input
        const purchaseDateTime = new Date(purchaseDate);

        // Calculate 10th of fourth month after purchase
        const fourthMonth = new Date(purchaseDateTime);
        fourthMonth.setMonth(purchaseDateTime.getMonth() + 4);
        fourthMonth.setDate(10);

        // Calculate 120 days from purchase
        const days120Later = new Date(purchaseDateTime);
        days120Later.setDate(purchaseDateTime.getDate() + 120);

        // Return earlier date
        return fourthMonth < days120Later ? fourthMonth : days120Later;
    }

    public async calculateMinimumPayments(): Promise<MonthlyPayment[]> {
        const unpaidPurchases = await this.getUnpaidPurchases();
        const today = new Date();
        const monthlyPayments = new Map<string, MonthlyPayment>();

        let currentPaymentMonth = today.getMonth();
        let currentPaymentYear = today.getFullYear();

        if (today.getDate() > 10) {
            currentPaymentMonth++;
            if (currentPaymentMonth > 11) {
                currentPaymentMonth = 0;
                currentPaymentYear++;
            }
        }

        // Get the start date of the current payment period
        const currentPaymentPeriodStart = new Date(
            `${currentPaymentYear}-${
                currentPaymentMonth < 10
                    ? "0" + currentPaymentMonth
                    : currentPaymentMonth
            }-10`,
        );
        const currentPaymentPeriodEnd = new Date(
            `${currentPaymentYear}-${
                currentPaymentMonth + 1 < 10
                    ? "0" + (currentPaymentMonth + 1)
                    : currentPaymentMonth + 1
            }-9`,
        );
        // Fetch all payments made in the current payment period
        const currentPaymentPeriodPayments = await this.getPaymentsInPeriod(
            currentPaymentPeriodStart,
            currentPaymentPeriodEnd,
        );

        // Calculate the total amount paid for each purchase in the current payment period
        const purchasePayments = new Map<string, number>();
        for (const payment of currentPaymentPeriodPayments) {
            const purchaseId = payment.purchase_id;
            const amount = payment.amount;
            purchasePayments.set(
                purchaseId,
                (purchasePayments.get(purchaseId) || 0) + amount,
            );
        }

        for (const purchase of unpaidPurchases) {
            const deadlineDate = new Date(purchase.paymentDeadline);
            const deadlineMonth = deadlineDate.getMonth();
            const deadlineYear = deadlineDate.getFullYear();

            // Adjust the remaining amount by subtracting the total amount paid in the current payment period
            const totalPaidInCurrentPeriod =
                purchasePayments.get(purchase.id) || 0;

            // Calculate total months from current payment month to deadline
            let totalMonths = 0;
            let tempYear = currentPaymentYear;
            let tempMonth = currentPaymentMonth;

            // Detailed calculation of months
            while (
                (tempYear < deadlineYear) ||
                (tempYear === deadlineYear && tempMonth <= deadlineMonth)
            ) {
                totalMonths++;
                tempMonth++;
                if (tempMonth > 11) {
                    tempMonth = 0;
                    tempYear++;
                }
            }

            // Ensure at least 1 month
            totalMonths = Math.max(1, totalMonths);

            // Calculate monthly contribution
            const monthlyContribution = purchase.remainingAmount / totalMonths;

            // Distribute payments across months
            let yearToUse = currentPaymentYear;
            let monthToUse = currentPaymentMonth;

            for (let i = 0; i < totalMonths; i++) {
                const monthKey = `${yearToUse}-${
                    (monthToUse + 1).toString().padStart(2, "0")
                }`;

                // Create monthly payment if it doesn't exist
                if (!monthlyPayments.has(monthKey)) {
                    monthlyPayments.set(monthKey, {
                        year: yearToUse,
                        month: monthToUse + 1,
                        monthName: this.getMonthName(monthToUse + 1),
                        totalAmount: 0,
                        breakdown: [],
                    });
                }

                // Get the payment object and update
                const payment = monthlyPayments.get(monthKey)!;
                payment.totalAmount += monthlyContribution;
                // Add to breakdown
                payment.breakdown.push({
                    purchaseId: purchase.id,
                    purchaseDate: purchase.date.toISOString().split("T")[0],
                    originalAmount: purchase.amount,
                    amountToPay: purchase.remainingAmount,
                    paymentDeadline:
                        purchase.paymentDeadline.toISOString().split("T")[0],
                    monthlyContribution: monthlyContribution,
                });

                // Move to next month
                monthToUse++;
                if (monthToUse > 11) {
                    monthToUse = 0;
                    yearToUse++;
                }
            }
        }

        // Sort months chronologically
        const sortedPayments = Array.from(monthlyPayments.values())
            .sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year;
                return a.month - b.month;
            });

        // Round amounts for better readability
        sortedPayments.forEach((payment) => {
            payment.totalAmount = Math.ceil(payment.totalAmount);
            payment.breakdown.forEach((item) => {
                item.monthlyContribution = Math.ceil(item.monthlyContribution);
            });
        });

        return sortedPayments;
    }

    // Add a new purchase
    public addPurchase(amount: number, date: string): Purchase {
        if (!this.db) {
            throw new Error("Database not initialized");
        }

        // Ensure proper Date object creation
        const purchaseDate = new Date(date);
        console.log(
            `Creating purchase for date: ${purchaseDate.toISOString()}`,
        );

        const paymentDeadline = this.calculatePaymentDeadline(purchaseDate);
        console.log(
            `Calculated payment deadline: ${paymentDeadline.toISOString()}`,
        );

        const id = uuidv4();

        const insertStmt = this.db.prepare(
            `INSERT INTO purchases (id, amount, remaining_amount, purchase_date, payment_deadline, paid)
             VALUES (?, ?, ?, ?, ?, ?)`,
        );
        insertStmt.bind([
            id,
            amount,
            amount,
            purchaseDate.toISOString(),
            paymentDeadline.toISOString(),
            0,
        ]);
        insertStmt.run();

        return {
            id,
            amount,
            remainingAmount: amount,
            date: purchaseDate,
            paymentDeadline,
            paid: false,
        };
    }

    // Record a payment for a purchase
    public recordPayment(
        purchaseId: string,
        amount: number,
        date: string = new Date().toISOString(),
    ): boolean {
        if (!this.db) {
            throw new Error("Database not initialized");
        }

        // Get current remaining amount
        const selectStmt = this.db.prepare(
            `SELECT remaining_amount
             FROM purchases
             WHERE id = ?`,
        );
        selectStmt.bind([purchaseId]);
        const purchase = selectStmt.get() as {
            remaining_amount: number;
        } | undefined;

        if (!purchase) {
            return false;
        }

        const newRemainingAmount = purchase.remaining_amount - amount;

        // Update remaining amount
        const updateStmt = this.db.prepare(
            `UPDATE purchases
             SET remaining_amount = ?,
                 paid             = CASE WHEN ? <= 0 THEN 1 ELSE 0 END
             WHERE id = ?`,
        );
        updateStmt.bind([newRemainingAmount, newRemainingAmount, purchaseId]);
        updateStmt.run();

        // Record the payment
        const paymentStmt = this.db.prepare(
            `INSERT INTO payments (id, purchase_id, payment_date, amount)
             VALUES (?, ?, ?, ?)`,
        );
        paymentStmt.bind([
            uuidv4(),
            purchaseId,
            new Date(date).toISOString(),
            amount,
        ]);
        paymentStmt.run();

        return true;
    }

    // Process a deposit by automatically distributing payments to purchases
    // starting from the earliest deadline until deposit amount is exhausted
    public processDeposit(
        depositAmount: number,
        date: string = new Date().toISOString(),
    ): { success: boolean; message: string; distributedPayments: Array<{purchaseId: string, amount: number}> } {
        if (!this.db) {
            throw new Error("Database not initialized");
        }

        if (depositAmount <= 0) {
            return {
                success: false,
                message: "Deposit amount must be greater than 0",
                distributedPayments: []
            };
        }

        const unpaidPurchases = this.getUnpaidPurchases();
        let remainingDeposit = depositAmount;
        const distributedPayments: Array<{purchaseId: string, amount: number}> = [];

        // Process purchases in order of earliest payment deadline
        for (const purchase of unpaidPurchases) {
            if (remainingDeposit <= 0) {
                break;
            }

            const amountToPay = Math.min(purchase.remainingAmount, remainingDeposit);
            
            // Record payment for this purchase
            const success = this.recordPayment(purchase.id, amountToPay, date);
            
            if (success) {
                distributedPayments.push({
                    purchaseId: purchase.id,
                    amount: amountToPay
                });
                remainingDeposit -= amountToPay;
            }
        }

        return {
            success: true,
            message: `Deposit processed. Distributed ${depositAmount - remainingDeposit} out of ${depositAmount}. ${remainingDeposit > 0 ? `Remaining deposit: ${remainingDeposit}` : 'Deposit fully utilized.'}`,
            distributedPayments
        };
    }

    // Get all unpaid purchases with proper date handling
    public getUnpaidPurchases(): Purchase[] {
        if (!this.db) {
            throw new Error("Database not initialized");
        }

        const stmt = this.db.prepare(
            `SELECT id, amount, remaining_amount, purchase_date, payment_deadline, paid
             FROM purchases
             WHERE paid = 0
             ORDER BY payment_deadline ASC`,
        );
        const rows = stmt.all() as PurchaseRow[];
        

        return rows.map((row) => {
            // Ensure proper date parsing
            const purchaseDate = new Date(row.purchase_date);
            const deadlineDate = new Date(row.payment_deadline);

            return {
                id: row.id,
                amount: row.amount,
                remainingAmount: row.remaining_amount,
                date: purchaseDate,
                paymentDeadline: deadlineDate,
                paid: Boolean(row.paid),
            };
        });
    }

    public getPaymentsInPeriod(startDate: Date, endDate: Date): PaymentRow[] {
        if (!this.db) {
            throw new Error("Database not initialized");
        }

        const stmt = this.db.prepare(
            `SELECT *
             FROM payments
             WHERE payment_date BETWEEN ? AND ?`,
        );
        stmt.bind([startDate.toISOString(), endDate.toISOString()]);
        const rows = stmt.all() as PaymentRow[];

        /*return rows.map((row) => ({
            purchaseId: row.purchase_id,
            amount: row.amount,
        }));
        */
       return rows;
    }

    // Calculate number of months between two dates
    private getMonthsBetween(startDate: Date, endDate: Date): number {
        // Get the difference in months
        const monthDiff =
            (endDate.getFullYear() - startDate.getFullYear()) * 12 +
            (endDate.getMonth() - startDate.getMonth());

        // Adjust for day of month
        // If end date is on or after the 10th and start date is before the 10th, add a month
        const dayAdjustment =
            (endDate.getDate() >= 10 && startDate.getDate() < 10) ? 1 : 0;

        return monthDiff + dayAdjustment;
    }

    // Get the nth day of a specific month
    private getNthDayOfMonth(year: number, month: number, day: number): Date {
        // Month is 0-indexed in JavaScript Date
        const date = new Date(year, month, day);
        return date;
    }

    // Get month name
    private getMonthName(month: number): string {
        const monthNames = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ];
        return monthNames[month - 1];
    }

    // Generate payment plan report
    public async generatePaymentPlan(): Promise<string> {
        const monthlyPayments = await this.calculateMinimumPayments();
        const totalDebt = await this.getTotalDebt();

        let report = `Total Debt: ${totalDebt.toFixed(2)}\n\n`;
        report += "Minimum Monthly Payment Plan:\n";

        for (const payment of monthlyPayments) {
            report +=
                `\n== Payment Due by 10th of ${payment.monthName} ${payment.year} ==\n`;
            report += `Total Payment: ${payment.totalAmount.toFixed(2)}\n`;
            report += "Breakdown:\n";

            // Group by purchase for cleaner output
            const purchaseGroups = new Map<string, {
                date: string;
                original: number;
                remaining: number;
                deadline: string;
                contribution: number;
            }>();

            for (const item of payment.breakdown) {
                if (!purchaseGroups.has(item.purchaseId)) {
                    purchaseGroups.set(item.purchaseId, {
                        date: item.purchaseDate,
                        original: item.originalAmount,
                        remaining: item.amountToPay,
                        deadline: item.paymentDeadline,
                        contribution: item.monthlyContribution,
                    });
                }
            }

            for (const [id, data] of purchaseGroups.entries()) {
                report += `  - Purchase from ${data.date}: ${
                    data.contribution.toFixed(2)
                }\n`;
                report += `    (Original: ${
                    data.original.toFixed(2)
                }, Remaining: ${
                    data.remaining.toFixed(2)
                }, Due: ${data.deadline})\n`;
                report += `    ID: ${id}\n`;
            }
        }

        return report;
    }

    // Get total debt
    public getTotalDebt(): number {
        if (!this.db) {
            throw new Error("Database not initialized");
        }

        const stmt = this.db.prepare(
            `SELECT SUM(remaining_amount) as total
             FROM purchases
             WHERE paid = 0`,
        );
        const remaining = stmt.get() as {total: number};
        

        return remaining.total || 0;
    }
}

// Command line interface
async function main() {
    const paymentPlanner = new CreditCardMinimumPaymentPlanner();
    await paymentPlanner.initialize();

    try {
        // Command-line argument parsing
        const args = process.argv.slice(2);

        if (args.length === 0) {
            console.log("Usage:");
            console.log(
                "  Add purchase: node minimum-payment-planner.js add <amount> <date>",
            );
            console.log(
                "  Record payment: node minimum-payment-planner.js pay <purchase-id> <amount>",
            );
            console.log(
                "  Show payment plan: node minimum-payment-planner.js plan",
            );
            console.log(
                "  List unpaid purchases: node minimum-payment-planner.js list",
            );
            return;
        }

        const command = args[0];

        switch (command) {
            case "add":
                if (args.length < 3) {
                    console.log(
                        "Usage: node minimum-payment-planner.js add <amount> <date>",
                    );
                    return;
                }
                const amount = parseFloat(args[1]);
                const date = args[2];
                const purchase = await paymentPlanner.addPurchase(amount, date);
                console.log("Purchase added:", purchase);
                break;

            case "pay":
                if (args.length < 3) {
                    console.log(
                        "Usage: node minimum-payment-planner.js pay <purchase-id> <amount> [date]",
                    );
                    return;
                }
                const purchaseId = args[1];
                const paymentAmount = parseFloat(args[2]);
                const paymentDate = args.length > 3
                    ? args[3]
                    : new Date().toISOString();
                const success = await paymentPlanner.recordPayment(
                    purchaseId,
                    paymentAmount,
                    paymentDate,
                );
                if (success) {
                    console.log(
                        `Payment of ${paymentAmount} recorded for purchase ${purchaseId}`,
                    );
                } else {
                    console.log("Purchase not found");
                }
                break;

            case "plan":
                const plan = await paymentPlanner.generatePaymentPlan();
                console.log(plan);
                break;

            case "list":
                const unpaidPurchases = await paymentPlanner
                    .getUnpaidPurchases();
                console.log("Unpaid Purchases:");
                unpaidPurchases.forEach((p) => {
                    console.log(`ID: ${p.id}`);
                    console.log(`Amount: ${p.amount}`);
                    console.log(`Remaining: ${p.remainingAmount}`);
                    console.log(`Date: ${p.date.toISOString().split("T")[0]}`);
                    console.log(
                        `Payment Deadline: ${
                            p.paymentDeadline.toISOString().split("T")[0]
                        }`,
                    );
                    console.log("---");
                });
                break;
            
            default:
                console.log("Unknown command");
                break;
        }
    } finally {
        await paymentPlanner.close();
    }
}

// Run the main function if this file is executed directly
if (require.main === module) {
    main().catch((err) => {
        console.error("Error:", err);
        process.exit(1);
    });
}

export { CreditCardMinimumPaymentPlanner };
