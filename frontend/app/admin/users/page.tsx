"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type ApiUser, type UserProfile } from "@/api";
import { AdminPagination, StatusBadge } from "../_components";
import { adminClient, formatDate } from "../admin-utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminUsersPage() {
  const client = useMemo(() => adminClient(), []);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<UserProfile | null>(null);
  const [target, setTarget] = useState<ApiUser | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  async function load(q = query, nextPage = page) {
    setLoading(true);
    try {
      const data = await client.listAdminUsers({ q, page: nextPage, pageSize });
      setUsers(data.items);
      setTotal(data.total);
      setPage(data.page);
    } catch {
      toast.error("用户列表加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(user: ApiUser) {
    try {
      setDetail(await client.getAdminUser(user.id));
    } catch {
      toast.error("用户详情加载失败");
    }
  }

  async function updateStatus() {
    if (!target) return;
    const status = target.status === "active" ? "disabled" : "active";
    try {
      const updated = await client.updateAdminUser(target.id, { status });
      setUsers((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      if (detail?.user.id === updated.id) setDetail({ ...detail, user: updated });
      toast.success("用户状态已更新");
    } catch {
      toast.error("用户状态更新失败");
    } finally {
      setTarget(null);
    }
  }

  useEffect(() => {
    void load("", 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* ── Filter Bar ── */}
      {loading ? (
        <div className="shrink-0 space-y-2 px-6">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="flex shrink-0 flex-col gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                className="h-9 pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void load(query, 1)}
                placeholder="搜索邮箱或昵称…"
              />
            </div>
          </div>

          {/* ── Table ── */}
          {!users.length ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>没有匹配的用户</EmptyTitle>
                <EmptyDescription>换一个关键词再试。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
                <div className="overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10">
                      <TableRow className="bg-muted/50">
                        <TableHead>邮箱</TableHead>
                        <TableHead>昵称</TableHead>
                        <TableHead>角色</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id} className="group transition-colors hover:bg-muted/30">
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>{user.nickname}</TableCell>
                          <TableCell>{user.role}</TableCell>
                          <TableCell><StatusBadge status={user.status} /></TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-xs"
                                onClick={() => void openDetail(user)}
                              >
                                详情
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className={`h-8 px-2 text-xs ${user.status === "active" ? "text-amber-600 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-700"}`}
                                onClick={() => setTarget(user)}
                              >
                                {user.status === "active" ? "禁用" : "启用"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="shrink-0">
                <AdminPagination page={page} pageSize={pageSize} total={total} onPageChange={(nextPage) => void load(query, nextPage)} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Detail Sheet ── */}
      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{detail?.user.email ?? "用户详情"}</SheetTitle>
          </SheetHeader>
          {detail ? (
            <div className="flex flex-col gap-4 text-sm">
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-4">
                <span className="text-muted-foreground">邮箱</span><span>{detail.user.email}</span>
                <span className="text-muted-foreground">昵称</span><span>{detail.user.nickname}</span>
                <span className="text-muted-foreground">角色</span><span>{detail.user.role}</span>
                <span className="text-muted-foreground">状态</span><StatusBadge status={detail.user.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-4">
                <span className="text-muted-foreground">当前订阅</span><span>{detail.subscription ? detail.subscription.id : "无订阅"}</span>
                <span className="text-muted-foreground">VIP 每日积分</span><span>{detail.points.vipDailyPoints}</span>
                <span className="text-muted-foreground">加油包积分</span><span>{detail.points.creditPackPoints}</span>
                <span className="text-muted-foreground">总积分</span><span>{detail.points.totalPoints}</span>
              </div>
              {detail.subscription ? (
                <p className="text-xs text-muted-foreground">订阅结束：{formatDate(detail.subscription.end_at)}</p>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* ── Status Toggle Confirmation ── */}
      <AlertDialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认更新账户状态？</AlertDialogTitle>
            <AlertDialogDescription>
              将「{target?.email}」设置为{target?.status === "active" ? "禁用" : "启用"}。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void updateStatus()}>确认</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
