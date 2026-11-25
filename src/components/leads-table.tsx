"use client";

import { createColumnHelper } from "@tanstack/react-table";
import type { listLeads } from "@/lib/queries";
import { NameCell, ProductChip, StageChip } from "@/components/chips";
import { ConvertButton } from "@/components/convert-button";
import { DataTable, type Feats, SortHeader } from "@/components/data-table";
import { sourceLabel } from "@/lib/constants";
import { ago, fmtDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

type Lead = Awaited<ReturnType<typeof listLeads>>[number];
const h = createColumnHelper<Feats, Lead>();
const ts = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : 0);

export function LeadsTable({ rows, now, toolbar }: { rows: Lead[]; now: number; toolbar?: React.ReactNode }) {
  const nowD = new Date(now);
  const columns = h.columns([
    h.accessor((c) => c.fullName.toLocaleLowerCase("tr"), {
      id: "name",
      header: ({ column }) => <SortHeader column={column} label="Lead" />,
      cell: ({ row: { original: c } }) => (
        <div className="min-w-52 whitespace-normal">
          <NameCell c={c} href={`/kisiler/${c.id}`} sub={<div className="text-xs text-muted-foreground">{ago(c.lastAt ?? c.createdAt, nowD)}</div>} />
        </div>
      ),
      enableHiding: false,
    }),
    h.accessor((c) => c.phone, {
      id: "contact",
      header: "Telefon / e-posta",
      enableSorting: false,
      cell: ({ row: { original: c } }) => (
        <>
          <div className="tabular-nums">{formatPhone(c.phone)}</div>
          {c.email && <div className="max-w-48 truncate text-xs text-muted-foreground">{c.email}</div>}
        </>
      ),
    }),
    h.accessor((c) => (c.sources ?? []).map(sourceLabel).join(", "), {
      id: "sources",
      header: ({ column }) => <SortHeader column={column} label="Kanal" />,
      cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() || "—"}</span>,
    }),
    h.accessor((c) => (c.products ?? []).join(","), {
      id: "products",
      header: "İlgilendiği poliçeler",
      enableSorting: false,
      cell: ({ row: { original: c } }) => (
        <div className="flex max-w-64 flex-wrap gap-1">
          {(c.products ?? []).map((p) => (
            <ProductChip key={p} code={p} />
          ))}
        </div>
      ),
    }),
    h.accessor((c) => c.stage ?? "", {
      id: "stage",
      header: ({ column }) => <SortHeader column={column} label="Durum" />,
      cell: ({ row: { original: c } }) => (c.stage ? <StageChip code={c.stage} /> : "—"),
    }),
    h.accessor((c) => ts(c.nextAlarmAt) || Number.MAX_SAFE_INTEGER, {
      id: "alarm",
      header: ({ column }) => <SortHeader column={column} label="Alarm" />,
      cell: ({ row: { original: c } }) => (
        <span className={cn("text-xs", c.nextAlarmAt && ts(c.nextAlarmAt) < now ? "font-semibold text-brand" : "text-muted-foreground")}>
          {c.nextAlarmAt ? `⏰ ${fmtDateTime(c.nextAlarmAt)}` : "—"}
        </span>
      ),
    }),
    h.accessor((c) => ts(c.lastAt ?? c.createdAt), {
      id: "last",
      header: ({ column }) => <SortHeader column={column} label="Son talep" />,
      cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{fmtDateTime(new Date(getValue()))}</span>,
    }),
    h.display({
      id: "actions",
      header: () => <span className="sr-only">İşlem</span>,
      cell: ({ row: { original: c } }) => (
        <div className="text-right">
          <ConvertButton contactId={c.id} name={c.fullName} defaultProduct={c.products?.[0]} size="sm" />
        </div>
      ),
      enableHiding: false,
    }),
  ]);

  return (
    <DataTable
      data={rows}
      columns={columns}
      getRowId={(c) => c.id}
      labels={{ contact: "Telefon / e-posta", sources: "Kanal", products: "Poliçeler", stage: "Durum", alarm: "Alarm", last: "Son talep" }}
      initialHidden={["last"]}
      empty="Lead bulunamadı."
      toolbar={toolbar}
      minWidth={900}
    />
  );
}
