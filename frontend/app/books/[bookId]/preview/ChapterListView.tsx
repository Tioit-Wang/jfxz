"use client";

import type { Chapter } from "@/domain";

export type LoadDirection = "up" | "down";

export function ChapterListView({
  chapters,
  fontSize,
  loadingMore,
  total,
  loadedCount,
  topSentinelRef,
  bottomSentinelRef,
}: {
  chapters: Chapter[];
  fontSize: number;
  loadingMore: LoadDirection | null;
  total: number;
  loadedCount: number;
  topSentinelRef: React.RefObject<HTMLDivElement | null>;
  bottomSentinelRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (chapters.length === 0) return null;

  return (
    <>
      {/* Top sentinel */}
      <div ref={topSentinelRef} className="h-1" />

      {loadingMore === "up" && (
        <div className="flex justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
        </div>
      )}

      {chapters.map((chapter) => (
        <article
          key={chapter.id}
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
      ))}

      {loadingMore === "down" && (
        <div className="flex justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
        </div>
      )}

      {/* Loaded count indicator */}
      <div className="py-6 text-center text-xs text-neutral-400">
        已加载 {loadedCount} / {total} 章
        {loadedCount < total && <span className="ml-1">· 继续滚动加载更多</span>}
      </div>

      {/* Bottom sentinel */}
      <div ref={bottomSentinelRef} className="h-1" />
    </>
  );
}
