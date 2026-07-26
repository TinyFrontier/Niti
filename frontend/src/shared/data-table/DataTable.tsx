import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  /** `numbered` adds page buttons and a "Showing x–y of z" label. */
  pagination?: "simple" | "numbered";
  /** Tabs, filters and the like, rendered inside the card above the table. */
  toolbar?: React.ReactNode;
}

type PageItem = number | "ellipsis";

/** First and last page always visible, a sliding window of three around the current one. */
function pageItems(page: number, lastPage: number): PageItem[] {
  if (lastPage <= 7) return Array.from({ length: lastPage }, (_, i) => i + 1);

  const start = Math.max(2, Math.min(page - 1, lastPage - 3));
  const end = Math.min(lastPage - 1, Math.max(page + 1, 4));
  const items: PageItem[] = [1];
  if (start > 2) items.push("ellipsis");
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < lastPage - 1) items.push("ellipsis");
  items.push(lastPage);
  return items;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyState,
  onRowClick,
  page = 1,
  pageSize = 20,
  total = 0,
  onPageChange,
  pagination = "simple",
  toolbar,
}: DataTableProps<T>) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const isEmpty = !loading && rows.length === 0;
  const numbered = pagination === "numbered";
  // a numbered pager stays put on a single page so filters do not shift the layout
  const showPager = Boolean(onPageChange) && !isEmpty && (numbered ? total > 0 : total > pageSize);

  // without a toolbar there is no card worth keeping around an empty result
  if (isEmpty && !toolbar) {
    return <>{emptyState}</>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-raised shadow-card">
      {toolbar}
      {isEmpty ? (
        <div className="px-4 py-6">{emptyState}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground",
                      col.className,
                      col.headerClassName,
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      {columns.map((col) => (
                        <td key={col.key} className="px-4 py-3.5">
                          <Skeleton className="h-4 w-full max-w-32" />
                        </td>
                      ))}
                    </tr>
                  ))
                : rows.map((row) => (
                    <tr
                      key={rowKey(row)}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn(
                        "border-b border-border transition-colors last:border-0",
                        onRowClick && "cursor-pointer hover:bg-primary-subtle/45",
                      )}
                    >
                      {columns.map((col) => (
                        <td key={col.key} className={cn("px-4 py-3.5", col.className)}>
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
      {showPager && onPageChange && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface/50 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {numbered ? `Showing ${from}–${to} of ${total}` : `${from}–${to} of ${total}`}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft />
            </Button>
            {numbered &&
              pageItems(page, lastPage).map((item, index) =>
                item === "ellipsis" ? (
                  <span
                    key={`ellipsis-${index}`}
                    aria-hidden="true"
                    className="px-1 text-xs text-muted-foreground"
                  >
                    …
                  </span>
                ) : (
                  <Button
                    key={item}
                    variant={item === page ? "default" : "ghost"}
                    size="icon-sm"
                    aria-label={`Page ${item}`}
                    aria-current={item === page ? "page" : undefined}
                    onClick={() => onPageChange(item)}
                  >
                    {item}
                  </Button>
                ),
              )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next page"
              disabled={page >= lastPage}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
