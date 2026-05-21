"use client";

import { BookOpen, ChevronDown } from "lucide-react";
import type { Chapter } from "@/domain";

interface OverviewViewProps {
  workTitle: string;
  shortIntro: string;
  chapters: Chapter[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  onSelectChapter: (chapterId: string) => void;
}

export function OverviewView({
  workTitle,
  shortIntro,
  chapters,
  total,
  hasMore,
  loading,
  onLoadMore,
  onSelectChapter,
}: OverviewViewProps) {
  return (
    <div className="mx-auto flex max-w-[600px] flex-1 flex-col px-6 py-12">
      <div className="mb-10 text-center">
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-neutral-900">
          {workTitle}
        </h1>
        {shortIntro && (
          <p className="text-sm leading-relaxed text-neutral-500">
            {shortIntro}
          </p>
        )}
      </div>

      <div>
        <div className="mb-4 flex items-baseline justify-between border-b border-neutral-200 pb-3">
          <h2 className="text-sm font-semibold text-neutral-900">目录</h2>
          <span className="text-xs text-neutral-400">共 {total} 章</span>
        </div>

        {chapters.length === 0 && !loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-neutral-400">
            <BookOpen size={40} className="text-neutral-300" />
            <p className="text-sm">暂无章节</p>
          </div>
        )}

        <div className="space-y-0.5">
          {chapters.map((ch) => (
            <button
              key={ch.id}
              onClick={() => onSelectChapter(ch.id)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-neutral-100"
            >
              <span className="min-w-[4ch] text-xs font-medium text-neutral-400">
                第{ch.order}章
              </span>
              <span className="truncate text-neutral-800">{ch.title}</span>
            </button>
          ))}
        </div>

        {hasMore && (
          <div className="mt-6 text-center">
            <button
              onClick={onLoadMore}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-5 py-2 text-xs text-neutral-500 transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              {loading ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
              ) : (
                <ChevronDown size={14} />
              )}
              加载更多
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
