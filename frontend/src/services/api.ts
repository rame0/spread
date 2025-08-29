import axios from 'axios';
import { Purchase, PaymentPlan } from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getPurchases = async (): Promise<Purchase[]> => {
  const response = await api.get('/purchases');
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
