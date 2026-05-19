"use client";

import { AlertCircle, Edit, Eye, EyeOff, Save, Settings2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { type AdminConfig, type AdminConfigValue, type AiModelOption } from "@/api";
import { AdminPage } from "../_components";
import { adminClient } from "../admin-utils";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/RichTextEditor";
import { cn } from "@/lib/utils";

type DraftValue = string | boolean;

const labelMap: Record<string, string> = {
  enabled: "启用支付", app_id: "应用 ID", app_private_key: "应用私钥",
  alipay_public_key: "支付宝公钥", notify_url: "支付回调地址",
  seller_id: "商户 ID", timeout_express: "订单超时时间",
  extra_options: "扩展参数",
  character_model_id: "角色检查模型", logic_model_id: "逻辑检查模型", style_model_id: "风格检查模型",
  character_thinking: "角色检查思考", logic_thinking: "逻辑检查思考", style_thinking: "风格检查思考",
  character_enabled: "启用角色检查", logic_enabled: "启用逻辑检查", style_enabled: "启用风格检查",
  character_prompt: "角色检查提示词", logic_prompt: "逻辑检查提示词", style_prompt: "风格检查提示词",
  logic_chapter_count: "逻辑检查参考前N章", style_chapter_count: "风格检查参考前N章",
  config: "AI 描述配置",
};

function configLabel(config: AdminConfig) { return labelMap[config.config_key] ?? config.config_key.replaceAll("_", " "); }
function groupLabel(group: string) {
  if (group === "payment.alipay_f2f") return "支付宝当面付";
  if (group === "ai.editor_check") return "AI 检查";
  if (group === "ai.prompt_description") return "AI 描述";
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

function MonoBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[10px] leading-none tracking-tight text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded-full", className)}>
      {children}
    </span>
  );
}

const ALL_PLACEHOLDERS = [
  { key: "chapter_content", label: "当前章节正文" },
  { key: "chapter_title", label: "当前章节标题" },
  { key: "characters", label: "全部角色设定" },
  { key: "surrounding_chapters", label: "前后章节内容" },
  { key: "previous_chapters", label: "前N章内容" },
];

const CHECK_IDS = ["character", "logic", "style"] as const;
type CheckId = (typeof CHECK_IDS)[number];
const CHECK_NAMES: Record<string, string> = { character: "角色检查", logic: "逻辑检查", style: "风格检查" };

const CHECK_REQUIRED: Record<string, string[]> = {
  character: ["chapter_content", "characters"],
  logic: ["chapter_content", "surrounding_chapters"],
  style: ["chapter_content", "previous_chapters"],
};

const CHECK_PLACEHOLDERS: Record<string, string[]> = {
  character: ["chapter_content", "chapter_title", "characters"],
  logic: ["chapter_content", "chapter_title", "surrounding_chapters"],
  style: ["chapter_content", "chapter_title", "previous_chapters"],
};

const THINKING_LEVELS_ADMIN = ["none", "low", "medium", "high", "xhigh"] as const;
type ThinkingLevelAdmin = (typeof THINKING_LEVELS_ADMIN)[number];

const THINKING_LABELS_ADMIN: Record<ThinkingLevelAdmin, string> = {
  none: "关闭", low: "低", medium: "中", high: "高", xhigh: "极限",
};

const THINKING_BAR_COLORS_ADMIN: Record<ThinkingLevelAdmin, string> = {
  none: "bg-muted",
  low: "bg-emerald-400",
  medium: "bg-sky-400",
  high: "bg-amber-400",
  xhigh: "bg-rose-500",
};

function ThinkingBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const currentIdx = THINKING_LEVELS_ADMIN.indexOf(value as ThinkingLevelAdmin);
  return (
    <div className="flex items-center gap-3 flex-1">
      <div className="flex gap-1 flex-1">
        {THINKING_LEVELS_ADMIN.map((level, idx) => {
          const isFilled = value !== "none" && idx <= currentIdx;
          return (
            <button
              key={level}
              className={cn(
                "h-2 flex-1 rounded-full transition-all",
                isFilled ? THINKING_BAR_COLORS_ADMIN[value as ThinkingLevelAdmin] : "bg-[#ebebeb]"
              )}
              onClick={() => onChange(level)}
            />
          );
        })}
      </div>
      <span className="text-xs font-medium w-10 text-right tabular-nums text-muted-foreground">
        {THINKING_LABELS_ADMIN[value as ThinkingLevelAdmin] ?? value}
      </span>
    </div>
  );
}

function PromptEditorModal({
  open, onOpenChange, checkId, promptText, getCheckDraft, setCheckDraft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkId: string;
  promptText: string;
  getCheckDraft: (key: string) => DraftValue;
  setCheckDraft: (key: string, value: DraftValue) => void;
}) {
  const editorRef = useRef<RichTextEditorHandle>(null);

  const insertPlaceholder = useCallback((key: string) => {
    editorRef.current?.insertText(`{{${key}}}`);
  }, []);

  const validationError = (() => {
    const required = CHECK_REQUIRED[checkId] || [];
    const missing = required.filter((key) => !promptText.includes(`{{${key}}}`));
    if (missing.length) {
      return `${CHECK_NAMES[checkId]}缺少占位符: ${missing.map((k) => `{{${k}}}`).join("、")}`;
    }
    return "";
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>编辑提示词 — {CHECK_NAMES[checkId]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 顶部工具栏 — 占位符插入按钮 */}
          <div className="flex flex-wrap items-center gap-1.5 pb-3 border-b border-border">
            <span className="text-xs text-muted-foreground shrink-0 mr-1">插入占位符：</span>
            {ALL_PLACEHOLDERS.filter((ph) => CHECK_PLACEHOLDERS[checkId]?.includes(ph.key)).map((ph) => {
              const isUsed = promptText.includes(`{{${ph.key}}}`);
              return (
                <button
                  key={ph.key}
                  disabled={isUsed}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs border transition-colors",
                    isUsed
                      ? "border-[#ebebeb] bg-[#f5f5f5] text-[#d4d4d4] cursor-default"
                      : "border-amber-200 bg-[#fef3c7] text-[#92400e] hover:bg-[#fde68a] cursor-pointer"
                  )}
                  onClick={() => insertPlaceholder(ph.key)}
                  title={ph.label}
                >
                  {`{{${ph.key}}}`}
                </button>
              );
            })}
          </div>
          {/* Markdown 编辑器 */}
          <RichTextEditor
            ref={editorRef}
            value={promptText}
            onChange={(v) => setCheckDraft(`${checkId}_prompt`, v)}
            minHeight={320}
          />
          {validationError ? (
            <span className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle size={12} />
              {validationError}
            </span>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            完成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PromptDescEditorModal({
  open, onOpenChange, prompt, onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: string;
  onChange: (value: string) => void;
}) {
  const editorRef = useRef<RichTextEditorHandle>(null);

  const insertPlaceholder = useCallback((key: string) => {
    editorRef.current?.insertText(`{{${key}}}`);
  }, []);

  const missingPlaceholder = !prompt.includes("{{detail_prompt}}");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>编辑提示词 — AI 描述</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5 pb-3 border-b border-border">
            <span className="text-xs text-muted-foreground shrink-0 mr-1">插入占位符：</span>
            {PROMPT_DESC_PLACEHOLDERS.map((ph) => {
              const isUsed = prompt.includes(`{{${ph.key}}}`);
              return (
                <button
                  key={ph.key}
                  disabled={isUsed}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs border transition-colors",
                    isUsed
                      ? "border-[#ebebeb] bg-[#f5f5f5] text-[#d4d4d4] cursor-default"
                      : "border-amber-200 bg-[#fef3c7] text-[#92400e] hover:bg-[#fde68a] cursor-pointer"
                  )}
                  onClick={() => insertPlaceholder(ph.key)}
                  title={ph.label}
                >
                  {`{{${ph.key}}}`}
                </button>
              );
            })}
          </div>
          <RichTextEditor
            ref={editorRef}
            value={prompt}
            onChange={onChange}
            minHeight={320}
          />
          {missingPlaceholder && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle size={12} />
              提示词模板必须包含 {'{{detail_prompt}}'} 占位符
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            完成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PROMPT_DESC_PLACEHOLDERS = [
  { key: "detail_prompt", label: "详细提示词" },
];

function PromptDescriptionPanel({
  configs,
  models,
}: {
  configs: AdminConfig[];
  models: AiModelOption[];
}) {
  const client = useMemo(() => adminClient(), []);
  const config = configs.find((c) => c.config_key === "config");
  const [cfg, setCfg] = useState<{ model_id: string; thinking: string; prompt: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (config?.string_value) {
      try { setCfg(JSON.parse(config.string_value)); } catch { /* ignore */ }
    }
  }, [config?.string_value]);

  if (!config || !cfg) {
    return (
      <div className="flex h-full items-center justify-center">
        <Empty><EmptyHeader><EmptyTitle>暂无配置</EmptyTitle></EmptyHeader></Empty>
      </div>
    );
  }

  async function save() {
    if (!config || !cfg) return;
    setSaving(true);
    try {
      await client.updateAdminConfig(config.id, { string_value: JSON.stringify(cfg) });
      toast.success("配置已保存");
    } catch { toast.error("保存失败"); }
    finally { setSaving(false); }
  }

  const currentIdx = THINKING_LEVELS_ADMIN.indexOf(cfg.thinking as ThinkingLevelAdmin);
  const checkModelMissing = cfg.model_id !== "__none" && !models.some((m) => m.id === cfg.model_id);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card">
      <div className="flex-1 space-y-6 p-5">
        {/* Model selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">AI 模型</label>
          <Select value={cfg.model_id} onValueChange={(v) => setCfg({ ...cfg, model_id: v })}>
            <SelectTrigger><SelectValue placeholder="选择模型" /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="__none">未选择</SelectItem>
                {checkModelMissing && (
                  <SelectItem value={cfg.model_id}>当前不可用模型</SelectItem>
                )}
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Thinking level */}
        <div className="space-y-2">
          <label className="text-sm font-medium">思考强度</label>
          <div className="flex items-center gap-3">
            <div className="flex flex-1 gap-1">
              {THINKING_LEVELS_ADMIN.map((level, idx) => {
                const isFilled = cfg.thinking !== "none" && idx <= Math.max(0, currentIdx);
                return (
                  <button
                    key={level}
                    type="button"
                    className={cn(
                      "h-2 flex-1 rounded-full transition-all",
                      isFilled
                        ? cfg.thinking === "xhigh" ? "bg-cyan-600"
                          : cfg.thinking === "high" ? "bg-cyan-500"
                          : cfg.thinking === "medium" ? "bg-cyan-400"
                          : "bg-cyan-300"
                        : "bg-[#ebebeb]"
                    )}
                    onClick={() => setCfg({ ...cfg, thinking: level })}
                  />
                );
              })}
            </div>
            <span className="w-12 text-xs font-medium text-muted-foreground text-right">
              {THINKING_LABELS_ADMIN[cfg.thinking as ThinkingLevelAdmin] ?? cfg.thinking}
            </span>
          </div>
        </div>

        {/* Prompt preview */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-sm font-medium">提示词预览</span>
              <p className="text-xs text-muted-foreground">提示词中必须包含 <code className="text-foreground bg-muted px-1 rounded">{'{{detail_prompt}}'}</code> 占位符。</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewOpen(true)}
              className="rounded-full shrink-0"
            >
              <Edit className="size-3.5 mr-1" />
              编辑
            </Button>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <pre className="max-h-[160px] overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {cfg.prompt ? cfg.prompt : <span className="italic text-muted-foreground/50">暂无提示词</span>}
            </pre>
          </div>
          {!cfg.prompt.includes("{{detail_prompt}}") && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle size={12} />
              提示词模板必须包含 {'{{detail_prompt}}'} 占位符
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
        <Button size="sm" onClick={() => void save()} disabled={saving || !cfg.prompt.includes("{{detail_prompt}}")}>
          <Sparkles className="size-3.5 mr-1" />
          {saving ? "保存中…" : "保存配置"}
        </Button>
      </div>

      <PromptDescEditorModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        prompt={cfg.prompt}
        onChange={(v) => setCfg({ ...cfg, prompt: v })}
      />
    </div>
  );
}

function AiCheckPanel({
  configs, checkDrafts, getCheckDraft, setCheckDraft, models, checkSaving, onSave,
}: {
  configs: AdminConfig[];
  checkDrafts: Record<string, DraftValue>;
  getCheckDraft: (configKey: string) => DraftValue;
  setCheckDraft: (configKey: string, value: DraftValue) => void;
  models: AiModelOption[];
  checkSaving: boolean;
  onSave: () => void;
}) {
  const [activeCheck, setActiveCheck] = useState<string>("character");
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);

  const checkModelId = (id: string) => String(getCheckDraft(`${id}_model_id`) || "__none");
  const checkModelMissing = (id: string) => {
    const mid = checkModelId(id);
    return mid !== "__none" && !models.some((m) => m.id === mid);
  };
  const checkThinking = (id: string) => String(getCheckDraft(`${id}_thinking`) || "xhigh");
  const checkPrompt = (id: string) => String(getCheckDraft(`${id}_prompt`) || "");

  const hasValidationError = (id: string) => {
    if (getCheckDraft(`${id}_enabled`) === false) return false;
    const prompt = String(getCheckDraft(`${id}_prompt`) || "");
    const required = CHECK_REQUIRED[id] || [];
    return required.some((key) => !prompt.includes(`{{${key}}}`));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card">
      {/* Sub-tabs for 3 rounds */}
      <Tabs value={activeCheck} onValueChange={(v) => setActiveCheck(v)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 px-5 pt-5">
          <TabsList className="flex w-max gap-1.5 bg-transparent p-0 h-auto border-0 shadow-none justify-start">
            {CHECK_IDS.map((checkId) => (
              <TabsTrigger
                key={checkId}
                value={String(checkId)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm leading-5 tracking-[-0.02em] transition-all flex-none h-auto w-auto",
                  "data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm",
                  "data-[state=inactive]:bg-muted data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground"
                )}
              >
                {CHECK_NAMES[checkId]}
                {hasValidationError(checkId) && (
                  <AlertCircle size={12} className="text-destructive" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {CHECK_IDS.map((checkId) => {
            const enabled = getCheckDraft(`${checkId}_enabled`) !== false;
            const promptText = checkPrompt(checkId);
            return (
              <TabsContent key={checkId} value={String(checkId)} className="mt-6 space-y-6">
                {/* 1. 是否开启 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium">是否开启</span>
                    <p className="text-xs text-muted-foreground">启用 {CHECK_NAMES[checkId]} 功能</p>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) => setCheckDraft(`${checkId}_enabled`, checked)}
                  />
                </div>

                <div className="border-t border-border" />

                {/* 2. 模型配置（模型选择 + 思考强度 合并） */}
                <div className="space-y-3">
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium">模型配置</span>
                    <p className="text-xs text-muted-foreground">选择执行 {CHECK_NAMES[checkId]} 的 AI 模型并调节推理深度</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">模型</label>
                        <Select
                          value={checkModelId(checkId)}
                          onValueChange={(v) => setCheckDraft(`${checkId}_model_id`, v === "__none" ? "" : v)}
                        >
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectGroup>
                            <SelectItem value="__none">未选择</SelectItem>
                            {checkModelMissing(checkId) && (
                              <SelectItem value={checkModelId(checkId)}>当前不可用模型</SelectItem>
                            )}
                            {models.map((m) => (<SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>))}
                          </SelectGroup></SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 sm:min-w-[200px]">
                        <label className="text-xs font-medium text-muted-foreground">思考强度</label>
                        <ThinkingBar
                          value={checkThinking(checkId)}
                          onChange={(v) => setCheckDraft(`${checkId}_thinking`, v)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {checkId !== "character" && (
                  <>
                    <div className="border-t border-border" />
                    <div className="space-y-2">
                      <div className="space-y-0.5">
                        <span className="text-sm font-medium">参考前 N 章</span>
                        <p className="text-xs text-muted-foreground">检查时参考当前章节之前的章节数量</p>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={String(getCheckDraft(`${checkId}_chapter_count`) ?? 6)}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!isNaN(v) && v >= 1) setCheckDraft(`${checkId}_chapter_count`, String(v));
                        }}
                        className="w-24"
                      />
                    </div>
                  </>
                )}

                <div className="border-t border-border" />

                {/* 3. 提示词预览 */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium">提示词预览</span>
                      <p className="text-xs text-muted-foreground">{CHECK_NAMES[checkId]} 使用的提示词模板</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPromptEditorOpen(true)}
                      className="rounded-full shrink-0"
                    >
                      <Edit className="size-3.5 mr-1" />
                      编辑
                    </Button>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <pre className="max-h-[160px] overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                      {promptText ? promptText : <span className="italic text-muted-foreground/50">暂无提示词</span>}
                    </pre>
                  </div>
                  {hasValidationError(checkId) && enabled && (
                    <span className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle size={12} />
                      缺少必要占位符
                    </span>
                  )}
                </div>
              </TabsContent>
            );
          })}
        </div>
      </Tabs>

      {/* 底部保存栏 */}
      <div className="border-t border-border px-5 py-3 flex items-center justify-between shrink-0">
        <span className="text-xs text-muted-foreground">配置修改后需保存方可生效</span>
        <Button onClick={onSave} disabled={checkSaving} className="rounded-full">
          <Save className="size-4 mr-1" />
          {checkSaving ? "保存中..." : "保存配置"}
        </Button>
      </div>

      <PromptEditorModal
        open={promptEditorOpen}
        onOpenChange={setPromptEditorOpen}
        checkId={activeCheck}
        promptText={checkPrompt(activeCheck)}
        getCheckDraft={getCheckDraft}
        setCheckDraft={setCheckDraft}
      />
    </div>
  );
}

export default function AdminConfigsPage() {
  const client = useMemo(() => adminClient(), []);
  const [configs, setConfigs] = useState<AdminConfig[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [activeGroup, setActiveGroup] = useState("");
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});
  const [pendingGroup, setPendingGroup] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftValue>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [models, setModels] = useState<AiModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  const [checkDrafts, setCheckDrafts] = useState<Record<string, DraftValue>>({});
  const [checkSaving, setCheckSaving] = useState(false);

  const visibleDirtyIds = configs.filter((item) => dirtyIds.has(item.id) && !jsonErrors[item.id]).map((item) => item.id);
  const hasDirty = dirtyIds.size > 0;

  async function load(targetGroup?: string, silent?: boolean) {
    if (!silent) setLoading(true);
    setLoadError(false);
    try {
      const allData = await client.listAdminConfigs({ pageSize: 100 });

      const nextGroups = Array.from(new Set(allData.items.map((item) => item.config_group))).sort();
      setGroups(nextGroups);

      const counts: Record<string, number> = {};
      for (const item of allData.items) {
        counts[item.config_group] = (counts[item.config_group] || 0) + 1;
      }
      setGroupCounts(counts);

      const group = targetGroup || activeGroup || nextGroups[0] || "";
      if (!activeGroup) setActiveGroup(group);

      const filtered = allData.items.filter((item) => item.config_group === group);
      setConfigs(filtered);
      setDrafts((current) => {
        const next = { ...current };
        for (const item of filtered) {
          if (!dirtyIds.has(item.id)) next[item.id] = configValue(item);
        }
        return next;
      });

      if (!models.length) { try { setModels(await client.listAiModels()); } catch {} }
    } catch { setLoadError(true); toast.error("配置加载失败"); }
    finally { if (!silent) setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

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
      toast.success("配置已保存"); await load(); return true;
    } catch { toast.error("配置保存失败"); return false; }
    finally { setSaving(false); }
  }

  function requestGroupChange(group: string) {
    if (group === activeGroup) return;
    if (hasDirty) { setPendingGroup(group); return; }
    applyGroup(group);
  }

  function applyGroup(group: string) {
    setActiveGroup(group);
    void load(group);
  }

  async function saveAndSwitch() {
    if (!pendingGroup) return;
    const saved = await saveDirty(Array.from(dirtyIds));
    if (!saved) return;
    const group = pendingGroup;
    setPendingGroup(null);
    applyGroup(group);
  }

  async function discardAndSwitch() {
    if (!pendingGroup) return;
    setDirtyIds(new Set()); setJsonErrors({});
    const group = pendingGroup;
    setPendingGroup(null);
    applyGroup(group);
  }

  function getCheckDraft(configKey: string): DraftValue {
    for (const config of configs) {
      if (config.config_group === "ai.editor_check" && config.config_key === configKey) {
        return checkDrafts[config.id] ?? configValue(config);
      }
    }
    return "";
  }

  function setCheckDraft(configKey: string, value: DraftValue) {
    for (const config of configs) {
      if (config.config_group === "ai.editor_check" && config.config_key === configKey) {
        setCheckDrafts((prev) => ({ ...prev, [config.id]: value }));
        return;
      }
    }
  }

  async function saveCheckConfig() {
    setCheckSaving(true);
    try {
      for (const config of configs) {
        if (config.config_group !== "ai.editor_check") continue;
        const draft = checkDrafts[config.id];
        if (draft === undefined) continue;
        const current = configValue(config);
        if (String(draft) === String(current)) continue;
        await client.updateAdminConfig(config.id, payloadFor(config, draft));
      }
      toast.success("AI 检查配置已保存");
      await load(activeGroup, true);
    } catch {
      toast.error("配置保存失败");
    } finally {
      setCheckSaving(false);
    }
  }

  function renderControl(config: AdminConfig) {
    const value = drafts[config.id] ?? configValue(config);
    if (config.value_type === "boolean") return (
      <div className="flex items-center gap-3">
        <Switch checked={Boolean(value)} onCheckedChange={(checked) => updateDraft(config, checked)} />
        <span className="text-xs text-muted-foreground">{value ? "已启用" : "已关闭"}</span>
      </div>
    );
    if (config.value_type === "json") return (
      <div className="flex flex-col gap-1">
        <Textarea className="min-h-[72px]" value={String(value)} onChange={(e) => updateDraft(config, e.target.value)} />
        {jsonErrors[config.id] && <span className="text-xs text-destructive">{jsonErrors[config.id]}</span>}
      </div>
    );
    return (
      <div className="flex gap-2">
        <Input type={config.value_type === "secret" && !reveal[config.id] ? "password" : "text"} value={String(value)} onChange={(e) => updateDraft(config, e.target.value)} />
        {config.value_type === "secret" && (
          <button
            type="button"
            onClick={() => setReveal((c) => ({ ...c, [config.id]: !c[config.id] }))}
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
          >
            {reveal[config.id] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        )}
      </div>
    );
  }

  return (
    <AdminPage>


      {loading ? (
        <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={cn("px-5 py-4", i < 4 && "border-b border-border")}>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-52" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-card p-12 shadow-card">
          <Empty>
            <EmptyHeader>
              <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground">
                <AlertCircle className="size-5" />
              </div>
              <EmptyTitle>配置加载失败</EmptyTitle>
              <EmptyDescription>请检查登录状态或稍后重试。</EmptyDescription>
            </EmptyHeader>
            <Button
              variant="outline"
              size="sm"
              className="mx-auto mt-4 rounded-full"
              onClick={() => void load()}
            >
              重新加载
            </Button>
          </Empty>
        </div>
      ) : !groups.length ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-card p-12 shadow-card">
          <Empty>
            <EmptyHeader>
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground/30">
                <Settings2 className="size-5" />
              </div>
              <EmptyTitle>没有配置项</EmptyTitle>
              <EmptyDescription>系统暂无配置数据。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <Tabs value={activeGroup} onValueChange={requestGroupChange} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="overflow-x-auto overflow-y-hidden shrink-0 -mx-1 px-1">
            <TabsList className="flex w-max min-w-full flex-wrap gap-1.5 bg-transparent p-0 h-auto border-0 shadow-none">
              {groups.map((g) => (
                <TabsTrigger
                  key={g}
                  value={g}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm leading-5 tracking-[-0.02em] transition-all",
                    "data-[state=active]:bg-card data-[state=active]:shadow-card data-[state=active]:text-foreground",
                    "data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground"
                  )}
                >
                  {groupLabel(g)}
                  {groupCounts[g] != null && (
                    <span className="font-mono text-[10px] leading-none text-muted-foreground/50 data-[state=active]:text-muted-foreground/70">
                      {groupCounts[g]}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {groups.map((group) => (
            <TabsContent key={group} value={group} className="mt-4 flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
              {activeGroup === group && group === "ai.prompt_description" ? (
                <PromptDescriptionPanel configs={configs} models={models} />
              ) : activeGroup === group && group === "ai.editor_check" ? (
                <AiCheckPanel
                  configs={configs}
                  checkDrafts={checkDrafts}
                  getCheckDraft={getCheckDraft}
                  setCheckDraft={setCheckDraft}
                  models={models}
                  checkSaving={checkSaving}
                  onSave={() => void saveCheckConfig()}
                />
              ) : activeGroup === group && (
                !configs.length ? (
                  <div className="flex h-full items-center justify-center">
                    <Empty>
                      <EmptyHeader>
                        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground/30">
                          <Settings2 className="size-5" />
                        </div>
                        <EmptyTitle>没有配置项</EmptyTitle>
                        <EmptyDescription>当前分组下没有可编辑配置。</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card">
                    <div className="overflow-auto flex-1">
                      {configs.map((config, index) => (
                        <div
                          key={config.id}
                          className={cn(
                            "px-5 py-4 grid gap-x-6 gap-y-2 lg:grid-cols-[200px_1fr] lg:items-start transition-colors hover:bg-muted/20",
                            index < configs.length - 1 && "border-b border-border"
                          )}
                        >
                          <div className="flex min-w-0 flex-col gap-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-medium">{configLabel(config)}</span>
                              <MonoBadge>{config.value_type}</MonoBadge>
                              {config.is_required && <MonoBadge>必填</MonoBadge>}
                              {dirtyIds.has(config.id) && (
                                <MonoBadge className="text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950">
                                  未保存
                                </MonoBadge>
                              )}
                            </div>
                            <span className="caption-mono">{config.config_group}.{config.config_key}</span>
                            {config.description && (
                              <span className="text-xs text-muted-foreground/70 leading-relaxed">{config.description}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            {renderControl(config)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border px-5 py-3 flex items-center justify-between shrink-0">
                      <span className="text-xs text-muted-foreground">配置修改后需保存方可生效</span>
                      <Button
                        disabled={saving || visibleDirtyIds.length === 0}
                        onClick={() => void saveDirty()}
                        className="rounded-full px-5 shadow-sm shrink-0"
                      >
                        <Save className="size-4 mr-1" /> 保存配置
                      </Button>
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
