"use client";

import * as React from "react";
import {
  type Column,
  type ColumnDef,
  type ColumnVisibilityState,
  type RowData,
  type SortingState,
  FlexRender,
  columnVisibilityFeature,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon, Columns3Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Features every list table in the CRM uses (v9 tree-shakes the rest). */
export const tableFeats = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSortingFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
});
export type Feats = typeof tableFeats;

/** Clickable column header that cycles the sort order. */
export function SortHeader<T extends RowData, V>({ column, label, className }: { column: Column<Feats, T, V>; label: string; className?: string }) {
  const s = column.getIsSorted();
  const Icon = s === "asc" ? ArrowUpIcon : s === "desc" ? ArrowDownIcon : ArrowUpDownIcon;
  return (
    <Button variant="ghost" size="sm" className={cn("-ml-2.5 h-8 data-[sorted=true]:text-foreground", className)} data-sorted={!!s} onClick={() => column.toggleSorting(s === "asc")}>
      {label}
      <Icon className={cn("size-3.5", !s && "text-muted-foreground/60")} />
    </Button>
  );
}

export function DataTable<T extends RowData>({
  data,
  columns,
  labels,
  getRowId,
  initialSorting = [],
  initialHidden = [],
  pageSize = 20,
  empty = "Kayıt yok.",
  toolbar,
  minWidth,
}: {
  data: T[];
  columns: ColumnDef<Feats, T, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** Column id → label for the column picker. */
  labels: Record<string, string>;
  getRowId: (row: T) => string;
  initialSorting?: SortingState;
  initialHidden?: string[];
  pageSize?: number;
  empty?: React.ReactNode;
  /** Left side of the toolbar (counts, filters…). */
  toolbar?: React.ReactNode;
  minWidth?: number;
}) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>(() => Object.fromEntries(initialHidden.map((id) => [id, false])));
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize });

  const table = useTable({
    features: tableFeats,
    data,
    columns,
    state: { sorting, columnVisibility, pagination },
    getRowId,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  });

  const total = data.length;
  const { pageIndex, pageSize: size } = table.state.pagination;
  const from = total ? pageIndex * size + 1 : 0;
  const to = Math.min(total, (pageIndex + 1) * size);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3Icon data-icon="inline-start" />
              Sütunlar
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {table
              .getAllColumns()
              .filter((c) => c.getCanHide() && labels[c.id])
              .map((c) => (
                <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)} onSelect={(e) => e.preventDefault()}>
                  {labels[c.id]}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table style={minWidth ? { minWidth } : undefined}>
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => (
                  <TableHead key={h.id} colSpan={h.colSpan} className="first:pl-4 last:pr-4">
                    {h.isPlaceholder ? null : <FlexRender header={h} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="first:pl-4 last:pr-4">
                      <FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center whitespace-normal text-muted-foreground">
                  {empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-4 px-1">
        <div className="hidden flex-1 text-sm text-muted-foreground sm:block">
          {total ? `${from}–${to} / ${total} kayıt` : "0 kayıt"}
        </div>
        <div className="flex w-full items-center gap-6 sm:w-fit lg:gap-8">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="rows-per-page" className="text-sm font-medium">
              Sayfa başına
            </Label>
            <Select value={`${size}`} onValueChange={(v) => table.setPageSize(Number(v))}>
              <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectGroup>
                  {[10, 20, 50, 100].map((n) => (
                    <SelectItem key={n} value={`${n}`}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-fit items-center justify-center text-sm font-medium">
            Sayfa {pageIndex + 1} / {Math.max(1, table.getPageCount())}
          </div>
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <Button variant="outline" size="icon" className="hidden size-8 lg:flex" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
              <span className="sr-only">İlk sayfa</span>
              <ChevronsLeftIcon />
            </Button>
            <Button variant="outline" size="icon" className="size-8" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              <span className="sr-only">Önceki sayfa</span>
              <ChevronLeftIcon />
            </Button>
            <Button variant="outline" size="icon" className="size-8" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              <span className="sr-only">Sonraki sayfa</span>
              <ChevronRightIcon />
            </Button>
            <Button variant="outline" size="icon" className="hidden size-8 lg:flex" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
              <span className="sr-only">Son sayfa</span>
              <ChevronsRightIcon />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
