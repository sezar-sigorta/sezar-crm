import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** dashboard-01 "section cards" grid. */
export function StatGrid({ children }: { children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  sub,
  foot,
  delta,
  alert,
}: {
  label: string;
  value: number | string;
  sub: string;
  foot: string;
  delta?: number | null;
  alert?: boolean;
}) {
  const up = (delta ?? 0) >= 0;
  const Icon = up ? TrendingUpIcon : TrendingDownIcon;
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{value}</CardTitle>
        {delta != null && (
          <CardAction>
            <Badge variant="outline">
              <Icon />
              {up ? "+" : ""}
              {delta}%
            </Badge>
          </CardAction>
        )}
        {alert && (
          <CardAction>
            <Badge variant="outline" className="border-brand/30 text-brand">
              Gecikme
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className={cn("line-clamp-1 flex gap-2 font-medium", alert && "text-brand")}>
          {foot}
          {delta != null && <Icon className="size-4" />}
        </div>
        <div className="text-muted-foreground">{sub}</div>
      </CardFooter>
    </Card>
  );
}
