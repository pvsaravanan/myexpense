"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    if (form.password.length < 8) {
      setErrors({ password: "Use at least 8 characters" });
      return;
    }
    if (form.password !== form.confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { name: form.name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setFormError(error.message);
      setLoading(false);
      return;
    }
    // Email confirmation on → no session yet; tell them to confirm.
    if (!data.session) {
      setCheckEmail(true);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function signUpWithGoogle() {
    setGoogleLoading(true);
    setFormError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setFormError(error.message);
      setGoogleLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-fg">Confirm your email</h2>
        <p className="mt-2 text-sm text-muted">
          We&apos;ve sent a confirmation link to <span className="font-medium text-fg">{form.email}</span>. Click
          it to activate your account, then sign in.
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
      <h2 className="text-xl font-semibold tracking-tight text-fg">Create your account</h2>
      <p className="mt-1 text-sm text-muted">Start tracking your money in seconds. It&apos;s free.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {formError && (
          <div className="rounded-none border border-expense/30 bg-expense/10 px-3 py-2 text-sm text-expense">
            {formError}
          </div>
        )}
        <Field label="Name" htmlFor="name" error={errors.name} required>
          <Input id="name" autoComplete="name" value={form.name} onChange={set("name")} placeholder="Priya Sharma" />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email} required>
          <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} placeholder="you@example.com" />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password} hint="At least 8 characters." required>
          <Input id="password" type="password" autoComplete="new-password" value={form.password} invalid={!!errors.password} onChange={set("password")} placeholder="••••••••" />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword} required>
          <Input id="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} invalid={!!errors.confirmPassword} onChange={set("confirmPassword")} placeholder="••••••••" />
        </Field>
        <Button type="submit" size="lg" loading={loading} className="w-full">
          Create account
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-label-sm uppercase text-faint">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button type="button" variant="outline" size="lg" className="w-full" loading={googleLoading} onClick={signUpWithGoogle}>
        Continue with Google
      </Button>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-hover hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
