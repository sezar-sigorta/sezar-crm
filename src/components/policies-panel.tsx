"use client";

import { useEffect, useState, useTransition } from "react";
import { cancelPolicy, deletePolicy, renewPolicy, savePolicy } from "@/app/(app)/actions";
import type { Policy } from "@/db/schema";
import { productLabel } from "@/lib/constants";
import { fmtYmd } from "@/lib/format";
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
    <section className="card overflow-hidden" aria-labelledby="pol-h">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
        <h2 id="pol-h" className="text-base font-semibold">
          Poliçeler
        </h2>
        <span className="text-xs text-ink-2">
          {active.length} aktif{total > 0 && ` · toplam prim ${total.toLocaleString("tr-TR")} ₺`}
        </span>
        <button type="button" className="btn-primary ml-auto py-1.5" onClick={() => setEdit("new")}>
          + Poliçe ekle
        </button>
      </div>

      {active.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-2">Aktif poliçe yok. Kesilen poliçeyi ekleyince yenileme alarmları otomatik kurulur.</p>
      ) : (
        <ul className="divide-y divide-line">
          {active.map((p) => (
            <PolicyRow key={p.id} p={p} onEdit={() => setEdit(p)} />
          ))}
        </ul>
      )}

      {old.length > 0 && (
        <div className="border-t border-line px-5 py-3">
          <button type="button" className="text-xs text-ink-2 hover:text-navy" onClick={() => setShowOld((s) => !s)} aria-expanded={showOld}>
            {showOld ? "▾" : "▸"} Geçmiş poliçeler ({old.length})
          </button>
          {showOld && (
            <ul className="mt-2 divide-y divide-line">
              {old.map((p) => (
                <PolicyRow key={p.id} p={p} onEdit={() => setEdit(p)} muted />
              ))}
            </ul>
          )}
        </div>
      )}

      {edit && <PolicyDialog contactId={contactId} p={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}
    </section>
  );
}

function PolicyRow({ p, onEdit, muted }: { p: Policy; onEdit: () => void; muted?: boolean }) {
  const [pending, start] = useTransition();
  const [menu, setMenu] = useState(false);
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 ${pending ? "opacity-60" : ""} ${muted ? "px-0 text-ink-2" : ""}`}>
      <div className="min-w-40 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-navy">{productLabel(p.product)}</span>
          {p.insurer && <span className="text-sm text-ink-2">· {p.insurer}</span>}
          {p.status !== "active" && <span className="chip border-line bg-cream-l text-ink-2">{STATUS[p.status]}</span>}
        </div>
        <div className="text-xs text-ink-2">
          {[p.policyNo && `No ${p.policyNo}`, p.subject, p.premium && `${Number(p.premium).toLocaleString("tr-TR")} ₺`].filter(Boolean).join(" · ") || "Detay girilmemiş"}
        </div>
      </div>
      <div className="text-sm">
        <div className="text-xs text-ink-2">{p.startDate ? `${fmtYmd(p.startDate)} →` : "Yenileme"}</div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="font-medium">{fmtYmd(p.endDate)}</span>
          {p.status === "active" && <RenewalBadge ymd={p.endDate} />}
        </div>
      </div>
      <div className="relative flex gap-1">
        {p.status === "active" && (
          <button
            type="button"
            className="btn-ghost px-2.5 py-1 text-xs"
            title="Bu poliçeyi kapatır, aynı bilgilerle 1 yıllık yenisini açar"
            onClick={() => start(() => renewPolicy(p.id))}
          >
            Yenilendi
          </button>
        )}
        <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={onEdit}>
          Düzenle
        </button>
        <button type="button" className="btn-ghost px-2 py-1 text-xs" aria-label="Diğer işlemler" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          ⋯
        </button>
        {menu && (
          <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-line bg-white p-1 shadow-lg">
            {p.status === "active" && (
              <button
                type="button"
                className="w-full rounded px-3 py-1.5 text-left text-sm hover:bg-cream"
                onClick={() => {
                  setMenu(false);
                  if (confirm(`${productLabel(p.product)} poliçesi iptal edildi olarak işaretlensin mi?`)) start(() => cancelPolicy(p.id));
                }}
              >
                İptal edildi
              </button>
            )}
            <button
              type="button"
              className="w-full rounded px-3 py-1.5 text-left text-sm text-brand hover:bg-cream"
              onClick={() => {
                setMenu(false);
                if (confirm(`${productLabel(p.product)} poliçesi ve alarmları silinsin mi? Bu geri alınamaz.`)) start(() => deletePolicy(p.id));
              }}
            >
              Sil
            </button>
          </div>
        )}
      </div>
    </li>
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
      <form {...formProps} className="space-y-4">
        <input type="hidden" name="contactId" value={contactId} />
        {p && <input type="hidden" name="id" value={p.id} />}
        {documentId && <input type="hidden" name="documentId" value={documentId} />}
        {notice}
        <PolicyFields p={p ?? prefill} idPrefix={p ? `pe-${p.id.slice(0, 6)}` : prefill ? "pa" : "pn"} />
        <div>
          <label className="label" htmlFor="pol-notes">
            Not
          </label>
          <textarea id="pol-notes" name="notes" rows={2} defaultValue={(p ?? prefill)?.notes ?? ""} className="input resize-y" />
        </div>
        <div className="flex items-center justify-end gap-2">
          {state?.error && (
            <span role="alert" className="mr-auto text-sm text-brand">
              {state.error}
            </span>
          )}
          <button type="button" className="btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn-primary" disabled={pending}>
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
