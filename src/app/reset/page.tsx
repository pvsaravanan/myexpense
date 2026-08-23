"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/client";

/**
 * Standalone (outside the (auth) group, whose layout would redirect an
 * authenticated recovery session away). The reset link goes through
 * /auth/callback, which establishes a recovery session before landing here.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user);
      setReady(true);
    });
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    if (password.length < 8) {
      setErrors({ password: "Use at least 8 characters" });
      return;
    }
    if (password !== confirm) {
      setErrors({ confirm: "Passwords do not match" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setFormError(error.message);
      setLoading(false);
      return;
    }
    setDone(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-lg">
          <Logo />
        </div>

        {!ready ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : done ? (
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-fg">Password updated</h2>
            <p className="mt-2 text-sm text-muted">Your password has been changed. You&apos;re all set.</p>
            <Button size="lg" className="mt-6 w-full" onClick={() => { router.push("/dashboard"); router.refresh(); }}>
              Go to dashboard
            </Button>
          </div>
        ) : !hasSession ? (
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-fg">Link expired</h2>
            <p className="mt-2 text-sm text-muted">This reset link is invalid or has expired. Request a new one.</p>
            <p className="mt-6 text-center text-sm text-muted">
              <Link href="/forgot" className="font-medium text-brand-hover hover:underline">Request a new link</Link>
            </p>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-fg">Choose a new password</h2>
            <p className="mt-1 text-sm text-muted">Enter a new password for your account.</p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
              {formError && (
                <div className="rounded-none border border-expense/30 bg-expense/10 px-3 py-2 text-sm text-expense">{formError}</div>
              )}
              <Field label="New password" htmlFor="password" error={errors.password} hint="At least 8 characters." required>
                <Input id="password" type="password" autoComplete="new-password" value={password} invalid={!!errors.password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </Field>
              <Field label="Confirm new password" htmlFor="confirm" error={errors.confirm} required>
                <Input id="confirm" type="password" autoComplete="new-password" value={confirm} invalid={!!errors.confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
              </Field>
              <Button type="submit" size="lg" loading={loading} className="w-full">Update password</Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
