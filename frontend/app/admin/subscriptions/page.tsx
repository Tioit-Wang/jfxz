"use client";

import { AlertCircle, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type AdminSubscription } from "@/api";
import { AdminPagination, StatusBadge } from "../_components";
import { adminClient, formatDate } from "../admin-utils";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type SubscriptionDetail = Awaited<ReturnType<ReturnType<typeof adminClient>["getAdminSubscription"]>>;

export default function AdminSubscriptionsPage() {
  const client = useMemo(() => adminClient(), []);
  const [items, setItems] = useState<AdminSubscription[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [detail, setDetail] = useState<SubscriptionDetail | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  async function load(nextPage = page) {
    setLoading(true);
    try {
      const data = await client.listAdminSubscriptions({ q: query, page: nextPage, pageSize });
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
      setLoadError(false);
    } catch {
      setItems([]);
      setTotal(0);
      setLoadError(true);
      toast.error("订阅列表加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(item: AdminSubscription) {
    try {
      setDetail(await client.getAdminSubscription(item.id));
    } catch {
      toast.error("订阅详情加载失败");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* ── Header bar ── */}
      <div className="flex shrink-0 items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">订阅管理</h1>
          <p className="text-sm text-muted-foreground">查看用户当前套餐、周期和续费时间。</p>
        </div>
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void load(1); }}>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="用户或套餐" />
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
              <EmptyTitle>订阅列表加载失败</EmptyTitle>
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
              <EmptyTitle>没有订阅</EmptyTitle>
              <EmptyDescription>换一个关键词或清空搜索条件。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <>
          {/* ── Table ── */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border mx-6">
            <div className="overflow-auto flex-1">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-muted/50">
                    <TableHead>用户</TableHead>
                    <TableHead>套餐</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>开始</TableHead>
                    <TableHead>结束</TableHead>
                    <TableHead>下次续费</TableHead>
                    <TableHead>每日积分</TableHead>
                    <TableHead>时长(天)</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className="group transition-colors hover:bg-muted/30">
                      <TableCell>{item.user_email ?? item.user_id}</TableCell>
                      <TableCell>{item.plan_name ?? item.plan_id}</TableCell>
                      <TableCell><StatusBadge status={item.status} /></TableCell>
                      <TableCell>{formatDate(item.start_at)}</TableCell>
                      <TableCell>{formatDate(item.end_at)}</TableCell>
                      <TableCell>{formatDate(item.next_renew_at)}</TableCell>
                      <TableCell>{item.daily_vip_points_snapshot}</TableCell>
                      <TableCell>{item.duration_days_snapshot}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => void openDetail(item)}>详情</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ── Pagination ── */}
          <div className="shrink-0 px-6 py-2">
            <AdminPagination page={page} pageSize={pageSize} total={total} onPageChange={(nextPage) => void load(nextPage)} />
          </div>
        </>
      )}

      {/* ── Detail Sheet ── */}
      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>订阅详情</SheetTitle>
            <SheetDescription>订阅基础信息和关联订单。</SheetDescription>
          </SheetHeader>
          {detail ? (
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-4 text-sm">
              <span className="text-muted-foreground">用户</span><span>{detail.user.email}</span>
              <span className="text-muted-foreground">套餐</span><span>{String(detail.plan.name ?? detail.subscription.plan_id)}</span>
              <span className="text-muted-foreground">状态</span><StatusBadge status={detail.subscription.status} />
              <span className="text-muted-foreground">开始时间</span><span>{formatDate(detail.subscription.start_at)}</span>
              <span className="text-muted-foreground">结束时间</span><span>{formatDate(detail.subscription.end_at)}</span>
              <span className="text-muted-foreground">关联订单</span><span>{detail.order?.order_no ?? "无"}</span>
              <span className="text-muted-foreground">每日积分快照</span><span>{detail.subscription.daily_vip_points_snapshot}</span>
              <span className="text-muted-foreground">订阅时长(天)</span><span>{detail.subscription.duration_days_snapshot}</span>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
