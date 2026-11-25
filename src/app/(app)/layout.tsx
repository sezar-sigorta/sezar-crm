import Link from "next/link";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { countNewLeads } from "@/lib/queries";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const newCount = await countNewLeads();
  const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false";
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar userName={user.name} newCount={newCount} />
      <SidebarInset className="min-w-0">
        {/* Phone header: the sidebar opens as a sheet from here. */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 bg-navy px-3 text-cream md:hidden">
          <SidebarTrigger className="text-cream hover:bg-navy-2 hover:text-white" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="size-7 rounded-lg ring-1 ring-cream/15" />
          <span className="font-display font-semibold">Sezar CRM</span>
          {newCount > 0 && (
            <Link href="/talepler" className="rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white" aria-label={`${newCount} yeni lead`}>
              {newCount}
            </Link>
          )}
          <Button asChild size="sm" className="ml-auto bg-cream text-navy hover:bg-white">
            <Link href="/kisiler/yeni">+ Yeni</Link>
          </Button>
        </header>
        <div className="hidden h-12 items-center px-4 md:flex">
          <SidebarTrigger className="text-ink-2" />
        </div>
        <main className="min-w-0 px-4 pt-4 pb-8 md:px-8 md:pt-0">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
