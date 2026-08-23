import { describe, expect, it } from "vitest";
import { buildCSV, dedupeKey, detectDateFormat, normalizeDate, validateImportRows } from "./csv";
import { toPaise } from "./money";

describe("buildCSV", () => {
  it("quotes cells containing commas, quotes and newlines", () => {
    const csv = buildCSV(["a", "b"], [["plain", 'has,comma'], ['say "hi"', "line\nbreak"]]);
    expect(csv).toBe('a,b\r\nplain,"has,comma"\r\n"say ""hi""","line\nbreak"');
  });
});

describe("normalizeDate & detectDateFormat", () => {
  it("accepts ISO and common Indian formats", () => {
    expect(normalizeDate("2026-08-11")).toBe("2026-08-11");
    expect(normalizeDate("11/08/2026")).toBe("2026-08-11"); // DD/MM
    expect(normalizeDate("11-08-2026")).toBe("2026-08-11");
    expect(normalizeDate("31/12/25")).toBe("2025-12-31");
  });
  it("honors explicit format hints", () => {
    expect(normalizeDate("08/01/2026", "MM/DD/YYYY")).toBe("2026-08-01");
    expect(normalizeDate("01/08/2026", "DD/MM/YYYY")).toBe("2026-08-01");
  });
  it("detects MM/DD/YYYY across file column samples", () => {
    const dates = ["08/01/2026", "08/02/2026", "08/14/2026"];
    const fmt = detectDateFormat(dates);
    expect(fmt).toBe("MM/DD/YYYY");
  });
  it("detects DD/MM/YYYY across file column samples", () => {
    const dates = ["01/08/2026", "02/08/2026", "14/08/2026"];
    const fmt = detectDateFormat(dates);
    expect(fmt).toBe("DD/MM/YYYY");
  });
  it("rejects impossible dates", () => {
    expect(normalizeDate("2026-02-30")).toBeNull();
    expect(normalizeDate("not a date")).toBeNull();
    expect(normalizeDate("")).toBeNull();
  });
});

describe("validateImportRows", () => {
  const mapping = {
    date: "Txn Date",
    description: "Details",
    amount: "Amount",
    type: "Type",
  };

  it("parses valid rows and infers type from sign", () => {
    const rows = [
      { "Txn Date": "2026-08-01", Details: "Swiggy", Amount: "-450", Type: "" },
      { "Txn Date": "2026-08-01", Details: "Salary", Amount: "65000", Type: "" },
    ];
    const result = validateImportRows(rows, mapping);
    expect(result.valid).toHaveLength(2);
    expect(result.valid[0].type).toBe("expense");
    expect(result.valid[0].amount).toBe(toPaise(450));
    expect(result.valid[1].type).toBe("income");
  });

  it("honors an explicit type column (debit/credit)", () => {
    const rows = [
      { "Txn Date": "2026-08-01", Details: "ATM", Amount: "500", Type: "debit" },
      { "Txn Date": "2026-08-02", Details: "Refund", Amount: "200", Type: "credit" },
    ];
    const result = validateImportRows(rows, mapping);
    expect(result.valid[0].type).toBe("expense");
    expect(result.valid[1].type).toBe("income");
  });

  it("collects invalid rows with reasons", () => {
    const rows = [
      { "Txn Date": "garbage", Details: "", Amount: "abc", Type: "" },
      { "Txn Date": "2026-08-01", Details: "ok", Amount: "0", Type: "" },
    ];
    const result = validateImportRows(rows, mapping);
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(2);
    expect(result.invalid[0].errors.length).toBeGreaterThanOrEqual(2);
  });

  it("flags all rows invalid when required columns are unmapped", () => {
    const result = validateImportRows([{ a: "1" }], { amount: "a" });
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(1);
  });

  it("rejects rows instead of silently guessing income when the file has no type column and no negative amounts", () => {
    const noTypeMapping = { date: "Txn Date", description: "Details", amount: "Amount" };
    const rows = [
      { "Txn Date": "2026-08-01", Details: "Swiggy", Amount: "450" },
      { "Txn Date": "2026-08-02", Details: "Zomato", Amount: "300" },
    ];
    const result = validateImportRows(rows, noTypeMapping);
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(2);
    expect(result.invalid[0].errors.join(" ")).toMatch(/Type|Debit-Credit/);
  });

  it("still infers type from sign when some amounts are negative, even with no type column", () => {
    const noTypeMapping = { date: "Txn Date", description: "Details", amount: "Amount" };
    const rows = [
      { "Txn Date": "2026-08-01", Details: "Swiggy", Amount: "-450" },
      { "Txn Date": "2026-08-01", Details: "Salary", Amount: "65000" },
    ];
    const result = validateImportRows(rows, noTypeMapping);
    expect(result.valid).toHaveLength(2);
    expect(result.valid[0].type).toBe("expense");
    expect(result.valid[1].type).toBe("income");
  });
});

describe("dedupeKey", () => {
  it("matches identical transactions regardless of case/whitespace", () => {
    const a = dedupeKey({ date: "2026-08-01", amount: 45000, description: "Swiggy ", type: "expense" });
    const b = dedupeKey({ date: "2026-08-01", amount: 45000, description: "swiggy", type: "expense" });
    expect(a).toBe(b);
  });
  it("differs when amount or date differ", () => {
    const a = dedupeKey({ date: "2026-08-01", amount: 45000, description: "x", type: "expense" });
    const b = dedupeKey({ date: "2026-08-02", amount: 45000, description: "x", type: "expense" });
    expect(a).not.toBe(b);
  });
});
