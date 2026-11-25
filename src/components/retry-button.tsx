"use client";

import { useTransition } from "react";
import { retryInbox } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";

export function RetryButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="ghost" size="xs" className="shrink-0" disabled={pending} onClick={() => start(() => retryInbox(id))}>
      {pending ? "…" : "Tekrar dene"}
    </Button>
  );
}
