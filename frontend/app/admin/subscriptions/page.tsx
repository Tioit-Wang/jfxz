"use client";

import { AlertCircle, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type AdminSubscription } from "@/api";
import { AdminHeading, AdminPage, AdminPagination, StatusBadge } from "../_components";
import { adminClient, formatDate } from "../admin-utils";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  useEffect(() => { void load(); }, []);

  return (
    <AdminPage>
      <AdminHeading title="订阅管理" description="查看用户当前套餐、周期和续费时间。" />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void load(1)}
            placeholder="搜索用户或套餐…"
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
              <EmptyTitle>订阅列表加载失败</EmptyTitle>
              <EmptyDescription>请检查登录状态或稍后重试。</EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" size="sm" className="mx-auto mt-3" onClick={() => void load(page)}>重新加载</Button>
          </Empty>
        </div>
      ) : !items.length ? (
        <div className="rounded-lg border border-border bg-card p-12 shadow-card">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>没有订阅</EmptyTitle>
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
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">套餐</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">状态</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">开始</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">结束</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">下次续费</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">每日积分</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">时长(天)</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className="border-b border-border transition-colors hover:bg-muted/30">
                      <TableCell className="text-sm">{item.user_email ?? item.user_id}</TableCell>
                      <TableCell className="text-sm">{item.plan_name ?? item.plan_id}</TableCell>
                      <TableCell><StatusBadge status={item.status} /></TableCell>
                      <TableCell className="text-sm">{formatDate(item.start_at)}</TableCell>
                      <TableCell className="text-sm">{formatDate(item.end_at)}</TableCell>
                      <TableCell className="text-sm">{formatDate(item.next_renew_at)}</TableCell>
                      <TableCell className="text-sm">{item.daily_vip_points_snapshot}</TableCell>
                      <TableCell className="text-sm">{item.duration_days_snapshot}</TableCell>
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
            <DialogTitle className="text-lg font-semibold tracking-[-0.01em]">订阅详情</DialogTitle>
            <DialogDescription>订阅基础信息和关联订单。</DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm mt-6">
              <span className="text-xs text-muted-foreground">用户</span><span>{detail.user.email}</span>
              <span className="text-xs text-muted-foreground">套餐</span><span>{String(detail.plan.name ?? detail.subscription.plan_id)}</span>
              <span className="text-xs text-muted-foreground">状态</span><StatusBadge status={detail.subscription.status} />
              <span className="text-xs text-muted-foreground">开始时间</span><span>{formatDate(detail.subscription.start_at)}</span>
              <span className="text-xs text-muted-foreground">结束时间</span><span>{formatDate(detail.subscription.end_at)}</span>
              <span className="text-xs text-muted-foreground">关联订单</span><span className="font-mono text-xs">{detail.order?.order_no ?? "无"}</span>
              <span className="text-xs text-muted-foreground">每日积分快照</span><span>{detail.subscription.daily_vip_points_snapshot}</span>
              <span className="text-xs text-muted-foreground">订阅时长(天)</span><span>{detail.subscription.duration_days_snapshot}</span>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
