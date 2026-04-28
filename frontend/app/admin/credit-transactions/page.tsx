"use client";

import { Minus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type AdminCreditTransaction } from "@/api";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminPagination } from "../_components";
import { adminClient, formatDate } from "../admin-utils";

const changeTypeLabels: Record<string, string> = {
  grant: "发放",
  consume: "消耗",
  expire: "清零",
  refund: "退款",
  adjust: "调整"
};

const balanceTypeLabels: Record<string, string> = {
  vip_daily: "VIP 每日积分",
  credit_pack: "加油包积分",
};

function ChangeTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    grant: "text-emerald-600 dark:text-emerald-400",
    consume: "text-red-600 dark:text-red-400",
    expire: "text-muted-foreground",
    refund: "text-amber-600 dark:text-amber-400",
    adjust: "text-blue-600 dark:text-blue-400"
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${colors[type] ?? ""}`}>
      <span className={`size-1.5 rounded-full ${colors[type] ?? ""} bg-current`} />
      {changeTypeLabels[type] ?? type}
    </span>
  );
}

function BalanceTypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {balanceTypeLabels[type] ?? type}
    </span>
  );
}

function PointsDisplay({ value }: { value: number }) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  return (
    <span
      className={`font-mono text-sm tabular-nums ${
        isPositive ? "text-emerald-600 dark:text-emerald-400" : isNegative ? "text-red-600 dark:text-red-400" : ""
      }`}
    >
      {isPositive ? "+" : ""}
      {value.toFixed(2)}
    </span>
  );
}

function TokenCell({ tx }: { tx: AdminCreditTransaction }) {
  if (tx.cache_hit_input_tokens == null && tx.cache_miss_input_tokens == null && tx.output_tokens == null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-col gap-0.5 text-xs font-mono">
      <span className="text-muted-foreground">
        H:{tx.cache_hit_input_tokens?.toLocaleString() ?? "—"}{" "}
        M:{tx.cache_miss_input_tokens?.toLocaleString() ?? "—"}
      </span>
      <span className="text-muted-foreground">
        Out:{tx.output_tokens?.toLocaleString() ?? "—"}
      </span>
    </div>
  );
}

function DetailContent({ tx }: { tx: AdminCreditTransaction }) {
  const isAiConsume = tx.change_type === "consume" && tx.source_type === "ai_chat";
  const isGrant = tx.change_type === "grant";

  return (
    <div className="flex flex-col gap-5 overflow-y-auto text-sm">
      {/* ── Common fields ── */}
      <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-4">
        <span className="text-muted-foreground">流水时间</span>
        <span>{formatDate(tx.created_at)}</span>
        <span className="text-muted-foreground">用户</span>
        <span>{tx.user_email ?? tx.user_id}</span>
        <span className="text-muted-foreground">余额类型</span>
        <BalanceTypeBadge type={tx.balance_type} />
        <span className="text-muted-foreground">变更类型</span>
        <ChangeTypeBadge type={tx.change_type} />
        <span className="text-muted-foreground">来源类型</span>
        <span className="font-mono text-xs">{tx.source_type}</span>
        <span className="text-muted-foreground">来源 ID</span>
        <span className="font-mono text-xs">{tx.source_id ?? "—"}</span>
        <span className="text-muted-foreground">积分变动</span>
        <PointsDisplay value={tx.points_change} />
        <span className="text-muted-foreground">变动后余额</span>
        <span className="font-mono text-sm">{tx.points_after.toFixed(2)}</span>
      </div>

      {/* ── AI consume detail ── */}
      {isAiConsume ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            AI 消耗详情
          </h3>
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-4">
            <span className="text-muted-foreground">模型 ID</span>
            <span className="font-mono text-xs">{tx.model_id ?? "—"}</span>
            <span className="text-muted-foreground">模型名称</span>
            <span>{tx.model_name_snapshot ?? "—"}</span>
            <span className="text-muted-foreground">平台调用 ID</span>
            <span className="font-mono text-xs">{tx.platform_call_id ?? "—"}</span>
            <span className="text-muted-foreground">关联作品</span>
            <span>{tx.work_title ?? tx.work_id ?? "—"}</span>
            <span className="text-muted-foreground">缓存命中输入</span>
            <span className="font-mono text-xs">{tx.cache_hit_input_tokens?.toLocaleString() ?? "—"} tokens</span>
            <span className="text-muted-foreground">缓存未命中输入</span>
            <span className="font-mono text-xs">{tx.cache_miss_input_tokens?.toLocaleString() ?? "—"} tokens</span>
            <span className="text-muted-foreground">输出</span>
            <span className="font-mono text-xs">{tx.output_tokens?.toLocaleString() ?? "—"} tokens</span>
            <span className="text-muted-foreground">命中输入倍率</span>
            <span className="font-mono text-xs">{tx.cache_hit_input_multiplier_snapshot ?? "—"}</span>
            <span className="text-muted-foreground">未命中输入倍率</span>
            <span className="font-mono text-xs">{tx.cache_miss_input_multiplier_snapshot ?? "—"}</span>
            <span className="text-muted-foreground">输出倍率</span>
            <span className="font-mono text-xs">{tx.output_multiplier_snapshot ?? "—"}</span>
          </div>
        </section>
      ) : null}

      {/* ── Grant detail ── */}
      {isGrant && tx.source_type !== "system_adjust" ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            权益发放详情
          </h3>
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-4">
            <span className="text-muted-foreground">订单 ID</span>
            <span className="font-mono text-xs">{tx.order_id ?? tx.source_id ?? "—"}</span>
            <span className="text-muted-foreground">商品名称</span>
            <span>{tx.product_name_snapshot ?? "—"}</span>
            <span className="text-muted-foreground">商品类型</span>
            <span className="font-mono text-xs">{tx.product_type ?? "—"}</span>
            <span className="text-muted-foreground">发放积分</span>
            <PointsDisplay value={tx.points_change} />
            <span className="text-muted-foreground">变动后余额</span>
            <span className="font-mono text-sm">{tx.points_after.toFixed(2)}</span>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function AdminCreditTransactionsPage() {
  const client = useMemo(() => adminClient(), []);
  const [rows, setRows] = useState<AdminCreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [detailTx, setDetailTx] = useState<AdminCreditTransaction | null>(null);
  const [query, setQuery] = useState("");
  const [balanceType, setBalanceType] = useState("all");
  const [changeType, setChangeType] = useState("all");
  const [sourceType, setSourceType] = useState("all");
  const [pointsMin, setPointsMin] = useState("");
  const [pointsMax, setPointsMax] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  function filterNumber(value: string): number | undefined {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  async function load(nextPage = page) {
    setLoading(true);
    try {
      const data = await client.listAdminCreditTransactions({
        q: query,
        balance_type: balanceType === "all" ? undefined : balanceType,
        change_type: changeType === "all" ? undefined : changeType,
        source_type: sourceType === "all" ? undefined : sourceType,
        points_min: filterNumber(pointsMin),
        points_max: filterNumber(pointsMax),
        time_from: timeFrom || undefined,
        time_to: timeTo || undefined,
        page: nextPage,
        pageSize
      });
      setRows(data.items);
      setTotal(data.total);
      setPage(data.page);
      setLoadError(false);
    } catch {
      setRows([]);
      setTotal(0);
      setLoadError(true);
      toast.error("积分流水加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, balanceType, changeType, sourceType, pointsMin, pointsMax, timeFrom, timeTo]);

  function resetFilters() {
    setQuery("");
    setBalanceType("all");
    setChangeType("all");
    setSourceType("all");
    setPointsMin("");
    setPointsMax("");
    setTimeFrom("");
    setTimeTo("");
    setPage(1);
  }

  function hasActiveFilters() {
    return query || balanceType !== "all" || changeType !== "all" || sourceType !== "all" || pointsMin || pointsMax || timeFrom || timeTo;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">积分流水</h1>
          <p className="text-sm text-muted-foreground">只读查看用户积分发放、消耗、清零、退款和调整记录。</p>
        </div>
      </div>

      {loading ? (
        <div className="shrink-0 space-y-2 px-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {/* ── Search + Select filter row ── */}
          <div className="flex shrink-0 flex-wrap items-center gap-3 px-6">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                className="h-9 pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索用户邮箱或昵称…"
              />
            </div>
            <Select value={balanceType} onValueChange={(value) => setBalanceType(value)}>
              <SelectTrigger className="h-9 w-32" aria-label="筛选余额类型">
                <SelectValue placeholder="余额类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">全部余额类型</SelectItem>
                  <SelectItem value="vip_daily">VIP 每日积分</SelectItem>
                  <SelectItem value="credit_pack">加油包积分</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select value={changeType} onValueChange={(value) => setChangeType(value)}>
              <SelectTrigger className="h-9 w-32" aria-label="筛选变更类型">
                <SelectValue placeholder="变更类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">全部变更类型</SelectItem>
                  <SelectItem value="grant">发放</SelectItem>
                  <SelectItem value="consume">消耗</SelectItem>
                  <SelectItem value="expire">清零</SelectItem>
                  <SelectItem value="refund">退款</SelectItem>
                  <SelectItem value="adjust">调整</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select value={sourceType} onValueChange={(value) => setSourceType(value)}>
              <SelectTrigger className="h-9 w-40" aria-label="筛选来源类型">
                <SelectValue placeholder="来源类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">全部来源</SelectItem>
                  <SelectItem value="plan_vip_daily">VIP 每日发放</SelectItem>
                  <SelectItem value="vip_daily_expire">VIP 每日清零</SelectItem>
                  <SelectItem value="plan_bundled_credit_pack">套餐积分包</SelectItem>
                  <SelectItem value="credit_pack">积分包购买</SelectItem>
                  <SelectItem value="ai_chat">AI 对话</SelectItem>
                  <SelectItem value="editor_check">编辑器分析</SelectItem>
                  <SelectItem value="system_adjust">系统调整</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* ── Range filters row ── */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs mx-6 mt-3">
            <span className="text-muted-foreground">积分变动:</span>
            <div className="flex items-center gap-1">
              <Input
                className="h-7 w-20 text-xs"
                inputMode="numeric"
                value={pointsMin}
                onChange={(event) => setPointsMin(event.target.value)}
                placeholder="min"
              />
              <Minus className="size-3 text-muted-foreground" />
              <Input
                className="h-7 w-20 text-xs"
                inputMode="numeric"
                value={pointsMax}
                onChange={(event) => setPointsMax(event.target.value)}
                placeholder="max"
              />
            </div>
            <div className="h-4 w-px bg-border" />
            <span className="text-muted-foreground">时间范围:</span>
            <div className="flex items-center gap-1">
              <Input
                className="h-7 w-36 text-xs"
                type="date"
                value={timeFrom}
                onChange={(event) => setTimeFrom(event.target.value)}
                placeholder="开始日期"
              />
              <Minus className="size-3 text-muted-foreground" />
              <Input
                className="h-7 w-36 text-xs"
                type="date"
                value={timeTo}
                onChange={(event) => setTimeTo(event.target.value)}
                placeholder="结束日期"
              />
            </div>
            {hasActiveFilters() && (
              <>
                <div className="h-4 w-px bg-border" />
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetFilters}>
                  重置筛选
                </Button>
              </>
            )}
          </div>

          {/* ── Table area ── */}
          {loadError ? (
            <div className="flex-1 px-6 pt-4">
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>积分流水加载失败</EmptyTitle>
                  <EmptyDescription>请检查登录状态或稍后重试。</EmptyDescription>
                </EmptyHeader>
                <Button variant="outline" size="sm" className="mx-auto mt-3" onClick={() => void load(page)}>
                  重新加载
                </Button>
              </Empty>
            </div>
          ) : !rows.length ? (
            <div className="flex-1 px-6 pt-4">
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>没有匹配的流水</EmptyTitle>
                  <EmptyDescription>调整筛选条件后再试。</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border mx-6 mt-3">
                <div className="overflow-auto flex-1">
                  <Table>
                    <TableHeader className="sticky top-0 z-10">
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[150px]">流水时间</TableHead>
                        <TableHead className="w-[140px]">用户</TableHead>
                        <TableHead className="w-[90px]">余额类型</TableHead>
                        <TableHead className="w-[80px]">变更类型</TableHead>
                        <TableHead className="w-[120px]">来源类型</TableHead>
                        <TableHead className="w-[120px]">关联作品</TableHead>
                        <TableHead className="w-[120px]">模型</TableHead>
                        <TableHead className="w-[140px]">Token</TableHead>
                        <TableHead className="w-[100px] text-right">积分变动</TableHead>
                        <TableHead className="w-[100px] text-right">变动后余额</TableHead>
                        <TableHead className="w-[70px] text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((tx) => (
                        <TableRow key={tx.id} className="group transition-colors hover:bg-muted/30">
                          <TableCell>
                            <span title={tx.created_at} className="text-xs tabular-nums">
                              {formatDate(tx.created_at)}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">{tx.user_email ?? tx.user_id}</TableCell>
                          <TableCell>
                            <BalanceTypeBadge type={tx.balance_type} />
                          </TableCell>
                          <TableCell>
                            <ChangeTypeBadge type={tx.change_type} />
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs">{tx.source_type}</span>
                          </TableCell>
                          <TableCell className="text-xs">
                            {tx.work_title ?? tx.work_id ?? <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-xs">
                            {tx.model_name_snapshot ?? <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            <TokenCell tx={tx} />
                          </TableCell>
                          <TableCell className="text-right">
                            <PointsDisplay value={tx.points_change} />
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums">
                            {tx.points_after.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-xs"
                              onClick={() => setDetailTx(tx)}
                            >
                              详情
                            </Button>
                          </TableCell>
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
        </>
      )}

      {/* ── Detail Sheet ── */}
      <Sheet open={!!detailTx} onOpenChange={(open) => !open && setDetailTx(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>流水详情</SheetTitle>
            <SheetDescription>
              {detailTx?.change_type === "consume" && detailTx?.source_type === "ai_chat"
                ? "AI 消耗流水完整信息"
                : detailTx?.change_type === "grant"
                  ? "权益发放流水完整信息"
                  : "流水完整信息"}
            </SheetDescription>
          </SheetHeader>
          {detailTx ? <DetailContent tx={detailTx} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
