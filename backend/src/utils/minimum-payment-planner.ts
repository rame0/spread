import initSqlJs, { Database, SqlJsStatic } from "sql.js";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import { UUID } from "crypto";

// Helper to convert sql.js output to a more usable array of objects
function convertSqljsResult(res: any) {
    if (!res || res.length === 0) {
        return [];
    }
    const columns = res[0].columns;
    return res[0].values.map((row: any) => {
        const obj: { [key: string]: any } = {};
        columns.forEach((col: string, i: number) => {
            obj[col] = row[i];
        });
        return obj;
    });
}


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
    private db: Database | null = null;
    private SQL: SqlJsStatic | null = null;
    private dbPath: string;

    constructor(dbPath: string = "credit_card.sqlite") {
        this.dbPath = dbPath;
    }

    // Save the database to the file
    private async saveDb(): Promise<void> {
        if (this.db) {
            const data = this.db.export();
            await fs.writeFile(this.dbPath, data);
        }
    }

    // Initialize the database
    public async initialize(): Promise<void> {
        this.SQL = await initSqlJs();
        try {
            const fileBuffer = await fs.readFile(this.dbPath);
            this.db = new this.SQL.Database(fileBuffer);
        } catch (error) {
            // If the file doesn't exist, create a new database
            this.db = new this.SQL.Database();
        }

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
        
        await this.saveDb();
    }

    // Close the database connection
    public async close(): Promise<void> {
        await this.saveDb();
        if (this.db) {
            this.db.close();
        }
    }

    // Fix 1: Corrected deadline calculation
    private calculatePaymentDeadline(purchaseDate: Date): Date {
        const purchaseDateTime = new Date(purchaseDate);
        const fourthMonth = new Date(purchaseDateTime);
        fourthMonth.setMonth(purchaseDateTime.getMonth() + 4);
        fourthMonth.setDate(10);
        const days120Later = new Date(purchaseDateTime);
        days120Later.setDate(purchaseDateTime.getDate() + 120);
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

        const currentPaymentPeriodStart = new Date(currentPaymentYear, currentPaymentMonth, 10);
        const currentPaymentPeriodEnd = new Date(currentPaymentYear, currentPaymentMonth + 1, 9);
        
        const currentPaymentPeriodPayments = await this.getPaymentsInPeriod(
            currentPaymentPeriodStart,
            currentPaymentPeriodEnd,
        );

        const purchasePayments = new Map<string, number>();
        for (const payment of currentPaymentPeriodPayments) {
            const purchaseId = payment.purchase_id as unknown as string;
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

            let totalMonths = 0;
            let tempYear = currentPaymentYear;
            let tempMonth = currentPaymentMonth;

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

            totalMonths = Math.max(1, totalMonths);
            const monthlyContribution = purchase.remainingAmount / totalMonths;

            let yearToUse = currentPaymentYear;
            let monthToUse = currentPaymentMonth;

            for (let i = 0; i < totalMonths; i++) {
                const monthKey = `${yearToUse}-${(monthToUse + 1).toString().padStart(2, "0")}`;

                if (!monthlyPayments.has(monthKey)) {
                    monthlyPayments.set(monthKey, {
                        year: yearToUse,
                        month: monthToUse + 1,
                        monthName: this.getMonthName(monthToUse + 1),
                        totalAmount: 0,
                        breakdown: [],
                    });
                }

                const payment = monthlyPayments.get(monthKey)!;
                payment.totalAmount += monthlyContribution;
                payment.breakdown.push({
                    purchaseId: purchase.id,
                    purchaseDate: purchase.date.toISOString().split("T")[0],
                    originalAmount: purchase.amount,
                    amountToPay: purchase.remainingAmount,
                    paymentDeadline: purchase.paymentDeadline.toISOString().split("T")[0],
                    monthlyContribution: monthlyContribution,
                });

                monthToUse++;
                if (monthToUse > 11) {
                    monthToUse = 0;
                    yearToUse++;
                }
            }
        }

        const sortedPayments = Array.from(monthlyPayments.values())
            .sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year;
                return a.month - b.month;
            });

        sortedPayments.forEach((payment) => {
            payment.totalAmount = Math.ceil(payment.totalAmount);
            payment.breakdown.forEach((item) => {
                item.monthlyContribution = Math.ceil(item.monthlyContribution);
            });
        });

        return sortedPayments;
    }

    public async addPurchase(amount: number, date: string): Promise<Purchase> {
        if (!this.db) throw new Error("Database not initialized");

        const purchaseDate = new Date(date);
        const paymentDeadline = this.calculatePaymentDeadline(purchaseDate);
        const id = uuidv4();

        this.db.run(
            `INSERT INTO purchases (id, amount, remaining_amount, purchase_date, payment_deadline, paid)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                id,
                amount,
                amount,
                purchaseDate.toISOString(),
                paymentDeadline.toISOString(),
                0,
            ]
        );

        await this.saveDb();

        return {
            id,
            amount,
            remainingAmount: amount,
            date: purchaseDate,
            paymentDeadline,
            paid: false,
        };
    }

    public async recordPayment(
        purchaseId: string,
        amount: number,
        date: string = new Date().toISOString(),
    ): Promise<boolean> {
        if (!this.db) throw new Error("Database not initialized");

        const res = this.db.exec(
            `SELECT remaining_amount FROM purchases WHERE id = '${purchaseId}'`
        );
        const purchase = convertSqljsResult(res)[0] as { remaining_amount: number } | undefined;

        if (!purchase) return false;

        const newRemainingAmount = purchase.remaining_amount - amount;

        this.db.run(
            `UPDATE purchases
             SET remaining_amount = ?,
                 paid             = CASE WHEN ? <= 0 THEN 1 ELSE 0 END
             WHERE id = ?`,
            [newRemainingAmount, newRemainingAmount, purchaseId]
        );

        this.db.run(
            `INSERT INTO payments (id, purchase_id, payment_date, amount)
             VALUES (?, ?, ?, ?)`,
            [
                uuidv4(),
                purchaseId,
                new Date(date).toISOString(),
                amount,
            ]
        );

        await this.saveDb();
        return true;
    }

    public async processDeposit(
        depositAmount: number,
        date: string = new Date().toISOString(),
    ): Promise<{ success: boolean; message: string; distributedPayments: Array<{purchaseId: string, amount: number}> }> {
        if (!this.db) throw new Error("Database not initialized");

        if (depositAmount <= 0) {
            return {
                success: false,
                message: "Deposit amount must be greater than 0",
                distributedPayments: []
            };
        }

        const unpaidPurchases = await this.getUnpaidPurchases();
        let remainingDeposit = depositAmount;
        const distributedPayments: Array<{purchaseId: string, amount: number}> = [];

        for (const purchase of unpaidPurchases) {
            if (remainingDeposit <= 0) break;

            const amountToPay = Math.min(purchase.remainingAmount, remainingDeposit);
            
            const success = await this.recordPayment(purchase.id, amountToPay, date);
            
            if (success) {
                distributedPayments.push({
                    purchaseId: purchase.id,
                    amount: amountToPay
                });
                remainingDeposit -= amountToPay;
            }
        }

        await this.saveDb();

        return {
            success: true,
            message: `Deposit processed. Distributed ${depositAmount - remainingDeposit} out of ${depositAmount}. ${remainingDeposit > 0 ? `Remaining deposit: ${remainingDeposit}` : 'Deposit fully utilized.'}`,
            distributedPayments
        };
    }

    public async getUnpaidPurchases(): Promise<Purchase[]> {
        if (!this.db) throw new Error("Database not initialized");

        const res = this.db.exec(
            `SELECT id, amount, remaining_amount, purchase_date, payment_deadline, paid
             FROM purchases
             WHERE paid = 0
             ORDER BY payment_deadline ASC`
        );
        const rows = convertSqljsResult(res) as PurchaseRow[];

        return rows.map((row) => ({
            id: row.id,
            amount: row.amount,
            remainingAmount: row.remaining_amount,
            date: new Date(row.purchase_date),
            paymentDeadline: new Date(row.payment_deadline),
            paid: Boolean(row.paid),
        }));
    }

    public async getAllPurchases(): Promise<Purchase[]> {
        if (!this.db) throw new Error("Database not initialized");

        const res = this.db.exec(
            `SELECT id, amount, remaining_amount, purchase_date, payment_deadline, paid
             FROM purchases
             ORDER BY purchase_date DESC`
        );
        const rows = convertSqljsResult(res) as PurchaseRow[];

        return rows.map((row) => ({
            id: row.id,
            amount: row.amount,
            remainingAmount: row.remaining_amount,
            date: new Date(row.purchase_date),
            paymentDeadline: new Date(row.payment_deadline),
            paid: Boolean(row.paid),
        }));
    }

    public async getPaidPurchases(): Promise<Purchase[]> {
        if (!this.db) throw new Error("Database not initialized");

        const res = this.db.exec(
            `SELECT id, amount, remaining_amount, purchase_date, payment_deadline, paid
             FROM purchases
             WHERE paid = 1
             ORDER BY purchase_date DESC`
        );
        const rows = convertSqljsResult(res) as PurchaseRow[];

        return rows.map((row) => ({
            id: row.id,
            amount: row.amount,
            remainingAmount: row.remaining_amount,
            date: new Date(row.purchase_date),
            paymentDeadline: new Date(row.payment_deadline),
            paid: Boolean(row.paid),
        }));
    }

    public async getPaymentsInPeriod(startDate: Date, endDate: Date): Promise<PaymentRow[]> {
        if (!this.db) throw new Error("Database not initialized");

        const res = this.db.exec(
            `SELECT *
             FROM payments
             WHERE payment_date BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'`
        );
        return convertSqljsResult(res) as PaymentRow[];
    }

    public async getAllPayments(): Promise<PaymentRow[]> {
        if (!this.db) throw new Error("Database not initialized");

        const res = this.db.exec(
            `SELECT *
             FROM payments
             ORDER BY payment_date DESC`
        );
        return convertSqljsResult(res) as PaymentRow[];
    }

    private getMonthName(month: number): string {
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return monthNames[month - 1];
    }

    public async generatePaymentPlan(): Promise<string> {
        const monthlyPayments = await this.calculateMinimumPayments();
        const totalDebt = await this.getTotalDebt();

        let report = `Total Debt: ${totalDebt.toFixed(2)}\n\n`;
        report += "Minimum Monthly Payment Plan:\n";

        for (const payment of monthlyPayments) {
            report += `\n== Payment Due by 10th of ${payment.monthName} ${payment.year} ==\n`;
            report += `Total Payment: ${payment.totalAmount.toFixed(2)}\n`;
            report += "Breakdown:\n";

            const purchaseGroups = new Map<string, any>();
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
                report += `  - Purchase from ${data.date}: ${data.contribution.toFixed(2)}\n`;
                report += `    (Original: ${data.original.toFixed(2)}, Remaining: ${data.remaining.toFixed(2)}, Due: ${data.deadline})\n`;
                report += `    ID: ${id}\n`;
            }
        }
        return report;
    }

    public async getTotalDebt(): Promise<number> {
        if (!this.db) throw new Error("Database not initialized");

        const res = this.db.exec(
            `SELECT SUM(remaining_amount) as total
             FROM purchases
             WHERE paid = 0`
        );
        const remaining = convertSqljsResult(res)[0] as { total: number };
        return remaining?.total || 0;
    }
}

async function main() {
    const paymentPlanner = new CreditCardMinimumPaymentPlanner();
    await paymentPlanner.initialize();

    try {
        const args = process.argv.slice(2);
        if (args.length === 0) {
            console.log("Usage: ... (CLI instructions)");
            return;
        }
        const command = args[0];
        switch (command) {
            case "add":
                const amount = parseFloat(args[1]);
                const date = args[2];
                const purchase = await paymentPlanner.addPurchase(amount, date);
                console.log("Purchase added:", purchase);
                break;
            case "pay":
                const purchaseId = args[1];
                const paymentAmount = parseFloat(args[2]);
                const paymentDate = args.length > 3 ? args[3] : new Date().toISOString();
                const success = await paymentPlanner.recordPayment(purchaseId, paymentAmount, paymentDate);
                console.log(success ? "Payment recorded" : "Purchase not found");
                break;
            case "plan":
                const plan = await paymentPlanner.generatePaymentPlan();
                console.log(plan);
                break;
            case "list":
                const unpaidPurchases = await paymentPlanner.getUnpaidPurchases();
                console.log("Unpaid Purchases:", unpaidPurchases);
                break;
            default:
                console.log("Unknown command");
        }
    } finally {
        await paymentPlanner.close();
    }
}

if (require.main === module) {
    main().catch((err) => {
        console.error("Error:", err);
        process.exit(1);
    });
}

export { CreditCardMinimumPaymentPlanner };
