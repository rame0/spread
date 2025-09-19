import axios from 'axios';
import { Purchase, PaymentPlan } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getPurchases = async (): Promise<Purchase[]> => {
  const response = await api.get('/purchases');
  return response.data;
};

export const getAllPurchases = async (): Promise<Purchase[]> => {
  const response = await api.get('/purchases/all');
  return response.data;
};

export const getPaidPurchases = async (): Promise<Purchase[]> => {
  const response = await api.get('/purchases/paid');
  return response.data;
};

export const addPurchase = async (amount: number, date: string): Promise<Purchase> => {
  const response = await api.post('/purchases', { amount, date });
  return response.data;
};

export const recordPayment = async (purchaseId: string, amount: number, date?: string) => {
  const response = await api.post('/payments', { purchaseId, amount, date });
  return response.data;
};

export const getPaymentPlan = async (): Promise<PaymentPlan> => {
  const response = await api.get('/payment-plan');
  return response.data;
};

export const getTotalDebt = async (): Promise<number> => {
  const response = await api.get('/total-debt');
  return response.data.totalDebt;
};

export const processDeposit = async (amount: number, date?: string): Promise<{
  success: boolean;
  message: string;
  distributedPayments: Array<{purchaseId: string, amount: number}>;
}> => {
  const response = await api.post('/deposit', { amount, date });
  return response.data;
};

export const getPaymentsThisMonth = async (): Promise<{
  totalAmount: number;
  payments: Array<{
    id: string;
    purchaseId: string;
    amount: number;
    paymentDate: string;
    purchaseDate: string;
    originalAmount: number;
  }>;
}> => {
  const response = await api.get('/payments/this-month');
  return response.data;
};

export const getAllPayments = async (): Promise<Array<{
  id: string;
  purchaseId: string;
  amount: number;
  paymentDate: string;
  purchaseDate: string;
  originalAmount: number;
  remainingAmount: number;
}>> => {
  const response = await api.get('/payments/all');
  return response.data;
};
