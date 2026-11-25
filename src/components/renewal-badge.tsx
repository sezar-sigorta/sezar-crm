import { daysUntil } from "@/lib/format";
import { Chip } from "./chips";

/** "12 gün kaldı" badge: red ≤ 7 days or past, amber ≤ 30, neutral otherwise. */
export function RenewalBadge({ ymd }: { ymd: string | null }) {
  const d = daysUntil(ymd);
  if (d == null) return null;
  const tone =
    d < 0
      ? "border-red-200 bg-red-50 text-red-700"
      : d <= 7
        ? "border-orange-200 bg-orange-50 text-brand"
        : d <= 30
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-line bg-white text-ink-2";
  const text = d < 0 ? `${-d} gün geçti` : d === 0 ? "bugün" : `${d} gün kaldı`;
  return <Chip tone={tone}>{text}</Chip>;
}
