"use client";

import { useRef, useState, useTransition } from "react";
import { AlertCircle, Download, Sparkles, Trash2, Upload } from "lucide-react";
import { deleteDocument, readDocumentWithAi, uploadDocument } from "@/app/(app)/document-actions";
import type { Document, Policy } from "@/db/schema";
import { productLabel } from "@/lib/constants";
import { ago } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PolicyDialog } from "./policies-panel";

type Extraction = {
  is_policy: boolean;
  document_type: string;
  product: string;
  insurer: string | null;
  policy_no: string | null;
  insured_name: string | null;
  subject: string | null;
  start_date: string | null;
  end_date: string | null;
  premium: number | null;
  coverage_summary: string | null;
  confidence: string;
  warnings: string[];
};

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function DocumentsPanel({
  contactId,
  contactName,
  documents,
  policies,
  aiEnabled,
}: {
  contactId: string;
  contactName: string;
  documents: Document[];
  policies: Policy[];
  aiEnabled: boolean;
}) {
  const [uploading, startUpload] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [review, setReview] = useState<{ doc: Document; x: Extraction } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function upload(files: FileList | null) {
    const list = [...(files ?? [])];
    if (!list.length) return;
    setError(null);
    startUpload(async () => {
      for (const file of list) {
        if (file.size > 10 * 1024 * 1024) {
          setError(`${file.name}: 10 MB'tan büyük.`);
          continue;
        }
        const fd = new FormData();
        fd.set("contactId", contactId);
        fd.set("file", file);
        const res = await uploadDocument(null, fd);
        if (res && "error" in res && res.error) setError(`${file.name}: ${res.error}`);
      }
      if (input.current) input.current.value = "";
    });
  }

  return (
    <Card role="region" className="gap-0 pb-0" aria-labelledby="docs-h">
      <CardHeader className="border-b">
        <CardTitle id="docs-h" className="font-display text-base font-semibold">
          Belgeler
        </CardTitle>
        <CardDescription className="text-xs">Poliçe PDF&apos;i, poliçe fotoğrafı, ruhsat…</CardDescription>
      </CardHeader>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          upload(e.dataTransfer.files);
        }}
        className={cn(
          "m-4 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          drag ? "border-primary bg-navy-l/30" : "border-border hover:bg-muted/50",
          uploading && "pointer-events-none opacity-60",
        )}
      >
        <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium text-navy">{uploading ? "Yükleniyor…" : "Dosya seçin ya da buraya sürükleyin"}</span>
        <span className="text-xs text-muted-foreground">PDF, JPG, PNG · en fazla 10 MB</span>
        <input
          ref={input}
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => upload(e.target.files)}
        />
      </label>
      {error && (
        <Alert variant="destructive" className="mx-4 -mt-1 mb-4 w-auto border-brand/40 text-brand">
          <AlertCircle />
          <AlertDescription className="text-brand">{error}</AlertDescription>
        </Alert>
      )}

      {documents.length > 0 && (
        <ul className="divide-y border-t">
          {documents.map((d) => (
            <DocRow key={d.id} d={d} policy={policies.find((p) => p.id === d.policyId)} aiEnabled={aiEnabled} onRead={(x) => setReview({ doc: d, x })} />
          ))}
        </ul>
      )}
      {aiEnabled && documents.length > 0 && (
        <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
          &quot;AI ile oku&quot; belgeyi okunması için Anthropic&apos;e (yurt dışı) gönderir. Kişinin bu aktarıma onay verdiğinden emin olun.
        </p>
      )}

      {review && (
        <PolicyDialog
          contactId={contactId}
          documentId={review.doc.id}
          prefill={{
            product: review.x.product === "genel" ? undefined : review.x.product,
            insurer: review.x.insurer,
            policyNo: review.x.policy_no,
            subject: review.x.subject,
            startDate: review.x.start_date,
            endDate: review.x.end_date,
            premium: review.x.premium != null ? String(review.x.premium) : null,
            notes: review.x.coverage_summary,
          }}
          notice={<ReviewNotice x={review.x} contactName={contactName} />}
          onClose={() => setReview(null)}
        />
      )}
    </Card>
  );
}

function DocRow({ d, policy, aiEnabled, onRead }: { d: Document; policy?: Policy; aiEnabled: boolean; onRead: (x: Extraction) => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const isPdf = d.mimeType === "application/pdf";
  return (
    <li className={cn("flex flex-wrap items-center gap-3 px-4 py-3", pending && "opacity-70")}>
      <span
        className={cn("grid size-9 shrink-0 place-items-center rounded-md text-[10px] font-bold", isPdf ? "bg-red-50 text-red-700" : "bg-sky-50 text-sky-700")}
      >
        {isPdf ? "PDF" : "IMG"}
      </span>
      <div className="min-w-[10rem] flex-1">
        <a href={`/api/files/${d.id}`} target="_blank" rel="noopener" className="block truncate text-sm font-medium hover:underline">
          {d.fileName}
        </a>
        <div className="text-xs text-muted-foreground">
          {kb(d.size)} · {ago(d.createdAt)}
          {policy && <span className="ml-1 text-emerald-700">· {productLabel(policy.product)} poliçesine bağlı</span>}
        </div>
        {err && (
          <div role="alert" className="text-xs text-brand">
            {err}
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        {!policy && (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* span wrapper so the tooltip still shows while the button is disabled */}
              <span tabIndex={aiEnabled ? undefined : 0}>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={!aiEnabled || pending}
                  onClick={() => {
                    setErr(null);
                    start(async () => {
                      const res = await readDocumentWithAi(d.id);
                      if ("error" in res) setErr(res.error);
                      else onRead(res.extraction as Extraction);
                    });
                  }}
                >
                  <Sparkles data-icon="inline-start" />
                  {pending ? "Okunuyor…" : "AI ile oku"}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{aiEnabled ? "Belgeyi AI ile okuyup poliçe bilgilerini doldurur" : "AI kapalı (ANTHROPIC_API_KEY gerekli)"}</TooltipContent>
          </Tooltip>
        )}
        <Button asChild variant="ghost" size="xs">
          <a href={`/api/files/${d.id}?indir=1`}>
            <Download data-icon="inline-start" />
            İndir
          </a>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-brand hover:bg-brand/10 hover:text-brand"
          aria-label={`${d.fileName} sil`}
          title="Sil"
          onClick={() => {
            if (confirm(`"${d.fileName}" silinsin mi? Bu geri alınamaz.`)) start(() => deleteDocument(d.id));
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

function ReviewNotice({ x, contactName }: { x: Extraction; contactName: string }) {
  const nameMismatch = x.insured_name && !x.insured_name.toLocaleLowerCase("tr").includes(contactName.split(" ")[0].toLocaleLowerCase("tr"));
  const items = [
    !x.is_policy && `Bu belge poliçe gibi görünmüyor (${x.document_type}).`,
    nameMismatch && `Belgedeki sigortalı: "${x.insured_name}". Bu profille aynı kişi/şirket mi?`,
    x.confidence !== "yüksek" && `AI okumadan ${x.confidence} derecede emin.`,
    ...x.warnings,
  ].filter(Boolean) as string[];
  return (
    <div className={cn("rounded-lg px-3 py-2 text-xs", items.length ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800")}>
      {items.length ? (
        <ul className="list-disc space-y-0.5 pl-4">
          {items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ) : (
        `${x.document_type} okundu. Bilgileri kontrol edip kaydedin.`
      )}
    </div>
  );
}
