ALTER TABLE "requests" ADD COLUMN "call_status" text;--> statement-breakpoint
-- Pipeline simplified to: Yeni → Arandı (yumuşak red / nötr / dönüş bekliyoruz) → Kazanıldı / Kaybedildi.
UPDATE "requests" SET "call_status" = CASE "stage" WHEN 'contacted' THEN 'neutral' ELSE 'awaiting' END, "stage" = 'followup'
WHERE "stage" IN ('contacted', 'waiting_docs', 'quoted');
