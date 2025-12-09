export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME'
}

export enum Currency {
  ARS = 'ARS',
  USD = 'USD',
  EUR = 'EUR',
  MXN = 'MXN',
  COP = 'COP'
}

export interface Transaction {
  id: string;
  amount: number;
  originalAmount?: number;
  currency: Currency;
  originalCurrency?: Currency;
  type: TransactionType;
  category: string;
  subcategory: string;
  date: string; // ISO String
  description: string;
  paymentMethod: string;
  projectId: string; // Kept for legacy compatibility but fixed to 'personal'
  tags: string[];
}

export interface RecurringTransaction {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  type: TransactionType; // New field to distinguish between Fixed Income (Salary) and Fixed Cost (Rent)
  category: string;
  isEnabled: boolean;
}

export interface FinancialInsight {
  title: string;
  description: string;
  type: 'warning' | 'opportunity' | 'neutral';
}

export interface UserFinancialProfile {
  personaTitle: string; // e.g., "Ahorrador Cauteloso"
  description: string;
  strengths: string[];
  weaknesses: string[];
}

export interface UserSettings {
  name: string;
  avatar: string | null; // Base64 string
}

export interface ParsingResult {
  amount: number;
  currency: string;
  type: string;
  category: string;
  subcategory: string;
  date: string;
  description: string;
  paymentMethod: string;
  tags: string[];
}