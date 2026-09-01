import Link from "next/link";
import { Logo } from "@/components/logo";
import { Home } from "lucide-react";
import { BackButton } from "./_components/back-button";

export const metadata = {
  title: "Page not found — baaki",
};

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg px-6">
      {/* Subtle background orbs — ink-wash in light, ember in dark */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -right-20 h-[24rem] w-[24rem] rounded-full border-2 border-border opacity-[0.04]" />
        <div className="absolute -bottom-24 -left-24 h-[28rem] w-[28rem] rounded-full border-2 border-border opacity-[0.03]" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border opacity-[0.05]" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Ghosted 404 with brand stamp shadow */}
        <div className="relative">
          <span className="block text-[7rem] font-extrabold leading-none tracking-tighter text-fg opacity-[0.06] sm:text-[9rem]">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-display font-extrabold tracking-tighter text-fg">404</span>
          </div>
        </div>

        {/* Brand coral divider */}
        <div className="mt-8 h-1 w-14 bg-brand shadow-stamp-sm" />

        <p className="mt-6 text-headline-sm font-bold uppercase tracking-wide text-fg">
          Page not found
        </p>
        <p className="mt-3 max-w-sm text-body-sm text-muted">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        {/* Action buttons */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="flex h-[41px] items-center justify-center gap-2 rounded-none border border-border bg-brand px-6 text-body-sm font-bold text-brand-fg shadow-stamp transition-all hover:bg-brand-hover hover:-translate-x-px hover:-translate-y-px hover:shadow-stamp-lg active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          >
            <Home className="h-4 w-4" strokeWidth={2.5} />
            Dashboard
          </Link>
          <BackButton />
        </div>

        {/* Brand mark */}
        <div className="mt-20 flex items-center gap-2 text-faint">
          <Logo size="h-5 w-5" />
          <span className="text-label-sm">baaki</span>
        </div>
      </div>
    </div>
  );
}
