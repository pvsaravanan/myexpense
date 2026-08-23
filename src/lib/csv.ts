/**
 * CSV utilities: a dependency-free CSV writer (used for exports) and pure
 * import-mapping/validation logic (used by the import API and its tests).
 */
import { fromISODate, toISODate } from "./dates";
import { toPaise } from "./money";
import { isTransactionType, type TransactionType } from "./constants";

/** Quote a value for CSV per RFC 4180. */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCSV(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  return lines.join("\r\n");
}

// ---- Import ----------------------------------------------------------------

export type ImportField =
  | "date"
  | "description"
  | "amount"
  | "type"
  | "category"
  | "account"
  | "paymentMethod"
  | "notes";

export type ColumnMapping = Partial<Record<ImportField, string>>;

export interface ParsedImportRow {
  index: number; // original row index (0-based, excludes header)
  type: TransactionType;
  amount: number; // paise
  description: string;
  date: string; // ISO
  categoryName: string | null;
  accountName: string | null;
  paymentMethod: string | null;
  notes: string | null;
}

export interface InvalidImportRow {
  index: number;
  errors: string[];
  raw: Record<string, string>;
}

export interface ImportValidation {
  valid: ParsedImportRow[];
  invalid: InvalidImportRow[];
  total: number;
}

export type DateFormatHint = "auto" | "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

/**
 * Detect the dominant date format across an entire column of sample dates.
 * If any row has field1 > 12 (e.g. 25/08/2026), it's DD/MM/YYYY.
 * If any row has field2 > 12 (e.g. 08/25/2026), it's MM/DD/YYYY.
 * If starting with 4 digits, it's YYYY-MM-DD.
 */
export function detectDateFormat(dates: string[]): "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" {
  let hasFirstAbove12 = false;
  let hasSecondAbove12 = false;
  let isIso = false;

  for (const raw of dates) {
    const s = raw?.trim() ?? "";
    if (!s) continue;
    if (/^\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}$/.test(s)) {
      isIso = true;
      continue;
    }
    const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(s);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (a > 12 && b <= 12) hasFirstAbove12 = true;
      if (b > 12 && a <= 12) hasSecondAbove12 = true;
    }
  }

  if (hasSecondAbove12 && !hasFirstAbove12) return "MM/DD/YYYY";
  if (hasFirstAbove12) return "DD/MM/YYYY";
  if (isIso) return "YYYY-MM-DD";
  return "DD/MM/YYYY"; // default fallback in Indian locale
}

/**
 * Validate raw CSV records against a column mapping. Amount sign convention:
 * a negative amount (or an explicit "expense" type) means an expense; a
 * positive amount defaults to income only when the type column says so,
 * otherwise the magnitude is used with the mapped/derived type.
 */
export function validateImportRows(
  records: Record<string, string>[],
  mapping: ColumnMapping,
  dateFormat: DateFormatHint = "auto",
): ImportValidation {
  const valid: ParsedImportRow[] = [];
  const invalid: InvalidImportRow[] = [];

  if (!mapping.date || !mapping.amount || !mapping.description) {
    // Caller must map the required fields; report all rows as invalid.
    return {
      valid: [],
      invalid: records.map((raw, index) => ({
        index,
        raw,
        errors: ["Map the Date, Description and Amount columns to continue"],
      })),
      total: records.length,
    };
  }

  // If auto, sample all dates across records to determine a single consistent format
  const resolvedFormat =
    dateFormat === "auto"
      ? detectDateFormat(records.map((r) => mapping.date ? r[mapping.date] ?? "" : ""))
      : dateFormat;

  // Sign-based type inference (below) is meaningless when the file never
  // uses a negative amount at all — many Indian bank exports show every
  // amount unsigned and convey debit/credit via a separate column instead.
  // Without a mapped Type column and without any negative amount anywhere
  // in the file, we cannot tell expenses from income; defaulting silently to
  // "income" would mis-tag every expense row with no visible error. Detect
  // that case up front and require the user to map a Type column instead of
  // guessing.
  const hasTypeColumn = Boolean(mapping.type);
  const hasAnyNegativeAmount = !hasTypeColumn
    ? records.some((raw) => {
        const rawAmount = mapping.amount ? (raw[mapping.amount] ?? "").trim() : "";
        const cleaned = rawAmount.replace(/[₹,\s]/g, "");
        const num = Number(cleaned);
        return Number.isFinite(num) && num < 0;
      })
    : true; // irrelevant when a type column is mapped
  const typeIsAmbiguous = !hasTypeColumn && !hasAnyNegativeAmount && records.length > 0;

  records.forEach((raw, index) => {
    const errors: string[] = [];
    const get = (f: ImportField) => (mapping[f] ? (raw[mapping[f]!] ?? "").trim() : "");

    const rawDate = get("date");
    const date = normalizeDate(rawDate, resolvedFormat);
    if (!date) errors.push(`Invalid date: "${rawDate}"`);

    const description = get("description");
    if (!description) errors.push("Description is required");

    const rawAmount = get("amount");
    let amountPaise = 0;
    let sign = 1;
    try {
      const cleaned = rawAmount.replace(/[₹,\s]/g, "");
      if (cleaned === "") throw new Error("empty");
      const num = Number(cleaned);
      if (!Number.isFinite(num)) throw new Error("nan");
      sign = num < 0 ? -1 : 1;
      amountPaise = Math.abs(toPaise(cleaned));
      if (amountPaise === 0) errors.push("Amount cannot be zero");
    } catch {
      errors.push(`Invalid amount: "${rawAmount}"`);
    }

    // Determine type: explicit mapping wins, else infer from sign.
    let type: TransactionType = sign < 0 ? "expense" : "income";
    const rawType = get("type").toLowerCase();
    if (rawType) {
      const normalized = rawType.replace(/\s+/g, "_");
      if (isTransactionType(normalized)) type = normalized;
      else if (["debit", "dr", "withdrawal", "spent"].includes(rawType)) type = "expense";
      else if (["credit", "cr", "deposit", "received"].includes(rawType)) type = "income";
    }

    if (typeIsAmbiguous) {
      errors.push("Cannot tell income from expense — map a Type/Debit-Credit column (this file has no negative amounts)");
    }

    if (errors.length) {
      invalid.push({ index, raw, errors });
      return;
    }

    valid.push({
      index,
      type,
      amount: amountPaise,
      description,
      date: date!,
      categoryName: get("category") || null,
      accountName: get("account") || null,
      paymentMethod: normalizePaymentMethod(get("paymentMethod")),
      notes: get("notes") || null,
    });
  });

  return { valid, invalid, total: records.length };
}

/** Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY with optional format hint. */
export function normalizeDate(input: string, formatHint: DateFormatHint = "auto"): string | null {
  const s = input.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return fromISODate(s) ? s : null;

  const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(s);
  if (m) {
    let [, a, b, y] = m;
    let year = Number(y);
    if (year < 100) year += 2000;
    const num1 = Number(a);
    const num2 = Number(b);

    let day: number;
    let month: number;

    if (formatHint === "MM/DD/YYYY") {
      month = num1;
      day = num2;
    } else if (formatHint === "DD/MM/YYYY") {
      day = num1;
      month = num2;
    } else {
      // auto fallback
      if (num1 > 12 && num2 <= 12) {
        day = num1;
        month = num2;
      } else if (num2 > 12 && num1 <= 12) {
        month = num1;
        day = num2;
      } else {
        day = num1;
        month = num2;
      }
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return fromISODate(iso) ? iso : null;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return toISODate(parsed);
  return null;
}

function normalizePaymentMethod(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, "_");
  const known = ["upi", "cash"];
  return known.includes(s) ? s : null;
}

/** Signature used to detect duplicate transactions on import. */
export function dedupeKey(input: { date: string; amount: number; description: string; type: string }): string {
  return `${input.date}|${input.type}|${input.amount}|${input.description.trim().toLowerCase()}`;
}
