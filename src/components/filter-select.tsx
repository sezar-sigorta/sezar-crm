"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ALL = "__all__";

/**
 * shadcn Select for GET filter forms. Radix Select can't hold an empty value, so the
 * "all" option uses a sentinel and a hidden input posts "" for it, as the old <select> did.
 */
export function FilterSelect({
  name,
  defaultValue,
  allLabel,
  options,
  label,
  className,
}: {
  name: string;
  defaultValue?: string;
  allLabel: string;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  const [v, setV] = useState(defaultValue || ALL);
  return (
    <>
      <input type="hidden" name={name} value={v === ALL ? "" : v} />
      <Select value={v} onValueChange={setV}>
        <SelectTrigger aria-label={label} className={cn("w-auto min-w-36", className)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
