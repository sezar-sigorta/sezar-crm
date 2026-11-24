// Local demo: ~60 Meta leads spread over 10 lead forms / 6 campaigns, with outcomes,
// so the Raporlar page has something to compare. Stop the dev server first (embedded DB).
//   npm run seed:forms
import { eq } from "drizzle-orm";
import { getDb, schema } from "../src/db";
import { LOST_REASONS } from "../src/lib/constants";
import { ingestLead } from "../src/lib/ingest";
import { metaLeadToIncoming } from "../src/lib/meta";

if (process.env.DATABASE_URL) {
  console.error("seed:forms yalnızca yerel veritabanında çalışır (DATABASE_URL tanımlı).");
  process.exit(1);
}

// [form, campaign, leads, win rate, extra question]
const FORMS: [string, string, number, number, [string, string[]]][] = [
  ["Kasko Teklif Formu – Kısa", "Kasko – İstanbul", 11, 0.27, ["aracınızın_modeli", ["Egea 2021", "Clio 2019", "Corolla 2022", "Golf 2020"]]],
  ["Kasko Teklif Formu – Detaylı", "Kasko – İstanbul", 6, 0.33, ["hasarsızlık_yılı", ["0", "2", "4", "5+"]]],
  ["Zorunlu Trafik – Hızlı Teklif", "Trafik – Türkiye geneli", 9, 0.22, ["plaka_ili", ["34", "06", "35", "16"]]],
  ["TSS – Kasım", "TSS – 25-45 Kadın", 10, 0.1, ["yaşınız", ["26-35", "36-45"]]],
  ["TSS – Aile Paketi", "TSS – Aileler", 5, 0.2, ["kaç_kişi", ["2", "3", "4"]]],
  ["Özel Sağlık – Kapsamlı", "Özel Sağlık – Premium", 4, 0.25, ["mevcut_sigorta", ["Yok", "SGK"]]],
  ["Konut + DASK", "Konut+DASK – Ev sahipleri", 7, 0.29, ["konut_tipi", ["Daire", "Müstakil"]]],
  ["DASK – Yenileme Hatırlatma", "Konut+DASK – Ev sahipleri", 3, 0.67, ["poliçe_bitiş_ayı", ["Aralık", "Ocak"]]],
  ["İşyeri Sigortası – KOBİ", "Kurumsal – KOBİ", 4, 0.25, ["çalışan_sayısı", ["1-9", "10-49"]]],
  ["Evcil Hayvan – Kedi Köpek", "Evcil Hayvan – Sevimli", 6, 0.0, ["hayvan_türü", ["Kedi", "Köpek"]]],
];

const FIRST = ["Ahmet", "Ayşe", "Mehmet", "Fatma", "Mustafa", "Emine", "Ali", "Hatice", "Hüseyin", "Zeynep", "İbrahim", "Elif", "Yusuf", "Merve", "Ömer", "Esra", "Murat", "Büşra", "Ramazan", "Kübra"];
const LAST = ["Yıldırım", "Öztürk", "Aydın", "Özdemir", "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara", "Koç", "Kurt", "Özkan", "Şimşek", "Polat", "Korkmaz"];

async function main() {
  const db = await getDb();
  const users = await db.select().from(schema.users);
  let n = 0;
  for (const [fi, [form, campaign, count, winRate, [qKey, qVals]]] of FORMS.entries()) {
    for (let i = 0; i < count; i++) {
      const seed = fi * 97 + i * 13;
      const name = `${FIRST[seed % FIRST.length]} ${LAST[(seed * 7) % LAST.length]}`;
      const phone = `05${40 + (seed % 9)}${String(3000000 + seed * 7919).slice(-7)}`;
      const created = new Date(Date.now() - ((seed * 37) % (55 * 24)) * 3600e3 - 3600e3);
      const res = await ingestLead(
        metaLeadToIncoming(
          {
            id: `demo-form-${fi}-${i}`,
            created_time: created.toISOString(),
            platform: seed % 3 ? "ig" : "fb",
            campaign_name: campaign,
            adset_name: seed % 2 ? "Geniş kitle" : "Benzer kitle %1",
            ad_name: `Creative ${1 + (seed % 3)}`,
            form_id: `${1000 + fi}`,
            field_data: [
              { name: "full_name", values: [name] },
              { name: "phone_number", values: [phone] },
              { name: qKey, values: [qVals[seed % qVals.length]] },
              ...(fi === 8 ? [{ name: "company_name", values: [`${LAST[seed % LAST.length]} Ticaret Ltd. Şti.`] }] : []),
            ],
          },
          form,
        ),
      );
      if (!res.ok || res.created !== "request") continue;
      n++;
      // Outcome: won by the form's rate, some lost, some still in progress, a few never called.
      const r = ((seed * 7919) % 100) / 100;
      const stage = r < winRate ? "won" : r < winRate + 0.3 ? "lost" : r < 0.85 ? "followup" : "new";
      if (stage === "new") continue;
      const contacted = new Date(created.getTime() + (4 + (seed % 9) * 11) * 60000);
      await db
        .update(schema.requests)
        .set({
          stage,
          callStatus: stage === "followup" ? ["neutral", "awaiting", "soft_no"][seed % 3] : null,
          firstContactedAt: contacted,
          stageChangedAt: contacted,
          closedAt: stage === "won" || stage === "lost" ? contacted : null,
          lostReason: stage === "lost" ? LOST_REASONS[[0, 0, 1, 2, 3, 0][seed % 6]] : null,
          assignedTo: users[seed % users.length]?.id ?? null,
        })
        .where(eq(schema.requests.id, res.requestId));
      if (stage === "won") {
        await db.update(schema.contacts).set({ lifecycle: "customer", customerSince: contacted }).where(eq(schema.contacts.id, res.contactId));
      }
    }
  }
  console.log(`Eklendi: ${n} demo lead, ${FORMS.length} form.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
