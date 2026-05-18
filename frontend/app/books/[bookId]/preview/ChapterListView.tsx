"use client";

import type { Chapter } from "@/domain";

export function ChapterListView({
  chapter,
  fontSize,
  currentOrder,
  total,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  loadingPrev,
  loadingNext,
}: {
  chapter: Chapter;
  fontSize: number;
  currentOrder: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  loadingPrev: boolean;
  loadingNext: boolean;
}) {
  return (
    <div
      className="select-none"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <article
        id={`ch-${chapter.id}`}
        className="mb-10"
        style={{ fontSize: `${fontSize}px`, lineHeight: 1.9 }}
      >
        <h2 className="mb-6 text-center text-2xl font-bold tracking-wide" style={{ fontSize: `${fontSize + 4}px` }}>
          {chapter.title}
        </h2>
        {chapter.content ? (
          <div className="space-y-4 leading-relaxed text-neutral-800">
            {chapter.content.split("\n").map((paragraph, idx) => {
              const trimmed = paragraph.trimEnd();
              if (!trimmed) return <div key={idx} className="h-3" />;
              return (
                <p key={idx} className="indent-8">
                  {trimmed}
                </p>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-neutral-400 italic">本章暂无正文</p>
        )}
      </article>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-neutral-200 pt-6 mt-10">
        <button
          onClick={onPrev}
          disabled={!hasPrev || loadingPrev}
          className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loadingPrev ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          ) : null}
          上一章
        </button>
        <span className="text-xs text-neutral-400">
          第 {currentOrder} / {total} 章
        </span>
        <button
          onClick={onNext}
          disabled={!hasNext || loadingNext}
          className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          下一章
          {loadingNext ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          ) : null}
        </button>
      </div>
    </div>
  );
}
