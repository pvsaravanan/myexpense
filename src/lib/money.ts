/**
 * Money utilities. All monetary values are integer paise (1 rupee = 100 paise).
 * Never store or compute money as a float. Convert to rupees only for display.
 */

/** Convert a rupee value (number or string) to integer paise. */
export function toPaise(rupees: number | string): number {
  if (typeof rupees === "number" && !Number.isFinite(rupees)) {
    throw new Error(`Invalid amount: ${rupees}`);
  }
  const cleaned = String(rupees).replace(/[₹,\s]/g, "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "+") return 0;

  // Exact decimal path: parse the integer and fractional digits directly rather
  // than Math.round(n * 100). The latter can be off by a paisa for values whose
  // binary representation lands just below the .5 boundary — e.g. 1.005 * 100 is
  // 100.4999999999… and rounds DOWN to 100 instead of 101.
  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (m && (m[2] || m[3])) {
    const neg = m[1] === "-";
    const frac = m[3] ?? "";
    let paise = Number(m[2] || "0") * 100 + Number(frac.slice(0, 2).padEnd(2, "0"));
    if (frac.charCodeAt(2) - 48 >= 5) paise += 1; // round half up on the 3rd decimal
    return neg ? -paise : paise;
  }

  // Fallback for other numeric forms (e.g. exponent notation) — preserves the
  // prior acceptance behaviour for anything Number can parse.
  const n = Number(cleaned);
  if (!Number.isFinite(n)) throw new Error(`Invalid amount: ${rupees}`);
  return Math.round(n * 100);
}

/** Convert integer paise to a rupee number (may have decimals). */
export function toRupees(paise: number): number {
  return Math.round(paise) / 100;
}

/**
 * Format paise using the Indian numbering system (lakh/crore grouping).
 * e.g. 10000000 paise -> "₹1,00,000.00" (or "₹1,00,000" when whole).
 */
export function formatINR(
  paise: number,
  opts: { showSign?: boolean; decimals?: "auto" | "always" | "never"; symbol?: boolean } = {},
): string {
  const { showSign = false, decimals = "auto", symbol = true } = opts;
  const negative = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100);
  const paisePart = abs % 100;

  const grouped = groupIndian(rupees);
  let out: string;
  if (decimals === "never") {
    out = grouped;
  } else if (decimals === "always") {
    out = `${grouped}.${String(paisePart).padStart(2, "0")}`;
  } else {
    // auto: show paise only when non-zero
    out = paisePart === 0 ? grouped : `${grouped}.${String(paisePart).padStart(2, "0")}`;
  }

  const sign = negative ? "−" : showSign ? "+" : "";
  return `${sign}${symbol ? "₹" : ""}${out}`;
}

/** Group an integer using the Indian system: last 3 digits, then pairs. */
export function groupIndian(n: number): string {
  const s = String(Math.abs(Math.trunc(n)));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const withCommas = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${withCommas},${last3}`;
}

/** Compact Indian formatting for tight spaces: ₹1.2L, ₹3.4Cr, ₹9.5k. */
export function formatINRCompact(paise: number): string {
  const rupees = Math.round(paise) / 100;
  const abs = Math.abs(rupees);
  const sign = rupees < 0 ? "−" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${trim(abs / 1_00_00_000)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${trim(abs / 1_00_000)}L`;
  if (abs >= 1_000) return `${sign}₹${trim(abs / 1_000)}k`;
  return `${sign}₹${trim(abs)}`;
}

function trim(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Format a percentage with a fixed number of decimals. */
export function formatPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(decimals)}%`;
}

/** Signed percentage change with a leading + / −, used for month-over-month deltas. */
export function formatDelta(value: number | null, decimals = 1): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(decimals)}%`;
}
