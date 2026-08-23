import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo className="mb-8" />
      <p className="text-5xl font-semibold tracking-tight text-fg">404</p>
      <p className="mt-2 text-sm text-muted">We couldn&apos;t find that page.</p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-none bg-brand px-4 py-2 text-sm font-semibold text-brand-fg transition-colors hover:bg-brand/90"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
