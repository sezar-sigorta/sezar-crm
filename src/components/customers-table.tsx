"use client";

import { createColumnHelper } from "@tanstack/react-table";
import type { listCustomers } from "@/lib/queries";
import { NameCell, ProductChip } from "@/components/chips";
import { DataTable, type Feats, SortHeader } from "@/components/data-table";
import { RenewalBadge } from "@/components/renewal-badge";
import { durationSince, fmtDateTime, fmtYmd } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

type Customer = Awaited<ReturnType<typeof listCustomers>>[number];
const h = createColumnHelper<Feats, Customer>();
const ts = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : 0);

export function CustomersTable({ rows, now, empty, toolbar }: { rows: Customer[]; now: number; empty: string; toolbar?: React.ReactNode }) {
  const nowD = new Date(now);
  const columns = h.columns([
    h.accessor((c) => c.fullName.toLocaleLowerCase("tr"), {
      id: "name",
      header: ({ column }) => <SortHeader column={column} label="Müşteri" />,
      cell: ({ row: { original: c } }) => (
        <div className="min-w-56 whitespace-normal">
          <NameCell c={c} href={`/kisiler/${c.id}`} sub={c.city && c.kind !== "kurumsal" ? <div className="text-xs text-muted-foreground">{c.city}</div> : null} />
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
    h.accessor((c) => -ts(c.customerSince), {
      id: "since",
      header: ({ column }) => <SortHeader column={column} label="Müşteri süresi" />,
      cell: ({ row: { original: c } }) => durationSince(c.customerSince, nowD),
    }),
    h.accessor((c) => c.activeCount ?? 0, {
      id: "products",
      header: ({ column }) => <SortHeader column={column} label="Poliçeler" />,
      cell: ({ row: { original: c } }) => (
        <div className="flex max-w-64 flex-wrap gap-1">
          {(c.products ?? []).map((p) => (
            <ProductChip key={p} code={p} />
          ))}
          {!c.activeCount && <span className="text-xs text-brand">Poliçe girilmemiş</span>}
        </div>
      ),
    }),
    h.accessor((c) => c.nextRenewal ?? "9999", {
      id: "renewal",
      header: ({ column }) => <SortHeader column={column} label="Sonraki yenileme" />,
      cell: ({ row: { original: c } }) =>
        c.nextRenewal ? (
          <div className="flex items-center gap-2">
            {fmtYmd(c.nextRenewal)} <RenewalBadge ymd={c.nextRenewal} />
          </div>
        ) : (
          "—"
        ),
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
  ]);

  return (
    <DataTable
      data={rows}
      columns={columns}
      getRowId={(c) => c.id}
      labels={{ contact: "Telefon / e-posta", since: "Müşteri süresi", products: "Poliçeler", renewal: "Sonraki yenileme", alarm: "Alarm" }}
      empty={empty}
      toolbar={toolbar}
      minWidth={860}
    />
  );
}
