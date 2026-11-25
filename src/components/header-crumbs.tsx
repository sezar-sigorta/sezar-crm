"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Crumb = { label: string; href?: string };

const Ctx = createContext<{ crumbs: Crumb[] | null; set: (c: Crumb[] | null) => void }>({ crumbs: null, set: () => {} });

/** Lets a page put its own trail (e.g. "Leadler › Gizem Erdoğan") into the site header. */
export function CrumbsProvider({ children }: { children: React.ReactNode }) {
  const [crumbs, set] = useState<Crumb[] | null>(null);
  return <Ctx.Provider value={{ crumbs, set }}>{children}</Ctx.Provider>;
}

export function useCrumbs() {
  return useContext(Ctx).crumbs;
}

export function SetCrumbs({ items }: { items: Crumb[] }) {
  const { set } = useContext(Ctx);
  const key = JSON.stringify(items);
  useEffect(() => {
    set(JSON.parse(key));
    return () => set(null);
  }, [key, set]);
  return null;
}
