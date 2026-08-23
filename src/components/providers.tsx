"use client";
import { ThemeProvider, type Theme } from "./theme-provider";
import { ToastProvider } from "./ui/toast";
import { ConfirmProvider } from "./ui/confirm";

export function Providers({ children, theme }: { children: React.ReactNode; theme?: Theme }) {
  return (
    <ThemeProvider initialTheme={theme}>
      <ToastProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
