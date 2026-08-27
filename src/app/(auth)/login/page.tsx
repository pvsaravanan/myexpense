"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setFormError(error.message || "Incorrect email or password");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function signInWithGoogle() {
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
    // On success the browser is redirected to Google, so no further action here.
  }

  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight text-fg">Welcome back</h2>
      <p className="mt-1 text-sm text-muted">Sign in to your baaki account.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {formError && (
          <div className="rounded-none border border-expense/30 bg-expense/10 px-3 py-2 text-sm text-expense">
            {formError}
          </div>
        )}
        <Field label="Email" htmlFor="email" required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password" htmlFor="password" required>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <div className="-mt-1 text-right">
          <Link href="/forgot" className="text-label-sm uppercase text-brand-hover hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" loading={loading} className="w-full">
          Sign in
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-label-sm uppercase text-faint">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button type="button" variant="outline" size="lg" className="w-full" loading={googleLoading} onClick={signInWithGoogle}>
        Continue with Google
      </Button>

      <p className="mt-6 text-center text-sm text-muted">
        New to baaki?{" "}
        <Link href="/register" className="font-medium text-brand-hover hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
