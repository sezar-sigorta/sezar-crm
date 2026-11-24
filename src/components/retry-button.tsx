"use client";

import { useTransition } from "react";
import { retryInbox } from "@/app/(app)/actions";

export function RetryButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn-ghost shrink-0 px-2 py-1 text-xs" disabled={pending} onClick={() => start(() => retryInbox(id))}>
      {pending ? "…" : "Tekrar dene"}
    </button>
  );
}
