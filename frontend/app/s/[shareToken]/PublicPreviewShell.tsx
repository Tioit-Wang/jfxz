"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiClient } from "@/api";
import type { Chapter } from "@/domain";
import { OverviewView } from "./OverviewView";
import ReadingView from "./ReadingView";

export default function PublicPreviewShell({
  shareToken,
  chapterId: urlChapterId,
}: {
  shareToken: string;
  chapterId?: string;
}) {
  const [targetChapterId, setTargetChapterId] = useState<string | undefined>(urlChapterId);
  const [view, setView] = useState<"overview" | "reading">(
    urlChapterId ? "reading" : "overview"
  );
  const [workTitle, setWorkTitle] = useState("");
  const [shortIntro, setShortIntro] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const client = useMemo(() => new ApiClient(), []);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const result = await client.publicPreviewChapters(shareToken, undefined, 20);
      setWorkTitle(result.work.title);
      setShortIntro(result.work.shortIntro);
      setChapters(result.chapters);
      setTotal(result.total);
    } catch {
      // handled by error state in individual views
    } finally {
      setLoadingOverview(false);
    }
  }, [client, shareToken]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const loadMoreChapters = useCallback(async () => {
    if (loadingMore || chapters.length === 0) return;
    setLoadingMore(true);
    try {
      const lastChapter = chapters[chapters.length - 1];
      const result = await client.publicPreviewChapters(shareToken, lastChapter.id, 20, "after");
      setChapters((prev) => [...prev, ...result.chapters]);
    } catch {
      // silently fail
    } finally {
      setLoadingMore(false);
    }
  }, [client, shareToken, chapters, loadingMore]);

  const hasMore = chapters.length < total;

  const handleSelectChapter = useCallback((chapterId: string) => {
    setTargetChapterId(chapterId);
    setView("reading");
  }, []);

  const handleBack = useCallback(() => {
    setView("overview");
  }, []);

  if (view === "reading") {
    return (
      <ReadingView
        key={targetChapterId ?? "default"}
        shareToken={shareToken}
        workTitle={workTitle}
        initialChapterId={targetChapterId}
        onBack={handleBack}
        chapters={chapters}
        hasMore={hasMore}
        onLoadMoreChapters={loadMoreChapters}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f1eb] font-sans text-neutral-900">
      <header className="flex h-12 shrink-0 items-center justify-center border-b border-neutral-200 bg-white/90 px-4 backdrop-blur">
        <span className="text-sm font-bold tracking-tight text-neutral-700">妙蛙写作</span>
        {workTitle ? (
          <>
            <span className="mx-2 text-sm text-neutral-400">|</span>
            <span className="truncate text-sm text-neutral-500">{workTitle}</span>
          </>
        ) : null}
      </header>
      {loadingOverview ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
            <p className="text-sm text-neutral-400">加载中...</p>
          </div>
        </div>
      ) : (
        <OverviewView
          workTitle={workTitle}
          shortIntro={shortIntro}
          chapters={chapters}
          total={total}
          hasMore={hasMore}
          loading={loadingMore}
          onLoadMore={loadMoreChapters}
          onSelectChapter={handleSelectChapter}
        />
      )}
    </div>
  );
}
