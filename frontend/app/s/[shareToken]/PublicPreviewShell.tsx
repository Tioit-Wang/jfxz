"use client";

import { BookOpen, Monitor, Smartphone, Type } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiClient } from "@/api";
import type { Chapter } from "@/domain";
import { cn } from "@/lib/utils";
import { ChapterListView, type LoadDirection } from "../../books/[bookId]/preview/ChapterListView";

const FONT_PRESETS = [
  { label: "小", value: 14 },
  { label: "中", value: 18 },
  { label: "大", value: 22 },
  { label: "超大", value: 26 },
] as const;

const FONT_MIN = 12;
const FONT_MAX = 28;
const CHAPTER_BATCH = 5;

export default function PublicPreviewShell({ shareToken }: { shareToken: string }) {
  const [mode, setMode] = useState<"pc" | "mobile">("pc");
  const [fontSize, setFontSize] = useState(() => mode === "mobile" ? 14 : 18);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState<LoadDirection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workTitle, setWorkTitle] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const loadedIdsRef = useRef<Set<string>>(new Set());
  const loadingRef = useRef(false);

  const client = useMemo(() => new ApiClient(), []);

  const loadChapters = useCallback(
    async (around: string | undefined, direction: LoadDirection | "jump") => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      if (direction !== "jump") setLoadingMore(direction);

      try {
        const result = await client.publicPreviewChapters(shareToken, around, CHAPTER_BATCH);

        setWorkTitle(result.work.title);

        setChapters((prev) => {
          const existing = new Map(prev.map((c) => [c.id, c]));
          const incoming = result.chapters.filter((c) => !existing.has(c.id));

          if (direction === "down") return [...prev, ...incoming];
          if (direction === "up") return [...incoming, ...prev];
          return result.chapters;
        });

        setTotal(result.total);
        for (const ch of result.chapters) loadedIdsRef.current.add(ch.id);
        setError(null);
      } catch {
        setError("内容不可用或分享已关闭");
      } finally {
        loadingRef.current = false;
        setLoadingMore(null);
        if (direction === "jump") setLoading(false);
      }
    },
    [client, shareToken]
  );

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (cancelled) return;
      await loadChapters(undefined, "jump");
    }
    init();
    return () => { cancelled = true; };
  }, [shareToken, loadChapters]);

  // IntersectionObserver for scroll preloading
  useEffect(() => {
    if (loading || chapters.length === 0) return;
    const container = scrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.target === topSentinelRef.current) {
            const firstId = chapters[0]?.id;
            if (firstId && !loadingRef.current) {
              loadChapters(firstId, "up");
            }
          } else if (entry.target === bottomSentinelRef.current) {
            const lastId = chapters[chapters.length - 1]?.id;
            if (lastId && !loadingRef.current) {
              loadChapters(lastId, "down");
            }
          }
        }
      },
      { root: container, rootMargin: "200px", threshold: 0 }
    );

    if (topSentinelRef.current) observer.observe(topSentinelRef.current);
    if (bottomSentinelRef.current) observer.observe(bottomSentinelRef.current);

    return () => observer.disconnect();
  }, [loading, chapters, loadChapters]);

  function handleModeChange(newMode: "pc" | "mobile") {
    setMode(newMode);
    setFontSize((prev) => {
      if (newMode === "mobile" && prev > 22) return 14;
      if (newMode === "pc" && prev < 14) return 18;
      return prev;
    });
  }

  const isMobile = mode === "mobile";
  const loadedCount = chapters.length;

  return (
    <div className="flex h-screen flex-col bg-[#f5f1eb] font-sans text-neutral-900">
      {/* Toolbar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 bg-white/90 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-tight text-neutral-700">妙蛙写作</span>
          {workTitle ? (
            <>
              <span className="text-sm text-neutral-400">|</span>
              <span className="truncate text-sm text-neutral-500">{workTitle}</span>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {/* Font size controls */}
          <div className="flex items-center gap-1">
            <Type size={14} className="text-neutral-400" />
            <button
              className="flex h-6 w-6 items-center justify-center rounded text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30"
              disabled={fontSize <= FONT_MIN}
              onClick={() => setFontSize((v) => Math.max(FONT_MIN, v - 1))}
              aria-label="缩小字号"
            >
              A-
            </button>
            <input
              type="range"
              min={FONT_MIN}
              max={FONT_MAX}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="h-1 w-16 cursor-pointer accent-neutral-700"
              aria-label="字号"
            />
            <button
              className="flex h-6 w-6 items-center justify-center rounded text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30"
              disabled={fontSize >= FONT_MAX}
              onClick={() => setFontSize((v) => Math.min(FONT_MAX, v + 1))}
              aria-label="放大字号"
            >
              A+
            </button>
          </div>

          {/* Preset buttons */}
          <div className="hidden gap-0.5 sm:flex">
            {FONT_PRESETS.map((preset) => (
              <button
                key={preset.label}
                className={cn(
                  "rounded px-1.5 py-0.5 text-xs transition-colors",
                  fontSize === preset.value
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                )}
                onClick={() => setFontSize(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Mode switch */}
          <div className="flex rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
            <button
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
                mode === "pc" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-400 hover:text-neutral-700"
              )}
              onClick={() => handleModeChange("pc")}
            >
              <Monitor size={13} />
              <span className="hidden sm:inline">PC</span>
            </button>
            <button
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
                mode === "mobile" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-400 hover:text-neutral-700"
              )}
              onClick={() => handleModeChange("mobile")}
            >
              <Smartphone size={13} />
              <span className="hidden sm:inline">手机</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content area */}
      {error ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <BookOpen size={48} className="mx-auto mb-4 text-neutral-300" />
            <p className="mb-2 text-neutral-500">{error}</p>
            <p className="text-xs text-neutral-400">请确认链接是否正确，或联系作者确认分享状态</p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
            <p className="text-sm text-neutral-400">加载中...</p>
          </div>
        </div>
      ) : chapters.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <BookOpen size={48} className="mx-auto mb-4 text-neutral-300" />
            <p className="text-neutral-500">暂无章节内容</p>
          </div>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className={cn("flex-1 overflow-y-auto", isMobile && "flex items-start justify-center py-8")}
        >
          <div className={cn(isMobile ? "relative" : "mx-auto max-w-[800px] px-6 py-8")}>
            {isMobile && (
              <div className="relative mx-auto overflow-hidden rounded-[44px] border-[6px] border-neutral-800 bg-white shadow-2xl" style={{ width: 393, minHeight: 852 }}>
                <div className="absolute left-1/2 top-1.5 z-20 h-[26px] w-[100px] -translate-x-1/2 rounded-full bg-neutral-800" />
                <div className="h-full overflow-y-auto px-5 pb-10 pt-12" style={{ maxHeight: 852 }}>
                  <ChapterListView
                    chapters={chapters}
                    fontSize={fontSize}
                    loadingMore={loadingMore}
                    total={total}
                    loadedCount={loadedCount}
                    topSentinelRef={topSentinelRef}
                    bottomSentinelRef={bottomSentinelRef}
                  />
                </div>
              </div>
            )}

            {!isMobile && (
              <ChapterListView
                chapters={chapters}
                fontSize={fontSize}
                loadingMore={loadingMore}
                total={total}
                loadedCount={loadedCount}
                topSentinelRef={topSentinelRef}
                bottomSentinelRef={bottomSentinelRef}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
