"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Point = { date: string; meta: number; website: number; manual: number };

const chartConfig = {
  meta: { label: "Meta reklamları", color: "var(--chart-1)" },
  website: { label: "Web sitesi", color: "var(--chart-3)" },
  manual: { label: "Elle girilen", color: "var(--chart-2)" },
} satisfies ChartConfig;

const RANGES = [
  { v: "90", label: "Son 3 ay" },
  { v: "30", label: "Son 30 gün" },
  { v: "7", label: "Son 7 gün" },
];

const fmtDay = (ymd: string, opts: Intl.DateTimeFormatOptions) => new Date(`${ymd}T12:00:00+03:00`).toLocaleDateString("tr-TR", opts);

export function LeadTrendChart({ data }: { data: Point[] }) {
  const isMobile = useIsMobile();
  const [range, setRange] = React.useState("90");

  React.useEffect(() => {
    if (isMobile) setRange("30");
  }, [isMobile]);

  const shown = data.slice(-Number(range));
  const total = shown.reduce((a, p) => a + p.meta + p.website + p.manual, 0);
  const label = RANGES.find((r) => r.v === range)!.label.toLocaleLowerCase("tr");

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Gelen leadler</CardTitle>
        <CardDescription>
          {label} içinde {total} talep
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={(v) => v && setRange(v)}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            {RANGES.map((r) => (
              <ToggleGroupItem key={r.v} value={r.v}>
                {r.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="flex w-36 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden" size="sm" aria-label="Dönem">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {RANGES.map((r) => (
                <SelectItem key={r.v} value={r.v} className="rounded-lg">
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={shown}>
            <defs>
              {(Object.keys(chartConfig) as (keyof typeof chartConfig)[]).map((k) => (
                <linearGradient key={k} id={`fill-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={`var(--color-${k})`} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={`var(--color-${k})`} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(v: string) => fmtDay(v, { day: "numeric", month: "short" })}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent labelFormatter={(v) => fmtDay(String(v), { day: "numeric", month: "long", weekday: "short" })} indicator="dot" />}
            />
            <Area dataKey="manual" type="monotone" fill="url(#fill-manual)" stroke="var(--color-manual)" stackId="a" />
            <Area dataKey="website" type="monotone" fill="url(#fill-website)" stroke="var(--color-website)" stackId="a" />
            <Area dataKey="meta" type="monotone" fill="url(#fill-meta)" stroke="var(--color-meta)" stackId="a" />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
