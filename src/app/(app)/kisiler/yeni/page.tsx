import { PageHeader } from "@/components/chips";
import { NewContactForm } from "@/components/new-contact-form";

export default async function YeniKisi({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { tur } = await searchParams;
  const customer = tur === "musteri";
  return (
    <>
      <PageHeader
        title={customer ? "Yeni müşteri" : "Yeni lead"}
        sub={
          customer
            ? "Poliçesi olan biri (ör. başka acenteden gelen ya da elden kesilen). Numara bir lead'de kayıtlıysa o lead müşteriye çevrilir."
            : "Telefonla, WhatsApp'tan ya da yüz yüze gelen talepler için. Numara kayıtlıysa mevcut profile eklenir."
        }
      />
      <div className="card max-w-2xl p-6">
        <NewContactForm key={customer ? "c" : "l"} mode={customer ? "customer" : "lead"} />
      </div>
    </>
  );
}
