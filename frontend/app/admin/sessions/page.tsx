"use client";

import { AlertCircle, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type AdminSession } from "@/api";
import { AdminPage, AdminPagination } from "../_components";
import { adminClient, formatDate } from "../admin-utils";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type SessionDetail = Awaited<ReturnType<ReturnType<typeof adminClient>["getAdminSession"]>>;

export default function AdminSessionsPage() {
  const client = useMemo(() => adminClient(), []);
  const [items, setItems] = useState<AdminSession[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  async function load(nextPage = page) {
    setLoading(true);
    try {
      const data = await client.listAdminSessions({ q: query, page: nextPage, pageSize });
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
      setLoadError(false);
    } catch {
      setItems([]);
      setTotal(0);
      setLoadError(true);
      toast.error("会话列表加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(item: AdminSession) {
    try {
      setDetail(await client.getAdminSession(item.id));
    } catch {
      toast.error("会话详情加载失败");
    }
  }

  useEffect(() => { void load(); }, []);

  const runs = (detail?.agent?.runs ?? []) as Array<Record<string, unknown>>;

  return (
    <AdminPage>


      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void load(1)}
            placeholder="搜索用户、作品或会话…"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2"><Skeleton className="h-9 w-full" /><Skeleton className="h-64 w-full" /></div>
      ) : loadError ? (
        <div className="rounded-lg border border-border bg-card p-12 shadow-card">
          <Empty>
            <EmptyHeader>
              <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="size-4" />
              </div>
              <EmptyTitle>会话列表加载失败</EmptyTitle>
              <EmptyDescription>请检查登录状态或稍后重试。</EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" size="sm" className="mx-auto mt-3" onClick={() => void load(page)}>重新加载</Button>
          </Empty>
        </div>
      ) : !items.length ? (
        <div className="rounded-lg border border-border bg-card p-12 shadow-card">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>没有会话</EmptyTitle>
              <EmptyDescription>换一个关键词或清空搜索条件。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card">
            <div className="overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="border-b border-border bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">用户</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">作品</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">标题</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">来源</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">最近活跃</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className="border-b border-border transition-colors hover:bg-muted/30">
                      <TableCell className="text-sm">{item.user_email ?? item.user_id}</TableCell>
                      <TableCell className="text-sm">{item.work_title ?? item.work_id}</TableCell>
                      <TableCell className="text-sm">{item.title}</TableCell>
                      <TableCell className="text-xs font-mono">{item.source_type}</TableCell>
                      <TableCell className="text-sm">{formatDate(item.last_active_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => void openDetail(item)}>详情</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <AdminPagination page={page} pageSize={pageSize} total={total} onPageChange={(nextPage) => void load(nextPage)} />
        </>
      )}

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold tracking-[-0.01em]">会话详情</DialogTitle>
            <DialogDescription>索引信息和只读历史消息。</DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="flex flex-col gap-4 overflow-y-auto text-sm mt-6">
              <div className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <span className="text-xs text-muted-foreground">标题</span><span>{detail.session.title}</span>
                <span className="text-xs text-muted-foreground">Agent Session</span>
                <span className="truncate font-mono text-xs">{detail.session.agno_session_id}</span>
                <span className="text-xs text-muted-foreground">来源</span><span className="text-xs font-mono">{detail.session.source_type}</span>
                <span className="text-xs text-muted-foreground">最近活跃</span><span>{formatDate(detail.session.last_active_at)}</span>
              </div>
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">历史消息</h3>
                {runs.length ? runs.map((run, index) => (
                  <pre className="overflow-auto rounded-md border border-border bg-muted p-3 text-xs font-mono" key={index}>
                    {JSON.stringify(run, null, 2)}
                  </pre>
                )) : <p className="text-xs text-muted-foreground">暂无历史消息</p>}
              </section>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
