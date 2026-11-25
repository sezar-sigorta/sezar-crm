import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** shadcn Card with a title/description header and a flush body for lists and tables. */
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
    <Card className={cn("gap-0 pb-0", className)}>
      <CardHeader className="border-b [.border-b]:pb-4">
        <CardTitle>{title}</CardTitle>
        {sub && <CardDescription>{sub}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className={cn("px-0", bodyClassName)}>{children}</CardContent>
    </Card>
  );
}

export function EmptyText({ text }: { text: string }) {
  return <p className="px-6 py-10 text-center text-sm text-muted-foreground">{text}</p>;
}
