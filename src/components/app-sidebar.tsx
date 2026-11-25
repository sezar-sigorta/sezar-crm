"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartColumnIcon,
  ChevronDownIcon,
  CirclePlusIcon,
  EllipsisVerticalIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  PlugIcon,
  SquareKanbanIcon,
  UserRoundCheckIcon,
  UserRoundPlusIcon,
} from "lucide-react";
import { logout } from "@/app/login/actions";
import { initials } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
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
  useSidebar,
} from "@/components/ui/sidebar";

const WORK = [
  { href: "/", label: "Pano", icon: LayoutDashboardIcon },
  { href: "/talepler", label: "Lead Merkezi", icon: SquareKanbanIcon },
  { href: "/leadler", label: "Leadler", icon: UserRoundPlusIcon },
  { href: "/musteriler", label: "Müşteriler", icon: UserRoundCheckIcon },
];
const INSIGHT = [
  { href: "/raporlar", label: "Raporlar", icon: ChartColumnIcon },
  { href: "/entegrasyonlar", label: "Entegrasyonlar", icon: PlugIcon },
];

export function AppSidebar({ userName, role, newCount, ...props }: { userName: string; role: string; newCount: number } & React.ComponentProps<typeof Sidebar>) {
  const path = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const close = () => setOpenMobile(false);

  const item = (n: (typeof WORK)[number]) => (
    <SidebarMenuItem key={n.href}>
      <SidebarMenuButton asChild isActive={active(n.href)} tooltip={n.label}>
        <Link href={n.href} onClick={close}>
          <n.icon />
          <span>{n.label}</span>
        </Link>
      </SidebarMenuButton>
      {n.href === "/talepler" && newCount > 0 && <SidebarMenuBadge className="rounded-full bg-brand text-white peer-hover/menu-button:text-white peer-data-active/menu-button:text-white">{newCount}</SidebarMenuBadge>}
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:p-1.5!">
              <Link href="/" onClick={close}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon.svg" alt="" className="size-5! rounded" />
                <span className="text-base font-semibold">Sezar CRM</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      tooltip="Hızlı ekle"
                      className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground data-[state=open]:bg-primary/90 data-[state=open]:text-primary-foreground"
                    >
                      <CirclePlusIcon />
                      <span>Hızlı ekle</span>
                      <ChevronDownIcon className="ml-auto" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-48" align="start">
                    <DropdownMenuItem asChild>
                      <Link href="/kisiler/yeni" onClick={close}>
                        <UserRoundPlusIcon />
                        Yeni lead
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/kisiler/yeni?tur=musteri" onClick={close}>
                        <UserRoundCheckIcon />
                        Yeni müşteri
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarMenu aria-label="Ana menü">{WORK.map(item)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Analiz</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{INSIGHT.map(item)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">{initials(userName)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{userName}</span>
                    <span className="truncate text-xs text-muted-foreground">{role === "admin" ? "Yönetici" : "Temsilci"}</span>
                  </div>
                  <EllipsisVerticalIcon className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg" side={isMobile ? "bottom" : "right"} align="end" sideOffset={4}>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">{initials(userName)}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{userName}</span>
                      <span className="truncate text-xs text-muted-foreground">{role === "admin" ? "Yönetici" : "Temsilci"}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <form action={logout}>
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full">
                      <LogOutIcon />
                      Çıkış yap
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
