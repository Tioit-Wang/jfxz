"use client";

import { AlertCircle, Check, Loader2, X } from "lucide-react";
import { type CheckInfo } from "@/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CheckStatus = "loading" | "done" | "error";

interface AnalyzeProgressModalProps {
  open: boolean;
  checks: CheckInfo[];
  progress: Record<string, CheckStatus>;
  errors: Record<string, string>;
  hasResults: boolean;
  onCancel: () => void;
  onViewResults: () => void;
}

const CHECK_LABELS: Record<string, string> = {
  character: "角色检查",
  logic: "逻辑检查",
  style: "风格检查",
};

export function AnalyzeProgressModal({
  open,
  checks,
  progress,
  errors,
  hasResults,
  onCancel,
  onViewResults,
}: AnalyzeProgressModalProps) {
  if (!open) return null;

  const total = checks.length;
  const done = checks.filter((c) => progress[c.id] === "done").length;
  const hasActive = checks.some((c) => progress[c.id] === "loading");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#ebebeb] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-[#171717]">AI 分析中</h2>
            <p className="mt-0.5 text-xs text-[#888888]">
              {hasActive ? `${done}/${total} 完成` : "全部完成"}
            </p>
          </div>
          {!hasActive && hasResults && (
            <button
              className="flex size-7 items-center justify-center rounded-full text-[#888888] hover:bg-[#f5f5f5] hover:text-[#171717] transition-colors"
              onClick={onViewResults}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="space-y-3">
          {checks.map((check) => {
            const status = progress[check.id] || "loading";
            const error = errors[check.id];
            return (
              <div
                key={check.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3",
                  status === "done" ? "border-emerald-100 bg-emerald-50/50" :
                  status === "error" ? "border-amber-100 bg-amber-50/50" :
                  "border-[#ebebeb] bg-[#fafafa]"
                )}
              >
                {status === "loading" && <Loader2 size={18} className="animate-spin shrink-0 text-[#888888]" />}
                {status === "done" && <Check size={18} className="shrink-0 text-emerald-600" />}
                {status === "error" && <AlertCircle size={18} className="shrink-0 text-amber-600" />}
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-[#171717]">{CHECK_LABELS[check.id] || check.title}</span>
                  {error && <p className="mt-0.5 truncate text-xs text-amber-700">{error}</p>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex gap-3">
          {hasActive ? (
            <Button
              variant="outline"
              className="flex-1 rounded-full"
              onClick={onCancel}
            >
              取消分析
            </Button>
          ) : (
            <Button
              className="flex-1 rounded-full"
              onClick={onViewResults}
            >
              查看结果
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
