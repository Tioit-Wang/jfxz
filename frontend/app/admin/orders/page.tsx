"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type AdminOrder } from "@/api";
import { AdminHeading, AdminPage, AdminPanel, AdminPagination, StatusBadge } from "../_components";
import { adminClient, formatDate, money } from "../admin-utils";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type OrderDetail = { order: AdminOrder; payments: Array<Record<string, unknown>>; grants: Array<Record<string, unknown>> };

export default function AdminOrdersPage() {
  const client = useMemo(() => adminClient(), []);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
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
    } catch {
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

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminPage>
      <AdminHeading title="订单管理" description="查看订单、支付状态和权益发放来源。" />
      <AdminPanel
        title="订单列表"
        description="按订单号、用户或商品定位订单，详情中查看支付与积分发放记录。"
        action={
          <form className="flex w-full gap-2 md:w-auto" onSubmit={(event) => { event.preventDefault(); void load(1); }}>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="订单号、用户或商品" />
            <Button variant="outline" type="submit"><Search data-icon="inline-start" />搜索</Button>
          </form>
        }
      >
          {loading ? <Skeleton className="h-44 w-full" /> : null}
          {!loading && !orders.length ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>没有订单</EmptyTitle>
                <EmptyDescription>换一个关键词或清空搜索条件。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          {!loading && orders.length ? (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>订单编号</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead>商品</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>支付时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">{order.order_no}</TableCell>
                    <TableCell>{order.user_email ?? order.user_id}</TableCell>
                    <TableCell>{order.product_name_snapshot}</TableCell>
                    <TableCell>{money(order.amount, order.currency)}</TableCell>
                    <TableCell><StatusBadge status={order.status} /></TableCell>
                    <TableCell>{formatDate(order.paid_at)}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => void openDetail(order)}>详情</Button></TableCell>
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
            <SheetTitle>订单详情</SheetTitle>
            <SheetDescription>订单基础信息、支付记录和积分发放来源。</SheetDescription>
          </SheetHeader>
          {detail ? (
            <div className="flex flex-col gap-5 overflow-y-auto text-sm">
              <div className="grid grid-cols-2 gap-3 rounded-lg border p-4">
                <span className="text-muted-foreground">订单号</span><span className="font-mono text-xs">{detail.order.order_no}</span>
                <span className="text-muted-foreground">用户</span><span>{detail.order.user_email ?? detail.order.user_id}</span>
                <span className="text-muted-foreground">商品</span><span>{detail.order.product_name_snapshot}</span>
                <span className="text-muted-foreground">金额</span><span>{money(detail.order.amount, detail.order.currency)}</span>
                <span className="text-muted-foreground">状态</span><StatusBadge status={detail.order.status} />
                <span className="text-muted-foreground">支付时间</span><span>{formatDate(detail.order.paid_at)}</span>
              </div>
              <section className="flex flex-col gap-2">
                <h3 className="font-medium">支付记录</h3>
                {detail.payments.map((payment, index) => (
                  <pre className="overflow-auto rounded-lg border bg-muted p-3 text-xs" key={index}>{JSON.stringify(payment, null, 2)}</pre>
                ))}
              </section>
              <section className="flex flex-col gap-2">
                <h3 className="font-medium">积分发放记录</h3>
                {detail.grants.length ? detail.grants.map((grant, index) => (
                  <pre className="overflow-auto rounded-lg border bg-muted p-3 text-xs" key={index}>{JSON.stringify(grant, null, 2)}</pre>
                )) : <p className="text-muted-foreground">无积分发放记录</p>}
              </section>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </AdminPage>
  );
}
