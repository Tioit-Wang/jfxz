"use client";

import { AlertCircle, Clock, Edit3, Eye, Loader2, RefreshCw, Settings, Trash2, Type, UserCircle, Wand2, type LucideIcon } from "lucide-react";
import type { ApiSuggestion } from "@/api";
import { ChapterPlainTextEditor } from "@/components/ChapterPlainTextEditor";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Chapter } from "@/domain";
import { useCallback, useEffect, useRef, useState } from "react";

type SaveStatus = "loading" | "dirty" | "saving" | "saved" | "offline" | "error" | "analyzing" | "analyzed";

type WorkspaceEditorPanelProps = {
  activeChapter?: Chapter;
  chapterOrder: number;
  title: string;
  summary: string;
  content: string;
  status: SaveStatus;
  statusLabel: string;
  statusTone: "success" | "muted" | "warning";
  StatusIcon: LucideIcon;
  count: number;
  todayCount: number;
  suggestions: ApiSuggestion[];
  activeSuggestionIndex: number | null;
  showSuggestions?: boolean;
  accountLabel: string;
  accountSubtitle: string;
  styleSettings: {
    fontStack: string;
    fontSize: number;
    lineHeight: number;
    letterSpacing: number;
    paragraphSpacing: number;
  };
  onTitleChange: (value: string) => void;
  onOpenSummaryModal: () => void;
  onDeleteChapter: () => void;
  onPreview: () => void;
  onOpenShare: () => void;
  onOpenEditorSettings: () => void;
  onOpenVersionHistory: () => void;
  onOpenAccount: () => void;
  onAnalyze: () => void;
  onContentChange: (value: string) => void;
  onActivateSuggestion: (index: number) => void;
  onQuoteToChat?: (range: string, selectedText: string) => void;
  remoteUpdateNotice: string | null;
  onAcceptRemoteUpdate: () => void;
};

type FormatOptions = {
  removeBlankLines: boolean;
  splitBySemicolon: boolean;
  splitByPeriod: boolean;
  englishToChinesePunctuation: boolean;
  removeExtraSpaces: boolean;
  convertCornerBrackets: boolean;
  fullwidthToHalfwidth: boolean;
  mergeBlankLines: boolean;
  deduplicatePunctuation: boolean;
  cleanQuotedTerminalPunct: boolean;
};

function applyFormatting(text: string, options: FormatOptions): string {
  let result = text;

  // 1. Full-width → half-width (digits and letters)
  if (options.fullwidthToHalfwidth) {
    result = result.replace(/[０-９]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
    );
    result = result.replace(/[Ａ-Ｚ]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
    );
    result = result.replace(/[ａ-ｚ]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
    );
  }

  // 2. English → Chinese punctuation
  if (options.englishToChinesePunctuation) {
    result = result.replace(/\./g, "。").replace(/,/g, "，").replace(/;/g, "；");
  }

  // 3. Corner brackets → Chinese double quotes
  if (options.convertCornerBrackets) {
    result = result.replace(/「/g, "“").replace(/」/g, "”");
  }

  // 4. Clean terminal punctuation inside quotes (delete, not move)
  if (options.cleanQuotedTerminalPunct) {
    result = result.replace(/“([^”]*?)[。！？](?=”|$)/g, (_, content) => `“${content}`);
    result = result.replace(/[「]([^」]*?)[。！？](?=」|$)/g, (_, content) => `「${content}`);
    result = result.replace(/“([^”]*?)[。！？](?=”|$)/g, (_, content) => `“${content}`);
  }

  // 5. Split by Chinese semicolons (add newline after each)
  if (options.splitBySemicolon) {
    result = result.replace(/；/g, "；\n");
  }

  // 6. Split by Chinese periods (add newline after each, skip quoted periods)
  if (options.splitByPeriod) {
    const chars = [...result];
    let inDoubleQuote = false;
    let inCornerBracket = false;
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch === '"' || ch === "“" || ch === "”") inDoubleQuote = !inDoubleQuote;
      if (ch === "「") inCornerBracket = true;
      if (ch === "」") inCornerBracket = false;
      if (ch === "。" && !inDoubleQuote && !inCornerBracket) {
        chars[i] = "。\n";
      }
    }
    result = chars.join("");
  }

  // 7. Remove extra spaces between Chinese characters
  if (options.removeExtraSpaces) {
    result = result.replace(/([一-鿿])\s+([一-鿿])/g, "$1$2");
  }

  // 8. Deduplicate punctuation
  if (options.deduplicatePunctuation) {
    result = result.replace(/([，、；：])\1+/g, "$1");
    result = result.replace(/([^，、；：。.!！])\1{2,}/g, "$1");
  }

  // 9. Merge consecutive blank lines (multiple blank lines → one)
  if (options.mergeBlankLines) {
    result = result.replace(/\n{3,}/g, "\n\n");
  }

  // 10. Remove all blank lines
  if (options.removeBlankLines) {
    result = result
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .join("\n");
  }

  return result;
}

export function WorkspaceEditorPanel({
  activeChapter,
  chapterOrder,
  title,
  summary,
  content,
  status,
  statusLabel,
  statusTone,
  StatusIcon,
  count,
  todayCount,
  suggestions,
  activeSuggestionIndex,
  showSuggestions,
  accountLabel,
  accountSubtitle,
  styleSettings,
  onTitleChange,
  onOpenSummaryModal,
  onDeleteChapter,
  onPreview,
  onOpenShare,
  onOpenEditorSettings,
  onOpenVersionHistory,
  onOpenAccount,
  onAnalyze,
  onContentChange,
  onActivateSuggestion,
  onQuoteToChat,
  remoteUpdateNotice,
  onAcceptRemoteUpdate,
}: WorkspaceEditorPanelProps) {
  const readingMinutes = count > 0 ? Math.max(1, Math.ceil(count / 500)) : 0;
  const [formatPopupOpen, setFormatPopupOpen] = useState(false);
  const [formatOptions, setFormatOptions] = useState<FormatOptions>({
    removeBlankLines: false,
    splitBySemicolon: false,
    splitByPeriod: false,
    englishToChinesePunctuation: false,
    removeExtraSpaces: false,
    convertCornerBrackets: false,
    fullwidthToHalfwidth: false,
    mergeBlankLines: false,
    deduplicatePunctuation: false,
    cleanQuotedTerminalPunct: false,
  });
  const formatPopupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        formatPopupOpen &&
        formatPopupRef.current &&
        !formatPopupRef.current.contains(event.target as Node)
      ) {
        setFormatPopupOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [formatPopupOpen]);

  const handleFormat = useCallback(() => {
    const formatted = applyFormatting(content, formatOptions);
    onContentChange(formatted);
    setFormatPopupOpen(false);
  }, [content, formatOptions, onContentChange]);

  return (
    <main data-testid="workspace-editor-panel" className="relative z-0 flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
      <div className="z-10 flex h-14 shrink-0 items-center justify-between border-b border-[#ebebeb] bg-white px-6">
        <div className="flex items-center gap-4">
          <button
            className="rounded-full p-1.5 text-[#888888] transition-colors hover:bg-[#f5f5f5] hover:text-[#171717]"
            onClick={onOpenShare}
            aria-label="分享与预览"
            title="分享与预览"
          >
            <Eye size={16} />
          </button>
          <button
            className="rounded-full p-1.5 text-[#888888] transition-colors hover:bg-[#f7d4d6] hover:text-[#ee0000]"
            onClick={onDeleteChapter}
            aria-label="删除当前章节"
          >
            <Trash2 size={16} />
          </button>
          <button
            className="rounded-full p-1.5 text-[#888888] transition-colors hover:bg-[#f5f5f5] hover:text-[#171717]"
            onClick={onOpenEditorSettings}
            aria-label="编辑器设置"
          >
            <Settings size={16} />
          </button>
          <button
            className="rounded-full p-1.5 text-[#888888] transition-colors hover:bg-[#f5f5f5] hover:text-[#171717]"
            onClick={onOpenVersionHistory}
            aria-label="历史版本"
            title="历史版本"
          >
            <Clock size={16} />
          </button>
          <div className="relative">
            <button
              className="rounded-full p-1.5 text-[#888888] transition-colors hover:bg-[#f5f5f5] hover:text-[#171717]"
              onClick={() => setFormatPopupOpen((prev) => !prev)}
              aria-label="文本格式化"
              title="文本格式化"
            >
              <Type size={16} />
            </button>
            {formatPopupOpen && (
              <div
                ref={formatPopupRef}
                className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl bg-white p-4 shadow-[0px_8px_16px_-4px_rgba(0,0,0,0.06),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#00000014]"
              >
                {([
                  ["removeBlankLines", "移除空白行"],
                  ["splitBySemicolon", "按；换行"],
                  ["splitByPeriod", "按。换行"],
                  ["englishToChinesePunctuation", "英文标点→中文标点"],
                  ["removeExtraSpaces", "清除多余空格"],
                  ["convertCornerBrackets", "「」→“”"],
                  ["fullwidthToHalfwidth", "全角半角转换"],
                  ["mergeBlankLines", "合并连续空行"],
                  ["deduplicatePunctuation", "去除重复标点"],
                  ["cleanQuotedTerminalPunct", "双号内终止符号清理"],
                ] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-[#171717]">{label}</span>
                    <Switch
                      checked={formatOptions[key]}
                      onCheckedChange={(checked) =>
                        setFormatOptions((prev) => ({ ...prev, [key]: checked }))
                      }
                      size="sm"
                      aria-label={label}
                    />
                  </div>
                ))}
                <div className="my-3 border-t border-[#ebebeb]" />
                <button
                  onClick={handleFormat}
                  className="w-full rounded-full bg-[#171717] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#171717]/90"
                  aria-label="格式化"
                >
                  格式化
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="hidden items-center gap-2 rounded-full border border-[#ebebeb] bg-[#f7f3ea] px-3 py-1.5 text-left shadow-sm transition-all hover:-translate-y-px hover:border-[#171717] sm:flex"
            onClick={onOpenAccount}
            aria-label="账户中心"
          >
            <UserCircle size={17} className="text-[#171717]" />
            <span className="max-w-28 truncate text-xs font-bold text-[#171717]">{accountLabel}</span>
            <span className="max-w-20 truncate rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#888888]">{accountSubtitle}</span>
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-full bg-[#171717] px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#171717]/90 disabled:opacity-60"
            onClick={onAnalyze}
            disabled={status === "analyzing"}
          >
            {status === "analyzing" ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            <span>AI 分析本章</span>
          </button>
        </div>
      </div>

      <div className="flex min-h-0 w-full flex-1 justify-center overflow-y-auto">
        <div className="flex min-h-full w-full max-w-3xl min-w-0 flex-col px-4 py-12 md:px-10">
          {activeChapter ? (
            <>
              <div className="mb-6 flex items-baseline gap-2">
                <span className="shrink-0 text-3xl font-bold text-[#888888] select-none">
                  第{chapterOrder}章
                </span>
                <input
                  aria-label="章节标题"
                  type="text"
                  value={title}
                  onChange={(event) => onTitleChange(event.target.value)}
                  className="flex-1 border-none bg-transparent text-3xl font-bold text-[#171717] outline-none placeholder:text-[#888888]"
                  placeholder="请输入章节名称"
                />
              </div>

              <div className="group relative mb-10">
                <div className="absolute -left-4 bottom-3 top-3 w-1 rounded-full bg-gray-200 transition-colors group-hover:bg-gray-300" />
                <div className="relative min-h-[60px] rounded-xl border border-transparent bg-[#f5f5f5] p-4 text-sm text-[#888888] transition-all group-hover:border-[#ebebeb]">
                  <div className="whitespace-pre-wrap pr-10 leading-relaxed line-clamp-3 break-words">
                    {summary || <span className="text-gray-400">尚未填写章节提要，点击右侧编辑...</span>}
                  </div>
                  <button
                    onClick={onOpenSummaryModal}
                    className="absolute right-3 top-3 rounded-full border border-[#ebebeb] bg-white p-1.5 text-[#888888] opacity-0 shadow-sm transition-all duration-200 hover:bg-[#fafafa] hover:text-[#171717] group-hover:opacity-100"
                    title="编辑章节提要"
                    aria-label="编辑章节提要"
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
              </div>

              {remoteUpdateNotice ? (
                <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                  <AlertCircle size={15} className="shrink-0" />
                  <span className="flex-1">{remoteUpdateNotice}</span>
                  <button
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#171717] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[#171717]/90"
                    onClick={onAcceptRemoteUpdate}
                  >
                    <RefreshCw size={12} />
                    加载最新版本
                  </button>
                </div>
              ) : null}

              <ChapterPlainTextEditor
                value={content}
                suggestions={suggestions}
                activeSuggestionIndex={activeSuggestionIndex}
                showSuggestions={showSuggestions}
                disabled={status === "loading"}
                onChange={onContentChange}
                onActivateSuggestion={onActivateSuggestion}
                onQuoteToChat={onQuoteToChat}
                styleSettings={styleSettings}
              />
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-sm text-gray-400">暂无章节</div>
          )}
        </div>
      </div>

      <div className="flex h-10 shrink-0 items-center justify-between border-t border-[#ebebeb] bg-white px-6 text-[12px] font-medium text-[#888888]">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex select-none items-center gap-1.5">
            <StatusIcon
              size={14}
              className={cn(
                statusTone === "success" ? "text-green-500" : "text-gray-400",
                (status === "saving" || status === "loading" || status === "analyzing") && "animate-spin"
              )}
            />
            {statusLabel}
          </span>
          <span>本章字数: {count}</span>
          <span>预计阅读: {readingMinutes} 分钟</span>
        </div>
        <div>今日字数: {todayCount}</div>
      </div>
    </main>
  );
}
