import { AlertTriangle, BarChart3, ClipboardCheck, Code2, Handshake, LayoutDashboard, Settings, Target, Users, Wallet, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; short: string; icon: LucideIcon; mobile?: boolean };

export const NAV: NavItem[] = [
  { href: "/", label: "Overview", short: "Overview", icon: LayoutDashboard, mobile: true },
  { href: "/review", label: "Weekly CEO Review", short: "Review", icon: ClipboardCheck, mobile: true },
  { href: "/engineering", label: "Engineering & Products", short: "Engineering", icon: Code2 },
  { href: "/sales", label: "Sales & Contracts", short: "Sales", icon: Handshake, mobile: true },
  { href: "/customers", label: "Customers & Feedback", short: "Customers", icon: Users },
  { href: "/finance", label: "Finance", short: "Finance", icon: Wallet, mobile: true },
  { href: "/problems", label: "Problems & Lessons", short: "Problems", icon: AlertTriangle },
  { href: "/priorities", label: "Strategic Priorities", short: "Priorities", icon: Target },
  { href: "/reports", label: "Reports & Analytics", short: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", short: "Settings", icon: Settings },
];
