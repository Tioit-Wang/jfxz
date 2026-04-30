"use client";

import { ArrowRight, BatteryCharging, BookOpen, ChevronDown, ChevronRight, Clock, Crown, FileText, Layers, LayoutGrid, List, Loader2, LogOut, MoreHorizontal, Plus, Search, Trash2, Zap } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClient, ApiError, type UserProfile, type WorkDraft } from "@/api";
import { userLoginPath } from "@/auth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Work } from "@/domain";

const emptyDraft: WorkDraft = {
  title: "",
  shortIntro: "",
  synopsis: "",
  tags: [],
  backgroundRules: "",
  focusRequirements: "",
  forbiddenRequirements: ""
};

function formatUpdatedAt(value: string): string {
  if (!value) return "暂无更新时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function workStats(work: Work) {
  const text = [work.shortIntro, work.synopsis, work.backgroundRules, work.focusRequirements, work.forbiddenRequirements].join("");
  return {
    chapters: 0,
    wordCount: [...text.replace(/\s/g, "")].length
  };
}

export default function BooksClient() {
  const router = useRouter();
  const client = useMemo(() => new ApiClient(undefined, undefined, {
    onUnauthorized: () => router.replace(userLoginPath("/books"))
  }), [router]);
  const [works, setWorks] = useState<Work[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<WorkDraft>(emptyDraft);
  const [draftTags, setDraftTags] = useState("");
  const [formError, setFormError] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Work | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const visibleWorks = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return works;
    return works.filter((work) => {
      const searchable = [work.title, work.shortIntro, work.synopsis, ...work.tags].join(" ").toLowerCase();
      return searchable.includes(keyword);
    });
  }, [searchQuery, works]);

  const loadWorks = useCallback(async () => {
    setStatus("loading");
    try {
      setWorks(await client.listWorks());
      setStatus("ready");
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        router.replace(userLoginPath("/books"));
        return;
      }
      setError(reason instanceof Error ? reason.message : "加载失败");
      setStatus("error");
    }
  }, [client, router]);

  useEffect(() => {
    void loadWorks();
  }, [loadWorks]);

  useEffect(() => {
    client.getMe().then(setUserProfile).catch(() => {});
  }, [client]);

  function openCreate() {
    if (status !== "ready") {
      router.replace(userLoginPath("/books"));
      return;
    }
    setDraft(emptyDraft);
    setDraftTags("");
    setFormError("");
    setAdvancedOpen(false);
    setCreateOpen(true);
  }

  async function createWork() {
    const nextDraft = { ...draft, tags: draftTags.split(/[，,\s]+/).map((item) => item.trim()).filter(Boolean) };
    setSubmitting(true);
    setFormError("");
    try {
      const work = await client.createWork(nextDraft);
      setWorks((items) => [work, ...items]);
      setCreateOpen(false);
      router.push(`/books/${work.id}`);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteWork(work: Work) {
    setDeletingId(work.id);
    try {
      await client.deleteWork(work.id);
      setWorks((items) => items.filter((item) => item.id !== work.id));
      setDeleteTarget(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除失败");
      setStatus("error");
    } finally {
      setDeletingId("");
    }
  }

  async function logout() {
    await client.logout();
    setWorks([]);
    setStatus("idle");
    router.replace(userLoginPath("/books"));
  }

  const avatarGradient = userProfile?.subscription
    ? "linear-gradient(135deg, #F59E0B, #F97316)"
    : "linear-gradient(135deg, #94A3B8, #64748B)";

  const avatarLetter = (userProfile?.user.nickname || userProfile?.user.email || "U").slice(0, 1).toUpperCase();

  return (
    <main className="lp-app">

      {/* ===== 导航栏 ===== */}
      <header className="lp-app-header">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 lg:px-6">
          <Link className="text-base font-semibold tracking-tight" href="/" style={{ fontFamily: "var(--font-display)" }}>
            妙蛙写作
          </Link>
          <div className="relative">
            {/* 头像 + hover 弹窗 */}
            <div className="group relative">
              <button
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm ring-2 ring-white/80 transition-all hover:scale-105 active:scale-95"
                style={{ background: avatarGradient }}
                aria-label="账户"
              >
                {avatarLetter}
              </button>
              <div className="absolute right-0 top-full z-50 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-y-1 group-hover:translate-y-0">
                <div className="min-w-[200px] overflow-hidden rounded-xl bg-white shadow-lg border border-gray-100">
                  <div className="px-4 py-3 border-b border-gray-50">
                    <p className="text-sm font-semibold text-gray-900">{userProfile?.user.nickname || "用户"}</p>
                    <p className="mt-0.5 text-xs text-gray-400 truncate">{userProfile?.user.email || ""}</p>
                  </div>
                  <button
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50"
                    onClick={() => void logout()}
                  >
                    <LogOut className="h-4 w-4" />
                    退出登录
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ===== 创作者看板 ===== */}
      <section className="mx-auto w-full max-w-7xl px-4 pt-8 lg:px-6">
        <div className="mb-10 grid gap-5 md:grid-cols-3">

          {/* Card 1: 创作者名片 */}
          <div className="relative flex items-center gap-5 overflow-hidden rounded-[20px] border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white shadow-[0_4px_12px_rgba(245,158,11,0.3)]"
              style={{ background: avatarGradient }}>
              {avatarLetter}
              {userProfile?.subscription && (
                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-gray-50 bg-white shadow-sm">
                  <Crown size={12} className="text-amber-500" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">{userProfile?.user.nickname || "创作者"}</h2>
              <p
                className="mt-1 flex w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-[13px] font-semibold"
                style={{
                  color: userProfile?.subscription ? "#D97706" : "#6B6662",
                  background: userProfile?.subscription ? "rgba(245,158,11,0.1)" : "rgba(0,0,0,0.04)"
                }}
              >
                {userProfile?.subscription ? "VIP 创作者" : "免费用户"}
              </p>
            </div>
          </div>

          {/* Card 2: 写作积分 */}
          <div className="flex flex-col justify-center rounded-[20px] border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-500">
                <Zap size={16} className="text-blue-500" />
                今日写作积分
              </p>
              <p className="text-3xl font-bold tracking-tight text-gray-900">
                {(userProfile?.points.vipDailyPoints ?? 0).toLocaleString()}
              </p>
              <p className="mt-2 text-[11px] text-gray-400">VIP 专属 · 每日 00:00 自动重置</p>
            </div>
          </div>

          {/* Card 3: 备用积分 */}
          <div className="flex flex-col justify-center rounded-[20px] border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-500">
                  <BatteryCharging size={16} className="text-purple-500" />
                  备用写作积分
                </p>
                <p className="text-3xl font-bold tracking-tight text-gray-900">
                  {(userProfile?.points.creditPackPoints ?? 0).toLocaleString()}
                </p>
                <p className="mt-1.5 flex items-center gap-1 text-[11px] text-gray-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" /> 永久有效，优先扣除
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ===== 我的作品库 ===== */}
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-8 lg:px-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">创作书架</h1>
            <p className="mt-1 text-sm text-gray-500">管理你的长篇巨作与世界观档案库。</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--lp-muted)" }} />
              <input
                aria-label="搜索作品"
                className="h-10 rounded-xl border pl-9 pr-3 text-sm outline-none sm:w-64"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜索书名 / 题材..."
                value={searchQuery}
                style={{ borderColor: "var(--lp-border)", background: "var(--lp-card)", color: "var(--lp-ink)" }}
              />
            </div>
            <div className="flex items-center gap-1 rounded-xl border p-1" style={{ borderColor: "var(--lp-border)", background: "var(--lp-card)" }}>
              <button
                aria-label="网格视图"
                aria-pressed={viewMode === "grid"}
                onClick={() => setViewMode("grid")}
                type="button"
                className={`rounded-lg px-2.5 py-1.5 transition-colors ${viewMode === "grid" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                aria-label="列表视图"
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
                type="button"
                className={`rounded-lg px-2.5 py-1.5 transition-colors ${viewMode === "list" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <Button onClick={openCreate} className="h-10 border-0 px-5 text-white shadow-md ">
              <Plus className="mr-1.5 h-4 w-4" />
              开本新书
            </Button>
          </div>
        </div>

        {/* 加载态 */}
        {status === "loading" ? <Skeleton className="h-32 w-full rounded-2xl" /> : null}

        {/* 错误态 */}
        {status === "error" ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
            加载失败：{error}
          </div>
        ) : null}

        {/* 空态 — 无作品 */}
        {status === "ready" && works.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <BookOpen className="h-10 w-10 text-gray-300" />
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900">还没有作品</p>
              <p className="mt-1 text-sm text-gray-500">创建第一本作品，开始维护长篇上下文。</p>
            </div>
            <Button onClick={openCreate} className="mt-2 border-0 bg-blue-600 px-5 text-white hover:bg-blue-700">
              <Plus className="mr-1.5 h-4 w-4" />
              新建作品
            </Button>
          </div>
        ) : null}

        {/* 空态 — 搜索无匹配 */}
        {status === "ready" && works.length > 0 && visibleWorks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <Search className="h-10 w-10 text-gray-300" />
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900">没有匹配的作品</p>
              <p className="mt-1 text-sm text-gray-500">换个关键词再试试。</p>
            </div>
          </div>
        ) : null}

        {/* ===== 网格视图 ===== */}
        {status === "ready" && visibleWorks.length > 0 && viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleWorks.map((work, index) => {
              const stats = workStats(work);
              const gradients = [
                "from-blue-50 to-indigo-50",
                "from-orange-50 to-red-50",
                "from-purple-50 to-fuchsia-50",
              ];
              const badgeStyles = [
                { bg: "#EEF2FF", color: "#4338CA" },
                { bg: "#FFF7ED", color: "#C2410C" },
                { bg: "#FAF5FF", color: "#7E22CE" },
              ];
              const bs = badgeStyles[index % 3];
              return (
                <div key={work.id} className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-lg">

                  {/* 封面区 */}
                  <Link href={`/books/${work.id}`} className={`relative flex h-32 flex-col justify-between overflow-hidden bg-gradient-to-br ${gradients[index % 3]} border-b border-gray-100 p-4`}>
                    <div className="pointer-events-none absolute bottom-0 right-0 opacity-[0.06]">
                      <BookOpen size={80} className="-mb-4 -mr-4" />
                    </div>
                    <div className="flex items-start justify-between">
                      <Badge className="border-0 px-2 py-1 text-[11px] font-medium" style={{ background: bs.bg, color: bs.color }}>
                        {work.tags[0] || "未分类"}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon-xs" variant="ghost" className="h-7 w-7 rounded-lg bg-white/50 text-gray-600 backdrop-blur-sm hover:bg-white"
                            onClick={(e) => e.preventDefault()}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem asChild>
                              <Link href={`/books/${work.id}`}>打开作品</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={deletingId === work.id} onSelect={() => setDeleteTarget(work)} variant="destructive">
                              <Trash2 data-icon="inline-start" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <h3 className="z-10 mt-auto truncate text-lg font-bold text-gray-900 drop-shadow-sm">
                      {work.title}
                    </h3>
                  </Link>

                  {/* 详情区 */}
                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <p className="line-clamp-2 min-h-9 text-[13px] leading-relaxed text-gray-500">
                      {work.shortIntro || work.synopsis || "暂无简介"}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1 rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
                          <FileText className="h-3.5 w-3.5" /> 字数
                        </span>
                        <span className="text-sm font-bold text-gray-900">{(stats.wordCount / 10000).toFixed(1)} 万字</span>
                      </div>
                      <div className="flex flex-col gap-1 rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
                          <Layers className="h-3.5 w-3.5" /> 章节
                        </span>
                        <span className="text-sm font-bold text-gray-900">{stats.chapters} 章</span>
                      </div>
                    </div>
                  </div>

                  {/* 底栏 */}
                  <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/80 px-5 py-3.5">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      {formatUpdatedAt(work.updatedAt)}
                    </span>
                    <Link href={`/books/${work.id}`}
                      className="flex items-center gap-1 text-xs font-bold opacity-0 transition-opacity hover:underline group-hover:opacity-100">
                      继续爆更 <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              );
            })}

            {/* 新建作品卡片 */}
            <button
              className="flex min-h-[340px] flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-8 text-sm font-medium text-gray-500 transition-all hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600"
              onClick={openCreate}
              type="button"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gray-100 bg-white shadow-sm transition-colors group-hover:border-blue-200 group-hover:bg-blue-100">
                <Plus className="h-6 w-6" />
              </span>
              <span className="text-base font-bold">开启新书大纲</span>
              <span className="text-xs font-normal text-gray-400">下一本霸榜爆款从这里起航</span>
            </button>
          </div>
        ) : null}

        {/* ===== 列表视图 ===== */}
        {status === "ready" && visibleWorks.length > 0 && viewMode === "list" ? (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">作品名称</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">类型</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">字数</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">最近更新</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleWorks.map((work, index) => {
                  const stats = workStats(work);
                  const avatarColors = ["#505EE2", "#EF7953", "#8B10D6"];
                  return (
                    <tr key={work.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <Link className="flex min-w-64 items-center gap-3" href={`/books/${work.id}`}>
                          <span
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
                            style={{ background: avatarColors[index % 3] }}
                          >
                            {work.title.slice(0, 1)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-gray-900">{work.title}</span>
                            <span className="block truncate text-xs text-gray-500">{work.shortIntro || work.synopsis || "暂无简介"}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{work.tags[0] ?? "未设置"}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{stats.wordCount} 字</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatUpdatedAt(work.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/books/${work.id}`}>打开</Link>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(work)} disabled={deletingId === work.id}>
                            {deletingId === work.id ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Trash2 data-icon="inline-start" />}
                            删除
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* ===== 新建作品对话框 ===== */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl" style={{ borderRadius: "20px", boxShadow: "0 20px 48px rgba(26,25,25,0.07)" }}>
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold" style={{ color: "var(--lp-ink)" }}>新建作品</DialogTitle>
            <DialogDescription>填写作品基础信息，保存后进入工作台。</DialogDescription>
          </DialogHeader>
          <FieldGroup className="max-h-[68vh] overflow-y-auto pr-1">
            <Field>
              <FieldLabel style={{ color: "var(--lp-ink)", fontWeight: 600 }}>作品名称</FieldLabel>
              <Input aria-label="作品名称" value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="未填写时保存为未命名作品" className="rounded-xl" style={{ borderColor: "var(--lp-border)", background: "var(--lp-bg)" }} />
            </Field>
            <Field>
              <FieldLabel style={{ color: "var(--lp-ink)", fontWeight: 600 }}>作品题材</FieldLabel>
              <Input aria-label="作品题材" value={draftTags} onChange={(event) => setDraftTags(event.target.value)} placeholder="可用逗号或空格分隔" className="rounded-xl" style={{ borderColor: "var(--lp-border)", background: "var(--lp-bg)" }} />
            </Field>
            <Field>
              <FieldLabel style={{ color: "var(--lp-ink)", fontWeight: 600 }}>作品梗概</FieldLabel>
              <Textarea aria-label="作品梗概" value={draft.synopsis} onChange={(event) => setDraft((value) => ({ ...value, synopsis: event.target.value }))} placeholder="简单记录故事主线" className="min-h-28 rounded-xl" style={{ borderColor: "var(--lp-border)", background: "var(--lp-bg)" }} />
            </Field>
            <div className="flex flex-col gap-3">
              <Button
                aria-controls="create-work-advanced"
                aria-expanded={advancedOpen}
                className="justify-between rounded-xl"
                onClick={() => setAdvancedOpen((open) => !open)}
                type="button"
                variant="outline"
                style={{ borderColor: "var(--lp-border)", color: "var(--lp-ink)" }}
              >
                更多配置
                <ChevronDown data-icon="inline-end" className={advancedOpen ? "rotate-180" : ""} />
              </Button>
              {advancedOpen ? (
                <FieldGroup id="create-work-advanced">
                  <Field>
                    <FieldLabel style={{ color: "var(--lp-ink)", fontWeight: 600 }}>短简介</FieldLabel>
                    <Textarea aria-label="短简介" value={draft.shortIntro} onChange={(event) => setDraft((value) => ({ ...value, shortIntro: event.target.value }))} placeholder="用于作品卡片展示" className="rounded-xl" style={{ borderColor: "var(--lp-border)", background: "var(--lp-bg)" }} />
                  </Field>
                  <Field>
                    <FieldLabel style={{ color: "var(--lp-ink)", fontWeight: 600 }}>背景与世界规则</FieldLabel>
                    <Textarea aria-label="背景与世界规则" value={draft.backgroundRules} onChange={(event) => setDraft((value) => ({ ...value, backgroundRules: event.target.value }))} placeholder="记录世界观、规则或限制" className="min-h-28 rounded-xl" style={{ borderColor: "var(--lp-border)", background: "var(--lp-bg)" }} />
                  </Field>
                  <Field>
                    <FieldLabel style={{ color: "var(--lp-ink)", fontWeight: 600 }}>重点要求</FieldLabel>
                    <Textarea aria-label="重点要求" value={draft.focusRequirements} onChange={(event) => setDraft((value) => ({ ...value, focusRequirements: event.target.value }))} placeholder="可选" className="rounded-xl" style={{ borderColor: "var(--lp-border)", background: "var(--lp-bg)" }} />
                  </Field>
                  <Field>
                    <FieldLabel style={{ color: "var(--lp-ink)", fontWeight: 600 }}>禁忌要求</FieldLabel>
                    <Textarea aria-label="禁忌要求" value={draft.forbiddenRequirements} onChange={(event) => setDraft((value) => ({ ...value, forbiddenRequirements: event.target.value }))} placeholder="可选" className="rounded-xl" style={{ borderColor: "var(--lp-border)", background: "var(--lp-bg)" }} />
                  </Field>
                </FieldGroup>
              ) : null}
            </div>
            {formError ? <FieldError>{formError}</FieldError> : null}
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="lp-btn-secondary">取消</Button>
            <Button onClick={() => void createWork()} disabled={submitting} className="lp-btn-primary">
              {submitting ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
              创建作品
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 删除确认弹窗 ===== */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除作品？</AlertDialogTitle>
            <AlertDialogDescription>删除后作品下的章节、角色、设定和会话也会被删除。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && void deleteWork(deleteTarget)}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </main>
  );
}
