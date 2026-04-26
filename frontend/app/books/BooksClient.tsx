"use client";

import { BookOpen, ChevronDown, ChevronRight, Clock, FileText, LayoutGrid, List, Loader2, MoreHorizontal, Plus, RefreshCw, Search, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClient, ApiError, type WorkDraft } from "@/api";
import { userLoginPath } from "@/auth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { Work } from "@/domain";
import { cn } from "@/lib/utils";

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
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
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
  const client = useMemo(() => new ApiClient(), []);
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

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          <Link className="text-lg font-semibold" href="/">
            金番写作
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void loadWorks()}>
              <RefreshCw data-icon="inline-start" />
              刷新
            </Button>
            <Button onClick={openCreate}>
              <Plus data-icon="inline-start" />
              新建作品
            </Button>
            <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label="账户">
              <UserRound />
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 lg:px-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">我的作品</h1>
            <p className="mt-1 text-sm text-muted-foreground">管理作品总纲、章节、角色、设定和 AI 会话。</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="搜索作品"
                className="h-9 pl-9 sm:w-64"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜索作品..."
                value={searchQuery}
              />
            </div>
            <div className="flex items-center gap-1 rounded-md border bg-background p-1">
              <Button
                aria-label="网格视图"
                aria-pressed={viewMode === "grid"}
                onClick={() => setViewMode("grid")}
                size="icon-sm"
                type="button"
                variant={viewMode === "grid" ? "secondary" : "ghost"}
              >
                <LayoutGrid />
              </Button>
              <Button
                aria-label="列表视图"
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
                size="icon-sm"
                type="button"
                variant={viewMode === "list" ? "secondary" : "ghost"}
              >
                <List />
              </Button>
            </div>
            <Button onClick={openCreate}>
              <Plus data-icon="inline-start" />
              创建作品
            </Button>
          </div>
        </div>

        {status === "loading" ? <Skeleton className="h-32 w-full" /> : null}
        {status === "error" ? <p className="rounded-md border bg-card p-5 text-sm text-card-foreground">加载失败：{error}</p> : null}
        {status === "ready" && works.length === 0 ? (
          <Empty className="rounded-lg border">
            <EmptyHeader>
              <EmptyTitle>还没有作品</EmptyTitle>
              <EmptyDescription>创建第一本作品，开始维护长篇上下文。</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={openCreate}>
                <Plus data-icon="inline-start" />
                新建作品
              </Button>
            </EmptyContent>
          </Empty>
        ) : null}
        {status === "ready" && works.length > 0 && visibleWorks.length === 0 ? (
          <Empty className="rounded-lg border">
            <EmptyHeader>
              <EmptyTitle>没有匹配的作品</EmptyTitle>
              <EmptyDescription>换个关键词再试试。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {status === "ready" && visibleWorks.length > 0 && viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleWorks.map((work, index) => {
              const stats = workStats(work);
              const category = work.tags[0] ?? "未设置题材";
              const extraTags = work.tags.slice(1);
              return (
                <Card key={work.id} className="group min-h-[354px] gap-0 rounded-lg py-0 ring-border/70 shadow-xs transition-colors hover:bg-muted/15 hover:ring-primary/25">
                  <Link className="relative block h-36 overflow-hidden border-b bg-muted" href={`/books/${work.id}`}>
                    <div
                      className={cn(
                        "absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--foreground)/0.08)_0_1px,transparent_1px_20px),radial-gradient(circle_at_25%_20%,hsl(var(--primary)/0.2),transparent_32%),linear-gradient(135deg,hsl(var(--muted)),hsl(var(--secondary)))]",
                        index % 3 === 1 && "bg-[linear-gradient(90deg,hsl(var(--foreground)/0.07)_0_1px,transparent_1px_20px),radial-gradient(circle_at_75%_25%,hsl(var(--accent)),transparent_32%),linear-gradient(135deg,hsl(var(--secondary)),hsl(var(--muted)))]",
                        index % 3 === 2 && "bg-[linear-gradient(90deg,hsl(var(--foreground)/0.07)_0_1px,transparent_1px_20px),radial-gradient(circle_at_35%_75%,hsl(var(--primary)/0.16),transparent_34%),linear-gradient(135deg,hsl(var(--accent)),hsl(var(--background)))]"
                      )}
                    />
                    <div className="absolute inset-y-0 left-0 w-8 border-r bg-background/25 backdrop-blur-[1px]" />
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-foreground/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <Badge className="absolute left-3 top-3 h-5 rounded-md border-background/60 bg-background/85 px-2 text-[11px] font-medium text-foreground backdrop-blur" variant="outline">
                      {category}
                    </Badge>
                    <span className="absolute bottom-3 left-3 flex items-center gap-1 text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100 [&_svg]:size-3.5">
                      继续编写
                      <ChevronRight />
                    </span>
                  </Link>
                  <CardHeader className="grid-cols-[1fr_auto] gap-2 px-4 pt-4 pb-2">
                    <Link className="min-w-0" href={`/books/${work.id}`}>
                      <CardTitle className="truncate text-[15px] font-semibold leading-5 transition-colors group-hover:text-primary">{work.title}</CardTitle>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-label={`管理 ${work.title}`} size="icon-xs" variant="ghost">
                          <MoreHorizontal />
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
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3 px-4 pb-3">
                    <p className="line-clamp-2 min-h-9 text-xs leading-4 text-muted-foreground">{work.shortIntro || work.synopsis || "暂无简介"}</p>
                    <div className="flex min-h-5 flex-wrap gap-1.5">
                      {extraTags.length ? extraTags.map((tag) => <Badge className="h-5 rounded-md px-1.5 text-[11px] font-normal" variant="secondary" key={tag}>{tag}</Badge>) : <span className="text-[11px] leading-5 text-muted-foreground">暂无更多标签</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2.5 py-2 [&_svg]:size-3.5">
                        <FileText />
                        {stats.wordCount} 字
                      </span>
                      <span className="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2.5 py-2 [&_svg]:size-3.5">
                        <BookOpen />
                        {stats.chapters} 章节
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter className="justify-between gap-3 rounded-b-lg bg-muted/25 px-4 py-3">
                    <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] text-muted-foreground [&_svg]:size-3.5">
                      <Clock />
                      更新于 {formatUpdatedAt(work.updatedAt)}
                    </span>
                    <Button
                      className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(work)}
                      disabled={deletingId === work.id}
                    >
                      {deletingId === work.id ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Trash2 data-icon="inline-start" />}
                      删除
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}

            <button
              className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-background p-8 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/30 hover:text-primary"
              onClick={openCreate}
              type="button"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Plus />
              </span>
              创建新作品
            </button>
          </div>
        ) : null}

        {status === "ready" && visibleWorks.length > 0 && viewMode === "list" ? (
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4 py-3">作品名称</TableHead>
                  <TableHead className="px-4 py-3">类型</TableHead>
                  <TableHead className="px-4 py-3">字数</TableHead>
                  <TableHead className="px-4 py-3">最近更新</TableHead>
                  <TableHead className="px-4 py-3 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleWorks.map((work, index) => {
                  const stats = workStats(work);
                  return (
                    <TableRow key={work.id}>
                      <TableCell className="px-4 py-3">
                        <Link className="flex min-w-64 items-center gap-3" href={`/books/${work.id}`}>
                          <span
                            className={cn(
                              "flex size-11 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground",
                              index % 3 === 1 && "bg-secondary text-secondary-foreground",
                              index % 3 === 2 && "bg-accent text-accent-foreground"
                            )}
                          >
                            {work.title.slice(0, 1)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{work.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">{work.shortIntro || work.synopsis || "暂无简介"}</span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">{work.tags[0] ?? "未设置"}</TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">{stats.wordCount} 字</TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">{formatUpdatedAt(work.updatedAt)}</TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/books/${work.id}`}>打开</Link>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(work)} disabled={deletingId === work.id}>
                            {deletingId === work.id ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Trash2 data-icon="inline-start" />}
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        ) : null}
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>新建作品</DialogTitle>
            <DialogDescription>填写作品基础信息，保存后进入工作台。</DialogDescription>
          </DialogHeader>
          <FieldGroup className="max-h-[68vh] overflow-y-auto pr-1">
            <Field><FieldLabel>作品名称</FieldLabel><Input aria-label="作品名称" value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="未填写时保存为未命名作品" /></Field>
            <Field><FieldLabel>作品题材</FieldLabel><Input aria-label="作品题材" value={draftTags} onChange={(event) => setDraftTags(event.target.value)} placeholder="可用逗号或空格分隔" /></Field>
            <Field><FieldLabel>作品梗概</FieldLabel><Textarea aria-label="作品梗概" value={draft.synopsis} onChange={(event) => setDraft((value) => ({ ...value, synopsis: event.target.value }))} placeholder="简单记录故事主线" className="min-h-28" /></Field>
            <div className="flex flex-col gap-3">
              <Button
                aria-controls="create-work-advanced"
                aria-expanded={advancedOpen}
                className="justify-between"
                onClick={() => setAdvancedOpen((open) => !open)}
                type="button"
                variant="outline"
              >
                更多配置
                <ChevronDown data-icon="inline-end" className={advancedOpen ? "rotate-180" : ""} />
              </Button>
              {advancedOpen ? (
                <FieldGroup id="create-work-advanced">
                  <Field><FieldLabel>短简介</FieldLabel><Textarea aria-label="短简介" value={draft.shortIntro} onChange={(event) => setDraft((value) => ({ ...value, shortIntro: event.target.value }))} placeholder="用于作品卡片展示" /></Field>
                  <Field><FieldLabel>背景与世界规则</FieldLabel><Textarea aria-label="背景与世界规则" value={draft.backgroundRules} onChange={(event) => setDraft((value) => ({ ...value, backgroundRules: event.target.value }))} placeholder="记录世界观、规则或限制" className="min-h-28" /></Field>
                  <Field><FieldLabel>重点要求</FieldLabel><Textarea aria-label="重点要求" value={draft.focusRequirements} onChange={(event) => setDraft((value) => ({ ...value, focusRequirements: event.target.value }))} placeholder="可选" /></Field>
                  <Field><FieldLabel>禁忌要求</FieldLabel><Textarea aria-label="禁忌要求" value={draft.forbiddenRequirements} onChange={(event) => setDraft((value) => ({ ...value, forbiddenRequirements: event.target.value }))} placeholder="可选" /></Field>
                </FieldGroup>
              ) : null}
            </div>
            {formError ? <FieldError>{formError}</FieldError> : null}
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={() => void createWork()} disabled={submitting}>
              {submitting ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
              创建作品
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
