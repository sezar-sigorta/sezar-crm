import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PRIVACY_LINES, PRIVACY_TITLE } from "@/lib/privacy-text";

// Public (no login): the privacy policy URL given to Meta while sezarsigorta.com is in "Coming Soon" mode.
export const metadata: Metadata = {
  title: `${PRIVACY_TITLE} | Sezar Sigorta`,
  robots: { index: false, follow: false },
  alternates: { canonical: "https://www.sezarsigorta.com/gizlilik-politikasi/" },
};

export default function PrivacyPage() {
  const blocks: ReactNode[] = [];
  let items: string[] = [];
  const flush = () => {
    if (items.length) blocks.push(<ul key={`ul${blocks.length}`} className="mb-4 list-disc space-y-1.5 pl-5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>);
    items = [];
  };
  for (const line of PRIVACY_LINES) {
    if (line.startsWith("- ")) {
      items.push(line.slice(2));
      continue;
    }
    flush();
    if (line.startsWith("## ")) blocks.push(<h2 key={blocks.length} className="mb-3 mt-8 font-display text-xl font-semibold">{line.slice(3)}</h2>);
    else blocks.push(<p key={blocks.length} className="mb-4">{line}</p>);
  }
  flush();

  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:py-12">
      <Card className="mx-auto max-w-3xl">
        <CardContent className="px-5 leading-7 sm:px-10 sm:py-4">
          <article>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.svg" alt="" className="size-9 rounded-lg" />
              <p className="text-sm font-medium text-muted-foreground">Sezar Sigorta</p>
            </div>
            <h1 className="mt-4 font-display text-3xl font-semibold">{PRIVACY_TITLE}</h1>
            <Separator className="my-6" />
            {blocks}
          </article>
        </CardContent>
      </Card>
    </main>
  );
}
