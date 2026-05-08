"use client";

import {
  BookOpen,
  ChevronLeft,
  Clock3,
  Copy,
  Crown,
  Database,
  Edit3,
  MoreVertical,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import type { NamedContent, UserProfile } from "@/api";
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
  chapters: Chapter[];
  activeChapterId: string;
  onSelectChapter: (chapterId: string) => void;
  onCreateChapter: () => void;
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
  onCopyCharacterText: (label: string, value: string) => void;
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
  profile: UserProfile | null;
  showPointsDetail: boolean;
  onTogglePointsDetail: () => void;
  onOpenBilling: () => void;
  formatUpdatedAt: (value: string) => string;
};

export function WorkspaceSidebarPanel({
  work,
  onOpenWorkEdit,
  activeTab,
  onActiveTabChange,
  moduleMeta,
  chapters,
  activeChapterId,
  onSelectChapter,
  onCreateChapter,
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
  onCopyCharacterText,
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
  profile,
  showPointsDetail,
  onTogglePointsDetail,
  onOpenBilling,
  formatUpdatedAt,
}: WorkspaceSidebarPanelProps) {
  return (
    <aside data-testid="workspace-sidebar-panel" className="z-10 flex h-full min-h-0 min-w-0 flex-col border-r border-border bg-card shadow-[2px_0_8px_rgba(0,0,0,0.02)]">
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="size-8" aria-label="返回作品列表">
            <Link href="/books">
              <ChevronLeft size={20} />
            </Link>
          </Button>
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">{work?.title ?? "作品加载中"}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{work?.shortIntro || "作品总纲已定"}</span>
          </div>
        </div>
        <button
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={onOpenWorkEdit}
          aria-label="编辑作品信息"
        >
          <MoreVertical size={16} />
        </button>
      </div>

      <div className="flex gap-1 border-b border-border bg-muted/40 p-2">
        {[
          { key: "chapters" as const, label: "章节", icon: BookOpen },
          { key: "characters" as const, label: "角色", icon: Users },
          { key: "settings" as const, label: "设定", icon: Database },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => onActiveTabChange(item.key)}
              className={cn(
                "flex flex-1 items-center justify-center rounded py-1.5 text-xs font-medium transition-colors",
                activeTab === item.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon size={14} className="mr-1.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between p-4 pb-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{moduleMeta.title}</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{moduleMeta.count}</p>
        </div>
        {activeTab === "chapters" ? (
          <button
            className="rounded bg-primary p-1.5 text-primary-foreground transition-colors hover:bg-primary/90"
            onClick={onCreateChapter}
            aria-label="新建章节"
          >
            <Plus size={16} />
          </button>
        ) : null}
        {activeTab === "characters" ? (
          <button
            className="rounded bg-primary p-1.5 text-primary-foreground transition-colors hover:bg-primary/90"
            onClick={onStartCreateCharacter}
            aria-label="新建角色"
          >
            <Plus size={16} />
          </button>
        ) : null}
        {activeTab === "settings" ? (
          <button
            className="rounded bg-primary p-1.5 text-primary-foreground transition-colors hover:bg-primary/90"
            onClick={onStartCreateSetting}
            aria-label="新建设定"
          >
            <Plus size={16} />
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {activeTab === "chapters" ? (
          <div className="space-y-1">
            {chapters.map((chapter) => {
              const selected = chapter.id === activeChapterId;
              return (
                <button
                  key={chapter.id}
                  draggable
                  className={cn(
                    "group relative w-full cursor-grab overflow-hidden rounded-lg border p-3 text-left transition-colors active:cursor-grabbing",
                    selected
                      ? "border-border bg-card shadow-sm"
                      : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  onClick={() => onSelectChapter(chapter.id)}
                  onDragStart={(event) =>
                    writeWorkspaceMentionDragData(event.dataTransfer, {
                      type: "chapter",
                      id: chapter.id,
                      name: chapter.title,
                      summary: chapter.summary || `第 ${chapter.order} 章`,
                    })
                  }
                >
                  {selected ? <span className="absolute bottom-0 left-0 top-0 w-1 bg-primary" /> : null}
                  <span className="flex items-start justify-between gap-2 pl-1">
                    <span className={cn("truncate text-sm", selected ? "font-bold text-foreground" : "font-medium")}>
                      {chapter.order}. {chapter.title}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-[11px]",
                        selected ? "text-muted-foreground" : "text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                      )}
                    >
                      {wordCount(chapter.content)}字
                    </span>
                  </span>
                  <span className="mt-1 block truncate pl-1 text-xs text-muted-foreground">
                    {chapter.summary || "暂无章节提要"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {activeTab === "characters" ? (
          <div className="space-y-3">
            <div className="relative px-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                aria-label="搜索角色"
                value={characterSearch}
                onChange={(event) => onCharacterSearchChange(event.target.value)}
                className="h-9 rounded-lg border-border bg-background pl-9 text-xs"
                placeholder="搜索名称或简介"
              />
            </div>

            {copyNotice ? <p className="mx-1 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">{copyNotice}</p> : null}

            <div className="space-y-1">
              {isWorkspaceLoading ? <p className="px-3 py-4 text-sm text-gray-400">角色加载中...</p> : null}
              {!isWorkspaceLoading && !characters.length ? (
                <p className="mx-1 rounded-lg border border-dashed border-gray-200 bg-white p-4 text-xs leading-5 text-gray-400">
                  还没有角色，点击右上角创建。
                </p>
              ) : null}
              {!isWorkspaceLoading && characters.length > 0 && !filteredCharacters.length ? (
                <p className="mx-1 rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-400">没有匹配的角色</p>
              ) : null}
              {filteredCharacters.map((item) => {
                const selected = item.id === activeCharacter?.id && isCharacterDetail;
                return (
                  <div
                    key={item.id}
                    draggable
                    className={cn(
                      "group relative w-full cursor-grab rounded-lg border p-3 text-left transition-colors active:cursor-grabbing",
                      selected ? "border-border bg-card shadow-sm" : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
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
                    <span className="block truncate text-sm font-medium text-foreground">{item.name}</span>
                    <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.summary || "暂无简介"}</span>
                    <span className="mt-2 flex items-center text-[10px] text-muted-foreground">
                      <Clock3 size={11} className="mr-1" />
                      {formatUpdatedAt(item.updatedAt)}
                    </span>
                    <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          onStartEditCharacter(item);
                        }}
                        aria-label="编辑角色"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteCharacter(item);
                        }}
                        aria-label="删除角色"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        ) : null}

        {activeTab === "settings" ? (
          <div className="space-y-3">
            <div className="space-y-2 px-1">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="搜索设定"
                  value={settingSearch}
                  onChange={(event) => onSettingSearchChange(event.target.value)}
                  className="h-9 pl-9 text-xs"
                  placeholder="搜索名称、简介或详情"
                />
              </div>
              <Select value={settingType} onValueChange={onSettingTypeChange}>
                <SelectTrigger className="w-full" aria-label="筛选设定类型">
                  <SelectValue placeholder="筛选设定类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {settingTypes.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {copyNotice ? <p className="mx-1 rounded-lg border bg-muted px-3 py-2 text-xs text-muted-foreground">{copyNotice}</p> : null}

            <div className="space-y-1">
              {!isWorkspaceLoading && !settings.length ? (
                <Empty className="mx-1 rounded-lg border border-dashed">
                  <EmptyHeader>
                    <EmptyTitle>还没有设定</EmptyTitle>
                    <EmptyDescription>点击右上角新建设定，也可以从 AI 对话保存设定草稿。</EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button size="sm" onClick={onStartCreateSetting}>
                      <Plus data-icon="inline-start" />
                      新建设定
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : null}
              {settings.length > 0 && !filteredSettings.length ? (
                <p className="mx-1 rounded-lg border bg-card p-4 text-xs text-muted-foreground">没有匹配的设定</p>
              ) : null}
              {filteredSettings.map((item) => {
                const selected = item.id === activeSetting?.id && isSettingDetail;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "group relative w-full cursor-pointer rounded-lg border p-3 text-left transition-colors",
                      selected ? "border-border bg-card shadow-sm" : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    onClick={() => onSelectSetting(item)}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
                      <Badge variant="secondary" className="group-hover:opacity-0 transition-opacity">{item.type || "other"}</Badge>
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.summary || "暂无简介"}</span>
                    <span className="mt-2 flex items-center text-[10px] text-muted-foreground">
                      <Clock3 size={11} className="mr-1" />
                      {formatUpdatedAt(item.updatedAt)}
                    </span>
                    <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          onStartEditSetting(item);
                        }}
                        aria-label="编辑设定"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteSetting(item);
                        }}
                        aria-label="删除设定"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        ) : null}
      </div>

      <div className="border-t border-border/60 bg-muted/20 p-4">
        <div
          className={cn(
            "group relative cursor-pointer overflow-hidden rounded-2xl border p-4 transition-all duration-300",
            profile?.subscription
              ? "border-amber-200/50 bg-gradient-to-br from-amber-50/50 via-background to-orange-50/30 hover:border-amber-300/60 hover:shadow-[0_4px_20px_-8px_rgba(245,158,11,0.2)]"
              : "border-border bg-card hover:border-primary/30 hover:shadow-md"
          )}
          onClick={onTogglePointsDetail}
        >
          {profile?.subscription ? (
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-500/20 blur-2xl transition-all group-hover:scale-110" />
          ) : null}

          <div className="relative flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm ring-2 ring-background",
                  profile?.subscription
                    ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/20"
                    : "bg-gradient-to-br from-slate-400 to-slate-500"
                )}
              >
                {(profile?.user.nickname || profile?.user.email || "U").slice(0, 1).toUpperCase()}
                {profile?.subscription ? (
                  <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-sm">
                    <Crown size={10} className="text-amber-500" />
                  </div>
                ) : null}
              </div>
              <div className="min-w-0">
                <span className="block truncate text-sm font-bold text-foreground">{profile?.user.nickname || "账户中心"}</span>
                <span className={cn("block text-[11px] font-medium", profile?.subscription ? "text-amber-600" : "text-muted-foreground")}>
                  {profile?.subscription ? "尊享 VIP 创作中" : "免费版体验中"}
                </span>
              </div>
            </div>
            {showPointsDetail ? (
              <button
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold shadow-sm transition-all active:scale-[0.97]",
                  profile?.subscription
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 hover:shadow-amber-500/25"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenBilling();
                }}
              >
                <Sparkles size={12} className={profile?.subscription ? "text-amber-100" : ""} />
                {profile?.subscription ? "续费套餐" : "升级解锁"}
              </button>
            ) : (
              <div className="shrink-0 text-right text-[11px] tabular-nums leading-relaxed text-muted-foreground">
                <div className="font-medium text-foreground">
                  <Zap size={10} className="mb-0.5 mr-0.5 inline text-amber-500" />
                  {(profile?.points.vipDailyPoints ?? 0) + (profile?.points.creditPackPoints ?? 0)}
                </div>
                <div className="text-[10px] opacity-70">可用积分</div>
              </div>
            )}
          </div>

          <div
            className={cn(
              "relative overflow-hidden transition-all duration-500 ease-in-out",
              showPointsDetail ? "mt-5 max-h-48 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <div className="flex rounded bg-amber-100 p-0.5 text-amber-600">
                      <Crown size={12} />
                    </div>
                    每日畅写积分
                  </span>
                  <span className="tabular-nums font-semibold text-foreground">
                    {(profile?.points.vipDailyPoints ?? 0).toFixed(1)} <span className="text-[10px] font-normal text-muted-foreground">/日</span>
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60 shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min(100, ((profile?.points.vipDailyPoints ?? 0) / 2000) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <div className="flex rounded bg-blue-100 p-0.5 text-blue-600">
                      <Zap size={12} />
                    </div>
                    永久灵感加油包
                  </span>
                  <span className="tabular-nums font-semibold text-foreground">
                    {(profile?.points.creditPackPoints ?? 0).toFixed(1)} <span className="text-[10px] font-normal text-muted-foreground">点</span>
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60 shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min(100, ((profile?.points.creditPackPoints ?? 0) / 2000) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
