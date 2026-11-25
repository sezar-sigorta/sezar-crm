"use client";

import { createColumnHelper } from "@tanstack/react-table";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ProductChip } from "@/components/chips";
import { DataTable, type Feats, SortHeader } from "@/components/data-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ReportRow = {
  id: string;
  name: string | null;
  missing: string;
  href: string;
  meta: string;
  products: string[];
  total: number;
  reached: number;
  won: number;
  avgFirstResponseMin: number | null;
  waiting: number;
  lost: number;
  topLostReason: string | null;
};

const h = createColumnHelper<Feats, ReportRow>();

const chartConfig = {
  total: { label: "Talep", color: "var(--chart-5)" },
  reached: { label: "Ulaşılan", color: "var(--chart-3)" },
  won: { label: "Kazanılan", color: "var(--chart-1)" },
} satisfies ChartConfig;

function fmtMinutes(m: number) {
  if (m < 60) return `${Math.round(m)} dk`;
  if (m < 1440) return `${(m / 60).toFixed(1)} sa`;
  return `${(m / 1440).toFixed(1)} gün`;
}

export function ReportsView({ rows, col, minSample }: { rows: ReportRow[]; col: string; minSample: number }) {
  const maxRate = Math.max(0.0001, ...rows.map((r) => (r.total ? r.won / r.total : 0)));
  const top = [...rows]
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .map((r) => ({ name: r.name ?? r.missing, total: r.total, reached: r.reached, won: r.won }));
  const lc = col.toLocaleLowerCase("tr");

  const columns = h.columns([
    h.accessor((r) => (r.name ?? r.missing).toLocaleLowerCase("tr"), {
      id: "name",
      header: ({ column }) => <SortHeader column={column} label={col} />,
      cell: ({ row: { original: r } }) => (
        <div className="min-w-60 whitespace-normal">
          <Link href={r.href} className="font-medium hover:underline">
            {r.name ?? <span className="text-muted-foreground">{r.missing}</span>}
          </Link>
          <div className="text-xs text-muted-foreground">{r.meta}</div>
        </div>
      ),
      enableHiding: false,
    }),
    h.accessor((r) => r.products.join(","), {
      id: "products",
      header: "Ürün",
      enableSorting: false,
      cell: ({ row: { original: r } }) => (
        <div className="flex max-w-56 flex-wrap gap-1">
          {r.products.slice(0, 3).map((p) => (
            <ProductChip key={p} code={p} />
          ))}
          {r.products.length > 3 && <span className="text-xs text-muted-foreground">+{r.products.length - 3}</span>}
        </div>
      ),
    }),
    h.accessor("total", { header: ({ column }) => <SortHeader column={column} label="Talep" />, cell: ({ getValue }) => <span className="font-medium tabular-nums">{getValue()}</span> }),
    h.accessor("reached", { header: ({ column }) => <SortHeader column={column} label="Ulaşılan" />, cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span> }),
    h.accessor("won", { header: ({ column }) => <SortHeader column={column} label="Kazanılan" />, cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span> }),
    h.accessor((r) => (r.total ? r.won / r.total : 0), {
      id: "rate",
      header: ({ column }) => <SortHeader column={column} label="Dönüşüm" />,
      cell: ({ row: { original: r }, getValue }) => {
        const rate = getValue();
        const few = r.total < minSample;
        const bar = (
          <div className="flex w-40 items-center gap-2">
            <Progress value={(rate / maxRate) * 100} className={cn("h-1.5 flex-1", few && "opacity-40")} />
            <span className={cn("w-10 text-right text-xs tabular-nums", few ? "text-muted-foreground" : "font-medium")}>%{Math.round(rate * 100)}</span>
          </div>
        );
        return few ? (
          <Tooltip>
            <TooltipTrigger asChild>{bar}</TooltipTrigger>
            <TooltipContent>Az veri: oran henüz güvenilir değil</TooltipContent>
          </Tooltip>
        ) : (
          bar
        );
      },
    }),
    h.accessor((r) => r.avgFirstResponseMin ?? Number.MAX_SAFE_INTEGER, {
      id: "response",
      header: ({ column }) => <SortHeader column={column} label="Ort. ilk dönüş" />,
      cell: ({ row: { original: r } }) => <span className="tabular-nums">{r.avgFirstResponseMin == null ? "—" : fmtMinutes(r.avgFirstResponseMin)}</span>,
    }),
    h.accessor("waiting", {
      header: ({ column }) => <SortHeader column={column} label="Bekleyen" />,
      cell: ({ getValue }) => <span className={cn("tabular-nums", getValue() ? "font-medium text-brand" : "text-muted-foreground")}>{getValue() || "—"}</span>,
    }),
    h.accessor((r) => r.lost, {
      id: "lost",
      header: "En sık kayıp nedeni",
      enableSorting: false,
      cell: ({ row: { original: r } }) => <span className="text-xs whitespace-normal text-muted-foreground">{r.topLostReason ? `${r.topLostReason} (${r.lost} kayıp)` : "—"}</span>,
    }),
  ]);

  return (
    <>
      {top.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>En çok lead getiren {top.length} {lc}</CardTitle>
            <CardDescription>Talep, ulaşılan ve kazanılan sayıları</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
              <BarChart data={top} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} interval={0} tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)} />
                <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="total" fill="var(--color-total)" radius={4} />
                <Bar dataKey="reached" fill="var(--color-reached)" radius={4} />
                <Bar dataKey="won" fill="var(--color-won)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        labels={{ products: "Ürün", total: "Talep", reached: "Ulaşılan", won: "Kazanılan", rate: "Dönüşüm", response: "Ort. ilk dönüş", waiting: "Bekleyen", lost: "Kayıp nedeni" }}
        initialSorting={[{ id: "total", desc: true }]}
        empty="Bu dönemde talep yok."
        minWidth={1040}
        toolbar={<span className="text-sm text-muted-foreground">{rows.length} satır · tıklayınca o {lc}dan gelen talepler açılır</span>}
      />
    </>
  );
}
