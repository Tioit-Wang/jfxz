"use client";

import { AlertCircle, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type AdminSession } from "@/api";
import { AdminPagination } from "../_components";
import { adminClient, formatDate } from "../admin-utils";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runs = (detail?.agent?.runs ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">会话管理</h1>
          <p className="text-sm text-muted-foreground">只读查看用户会话索引和 Agent Session 基础信息。</p>
        </div>
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void load(1); }}>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="用户、作品或会话标题" />
          <Button variant="outline" type="submit"><Search className="size-4" />搜索</Button>
        </form>
      </div>

      {loading ? (
        <div className="shrink-0 space-y-2 px-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : loadError ? (
        <div className="flex-1 px-6 pt-4">
          <Empty>
            <EmptyHeader>
              <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="size-4" />
              </div>
              <EmptyTitle>会话列表加载失败</EmptyTitle>
              <EmptyDescription>请检查登录状态或稍后重试。</EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" size="sm" className="mx-auto mt-3" onClick={() => void load(page)}>
              重新加载
            </Button>
          </Empty>
        </div>
      ) : !items.length ? (
        <div className="flex-1 px-6 pt-4">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>没有会话</EmptyTitle>
              <EmptyDescription>换一个关键词或清空搜索条件。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border mx-6">
            <div className="overflow-auto flex-1">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-muted/50">
                    <TableHead>用户</TableHead>
                    <TableHead>作品</TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead>最近活跃</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className="group transition-colors hover:bg-muted/30">
                      <TableCell>{item.user_email ?? item.user_id}</TableCell>
                      <TableCell>{item.work_title ?? item.work_id}</TableCell>
                      <TableCell>{item.title}</TableCell>
                      <TableCell>{item.source_type}</TableCell>
                      <TableCell>{formatDate(item.last_active_at)}</TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => void openDetail(item)}>详情</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="shrink-0 px-6 py-2">
            <AdminPagination page={page} pageSize={pageSize} total={total} onPageChange={(nextPage) => void load(nextPage)} />
          </div>
        </>
      )}

      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>会话详情</SheetTitle>
            <SheetDescription>索引信息和只读历史消息。</SheetDescription>
          </SheetHeader>
          {detail ? (
            <div className="flex flex-col gap-4 overflow-y-auto text-sm">
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-4">
                <span className="text-muted-foreground">标题</span><span>{detail.session.title}</span>
                <span className="text-muted-foreground">Agent Session</span><span className="truncate whitespace-nowrap">{detail.session.agno_session_id}</span>
                <span className="text-muted-foreground">来源</span><span>{detail.session.source_type}</span>
                <span className="text-muted-foreground">最近活跃</span><span>{formatDate(detail.session.last_active_at)}</span>
              </div>
              <section className="flex flex-col gap-2">
                <h3 className="font-medium">历史消息</h3>
                {runs.length ? runs.map((run, index) => (
                  <pre className="overflow-auto rounded-lg border bg-muted p-3 text-xs" key={index}>{JSON.stringify(run, null, 2)}</pre>
                )) : <p className="text-muted-foreground">暂无历史消息</p>}
              </section>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
