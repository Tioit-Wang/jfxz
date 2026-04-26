"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type AdminSubscription } from "@/api";
import { AdminHeading, AdminPage, AdminPanel, AdminPagination, StatusBadge } from "../_components";
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
    } catch {
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
    <AdminPage>
      <AdminHeading title="订阅管理" description="查看用户当前套餐、周期和续费时间。" />
      <AdminPanel
        title="订阅列表"
        description="按用户或套餐检索订阅，详情中查看关联订单。"
        action={
          <form className="flex w-full gap-2 md:w-auto" onSubmit={(event) => { event.preventDefault(); void load(1); }}>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="用户或套餐" />
            <Button variant="outline" type="submit"><Search data-icon="inline-start" />搜索</Button>
          </form>
        }
      >
          {loading ? <Skeleton className="h-44 w-full" /> : null}
          {!loading && !items.length ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>没有订阅</EmptyTitle>
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
                  <TableHead>套餐</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>开始</TableHead>
                  <TableHead>结束</TableHead>
                  <TableHead>下次续费</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.user_email ?? item.user_id}</TableCell>
                    <TableCell>{item.plan_name ?? item.plan_id}</TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    <TableCell>{formatDate(item.start_at)}</TableCell>
                    <TableCell>{formatDate(item.end_at)}</TableCell>
                    <TableCell>{formatDate(item.next_renew_at)}</TableCell>
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
            <SheetTitle>订阅详情</SheetTitle>
            <SheetDescription>订阅基础信息和关联订单。</SheetDescription>
          </SheetHeader>
          {detail ? (
            <div className="grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm">
              <span className="text-muted-foreground">用户</span><span>{detail.user.email}</span>
              <span className="text-muted-foreground">套餐</span><span>{String(detail.plan.name ?? detail.subscription.plan_id)}</span>
              <span className="text-muted-foreground">状态</span><StatusBadge status={detail.subscription.status} />
              <span className="text-muted-foreground">开始时间</span><span>{formatDate(detail.subscription.start_at)}</span>
              <span className="text-muted-foreground">结束时间</span><span>{formatDate(detail.subscription.end_at)}</span>
              <span className="text-muted-foreground">关联订单</span><span>{detail.order?.order_no ?? "无"}</span>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </AdminPage>
  );
}
