"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartColumn,
  LayoutDashboard,
  LogOut,
  Plug,
  SquareKanban,
  UserRoundCheck,
  UserRoundPlus,
} from "lucide-react";
import { logout } from "@/app/login/actions";
import { initials } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NAV = [
  { href: "/", label: "Pano", icon: LayoutDashboard },
  { href: "/talepler", label: "Lead Merkezi", icon: SquareKanban },
  { href: "/leadler", label: "Leadler", icon: UserRoundPlus },
  { href: "/musteriler", label: "Müşteriler", icon: UserRoundCheck },
  { href: "/raporlar", label: "Raporlar", icon: ChartColumn },
  { href: "/entegrasyonlar", label: "Entegrasyonlar", icon: Plug },
];

export function Sidebar({ userName, newCount }: { userName: string; newCount: number }) {
  const path = usePathname();
  const { setOpenMobile } = useSidebar();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const close = () => setOpenMobile(false);

  return (
    <SidebarRoot collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Sezar CRM">
              <Link href="/" onClick={close}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon.svg" alt="" className="size-8 shrink-0 rounded-lg ring-1 ring-cream/15" />
                <span className="font-display text-lg font-semibold text-white">Sezar CRM</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-navy-l/60">Menü</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu aria-label="Ana menü">
              {NAV.map((n) => (
                <SidebarMenuItem key={n.href}>
                  <SidebarMenuButton asChild isActive={active(n.href)} tooltip={n.label}>
                    <Link href={n.href} onClick={close} aria-current={active(n.href) ? "page" : undefined}>
                      <n.icon />
                      <span>{n.label}</span>
                    </Link>
                  </SidebarMenuButton>
                  {n.href === "/talepler" && newCount > 0 && (
                    <SidebarMenuBadge className="rounded-full bg-brand text-[11px] font-semibold text-white peer-hover/menu-button:text-white peer-data-active/menu-button:text-white">
                      {newCount}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupContent className="grid grid-cols-2 gap-2">
            <Button asChild size="sm" className="bg-cream text-navy hover:bg-white">
              <Link href="/kisiler/yeni" onClick={close}>
                + Lead
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="border-cream/40 bg-transparent text-cream hover:bg-navy-2 hover:text-white">
              <Link href="/kisiler/yeni?tur=musteri" onClick={close}>
                + Müşteri
              </Link>
            </Button>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
            <Avatar className="size-8">
              <AvatarFallback className="bg-navy-3 text-xs font-semibold text-cream">{initials(userName)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-sm text-cream group-data-[collapsible=icon]:hidden">{userName}</span>
            <form action={logout}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon-sm" variant="ghost" className="text-navy-l hover:bg-navy-2 hover:text-white" aria-label="Çıkış yap">
                    <LogOut />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Çıkış yap</TooltipContent>
              </Tooltip>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </SidebarRoot>
  );
}
