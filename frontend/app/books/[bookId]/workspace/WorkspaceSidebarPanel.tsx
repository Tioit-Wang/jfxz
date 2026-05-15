"use client";

import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Edit3,
  Lightbulb,
  MoreVertical,
  Plus,
  Search,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import type { DailyWordProgress, InspirationNote, NamedContent, Volume, WritingGoal } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Chapter, Work } from "@/domain";
import { wordCount } from "@/domain";
import { writeWorkspaceMentionDragData } from "./dnd";

type WorkspaceTab = "chapters" | "characters" | "settings";

type WorkspaceSidebarPanelProps = {
  work: Work | null;
  onOpenWorkEdit: () => void;
  activeTab: WorkspaceTab;
  onActiveTabChange: (tab: WorkspaceTab) => void;
  moduleMeta: { title: string; count: string };
  volumes: Volume[];
  chapters: Chapter[];
  activeChapterId: string;
  onSelectChapter: (chapterId: string) => void;
  onCreateChapter: (volumeId?: string) => void;
  onCreateVolume: () => void;
  isWorkspaceLoading: boolean;
  characterSearch: string;
  onCharacterSearchChange: (value: string) => void;
  copyNotice: string;
  characters: NamedContent[];
  filteredCharacters: NamedContent[];
  activeCharacter?: NamedContent;
  isCharacterDetail: boolean;
  onSelectCharacter: (item: NamedContent) => void;
  onStartCreateCharacter: () => void;
  onStartEditCharacter: (item: NamedContent) => void;
  onDeleteCharacter: (item: NamedContent) => void;
  settingSearch: string;
  onSettingSearchChange: (value: string) => void;
  settingType: string;
  onSettingTypeChange: (value: string) => void;
  settingTypes: Array<{ value: string; label: string }>;
  settings: NamedContent[];
  filteredSettings: NamedContent[];
  activeSetting?: NamedContent;
  isSettingDetail: boolean;
  onSelectSetting: (item: NamedContent) => void;
  onStartCreateSetting: () => void;
  onStartEditSetting: (item: NamedContent) => void;
  onDeleteSetting: (item: NamedContent) => void;
  inspirationNotes: InspirationNote[];
  writingGoal: WritingGoal;
  dailyWordProgress: DailyWordProgress;
  onStartCreateNote: () => void;
  onStartEditNote: (item: InspirationNote) => void;
  onDeleteNote: (item: InspirationNote) => void;
  onOpenGoalEdit: () => void;
  formatUpdatedAt: (value: string) => string;
  collapsedVolumes: Set<string>;
  onToggleCollapse: (volumeId: string) => void;
  onEditVolume: (volume: Volume) => void;
  onDeleteVolume: (volume: Volume) => void;
  onReorderChapter: (chapterId: string, targetVolumeId: string, targetOrder: number) => void;
};

const characterAccents = [
  "from-slate-800 to-slate-500",
  "from-stone-300 to-stone-100 text-stone-700",
  "from-zinc-800 to-neutral-500",
  "from-amber-200 to-orange-100 text-amber-900",
];

function chapterTitle(chapter: Chapter, allChapters: Chapter[]): string {
  const globalIndex = allChapters.indexOf(chapter) + 1;
  return `第${globalIndex}章 ${chapter.title}`;
}

function progressPercent(progress: DailyWordProgress, goal: WritingGoal): number {
  if (!goal.targetWords) return 0;
  return Math.min(100, Math.round((progress.wordsAdded / goal.targetWords) * 100));
}

export function WorkspaceSidebarPanel({
  work,
  onOpenWorkEdit,
  activeTab,
  onActiveTabChange,
  moduleMeta,
  volumes,
  chapters,
  activeChapterId,
  onSelectChapter,
  onCreateChapter,
  onCreateVolume,
  isWorkspaceLoading,
  characterSearch,
  onCharacterSearchChange,
  copyNotice,
  characters,
  filteredCharacters,
  activeCharacter,
  isCharacterDetail,
  onSelectCharacter,
  onStartCreateCharacter,
  onStartEditCharacter,
  onDeleteCharacter,
  settingSearch,
  onSettingSearchChange,
  settingType,
  onSettingTypeChange,
  settingTypes,
  settings,
  filteredSettings,
  activeSetting,
  isSettingDetail,
  onSelectSetting,
  onStartCreateSetting,
  onStartEditSetting,
  onDeleteSetting,
  inspirationNotes,
  writingGoal,
  dailyWordProgress,
  onStartCreateNote,
  onStartEditNote,
  onDeleteNote,
  onOpenGoalEdit,
  formatUpdatedAt,
  collapsedVolumes,
  onToggleCollapse,
  onEditVolume,
  onDeleteVolume,
  onReorderChapter,
}: WorkspaceSidebarPanelProps) {
  const [notesCollapsed, setNotesCollapsed] = useState(false);
  const [activeDropZone, setActiveDropZone] = useState<string | null>(null);
  const [autoExpandTimer, setAutoExpandTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const dropZoneDragRef = useRef<Map<string, number>>(new Map());
  const volumeDragRef = useRef<Map<string, number>>(new Map());
  const percent = progressPercent(dailyWordProgress, writingGoal);
  const firstVolumeId = volumes[0]?.id;

  const createLabel = activeTab === "chapters" ? "新建章节" : activeTab === "characters" ? "新建角色" : "新建设定";

  return (
    <aside
      data-testid="workspace-sidebar-panel"
      className="z-10 flex h-full min-h-0 min-w-0 flex-col border-r border-neutral-200 bg-white text-neutral-950"
    >
      <section className="shrink-0 border-b border-neutral-200 px-3 py-3">
        <div className="grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="size-8 rounded-full text-[#888888] hover:bg-[#f5f5f5] hover:text-[#171717]" aria-label="返回作品列表">
            <Link href="/books">
              <ChevronLeft size={18} />
            </Link>
          </Button>
          <div className="min-w-0 text-center">
            <p className="truncate text-base font-bold leading-6">{work?.title ?? "作品加载中"}</p>
          </div>
          <button
            className="grid size-8 place-items-center rounded-full text-[#888888] transition-colors hover:bg-[#f5f5f5] hover:text-[#171717]"
            onClick={onOpenWorkEdit}
            aria-label="编辑作品信息"
          >
            <MoreVertical size={16} />
          </button>
        </div>
      </section>

      <div className="flex min-h-0 flex-1 flex-col">
        <section className="flex min-h-0 flex-[2] flex-col border-b border-neutral-200">
          <div className="shrink-0 px-3 pt-3">
            <div className="grid grid-cols-3 border-b border-neutral-200">
              {[
                { key: "chapters" as const, label: "目录", icon: BookOpen },
                { key: "characters" as const, label: "角色", icon: Users },
                { key: "settings" as const, label: "设定", icon: Database },
              ].map((item) => {
                const Icon = item.icon;
                const selected = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => onActiveTabChange(item.key)}
                    className={cn(
                      "relative flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors",
                      selected ? "text-[#171717]" : "text-[#888888] hover:text-[#171717]"
                    )}
                  >
                    <Icon size={14} />
                    {item.label}
                    {selected ? <span className="absolute bottom-0 h-0.5 w-full rounded-full bg-[#171717]" /> : null}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <h2 className="text-sm font-bold">{moduleMeta.title}</h2>
                <p className="mt-0.5 text-[11px] text-neutral-500">{moduleMeta.count}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {activeTab === "chapters" ? (
                  <button
                    className="rounded-full border border-[#ebebeb] px-2.5 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#fafafa]"
                    onClick={onCreateVolume}
                  >
                    新卷
                  </button>
                ) : null}
                <button
                  className="inline-flex items-center gap-1 rounded-full bg-[#171717] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#171717]/90"
                  onClick={
                    activeTab === "chapters"
                      ? () => onCreateChapter(firstVolumeId)
                      : activeTab === "characters"
                        ? onStartCreateCharacter
                        : onStartCreateSetting
                  }
                  aria-label={createLabel}
                >
                  <Plus size={14} />
                  新建
                </button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {activeTab === "chapters" ? (
              <div className="space-y-3">
                {(volumes.length ? volumes : [{ id: "", title: "默认卷", order: 1, updatedAt: "" }]).map((volume) => {
                  const volumeChapters = chapters.filter((chapter) => (chapter.volumeId || "") === volume.id);
                  const volumeWords = volumeChapters.reduce((sum, chapter) => sum + wordCount(chapter.content), 0);
                  const isCollapsed = collapsedVolumes.has(volume.id);
                  const volumeKey = volume.id || "default";

                  function handleDragOverChapterZone(e: React.DragEvent) {
                    if (!e.dataTransfer.types.includes("application/x-goodgua-workspace-reorder")) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }

                  function handleDragEnterChapterZone(e: React.DragEvent, zoneId: string) {
                    if (!e.dataTransfer.types.includes("application/x-goodgua-workspace-reorder")) return;
                    const count = (dropZoneDragRef.current.get(zoneId) || 0) + 1;
                    dropZoneDragRef.current.set(zoneId, count);
                    setActiveDropZone(zoneId);
                  }

                  function handleDragLeaveChapterZone(_e: React.DragEvent, zoneId: string) {
                    const count = (dropZoneDragRef.current.get(zoneId) || 1) - 1;
                    dropZoneDragRef.current.set(zoneId, count);
                    if (count === 0) setActiveDropZone((prev) => (prev === zoneId ? null : prev));
                  }

                  function handleDropChapterZone(e: React.DragEvent, zoneId: string, targetIndex: number) {
                    e.preventDefault();
                    dropZoneDragRef.current.set(zoneId, 0);
                    setActiveDropZone(null);
                    const chapterId = e.dataTransfer.getData("application/x-goodgua-workspace-reorder");
                    if (!chapterId) return;
                    onReorderChapter(chapterId, volume.id, targetIndex);
                  }

                  function handleVolumeTitleDragOver(e: React.DragEvent) {
                    if (!e.dataTransfer.types.includes("application/x-goodgua-workspace-reorder")) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }

                  function handleVolumeTitleDragEnter(e: React.DragEvent) {
                    if (!e.dataTransfer.types.includes("application/x-goodgua-workspace-reorder")) return;
                    const key = volume.id || "default";
                    const count = (volumeDragRef.current.get(key) || 0) + 1;
                    volumeDragRef.current.set(key, count);
                    if (isCollapsed && !autoExpandTimer) {
                      const timer = setTimeout(() => onToggleCollapse(volume.id), 600);
                      setAutoExpandTimer(timer);
                    }
                  }

                  function handleVolumeTitleDragLeave(e: React.DragEvent) {
                    const key = volume.id || "default";
                    const count = (volumeDragRef.current.get(key) || 1) - 1;
                    volumeDragRef.current.set(key, count);
                    if (count === 0 && autoExpandTimer) {
                      clearTimeout(autoExpandTimer);
                      setAutoExpandTimer(null);
                    }
                  }

                  function handleVolumeTitleDrop(e: React.DragEvent) {
                    e.preventDefault();
                    volumeDragRef.current.set(volume.id || "default", 0);
                    if (autoExpandTimer) { clearTimeout(autoExpandTimer); setAutoExpandTimer(null); }
                    setActiveDropZone(null);
                    const chapterId = e.dataTransfer.getData("application/x-goodgua-workspace-reorder");
                    if (!chapterId) return;
                    onReorderChapter(chapterId, volume.id, volumeChapters.length);
                  }

                  return (
                    <div key={volumeKey} className="space-y-1.5">
                      <div
                        className="group flex items-center justify-between rounded-lg px-1 py-1 text-xs font-bold text-neutral-700"
                        onDragOver={handleVolumeTitleDragOver}
                        onDragEnter={handleVolumeTitleDragEnter}
                        onDragLeave={handleVolumeTitleDragLeave}
                        onDrop={handleVolumeTitleDrop}
                      >
                        <button
                          className="inline-flex min-w-0 cursor-pointer items-center gap-1.5"
                          onClick={() => onToggleCollapse(volume.id)}
                          aria-label={isCollapsed ? "展开卷" : "折叠卷"}
                        >
                          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          <span className="truncate">{volume.title}</span>
                        </button>
                        <span className="flex shrink-0 items-center gap-1">
                          <span className="text-neutral-400">{volumeWords}字</span>
                          <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              className="rounded-full p-1 text-[#888888] hover:bg-[#f5f5f5] hover:text-[#171717]"
                              onClick={() => onEditVolume(volume)}
                              aria-label="编辑卷"
                            >
                              <Edit3 size={12} />
                            </button>
                            {volumeChapters.length === 0 ? (
                              <button
                                className="rounded-full p-1 text-[#888888] hover:bg-[#f7d4d6] hover:text-[#ee0000]"
                                onClick={() => onDeleteVolume(volume)}
                                aria-label="删除卷"
                              >
                                <Trash2 size={12} />
                              </button>
                            ) : null}
                          </span>
                        </span>
                      </div>
                      {!isCollapsed ? (
                        <div className="space-y-1 border-l border-neutral-200 pl-3">
                          {volumeChapters.map((chapter, chIndex) => {
                            const dropZoneId = `${volumeKey}-${chIndex}`;
                            const isDropActive = activeDropZone === dropZoneId;
                            return (
                              <div key={chapter.id}>
                                {/* Drop zone before each chapter */}
                                <div
                                  className={cn(
                                    "transition-all",
                                    isDropActive ? "h-1.5 rounded-full bg-blue-500" : "h-0.5"
                                  )}
                                  onDragOver={(e) => handleDragOverChapterZone(e)}
                                  onDragEnter={(e) => handleDragEnterChapterZone(e, dropZoneId)}
                                  onDragLeave={(e) => handleDragLeaveChapterZone(e, dropZoneId)}
                                  onDrop={(e) => handleDropChapterZone(e, dropZoneId, chIndex)}
                                />
                                <button
                                  draggable
                                  className={cn(
                                    "group relative w-full cursor-grab rounded-xl px-3 py-2.5 text-left transition-colors active:cursor-grabbing",
                                    chapter.id === activeChapterId
                                      ? "bg-[#171717] text-white"
                                      : "text-neutral-600 hover:bg-neutral-100"
                                  )}
                                  onClick={() => onSelectChapter(chapter.id)}
                                  onDragStart={(event) => {
                                    writeWorkspaceMentionDragData(event.dataTransfer, {
                                      type: "chapter",
                                      id: chapter.id,
                                      name: chapter.title,
                                      summary: chapter.summary || `第 ${chapter.order} 章`,
                                    });
                                    event.dataTransfer.setData("application/x-goodgua-workspace-reorder", chapter.id);
                                    event.dataTransfer.effectAllowed = "move";
                                  }}
                                  onDragEnd={() => setActiveDropZone(null)}
                                >
                                  <span className="flex items-start justify-between gap-2">
                                    <span className="truncate text-sm font-semibold">{chapterTitle(chapter, chapters)}</span>
                                    <span className={cn("shrink-0 text-[11px]", chapter.id === activeChapterId ? "text-white/60" : "text-neutral-400")}>
                                      {wordCount(chapter.content)}字
                                    </span>
                                  </span>
                                  <span className={cn("mt-1 block truncate text-xs", chapter.id === activeChapterId ? "text-white/60" : "text-neutral-400")}>
                                    {chapter.summary || "暂无章节提要"}
                                  </span>
                                </button>
                              </div>
                            );
                          })}
                          {/* Drop zone at the end of the volume */}
                          <div
                            className={cn(
                              "transition-all",
                              activeDropZone === `${volumeKey}-end` ? "h-1.5 rounded-full bg-blue-500" : "h-0.5"
                            )}
                            onDragOver={(e) => handleDragOverChapterZone(e)}
                            onDragEnter={(e) => handleDragEnterChapterZone(e, `${volumeKey}-end`)}
                            onDragLeave={(e) => handleDragLeaveChapterZone(e, `${volumeKey}-end`)}
                            onDrop={(e) => handleDropChapterZone(e, `${volumeKey}-end`, volumeChapters.length)}
                          />
                          <button
                            className="w-full rounded-xl border border-dashed border-[#ebebeb] py-2 text-xs text-[#888888] hover:border-[#a1a1a1] hover:text-[#171717]"
                            onClick={() => onCreateChapter(volume.id || firstVolumeId)}
                          >
                            + 在本卷新建章节
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {activeTab === "characters" ? (
              <div className="space-y-3">
                <SearchInput value={characterSearch} onChange={onCharacterSearchChange} placeholder="搜索名称或简介" label="搜索角色" />
                {copyNotice ? <p className="rounded-xl border border-neutral-200 px-3 py-2 text-xs text-neutral-500">{copyNotice}</p> : null}
                {isWorkspaceLoading ? <p className="px-2 py-4 text-sm text-neutral-400">角色加载中...</p> : null}
                {!isWorkspaceLoading && !characters.length ? (
                  <p className="rounded-xl border border-dashed border-neutral-200 p-4 text-xs leading-5 text-neutral-500">还没有角色，点击右上角创建。</p>
                ) : null}
                {!isWorkspaceLoading && characters.length > 0 && !filteredCharacters.length ? (
                  <p className="rounded-xl border border-neutral-200 p-4 text-xs text-neutral-500">没有匹配的角色</p>
                ) : null}
                <div className="space-y-2">
                  {filteredCharacters.map((item, index) => {
                    const selected = item.id === activeCharacter?.id && isCharacterDetail;
                    return (
                      <div
                        key={item.id}
                        draggable
                        className={cn("group relative flex cursor-grab gap-3 rounded-2xl p-2.5 transition-colors active:cursor-grabbing", selected ? "bg-neutral-100" : "hover:bg-neutral-50")}
                        onClick={() => onSelectCharacter(item)}
                        onDragStart={(event) =>
                          writeWorkspaceMentionDragData(event.dataTransfer, {
                            type: "character",
                            id: item.id,
                            name: item.name,
                            summary: item.summary,
                          })
                        }
                      >
                        <div className={cn("grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br text-sm font-bold text-white", characterAccents[index % characterAccents.length])}>
                          {item.name.slice(0, 1)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{item.name}</span>
                          <span className="mt-0.5 block truncate text-xs text-neutral-500">{item.summary || "暂无简介"}</span>
                          <span className="mt-1 flex items-center text-[10px] text-neutral-400">
                            <Clock3 size={11} className="mr-1" />
                            {formatUpdatedAt(item.updatedAt)}
                          </span>
                        </div>
                        <ItemActions onEdit={() => onStartEditCharacter(item)} onDelete={() => onDeleteCharacter(item)} editLabel="编辑角色" deleteLabel="删除角色" />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {activeTab === "settings" ? (
              <div className="space-y-3">
                <SearchInput value={settingSearch} onChange={onSettingSearchChange} placeholder="搜索名称、简介或详情" label="搜索设定" />
                <Select value={settingType} onValueChange={onSettingTypeChange}>
                  <SelectTrigger className="w-full rounded-xl border-neutral-200 bg-white" aria-label="筛选设定类型">
                    <SelectValue placeholder="筛选设定类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {settingTypes.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {!isWorkspaceLoading && !settings.length ? (
                  <Empty className="rounded-xl border border-dashed border-neutral-200">
                    <EmptyHeader>
                      <EmptyTitle>还没有设定</EmptyTitle>
                      <EmptyDescription>点击右上角新建设定，也可以从 AI 对话保存设定草稿。</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button size="sm" className="rounded-full bg-[#171717] text-white hover:bg-[#171717]/90" onClick={onStartCreateSetting}><Plus data-icon="inline-start" />新建设定</Button>
                    </EmptyContent>
                  </Empty>
                ) : null}
                {settings.length > 0 && !filteredSettings.length ? <p className="rounded-xl border border-neutral-200 p-4 text-xs text-neutral-500">没有匹配的设定</p> : null}
                <div className="space-y-2">
                  {filteredSettings.map((item) => {
                    const selected = item.id === activeSetting?.id && isSettingDetail;
                    return (
                      <div key={item.id} className={cn("group relative rounded-2xl p-3 transition-colors", selected ? "bg-neutral-100" : "hover:bg-neutral-50")} onClick={() => onSelectSetting(item)}>
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-bold">{item.name}</span>
                          <Badge variant="secondary" className="bg-neutral-100 text-neutral-600 group-hover:opacity-0">{item.type || "other"}</Badge>
                        </span>
                        <span className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">{item.summary || "暂无简介"}</span>
                        <span className="mt-2 flex items-center text-[10px] text-neutral-400"><Clock3 size={11} className="mr-1" />{formatUpdatedAt(item.updatedAt)}</span>
                        <ItemActions onEdit={() => onStartEditSetting(item)} onDelete={() => onDeleteSetting(item)} editLabel="编辑设定" deleteLabel="删除设定" />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className={cn(
          "flex min-h-0 flex-col overflow-hidden border-b border-neutral-200 transition-[height,flex-grow] duration-300 ease-out",
          notesCollapsed ? "h-12 shrink-0" : "flex-1"
        )}>
          <button
            className="flex h-12 shrink-0 items-center justify-between px-4 text-left"
            onClick={() => setNotesCollapsed((value) => !value)}
            aria-expanded={!notesCollapsed}
          >
            <span className="inline-flex items-center gap-1.5 text-sm font-bold">
              <Lightbulb size={15} />
              灵感便签 ({inspirationNotes.length})
            </span>
            <span className="inline-flex items-center gap-2 text-neutral-400">
              {!notesCollapsed ? <span role="button" className="rounded-full p-1 text-[#888888] hover:bg-[#f5f5f5] hover:text-[#171717] cursor-pointer" onClick={(event) => { event.stopPropagation(); onStartCreateNote(); }} aria-label="新建灵感便签"><Plus size={15} /></span> : null}
              {notesCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
            </span>
          </button>
          <div
            className={cn(
              "min-h-0 flex-1 overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
              notesCollapsed ? "max-h-0 opacity-0" : "max-h-[999px] opacity-100"
            )}
          >
            <div className="h-full overflow-y-auto px-3 pb-3">
              <div className="space-y-1.5">
                {inspirationNotes.map((note) => (
                  <button key={note.id} className="group flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-neutral-50" onClick={() => onStartEditNote(note)}>
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-amber-50 text-amber-600"><Lightbulb size={12} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{note.title}</span>
                      <span className="block truncate text-[10px] text-neutral-400">{note.category} · {formatUpdatedAt(note.updatedAt)}</span>
                    </span>
                    <span role="button" className="rounded-full p-1 text-[#888888] opacity-0 hover:bg-[#f7d4d6] hover:text-[#ee0000] group-hover:opacity-100 cursor-pointer" onClick={(event) => { event.stopPropagation(); onDeleteNote(note); }} aria-label="删除便签"><Trash2 size={12} /></span>
                  </button>
                ))}
                {!inspirationNotes.length ? <button className="w-full rounded-xl border border-dashed border-[#ebebeb] py-3 text-xs text-[#888888] hover:border-[#a1a1a1] hover:text-[#171717]" onClick={onStartCreateNote}>+ 新建灵感便签</button> : null}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="h-20 shrink-0 px-3 py-2">
        <div className="flex h-full items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-3 py-2">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#171717] text-[10px] font-bold text-white">
            {percent}%
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="inline-flex items-center gap-1.5 text-xs font-bold"><Target size={13} />今日目标</h3>
              <button className="rounded-full p-1 text-[#888888] hover:bg-[#f5f5f5] hover:text-[#171717]" onClick={onOpenGoalEdit} aria-label="编辑创作目标"><Edit3 size={13} /></button>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-neutral-950 transition-[width] duration-300" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-1 text-[11px] font-bold tabular-nums">{dailyWordProgress.wordsAdded} / {writingGoal.targetWords} 字</p>
          </div>
        </div>
      </section>
    </aside>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
      <Input
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-xl border-neutral-200 bg-white pl-9 text-xs"
        placeholder={placeholder}
      />
    </div>
  );
}

function ItemActions({
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
}: {
  onEdit: () => void;
  onDelete: () => void;
  editLabel: string;
  deleteLabel: string;
}) {
  return (
    <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      <button className="rounded-full p-1 text-[#888888] hover:bg-[#f5f5f5] hover:text-[#171717]" onClick={(event) => { event.stopPropagation(); onEdit(); }} aria-label={editLabel}>
        <Edit3 size={13} />
      </button>
      <button className="rounded-full p-1 text-[#888888] hover:bg-[#f7d4d6] hover:text-[#ee0000]" onClick={(event) => { event.stopPropagation(); onDelete(); }} aria-label={deleteLabel}>
        <Trash2 size={13} />
      </button>
    </div>
  );
}
