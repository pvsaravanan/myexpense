/**
 * Zod request schemas. All money fields are integer paise (server never trusts
 * client-side rupee floats — the client converts to paise before sending).
 */
import { z } from "zod";
import {
  ACCOUNT_TYPES,
  CATEGORY_KINDS,
  FREQUENCIES,
  GOAL_STATUSES,
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
} from "./constants";
import { fromISODate } from "./dates";

// Money columns are Prisma Int (32-bit signed, max 2,147,483,647). Cap well
// below that so an oversized amount fails Zod validation with a clear field
// error instead of throwing a PrismaClientValidationError that falls through
// to a generic 500.
const MAX_PAISE = 1_000_000_000; // ₹1,00,00,000 (1 crore)
const paise = z
  .number()
  .int("Amount must be a whole number of paise")
  .max(MAX_PAISE, "Amount is too large")
  .min(-MAX_PAISE, "Amount is too large");
const positivePaise = paise.positive("Amount must be greater than zero");
// The regex only enforces the SHAPE; refine rejects calendar-invalid values
// like 2026-02-30 or 2026-04-31 (which fromISODate detects via rollover), so a
// bad date surfaces as a 422 field error instead of being silently coerced to
// null / "today" downstream.
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((s) => fromISODate(s) !== null, "Enter a real calendar date");

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  // Cap the length (matching registerSchema) so an oversized body can't be fed
  // into bcrypt.compare as a cheap CPU/memory amplification vector.
  password: z.string().min(1, "Password is required").max(200),
});

export const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

export const resetSchema = z.object({
  token: z.string().min(1, "Missing reset token"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

/** A contact's share of a transaction's cost — see ExpenseShare in the schema. */
export const shareInputSchema = z.object({
  contactId: z.string().min(1),
  amount: positivePaise,
});
export type ShareInput = z.infer<typeof shareInputSchema>;

export const transactionSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    amount: positivePaise,
    description: z.string().trim().min(1, "Description is required").max(200),
    merchant: z.string().trim().max(120).optional().nullable(),
    date: isoDate,
    categoryId: z.string().optional().nullable(),
    accountId: z.string().min(1, "Account is required"),
    transferAccountId: z.string().optional().nullable(),
    paymentMethod: z.string().trim().max(60).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    // People this expense is shared with. Omit to leave existing shares
    // untouched on an edit; send [] to clear them.
    shares: z.array(shareInputSchema).max(20).optional(),
  })
  .refine((d) => d.type !== "transfer" || (d.transferAccountId && d.transferAccountId !== d.accountId), {
    message: "Transfers need a different destination account",
    path: ["transferAccountId"],
  })
  // Transfers move money between your own accounts and have no category of
  // their own; every other type must be filed under a real category — an
  // "Uncategorized" bucket is still allowed to *exist* (old data, imports),
  // it's just no longer a choice going forward.
  .refine((d) => d.type === "transfer" || !!d.categoryId, {
    message: "Choose a category",
    path: ["categoryId"],
  })
  // People-shares split the *cost* of something — meaningless for a transfer,
  // which just moves your own money between your own accounts. The UI never
  // offers sharing for a transfer; enforce it here too so a direct API call
  // can't attach shares to one.
  .refine((d) => d.type !== "transfer" || !d.shares?.length, {
    message: "Transfers can't be split with people",
    path: ["shares"],
  });

export type TransactionInput = z.infer<typeof transactionSchema>;

/** One category/account allocation within a split expense. */
export const splitPartSchema = z.object({
  amount: positivePaise,
  categoryId: z.string().min(1, "Choose a category"),
  accountId: z.string().min(1, "Account is required"),
  description: z.string().trim().max(200).optional(),
});

/**
 * A single logical expense divided into multiple real Transaction rows
 * (one per part), sharing a splitGroupId — see the schema comment on
 * Transaction.splitGroupId. Splitting is expense-only: it wouldn't have a
 * clear meaning for income/transfer/refund.
 */
export const splitTransactionSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(200),
  merchant: z.string().trim().max(120).optional().nullable(),
  date: isoDate,
  paymentMethod: z.string().trim().max(60).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  parts: z.array(splitPartSchema).min(2, "Add at least 2 splits").max(10, "Up to 10 splits"),
  // Shares apply against the group's total (sum of all parts), not any
  // single part — a friend's portion of the whole purchase doesn't care how
  // you've broken it down by category or account.
  shares: z.array(shareInputSchema).max(20).optional(),
});

export type SplitTransactionInput = z.infer<typeof splitTransactionSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#64748b"),
});

/** A standalone ledger entry against a contact (not tied to a transaction). */
export const standaloneShareSchema = z.object({
  amount: positivePaise,
  direction: z.enum(["owed_to_you", "you_owe"]),
  description: z.string().trim().max(200).optional().nullable(),
  date: isoDate.optional(),
});

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  type: z.string().trim().min(1, "Type is required").max(60),
  openingBalance: paise.default(0),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0d9488"),
  icon: z.string().max(40).default("wallet"),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  icon: z.string().max(40).default("tag"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#64748b"),
  kind: z.enum(CATEGORY_KINDS).default("expense"),
  monthlyBudget: positivePaise.optional().nullable(),
  parentId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const budgetSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  overallLimit: positivePaise.optional().nullable(),
  categories: z
    .array(z.object({ categoryId: z.string().min(1), limit: positivePaise }))
    .default([]),
});

export const recurringSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    type: z.enum(["expense", "income", "transfer"]),
    amount: positivePaise,
    categoryId: z.string().optional().nullable(),
    accountId: z.string().min(1, "Account is required"),
    transferAccountId: z.string().optional().nullable(),
    paymentMethod: z.string().trim().max(60).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
    frequency: z.enum(FREQUENCIES),
    interval: z.number().int().min(1).max(365).default(1),
    startDate: isoDate,
    endDate: isoDate.optional().nullable(),
    autoPost: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.type !== "transfer" || (d.transferAccountId && d.transferAccountId !== d.accountId), {
    message: "Transfers need a different destination account",
    path: ["transferAccountId"],
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  })
  .refine((d) => d.type === "transfer" || !!d.categoryId, {
    message: "Choose a category",
    path: ["categoryId"],
  });

export const goalSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  icon: z.string().max(40).default("target"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0d9488"),
  targetAmount: positivePaise,
  targetDate: isoDate.optional().nullable(),
  accountId: z.string().optional().nullable(),
  initialAmount: paise.min(0).default(0),
  status: z.enum(GOAL_STATUSES).default("active"),
});

export const contributionSchema = z.object({
  amount: paise.refine((n) => n !== 0, "Amount cannot be zero"),
  date: isoDate.optional(),
  note: z.string().trim().max(200).optional().nullable(),
});

export const preferenceSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  dashboardWidgets: z.array(z.string()).optional(),
  defaultAccountId: z.string().optional().nullable(),
});

/** Format a ZodError into a flat field->message map for the client. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
