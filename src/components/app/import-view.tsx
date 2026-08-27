"use client";
import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import Link from "next/link";
import {
  Upload,
  FileText,
  Download,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Table2,
  X,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Badge, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "./app-data";
import { apiPost, ApiError } from "@/lib/http";
import { cn } from "@/lib/cn";
import type { ImportField, ColumnMapping } from "@/lib/csv";

// ---- Types mirroring the /api/import contract -----------------------------

interface InvalidRow {
  index: number;
  errors: string[];
  raw: Record<string, string>;
}

interface ImportSummary {
  total: number;
  valid: number;
  invalid: number;
  invalidRows: InvalidRow[];
  duplicates: number;
  willImport: number;
  imported?: number;
}

interface ImportResponse {
  preview: boolean;
  summary: ImportSummary;
}

// ---- Field metadata --------------------------------------------------------

interface FieldMeta {
  key: ImportField;
  label: string;
  required?: boolean;
  /** Substrings that hint a CSV header maps to this field. */
  hints: string[];
}

const FIELDS: FieldMeta[] = [
  { key: "date", label: "Date", required: true, hints: ["date", "posted", "when"] },
  { key: "description", label: "Description", required: true, hints: ["desc", "narration", "details", "particular", "memo", "merchant", "name"] },
  { key: "amount", label: "Amount", required: true, hints: ["amount", "amt", "value", "debit", "credit"] },
  { key: "type", label: "Type", hints: ["type", "dr", "cr", "direction"] },
  { key: "category", label: "Category", hints: ["categ", "tag"] },
  { key: "account", label: "Account", hints: ["account", "acct", "bank", "card"] },
  { key: "paymentMethod", label: "Payment method", hints: ["payment", "method", "mode", "channel"] },
  { key: "notes", label: "Notes", hints: ["note", "remark", "comment"] },
];

const REQUIRED_FIELDS: ImportField[] = ["date", "description", "amount"];

type Step = 1 | 2 | 3 | 4;

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Upload" },
  { n: 2, label: "Map columns" },
  { n: 3, label: "Preview" },
  { n: 4, label: "Done" },
];

// ---- Auto-guess ------------------------------------------------------------

/**
 * Score how well a header matches a field's hints. Unbounded substring matches
 * on tiny hints ("dr", "cr") produced false positives — "Address" contains
 * "dr", "Credit Limit" contains "cr" — so scoring prefers exact / whole-word
 * (token) matches and only allows a loose substring match for hints ≥4 chars.
 */
function headerScore(header: string, hints: string[]): number {
  const lower = header.toLowerCase().trim();
  const tokens = lower.split(/[^a-z0-9]+/).filter(Boolean);
  let best = 0;
  for (const hint of hints) {
    if (lower === hint) best = Math.max(best, 3);
    else if (tokens.includes(hint)) best = Math.max(best, 2);
    else if (hint.length >= 4 && lower.includes(hint)) best = Math.max(best, 1);
  }
  return best;
}

function guessMapping(headers: string[]): Record<ImportField, string> {
  const mapping = Object.fromEntries(FIELDS.map((f) => [f.key, ""])) as Record<ImportField, string>;
  const used = new Set<string>();
  // FIELDS is ordered required-first, so required fields claim their best
  // header before optional ones can take it.
  for (const field of FIELDS) {
    let bestHeader = "";
    let bestScore = 0;
    for (const h of headers) {
      if (used.has(h)) continue;
      const score = headerScore(h, field.hints);
      if (score > bestScore) {
        bestScore = score;
        bestHeader = h;
      }
    }
    if (bestScore > 0) {
      mapping[field.key] = bestHeader;
      used.add(bestHeader);
    }
  }
  return mapping;
}

function emptyMapping(): Record<ImportField, string> {
  return Object.fromEntries(FIELDS.map((f) => [f.key, ""])) as Record<ImportField, string>;
}

// ---- Component -------------------------------------------------------------

export function ImportView() {
  const { accounts, refresh } = useAppData();
  const toast = useToast();

  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState("");
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<ImportField, string>>(emptyMapping());
  const [defaultAccountId, setDefaultAccountId] = useState<string>(accounts[0]?.id ?? "");
  const [dateFormat, setDateFormat] = useState<"auto" | "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD">("auto");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const requiredMapped = REQUIRED_FIELDS.every((f) => mapping[f]);

  // ---- File handling -------------------------------------------------------

  function handleFile(file: File | undefined | null) {
    if (!file) return;
    setParseError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields ?? [];
        const rows = (results.data as Record<string, string>[]).filter((r) =>
          Object.values(r).some((v) => v != null && String(v).trim() !== ""),
        );
        if (fields.length === 0) {
          setParseError("Could not detect any columns. Make sure the file has a header row.");
          return;
        }
        if (rows.length === 0) {
          setParseError("No data rows were found in this file.");
          return;
        }
        setFileName(file.name);
        setHeaders(fields);
        setRecords(rows);
        setMapping(guessMapping(fields));
        setPreview(null);
        setResult(null);
      },
      error: (err) => setParseError(err.message || "Failed to parse the CSV file."),
    });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  function downloadSample() {
    const csv = [
      "Date,Description,Amount,Type,Category,Account",
      "2026-08-01,Salary for August,85000,income,Salary,HDFC Bank",
      "2026-08-02,Groceries at BigBasket,-2450.50,expense,Groceries,HDFC Bank",
      "2026-08-03,Coffee with team,-320,expense,Food,Cash",
      "05/08/2026,Electricity bill,-1899,expense,Bills & Utilities,HDFC Bank",
    ].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "baaki-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setStep(1);
    setFileName("");
    setRecords([]);
    setHeaders([]);
    setMapping(emptyMapping());
    setDateFormat("auto");
    setSkipDuplicates(true);
    setParseError(null);
    setPreview(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ---- API calls -----------------------------------------------------------

  function buildMapping(): ColumnMapping {
    const out: ColumnMapping = {};
    for (const f of FIELDS) {
      if (mapping[f.key]) out[f.key] = mapping[f.key];
    }
    return out;
  }

  function body(commit: boolean) {
    return {
      records,
      mapping: buildMapping(),
      commit,
      defaultAccountId: defaultAccountId || null,
      skipDuplicates,
      dateFormat,
    };
  }

  async function runPreview() {
    setPreviewing(true);
    try {
      const res = await apiPost<ImportResponse>("/api/import", body(false));
      setPreview(res.summary);
      setStep(3);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not validate the file.");
    } finally {
      setPreviewing(false);
    }
  }

  async function runImport() {
    setImporting(true);
    try {
      const res = await apiPost<ImportResponse>("/api/import", body(true));
      setResult(res.summary);
      setStep(4);
      refresh();
      toast.success(
        `Imported ${res.summary.imported ?? res.summary.willImport} transaction${
          (res.summary.imported ?? res.summary.willImport) === 1 ? "" : "s"
        }.`,
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  // ---- Render --------------------------------------------------------------

  return (
    <div className="space-y-5">
      <Stepper current={step} />

      {step === 1 && (
        <UploadStep
          fileName={fileName}
          recordCount={records.length}
          dragging={dragging}
          parseError={parseError}
          fileInputRef={fileInputRef}
          onPick={() => fileInputRef.current?.click()}
          onFile={handleFile}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onDownloadSample={downloadSample}
          onContinue={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <MapStep
          headers={headers}
          mapping={mapping}
          setMapping={setMapping}
          dateFormat={dateFormat}
          setDateFormat={setDateFormat}
          accounts={accounts}
          defaultAccountId={defaultAccountId}
          setDefaultAccountId={setDefaultAccountId}
          skipDuplicates={skipDuplicates}
          setSkipDuplicates={setSkipDuplicates}
          recordCount={records.length}
          requiredMapped={requiredMapped}
          previewing={previewing}
          onBack={() => setStep(1)}
          onPreview={runPreview}
        />
      )}

      {step === 3 && preview && (
        <PreviewStep
          summary={preview}
          records={records}
          mapping={mapping}
          importing={importing}
          onBack={() => setStep(2)}
          onImport={runImport}
        />
      )}

      {step === 4 && result && <DoneStep summary={result} onReset={reset} />}
    </div>
  );
}

// ---- Stepper ---------------------------------------------------------------

function Stepper({ current }: { current: Step }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto text-sm">
      {STEPS.map((s, i) => {
        const state = s.n < current ? "done" : s.n === current ? "active" : "todo";
        return (
          <li key={s.n} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-none text-2xs font-semibold transition-colors",
                state === "active" && "bg-brand text-brand-fg",
                state === "done" && "bg-brand-soft text-brand-hover",
                state === "todo" && "bg-surface-2 text-faint",
              )}
            >
              {state === "done" ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.n}
            </span>
            <span
              className={cn(
                "whitespace-nowrap",
                state === "todo" ? "text-faint" : "font-medium text-fg",
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border sm:w-10" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

// ---- Step 1: Upload --------------------------------------------------------

function UploadStep({
  fileName,
  recordCount,
  dragging,
  parseError,
  fileInputRef,
  onPick,
  onFile,
  onDragOver,
  onDragLeave,
  onDrop,
  onDownloadSample,
  onContinue,
}: {
  fileName: string;
  recordCount: number;
  dragging: boolean;
  parseError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onPick: () => void;
  onFile: (f: File | undefined | null) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDownloadSample: () => void;
  onContinue: () => void;
}) {
  const hasFile = recordCount > 0;
  return (
    <Card>
      <CardHeader
        title="Upload a CSV file"
        subtitle="Your file should have a header row. We'll help you map the columns next."
        action={
          <Button variant="outline" size="sm" onClick={onDownloadSample}>
            <Download className="h-4 w-4" />
            Sample CSV
          </Button>
        }
      />
      <CardBody className="space-y-4">
        <div
          role="button"
          tabIndex={0}
          onClick={onPick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onPick();
            }
          }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-none border-2 border-dashed px-6 py-12 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            dragging ? "border-brand bg-brand-soft" : "border-border bg-surface-2/50 hover:border-border-strong",
          )}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-none bg-surface-2 text-muted">
            <Upload className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-fg">
            Drag &amp; drop your CSV here, or <span className="text-brand-hover">browse</span>
          </p>
          <p className="text-xs text-muted">Only .csv files are supported</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>

        {parseError && (
          <div className="flex items-start gap-2 rounded-none border border-expense/30 bg-expense/10 px-3 py-2 text-sm text-expense">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {hasFile && (
          <div className="flex flex-wrap items-center gap-3 rounded-none border border-border bg-surface-2 px-4 py-3">
            <FileText className="h-5 w-5 text-brand-hover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{fileName}</p>
              <p className="text-xs text-muted">
                {recordCount} row{recordCount === 1 ? "" : "s"} detected
              </p>
            </div>
            <Badge tone="brand">Ready</Badge>
          </div>
        )}
      </CardBody>
      <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
        <Button onClick={onContinue} disabled={!hasFile}>
          Map columns
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

// ---- Step 2: Map columns ---------------------------------------------------

function MapStep({
  headers,
  mapping,
  setMapping,
  dateFormat,
  setDateFormat,
  accounts,
  defaultAccountId,
  setDefaultAccountId,
  skipDuplicates,
  setSkipDuplicates,
  recordCount,
  requiredMapped,
  previewing,
  onBack,
  onPreview,
}: {
  headers: string[];
  mapping: Record<ImportField, string>;
  setMapping: React.Dispatch<React.SetStateAction<Record<ImportField, string>>>;
  dateFormat: "auto" | "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  setDateFormat: (v: "auto" | "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD") => void;
  accounts: { id: string; name: string }[];
  defaultAccountId: string;
  setDefaultAccountId: (id: string) => void;
  skipDuplicates: boolean;
  setSkipDuplicates: (v: boolean) => void;
  recordCount: number;
  requiredMapped: boolean;
  previewing: boolean;
  onBack: () => void;
  onPreview: () => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Map your columns"
        subtitle={`Match your CSV headers to baaki fields. ${recordCount} row${recordCount === 1 ? "" : "s"} to import.`}
      />
      <CardBody className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label} required={f.required} htmlFor={`map-${f.key}`}>
              <Select
                id={`map-${f.key}`}
                value={mapping[f.key]}
                invalid={f.required && !mapping[f.key]}
                onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
              >
                <option value="">— Not mapped —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </Field>
          ))}
        </div>

        <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
          <Field
            label="Date format"
            htmlFor="date-format"
            hint="How dates are written in your CSV."
          >
            <Select
              id="date-format"
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value as any)}
            >
              <option value="auto">Auto-detect format</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 31/07/2026)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 07/31/2026)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-07-31)</option>
            </Select>
          </Field>

          <Field
            label="Default account"
            htmlFor="default-account"
            hint="Used when account is blank or unmapped."
          >
            {accounts.length === 0 ? (
              <p className="text-sm text-muted">No accounts yet — create one first.</p>
            ) : (
              <Select
                id="default-account"
                value={defaultAccountId}
                onChange={(e) => setDefaultAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Duplicates">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-none border border-border bg-surface px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand"
              />
              <span>
                <span className="font-medium text-fg">Skip duplicates</span>
                <span className="mt-0.5 block text-xs text-muted">
                  Skip existing transactions.
                </span>
              </span>
            </label>
          </Field>
        </div>

        {!requiredMapped && (
          <p className="text-xs text-muted">
            Map the required fields (Date, Description, Amount) to continue.
          </p>
        )}
      </CardBody>
      <div className="flex justify-between gap-2 border-t border-border px-5 py-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onPreview} disabled={!requiredMapped || previewing} loading={previewing}>
          Preview
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

// ---- Step 3: Preview -------------------------------------------------------

function PreviewStep({
  summary,
  records,
  mapping,
  importing,
  onBack,
  onImport,
}: {
  summary: ImportSummary;
  records: Record<string, string>[];
  mapping: Record<ImportField, string>;
  importing: boolean;
  onBack: () => void;
  onImport: () => void;
}) {
  const previewFields = FIELDS.filter((f) => mapping[f.key]);
  const previewRows = records.slice(0, 8);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Valid rows" value={summary.valid} tone="income" />
        <StatTile label="Invalid rows" value={summary.invalid} tone={summary.invalid ? "expense" : "muted"} />
        <StatTile label="Duplicates" value={summary.duplicates} tone={summary.duplicates ? "warning" : "muted"} />
        <StatTile label="Will import" value={summary.willImport} tone="brand" />
      </div>

      {summary.willImport === 0 && (
        <div className="flex items-start gap-2 rounded-none border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Nothing will be imported. This can happen if every row is invalid or a duplicate, or if no account
            is available to attach transactions to.
          </span>
        </div>
      )}

      {previewFields.length > 0 && (
        <Card>
          <CardHeader
            title="Preview"
            subtitle={`First ${previewRows.length} of ${records.length} row${records.length === 1 ? "" : "s"}, showing your mapped columns.`}
          />
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    {previewFields.map((f) => (
                      <th key={f.key} className="whitespace-nowrap px-4 py-2 font-medium">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {previewRows.map((row, i) => (
                    <tr key={i}>
                      {previewFields.map((f) => (
                        <td key={f.key} className="max-w-[220px] truncate px-4 py-2 text-fg">
                          {row[mapping[f.key]] || <span className="text-faint">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {summary.invalidRows.length > 0 && (
        <Card>
          <CardHeader
            title="Rows that won't import"
            subtitle="Fix these in your CSV and re-upload to include them."
            action={<Badge tone="expense">{summary.invalid}</Badge>}
          />
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="px-4 py-2 font-medium">Row</th>
                    <th className="px-4 py-2 font-medium">Problem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {summary.invalidRows.map((r) => (
                    <tr key={r.index}>
                      <td className="whitespace-nowrap px-4 py-2 tabular-nums text-muted">#{r.index + 2}</td>
                      <td className="px-4 py-2">
                        <ul className="space-y-0.5">
                          {r.errors.map((err, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-expense">
                              <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>{err}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {summary.invalid > summary.invalidRows.length && (
              <p className="border-t border-border px-4 py-2 text-xs text-muted">
                Showing {summary.invalidRows.length} of {summary.invalid} invalid rows.
              </p>
            )}
          </CardBody>
        </Card>
      )}

      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={onBack} disabled={importing}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onImport} disabled={summary.willImport === 0 || importing} loading={importing}>
          {importing
            ? "Importing…"
            : `Import ${summary.willImport} transaction${summary.willImport === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "income" | "expense" | "warning" | "brand" | "muted";
}) {
  const colors: Record<string, string> = {
    income: "text-income",
    expense: "text-expense",
    warning: "text-warning",
    brand: "text-brand-hover",
    muted: "text-faint",
  };
  return (
    <div className="rounded-none border border-border bg-surface p-4 shadow-card">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums", colors[tone])}>{value}</p>
    </div>
  );
}

// ---- Step 4: Done ----------------------------------------------------------

function DoneStep({ summary, onReset }: { summary: ImportSummary; onReset: () => void }) {
  const imported = summary.imported ?? summary.willImport;
  return (
    <Card>
      <CardBody>
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6 text-income" />}
          title={`Imported ${imported} transaction${imported === 1 ? "" : "s"}`}
          description={
            summary.duplicates > 0
              ? `${summary.duplicates} duplicate${summary.duplicates === 1 ? "" : "s"} were skipped.`
              : "Your transactions are now available in baaki."
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/transactions">
                <Button>
                  <Table2 className="h-4 w-4" />
                  View transactions
                </Button>
              </Link>
              <Button variant="outline" onClick={onReset}>
                <Upload className="h-4 w-4" />
                Import another
              </Button>
            </div>
          }
        />
      </CardBody>
    </Card>
  );
}
