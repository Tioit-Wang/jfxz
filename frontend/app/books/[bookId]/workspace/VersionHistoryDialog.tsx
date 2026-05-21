"use client";

import { useEffect, useState } from "react";

import { Pencil, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

import type { ChapterVersion } from "@/domain";
import type { ApiClient } from "@/api";

export type VersionHistoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workId: string;
  chapterId: string | undefined;
  client: ApiClient;
  onRestored?: () => void;
};

export default function VersionHistoryDialog({
  open,
  onOpenChange,
  workId,
  chapterId,
  client,
  onRestored,
}: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<ChapterVersion[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<ChapterVersion | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [restoring, setRestoring] = useState(false);

  function loadVersions(cursor?: number) {
    if (!chapterId) return;
    setLoadingList(true);
    client
      .listChapterVersions(workId, chapterId, { limit: 20, cursor })
      .then((res) => {
        setVersions((prev) => (cursor ? [...prev, ...res.items] : res.items));
        setTotal(res.total);
        setHasMore(res.hasMore);
        if (!cursor && res.items.length > 0 && !selectedId) {
          setSelectedId(res.items[0].id);
        }
      })
      .catch(() => toast.error("加载版本列表失败"))
      .finally(() => setLoadingList(false));
  }

  useEffect(() => {
    if (open && chapterId) {
      setVersions([]);
      setSelectedId(null);
      setSelectedVersion(null);
      loadVersions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chapterId]);

  useEffect(() => {
    if (!selectedId || !chapterId) return;
    setLoadingContent(true);
    client
      .getChapterVersion(workId, chapterId, selectedId)
      .then(setSelectedVersion)
      .catch(() => toast.error("加载版本内容失败"))
      .finally(() => setLoadingContent(false));
  }, [selectedId, workId, chapterId, client]);

  async function handleRestore() {
    if (!selectedId || !chapterId) return;
    setRestoring(true);
    try {
      await client.restoreChapterVersion(workId, chapterId, selectedId);
      toast.success("已恢复到选中版本");
      onRestored?.();
      onOpenChange(false);
    } catch {
      toast.error("恢复版本失败");
    } finally {
      setRestoring(false);
    }
  }

  function formatTime(iso: string) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl w-[90vw] max-w-6xl h-[82vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl bg-white shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#00000014] [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:text-[#888888] [&_[data-slot=dialog-close]]:hover:bg-[#f5f5f5] [&_[data-slot=dialog-close]]:hover:text-[#171717]">
        <DialogHeader className="shrink-0 border-b border-[#ebebeb] px-6 py-5">
          <DialogTitle className="text-xl font-semibold tracking-[-0.6px] text-[#171717]">历史版本</DialogTitle>
          <DialogDescription className="mt-1 text-sm leading-5 text-[#888888]">
            共 {total} 个版本。点击查看内容，可恢复到任意历史版本。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: version list */}
          <div className="w-[25%] shrink-0 border-r border-[#ebebeb] flex flex-col overflow-hidden">
            <ScrollArea className="flex-1">
              {loadingList && versions.length === 0 ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-md" />
                  ))}
                </div>
              ) : versions.length === 0 ? (
                <div className="p-4 text-sm leading-5 text-[#888888] text-center">暂无版本记录</div>
              ) : (
                <div className="p-2 space-y-1">
                  {versions.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedId(v.id)}
                      className={`w-full text-left rounded-md px-3 py-2.5 transition-colors ${
                        selectedId === v.id
                          ? "bg-[#f5f5f5] ring-1 ring-inset ring-[#00000014]"
                          : "hover:bg-[#fafafa] border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={v.source === "ai" ? "default" : "secondary"}
                          className={`text-[10px] px-1.5 py-0 ${
                            v.source === "ai" ? "bg-[#d8ccf1] text-[#4c2889]" : ""
                          }`}
                        >
                          {v.source === "ai" ? (
                            <Wand2 className="size-3 mr-0.5" />
                          ) : (
                            <Pencil className="size-3 mr-0.5" />
                          )}
                          {v.source === "ai" ? "AI" : "人工"}
                        </Badge>
                        <span className="text-xs leading-4 text-[#888888]">
                          {formatTime(v.createdAt || v.updatedAt)}
                        </span>
                        {v.isCurrent && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-[#0070f3] border-[#0070f3]/30">
                            当前
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs leading-4 text-[#888888] truncate">
                        v{v.versionNumber} · {v.wordCount} 字 · {v.title}
                      </div>
                    </button>
                  ))}
                  {hasMore && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs leading-4 text-[#888888]"
                      onClick={() => {
                        const last = versions[versions.length - 1];
                        if (last) loadVersions(last.versionNumber);
                      }}
                      disabled={loadingList}
                    >
                      {loadingList ? "加载中..." : "加载更多"}
                    </Button>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right: content preview */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
            {loadingContent ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-6 w-48 rounded-md" />
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-3/4 rounded-md" />
              </div>
            ) : selectedVersion ? (
              <>
                <div className="px-6 pt-4 pb-2 border-b border-[#ebebeb]">
                  <h3 className="font-medium text-sm leading-5 text-[#171717] truncate">{selectedVersion.title}</h3>
                  <p className="text-xs leading-4 text-[#888888] mt-0.5">
                    版本 v{selectedVersion.versionNumber} · {selectedVersion.wordCount} 字
                    {selectedVersion.sourceDetail && ` · ${selectedVersion.sourceDetail}`}
                  </p>
                </div>
                <ScrollArea className="flex-1 min-h-0">
                  <div className="px-6 py-4 whitespace-pre-wrap text-sm leading-relaxed font-[family-name:var(--font-serif,serif)] text-[#171717]">
                    {selectedVersion.content || "(空)"}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm leading-5 text-[#888888]">
                选择左侧版本查看内容
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 mx-0 mb-0 flex-row rounded-none bg-white items-center justify-end gap-4 border-t border-[#ebebeb] px-6 py-5">
          <Button variant="outline" className="rounded-full border-[#ebebeb] bg-white text-[#171717] hover:bg-[#fafafa]" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          <Button
            className="rounded-full bg-[#171717] text-white hover:bg-[#171717]/90"
            onClick={handleRestore}
            disabled={!selectedVersion || selectedVersion.isCurrent || restoring}
          >
            {restoring ? "恢复中..." : "恢复此版本"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
