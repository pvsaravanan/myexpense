import type { Metadata, Viewport } from "next";
import { Roboto_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { themeScript } from "@/components/theme-provider";

/**
 * Run the server functions in Singapore, next to the Supabase database
 * (ap-southeast-1). Each page render makes several server->DB round trips but
 * only one browser->server trip, so co-locating compute with the DB removes the
 * cross-region latency that dominated page loads. Set at the root so it is
 * inherited by every page and API route handler. Only affects Vercel.
 */
export const preferredRegion = "sin1";

/**
 * Roboto Mono is the whole system typeface. Self-hosted by next/font at build
 * time — no external request at runtime. Variable weight covers 400–800.
 */
const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "baaki — Know where your money goes",
  description:
    "A personal finance and expense tracker: record transactions, track budgets, savings and goals, and understand where your money goes.",
  applicationName: "baaki",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1319" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={robotoMono.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-bg font-mono text-fg antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
