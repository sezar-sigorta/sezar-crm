"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronRight, MoreHorizontal, Plus, RefreshCw } from "lucide-react";
import { cancelPolicy, deletePolicy, renewPolicy, savePolicy } from "@/app/(app)/actions";
import type { Policy } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { productLabel } from "@/lib/constants";
import { fmtYmd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Chip } from "./chips";
import { Modal } from "./modal";
import { PolicyFields } from "./policy-fields";
import { RenewalBadge } from "./renewal-badge";
import { useFormAction } from "./use-form-action";

const STATUS: Record<string, string> = { active: "Aktif", renewed: "Yenilendi", cancelled: "İptal" };

export function PoliciesPanel({ contactId, policies }: { contactId: string; policies: Policy[] }) {
  const [edit, setEdit] = useState<Policy | "new" | null>(null);
  const [showOld, setShowOld] = useState(false);
  const active = policies.filter((p) => p.status === "active");
  const old = policies.filter((p) => p.status !== "active");
  const total = active.reduce((a, p) => a + (p.premium ? Number(p.premium) : 0), 0);

  return (
    <Card role="region" className="gap-0 pb-0" aria-labelledby="pol-h">
      <CardHeader className="border-b">
        <CardTitle id="pol-h" className="font-display text-base font-semibold">
          Poliçeler
        </CardTitle>
        <CardDescription className="text-xs">
          {active.length} aktif{total > 0 && ` · toplam prim ${total.toLocaleString("tr-TR")} ₺`}
        </CardDescription>
        <CardAction>
          <Button type="button" size="sm" onClick={() => setEdit("new")}>
            <Plus data-icon="inline-start" />
            Poliçe ekle
          </Button>
        </CardAction>
      </CardHeader>

      {active.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Aktif poliçe yok. Kesilen poliçeyi ekleyince yenileme alarmları otomatik kurulur.</p>
      ) : (
        <PolicyTable policies={active} onEdit={setEdit} />
      )}

      {old.length > 0 && (
        <div className="border-t">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mx-2 my-1.5 text-muted-foreground"
            onClick={() => setShowOld((s) => !s)}
            aria-expanded={showOld}
          >
            <ChevronRight data-icon="inline-start" className={cn("transition-transform", showOld && "rotate-90")} />
            Geçmiş poliçeler ({old.length})
          </Button>
          {showOld && <PolicyTable policies={old} onEdit={setEdit} muted />}
        </div>
      )}

      {edit && <PolicyDialog contactId={contactId} p={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}
    </Card>
  );
}

function PolicyTable({ policies, onEdit, muted }: { policies: Policy[]; onEdit: (p: Policy) => void; muted?: boolean }) {
  return (
    <Table className={cn(muted && "text-muted-foreground")}>
      <TableHeader className={cn(muted && "sr-only")}>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-4 text-xs text-muted-foreground">Poliçe</TableHead>
          <TableHead className="text-xs text-muted-foreground">Yenileme</TableHead>
          <TableHead className="pr-4 text-right text-xs text-muted-foreground">
            <span className="sr-only">İşlemler</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {policies.map((p) => (
          <PolicyRow key={p.id} p={p} onEdit={() => onEdit(p)} />
        ))}
      </TableBody>
    </Table>
  );
}

function PolicyRow({ p, onEdit }: { p: Policy; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const active = p.status === "active";
  return (
    <TableRow className={cn(pending && "opacity-60")}>
      <TableCell className="min-w-44 pl-4 whitespace-normal">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("font-medium", active ? "text-navy" : "text-muted-foreground")}>{productLabel(p.product)}</span>
          {p.insurer && <span className="text-muted-foreground">· {p.insurer}</span>}
          {!active && <Chip tone="border-line bg-cream-l text-ink-2">{STATUS[p.status]}</Chip>}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {[p.policyNo && `No ${p.policyNo}`, p.subject, p.premium && `${Number(p.premium).toLocaleString("tr-TR")} ₺`].filter(Boolean).join(" · ") ||
            "Detay girilmemiş"}
        </div>
      </TableCell>
      <TableCell>
        <div className="text-xs text-muted-foreground">{p.startDate ? `${fmtYmd(p.startDate)} →` : "Yenileme"}</div>
        <div className="flex items-center gap-2">
          <span className="font-medium tabular-nums">{fmtYmd(p.endDate)}</span>
          {active && <RenewalBadge ymd={p.endDate} />}
        </div>
      </TableCell>
      <TableCell className="pr-4">
        <div className="flex justify-end gap-1">
          {active && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="outline" size="xs" disabled={pending} onClick={() => start(() => renewPolicy(p.id))}>
                  <RefreshCw data-icon="inline-start" />
                  Yenilendi
                </Button>
              </TooltipTrigger>
              <TooltipContent>Bu poliçeyi kapatır, aynı bilgilerle 1 yıllık yenisini açar</TooltipContent>
            </Tooltip>
          )}
          <Button type="button" variant="ghost" size="xs" onClick={onEdit}>
            Düzenle
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Diğer işlemler" disabled={pending}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {active && (
                <DropdownMenuItem
                  onSelect={() => {
                    if (confirm(`${productLabel(p.product)} poliçesi iptal edildi olarak işaretlensin mi?`)) start(() => cancelPolicy(p.id));
                  }}
                >
                  İptal edildi
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  if (confirm(`${productLabel(p.product)} poliçesi ve alarmları silinsin mi? Bu geri alınamaz.`)) start(() => deletePolicy(p.id));
                }}
              >
                Sil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function PolicyDialog({
  contactId,
  p,
  prefill,
  documentId,
  notice,
  onClose,
}: {
  contactId: string;
  p?: Policy;
  /** Values read from an uploaded document by AI; the user checks them before saving. */
  prefill?: Partial<Policy>;
  documentId?: string;
  notice?: React.ReactNode;
  onClose: () => void;
}) {
  const [state, formProps, pending] = useFormAction(savePolicy);
  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);
  return (
    <Modal
      title={p ? "Poliçeyi düzenle" : prefill ? "Belgeden poliçe oluştur" : "Poliçe ekle"}
      sub={prefill ? "AI'ın okuduğu bilgileri kontrol edin, gerekirse düzeltin ve kaydedin." : "Yenileme tarihinden 30 ve 7 gün önce otomatik alarm kurulur."}
      onClose={onClose}
      wide
    >
      <form {...formProps} className="grid gap-4">
        <input type="hidden" name="contactId" value={contactId} />
        {p && <input type="hidden" name="id" value={p.id} />}
        {documentId && <input type="hidden" name="documentId" value={documentId} />}
        {notice}
        <PolicyFields p={p ?? prefill} idPrefix={p ? `pe-${p.id.slice(0, 6)}` : prefill ? "pa" : "pn"} />
        <div className="grid gap-1.5">
          <Label htmlFor="pol-notes">Not</Label>
          <Textarea id="pol-notes" name="notes" rows={2} defaultValue={(p ?? prefill)?.notes ?? ""} className="resize-y" />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {state?.error && (
            <span role="alert" className="mr-auto text-sm text-brand">
              {state.error}
            </span>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
