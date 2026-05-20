"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { Volume } from "@/api";
import type { Chapter } from "@/domain";
import { wordCount } from "@/domain";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  volumes: Volume[];
  chapters: Chapter[];
  workTitle: string;
}

export default function ExportDialog({
  open,
  onOpenChange,
  volumes,
  chapters,
  workTitle,
}: ExportDialogProps) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const displayVolumes = useMemo(
    () => (volumes.length > 0 ? volumes : []),
    [volumes]
  );

  const volumeChapterMap = useMemo(() => {
    const map = new Map<string, Chapter[]>();
    for (const volume of displayVolumes) {
      map.set(
        volume.id,
        chapters.filter((ch) => (ch.volumeId || "") === volume.id)
      );
    }
    return map;
  }, [displayVolumes, chapters]);

  const allChapterIds = useMemo(
    () => new Set(chapters.map((ch) => ch.id)),
    [chapters]
  );

  const checkedCount = checkedIds.size;
  const totalCount = chapters.length;
  const allChecked = checkedCount === totalCount && totalCount > 0;
  const someChecked = checkedCount > 0 && checkedCount < totalCount;

  function isVolumeFullyChecked(volumeId: string): boolean {
    const volChapters = volumeChapterMap.get(volumeId) ?? [];
    return volChapters.length > 0 && volChapters.every((ch) => checkedIds.has(ch.id));
  }

  function isVolumePartiallyChecked(volumeId: string): boolean {
    const volChapters = volumeChapterMap.get(volumeId) ?? [];
    if (volChapters.length === 0) return false;
    const checked = volChapters.filter((ch) => checkedIds.has(ch.id)).length;
    return checked > 0 && checked < volChapters.length;
  }

  function toggleChapter(chapterId: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  }

  function toggleVolume(volumeId: string) {
    const volChapters = volumeChapterMap.get(volumeId) ?? [];
    if (volChapters.length === 0) return;
    const allChecked = volChapters.every((ch) => checkedIds.has(ch.id));
    setCheckedIds((prev) => {
      const next = new Set(prev);
      for (const ch of volChapters) {
        if (allChecked) {
          next.delete(ch.id);
        } else {
          next.add(ch.id);
        }
      }
      return next;
    });
  }

  function toggleAll() {
    if (allChecked) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(allChapterIds));
    }
  }

  const handleExport = useCallback(() => {
    const checkedChapters = chapters.filter((ch) => checkedIds.has(ch.id));

    const volumeOrderMap = new Map<string, number>();
    displayVolumes.forEach((v) => volumeOrderMap.set(v.id, v.order));

    checkedChapters.sort((a, b) => {
      const aVolOrder = volumeOrderMap.get(a.volumeId ?? "") ?? 0;
      const bVolOrder = volumeOrderMap.get(b.volumeId ?? "") ?? 0;
      if (aVolOrder !== bVolOrder) return aVolOrder - bVolOrder;
      return a.order - b.order;
    });

    const textParts: string[] = [];
    for (let i = 0; i < checkedChapters.length; i++) {
      const chapter = checkedChapters[i];
      const globalIndex = i + 1;
      textParts.push(`第${globalIndex}章-${chapter.title}\n\n${chapter.content}`);
    }
    const text = textParts.join("\n\n---\n\n");

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workTitle || "作品"}-导出.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onOpenChange(false);
  }, [chapters, checkedIds, displayVolumes, workTitle, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden rounded-xl bg-white p-0 shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#00000014] sm:max-w-lg [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:text-[#888888] [&_[data-slot=dialog-close]]:hover:bg-[#f5f5f5] [&_[data-slot=dialog-close]]:hover:text-[#171717]">
        <DialogHeader className="shrink-0 border-b border-[#ebebeb] px-6 py-5">
          <DialogTitle className="text-xl font-semibold tracking-[-0.6px] text-[#171717]">
            导出章节
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          {/* Select all bar */}
          <div className="shrink-0 border-b border-[#ebebeb] px-6 py-3">
            <label className="flex cursor-pointer items-center gap-2.5">
              <Checkbox
                checked={allChecked}
                data-state={
                  allChecked ? "checked" : someChecked ? "indeterminate" : "unchecked"
                }
                onCheckedChange={toggleAll}
                className="size-4 rounded-[4px] border-[#d4d4d4] data-[state=checked]:bg-[#171717] data-[state=checked]:border-[#171717] data-[state=indeterminate]:bg-[#171717] data-[state=indeterminate]:border-[#171717]"
              />
              <span className="text-sm font-semibold text-[#171717]">
                全选
              </span>
              <span className="ml-auto text-xs text-[#888888]">
                已选 {checkedCount} / {totalCount} 章
              </span>
            </label>
          </div>

          {/* Chapter tree */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {displayVolumes.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#888888]">暂无章节</p>
            ) : (
              <div className="space-y-4">
                {displayVolumes.map((volume) => {
                  const volChapters = volumeChapterMap.get(volume.id) ?? [];
                  const volWords = volChapters.reduce(
                    (sum, ch) => sum + wordCount(ch.content),
                    0
                  );
                  const fullyChecked = isVolumeFullyChecked(volume.id);
                  const partiallyChecked = isVolumePartiallyChecked(volume.id);

                  return (
                    <div key={volume.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-neutral-50">
                        <Checkbox
                          checked={fullyChecked}
                          data-state={
                            fullyChecked
                              ? "checked"
                              : partiallyChecked
                                ? "indeterminate"
                                : "unchecked"
                          }
                          onCheckedChange={() => toggleVolume(volume.id)}
                          className="size-4 rounded-[4px] border-[#d4d4d4] data-[state=checked]:bg-[#171717] data-[state=checked]:border-[#171717] data-[state=indeterminate]:bg-[#171717] data-[state=indeterminate]:border-[#171717]"
                        />
                        <span className="text-sm font-bold text-[#171717]">
                          {volume.title}
                        </span>
                        <span className="ml-auto text-xs text-neutral-400">
                          {volWords}字 · {volChapters.length}章
                        </span>
                      </label>
                      <div className="ml-5 mt-1 space-y-0.5 border-l border-neutral-200 pl-3">
                        {volChapters.map((chapter) => (
                          <label
                            key={chapter.id}
                            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-neutral-50"
                          >
                            <Checkbox
                              checked={checkedIds.has(chapter.id)}
                              onCheckedChange={() => toggleChapter(chapter.id)}
                              className="size-4 rounded-[4px] border-[#d4d4d4] data-[state=checked]:bg-[#171717] data-[state=checked]:border-[#171717]"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">
                              {chapter.title}
                            </span>
                            <span className="shrink-0 text-xs text-neutral-400">
                              {wordCount(chapter.content)}字
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#ebebeb] px-6 py-4">
          <Button
            variant="outline"
            className="rounded-full border-[#ebebeb] bg-white text-[#171717] hover:bg-[#fafafa]"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            className="rounded-full bg-[#171717] text-white hover:bg-[#171717]/90"
            onClick={handleExport}
            disabled={checkedCount === 0}
          >
            <Download size={14} className="mr-1.5" />
            导出 {checkedCount > 0 ? `(${checkedCount}章)` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
