import type { ReactNode } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination";

export function AdminHeading({
  title,
  description,
  action
}: Readonly<{
  title: string;
  description: string;
  action?: ReactNode;
}>) {
  return (
    <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}

export function AdminPage({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="flex flex-col gap-6">{children}</div>;
}

export function AdminPanel({
  title,
  description,
  action,
  children
}: Readonly<{
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <section className="space-y-4 rounded-lg bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function StatusBadge({ status }: Readonly<{ status: string }>) {
  if (["active", "paid", "TRADE_SUCCESS"].includes(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className="size-1.5 rounded-full bg-foreground" />
        {status}
      </span>
    );
  }
  if (["inactive", "disabled", "closed"].includes(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-1.5 rounded-full bg-muted-foreground/50" />
        {status}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">{status}</span>;
}

export function AdminPagination({
  page,
  pageSize,
  total,
  onPageChange
}: Readonly<{
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}>) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= 0) return null;

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1).filter(
    (item) => item === 1 || item === pageCount || Math.abs(item - page) <= 1
  );

  function go(nextPage: number) {
    if (nextPage < 1 || nextPage > pageCount || nextPage === page) return;
    onPageChange(nextPage);
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-muted-foreground">
        第 {page} / {pageCount} 页，共 {total} 条
      </p>
      <Pagination className="mx-0 w-auto justify-start md:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              text="上一页"
              aria-disabled={page <= 1}
              className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
              onClick={(event) => {
                event.preventDefault();
                go(page - 1);
              }}
            />
          </PaginationItem>
          {pages.map((item, index) => {
            const previous = pages[index - 1];
            return (
              <PaginationItem key={item}>
                {previous && item - previous > 1 ? <span className="px-2 text-muted-foreground">...</span> : null}
                <PaginationLink
                  href="#"
                  isActive={item === page}
                  onClick={(event) => {
                    event.preventDefault();
                    go(item);
                  }}
                >
                  {item}
                </PaginationLink>
              </PaginationItem>
            );
          })}
          <PaginationItem>
            <PaginationNext
              href="#"
              text="下一页"
              aria-disabled={page >= pageCount}
              className={page >= pageCount ? "pointer-events-none opacity-50" : undefined}
              onClick={(event) => {
                event.preventDefault();
                go(page + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
