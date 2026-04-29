"use client";

import { AlertCircle, ChevronDown, ChevronUp, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { type AdminProductInput, type AdminProductKind, type AiModelOption, type CostPreviewOut } from "@/api";
import { AdminPagination, StatusBadge } from "../_components";
import { adminClient, money } from "../admin-utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ProductRow = Record<string, unknown> & { id: string; name: string; status: string };
type ProductForm = {
  id?: string;
  kind: AdminProductKind;
  name: string;
  priceAmount: string;
  vipDailyPoints: string;
  bundledCreditPackPoints: string;
  points: string;
  status: string;
  sortOrder: string;
};
type StatusFilter = "all" | "active" | "inactive";

const emptyPlan: ProductForm = {
  kind: "plans",
  name: "",
  priceAmount: "0.00",
  vipDailyPoints: "0",
  bundledCreditPackPoints: "0",
  points: "0",
  status: "active",
  sortOrder: ""
};
const emptyTopup: ProductForm = {
  kind: "credit-packs",
  name: "",
  priceAmount: "0.00",
  vipDailyPoints: "0",
  bundledCreditPackPoints: "0",
  points: "0",
  status: "active",
  sortOrder: ""
};

function asString(value: unknown): string {
  return value == null ? "" : String(value);
}

function asNumber(value: unknown): number {
  return Number(value ?? 0);
}

function formPayload(form: ProductForm): AdminProductInput {
  const base = {
    name: form.name,
    priceAmount: form.priceAmount,
    status: form.status,
    sortOrder: form.sortOrder === "" ? null : Number(form.sortOrder)
  };
  if (form.kind === "plans") {
    return {
      ...base,
      vipDailyPoints: Number(form.vipDailyPoints || 0),
      bundledCreditPackPoints: Number(form.bundledCreditPackPoints || 0),
    };
  }
  return {
    ...base,
    points: Number(form.points || 0),
  };
}

function rowStatusPayload(kind: AdminProductKind, row: ProductRow, status: string): AdminProductInput {
  const base = {
    name: row.name,
    priceAmount: asString(row.price_amount),
    status,
    sortOrder: row.sort_order == null ? null : Number(row.sort_order),
  };
  if (kind === "plans") {
    return {
      ...base,
      vipDailyPoints: asNumber(row.vip_daily_points),
      bundledCreditPackPoints: asNumber(row.bundled_credit_pack_points),
    };
  }
  return {
    ...base,
    points: asNumber(row.points),
  };
}

export default function AdminProductsPage() {
  const client = useMemo(() => adminClient(), []);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState<ProductForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: AdminProductKind; row: ProductRow } | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ kind: AdminProductKind; row: ProductRow } | null>(null);
  const [activeKind, setActiveKind] = useState<AdminProductKind>("plans");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  // Cost preview state
  const [models, setModels] = useState<AiModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [costPreview, setCostPreview] = useState<CostPreviewOut | null>(null);
  const [costPreviewLoading, setCostPreviewLoading] = useState(false);
  const [costPreviewOpen, setCostPreviewOpen] = useState(false);
  const costPreviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load models for cost preview selector
  useEffect(() => {
    client.listAiModels().then((list) => {
      setModels(list);
      if (list.length > 0 && !selectedModelId) {
        setSelectedModelId(list[0].id);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced cost preview fetch
  useEffect(() => {
    if (!form || form.kind !== "plans" || !selectedModelId) {
      setCostPreview(null);
      return;
    }
    if (costPreviewTimer.current) clearTimeout(costPreviewTimer.current);
    costPreviewTimer.current = setTimeout(async () => {
      setCostPreviewLoading(true);
      try {
        const result = await client.previewPlanCost({
          modelId: selectedModelId,
          bundledCreditPackPoints: Number(form.bundledCreditPackPoints || 0),
          dailyVipPoints: Number(form.vipDailyPoints || 0),
          durationDays: 31,
          priceAmount: form.priceAmount || undefined,
        });
        setCostPreview(result);
      } catch {
        setCostPreview(null);
      } finally {
        setCostPreviewLoading(false);
      }
    }, 500);
    return () => {
      if (costPreviewTimer.current) clearTimeout(costPreviewTimer.current);
    };
  }, [form?.bundledCreditPackPoints, form?.vipDailyPoints, form?.priceAmount, form?.kind, selectedModelId, client]);

  async function load(kind = activeKind, nextPage = page) {
    setLoading(true);
    try {
      const data = await client.listAdminProductsPage(kind, {
        q: query,
        status: statusFilter === "all" ? undefined : statusFilter,
        page: nextPage,
        pageSize
      });
      setRows(data.items as ProductRow[]);
      setTotal(data.total);
      setPage(data.page);
      setLoadError(false);
    } catch {
      setRows([]);
      setTotal(0);
      setLoadError(true);
      toast.error("商品列表加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(activeKind, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKind, query, statusFilter]);

  function edit(kind: AdminProductKind, row: ProductRow) {
    setForm({
      id: row.id,
      kind,
      name: row.name,
      priceAmount: asString(row.price_amount),
      vipDailyPoints: asString(row.vip_daily_points ?? 0),
      bundledCreditPackPoints: asString(row.bundled_credit_pack_points ?? 0),
      points: asString(row.points ?? 0),
      status: row.status,
      sortOrder: row.sort_order == null ? "" : asString(row.sort_order)
    });
  }

  async function toggleStatus() {
    if (!statusTarget) return;
    const newStatus = statusTarget.row.status === "active" ? "inactive" : "active";
    try {
      await client.updateAdminProduct(statusTarget.kind, statusTarget.row.id, rowStatusPayload(statusTarget.kind, statusTarget.row, newStatus));
      await load(statusTarget.kind, page);
      toast.success(`商品已${newStatus === "active" ? "启用" : "停用"}`);
    } catch {
      toast.error("状态更新失败");
    } finally {
      setStatusTarget(null);
    }
  }

  async function save() {
    if (!form?.name.trim()) {
      toast.error("请填写商品名称");
      return;
    }
    const priceNum = Number(form.priceAmount);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("请输入有效的价格（大于等于 0）");
      return;
    }
    if (form.kind === "plans") {
      if (form.vipDailyPoints === "" || form.bundledCreditPackPoints === "") {
        toast.error("请填写所有积分字段");
        return;
      }
      if (isNaN(Number(form.vipDailyPoints)) || Number(form.vipDailyPoints) < 0 ||
          isNaN(Number(form.bundledCreditPackPoints)) || Number(form.bundledCreditPackPoints) < 0) {
        toast.error("积分数量不能为负数");
        return;
      }
    } else {
      if (form.points === "") {
        toast.error("请填写积分数量");
        return;
      }
      if (isNaN(Number(form.points)) || Number(form.points) < 0) {
        toast.error("积分数量不能为负数");
        return;
      }
    }
    try {
      const savedKind = form.kind;
      const payload = formPayload(form);
      if (form.id) await client.updateAdminProduct(savedKind, form.id, payload);
      else await client.createAdminProduct(savedKind, payload);
      setForm(null);
      setActiveKind(savedKind);
      await load(savedKind, 1);
      toast.success("商品已保存");
    } catch {
      toast.error("商品保存失败");
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    try {
      await client.deleteAdminProduct(deleteTarget.kind, deleteTarget.row.id);
      setDeleteTarget(null);
      await load(deleteTarget.kind, page);
      toast.success("商品已停用");
    } catch {
      toast.error("商品删除失败");
    }
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("all");
    setPage(1);
  }

  const hasActiveFilters = query || statusFilter !== "all";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Tabs value={activeKind} onValueChange={(value) => setActiveKind(value as AdminProductKind)}>
            <TabsList className="grid w-full grid-cols-2 sm:w-72">
              <TabsTrigger value="plans">套餐</TabsTrigger>
              <TabsTrigger value="credit-packs">加油包</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setForm(emptyPlan)}><Plus className="size-4" />新建套餐</Button>
          <Button variant="outline" onClick={() => setForm(emptyTopup)}><Plus className="size-4" />新建加油包</Button>
        </div>
      </div>

      {loading ? (
        <div className="shrink-0 space-y-2 px-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {/* ── Search & Filter row ── */}
          <div className="flex shrink-0 items-center gap-3 px-6">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                className="h-9 pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索商品名称…"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="h-9 w-32" aria-label="筛选商品状态">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="inactive">inactive</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="outline" className="h-9" onClick={resetFilters}>重置筛选</Button>
            )}
          </div>

          {/* ── Error state ── */}
          {loadError ? (
            <div className="flex-1 px-6 pt-4">
              <Empty>
                <EmptyHeader>
                  <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <AlertCircle className="size-4" />
                  </div>
                  <EmptyTitle>商品列表加载失败</EmptyTitle>
                  <EmptyDescription>请检查登录状态或稍后重试。</EmptyDescription>
                </EmptyHeader>
                <Button variant="outline" size="sm" className="mx-auto mt-3" onClick={() => void load(activeKind, page)}>
                  重新加载
                </Button>
              </Empty>
            </div>
          ) : !rows.length ? (
            /* ── Empty state ── */
            <div className="flex-1 px-6 pt-4">
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>没有匹配商品</EmptyTitle>
                  <EmptyDescription>调整关键词或状态筛选后再试。</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <>
              {/* ── Table (fills remaining height) ── */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border mx-6 mt-3">
                <div className="overflow-auto flex-1">
                  <Table>
                    <TableHeader className="sticky top-0 z-10">
                      <TableRow className="bg-muted/50">
                        <TableHead>商品名称</TableHead>
                        <TableHead>价格</TableHead>
                        <TableHead>{activeKind === "plans" ? "VIP 每日积分 / 附带加油包" : "积分数量"}</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id} className="group transition-colors hover:bg-muted/30">
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>{money(row.price_amount, asString(row.price_currency || "CNY"))}</TableCell>
                          <TableCell>
                            {activeKind === "plans"
                              ? `${asNumber(row.vip_daily_points)} / ${asNumber(row.bundled_credit_pack_points)}`
                              : `${asNumber(row.points)}`}
                          </TableCell>
                          <TableCell><StatusBadge status={row.status} /></TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-xs"
                                onClick={() => edit(activeKind, row)}
                              >
                                编辑
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className={`h-8 px-2 text-xs ${row.status === "active" ? "text-amber-600 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-700"}`}
                                onClick={() => setStatusTarget({ kind: activeKind, row })}
                              >
                                {row.status === "active" ? "停用" : "启用"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget({ kind: activeKind, row })}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* ── Pagination ── */}
              <div className="shrink-0 px-6 py-2">
                <AdminPagination page={page} pageSize={pageSize} total={total} onPageChange={(nextPage) => void load(activeKind, nextPage)} />
              </div>
            </>
          )}
        </>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "编辑商品" : "新建商品"}</DialogTitle>
            <DialogDescription>保存后会立即影响用户端可见商品。</DialogDescription>
          </DialogHeader>
          {form ? (
            <>
            <FieldGroup>
              <Field><FieldLabel htmlFor="product-name">名称</FieldLabel><Input id="product-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
              <Field><FieldLabel htmlFor="product-price">价格</FieldLabel><Input id="product-price" value={form.priceAmount} onChange={(event) => setForm({ ...form, priceAmount: event.target.value })} /></Field>
              {form.kind === "plans" ? (
                <>
                  <Field><FieldLabel htmlFor="product-vip-daily-points">VIP 每日积分</FieldLabel><Input id="product-vip-daily-points" inputMode="numeric" value={form.vipDailyPoints} onChange={(event) => setForm({ ...form, vipDailyPoints: event.target.value })} /></Field>
                  <Field><FieldLabel htmlFor="product-bundled-credit-pack-points">附带加油包积分</FieldLabel><Input id="product-bundled-credit-pack-points" inputMode="numeric" value={form.bundledCreditPackPoints} onChange={(event) => setForm({ ...form, bundledCreditPackPoints: event.target.value })} /></Field>
                </>
              ) : (
                <>
                  <Field><FieldLabel htmlFor="product-points">积分数量</FieldLabel><Input id="product-points" inputMode="numeric" value={form.points} onChange={(event) => setForm({ ...form, points: event.target.value })} /></Field>
                </>
              )}
              <Field>
                <FieldLabel>状态</FieldLabel>
                <Select value={form.status} onValueChange={(status) => setForm({ ...form, status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectGroup><SelectItem value="active">active</SelectItem><SelectItem value="inactive">inactive</SelectItem></SelectGroup></SelectContent>
                </Select>
              </Field>
            </FieldGroup>

            {/* ── Cost Preview (plan only) ── */}
            {form.kind === "plans" && (
              <div className="border-t pt-4">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setCostPreviewOpen(!costPreviewOpen)}
                >
                  <span>成本预览</span>
                  {costPreviewOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
                {costPreviewOpen && (
                  <div className="mt-3 space-y-3 rounded-md border bg-muted/30 p-3 text-xs">
                    {/* Model selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground shrink-0">选择模型:</span>
                      <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                        <SelectTrigger className="h-8 w-48 text-xs">
                          <SelectValue placeholder="选择模型" />
                        </SelectTrigger>
                        <SelectContent>
                          {models.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {costPreviewLoading ? (
                      <div className="py-4 text-center text-muted-foreground">加载中…</div>
                    ) : costPreview ? (
                      <>
                        {/* Model cost info */}
                        <div className="rounded border bg-background p-2 space-y-1">
                          <div className="font-medium">{costPreview.model.displayName} 成本信息</div>
                          <div className="text-muted-foreground">
                            输出成本价 {costPreview.model.outputCostPerMillion} 元/百万token
                          </div>
                          <div className="text-muted-foreground">
                            输入成本价 {costPreview.model.inputCostPerMillion} 元/百万token
                          </div>
                          <div className="text-muted-foreground">
                            每积分 ≈ {costPreview.perPoint.tokensPerPointOutput.toLocaleString()} 输出tokens / {costPreview.perPoint.tokensPerPointInput.toLocaleString()} 输入tokens
                          </div>
                          <div>
                            混合成本: <span className="font-mono font-medium">{costPreview.perPoint.blendedCost}</span> 元/分
                            <span className="text-muted-foreground">（{costPreview.perPoint.note}）</span>
                          </div>
                        </div>

                        {/* Credit pack fixed cost */}
                        <div className="rounded border bg-background p-2">
                          <div className="font-medium">固定成本（加油包全部消耗）</div>
                          <div className="mt-1">
                            <span className="font-mono">{costPreview.creditPack.points.toLocaleString()}分</span>
                            <span className="text-muted-foreground"> → </span>
                            <span className="font-mono font-medium">{costPreview.creditPack.cashCost}元</span>
                            {costPreview.creditPack.costVsPricePct && (
                              <span className="ml-1 text-muted-foreground">(占售价{costPreview.creditPack.costVsPricePct})</span>
                            )}
                          </div>
                        </div>

                        {/* Daily VIP variable cost */}
                        <div className="rounded border bg-background p-2">
                          <div className="font-medium">
                            可变成本（VIP日权益 × 使用率）
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            日{costPreview.dailyVip.pointsPerDay.toLocaleString()}分 × 31天 = 月上限 {costPreview.dailyVip.monthlyPointsMax.toLocaleString()} 分
                          </div>
                          <Table className="mt-2 text-xs">
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="h-7 py-1">使用率</TableHead>
                                <TableHead className="h-7 py-1 text-right">月消耗分</TableHead>
                                <TableHead className="h-7 py-1 text-right">变动成本</TableHead>
                                <TableHead className="h-7 py-1 text-right">总成本</TableHead>
                                {costPreview.scenarios[0]?.marginPct != null && (
                                  <TableHead className="h-7 py-1 text-right">利润率</TableHead>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {costPreview.scenarios.map((s) => (
                                <TableRow key={s.utilizationPct} className="hover:bg-transparent">
                                  <TableCell className="py-0.5 font-mono">{s.utilizationPct}%</TableCell>
                                  <TableCell className="py-0.5 text-right font-mono">{s.vipPointsUsed.toLocaleString()}</TableCell>
                                  <TableCell className="py-0.5 text-right font-mono">{s.vipCost}</TableCell>
                                  <TableCell className="py-0.5 text-right font-mono">{s.totalCost}</TableCell>
                                  {s.marginPct != null && (
                                    <TableCell className={`py-0.5 text-right font-mono ${s.marginPct < 0 ? "text-destructive" : "text-emerald-600"}`}>
                                      {s.marginPct}%
                                    </TableCell>
                                  )}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Conclusion / warning */}
                        {costPreview.conclusion.warning && (
                          <div className={`rounded border p-2 text-xs ${costPreview.conclusion.creditPackExceedsPrice ? "border-destructive/50 bg-destructive/5 text-destructive" : "border-amber-500/50 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}>
                            ⚠ {costPreview.conclusion.warning}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="py-4 text-center text-muted-foreground">无法加载成本预览</div>
                    )}
                  </div>
                )}
              </div>
            )}
            </>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>取消</Button>
            <Button onClick={() => void save()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除商品？</AlertDialogTitle>
            <AlertDialogDescription>系统会将商品停用，以保留历史订单关联。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>确认</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Status Toggle Confirmation ── */}
      <AlertDialog open={!!statusTarget} onOpenChange={(open) => !open && setStatusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认更新商品状态？</AlertDialogTitle>
            <AlertDialogDescription>
              将“{statusTarget?.row.name}”设置为{statusTarget?.row.status === "active" ? "停用" : "启用"}。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void toggleStatus()}>确认</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
