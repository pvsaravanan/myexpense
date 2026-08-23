/**
 * Domain constants and the string-union "enum" types used across the app.
 * These mirror the String columns in prisma/schema.prisma.
 */

export const TRANSACTION_TYPES = ["expense", "income", "transfer", "refund"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const PAYMENT_METHODS = ["upi", "cash", "card", "net_banking", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  upi: "UPI",
  cash: "Cash",
  card: "Card (Debit/Credit)",
  net_banking: "Net Banking",
  other: "Other",
};

export const ACCOUNT_TYPES = [
  "bank",
  "cash",
  "credit_card",
  "savings",
  "wallet",
  "investment",
  "loan",
  "other",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: "Bank Account",
  cash: "Cash",
  credit_card: "Credit Card",
  savings: "Savings",
  wallet: "Digital Wallet",
  investment: "Investment",
  loan: "Loan / EMI",
  other: "Other",
};

export function formatPaymentMethod(method?: string | null): string {
  if (!method) return "—";
  if (method in PAYMENT_METHOD_LABELS) {
    return PAYMENT_METHOD_LABELS[method as PaymentMethod];
  }
  return method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatAccountType(type?: string | null): string {
  if (!type) return "Other";
  if (type in ACCOUNT_TYPE_LABELS) {
    return ACCOUNT_TYPE_LABELS[type as AccountType];
  }
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const FREQUENCIES = ["daily", "weekly", "monthly", "quarterly", "yearly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export const CATEGORY_KINDS = ["expense", "income", "both"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const GOAL_STATUSES = ["active", "achieved", "archived"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const TYPE_LABELS: Record<TransactionType, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  refund: "Refund",
};

/** Default category set seeded for every new user. Colors are theme-neutral. */
export interface DefaultCategory {
  name: string;
  icon: string;
  color: string;
  kind: CategoryKind;
}

/**
 * Warm, earthy category palette — clay, ochre, olive, terracotta and ink.
 * Deliberately kept inside the parchment/coral family so category swatches and
 * charts never fight the surface. No saturated cool primaries.
 */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Housing", icon: "home", color: "#8c5a3c", kind: "expense" },        // walnut
  { name: "Food", icon: "utensils", color: "#d88060", kind: "expense" },       // clay coral
  { name: "Groceries", icon: "shopping-basket", color: "#7d8c4a", kind: "expense" }, // olive
  { name: "Transportation", icon: "car", color: "#4f7a72", kind: "expense" },  // teal-slate
  { name: "Education", icon: "graduation-cap", color: "#4a6785", kind: "expense" }, // muted indigo
  { name: "Healthcare", icon: "heart-pulse", color: "#b84b3a", kind: "expense" },   // brick
  { name: "Entertainment", icon: "clapperboard", color: "#a4566e", kind: "expense" }, // plum
  { name: "Shopping", icon: "shopping-bag", color: "#c96f4f", kind: "expense" },    // burnt clay
  { name: "Subscriptions", icon: "repeat", color: "#6d5b8c", kind: "expense" },     // dusty violet
  { name: "Bills & Utilities", icon: "receipt", color: "#5a7a8c", kind: "expense" },// slate blue
  { name: "Travel", icon: "plane", color: "#3f7d6e", kind: "expense" },        // pine
  { name: "Personal", icon: "user", color: "#c9942f", kind: "expense" },       // ochre
  { name: "Family", icon: "users", color: "#96604f", kind: "expense" },        // rosewood
  { name: "Bank Charges", icon: "landmark", color: "#6b6b63", kind: "expense" },// stone
  { name: "Salary", icon: "wallet", color: "#2c6b4f", kind: "income" },        // deep green
  { name: "Business", icon: "briefcase", color: "#3f6b6b", kind: "income" },
  { name: "Investments", icon: "trending-up", color: "#557a3f", kind: "income" },
  { name: "Other Income", icon: "plus-circle", color: "#4f8060", kind: "income" },
  { name: "Other", icon: "circle-dot", color: "#8a8578", kind: "both" },
];

export const DEFAULT_DASHBOARD_WIDGETS = [
  "balance",
  "monthly_spending",
  "income",
  "savings",
  "budget",
  "recent_transactions",
  "spending_categories",
  "financial_goals",
  "upcoming_recurring",
  "insights",
] as const;

export type WidgetKey = (typeof DEFAULT_DASHBOARD_WIDGETS)[number];

export const WIDGET_LABELS: Record<WidgetKey, string> = {
  balance: "Balance summary",
  monthly_spending: "Monthly spending",
  income: "Income",
  savings: "Savings",
  budget: "Budget progress",
  recent_transactions: "Recent transactions",
  spending_categories: "Spending by category",
  financial_goals: "Financial goals",
  upcoming_recurring: "Upcoming recurring",
  insights: "Insights",
};

export function isTransactionType(v: string): v is TransactionType {
  return (TRANSACTION_TYPES as readonly string[]).includes(v);
}
