"use client";

import { AlertCircle, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type AdminOrder } from "@/api";
import { AdminHeading, AdminPage, AdminPagination, StatusBadge } from "../_components";
import { adminClient, formatDate, money } from "../admin-utils";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type OrderDetail = { order: AdminOrder; payments: Array<Record<string, unknown>>; grants: Array<Record<string, unknown>> };

export default function AdminOrdersPage() {
  const client = useMemo(() => adminClient(), []);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  async function load(nextPage = page) {
    setLoading(true);
    try {
      const data = await client.listAdminOrders({ q: query, page: nextPage, pageSize });
      setOrders(data.items);
      setTotal(data.total);
      setPage(data.page);
      setLoadError(false);
    } catch {
      setOrders([]);
      setTotal(0);
      setLoadError(true);
      toast.error("订单列表加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(order: AdminOrder) {
    try {
      setDetail(await client.getAdminOrder(order.id));
    } catch {
      toast.error("订单详情加载失败");
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <AdminPage>
      <AdminHeading title="订单管理" description="查看订单、支付状态和权益发放来源。" />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void load(1)}
            placeholder="搜索订单号、用户或商品…"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-border bg-card p-12 shadow-card">
          <Empty>
            <EmptyHeader>
              <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="size-4" />
              </div>
              <EmptyTitle>订单列表加载失败</EmptyTitle>
              <EmptyDescription>请检查登录状态或稍后重试。</EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" size="sm" className="mx-auto mt-3" onClick={() => void load(page)}>重新加载</Button>
          </Empty>
        </div>
      ) : !orders.length ? (
        <div className="rounded-lg border border-border bg-card p-12 shadow-card">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>没有订单</EmptyTitle>
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
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">订单编号</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">用户</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">商品</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">金额</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">状态</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">支付时间</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className="border-b border-border transition-colors hover:bg-muted/30">
                      <TableCell className="font-mono text-xs">{order.order_no}</TableCell>
                      <TableCell className="text-sm">{order.user_email ?? order.user_id}</TableCell>
                      <TableCell className="text-sm">{order.product_name_snapshot}</TableCell>
                      <TableCell className="text-sm">{money(order.amount, order.currency)}</TableCell>
                      <TableCell><StatusBadge status={order.status} /></TableCell>
                      <TableCell className="text-sm">{formatDate(order.paid_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => void openDetail(order)}>详情</Button>
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

      {/* Detail Sheet */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold tracking-[-0.01em]">订单详情</DialogTitle>
            <DialogDescription>订单基础信息、支付记录和积分发放来源。</DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="flex flex-col gap-5 overflow-y-auto text-sm mt-6">
              <div className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <span className="text-xs text-muted-foreground">订单号</span>
                <span className="font-mono text-xs">{detail.order.order_no}</span>
                <span className="text-xs text-muted-foreground">用户</span>
                <span>{detail.order.user_email ?? detail.order.user_id}</span>
                <span className="text-xs text-muted-foreground">商品</span>
                <span>{detail.order.product_name_snapshot}</span>
                <span className="text-xs text-muted-foreground">金额</span>
                <span>{money(detail.order.amount, detail.order.currency)}</span>
                <span className="text-xs text-muted-foreground">状态</span>
                <StatusBadge status={detail.order.status} />
                <span className="text-xs text-muted-foreground">支付时间</span>
                <span>{formatDate(detail.order.paid_at)}</span>
              </div>
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">支付记录</h3>
                {detail.payments.map((payment, index) => (
                  <pre className="overflow-auto rounded-md border border-border bg-muted p-3 text-xs font-mono" key={index}>
                    {JSON.stringify(payment, null, 2)}
                  </pre>
                ))}
              </section>
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">积分发放记录</h3>
                {detail.grants.length ? detail.grants.map((grant, index) => (
                  <pre className="overflow-auto rounded-md border border-border bg-muted p-3 text-xs font-mono" key={index}>
                    {JSON.stringify(grant, null, 2)}
                  </pre>
                )) : <p className="text-xs text-muted-foreground">无积分发放记录</p>}
              </section>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
