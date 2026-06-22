"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gift,
  LayoutDashboard,
  Settings,
  Ticket,
  Users,
} from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/rewards", label: "Rewards", icon: Gift },
  { href: "/dashboard/redemptions", label: "Redemptions", icon: Ticket },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

/** Sidebar navigation with active-route highlighting. */
export function DashboardNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {ITEMS.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              isActive={active}
              tooltip={item.label}
              render={<Link href={item.href} />}
            >
              <item.icon />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
