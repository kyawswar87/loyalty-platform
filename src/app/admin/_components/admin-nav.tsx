"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, KeyRound, Users } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const ITEMS = [
  { href: "/admin", label: "Analytics", icon: BarChart3 },
  { href: "/admin/staff", label: "Staff", icon: Users },
  { href: "/admin/api-keys", label: "API keys", icon: KeyRound },
];

/** Admin sidebar navigation with active-route highlighting. */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {ITEMS.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
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
