"use client";

import { Eye, EyeOff, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type AdminConfig, type AdminConfigValue } from "@/api";
import { AdminHeading, AdminPage, AdminPanel, AdminPagination } from "../_components";
import { adminClient } from "../admin-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type DraftValue = string | boolean;

const labelMap: Record<string, string> = {
  enabled: "启用支付",
  app_id: "应用 ID",
  app_private_key: "应用私钥",
  alipay_public_key: "支付宝公钥",
  notify_url: "支付回调地址",
  seller_id: "商户 ID",
  timeout_express: "订单超时时间"
};

function configLabel(config: AdminConfig) {
  return labelMap[config.config_key] ?? config.config_key.replaceAll("_", " ");
}

function groupLabel(group: string) {
  if (group === "all") return "全部";
  if (group === "payment.alipay_f2f") return "支付宝当面付";
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
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  const visibleDirtyIds = configs.filter((item) => dirtyIds.has(item.id)).map((item) => item.id);
  const hasDirty = dirtyIds.size > 0;

  async function load(group = activeGroup, nextPage = page) {
    setLoading(true);
    try {
      const [allData, pageData] = await Promise.all([
        client.listAdminConfigs({ pageSize: 100 }),
        client.listAdminConfigs({ group: group === "all" ? undefined : group, page: nextPage, pageSize })
      ]);
      const nextGroups = ["all", ...Array.from(new Set(allData.items.map((item) => item.config_group))).sort()];
      setGroups(nextGroups);
      setConfigs(pageData.items);
      setTotal(pageData.total);
      setPage(pageData.page);
      setDrafts((current) => {
        const next = { ...current };
        for (const item of pageData.items) {
          if (!dirtyIds.has(item.id)) next[item.id] = configValue(item);
        }
        return next;
      });
    } catch {
      toast.error("配置加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(activeGroup, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup]);

  function updateDraft(config: AdminConfig, value: DraftValue) {
    setDrafts((current) => ({ ...current, [config.id]: value }));
    setDirtyIds((current) => new Set(current).add(config.id));
  }

  async function saveDirty(ids = visibleDirtyIds) {
    if (!ids.length) return true;
    setSaving(true);
    try {
      for (const id of ids) {
        const config = configs.find((item) => item.id === id);
        if (!config) continue;
        await client.updateAdminConfig(id, payloadFor(config, drafts[id] ?? configValue(config)));
      }
      setDirtyIds((current) => {
        const next = new Set(current);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      toast.success("配置已保存");
      await load(activeGroup, page);
      return true;
    } catch {
      toast.error("配置保存失败，请检查字段格式");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function requestGroupChange(group: string) {
    if (group === activeGroup) return;
    if (hasDirty) {
      setPendingGroup(group);
      return;
    }
    setActiveGroup(group);
  }

  async function saveAndSwitch() {
    if (!pendingGroup) return;
    const saved = await saveDirty(Array.from(dirtyIds));
    if (!saved) return;
    setActiveGroup(pendingGroup);
    setPendingGroup(null);
  }

  function discardAndSwitch() {
    if (!pendingGroup) return;
    setDirtyIds(new Set());
    setDrafts(Object.fromEntries(configs.map((item) => [item.id, configValue(item)])));
    setActiveGroup(pendingGroup);
    setPendingGroup(null);
  }

  function renderControl(config: AdminConfig) {
    const value = drafts[config.id] ?? configValue(config);
    if (config.value_type === "boolean") {
      return (
        <div className="flex items-center gap-3">
          <Switch
            aria-label={`${configLabel(config)}开关`}
            checked={Boolean(value)}
            onCheckedChange={(checked) => updateDraft(config, checked)}
          />
          <span className="text-sm text-muted-foreground">{value ? "已启用" : "已关闭"}</span>
        </div>
      );
    }
    if (config.value_type === "json") {
      return (
        <Textarea
          aria-label={`${configLabel(config)}配置值`}
          value={String(value)}
          onChange={(event) => updateDraft(config, event.target.value)}
        />
      );
    }
    return (
      <div className="flex gap-2">
        <Input
          aria-label={`${configLabel(config)}配置值`}
          type={config.value_type === "secret" && !reveal[config.id] ? "password" : "text"}
          value={String(value)}
          onChange={(event) => updateDraft(config, event.target.value)}
        />
        {config.value_type === "secret" ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="显示或隐藏密文"
            onClick={() => setReveal((current) => ({ ...current, [config.id]: !current[config.id] }))}
          >
            {reveal[config.id] ? <EyeOff /> : <Eye />}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <AdminPage>
      <AdminHeading title="系统配置" description="按分组维护全局配置，支持在列表中直接编辑并统一保存。" />
      <AdminPanel title="配置项" description="顶部切换分组，修改后使用底部按钮保存。">
        {loading ? <Skeleton className="h-44 w-full" /> : (
          <Tabs value={activeGroup} onValueChange={requestGroupChange} className="flex flex-col gap-4">
            <div className="overflow-x-auto">
              <TabsList>
                {groups.map((group) => (
                  <TabsTrigger key={group} value={group}>{groupLabel(group)}</TabsTrigger>
                ))}
              </TabsList>
            </div>
            {groups.map((group) => (
              <TabsContent key={group} value={group} className="mt-0">
                {!configs.length ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>没有配置项</EmptyTitle>
                      <EmptyDescription>当前分组下没有可编辑配置。</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="flex flex-col gap-3">
                    {configs.map((config) => (
                      <div key={config.id} className="grid gap-3 rounded-md border p-4 lg:grid-cols-[minmax(220px,0.8fr)_minmax(320px,1fr)] lg:items-center">
                        <div className="flex min-w-0 flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{configLabel(config)}</span>
                            <Badge variant="outline">{config.value_type}</Badge>
                            {config.is_required ? <Badge variant="secondary">必填</Badge> : null}
                            {dirtyIds.has(config.id) ? <Badge>未保存</Badge> : null}
                          </div>
                          <span className="text-xs text-muted-foreground">{config.config_group}.{config.config_key}</span>
                          {config.description ? <span className="text-sm text-muted-foreground">{config.description}</span> : null}
                        </div>
                        {renderControl(config)}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
            <div className="sticky bottom-0 flex flex-col gap-4 border-t bg-background/95 pt-4 backdrop-blur md:flex-row md:items-center md:justify-between">
              <AdminPagination page={page} pageSize={pageSize} total={total} onPageChange={(nextPage) => void load(activeGroup, nextPage)} />
              <Button disabled={saving || visibleDirtyIds.length === 0} onClick={() => void saveDirty()}>
                <Save data-icon="inline-start" />
                保存配置
              </Button>
            </div>
          </Tabs>
        )}
      </AdminPanel>

      <AlertDialog open={!!pendingGroup} onOpenChange={(open) => !open && setPendingGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>当前配置尚未保存</AlertDialogTitle>
            <AlertDialogDescription>
              切换到 {pendingGroup ? groupLabel(pendingGroup) : ""} 前，可以先保存修改，也可以放弃本次编辑。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <Button variant="outline" onClick={discardAndSwitch}>放弃更改</Button>
            <AlertDialogAction onClick={() => void saveAndSwitch()}>保存并切换</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
}
