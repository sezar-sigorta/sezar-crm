import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Card with a bordered title row and a flush body (lists, tables). */
export function SectionCard({
  title,
  sub,
  action,
  className,
  bodyClassName,
  children,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
      <CardHeader className="border-b px-5 py-3.5 [.border-b]:pb-3.5">
        <CardTitle className="flex flex-wrap items-baseline gap-x-2 font-display text-base font-semibold">
          {title}
          {sub && <span className="text-xs font-normal text-muted-foreground">{sub}</span>}
        </CardTitle>
        {action && <CardAction className="self-center">{action}</CardAction>}
      </CardHeader>
      <CardContent className={cn("px-0", bodyClassName)}>{children}</CardContent>
    </Card>
  );
}

export function EmptyText({ text }: { text: string }) {
  return <p className="px-5 py-8 text-center text-sm text-muted-foreground">{text}</p>;
}
