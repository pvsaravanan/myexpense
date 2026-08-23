"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    // Recovery link lands on the callback (which establishes the session) then
    // continues to /reset to set a new password.
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset`,
    });
    if (error) {
      setFormError(error.message);
      setLoading(false);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-fg">Check your email</h2>
        <p className="mt-2 text-sm text-muted">
          If an account exists for <span className="font-medium text-fg">{email}</span>, we&apos;ve sent a link
          to reset your password.
        </p>
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/login" className="font-medium text-brand-hover hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight text-fg">Reset your password</h2>
      <p className="mt-1 text-sm text-muted">Enter your email and we&apos;ll send you a reset link.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {formError && (
          <div className="rounded-none border border-expense/30 bg-expense/10 px-3 py-2 text-sm text-expense">
            {formError}
          </div>
        )}
        <Field label="Email" htmlFor="email" required>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Button type="submit" size="lg" loading={loading} className="w-full">
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-brand-hover hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
