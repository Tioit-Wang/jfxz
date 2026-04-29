"use client";

import { AlertCircle, Minus, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ApiError, type AdminAiModel, type AdminAiModelInput, type AdminModelListParams } from "@/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatToken } from "@/lib/format";
import { AdminPagination } from "../_components";
import { adminClient } from "../admin-utils";

type StatusFilter = "all" | "active" | "inactive";
type ModelForm = {
  id?: string;
  displayName: string;
  providerModelId: string;
  description: string;
  logicScore: string;
  proseScore: string;
  knowledgeScore: string;
  maxContextTokens: string;
  maxOutputTokens: string;
  temperature: string;
  inputCostPerMillion: string;
  cacheHitInputCostPerMillion: string;
  outputCostPerMillion: string;
  profitMultiplier: string;
  status: "active" | "inactive";
  sortOrder: string;
};

const emptyForm: ModelForm = {
  displayName: "",
  providerModelId: "",
  description: "",
  logicScore: "3",
  proseScore: "3",
  knowledgeScore: "3",
  maxContextTokens: "64000",
  maxOutputTokens: "4096",
  temperature: "0.70",
  inputCostPerMillion: "1.00",
  cacheHitInputCostPerMillion: "0.10",
  outputCostPerMillion: "2.00",
  profitMultiplier: "1.10",
  status: "active",
  sortOrder: ""
};

function asString(value: unknown): string {
  return value == null ? "" : String(value);
}

function filterNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function modelToForm(model: AdminAiModel): ModelForm {
  return {
    id: model.id,
    displayName: model.display_name,
    providerModelId: model.provider_model_id,
    description: model.description ?? "",
    logicScore: asString(model.logic_score),
    proseScore: asString(model.prose_score),
    knowledgeScore: asString(model.knowledge_score),
    maxContextTokens: asString(model.max_context_tokens),
    maxOutputTokens: asString(model.max_output_tokens),
    temperature: asString(model.temperature),
    inputCostPerMillion: asString(model.input_cost_per_million),
    cacheHitInputCostPerMillion: asString(model.cache_hit_input_cost_per_million),
    outputCostPerMillion: asString(model.output_cost_per_million),
    profitMultiplier: asString(model.profit_multiplier),
    status: model.status,
    sortOrder: model.sort_order == null ? "" : asString(model.sort_order)
  };
}

function formPayload(form: ModelForm): AdminAiModelInput {
  return {
    displayName: form.displayName.trim(),
    providerModelId: form.providerModelId.trim(),
    description: form.description.trim() || null,
    logicScore: Number(form.logicScore),
    proseScore: Number(form.proseScore),
    knowledgeScore: Number(form.knowledgeScore),
    maxContextTokens: Number(form.maxContextTokens),
    maxOutputTokens: Number(form.maxOutputTokens),
    temperature: form.temperature,
    inputCostPerMillion: form.inputCostPerMillion,
    cacheHitInputCostPerMillion: form.cacheHitInputCostPerMillion,
    outputCostPerMillion: form.outputCostPerMillion,
    profitMultiplier: form.profitMultiplier,
    status: form.status,
    sortOrder: form.sortOrder.trim() ? Number(form.sortOrder) : null
  };
}

function statusPayload(model: AdminAiModel, status: "active" | "inactive"): AdminAiModelInput {
  return {
    displayName: model.display_name,
    providerModelId: model.provider_model_id,
    description: model.description,
    logicScore: model.logic_score,
    proseScore: model.prose_score,
    knowledgeScore: model.knowledge_score,
    maxContextTokens: model.max_context_tokens,
    maxOutputTokens: model.max_output_tokens,
    temperature: asString(model.temperature),
    inputCostPerMillion: asString(model.input_cost_per_million),
    cacheHitInputCostPerMillion: asString(model.cache_hit_input_cost_per_million),
    outputCostPerMillion: asString(model.output_cost_per_million),
    profitMultiplier: asString(model.profit_multiplier),
    status,
    sortOrder: model.sort_order
  };
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/50" />
      inactive
    </span>
  );
}

function ScoreBar({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {Array.from({ length: max }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 w-3 rounded-sm transition-colors ${
              i < value ? "bg-cyan-500" : "bg-muted"
            }`}
          />
        ))}
      </div>
      <span className="w-4 text-xs tabular-nums text-muted-foreground">{value}</span>
    </div>
  );
}

function TokenDisplay({ value }: { value: number }) {
  const display = formatToken(value);
  return <span className="font-mono text-xs">{display}</span>;
}

function CostDisplay({ value }: { value: string }) {
  const num = parseFloat(value);
  if (isNaN(num)) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`font-mono text-xs ${num === 0 ? "text-muted-foreground" : "text-cyan-500"}`}>
      {num.toFixed(2)}
    </span>
  );
}

export default function AdminModelsPage() {
  const client = useMemo(() => adminClient(), []);
  const [rows, setRows] = useState<AdminAiModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState<ModelForm | null>(null);
  const [statusTarget, setStatusTarget] = useState<AdminAiModel | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [logicMin, setLogicMin] = useState("");
  const [logicMax, setLogicMax] = useState("");
  const [contextMin, setContextMin] = useState("");
  const [contextMax, setContextMax] = useState("");
  const [outputMin, setOutputMin] = useState("");
  const [outputMax, setOutputMax] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  async function load(nextPage = page) {
    setLoading(true);
    try {
      const params: AdminModelListParams = {
        q: query,
        status: statusFilter === "all" ? undefined : statusFilter,
        logicMin: filterNumber(logicMin),
        logicMax: filterNumber(logicMax),
        contextMin: filterNumber(contextMin),
        contextMax: filterNumber(contextMax),
        outputMin: filterNumber(outputMin),
        outputMax: filterNumber(outputMax),
        page: nextPage,
        pageSize
      };
      const data = await client.listAdminModels(params);
      setRows(data.items);
      setTotal(data.total);
      setPage(data.page);
      setLoadError(false);
    } catch (error) {
      setRows([]);
      setTotal(0);
      setLoadError(true);
      if (error instanceof ApiError && error.status === 401) {
        toast.error("登录已过期，请重新登录");
      } else {
        toast.error("模型列表加载失败");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, statusFilter, logicMin, logicMax, contextMin, contextMax, outputMin, outputMax]);

  function resetFilters() {
    setQuery("");
    setStatusFilter("all");
    setLogicMin("");
    setLogicMax("");
    setContextMin("");
    setContextMax("");
    setOutputMin("");
    setOutputMax("");
    setPage(1);
  }

  function openCreateForm() {
    setForm({ ...emptyForm });
  }

  function validateForm(nextForm: ModelForm): string | null {
    if (!nextForm.displayName.trim()) return "请填写模型名称";
    if (!nextForm.providerModelId.trim()) return "请填写平台调用 ID";
    const scores = [nextForm.logicScore, nextForm.proseScore, nextForm.knowledgeScore].map(Number);
    if (scores.some((item) => !Number.isInteger(item) || item < 1 || item > 5)) return "评分必须是 1-5 的整数";
    if (Number(nextForm.maxContextTokens) <= 0 || Number.isNaN(Number(nextForm.maxContextTokens))) return "最大上下文必须大于 0";
    if (Number(nextForm.maxOutputTokens) <= 0 || Number.isNaN(Number(nextForm.maxOutputTokens))) return "最大输出必须大于 0";
    const temperature = Number(nextForm.temperature);
    if (Number.isNaN(temperature) || temperature < 0 || temperature > 2) return "temperature 必须在 0 到 2 之间";
    const costs = [nextForm.inputCostPerMillion, nextForm.cacheHitInputCostPerMillion, nextForm.outputCostPerMillion].map(Number);
    if (costs.some((item) => Number.isNaN(item) || item < 0)) return "成本价不能为负数";
    const profitMultiplier = Number(nextForm.profitMultiplier);
    if (Number.isNaN(profitMultiplier) || profitMultiplier < 0) return "盈利倍率不能为负数";
    if (nextForm.sortOrder.trim() && Number.isNaN(Number(nextForm.sortOrder))) return "排序值必须是数字";
    return null;
  }

  async function save() {
    if (!form) return;
    const error = validateForm(form);
    if (error) {
      toast.error(error);
      return;
    }
    try {
      if (form.id) await client.updateAdminModel(form.id, formPayload(form));
      else await client.createAdminModel(formPayload(form));
      setForm(null);
      await load(1);
      toast.success("模型已保存");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        toast.error("登录已过期，请重新登录");
      } else {
        toast.error("模型保存失败，请检查调用 ID 是否重复或网络连接");
      }
    }
  }

  async function toggleStatus() {
    if (!statusTarget) return;
    const nextStatus = statusTarget.status === "active" ? "inactive" : "active";
    try {
      await client.updateAdminModel(statusTarget.id, statusPayload(statusTarget, nextStatus));
      await load(page);
      toast.success(`模型已${nextStatus === "active" ? "启用" : "停用"}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        toast.error("登录已过期，请重新登录");
      } else {
        toast.error("模型状态更新失败");
      }
    } finally {
      setStatusTarget(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center justify-between px-6 py-4">
        <Button onClick={openCreateForm} className="gap-1.5">
          <Plus className="size-4" />新建模型
        </Button>
      </div>

      {loading ? (
        <div className="shrink-0 space-y-2 px-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {/* ── Search row ── */}
          <div className="flex shrink-0 items-center gap-3 px-6">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                className="h-9 pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索模型名称或调用 ID…"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="h-9 w-32" aria-label="筛选模型状态">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="inactive">inactive</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* ── Range filters row ── */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs mx-6 mt-3">
            <span className="text-muted-foreground">逻辑评分:</span>
            <div className="flex items-center gap-1">
              <Input
                className="h-7 w-16 text-xs"
                inputMode="numeric"
                value={logicMin}
                onChange={(event) => setLogicMin(event.target.value)}
                placeholder="min"
              />
              <Minus className="size-3 text-muted-foreground" />
              <Input
                className="h-7 w-16 text-xs"
                inputMode="numeric"
                value={logicMax}
                onChange={(event) => setLogicMax(event.target.value)}
                placeholder="max"
              />
            </div>
            <div className="h-4 w-px bg-border" />
            <span className="text-muted-foreground">上下文:</span>
            <div className="flex items-center gap-1">
              <Input
                className="h-7 w-20 text-xs"
                inputMode="numeric"
                value={contextMin}
                onChange={(event) => setContextMin(event.target.value)}
                placeholder="min"
              />
              <Minus className="size-3 text-muted-foreground" />
              <Input
                className="h-7 w-20 text-xs"
                inputMode="numeric"
                value={contextMax}
                onChange={(event) => setContextMax(event.target.value)}
                placeholder="max"
              />
            </div>
            <div className="h-4 w-px bg-border" />
            <span className="text-muted-foreground">输出:</span>
            <div className="flex items-center gap-1">
              <Input
                className="h-7 w-16 text-xs"
                inputMode="numeric"
                value={outputMin}
                onChange={(event) => setOutputMin(event.target.value)}
                placeholder="min"
              />
              <Minus className="size-3 text-muted-foreground" />
              <Input
                className="h-7 w-16 text-xs"
                inputMode="numeric"
                value={outputMax}
                onChange={(event) => setOutputMax(event.target.value)}
                placeholder="max"
              />
            </div>
            {(query || statusFilter !== "all" || logicMin || logicMax || contextMin || contextMax || outputMin || outputMax) && (
              <>
                <div className="h-4 w-px bg-border" />
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetFilters}>
                  重置筛选
                </Button>
              </>
            )}
          </div>

          {/* ── Table area (fills remaining height) ── */}
          {loadError ? (
            <div className="flex-1 px-6 pt-4">
              <Empty>
                <EmptyHeader>
                  <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <AlertCircle className="size-4" />
                  </div>
                  <EmptyTitle>模型列表加载失败</EmptyTitle>
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
                  <EmptyTitle>没有匹配模型</EmptyTitle>
                  <EmptyDescription>调整关键词、状态或 token 范围后再试。</EmptyDescription>
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
                        <TableHead className="w-[240px]">模型</TableHead>
                        <TableHead className="w-[180px]">评分</TableHead>
                        <TableHead className="w-[120px]">上下文</TableHead>
                        <TableHead className="w-[100px]">输出</TableHead>
                        <TableHead className="w-[120px]">成本价</TableHead>
                        <TableHead className="w-[60px]">排序</TableHead>
                        <TableHead className="w-[80px]">状态</TableHead>
                        <TableHead className="w-[140px] text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((model) => (
                        <TableRow key={model.id} className="group transition-colors hover:bg-muted/30">
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-medium">{model.display_name}</span>
                              <span className="font-mono text-[11px] text-cyan-600 dark:text-cyan-400">
                                {model.provider_model_id}
                              </span>
                              {model.description ? (
                                <span className="line-clamp-1 max-w-[220px] text-[11px] text-muted-foreground">
                                  {model.description}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1.5 py-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">逻辑</span>
                                <ScoreBar value={model.logic_score} />
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">文笔</span>
                                <ScoreBar value={model.prose_score} />
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">知识</span>
                                <ScoreBar value={model.knowledge_score} />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <TokenDisplay value={model.max_context_tokens} />
                          </TableCell>
                          <TableCell>
                            <TokenDisplay value={model.max_output_tokens} />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">输入</span>
                                <CostDisplay value={model.input_cost_per_million} />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">缓存</span>
                                <CostDisplay value={model.cache_hit_input_cost_per_million} />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">输出</span>
                                <CostDisplay value={model.output_cost_per_million} />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">盈利</span>
                                <CostDisplay value={model.profit_multiplier} />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs">{model.sort_order ?? "—"}</span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={model.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-xs"
                                onClick={() => setForm(modelToForm(model))}
                              >
                                编辑
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className={`h-8 px-2 text-xs ${model.status === "active" ? "text-amber-600 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-700"}`}
                                onClick={() => setStatusTarget(model)}
                              >
                                {model.status === "active" ? "停用" : "启用"}
                              </Button>
                            </div>
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

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg">{form?.id ? "编辑模型" : "新建模型"}</DialogTitle>
            <DialogDescription className="text-xs">
              平台调用 ID 只保存在服务端模型目录中，用户端只展示模型名称。
            </DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="flex flex-col gap-5 overflow-y-auto pr-1 -mr-1">
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">基本信息</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="model-name">模型名称</FieldLabel>
                    <Input
                      id="model-name"
                      value={form.displayName}
                      onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                      placeholder="显示给用户的名称"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="model-provider-id">平台调用 ID</FieldLabel>
                    <Input
                      id="model-provider-id"
                      value={form.providerModelId}
                      onChange={(event) => setForm({ ...form, providerModelId: event.target.value })}
                      placeholder="API 调用标识符"
                      className="font-mono"
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="model-description">模型描述</FieldLabel>
                  <Textarea
                    id="model-description"
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    placeholder="可选描述，用于向用户说明模型特点"
                    className="resize-none"
                    rows={2}
                  />
                </Field>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">能力评分</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="model-logic-score">逻辑评分</FieldLabel>
                    <div className="relative">
                      <Input
                        id="model-logic-score"
                        inputMode="numeric"
                        value={form.logicScore}
                        onChange={(event) => setForm({ ...form, logicScore: event.target.value })}
                        className="pr-10"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/ 5</span>
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="model-prose-score">文笔评分</FieldLabel>
                    <div className="relative">
                      <Input
                        id="model-prose-score"
                        inputMode="numeric"
                        value={form.proseScore}
                        onChange={(event) => setForm({ ...form, proseScore: event.target.value })}
                        className="pr-10"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/ 5</span>
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="model-knowledge-score">知识面评分</FieldLabel>
                    <div className="relative">
                      <Input
                        id="model-knowledge-score"
                        inputMode="numeric"
                        value={form.knowledgeScore}
                        onChange={(event) => setForm({ ...form, knowledgeScore: event.target.value })}
                        className="pr-10"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/ 5</span>
                    </div>
                  </Field>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Token 限制</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="model-context">最大上下文</FieldLabel>
                    <Input
                      id="model-context"
                      inputMode="numeric"
                      value={form.maxContextTokens}
                      onChange={(event) => setForm({ ...form, maxContextTokens: event.target.value })}
                      className="font-mono"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="model-output">最大输出</FieldLabel>
                    <Input
                      id="model-output"
                      inputMode="numeric"
                      value={form.maxOutputTokens}
                      onChange={(event) => setForm({ ...form, maxOutputTokens: event.target.value })}
                      className="font-mono"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="model-temperature">temperature</FieldLabel>
                    <Input
                      id="model-temperature"
                      inputMode="decimal"
                      value={form.temperature}
                      onChange={(event) => setForm({ ...form, temperature: event.target.value })}
                      className="font-mono"
                    />
                  </Field>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">成本定价</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="model-input-cost">输入成本价（元/百万token）</FieldLabel>
                    <Input
                      id="model-input-cost"
                      inputMode="decimal"
                      value={form.inputCostPerMillion}
                      onChange={(event) => setForm({ ...form, inputCostPerMillion: event.target.value })}
                      className="font-mono"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="model-cache-hit-cost">缓存命中成本价（元/百万token）</FieldLabel>
                    <Input
                      id="model-cache-hit-cost"
                      inputMode="decimal"
                      value={form.cacheHitInputCostPerMillion}
                      onChange={(event) => setForm({ ...form, cacheHitInputCostPerMillion: event.target.value })}
                      className="font-mono"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="model-output-cost">输出成本价（元/百万token）</FieldLabel>
                    <Input
                      id="model-output-cost"
                      inputMode="decimal"
                      value={form.outputCostPerMillion}
                      onChange={(event) => setForm({ ...form, outputCostPerMillion: event.target.value })}
                      className="font-mono"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="model-profit-multiplier">盈利倍率</FieldLabel>
                    <Input
                      id="model-profit-multiplier"
                      inputMode="decimal"
                      value={form.profitMultiplier}
                      onChange={(event) => setForm({ ...form, profitMultiplier: event.target.value })}
                      className="font-mono"
                    />
                  </Field>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">设置</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field>
                    <FieldLabel>状态</FieldLabel>
                    <Select value={form.status} onValueChange={(status) => setForm({ ...form, status: status as "active" | "inactive" })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="active">active</SelectItem>
                          <SelectItem value="inactive">inactive</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="model-sort">排序值</FieldLabel>
                    <Input
                      id="model-sort"
                      inputMode="numeric"
                      value={form.sortOrder}
                      onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
                      placeholder="留空排最后"
                      className="font-mono"
                    />
                    <FieldDescription className="text-[11px]">数值越小越靠前</FieldDescription>
                  </Field>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setForm(null)}>取消</Button>
            <Button onClick={() => void save()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Status Toggle Confirmation ── */}
      <AlertDialog open={!!statusTarget} onOpenChange={(open) => !open && setStatusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认更新模型状态？</AlertDialogTitle>
            <AlertDialogDescription>
              将「{statusTarget?.display_name}」设置为{statusTarget?.status === "active" ? "停用" : "启用"}。
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
