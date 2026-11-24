// Local demo data: two users and ~25 leads from the website, Meta and manual entry.
//   npm run seed:demo
// Refuses to run against DATABASE_URL so it can never touch production.
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../src/db";
import { productLabel } from "../src/lib/constants";
import { ingestLead } from "../src/lib/ingest";
import { metaLeadToIncoming } from "../src/lib/meta";
import { websitePayloadToLead } from "../src/lib/website";

if (process.env.DATABASE_URL) {
  console.error("seed:demo yalnızca yerel veritabanında çalışır (DATABASE_URL tanımlı).");
  process.exit(1);
}

const NAMES = [
  "Ayşe Yılmaz", "Mehmet Kaya", "Zeynep Demir", "Emre Şahin", "Elif Çelik", "Burak Aydın", "Selin Öztürk",
  "Can Arslan", "Deniz Koç", "Merve Kurt", "Oğuz Polat", "İrem Aksoy", "Kerem Yıldız", "Gizem Erdoğan",
  "Hakan Güneş", "Seda Çetin", "Tolga Kılıç", "Büşra Özdemir", "Serkan Aslan", "Ece Bulut", "Murat Doğan",
  "Pınar Kara", "Umut Tekin", "Damla Şimşek", "Kaan Uçar",
];

const minutesAgo = (m: number) => new Date(Date.now() - m * 60000);

async function main() {
  const db = await getDb();
  const users = [
    { email: "cihan@sezarsigorta.com", name: "Cihan Dağdeviren", role: "admin" },
    { email: "ekip@sezarsigorta.com", name: "Selin Arıkan", role: "agent" },
  ];
  const hash = await bcrypt.hash("sezar-demo-2026", 10);
  const ids: string[] = [];
  for (const u of users) {
    const [ex] = await db.select().from(schema.users).where(eq(schema.users.email, u.email));
    if (ex) ids.push(ex.id);
    else ids.push((await db.insert(schema.users).values({ ...u, passwordHash: hash }).returning())[0].id);
  }

  const phone = (i: number) => `05${(32 + (i % 8)).toString()}${String(1000000 + i * 7919).slice(0, 7)}`;
  let i = 0;
  for (const name of NAMES) {
    const age = [3, 9, 22, 47, 95, 180, 400, 900, 1500, 2900, 4400, 7000][i % 12] + i * 13;
    const kind = i % 3;
    if (kind === 0) {
      const lead = websitePayloadToLead({
        type: i % 2 ? "teklif" : "arama",
        a: { who: i % 5 === 0 ? "biz" : "fam", age: "a2", car: i % 2 ? "y" : "n", health: i % 4 ? "tss" : "ozs", extra: ["travel"] },
        c: { ad: name, tel: phone(i), k: true, p: i % 2 === 0, w: i % 4 },
        seg: "ind",
        page: ["/sigortalar/kasko-sigortasi", "/", "/sigortalar/tamamlayici-saglik-sigortasi", "/sigortalar/konut-sigortasi"][i % 4],
        lang: "tr",
      });
      await ingestLead({ ...lead, receivedAt: minutesAgo(age) });
    } else if (kind === 1) {
      const campaigns = ["TSS – Kasım – 25-45 Kadın", "Kasko – İstanbul – Lead", "Konut+DASK – Ev sahipleri"];
      await ingestLead({
        ...metaLeadToIncoming(
          {
            id: `demo${i}`,
            created_time: minutesAgo(age).toISOString(),
            platform: i % 2 ? "ig" : "fb",
            campaign_name: campaigns[i % 3],
            adset_name: "Geniş kitle",
            ad_name: `Creative ${1 + (i % 4)}`,
            form_id: "123",
            field_data: [
              { name: "full_name", values: [name] },
              { name: "phone_number", values: [`+90${phone(i).slice(1)}`] },
              { name: "email", values: [`${name.split(" ")[0].toLocaleLowerCase("tr")}@ornek.com`] },
              { name: "city", values: [["İstanbul", "Ankara", "İzmir"][i % 3]] },
              { name: "yaşınız_kaç?", values: [["26-35", "36-45", "46-55"][i % 3]] },
              { name: "ne_zaman_aranmak_istersiniz?", values: [["Hafta içi akşam", "Öğle arası", "Hemen"][i % 3]] },
            ],
          },
          campaigns[i % 3].split(" – ")[0] + " Teklif Formu",
        ),
      });
    } else {
      await ingestLead({
        fullName: name,
        phone: phone(i),
        product: (["kasko", "trafik", "dask", "evcil_hayvan"] as const)[i % 4],
        source: (["phone", "referral", "whatsapp"] as const)[i % 3],
        kvkkConsent: true,
        createdBy: ids[i % 2],
        receivedAt: minutesAgo(age),
      });
    }
    i++;
  }

  // Move some through the pipeline so every column has cards.
  const reqs = await db.select().from(schema.requests);
  const plan = ["new", "new", "followup", "followup", "followup", "won", "lost", "followup", "followup", "new"];
  const callStatuses = ["neutral", "awaiting", "soft_no"];
  for (const [k, r] of reqs.entries()) {
    const stage = plan[k % plan.length];
    if (stage === "new" && minutesSince(r.createdAt) < 600) continue;
    const contacted = new Date(r.createdAt.getTime() + (5 + (k % 7) * 9) * 60000);
    await db
      .update(schema.requests)
      .set({
        stage,
        assignedTo: ids[k % 2],
        firstContactedAt: stage === "new" ? null : contacted,
        stageChangedAt: contacted,
        lostReason: stage === "lost" ? "Fiyat yüksek bulundu" : null,
        closedAt: stage === "won" || stage === "lost" ? contacted : null,
        callStatus: stage === "followup" ? callStatuses[k % 3] : null,
        quoteAmount: stage === "followup" || stage === "won" ? String(4500 + k * 730) : null,
      })
      .where(eq(schema.requests.id, r.id));
    if (stage !== "new") {
      await db.insert(schema.activities).values({
        contactId: r.contactId,
        requestId: r.id,
        userId: ids[k % 2],
        type: "call",
        body: "Görüşüldü — ihtiyaçları konuşuldu",
        createdAt: contacted,
      });
    }
    if (stage === "followup") {
      await db.insert(schema.reminders).values({
        contactId: r.contactId,
        requestId: r.id,
        dueAt: new Date(Date.now() + ((k % 5) - 2) * 3 * 3600e3),
        title: ["Geri ara", "Teklif için dönüş al", "Ruhsat fotoğrafını iste"][k % 3],
        createdBy: ids[k % 2],
      });
    }
    if (stage === "won") await makeCustomer(r.contactId, r.product, contacted, k);
  }

  // A few long-standing customers with several policies and upcoming renewals.
  const contactsNow = await db.select().from(schema.contacts).where(eq(schema.contacts.lifecycle, "lead"));
  for (const [k, c] of contactsNow.slice(0, 4).entries()) {
    const since = new Date(Date.now() - (400 + k * 170) * 864e5);
    await makeCustomer(c.id, (["konut", "kasko", "tamamlayici_saglik", "trafik"] as const)[k], since, k + 3);
    if (k % 2 === 0) await addPolicy(c.id, "dask", k + 5);
  }
  console.log(`Demo hazır: ${reqs.length} talep. Giriş: ${users[0].email} / sezar-demo-2026`);
  process.exit(0);
}

const INS = ["Allianz", "Anadolu Sigorta", "Axa", "Sompo", "Türkiye Sigorta"];

/** Renewal dates spread from "overdue" to ~8 months out. */
async function addPolicy(contactId: string, product: string, k: number) {
  const db = await getDb();
  const end = new Date(Date.now() + ([-3, 5, 12, 26, 44, 75, 120, 240][k % 8]) * 864e5);
  const endDate = end.toISOString().slice(0, 10);
  const start = new Date(end.getTime() - 365 * 864e5).toISOString().slice(0, 10);
  const insurer = INS[k % INS.length];
  const [pol] = await db
    .insert(schema.policies)
    .values({ contactId, product, insurer, policyNo: `${90000000 + k * 7771}`, startDate: start, endDate, premium: String(3200 + k * 1150) })
    .returning();
  for (const days of [30, 7]) {
    const due = new Date(new Date(`${endDate}T10:00:00+03:00`).getTime() - days * 864e5);
    if (due > new Date())
      await db.insert(schema.reminders).values({ contactId, policyId: pol.id, dueAt: due, kind: "renewal", title: `Yenileme: ${productLabel(product)} (${insurer}) — ${days} gün kaldı` });
  }
}

async function makeCustomer(contactId: string, product: string, since: Date, k: number) {
  const db = await getDb();
  await db.update(schema.contacts).set({ lifecycle: "customer", customerSince: since }).where(eq(schema.contacts.id, contactId));
  await addPolicy(contactId, product, k);
  await db.insert(schema.activities).values({ contactId, type: "note", body: "Ödemeyi 3 taksitle yaptı. Eşinin aracı için de kasko istiyor, Ocak'ta hatırlat." });
}

function minutesSince(d: Date) {
  return (Date.now() - d.getTime()) / 60000;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
