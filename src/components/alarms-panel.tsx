"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addReminder, deleteReminder, setReminderDone, snoozeReminder } from "@/app/(app)/actions";
import type { Reminder } from "@/db/schema";
import { ChevronRight, Plus, Repeat, X } from "lucide-react";
import { ago, fmtDateTime, toLocalInput, todayYmd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useFormAction } from "./use-form-action";

type Link = { value: string; label: string; field: "requestId" | "policyId" };

/** Radix Select items can't have an empty value; this stands for "Genel (kişiye bağlı)". */
const NONE = "__none";

const QUICK_TITLES = ["Geri ara", "Teklif için dönüş al", "Belge / bilgi iste", "Yenileme teklifi hazırla", "Doğum günü tebriği"];

export function AlarmsPanel({ contactId, reminders, links }: { contactId: string; reminders: Reminder[]; links: Link[] }) {
  const open = reminders.filter((r) => !r.doneAt);
  const done = reminders.filter((r) => r.doneAt);
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(open.length === 0);
  const now = new Date();

  return (
    <Card role="region" aria-labelledby="alarms-h">
      <CardHeader>
        <CardTitle id="alarms-h" className="font-display text-base font-semibold">
          Alarmlar
        </CardTitle>
        {open.length > 0 && <CardDescription className="text-xs">{open.length} açık</CardDescription>}
        {!adding && (
          <CardAction>
            <Button type="button" variant="outline" size="xs" onClick={() => setAdding(true)}>
              <Plus data-icon="inline-start" />
              Alarm kur
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {adding && <AddAlarm contactId={contactId} links={links} onDone={() => setAdding(false)} canCancel={open.length > 0} />}

        <ul className="space-y-2">
          {open.map((r) => (
            <AlarmRow key={r.id} r={r} overdue={r.dueAt < now} />
          ))}
          {open.length === 0 && !adding && <li className="text-sm text-muted-foreground">Açık alarm yok.</li>}
        </ul>

        {done.length > 0 && (
          <div className="mt-3">
            <Separator className="mb-2" />
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="-ml-2 text-muted-foreground"
              onClick={() => setShowDone((s) => !s)}
              aria-expanded={showDone}
            >
              <ChevronRight data-icon="inline-start" className={cn("transition-transform", showDone && "rotate-90")} />
              Tamamlananlar ({done.length})
            </Button>
            {showDone && (
              <ul className="mt-2 space-y-2">
                {done.map((r) => (
                  <AlarmRow key={r.id} r={r} overdue={false} />
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlarmRow({ r, overdue }: { r: Reminder; overdue: boolean }) {
  const [pending, start] = useTransition();
  const isDone = !!r.doneAt;
  return (
    <li
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2",
        overdue ? "border-brand/40 bg-orange-50/60" : "border-border",
        pending && "opacity-60",
      )}
    >
      <Checkbox
        checked={isDone}
        disabled={pending}
        onCheckedChange={(v) => start(() => setReminderDone(r.id, v === true))}
        className="mt-0.5"
        aria-label={isDone ? "Tamamlanmadı olarak işaretle" : "Tamamlandı olarak işaretle"}
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm leading-snug break-words", isDone && "text-muted-foreground line-through")}>{r.title}</p>
        <p className={cn("mt-0.5 flex flex-wrap items-center gap-1 text-xs", overdue ? "font-semibold text-brand" : "text-muted-foreground")}>
          {r.kind === "renewal" && <Repeat className="size-3" aria-label="Yenileme" />}
          {fmtDateTime(r.dueAt)} · {isDone ? `tamamlandı ${ago(r.doneAt)}` : overdue ? `gecikti, ${ago(r.dueAt)}` : ago(r.dueAt)}
        </p>
      </div>
      {!isDone && (
        <div className="-mr-1 flex shrink-0 gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            title="1 gün ertele"
            className="px-1.5 text-muted-foreground"
            onClick={() => start(() => snoozeReminder(r.id, 24))}
          >
            +1g
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Sil"
            aria-label="Alarmı sil"
            className="text-muted-foreground"
            onClick={() => start(() => deleteReminder(r.id))}
          >
            <X />
          </Button>
        </div>
      )}
    </li>
  );
}

function AddAlarm({ contactId, links, onDone, canCancel }: { contactId: string; links: Link[]; onDone: () => void; canCancel: boolean }) {
  const [state, formProps, pending] = useFormAction(addReminder);
  const formRef = useRef<HTMLFormElement>(null);
  const [at, setAt] = useState("");
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  useEffect(() => {
    if (state?.ok) {
      setAt("");
      setTitle("");
      if (canCancel) onDone();
    }
  }, [state, onDone, canCancel]);

  const tomorrowAt = (days: number, h = 10) => {
    const ymd = todayYmd(new Date(Date.now() + days * 864e5));
    return toLocalInput(new Date(`${ymd}T${String(h).padStart(2, "0")}:00:00+03:00`));
  };
  const sel = links.find((l) => l.value === link);

  return (
    <form ref={formRef} {...formProps} className="mb-3 grid gap-2 rounded-lg bg-muted/60 p-3">
      <input type="hidden" name="contactId" value={contactId} />
      {sel && <input type="hidden" name={sel.field} value={sel.value} />}
      <Input type="datetime-local" name="at" required value={at} onChange={(e) => setAt(e.target.value)} className="bg-background" aria-label="Alarm zamanı" />
      <div className="flex flex-wrap gap-1">
        {[
          ["+1 saat", toLocalInput(new Date(Date.now() + 3600e3))],
          ["Yarın 10:00", tomorrowAt(1)],
          ["3 gün", tomorrowAt(3)],
          ["1 hafta", tomorrowAt(7)],
          ["1 ay", tomorrowAt(30)],
        ].map(([label, v]) => (
          <Button key={label} type="button" variant="outline" size="xs" onClick={() => setAt(v)}>
            {label}
          </Button>
        ))}
      </div>
      <Input
        name="title"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Ne yapılacak?"
        maxLength={300}
        className="bg-background"
        list="sz-alarm-titles"
        aria-label="Ne yapılacak?"
      />
      <datalist id="sz-alarm-titles">
        {QUICK_TITLES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      {links.length > 0 && (
        <Select value={link || NONE} onValueChange={(v) => setLink(v === NONE ? "" : v)}>
          <SelectTrigger className="w-full bg-background" aria-label="İlgili talep / poliçe">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={NONE}>Genel (kişiye bağlı)</SelectItem>
            {links.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div className="flex items-center justify-end gap-2">
        {state?.error && (
          <span role="alert" className="mr-auto text-xs text-brand">
            {state.error}
          </span>
        )}
        {canCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Vazgeç
          </Button>
        )}
        <Button type="submit" size="sm" disabled={pending}>
          Alarm kur
        </Button>
      </div>
    </form>
  );
}
