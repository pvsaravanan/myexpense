import {
  ArrowLeftRight, Bookmark, CalendarClock, LayoutDashboard, Lightbulb, LineChart, PieChart,
  Settings, Sparkles, Target, Upload, Users, Wallet, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", icon: PieChart },
  { href: "/people", label: "People", icon: Users },
  { href: "/recurring", label: "Recurring", icon: CalendarClock },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/trends", label: "Trends", icon: LineChart },
  { href: "/reports", label: "Reports", icon: Sparkles },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/categories", label: "Categories", icon: Bookmark },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];
