"use client";

import { Minus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type AdminCreditTransaction } from "@/api";
import { AdminPage, AdminPagination } from "../_components";
import { adminClient, formatDate } from "../admin-utils";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const changeTypeLabels: Record<string, string> = {
  grant: "发放", consume: "消耗", expire: "清零", refund: "退款", adjust: "调整"
};

const balanceTypeLabels: Record<string, string> = {
  vip_daily: "VIP 每日积分", credit_pack: "加油包积分",
};

function ChangeTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    grant: "text-emerald-600", consume: "text-red-600", expire: "text-muted-foreground",
    refund: "text-amber-600", adjust: "text-blue-600"
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium ${colors[type] ?? ""}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {changeTypeLabels[type] ?? type}
    </span>
  );
}

function BalanceTypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {balanceTypeLabels[type] ?? type}
    </span>
  );
}

function PointsDisplay({ value }: { value: number }) {
  const cls = value > 0 ? "text-emerald-600" : value < 0 ? "text-red-600" : "";
  return (
    <span className={`font-mono text-sm tabular-nums ${cls}`}>
      {value > 0 ? "+" : ""}{value.toFixed(2)}
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
      <span className="text-muted-foreground">Out:{tx.output_tokens?.toLocaleString() ?? "—"}</span>
    </div>
  );
}

function DetailContent({ tx }: { tx: AdminCreditTransaction }) {
  const isAiConsume = tx.change_type === "consume" && tx.source_type === "ai_chat";
  const isGrant = tx.change_type === "grant";

  return (
    <div className="flex flex-col gap-5 overflow-y-auto text-sm mt-2">
      <div className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-3 rounded-lg border border-border bg-muted/30 p-4">
        <span className="text-xs text-muted-foreground">流水时间</span><span>{formatDate(tx.created_at)}</span>
        <span className="text-xs text-muted-foreground">用户</span><span>{tx.user_email ?? tx.user_id}</span>
        <span className="text-xs text-muted-foreground">余额类型</span><BalanceTypeBadge type={tx.balance_type} />
        <span className="text-xs text-muted-foreground">变更类型</span><ChangeTypeBadge type={tx.change_type} />
        <span className="text-xs text-muted-foreground">来源类型</span><span className="font-mono text-xs">{tx.source_type}</span>
        <span className="text-xs text-muted-foreground">来源 ID</span><span className="font-mono text-xs">{tx.source_id ?? "—"}</span>
        <span className="text-xs text-muted-foreground">积分变动</span><PointsDisplay value={tx.points_change} />
        <span className="text-xs text-muted-foreground">变动后余额</span><span className="font-mono text-sm">{tx.points_after.toFixed(2)}</span>
      </div>

      {isAiConsume ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI 消耗详情</h3>
          <div className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <span className="text-xs text-muted-foreground">模型 ID</span><span className="font-mono text-xs">{tx.model_id ?? "—"}</span>
            <span className="text-xs text-muted-foreground">模型名称</span><span>{tx.model_name_snapshot ?? "—"}</span>
            <span className="text-xs text-muted-foreground">平台调用 ID</span><span className="font-mono text-xs">{tx.platform_call_id ?? "—"}</span>
            <span className="text-xs text-muted-foreground">关联作品</span><span>{tx.work_title ?? tx.work_id ?? "—"}</span>
            <span className="text-xs text-muted-foreground">缓存命中输入</span><span className="font-mono text-xs">{tx.cache_hit_input_tokens?.toLocaleString() ?? "—"} tokens</span>
            <span className="text-xs text-muted-foreground">缓存未命中输入</span><span className="font-mono text-xs">{tx.cache_miss_input_tokens?.toLocaleString() ?? "—"} tokens</span>
            <span className="text-xs text-muted-foreground">输出</span><span className="font-mono text-xs">{tx.output_tokens?.toLocaleString() ?? "—"} tokens</span>
            <span className="text-xs text-muted-foreground">输入成本价</span><span className="font-mono text-xs">{tx.input_cost_per_million_snapshot ?? "—"}</span>
            <span className="text-xs text-muted-foreground">缓存命中成本价</span><span className="font-mono text-xs">{tx.cache_hit_input_cost_per_million_snapshot ?? "—"}</span>
            <span className="text-xs text-muted-foreground">输出成本价</span><span className="font-mono text-xs">{tx.output_cost_per_million_snapshot ?? "—"}</span>
            <span className="text-xs text-muted-foreground">盈利倍率</span><span className="font-mono text-xs">{tx.profit_multiplier_snapshot ?? "—"}</span>
            <span className="text-xs text-muted-foreground">积分汇率</span><span className="font-mono text-xs">{tx.points_per_cny_snapshot ?? "—"}</span>
          </div>
        </section>
      ) : null}

      {isGrant && tx.source_type !== "system_adjust" ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">权益发放详情</h3>
          <div className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <span className="text-xs text-muted-foreground">订单 ID</span><span className="font-mono text-xs">{tx.order_id ?? tx.source_id ?? "—"}</span>
            <span className="text-xs text-muted-foreground">商品名称</span><span>{tx.product_name_snapshot ?? "—"}</span>
            <span className="text-xs text-muted-foreground">商品类型</span><span className="font-mono text-xs">{tx.product_type ?? "—"}</span>
            <span className="text-xs text-muted-foreground">发放积分</span><PointsDisplay value={tx.points_change} />
            <span className="text-xs text-muted-foreground">变动后余额</span><span className="font-mono text-sm">{tx.points_after.toFixed(2)}</span>
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
        q: query, balance_type: balanceType === "all" ? undefined : balanceType,
        change_type: changeType === "all" ? undefined : changeType,
        source_type: sourceType === "all" ? undefined : sourceType,
        points_min: filterNumber(pointsMin), points_max: filterNumber(pointsMax),
        time_from: timeFrom || undefined, time_to: timeTo || undefined,
        page: nextPage, pageSize
      });
      setRows(data.items);
      setTotal(data.total);
      setPage(data.page);
      setLoadError(false);
    } catch {
      setRows([]); setTotal(0); setLoadError(true);
      toast.error("积分流水加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(1); }, [query, balanceType, changeType, sourceType, pointsMin, pointsMax, timeFrom, timeTo]);

  function resetFilters() {
    setQuery(""); setBalanceType("all"); setChangeType("all"); setSourceType("all");
    setPointsMin(""); setPointsMax(""); setTimeFrom(""); setTimeTo(""); setPage(1);
  }

  const hasActiveFilters = query || balanceType !== "all" || changeType !== "all" || sourceType !== "all" || pointsMin || pointsMax || timeFrom || timeTo;

  return (
    <AdminPage>


      {/* Search + Select row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="h-9 pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索用户…" />
        </div>
        <Select value={balanceType} onValueChange={setBalanceType}>
          <SelectTrigger className="h-9 w-36" aria-label="余额类型"><SelectValue placeholder="余额类型" /></SelectTrigger>
          <SelectContent><SelectGroup>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="vip_daily">VIP 每日积分</SelectItem>
            <SelectItem value="credit_pack">加油包积分</SelectItem>
          </SelectGroup></SelectContent>
        </Select>
        <Select value={changeType} onValueChange={setChangeType}>
          <SelectTrigger className="h-9 w-32" aria-label="变更类型"><SelectValue placeholder="变更类型" /></SelectTrigger>
          <SelectContent><SelectGroup>
            <SelectItem value="all">全部变更</SelectItem>
            <SelectItem value="grant">发放</SelectItem>
            <SelectItem value="consume">消耗</SelectItem>
            <SelectItem value="expire">清零</SelectItem>
            <SelectItem value="refund">退款</SelectItem>
            <SelectItem value="adjust">调整</SelectItem>
          </SelectGroup></SelectContent>
        </Select>
        <Select value={sourceType} onValueChange={setSourceType}>
          <SelectTrigger className="h-9 w-36" aria-label="来源类型"><SelectValue placeholder="来源类型" /></SelectTrigger>
          <SelectContent><SelectGroup>
            <SelectItem value="all">全部来源</SelectItem>
            <SelectItem value="plan_vip_daily">VIP 每日发放</SelectItem>
            <SelectItem value="vip_daily_expire">VIP 每日清零</SelectItem>
            <SelectItem value="plan_bundled_credit_pack">套餐积分包</SelectItem>
            <SelectItem value="credit_pack">积分包购买</SelectItem>
            <SelectItem value="ai_chat">AI 对话</SelectItem>
            <SelectItem value="editor_check">编辑器分析</SelectItem>
            <SelectItem value="system_adjust">系统调整</SelectItem>
          </SelectGroup></SelectContent>
        </Select>
      </div>

      {/* Range filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-card">
        <span className="text-muted-foreground">积分变动:</span>
        <Input className="h-7 w-20 text-xs" inputMode="numeric" value={pointsMin} onChange={(e) => setPointsMin(e.target.value)} placeholder="min" />
        <Minus className="size-3 text-muted-foreground" />
        <Input className="h-7 w-20 text-xs" inputMode="numeric" value={pointsMax} onChange={(e) => setPointsMax(e.target.value)} placeholder="max" />
        <span className="mx-1 h-4 w-px bg-border" />
        <span className="text-muted-foreground">时间:</span>
        <Input className="h-7 w-36 text-xs" type="date" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} />
        <Minus className="size-3 text-muted-foreground" />
        <Input className="h-7 w-36 text-xs" type="date" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} />
        {hasActiveFilters && (
          <>
            <span className="mx-1 h-4 w-px bg-border" />
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetFilters}>重置筛选</Button>
          </>
        )}
      </div>

      {loading ? (
        <div className="space-y-2"><Skeleton className="h-9 w-full" /><Skeleton className="h-64 w-full" /></div>
      ) : loadError ? (
        <div className="rounded-lg border border-border bg-card p-12 shadow-card">
          <Empty><EmptyHeader><EmptyTitle>积分流水加载失败</EmptyTitle><EmptyDescription>请检查登录状态或稍后重试。</EmptyDescription></EmptyHeader>
            <Button variant="outline" size="sm" className="mx-auto mt-3" onClick={() => void load(page)}>重新加载</Button></Empty>
        </div>
      ) : !rows.length ? (
        <div className="rounded-lg border border-border bg-card p-12 shadow-card">
          <Empty><EmptyHeader><EmptyTitle>没有匹配的流水</EmptyTitle><EmptyDescription>调整筛选条件后再试。</EmptyDescription></EmptyHeader></Empty>
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card">
            <div className="overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="border-b border-border bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[150px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">流水时间</TableHead>
                    <TableHead className="w-[140px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">用户</TableHead>
                    <TableHead className="w-[90px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">余额类型</TableHead>
                    <TableHead className="w-[80px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">变更</TableHead>
                    <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">来源</TableHead>
                    <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">作品</TableHead>
                    <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">模型</TableHead>
                    <TableHead className="w-[140px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Token</TableHead>
                    <TableHead className="w-[100px] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">积分变动</TableHead>
                    <TableHead className="w-[100px] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">变动后</TableHead>
                    <TableHead className="w-[70px] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((tx) => (
                    <TableRow key={tx.id} className="border-b border-border transition-colors hover:bg-muted/30">
                      <TableCell className="text-xs tabular-nums">{formatDate(tx.created_at)}</TableCell>
                      <TableCell className="text-xs">{tx.user_email ?? tx.user_id}</TableCell>
                      <TableCell><BalanceTypeBadge type={tx.balance_type} /></TableCell>
                      <TableCell><ChangeTypeBadge type={tx.change_type} /></TableCell>
                      <TableCell><span className="font-mono text-xs">{tx.source_type}</span></TableCell>
                      <TableCell className="text-xs">{tx.work_title ?? tx.work_id ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs">{tx.model_name_snapshot ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell><TokenCell tx={tx} /></TableCell>
                      <TableCell className="text-right"><PointsDisplay value={tx.points_change} /></TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">{tx.points_after.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setDetailTx(tx)}>详情</Button>
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

      <Dialog open={!!detailTx} onOpenChange={(open) => !open && setDetailTx(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold tracking-[-0.01em]">流水详情</DialogTitle>
            <DialogDescription>
              {detailTx?.change_type === "consume" && detailTx?.source_type === "ai_chat"
                ? "AI 消耗流水完整信息"
                : detailTx?.change_type === "grant" ? "权益发放流水完整信息" : "流水完整信息"}
            </DialogDescription>
          </DialogHeader>
          {detailTx ? <DetailContent tx={detailTx} /> : null}
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
