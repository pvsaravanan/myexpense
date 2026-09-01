"use client";
import { AppDataProvider, type AppData } from "./app-data";
import { TransactionModalProvider } from "./add-transaction";
import { SidebarProvider } from "./sidebar-context";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { BottomNav } from "./bottom-nav";
import { RunDueRecurring } from "./run-due-recurring";
import { PageTransition } from "./page-transition";

export function AppShell({
  data,
  children,
}: {
  data: Omit<AppData, "refresh">;
  children: React.ReactNode;
}) {
  return (
    <AppDataProvider value={data}>
      <TransactionModalProvider>
        <SidebarProvider>
          <RunDueRecurring />
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <Topbar />
              <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-24 pt-5 sm:px-6 md:pb-8 lg:px-8">
                <div className="mx-auto w-full min-w-0 max-w-6xl">
                  <PageTransition>{children}</PageTransition>
                </div>
              </main>
            </div>
          </div>
          <BottomNav />
        </SidebarProvider>
      </TransactionModalProvider>
    </AppDataProvider>
  );
}
