"use client";

import Link from "next/link";
import { useTransition } from "react";
import { setReminderDone, snoozeReminder } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ago, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Alarm = { id: string; title: string; dueAt: Date; kind: string; contactId: string; fullName: string; lifecycle: string };

export function DashboardAlarms({ alarms }: { alarms: Alarm[] }) {
  if (alarms.length === 0) return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Bugün için alarm yok.</p>;
  const now = new Date();
  return (
    <ul className="divide-y">
      {alarms.map((a) => (
        <Row key={a.id} a={a} overdue={a.dueAt < now} />
      ))}
    </ul>
  );
}

function Row({ a, overdue }: { a: Alarm; overdue: boolean }) {
  const [pending, start] = useTransition();
  return (
    <li className={cn("flex items-start gap-3 px-5 py-3", pending && "opacity-50")}>
      <Checkbox
        className="mt-0.5"
        disabled={pending}
        onCheckedChange={() => start(() => setReminderDone(a.id, true))}
        aria-label={`Tamamlandı: ${a.title}`}
      />
      <div className="min-w-0 flex-1">
        <Link href={`/kisiler/${a.contactId}`} className="text-sm font-medium hover:underline">
          {a.fullName}
        </Link>
        <span className={cn("ml-1.5 text-xs", a.lifecycle === "customer" ? "text-emerald-700" : "text-muted-foreground")}>
          {a.lifecycle === "customer" ? "Müşteri" : "Lead"}
        </span>
        <p className="truncate text-xs text-muted-foreground">
          {a.kind === "renewal" && "🔁 "}
          {a.title}
        </p>
      </div>
      <span className={cn("w-24 shrink-0 text-right text-xs", overdue ? "font-semibold text-brand" : "text-muted-foreground")}>
        {overdue ? `gecikti · ${ago(a.dueAt)}` : fmtDateTime(a.dueAt)}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="xs" className="shrink-0 text-muted-foreground" disabled={pending} onClick={() => start(() => snoozeReminder(a.id, 24))}>
            +1g
          </Button>
        </TooltipTrigger>
        <TooltipContent>1 gün ertele</TooltipContent>
      </Tooltip>
    </li>
  );
}
