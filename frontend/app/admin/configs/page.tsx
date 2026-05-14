"use client";

import { AlertCircle, Eye, EyeOff, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type AdminConfig, type AdminConfigValue, type AiModelOption } from "@/api";
import { AdminHeading, AdminPage, AdminPagination } from "../_components";
import { adminClient } from "../admin-utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type DraftValue = string | boolean;

const labelMap: Record<string, string> = {
  enabled: "启用支付", app_id: "应用 ID", app_private_key: "应用私钥",
  alipay_public_key: "支付宝公钥", notify_url: "支付回调地址",
  seller_id: "商户 ID", timeout_express: "订单超时时间",
  extra_options: "扩展参数", model_id: "编辑器检查模型"
};

function configLabel(config: AdminConfig) { return labelMap[config.config_key] ?? config.config_key.replaceAll("_", " "); }
function groupLabel(group: string) {
  if (group === "all") return "全部";
  if (group === "payment.alipay_f2f") return "支付宝当面付";
  if (group === "ai.editor_check") return "AI 检查";
  return group;
}

function configValue(config: AdminConfig): DraftValue {
  if (config.value_type === "boolean") return Boolean(config.boolean_value);
  if (config.value_type === "integer") return String(config.integer_value ?? "");
  if (config.value_type === "decimal") return String(config.decimal_value ?? "");
  if (config.value_type === "json") return JSON.stringify(config.json_value ?? {}, null, 2);
  return config.string_value ?? "";
}

function payloadFor(config: AdminConfig, value: DraftValue): AdminConfigValue {
  if (config.value_type === "boolean") return { boolean_value: Boolean(value) };
  const text = String(value);
  if (config.value_type === "integer") return { integer_value: Number(text) };
  if (config.value_type === "decimal") return { decimal_value: text };
  if (config.value_type === "json") return { json_value: JSON.parse(text || "{}") as Record<string, unknown> };
  return { string_value: text };
}

export default function AdminConfigsPage() {
  const client = useMemo(() => adminClient(), []);
  const [configs, setConfigs] = useState<AdminConfig[]>([]);
  const [groups, setGroups] = useState<string[]>(["all"]);
  const [activeGroup, setActiveGroup] = useState("all");
  const [pendingGroup, setPendingGroup] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftValue>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [models, setModels] = useState<AiModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1); const [total, setTotal] = useState(0);
  const pageSize = 10;

  const visibleDirtyIds = configs.filter((item) => dirtyIds.has(item.id) && !jsonErrors[item.id]).map((item) => item.id);
  const hasDirty = dirtyIds.size > 0;

  async function load(group = activeGroup, nextPage = page) {
    setLoading(true); setLoadError(false);
    try {
      const [allData, pageData] = await Promise.all([
        client.listAdminConfigs({ pageSize: 100 }),
        client.listAdminConfigs({ group: group === "all" ? undefined : group, page: nextPage, pageSize })
      ]);
      const nextGroups = ["all", ...Array.from(new Set(allData.items.map((item) => item.config_group))).sort()];
      setGroups(nextGroups);
      setConfigs(pageData.items);
      if (!models.length) { try { setModels(await client.listAiModels()); } catch {} }
      setTotal(pageData.total); setPage(pageData.page);
      setDrafts((current) => { const next = { ...current }; for (const item of pageData.items) { if (!dirtyIds.has(item.id)) next[item.id] = configValue(item); } return next; });
    } catch { setLoadError(true); toast.error("配置加载失败"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(activeGroup, 1); }, [activeGroup]);

  function updateDraft(config: AdminConfig, value: DraftValue) {
    if (config.value_type === "json") {
      try { JSON.parse(String(value) || "{}"); setJsonErrors((c) => { const next = { ...c }; delete next[config.id]; return next; }); }
      catch { setJsonErrors((c) => ({ ...c, [config.id]: "JSON 格式错误" })); }
    }
    setDrafts((c) => ({ ...c, [config.id]: value }));
    setDirtyIds((c) => new Set(c).add(config.id));
  }

  async function saveDirty(ids = visibleDirtyIds) {
    if (ids.length === 0) return true;
    if (ids.some((id) => jsonErrors[id])) { toast.error("存在格式错误的字段"); return false; }
    setSaving(true);
    try {
      for (const id of ids) { const config = configs.find((item) => item.id === id); if (!config) continue; await client.updateAdminConfig(id, payloadFor(config, drafts[id] ?? configValue(config))); }
      setDirtyIds((c) => { const next = new Set(c); ids.forEach((id) => next.delete(id)); return next; });
      toast.success("配置已保存"); await load(activeGroup, page); return true;
    } catch { toast.error("配置保存失败"); return false; }
    finally { setSaving(false); }
  }

  function requestGroupChange(group: string) {
    if (group === activeGroup) return;
    if (hasDirty) { setPendingGroup(group); return; }
    setActiveGroup(group);
  }

  async function saveAndSwitch() {
    if (!pendingGroup) return;
    const saved = await saveDirty(Array.from(dirtyIds));
    if (!saved) return;
    setActiveGroup(pendingGroup); setPendingGroup(null);
  }

  function discardAndSwitch() {
    if (!pendingGroup) return;
    setDirtyIds(new Set()); setJsonErrors({});
    setDrafts(Object.fromEntries(configs.map((item) => [item.id, configValue(item)])));
    setActiveGroup(pendingGroup); setPendingGroup(null);
  }

  function renderControl(config: AdminConfig) {
    const value = drafts[config.id] ?? configValue(config);
    if (config.config_group === "ai.editor_check" && config.config_key === "model_id") {
      const selected = String(value || "__none");
      const selectedMissing = selected !== "__none" && !models.some((m) => m.id === selected);
      return (
        <Select value={selected} onValueChange={(v) => updateDraft(config, v === "__none" ? "" : v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup>
            <SelectItem value="__none">未选择</SelectItem>
            {selectedMissing && <SelectItem value={selected}>当前不可用模型</SelectItem>}
            {models.map((m) => (<SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>))}
          </SelectGroup></SelectContent>
        </Select>
      );
    }
    if (config.value_type === "boolean") return (
      <div className="flex items-center gap-3">
        <Switch checked={Boolean(value)} onCheckedChange={(checked) => updateDraft(config, checked)} />
        <span className="text-sm text-muted-foreground">{value ? "已启用" : "已关闭"}</span>
      </div>
    );
    if (config.value_type === "json") return (
      <div className="flex flex-col gap-1">
        <Textarea value={String(value)} onChange={(e) => updateDraft(config, e.target.value)} />
        {jsonErrors[config.id] && <span className="text-xs text-destructive">{jsonErrors[config.id]}</span>}
      </div>
    );
    return (
      <div className="flex gap-2">
        <Input type={config.value_type === "secret" && !reveal[config.id] ? "password" : "text"} value={String(value)} onChange={(e) => updateDraft(config, e.target.value)} />
        {config.value_type === "secret" && (
          <Button type="button" size="icon-sm" variant="ghost" onClick={() => setReveal((c) => ({ ...c, [config.id]: !c[config.id] }))}>
            {reveal[config.id] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        )}
      </div>
    );
  }

  return (
    <AdminPage>
      <AdminHeading title="系统配置" description="按分组维护全局配置，支持在列表中直接编辑并统一保存。" />

      {loading ? (
        <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>
      ) : loadError ? (
        <div className="flex-1 rounded-lg border border-border bg-card p-12 shadow-card">
          <Empty><EmptyHeader>
            <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive"><AlertCircle className="size-4" /></div>
            <EmptyTitle>配置加载失败</EmptyTitle><EmptyDescription>请检查登录状态或稍后重试。</EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" size="sm" className="mx-auto mt-3" onClick={() => void load(activeGroup, page)}>重新加载</Button></Empty>
        </div>
      ) : (
        <Tabs value={activeGroup} onValueChange={requestGroupChange} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="overflow-x-auto shrink-0">
            <TabsList>{groups.map((g) => (<TabsTrigger key={g} value={g}>{groupLabel(g)}</TabsTrigger>))}</TabsList>
          </div>
          {groups.map((group) => (
            <TabsContent key={group} value={group} className="mt-4 flex-1 overflow-hidden data-[state=inactive]:hidden">
              {activeGroup === group && (
                !configs.length ? (
                  <div className="flex h-full items-center justify-center">
                    <Empty><EmptyHeader><EmptyTitle>没有配置项</EmptyTitle><EmptyDescription>当前分组下没有可编辑配置。</EmptyDescription></EmptyHeader></Empty>
                  </div>
                ) : (
                  <div className="flex h-full flex-col overflow-hidden">
                    <div className="flex-1 space-y-3 overflow-auto pr-1">
                      {configs.map((config) => (
                        <div key={config.id} className="grid gap-4 rounded-lg border border-border bg-card p-4 shadow-card lg:grid-cols-[minmax(220px,0.8fr)_minmax(320px,1fr)] lg:items-center">
                          <div className="flex min-w-0 flex-col gap-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-medium">{configLabel(config)}</span>
                              <Badge variant="outline" className="text-[10px]">{config.value_type}</Badge>
                              {config.is_required && <Badge variant="secondary" className="text-[10px]">必填</Badge>}
                              {dirtyIds.has(config.id) && <Badge className="text-[10px]">未保存</Badge>}
                            </div>
                            <span className="font-mono text-[11px] text-muted-foreground">{config.config_group}.{config.config_key}</span>
                            {config.description && <span className="text-xs text-muted-foreground">{config.description}</span>}
                          </div>
                          {renderControl(config)}
                        </div>
                      ))}
                    </div>
                    <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-4 border-t border-border bg-background/95 px-4 pt-4 pb-2 backdrop-blur">
                      <AdminPagination page={page} pageSize={pageSize} total={total} onPageChange={(nextPage) => void load(activeGroup, nextPage)} />
                      <Button disabled={saving || visibleDirtyIds.length === 0} onClick={() => void saveDirty()}><Save className="size-4" /> 保存配置</Button>
                    </div>
                  </div>
                )
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <AlertDialog open={!!pendingGroup} onOpenChange={(open) => !open && setPendingGroup(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>当前配置尚未保存</AlertDialogTitle><AlertDialogDescription>切换到 {pendingGroup ? groupLabel(pendingGroup) : ""} 前，可以先保存修改。</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>继续编辑</AlertDialogCancel><Button variant="outline" onClick={discardAndSwitch}>放弃更改</Button><AlertDialogAction onClick={() => void saveAndSwitch()}>保存并切换</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
}
