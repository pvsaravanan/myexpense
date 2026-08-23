"use client";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-none bg-expense/10 text-expense">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-fg">Something went wrong</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">
        We hit an unexpected error loading this page. Your data is safe — try again.
      </p>
      <div className="mt-5 flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="secondary" onClick={() => (window.location.href = "/dashboard")}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
