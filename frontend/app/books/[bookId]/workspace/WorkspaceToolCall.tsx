"use client";

import { diffLines, type Change } from "diff";
import {
  Check,
  ChevronDown,
  FileText,
  Layers3,
  Loader2,
  PencilLine,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { ToolCallBlock } from "@/api";
import { cn } from "@/lib/utils";

type WorkspaceToolCallProps = {
  block: ToolCallBlock;
  expanded: boolean;
  onToggle: () => void;
};

const TOOL_LABELS: Record<string, string> = {
  get_character: "查询角色",
  list_characters: "列出角色",
  create_or_update_character: "保存角色",
  delete_character: "删除角色",
  get_setting: "查询设定",
  list_settings: "列出设定",
  create_or_update_setting: "保存设定",
  delete_setting: "删除设定",
  get_chapter: "查询章节",
  list_chapters: "列出章节",
  create_chapter: "创建章节",
  update_chapter_summary: "更新提要",
  update_chapter_content: "更新正文",
  list_volumes: "列出卷",
  create_volume: "创建卷",
  update_volume: "更新卷",
  get_work_info: "查看作品",
  update_work_info: "更新作品",
};

export function toolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

function toolIcon(toolName: string): LucideIcon {
  if (toolName.includes("volume")) return Layers3;
  if (toolName.includes("chapter")) return FileText;
  if (toolName.includes("delete")) return Trash2;
  if (toolName.includes("update") || toolName.includes("create")) return PencilLine;
  return Sparkles;
}

function parseJson(resultStr: string): unknown | null {
  try {
    return JSON.parse(resultStr);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function truncate(value: string, length = 72): string {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function resultItems(resultStr: string, key: string): Array<Record<string, unknown>> | null {
  const parsed = parseJson(resultStr);
  if (Array.isArray(parsed)) return parsed.map(asRecord);
  const record = asRecord(parsed);
  const list = record[key];
  return Array.isArray(list) ? list.map(asRecord) : null;
}

function FieldLine({ label, value }: { label: string; value: unknown }) {
  const text = stringValue(value);
  if (!text) return null;
  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">{label}</span>
      <p className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-[12px] leading-5 text-neutral-700">{text}</p>
    </div>
  );
}

function renderPlain(resultStr: string) {
  const parsed = parseJson(resultStr);
  if (!parsed) {
    return <p className="whitespace-pre-wrap text-[12px] leading-5 text-neutral-600">{truncate(resultStr, 800)}</p>;
  }
  return (
    <pre className="max-h-64 overflow-auto rounded-xl bg-neutral-950 p-3 text-[11px] leading-5 text-neutral-100">
      {JSON.stringify(parsed, null, 2)}
    </pre>
  );
}

function renderDiffResult(resultStr: string) {
  const parsed = asRecord(parseJson(resultStr));
  const oldContent = stringValue(parsed.old_content_preview ?? parsed.old_content);
  const newContent = stringValue(parsed.new_content_preview ?? parsed.new_content);
  if (!oldContent && !newContent) return renderPlain(resultStr);

  const changes: Change[] = diffLines(oldContent, newContent);
  return (
    <div className="max-h-64 overflow-auto rounded-xl border border-neutral-200 bg-white font-mono text-[11px] leading-relaxed">
      {changes.map((change, i) => {
        const lines = change.value.split("\n").filter((line, idx, arr) => idx < arr.length - 1 || line !== "");
        return lines.map((line, j) => {
          const key = `${i}-${j}`;
          if (change.added) return <div key={key} className="bg-emerald-50 px-2 py-0.5 text-emerald-700">+ {line}</div>;
          if (change.removed) return <div key={key} className="bg-rose-50 px-2 py-0.5 text-rose-700">- {line}</div>;
          return <div key={key} className="px-2 py-0.5 text-neutral-500">  {line}</div>;
        });
      })}
    </div>
  );
}

function renderNamedList(resultStr: string, key: string, emptyText: string) {
  const items = resultItems(resultStr, key);
  if (!items) return renderPlain(resultStr);
  if (!items.length) return <p className="rounded-xl border border-dashed border-neutral-200 px-3 py-4 text-center text-xs text-neutral-400">{emptyText}</p>;

  return (
    <div className="grid gap-2">
      {items.map((item, index) => {
        const id = stringValue(item.id);
        const title = stringValue(item.name ?? item.title) || "未命名";
        const summary = stringValue(item.summary ?? item.detail ?? item.content);
        const order = numberValue(item.order_index ?? item.order);
        const volumeId = stringValue(item.volume_id);
        return (
          <div key={id || `${title}-${index}`} className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-semibold text-neutral-900">{order ? `${order}. ` : ""}{title}</span>
              {id ? <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-[10px] text-neutral-500">{id.slice(0, 8)}</span> : null}
            </div>
            {summary ? <p className="mt-1 truncate text-xs text-neutral-500">{truncate(summary, 96)}</p> : null}
            {volumeId ? <p className="mt-1 font-mono text-[10px] text-neutral-400">卷 {volumeId.slice(0, 8)}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

function renderDetail(resultStr: string, titleKeys: string[], fields: Array<[string, string]>) {
  const data = asRecord(parseJson(resultStr));
  const error = stringValue(data.error);
  if (error) return <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>;
  if (!Object.keys(data).length) return renderPlain(resultStr);

  const title = titleKeys.map((key) => stringValue(data[key])).find(Boolean) || "已完成";
  const id = stringValue(data.id ?? data.character_id ?? data.setting_id ?? data.chapter_id ?? data.volume_id);
  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-bold text-neutral-950">{title}</span>
        {id ? <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-[10px] text-neutral-500">{id.slice(0, 8)}</span> : null}
      </div>
      <div className="space-y-2">
        {fields.map(([key, label]) => <FieldLine key={key} label={label} value={data[key]} />)}
      </div>
    </div>
  );
}

function renderDelete(resultStr: string, label: string, idKey: string) {
  const data = asRecord(parseJson(resultStr));
  if (!Object.keys(data).length) return renderPlain(resultStr);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
      <Trash2 size={13} />
      <span className="font-semibold">{label}{stringValue(data.name) ? `「${stringValue(data.name)}」` : ""}</span>
      {data[idKey] ? <span className="font-mono text-[10px] text-rose-400">{stringValue(data[idKey]).slice(0, 8)}</span> : null}
    </div>
  );
}

function renderToolResult(block: ToolCallBlock) {
  if (!block.result) return null;
  if (block.tool === "update_chapter_content") return renderDiffResult(block.result);
  if (block.tool === "list_characters") return renderNamedList(block.result, "characters", "暂无角色");
  if (block.tool === "list_settings") return renderNamedList(block.result, "settings", "暂无设定");
  if (block.tool === "list_chapters") return renderNamedList(block.result, "chapters", "暂无章节");
  if (block.tool === "list_volumes") return renderNamedList(block.result, "volumes", "暂无卷");
  if (block.tool === "get_character") return renderDetail(block.result, ["name"], [["summary", "简介"], ["detail", "详细描述"]]);
  if (block.tool === "get_setting") return renderDetail(block.result, ["name"], [["type", "类型"], ["summary", "简介"], ["detail", "详情"]]);
  if (block.tool === "get_chapter") return renderDetail(block.result, ["title"], [["summary", "提要"], ["content", "正文"], ["volume_id", "卷 ID"]]);
  if (block.tool === "get_work_info" || block.tool === "update_work_info") {
    return renderDetail(block.result, ["title"], [["short_intro", "简介"], ["synopsis", "大纲"], ["background_rules", "背景规则"], ["focus_requirements", "创作重点"], ["forbidden_requirements", "禁忌要求"]]);
  }
  if (block.tool === "create_or_update_character") return renderDetail(block.result, ["name"], [["summary", "简介"], ["detail", "详细描述"]]);
  if (block.tool === "create_or_update_setting") return renderDetail(block.result, ["name"], [["type", "类型"], ["summary", "简介"], ["detail", "详情"]]);
  if (block.tool === "create_volume" || block.tool === "update_volume") return renderDetail(block.result, ["title"], [["order_index", "排序"]]);
  if (block.tool === "create_chapter" || block.tool === "update_chapter_summary") return renderDetail(block.result, ["title"], [["summary", "提要"], ["volume_id", "卷 ID"]]);
  if (block.tool === "delete_character") return renderDelete(block.result, "已删除角色", "character_id");
  if (block.tool === "delete_setting") return renderDelete(block.result, "已删除设定", "setting_id");
  return renderPlain(block.result);
}

export function WorkspaceToolCall({ block, expanded, onToggle }: WorkspaceToolCallProps) {
  const isStarted = block.status === "started";
  const Icon = toolIcon(block.tool);
  const label = toolLabel(block.tool);

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white text-xs shadow-[0_10px_30px_-24px_rgba(0,0,0,0.35)]">
      <button
        type="button"
        className="flex w-full cursor-pointer select-none items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-neutral-50"
        onClick={onToggle}
      >
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", isStarted ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600")}>
          {isStarted ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        </span>
        <Icon size={14} className="shrink-0 text-neutral-500" />
        <span className="font-bold text-neutral-950">{label}</span>
        {block.display && block.display !== label ? <span className="min-w-0 truncate text-neutral-400">{block.display}</span> : null}
        <ChevronDown size={14} className={cn("ml-auto shrink-0 text-neutral-400 transition-transform duration-300", expanded && "rotate-180")} />
      </button>
      <div className={cn("tool-collapse", expanded && "expanded")}>
        <div>
          <div className="border-t border-neutral-200 bg-neutral-50/60 p-3">
            {block.result ? renderToolResult(block) : <p className="text-xs text-neutral-400">工具正在执行，结果会在完成后显示。</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
