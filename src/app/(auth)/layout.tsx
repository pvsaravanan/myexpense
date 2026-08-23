import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Editorial masthead — parchment, ink rules, pixel grid, coral accent */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface-2 p-xl lg:flex">
        <div
          className="absolute inset-0 opacity-[0.07]"
          aria-hidden
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--fg)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--fg)) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />
        <div className="relative flex items-center justify-between">
          <Logo />
          <span className="border border-border px-2 py-0.5 text-label-sm uppercase text-muted">
            Est. 2026
          </span>
        </div>

        <div className="relative space-y-md">
          <p className="text-label-md uppercase text-brand-hover">Personal finance, plainly</p>
          <h1 className="max-w-md text-display text-fg">
            Know where
            <br />
            your money
            <br />
            goes<span className="text-brand-hover">.</span>
          </h1>
          <p className="max-w-sm border-l-2 border-brand pl-4 text-body-md text-muted">
            Record a transaction in seconds. Track budgets, savings and goals. Turn raw spending
            into answers you can act on.
          </p>
          <ul className="max-w-sm divide-y divide-border-faint border-y border-border-faint">
            {[
              "Automatic categorization, no AI required",
              "Budgets, goals and recurring payments",
              "Your data, exportable any time",
            ].map((item) => (
              <li key={item} className="flex items-baseline gap-3 py-2.5 text-body-sm text-fg">
                <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 self-start bg-brand" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-label-sm uppercase text-faint">
          Your financial data stays private to your account.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-xl">
        <div className="w-full max-w-sm">
          <div className="mb-lg lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

