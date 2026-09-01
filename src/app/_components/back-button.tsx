"use client";

import { ArrowLeft } from "lucide-react";

export function BackButton() {
  return (
    <button
      onClick={() => history.back()}
      className="flex h-[41px] items-center justify-center gap-2 rounded-none border border-border bg-surface px-5 text-body-sm font-bold text-fg shadow-stamp transition-all hover:bg-surface-2 hover:-translate-x-px hover:-translate-y-px hover:shadow-stamp-lg active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
      Go back
    </button>
  );
}
