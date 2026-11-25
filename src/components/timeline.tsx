"use client";

import { useEffect, useState } from "react";
import { logActivity } from "@/app/(app)/actions";
import { NOTE_STATUSES, NOTE_TOPICS, PRODUCTS, productLabel } from "@/lib/constants";
import { ago, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AlarmClockIcon,
  ArrowRightLeftIcon,
  FileTextIcon,
  InfoIcon,
  type LucideIcon,
  MessageCircleIcon,
  PhoneIcon,
  StickyNoteIcon,
  UserRoundIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useFormAction } from "./use-form-action";

/** Radix Select items can't have an empty value; this stands for "Genel" / "Seçiniz" and posts "". */
const NONE = "__none";

type Act = {
  id: string;
  type: string;
  body: string | null;
  meta: Record<string, unknown>;
  requestId: string | null;
  createdAt: Date;
  userName: string | null;
};

const ICON: Record<string, { label: string; Icon: LucideIcon }> = {
  form: { label: "Form", Icon: FileTextIcon },
  note: { label: "Not", Icon: StickyNoteIcon },
  call: { label: "Görüşme", Icon: PhoneIcon },
  whatsapp: { label: "WhatsApp", Icon: MessageCircleIcon },
  stage: { label: "Aşama", Icon: ArrowRightLeftIcon },
  assign: { label: "Atama", Icon: UserRoundIcon },
  followup: { label: "Alarm", Icon: AlarmClockIcon },
  system: { label: "Sistem", Icon: InfoIcon },
};

const FILTERS = [
  ["all", "Tümü"],
  ["note", "Notlar"],
  ["call", "Görüşmeler"],
] as const;

/** Activity tab: one composer box on top, the history underneath. */
export function Timeline({
  contactId,
  activities,
  ownProducts,
  labels,
}: {
  contactId: string;
  activities: Act[];
  /** Products this person has a policy or request for (listed first in "İlgili poliçe"). */
  ownProducts: string[];
  /** id → label for every policy and request of the person (to label older entries). */
  labels: Record<string, string>;
}) {
  const [filter, setFilter] = useState<"all" | "note" | "call">("all");
  const isNote = (a: Act) => a.type === "note" || (a.type === "call" && !!a.meta?.text);
  const shown = activities.filter((a) => filter === "all" || (filter === "note" ? isNote(a) : a.type === "call" || a.type === "whatsapp"));

  return (
    <div className="flex flex-col gap-6">
      <NoteForm contactId={contactId} ownProducts={ownProducts} />

      <section aria-labelledby="hist-h" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 id="hist-h" className="mr-auto text-sm font-medium">
            Geçmiş
          </h2>
          <ToggleGroup type="single" size="sm" variant="outline" spacing={0} value={filter} onValueChange={(v) => v && setFilter(v as typeof filter)} aria-label="Filtre">
            {FILTERS.map(([v, l]) => (
              <ToggleGroupItem key={v} value={v} className="h-7 px-2.5 text-xs data-[state=on]:bg-muted">
                {l}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <ol className="relative">
          {shown.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Kayıt yok.</li>}
          {shown.map((a, i) => {
            const { label, Icon } = ICON[a.type] ?? ICON.system;
            const tags = tagsOf(a, labels);
            return (
              <li key={a.id} className="relative flex gap-3 pb-5 last:pb-0">
                {i < shown.length - 1 && <span className="absolute top-8 bottom-0 left-[13px] w-px bg-border" aria-hidden="true" />}
                <span className="z-10 grid size-7 shrink-0 place-items-center rounded-full border bg-background text-muted-foreground" title={label}>
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{a.userName ?? label}</span>
                    {a.userName && <span>· {label.toLocaleLowerCase("tr")}</span>}
                    {tags.map((t) => (
                      <Badge key={t} variant="secondary" className="h-5 px-1.5 font-normal">
                        {t}
                      </Badge>
                    ))}
                    <span className="ml-auto whitespace-nowrap" title={fmtDateTime(a.createdAt)}>
                      {ago(a.createdAt)}
                    </span>
                  </div>
                  {a.body && <p className="mt-1 text-sm break-words whitespace-pre-wrap">{a.body}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function tagsOf(a: Act, labels: Record<string, string>) {
  const topics = (a.meta?.topics as string[] | undefined) ?? [];
  const product = a.meta?.product as string | undefined;
  if (product) return [productLabel(product), ...topics];
  // Older entries: linked policies / requests.
  const links = (a.meta?.links as { id: string }[] | undefined) ?? [];
  const fromLinks = links.map((l) => labels[l.id]).filter(Boolean);
  if (fromLinks.length || topics.length) return [...new Set([...fromLinks, ...topics])];
  return a.requestId && labels[a.requestId] ? [labels[a.requestId]] : [];
}

function NoteForm({ contactId, ownProducts }: { contactId: string; ownProducts: string[] }) {
  const [state, formProps, pending] = useFormAction(logActivity);
  const [product, setProduct] = useState("");
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<"note" | "call">("note");
  const [status, setStatus] = useState("reached");
  const [body, setBody] = useState("");
  useEffect(() => {
    if (state?.ok) {
      setProduct("");
      setTopic("");
      setMode("note");
      setStatus("reached");
      setBody("");
    }
  }, [state]);
  const others = PRODUCTS.filter((p) => p.code !== "genel" && !ownProducts.includes(p.code));
  const call = mode === "call";

  return (
    <form
      {...formProps}
      className="rounded-xl border bg-card shadow-xs transition-shadow focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30"
    >
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="product" value={product} />
      <input type="hidden" name="topic" value={topic} />
      <input type="hidden" name="status" value={call ? status : "note"} />

      <Textarea
        name="body"
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={call ? "Görüşme notu (isteğe bağlı)…" : "Not yaz…"}
        className="min-h-16 resize-none border-0 bg-transparent px-3.5 pt-3 shadow-none focus-visible:ring-0 dark:bg-transparent"
        aria-label="Not"
      />

      <div className="flex flex-wrap items-center gap-2 border-t px-2.5 py-2">
        <ToggleGroup type="single" size="sm" variant="outline" spacing={0} value={mode} onValueChange={(v) => v && setMode(v as "note" | "call")} aria-label="Kayıt türü">
          <ToggleGroupItem value="note" className="h-7 px-2.5 text-xs data-[state=on]:bg-muted">
            <StickyNoteIcon data-icon="inline-start" />
            Not
          </ToggleGroupItem>
          <ToggleGroupItem value="call" className="h-7 px-2.5 text-xs data-[state=on]:bg-muted">
            <PhoneIcon data-icon="inline-start" />
            Görüşme
          </ToggleGroupItem>
        </ToggleGroup>

        {call && (
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger size="sm" aria-label="Görüşme sonucu" className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {NOTE_STATUSES.filter((s) => s.code !== "note").map((s) => (
                <SelectItem key={s.code} value={s.code}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={product || NONE} onValueChange={(v) => setProduct(v === NONE ? "" : v)}>
          <SelectTrigger size="sm" aria-label="İlgili poliçe" className={cn("h-7 text-xs", !product && "text-muted-foreground")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={NONE}>Poliçe: genel</SelectItem>
            {ownProducts.length > 0 && (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Bu kişide olanlar</SelectLabel>
                  {ownProducts.map((p) => (
                    <SelectItem key={p} value={p}>
                      {productLabel(p)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </>
            )}
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>{ownProducts.length ? "Diğer poliçeler" : "Poliçeler"}</SelectLabel>
              {others.map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select value={topic || NONE} onValueChange={(v) => setTopic(v === NONE ? "" : v)}>
          <SelectTrigger size="sm" aria-label="Sebep" className={cn("h-7 text-xs", !topic && "text-muted-foreground")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={NONE}>Sebep: yok</SelectItem>
            {NOTE_TOPICS.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          {state?.error && (
            <span role="alert" className="text-xs text-destructive">
              {state.error}
            </span>
          )}
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </div>
      </div>
    </form>
  );
}
