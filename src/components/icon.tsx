import {
  AlertTriangle, ArrowDownRight, ArrowLeftRight, ArrowUpRight, Banknote, Briefcase,
  Building2, Calendar, Car, CircleDot, Clapperboard, CreditCard, Flame, Gauge,
  GraduationCap, Heart, HeartPulse, Home, Landmark, LayoutDashboard, PiggyBank,
  PieChart, Plane, Plus, PlusCircle, Receipt, Repeat, Settings, ShoppingBag,
  ShoppingBasket, Smartphone, Tag, Target, TrendingDown, TrendingUp, User, Users,
  Utensils, Wallet, Wifi, type LucideIcon,
} from "lucide-react";

/** Named icon registry used by categories, accounts, insights and nav. */
const ICONS: Record<string, LucideIcon> = {
  home: Home,
  utensils: Utensils,
  "shopping-basket": ShoppingBasket,
  car: Car,
  "graduation-cap": GraduationCap,
  "heart-pulse": HeartPulse,
  heart: Heart,
  clapperboard: Clapperboard,
  "shopping-bag": ShoppingBag,
  repeat: Repeat,
  receipt: Receipt,
  plane: Plane,
  user: User,
  users: Users,
  landmark: Landmark,
  wallet: Wallet,
  briefcase: Briefcase,
  "trending-up": TrendingUp,
  "trending-down": TrendingDown,
  "plus-circle": PlusCircle,
  "circle-dot": CircleDot,
  tag: Tag,
  target: Target,
  "credit-card": CreditCard,
  banknote: Banknote,
  building: Building2,
  smartphone: Smartphone,
  wifi: Wifi,
  "piggy-bank": PiggyBank,
  // insight + ui icons
  "pie-chart": PieChart,
  "arrow-up-right": ArrowUpRight,
  "arrow-down-right": ArrowDownRight,
  "arrow-left-right": ArrowLeftRight,
  flame: Flame,
  gauge: Gauge,
  "alert-triangle": AlertTriangle,
  calendar: Calendar,
  dashboard: LayoutDashboard,
  settings: Settings,
  plus: Plus,
};

export function Icon({
  name,
  className,
  size,
  strokeWidth = 2,
}: {
  name: string;
  className?: string;
  size?: number;
  strokeWidth?: number;
}) {
  const Cmp = ICONS[name] ?? Tag;
  return <Cmp className={className} size={size} strokeWidth={strokeWidth} aria-hidden />;
}

export const ICON_NAMES = Object.keys(ICONS);
