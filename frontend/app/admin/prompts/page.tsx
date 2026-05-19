"use client";

import { Eye, Lightbulb, Plus, Search, Settings2, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ApiError, type PromptCategory, type PromptCategoryInput, type PromptListParams, type WritingPrompt, type WritingPromptDetail, type WritingPromptInput } from "@/api";
import { AdminPage, AdminPagination, StatusBadge } from "../_components";
import { adminClient } from "../admin-utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

// ---- Prompt Form ----

type PromptForm = {
  id?: string;
  title: string;
  description: string;
  detail_prompt: string;
  category_id: string;
  is_active: boolean;
};

const emptyPromptForm: PromptForm = { title: "", description: "", detail_prompt: "", category_id: "", is_active: true };

function promptToForm(p: WritingPrompt | WritingPromptDetail): PromptForm {
  return { id: p.id, title: p.title, description: p.description, detail_prompt: "detail_prompt" in p ? p.detail_prompt : "", category_id: p.category_id, is_active: p.is_active };
}

// ---- Category Form ----

type CategoryForm = {
  id?: string;
  name: string;
  sort_order: string;
  is_active: boolean;
};

const emptyCategoryForm: CategoryForm = { name: "", sort_order: "0", is_active: true };

function categoryToForm(cat: PromptCategory): CategoryForm {
  return { id: cat.id, name: cat.name, sort_order: String(cat.sort_order), is_active: cat.is_active };
}

// ---- Main Page ----

export default function AdminPromptsPage() {
  const client = useMemo(() => adminClient(), []);

  // Prompt state
  const [prompts, setPrompts] = useState<WritingPrompt[]>([]);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptForm, setPromptForm] = useState<PromptForm | null>(null);
  const [deletePromptTarget, setDeletePromptTarget] = useState<WritingPrompt | null>(null);
  const [viewDetailTarget, setViewDetailTarget] = useState<WritingPromptDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Category state (for the management dialog inside prompt form)
  const [categories, setCategories] = useState<PromptCategory[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const [catForm, setCatForm] = useState<CategoryForm | null>(null);
  const [deleteCatTarget, setDeleteCatTarget] = useState<PromptCategory | null>(null);

  // Filters
  const [promptQuery, setPromptQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  // ---- Load categories ----
  async function loadCategories() {
    setCatLoading(true);
    try {
      const data = await client.listAdminPromptCategories({ page: 1, pageSize: 100 });
      setCategories(data.items);
    } catch {
      toast.error("分类列表加载失败");
    } finally {
      setCatLoading(false);
    }
  }

  useEffect(() => { void loadCategories(); }, []);

  // ---- Load prompts ----
  async function loadPrompts(nextPage = page) {
    setPromptLoading(true);
    try {
      const params: PromptListParams = { page: nextPage, pageSize };
      if (promptQuery.trim()) params.q = promptQuery.trim();
      const data = await client.listAdminPrompts(params);
      setPrompts(data.items);
      setTotal(data.total);
      setPage(data.page);
    } catch {
      toast.error("提示词列表加载失败");
      setPrompts([]);
      setTotal(0);
    } finally {
      setPromptLoading(false);
    }
  }

  useEffect(() => { void loadPrompts(1); }, [promptQuery]);

  // ---- Prompt CRUD ----
  async function savePrompt() {
    if (!promptForm) return;
    if (!promptForm.title.trim()) { toast.error("请填写标题"); return; }
    if (!promptForm.description.trim()) { toast.error("请填写简要描述"); return; }
    if (!promptForm.detail_prompt.trim()) { toast.error("请填写详细提示词"); return; }
    if (!promptForm.category_id) { toast.error("请选择分类"); return; }
    try {
      const payload: WritingPromptInput = {
        title: promptForm.title.trim(),
        description: promptForm.description.trim(),
        detail_prompt: promptForm.detail_prompt.trim(),
        category_id: promptForm.category_id,
        is_active: promptForm.is_active,
      };
      if (promptForm.id) await client.updateAdminPrompt(promptForm.id, payload);
      else await client.createAdminPrompt(payload);
      setPromptForm(null);
      await loadPrompts(page);
      await loadCategories();
      toast.success("提示词已保存");
    } catch {
      toast.error("提示词保存失败");
    }
  }

  async function deletePrompt() {
    if (!deletePromptTarget) return;
    try {
      await client.deleteAdminPrompt(deletePromptTarget.id);
      setDeletePromptTarget(null);
      await loadPrompts(page);
      await loadCategories();
      toast.success("提示词已删除");
    } catch {
      toast.error("提示词删除失败");
    }
  }

  async function viewDetail(promptId: string) {
    setDetailLoading(true);
    try {
      const data = await client.getAdminPrompt(promptId);
      setViewDetailTarget(data);
    } catch {
      toast.error("获取详情失败");
    } finally {
      setDetailLoading(false);
    }
  }

  async function generateDescription() {
    if (!promptForm || !promptForm.detail_prompt.trim()) {
      toast.error("请先填写详细提示词");
      return;
    }
    setGenerating(true);
    try {
      const result = await client.generatePromptDescription(promptForm.detail_prompt);
      setPromptForm({ ...promptForm, description: result.description });
      toast.success("描述已生成");
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        toast.error(e.message || "请先在系统配置中完成 AI 描述设置");
      } else {
        toast.error("生成描述失败，请稍后重试");
      }
    } finally {
      setGenerating(false);
    }
  }

  // ---- Category CRUD ----
  async function saveCategory() {
    if (!catForm) return;
    if (!catForm.name.trim()) { toast.error("请填写分类名称"); return; }
    try {
      const payload: PromptCategoryInput = { name: catForm.name.trim(), sort_order: Number(catForm.sort_order) || 0, is_active: catForm.is_active };
      if (catForm.id) await client.updateAdminPromptCategory(catForm.id, payload);
      else await client.createAdminPromptCategory(payload);
      setCatForm(null);
      await loadCategories();
      toast.success("分类已保存");
    } catch {
      toast.error("分类保存失败");
    }
  }

  async function deleteCategory() {
    if (!deleteCatTarget) return;
    try {
      await client.deleteAdminPromptCategory(deleteCatTarget.id);
      setDeleteCatTarget(null);
      await loadCategories();
      // Update selected category in prompt form if needed
      if (promptForm && promptForm.category_id === deleteCatTarget.id) {
        setPromptForm({ ...promptForm, category_id: "" });
      }
      toast.success("分类已删除");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) toast.error("该分类下存在提示词，请先移除");
      else toast.error("分类删除失败");
    } finally {
      setDeleteCatTarget(null);
    }
  }

  return (
    <AdminPage>
      {/* Prompt list section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="h-9 pl-9" value={promptQuery} onChange={(e) => setPromptQuery(e.target.value)} placeholder="搜索标题或描述…" />
          </div>
          <Button size="sm" className="ml-auto gap-1.5" onClick={() => setPromptForm({ ...emptyPromptForm, category_id: categories[0]?.id ?? "" })}>
            <Plus className="size-3.5" />新建提示词
          </Button>
        </div>

        {promptLoading ? (
          <div className="space-y-2"><Skeleton className="h-9 w-full" /><Skeleton className="h-64 w-full" /></div>
        ) : prompts.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 shadow-card">
            <Empty><EmptyHeader>
              <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground"><Lightbulb className="size-4" /></div>
              <EmptyTitle>暂无提示词</EmptyTitle><EmptyDescription>点击「新建提示词」开始。</EmptyDescription>
            </EmptyHeader></Empty>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-muted/50">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">标题</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">描述</TableHead>
                    <TableHead className="w-[100px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">分类</TableHead>
                    <TableHead className="w-[80px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">状态</TableHead>
                    <TableHead className="w-[160px] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prompts.map((p) => {
                    const cat = categories.find((c) => c.id === p.category_id);
                    return (
                      <TableRow key={p.id} className="border-b border-border hover:bg-muted/30">
                        <TableCell className="font-medium text-sm">{p.title}</TableCell>
                        <TableCell className="max-w-[300px]"><p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p></TableCell>
                        <TableCell className="text-xs">{cat?.name ?? "—"}</TableCell>
                        <TableCell><StatusBadge status={p.is_active ? "active" : "inactive"} /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => void viewDetail(p.id)}>
                              <Eye className="size-3" />查看
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { void (async () => { if (!p.id) return; try { const detail = await client.getAdminPrompt(p.id); setPromptForm(promptToForm(detail)); } catch { const base = promptToForm(p); base.detail_prompt = ""; setPromptForm(base); } })(); }}>
                              编辑
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => setDeletePromptTarget(p)}>
                              删除
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <AdminPagination page={page} pageSize={pageSize} total={total} onPageChange={(p) => void loadPrompts(p)} />
          </>
        )}
      </div>

      {/* Prompt Dialog */}
      <Dialog open={promptForm !== null} onOpenChange={(open) => { if (!open) setPromptForm(null); }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{promptForm?.id ? "编辑提示词" : "新建提示词"}</DialogTitle>
            <DialogDescription>{promptForm?.id ? "编辑已有的写作提示词。" : "创建新的写作提示词。"}</DialogDescription>
          </DialogHeader>
          {promptForm && (
            <div className="space-y-4">
              <Field><FieldLabel>标题</FieldLabel><Input value={promptForm.title} onChange={(e) => setPromptForm({ ...promptForm, title: e.target.value })} placeholder="提示词标题" maxLength={100} /></Field>
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel>分类</FieldLabel>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs gap-1" onClick={() => setCatManagerOpen(true)}>
                    <Settings2 className="size-3" />管理分类
                  </Button>
                </div>
                <Select value={promptForm.category_id} onValueChange={(v) => setPromptForm({ ...promptForm, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="选择分类" /></SelectTrigger>
                  <SelectContent><SelectGroup>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectGroup></SelectContent>
                </Select>
              </Field>
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel>简要描述</FieldLabel>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1"
                    disabled={!promptForm.detail_prompt.trim() || generating}
                    onClick={() => void generateDescription()}
                  >
                    <Sparkles className="size-3" />
                    {generating ? "生成中…" : "AI 生成"}
                  </Button>
                </div>
                <Textarea value={promptForm.description} onChange={(e) => setPromptForm({ ...promptForm, description: e.target.value })} placeholder="用于Agent识别和选取，最长500字符" maxLength={500} rows={2} />
              </Field>
              <Field>
                <FieldLabel>详细提示词</FieldLabel>
                <RichTextEditor
                  value={promptForm.detail_prompt}
                  onChange={(v) => setPromptForm({ ...promptForm, detail_prompt: v })}
                  minHeight={300}
                />
              </Field>
              <div className="flex items-center gap-2">
                <Switch checked={promptForm.is_active} onCheckedChange={(v) => setPromptForm({ ...promptForm, is_active: v })} />
                <span className="text-sm">{promptForm.is_active ? "已激活" : "已停用"}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromptForm(null)}>取消</Button>
            <Button onClick={() => void savePrompt()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={catManagerOpen} onOpenChange={(open) => { if (!open) setCatManagerOpen(false); }}>
        <DialogContent className="sm:max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>管理分类</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {catLoading ? (
              <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
            ) : categories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">暂无分类</p>
            ) : (
              <div className="divide-y divide-border">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{cat.name}</span>
                      <span className="text-xs text-muted-foreground">({cat.prompt_count})</span>
                      {!cat.is_active && <StatusBadge status="inactive" />}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCatForm(categoryToForm(cat))}>编辑</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteCatTarget(cat)}>删除</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button size="sm" className="w-full gap-1.5" onClick={() => setCatForm({ ...emptyCategoryForm })}>
              <Plus className="size-3.5" />新建分类
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category inline edit/create Dialog */}
      <Dialog open={catForm !== null} onOpenChange={(open) => { if (!open) setCatForm(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{catForm?.id ? "编辑分类" : "新建分类"}</DialogTitle></DialogHeader>
          {catForm && (
            <div className="space-y-4">
              <Field><FieldLabel>分类名称</FieldLabel><Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="如：玄幻战斗描写" maxLength={100} /></Field>
              <Field><FieldLabel>排序值</FieldLabel><Input type="number" value={catForm.sort_order} onChange={(e) => setCatForm({ ...catForm, sort_order: e.target.value })} /></Field>
              <div className="flex items-center gap-2">
                <Switch checked={catForm.is_active} onCheckedChange={(v) => setCatForm({ ...catForm, is_active: v })} />
                <span className="text-sm">{catForm.is_active ? "已激活" : "已停用"}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatForm(null)}>取消</Button>
            <Button onClick={() => void saveCategory()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Detail Dialog */}
      <Dialog open={viewDetailTarget !== null} onOpenChange={(open) => { if (!open) setViewDetailTarget(null); }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewDetailTarget?.title ?? "提示词详情"}</DialogTitle></DialogHeader>
          {detailLoading ? (
            <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-32 w-full" /></div>
          ) : viewDetailTarget ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">简要描述</p>
                <p className="text-sm">{viewDetailTarget.description}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">详细提示词</p>
                <div className="rounded-lg border border-border bg-card p-4">
                  <pre className="whitespace-pre-wrap text-sm font-mono">{viewDetailTarget.detail_prompt}</pre>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter><Button variant="outline" onClick={() => setViewDetailTarget(null)}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation */}
      <AlertDialog open={deleteCatTarget !== null} onOpenChange={(open) => { if (!open) setDeleteCatTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除分类</AlertDialogTitle>
            <AlertDialogDescription>确定要删除分类「{deleteCatTarget?.name}」吗？如果该分类下存在提示词，需要先移除。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteCategory()}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Prompt Confirmation */}
      <AlertDialog open={deletePromptTarget !== null} onOpenChange={(open) => { if (!open) setDeletePromptTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除提示词</AlertDialogTitle>
            <AlertDialogDescription>确定要删除提示词「{deletePromptTarget?.title}」吗？此操作不可恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deletePrompt()}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
}
