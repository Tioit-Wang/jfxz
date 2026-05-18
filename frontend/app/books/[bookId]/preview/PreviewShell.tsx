"use client";

import { ArrowLeft, BookOpen, Monitor, Smartphone, Type } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiClient } from "@/api";
import type { Chapter } from "@/domain";
import { userLoginPath } from "@/auth";
import { cn } from "@/lib/utils";
import { ChapterListView } from "./ChapterListView";

const FONT_PRESETS = [
  { label: "小", value: 14 },
  { label: "中", value: 18 },
  { label: "大", value: 22 },
  { label: "超大", value: 26 },
] as const;

const FONT_MIN = 12;
const FONT_MAX = 28;

export default function PreviewShell({ bookId }: { bookId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialChapterId = searchParams.get("chapterId");

  const [mode, setMode] = useState<"pc" | "mobile">("pc");
  const [fontSize, setFontSize] = useState(() => mode === "mobile" ? 14 : 18);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workTitle, setWorkTitle] = useState("");

  const loadingRef = useRef(false);

  const client = useMemo(
    () =>
      new ApiClient(undefined, undefined, {
        onUnauthorized: () => router.replace(userLoginPath(`/books/${bookId}/preview`)),
      }),
    [router, bookId]
  );

  // Initial load: fetch work info and first/target chapter
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const bootstrap = await client.getWorkspaceBootstrap(bookId, 1, 1);
        if (cancelled) return;
        setWorkTitle(bootstrap.work.title);
        // Load 1 chapter — if initialChapterId is set, load that chapter; otherwise first chapter
        const result = await client.previewChapters(bookId, initialChapterId ?? undefined, 1);
        if (cancelled) return;
        if (result.chapters.length > 0) {
          setChapter(result.chapters[0]);
        }
        setTotal(result.total);
        setLoading(false);
        setError(null);
      } catch (err: unknown) {
        if (cancelled) return;
        if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 401) return;
        setError("加载预览数据失败，请检查网络后重试");
        setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [bookId, initialChapterId, client]);

  // Global copy prevention
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener("copy", prevent);
    document.addEventListener("cut", prevent);
    document.addEventListener("contextmenu", prevent);
    return () => {
      document.removeEventListener("copy", prevent);
      document.removeEventListener("cut", prevent);
      document.removeEventListener("contextmenu", prevent);
    };
  }, []);

  const goPrev = useCallback(async () => {
    if (navigating || loadingRef.current || !chapter) return;
    setNavigating(true);
    loadingRef.current = true;
    try {
      const result = await client.previewChapters(bookId, chapter.id, 1, "before");
      if (result.chapters.length > 0) {
        setChapter(result.chapters[0]);
        setTotal(result.total);
      }
    } catch {
      setError("加载失败，请重试");
    } finally {
      setNavigating(false);
      loadingRef.current = false;
    }
  }, [client, bookId, chapter, navigating]);

  const goNext = useCallback(async () => {
    if (navigating || loadingRef.current || !chapter) return;
    setNavigating(true);
    loadingRef.current = true;
    try {
      const result = await client.previewChapters(bookId, chapter.id, 1, "after");
      if (result.chapters.length > 0) {
        setChapter(result.chapters[0]);
        setTotal(result.total);
      }
    } catch {
      setError("加载失败，请重试");
    } finally {
      setNavigating(false);
      loadingRef.current = false;
    }
  }, [client, bookId, chapter, navigating]);

  const currentOrder = chapter?.order ?? 0;
  const hasPrev = currentOrder > 1;
  const hasNext = currentOrder < total;

  function handleModeChange(newMode: "pc" | "mobile") {
    setMode(newMode);
    setFontSize((prev) => {
      if (newMode === "mobile" && prev > 22) return 14;
      if (newMode === "pc" && prev < 14) return 18;
      return prev;
    });
  }

  const isMobile = mode === "mobile";

  return (
    <div className="flex h-screen select-none flex-col bg-[#f5f1eb] font-sans text-neutral-900">
      {/* Toolbar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 bg-white/90 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            href={`/books/${bookId}`}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            title="返回编辑"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">返回</span>
          </Link>
          <span className="hidden truncate text-sm font-medium text-neutral-400 sm:inline">|</span>
          {workTitle ? <span className="truncate text-sm text-neutral-500">{workTitle}</span> : null}
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
            <p className="mb-3 text-neutral-500">{error}</p>
            <button
              className="rounded-full bg-neutral-800 px-5 py-2 text-sm text-white transition-colors hover:bg-neutral-700"
              onClick={async () => {
                setError(null);
                setLoading(true);
                try {
                  const bootstrap = await client.getWorkspaceBootstrap(bookId, 1, 1);
                  setWorkTitle(bootstrap.work.title);
                  const result = await client.previewChapters(bookId, initialChapterId ?? undefined, 1);
                  if (result.chapters.length > 0) setChapter(result.chapters[0]);
                  setTotal(result.total);
                  setLoading(false);
                } catch {
                  setError("加载预览数据失败，请检查网络后重试");
                  setLoading(false);
                }
              }}
            >
              重试
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
            <p className="text-sm text-neutral-400">加载预览...</p>
          </div>
        </div>
      ) : !chapter ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <BookOpen size={48} className="mx-auto mb-4 text-neutral-300" />
            <p className="text-neutral-500">暂无章节内容</p>
            <p className="mt-1 text-xs text-neutral-400">请先在编辑器中创建章节</p>
          </div>
        </div>
      ) : (
        <div className={cn("flex-1 overflow-y-auto", isMobile && "flex items-start justify-center py-8")}>
          <div className={cn(isMobile ? "relative" : "mx-auto max-w-[800px] px-6 py-8")}>
            {/* iPhone 15 Pro frame — mobile mode */}
            {isMobile && (
              <div className="relative mx-auto overflow-hidden rounded-[44px] border-[6px] border-neutral-800 bg-white shadow-2xl" style={{ width: 393, minHeight: 852 }}>
                <div className="absolute left-1/2 top-1.5 z-20 h-[26px] w-[100px] -translate-x-1/2 rounded-full bg-neutral-800" />
                <div className="h-full overflow-y-auto px-5 pb-10 pt-12" style={{ maxHeight: 852 }}>
                  <ChapterListView
                    chapter={chapter}
                    fontSize={fontSize}
                    currentOrder={currentOrder}
                    total={total}
                    hasPrev={hasPrev}
                    hasNext={hasNext}
                    onPrev={goPrev}
                    onNext={goNext}
                    loadingPrev={navigating}
                    loadingNext={navigating}
                  />
                </div>
              </div>
            )}

            {/* PC mode */}
            {!isMobile && (
              <ChapterListView
                chapter={chapter}
                fontSize={fontSize}
                currentOrder={currentOrder}
                total={total}
                hasPrev={hasPrev}
                hasNext={hasNext}
                onPrev={goPrev}
                onNext={goNext}
                loadingPrev={navigating}
                loadingNext={navigating}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
