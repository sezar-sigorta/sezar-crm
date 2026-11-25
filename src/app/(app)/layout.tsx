import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { countNewLeads } from "@/lib/queries";
import { AppSidebar } from "@/components/app-sidebar";
import { CrumbsProvider } from "@/components/header-crumbs";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const newCount = await countNewLeads();
  const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false";
  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={{ "--sidebar-width": "calc(var(--spacing) * 64)", "--header-height": "calc(var(--spacing) * 12)" } as React.CSSProperties}
    >
      <AppSidebar variant="inset" userName={user.name} role={user.role} newCount={newCount} />
      <SidebarInset className="min-w-0">
        <CrumbsProvider>
          <SiteHeader />
          <main className="@container/main flex min-w-0 flex-1 flex-col gap-4 p-4 md:gap-6 lg:p-6">{children}</main>
        </CrumbsProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
