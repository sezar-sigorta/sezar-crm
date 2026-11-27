# Sezar CRM

Sezar Sigorta'nın potansiyel müşteri (lead) ve müşteri takip sistemi. **Faz 1: lead toplama ve takip.**

- **Lead girişi:** sezarsigorta.com formları (WordPress üzerinden), Meta (Facebook/Instagram) Lead Ads, elle ekleme.
- **Tek profil:** Her telefon numarası tek kişi. Aynı kişinin farklı kanallardan doldurduğu formlar aynı profilde birleşir. Aynı ürün için 7 gün içinde gelen ikinci form yeni talep açmaz, mevcut talebin geçmişine eklenir.
- **Talepler (kanban):** Yeni → Ulaşıldı → Bilgi bekleniyor → Teklif verildi → Kazanıldı / Kaybedildi (kaybedilme nedeniyle).
- **Pano:** İlk dönüş bekleyenler (15 dk hedefi), bugünkü takipler, kaynak bazında talep / ulaşılan / kazanılan / ortalama ilk dönüş süresi.
- **Leadler / Müşteriler:** Ayrı listeler. Lead profilinde veya listede "Müşteriye dönüştür" (isteğe bağlı ilk poliçeyle). Bir talep "Kazanıldı"ya çekilince ya da poliçe eklenince kişi otomatik müşteri olur.
- **Lead profili:** Ad soyad, telefon / e-posta, geldiği kanal ve kampanya, talep ettiği poliçeler (aşamalarıyla), form cevapları, notlar ve görüşmeler, alarmlar.
- **Müşteri profili:** Ne zamandır müşteri, poliçeler (şirket, no, başlangıç, yenileme tarihi ve kalan gün, prim), "Yenilendi" (+1 yıl), notlar, alarmlar, CTA'lar (Ara, WhatsApp yenileme / ek teklif mesajı, e-posta), ek satış fırsatları.
- **Alarmlar:** Kişiye, talebe ya da poliçeye bağlı. Poliçe eklenince yenilemeden 30 ve 7 gün önce otomatik alarm kurulur. Pano'da "Bugünkü alarmlar" ve "Yaklaşan yenilemeler".

- **Raporlar:** Form / kampanya / reklam bazında talep, ulaşılan, kazanılan, dönüşüm oranı, ortalama ilk dönüş, bekleyen ve en sık kayıp nedeni (7 / 30 / 90 gün / tümü). Satıra tıklayınca Talepler o form ya da kampanyaya göre filtrelenir. Ürün form / kampanya adından tahmin edilir ("Kasko", "TSS", "DASK"…); tahmin edilemezse talep kartında ürün seçilir.
- **Belgeler:** Profile poliçe PDF'i / fotoğrafı yüklenir (PDF, JPG, PNG, WEBP; 10 MB). Dosya türü içeriğinden kontrol edilir, yalnızca giriş yapmış kullanıcılar açabilir.
- **AI (isteğe bağlı, `ANTHROPIC_API_KEY`):** "✨ AI ile oku" yüklenen poliçeden tür, şirket, poliçe no, tarihler ve primi okur; kullanıcı kontrol edip kaydeder ve belge poliçeye bağlanır. "AI analizi" profili özetler, ihtiyaçları, ek satış önerilerini, sıradaki adımı ve WhatsApp mesaj taslağını çıkarır. Model: Claude Opus 5.5 (reddedilen isteklerde sunucu tarafı yedek model açık). Profil analizine ad, telefon, e-posta, vergi no ve adres gönderilmez; serbest metinlerdeki telefon/e-posta/numaralar maskelenir. **KVKK:** Belgeler ve anonim profil yurt dışına (Anthropic) aktarılır; aydınlatma metni ve açık rıza buna göre güncellenmeli.

## Teknik yapı

Next.js 15 (App Router, server actions) · Tailwind v4 · Drizzle ORM · Postgres (canlıda Supabase, yerelde gömülü PGlite) · kendi oturum sistemi (bcrypt + imzalı çerez).

| Yol | İçerik |
|---|---|
| `src/db/schema.ts` | Tablolar: `users`, `contacts` (profil), `requests` (talep), `policies` (poliçe), `reminders` (alarm), `activities` (geçmiş), `inbox` (gelen ham veri) |
| `drizzle/` | SQL migration'ları (`npm run db:generate` ile şemadan üretilir) |
| `src/lib/ingest.ts` | Tüm kanalların ortak giriş noktası: profil bul/oluştur, talep aç ya da birleştir |
| `src/lib/website.ts` | Site formunu CRM verisine çevirir (anket kodları → okunur cevaplar) |
| `src/lib/meta.ts` | Meta lead'ini Graph API'den çeker ve CRM verisine çevirir |
| `src/app/api/intake/website` | Site formlarının ve siteden online kesilen poliçelerin (`type: "police"`) geldiği uç nokta (`x-sezar-secret` başlığı ile) |
| `src/app/api/meta/webhook` | Meta webhook'u (imza doğrulamalı) |
| `src/app/(app)/` | Ekranlar: Pano, Talepler, Leadler, Müşteriler, Kişi profili (lead / müşteri), Yeni lead, Entegrasyonlar |

## Yerelde çalıştırma

```bash
npm install
npm run seed:demo   # demo kullanıcılar + 25 örnek lead (yalnızca yerel veritabanı)
npm run dev
```

http://localhost:3000 → `cihan@sezarsigorta.com` / `sezar-demo-2026`. Yerel veritabanı `.data/` klasöründedir; sıfırlamak için klasörü silin.

Dev sunucusu açıkken production build almak için ayrı klasör kullanın, yoksa çalışan sunucu bozulur: `NEXT_DIST_DIR=.next-check npx next build`

## Canlıya alma

1. **Supabase:** Yeni proje açın (bölge: Frankfurt `eu-central-1`, KVKK için AB'de kalsın). *Project Settings → Database → Connection string → Transaction pooler* adresini kopyalayın.
2. **Tabloları oluşturun:** `DATABASE_URL="..." npm run db:migrate`
3. **Kullanıcıları ekleyin** (şifre sorulur): `DATABASE_URL="..." npm run user:add -- ad@sezarsigorta.com "Ad Soyad" admin`
4. **Belge depolama:** Supabase → *Storage* → `belgeler` adında **private** bucket. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` Vercel'e girilir (service role anahtarı yalnızca sunucuda kalır).
5. **Vercel:** Depoyu içe aktarın, `.env.example`'daki değişkenleri girin (`DATABASE_URL`, `SESSION_SECRET`, `PUBLIC_URL`, `WEBSITE_INTAKE_SECRET`). Bölge olarak Frankfurt (`fra1`) seçin. Alan adı: `crm.sezarsigorta.com`.
6. **Web sitesi:** WordPress → *Ayarlar → Genel → Sezar CRM*: adres `https://crm.sezarsigorta.com/api/intake/website`, anahtar `WEBSITE_INTAKE_SECRET`. (Tema güncellemesi `sezar-sigorta-site` deposunda.)
7. **Meta Lead Ads:**
   - developers.facebook.com'da bir uygulama (Business türü) oluşturun. *App secret* → `META_APP_SECRET`.
   - *Webhooks → Page* → callback `https://crm.sezarsigorta.com/api/meta/webhook`, verify token → `META_VERIFY_TOKEN` (kendiniz belirleyin), `leadgen` alanına abone olun.
   - Sayfa için `leads_retrieval`, `pages_manage_metadata`, `pages_show_list`, `pages_read_engagement` izinli **uzun ömürlü Page access token** alın → `META_PAGE_ACCESS_TOKEN`. Uygulamayı sayfaya bağlayın (`POST /{page-id}/subscribed_apps?subscribed_fields=leadgen`).
   - Business Manager → *Lead erişimi* bölümünde CRM uygulamasına izin verin.
   - [Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing) ile test lead'i gönderin, *Entegrasyonlar* sayfasında "İşlendi" görünmeli.
   - **Form ipucu:** Meta formlarında ad, telefon, e-posta ve şehir standart alanlarını kullanın. "Sigorta türü" adlı bir soru eklerseniz ürün oradan, yoksa form / kampanya adından ("Kasko – …") tahmin edilir.

## Bilinen sınırlar / sonraki adımlar

- Yeni lead geldiğinde bildirim yok (site formları WordPress e-postasıyla geliyor). Faz 1.5: e-posta / WhatsApp bildirimi.
- AI özellikleri canlı bir API anahtarıyla henüz denenmedi (geliştirme ortamında anahtar yoktu).
- Giriş denemesi sınırı sunucu belleğindedir (tek sunucu için yeterli).
