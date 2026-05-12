"use client";

import { AlertCircle, Edit3, Eye, Loader2, RefreshCw, Settings, Trash2, UserCircle, Wand2, type LucideIcon } from "lucide-react";
import type { ApiSuggestion } from "@/api";
import { ChapterPlainTextEditor } from "@/components/ChapterPlainTextEditor";
import { cn } from "@/lib/utils";
import type { Chapter } from "@/domain";

type SaveStatus = "loading" | "dirty" | "saving" | "saved" | "offline" | "error" | "analyzing" | "analyzed";

type WorkspaceEditorPanelProps = {
  activeChapter?: Chapter;
  title: string;
  summary: string;
  content: string;
  status: SaveStatus;
  statusLabel: string;
  statusTone: "success" | "muted" | "warning";
  StatusIcon: LucideIcon;
  count: number;
  todayCount: number;
  analysisNotice: string;
  suggestions: ApiSuggestion[];
  activeSuggestionIndex: number | null;
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
  onOpenAccount: () => void;
  onAnalyze: () => void;
  onContentChange: (value: string) => void;
  onActivateSuggestion: (index: number) => void;
  remoteUpdateNotice: string | null;
  onAcceptRemoteUpdate: () => void;
};

export function WorkspaceEditorPanel({
  activeChapter,
  title,
  summary,
  content,
  status,
  statusLabel,
  statusTone,
  StatusIcon,
  count,
  todayCount,
  analysisNotice,
  suggestions,
  activeSuggestionIndex,
  accountLabel,
  accountSubtitle,
  styleSettings,
  onTitleChange,
  onOpenSummaryModal,
  onDeleteChapter,
  onPreview,
  onOpenShare,
  onOpenEditorSettings,
  onOpenAccount,
  onAnalyze,
  onContentChange,
  onActivateSuggestion,
  remoteUpdateNotice,
  onAcceptRemoteUpdate,
}: WorkspaceEditorPanelProps) {
  const readingMinutes = count > 0 ? Math.max(1, Math.ceil(count / 500)) : 0;

  return (
    <main data-testid="workspace-editor-panel" className="relative z-0 flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
      <div className="z-10 flex h-14 shrink-0 items-center justify-between border-b border-border bg-white px-6">
        <div className="flex items-center gap-4">
          <button
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={onOpenShare}
            aria-label="分享与预览"
            title="分享与预览"
          >
            <Eye size={16} />
          </button>
          <button
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
            onClick={onDeleteChapter}
            aria-label="删除当前章节"
          >
            <Trash2 size={16} />
          </button>
          <button
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={onOpenEditorSettings}
            aria-label="编辑器设置"
          >
            <Settings size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="hidden items-center gap-2 rounded-full border border-neutral-200 bg-[#f7f3ea] px-3 py-1.5 text-left shadow-sm transition-all hover:-translate-y-px hover:border-neutral-950 sm:flex"
            onClick={onOpenAccount}
            aria-label="账户中心"
          >
            <UserCircle size={17} className="text-neutral-950" />
            <span className="max-w-28 truncate text-xs font-bold text-neutral-950">{accountLabel}</span>
            <span className="max-w-20 truncate rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-neutral-500">{accountSubtitle}</span>
          </button>
          <button
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
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
              <input
                aria-label="章节标题"
                type="text"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                className="mb-6 border-none bg-transparent text-3xl font-bold text-foreground outline-none placeholder:text-muted-foreground"
                placeholder="无标题章节"
              />

              <div className="group relative mb-10">
                <div className="absolute -left-4 bottom-3 top-3 w-1 rounded-full bg-gray-200 transition-colors group-hover:bg-gray-300" />
                <div className="relative min-h-[60px] rounded-xl border border-transparent bg-muted p-4 text-sm text-muted-foreground transition-all group-hover:border-border">
                  <div className="whitespace-pre-wrap pr-10 leading-relaxed line-clamp-3 break-words">
                    {summary || <span className="text-gray-400">尚未填写章节提要，点击右侧编辑...</span>}
                  </div>
                  <button
                    onClick={onOpenSummaryModal}
                    className="absolute right-3 top-3 rounded-lg border border-gray-200 bg-white p-1.5 text-gray-400 opacity-0 shadow-sm transition-all duration-200 hover:bg-gray-100 hover:text-gray-900 group-hover:opacity-100"
                    title="编辑章节提要"
                    aria-label="编辑章节提要"
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
              </div>

              {analysisNotice ? (
                <div className="mb-5 rounded-lg border border-border bg-muted px-4 py-3 text-sm leading-6 text-foreground">
                  <span className="flex items-center font-medium">
                    <AlertCircle size={15} className="mr-1.5" />
                    {analysisNotice}
                  </span>
                </div>
              ) : null}

              {remoteUpdateNotice ? (
                <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                  <AlertCircle size={15} className="shrink-0" />
                  <span className="flex-1">{remoteUpdateNotice}</span>
                  <button
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700"
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
                disabled={status === "loading"}
                onChange={onContentChange}
                onActivateSuggestion={onActivateSuggestion}
                styleSettings={styleSettings}
              />
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-sm text-gray-400">暂无章节</div>
          )}
        </div>
      </div>

      <div className="flex h-10 shrink-0 items-center justify-between border-t border-border bg-white px-6 text-[12px] font-medium text-muted-foreground">
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
