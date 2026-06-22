import Link from "next/link";
import { LayoutDashboard, ShieldCheck } from "lucide-react";
import { requireRole } from "@/lib/authz";
import { ChatWidget } from "@/components/chat-widget";
import { SignOutButton } from "@/components/sign-out-button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AdminNav } from "./_components/admin-nav";

/**
 * Admin shell. `requireRole("admin")` gates every `/admin/*` page (operators are
 * redirected to /dashboard) and rejects disabled accounts via the DB re-check.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("admin");

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="size-4" />
            </div>
            <span className="font-semibold group-data-[collapsible=icon]:hidden">
              Loyalty Admin
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <AdminNav />
          </SidebarGroup>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Operator dashboard"
                  render={<Link href="/dashboard" />}
                >
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="flex flex-col gap-2 p-2 group-data-[collapsible=icon]:hidden">
            <div className="text-sm">
              <div className="font-medium">{user.name}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </div>
            <SignOutButton />
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <span className="text-sm text-muted-foreground">Admin</span>
        </header>
        <main className="p-4 sm:p-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </SidebarInset>
      <ChatWidget />
    </SidebarProvider>
  );
}
