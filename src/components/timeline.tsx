"use client";

import { useEffect, useState } from "react";
import { logActivity } from "@/app/(app)/actions";
import { NOTE_STATUSES, NOTE_TOPICS, PRODUCTS, productLabel } from "@/lib/constants";
import { ago, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

const ICON: Record<string, { label: string; tone: string }> = {
  form: { label: "Form", tone: "bg-cream text-navy" },
  note: { label: "Not", tone: "bg-amber-100 text-amber-800" },
  call: { label: "Görüşme", tone: "bg-sky-100 text-sky-800" },
  whatsapp: { label: "WhatsApp", tone: "bg-emerald-100 text-emerald-800" },
  stage: { label: "Aşama", tone: "bg-violet-100 text-violet-800" },
  assign: { label: "Atama", tone: "bg-stone-100 text-stone-700" },
  followup: { label: "Alarm", tone: "bg-orange-100 text-orange-800" },
  system: { label: "Sistem", tone: "bg-stone-100 text-stone-700" },
};

export function Timeline({
  contactId,
  activities,
  ownProducts,
  labels,
  title = "Notlar ve geçmiş",
}: {
  contactId: string;
  activities: Act[];
  /** Products this person has a policy or request for (listed first in "İlgili poliçe"). */
  ownProducts: string[];
  /** id → label for every policy and request of the person (to label older entries). */
  labels: Record<string, string>;
  title?: string;
}) {
  const [filter, setFilter] = useState<"all" | "note" | "call">("all");
  const isNote = (a: Act) => a.type === "note" || (a.type === "call" && !!a.meta?.text);
  const shown = activities.filter((a) => filter === "all" || (filter === "note" ? isNote(a) : a.type === "call" || a.type === "whatsapp"));
  const noteCount = activities.filter(isNote).length;

  return (
    <Card className="gap-0 pt-0">
      <NoteForm contactId={contactId} ownProducts={ownProducts} />

      <CardHeader className="flex flex-wrap items-center gap-2 pt-4">
        <CardTitle className="mr-auto font-display text-base font-semibold">
          <h2>{title}</h2>
        </CardTitle>
        {(
          [
            ["all", "Tümü"],
            ["note", `Notlar (${noteCount})`],
            ["call", "Görüşmeler"],
          ] as const
        ).map(([v, l]) => (
          <Button
            key={v}
            type="button"
            size="xs"
            variant={filter === v ? "default" : "outline"}
            aria-pressed={filter === v}
            onClick={() => setFilter(v)}
            className={cn("rounded-full", filter !== v && "text-muted-foreground")}
          >
            {l}
          </Button>
        ))}
      </CardHeader>
      <CardContent className="pt-4">
        <ol>
          {shown.length === 0 && <li className="text-sm text-muted-foreground">Kayıt yok.</li>}
          {shown.map((a) => {
            const ic = ICON[a.type] ?? ICON.system;
            const tags = tagsOf(a, labels);
            return (
              <li key={a.id} className="flex gap-3 pb-4 pl-1 last:pb-0">
                <Badge className={cn("mt-0.5 rounded-md px-1.5 text-[11px]", ic.tone)}>{ic.label}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm break-words whitespace-pre-wrap">{a.body}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {tags.map((t) => (
                      <Badge key={t} variant="outline" className="h-auto rounded px-1.5 py-px text-[11px] font-normal text-navy bg-cream-l">
                        {t}
                      </Badge>
                    ))}
                    <span title={fmtDateTime(a.createdAt)}>
                      {ago(a.createdAt)}
                      {a.userName && ` · ${a.userName}`}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
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
  const [status, setStatus] = useState("note");
  const [body, setBody] = useState("");
  useEffect(() => {
    if (state?.ok) {
      setProduct("");
      setTopic("");
      setStatus("note");
      setBody("");
    }
  }, [state]);
  const others = PRODUCTS.filter((p) => p.code !== "genel" && !ownProducts.includes(p.code));

  return (
    <form {...formProps} className="@container grid gap-3 border-b p-4">
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="product" value={product} />
      <input type="hidden" name="topic" value={topic} />
      <div className="grid gap-2 @lg:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`nf-product-${contactId}`} className="text-xs font-normal text-muted-foreground">
            İlgili poliçe
          </Label>
          <Select value={product || NONE} onValueChange={(v) => setProduct(v === NONE ? "" : v)}>
            <SelectTrigger id={`nf-product-${contactId}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={NONE}>Genel</SelectItem>
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
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`nf-topic-${contactId}`} className="text-xs font-normal text-muted-foreground">
            Sebep
          </Label>
          <Select value={topic || NONE} onValueChange={(v) => setTopic(v === NONE ? "" : v)}>
            <SelectTrigger id={`nf-topic-${contactId}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={NONE}>Seçiniz</SelectItem>
              {NOTE_TOPICS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`nf-status-${contactId}`} className="text-xs font-normal text-muted-foreground">
            Durum
          </Label>
          <Select name="status" value={status} onValueChange={setStatus}>
            <SelectTrigger id={`nf-status-${contactId}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {NOTE_STATUSES.map((s) => (
                <SelectItem key={s.code} value={s.code}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Textarea
        name="body"
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={status === "note" ? "Not…" : "Görüşme notu (isteğe bağlı)"}
        className="min-h-16 resize-y"
        aria-label="Not"
      />

      <div className="flex items-center justify-end gap-3">
        {state?.error && (
          <span role="alert" className="mr-auto text-sm text-brand">
            {state.error}
          </span>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </form>
  );
}
