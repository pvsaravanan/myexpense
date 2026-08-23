/**
 * Serialized DTOs returned by API routes and consumed by client components.
 * Dates are ISO strings; all money fields are integer paise (numbers).
 */
import type {
  AccountType,
  CategoryKind,
  Frequency,
  GoalStatus,
  PaymentMethod,
  TransactionType,
} from "./constants";

export interface AccountDTO {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: number;
  color: string;
  icon: string;
  isArchived: boolean;
  sortOrder: number;
  balance: number; // computed current balance (paise)
}

export interface CategoryDTO {
  id: string;
  name: string;
  icon: string;
  color: string;
  kind: CategoryKind;
  monthlyBudget: number | null;
  parentId: string | null;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
}

export interface TagDTO {
  id: string;
  name: string;
  color: string;
}

export interface TransactionDTO {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  merchant: string | null;
  date: string; // ISO date (YYYY-MM-DD)
  categoryId: string | null;
  accountId: string;
  transferAccountId: string | null;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
  recurringId: string | null;
  tags: string[];
}

export interface RecurringDTO {
  id: string;
  name: string;
  type: "expense" | "income" | "transfer";
  amount: number;
  categoryId: string | null;
  accountId: string;
  transferAccountId: string | null;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
  frequency: Frequency;
  interval: number;
  startDate: string;
  endDate: string | null;
  nextOccurrence: string;
  lastPostedDate: string | null;
  isActive: boolean;
  autoPost: boolean;
}

export interface GoalDTO {
  id: string;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  targetDate: string | null;
  accountId: string | null;
  status: GoalStatus;
  currentAmount: number; // sum of contributions (paise)
  contributions: GoalContributionDTO[];
}

export interface GoalContributionDTO {
  id: string;
  amount: number;
  date: string;
  note: string | null;
}

export interface BudgetCategoryDTO {
  categoryId: string;
  limit: number;
}

export interface BudgetDTO {
  id: string | null;
  year: number;
  month: number;
  overallLimit: number | null;
  categories: BudgetCategoryDTO[];
}

export interface PreferenceDTO {
  theme: "light" | "dark" | "system";
  dashboardWidgets: string[];
  defaultAccountId: string | null;
}
