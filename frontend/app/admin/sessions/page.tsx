"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type AdminSession } from "@/api";
import { AdminHeading, AdminPage, AdminPanel, AdminPagination } from "../_components";
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
    } catch {
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
    <AdminPage>
      <AdminHeading title="会话管理" description="只读查看用户会话索引和 Agent Session 基础信息。" />
      <AdminPanel
        title="会话列表"
        description="按用户、作品或标题查找会话，详情保持只读审计视角。"
        action={
          <form className="flex w-full gap-2 md:w-auto" onSubmit={(event) => { event.preventDefault(); void load(1); }}>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="用户、作品或会话标题" />
            <Button variant="outline" type="submit"><Search data-icon="inline-start" />搜索</Button>
          </form>
        }
      >
          {loading ? <Skeleton className="h-44 w-full" /> : null}
          {!loading && !items.length ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>没有会话</EmptyTitle>
                <EmptyDescription>换一个关键词或清空搜索条件。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          {!loading && items.length ? (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
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
                  <TableRow key={item.id}>
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
          ) : null}
          {!loading ? (
            <AdminPagination page={page} pageSize={pageSize} total={total} onPageChange={(nextPage) => void load(nextPage)} />
          ) : null}
      </AdminPanel>
      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>会话详情</SheetTitle>
            <SheetDescription>索引信息和只读历史消息。</SheetDescription>
          </SheetHeader>
          {detail ? (
            <div className="flex flex-col gap-4 overflow-y-auto text-sm">
              <div className="grid grid-cols-2 gap-3 rounded-lg border p-4">
                <span className="text-muted-foreground">标题</span><span>{detail.session.title}</span>
                <span className="text-muted-foreground">Agent Session</span><span className="truncate">{detail.session.agno_session_id}</span>
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
    </AdminPage>
  );
}
