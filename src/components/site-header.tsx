"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useCrumbs } from "./header-crumbs";

const TITLES: Record<string, string> = {
  "": "Pano",
  talepler: "Lead Merkezi",
  leadler: "Leadler",
  musteriler: "Müşteriler",
  raporlar: "Raporlar",
  entegrasyonlar: "Entegrasyonlar",
};

function crumbs(path: string): { label: string; href?: string }[] {
  const [first, second] = path.split("/").filter(Boolean);
  if (first === "kisiler") return second === "yeni" ? [{ label: "Yeni kişi" }] : [{ label: "Kişi profili" }];
  return [{ label: TITLES[first ?? ""] ?? "Sezar CRM" }];
}

export function SiteHeader() {
  const path = usePathname();
  const override = useCrumbs();
  const items = override ?? crumbs(path);
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {items.map((c, i) => (
              <span key={`${i}-${c.label}`} className="contents">
                {i > 0 && <BreadcrumbSeparator className="hidden sm:block" />}
                <BreadcrumbItem className={cn(i < items.length - 1 && "hidden sm:inline-flex")}>
                  {c.href ? (
                    <BreadcrumbLink asChild>
                      <Link href={c.href}>{c.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="max-w-[50vw] truncate font-medium">{c.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </span>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
