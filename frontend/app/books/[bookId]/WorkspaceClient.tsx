"use client";

import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronLeft,
  Clock3,
  Cloud,
  CloudOff,
  Copy,
  Crown,
  Database,
  Edit3,
  History,
  Loader2,
  MessageSquare,
  MoreVertical,
  Plus,
  Save,
  Search,
  Settings,
  Trash2,
  Users,
  Wand2,
  X,
  Zap
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGroupRef, usePanelRef, type Layout } from "react-resizable-panels";
import {
  ApiClient,
  ApiError,
  type AiModelOption,
  type ApiSuggestion,
  type BillingOrder,
  type BillingProducts,
  type ChatMention,
  type ChatMessage,
  type ChatReference,
  type ChatSession,
  type NamedContent,
  type UserProfile,
} from "@/api";
import { userLoginPath } from "@/auth";
import { ChapterPlainTextEditor } from "@/components/ChapterPlainTextEditor";
import { ChatMentionInput, type ChatMentionInputHandle } from "@/components/ChatMentionInput";
import { ModelPicker } from "@/components/ModelPicker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatToken } from "@/lib/format";
import { applySuggestion, type Chapter, type Work, wordCount } from "@/domain";

type WorkspaceClientProps = {
  bookId: string;
};

type SaveStatus = "loading" | "dirty" | "saving" | "saved" | "offline" | "error" | "analyzing" | "analyzed";
type WorkspaceTab = "chapters" | "characters" | "settings";
type CharacterMode = "detail" | "create" | "edit";
type CharacterStatus = "ready" | "saving" | "deleting" | "error";
type CharacterDraft = { name: string; summary: string; detail: string };
type SettingMode = "detail" | "create" | "edit";
type SettingStatus = "ready" | "saving" | "deleting" | "error";
type SettingDraft = { name: string; summary: string; detail: string; type: string };
const RECENT_REF_KEY = "jfxz-recent-references";
const CHAT_MODEL_KEY = "jfxz-chat-model";
const WORKSPACE_LAYOUT_PANEL_IDS = ["workspace-sidebar", "workspace-editor", "workspace-chat"] as const;
const testPaymentEnabled = process.env.NEXT_PUBLIC_ENABLE_TEST_PAYMENT === "true";
const quickPrompts = ["帮我构思后续情节", "帮我补充作品信息"];
const settingTypes = [
  { value: "all", label: "全部设定" },
  { value: "location", label: "地点" },
  { value: "equipment", label: "装备" },
  { value: "attribute", label: "属性" },
  { value: "rule", label: "规则" },
  { value: "organization", label: "组织" },
  { value: "other", label: "其他" }
];

function formatStatus(status: SaveStatus): { label: string; tone: "success" | "muted" | "warning"; icon: typeof Check } {
  if (status === "saving") return { label: "正在保存...", tone: "muted", icon: Loader2 };
  if (status === "dirty") return { label: "编辑中", tone: "warning", icon: Clock3 };
  if (status === "loading") return { label: "加载中", tone: "muted", icon: Loader2 };
  if (status === "analyzing") return { label: "AI 分析中", tone: "muted", icon: Loader2 };
  if (status === "analyzed") return { label: "分析完成", tone: "success", icon: Check };
  if (status === "offline") return { label: "离线保存", tone: "warning", icon: CloudOff };
  if (status === "error") return { label: "保存失败", tone: "warning", icon: AlertCircle };
  return { label: "已保存到云端", tone: "success", icon: Cloud };
}

function reorderChapters(items: Chapter[]): Chapter[] {
  return items.map((chapter, index) => ({ ...chapter, order: index + 1 }));
}

function referenceKey(ref: Pick<ChatReference, "type" | "id">): string {
  return `${ref.type}:${ref.id}`;
}

function dedupeReferences(items: ChatReference[]): ChatReference[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = referenceKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function workspaceLayoutKey(bookId: string): string {
  return `jfxz-workspace-layout:v1:${bookId}`;
}

function chatModelKey(bookId: string): string {
  return `${CHAT_MODEL_KEY}:${bookId}`;
}

function parseWorkspaceLayout(value: string | null): Layout | undefined {
  if (!value) return undefined;
  try {
    const layout = JSON.parse(value) as Partial<Record<(typeof WORKSPACE_LAYOUT_PANEL_IDS)[number], unknown>>;
    const valid = WORKSPACE_LAYOUT_PANEL_IDS.every((id) => typeof layout[id] === "number" && Number.isFinite(layout[id]));
    return valid ? (layout as Layout) : undefined;
  } catch {
    return undefined;
  }
}

function readWorkspaceLayout(bookId: string): Layout | undefined {
  if (typeof window === "undefined") return undefined;
  return parseWorkspaceLayout(window.localStorage.getItem(workspaceLayoutKey(bookId)));
}

function truncate(value: string, length = 120): string {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function formatUpdatedAt(value: string): string {
  if (!value) return "暂无更新时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}


const TOOL_LABELS: Record<string, string> = {
  get_character: "查询角色",
  list_characters: "列出角色",
  create_or_update_character: "创建角色",
  get_setting: "查询设定",
  list_settings: "列出设定",
  create_or_update_setting: "创建设定",
  get_chapter: "查询章节",
  list_chapters: "列出章节",
  update_chapter_summary: "更新提要",
  get_work_info: "查看作品",
  update_work_info: "更新作品",
};

function toolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

function referenceTone(type: ChatReference["type"]): string {
  if (type === "setting") return "border-border bg-muted text-foreground";
  if (type === "character") return "border-border bg-muted text-foreground";
  if (type === "suggestion") return "border-border bg-muted text-foreground";
  return "border-border bg-muted text-muted-foreground";
}

function apiErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "请求失败，请稍后重试";
  if (error.status === 402) return "积分不足，暂时无法检测";
  if (error.status === 503) return "AI 检测暂未配置";
  if (error.status === 502) return "AI 检测结果解析失败，请重试";
  return "AI 检测失败，请稍后重试";
}

export default function WorkspaceClient({ bookId }: WorkspaceClientProps) {
  const router = useRouter();
  const client = useMemo(() => new ApiClient(), []);
  const chatInputRef = useRef<ChatMentionInputHandle | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const workspaceGroupRef = useGroupRef();
  const workspaceSidebarRef = usePanelRef();
  const workspaceEditorRef = usePanelRef();
  const workspaceChatRef = usePanelRef();
  const workspaceLayoutReadyRef = useRef(false);
  const bootstrapStartedRef = useRef<string | null>(null);
  const [work, setWork] = useState<Work | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [characters, setCharacters] = useState<NamedContent[]>([]);
  const [settings, setSettings] = useState<NamedContent[]>([]);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("chapters");
  const [activeChapterId, setActiveChapterId] = useState("");
  const activeChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === activeChapterId) ?? chapters[0],
    [activeChapterId, chapters]
  );

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");
  const [content, setContent] = useState("");
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [suggestions, setSuggestions] = useState<ApiSuggestion[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null);
  const [analysisNotice, setAnalysisNotice] = useState("");
  const [status, setStatus] = useState<SaveStatus>("loading");

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatStatus, setChatStatus] = useState<"loading" | "ready" | "streaming" | "error" | "no_points" | "idle">("loading");
  const [showHistory, setShowHistory] = useState(false);
  const [pendingReferences, setPendingReferences] = useState<ChatReference[]>([]);
  const [chatMentions, setChatMentions] = useState<ChatMention[]>([]);
  const [recentReferences, setRecentReferences] = useState<ChatReference[]>([]);
  const [aiModels, setAiModels] = useState<AiModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [modelStatus, setModelStatus] = useState<"loading" | "ready" | "error">("loading");

  const [activeToolCalls, setActiveToolCalls] = useState<string[]>([]);
  const [toolResults, setToolResults] = useState<{ tool: string; display: string; result: string }[]>([]);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  const [characterSearch, setCharacterSearch] = useState("");
  const [activeCharacterId, setActiveCharacterId] = useState("");
  const [characterMode, setCharacterMode] = useState<CharacterMode>("detail");
  const [characterDraft, setCharacterDraft] = useState<CharacterDraft>({ name: "", summary: "", detail: "" });
  const [characterStatus, setCharacterStatus] = useState<CharacterStatus>("ready");
  const [characterError, setCharacterError] = useState("");
  const [characterDeleteConfirm, setCharacterDeleteConfirm] = useState(false);
  const [copyNotice, setCopyNotice] = useState("");
  const [chapterDeleteOpen, setChapterDeleteOpen] = useState(false);

  const [settingSearch, setSettingSearch] = useState("");
  const [settingType, setSettingType] = useState("all");
  const [activeSettingId, setActiveSettingId] = useState("");
  const [settingMode, setSettingMode] = useState<SettingMode>("detail");
  const [settingDraft, setSettingDraft] = useState<SettingDraft>({ name: "", summary: "", detail: "", type: "other" });
  const [settingStatus, setSettingStatus] = useState<SettingStatus>("ready");
  const [settingError, setSettingError] = useState("");
  const [settingDeleteConfirm, setSettingDeleteConfirm] = useState(false);

  const [accountOpen, setAccountOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [accountStatus, setAccountStatus] = useState<"idle" | "loading" | "saving" | "error">("idle");
  const [billingOpen, setBillingOpen] = useState(false);
  const [billingProducts, setBillingProducts] = useState<BillingProducts>({ plans: [], creditPacks: [] });
  const [billingOrder, setBillingOrder] = useState<BillingOrder | null>(null);
  const [billingStatus, setBillingStatus] = useState<"idle" | "loading" | "creating" | "paid" | "error">("idle");
  const [workspaceDefaultLayout, setWorkspaceDefaultLayout] = useState<Layout | undefined>(() => readWorkspaceLayout(bookId));
  const [workspaceLayoutLoaded, setWorkspaceLayoutLoaded] = useState(false);

  const count = useMemo(() => wordCount(content), [content]);
  const todayCount = useMemo(() => chapters.reduce((sum, chapter) => sum + wordCount(chapter.content), 0), [chapters]);
  const statusMeta = formatStatus(status);
  const StatusIcon = statusMeta.icon;
  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const selectedModel = aiModels.find((model) => model.id === selectedModelId);
  const activeCharacter = useMemo(
    () => characters.find((item) => item.id === activeCharacterId) ?? characters[0],
    [activeCharacterId, characters]
  );
  const filteredCharacters = useMemo(() => {
    const query = characterSearch.trim().toLowerCase();
    if (!query) return characters;
    return characters.filter(
      (item) => item.name.toLowerCase().includes(query) || item.summary.toLowerCase().includes(query)
    );
  }, [characterSearch, characters]);
  const activeSetting = useMemo(
    () => settings.find((item) => item.id === activeSettingId) ?? settings[0],
    [activeSettingId, settings]
  );
  const filteredSettings = useMemo(() => {
    const query = settingSearch.trim().toLowerCase();
    return settings.filter((item) => {
      const matchesQuery =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query) ||
        item.detail.toLowerCase().includes(query);
      const matchesType = settingType === "all" || (item.type ?? "other") === settingType;
      return matchesQuery && matchesType;
    });
  }, [settingSearch, settingType, settings]);

  const allReferenceItems = useMemo<ChatReference[]>(() => {
    const chapterRefs = chapters
      .slice()
      .reverse()
      .map((chapter) => ({
        type: "chapter" as const,
        id: chapter.id,
        name: chapter.title,
        summary: chapter.summary || `第 ${chapter.order} 章`
      }));
    const characterRefs = characters.map((item) => ({
      type: "character" as const,
      id: item.id,
      name: item.name,
      summary: item.summary
    }));
    const settingRefs = settings.map((item) => ({
      type: "setting" as const,
      id: item.id,
      name: item.name,
      summary: item.summary
    }));
    return [...chapterRefs, ...characterRefs, ...settingRefs];
  }, [chapters, characters, settings]);

  const moduleMeta = {
    chapters: { title: "章节目录", count: `${chapters.length} 章 · 共 ${todayCount} 字` },
    characters: { title: "角色管理", count: `${characters.length} 个角色` },
    settings: { title: "设定资料", count: `${settings.length} 条设定` }
  }[activeTab];

  const clearAnalysis = useCallback(() => {
    setSuggestions([]);
    setActiveSuggestionIndex(null);
    setOverlay(false);
    setAnalysisNotice("");
  }, []);

  const syncDraft = useCallback((chapter: Chapter | undefined) => {
    setTitle(chapter?.title ?? "");
    setSummary(chapter?.summary ?? "");
    setSummaryDraft(chapter?.summary ?? "");
    setContent(chapter?.content ?? "");
    setSuggestions([]);
    setActiveSuggestionIndex(null);
    setOverlay(false);
    setAnalysisNotice("");
  }, []);

  const loadMessages = useCallback(
    async (sessionId: string) => {
      setChatStatus("loading");
      try {
        const page = await client.listChatMessages(sessionId, 30);
        setMessages(page.messages);
        setHasMoreMessages(page.hasMore);
        setNextBefore(page.nextBefore);
        setChatStatus("ready");
      } catch {
        setChatStatus("error");
      }
    },
    [client]
  );

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`${RECENT_REF_KEY}:${bookId}`);
      if (saved) {
        setRecentReferences(JSON.parse(saved));
      }
    } catch {
      window.localStorage.removeItem(`${RECENT_REF_KEY}:${bookId}`);
    }
  }, [bookId]);

  useEffect(() => {
    let active = true;
    setModelStatus("loading");
    client
      .listAiModels()
      .then((models) => {
        if (!active) return;
        const saved = window.localStorage.getItem(chatModelKey(bookId));
        const nextModelId = models.find((model) => model.id === saved)?.id ?? models[0]?.id ?? "";
        setAiModels(models);
        setSelectedModelId(nextModelId);
        if (saved && !models.find((model) => model.id === saved)) {
          window.localStorage.removeItem(chatModelKey(bookId));
        }
        if (nextModelId) {
          window.localStorage.setItem(chatModelKey(bookId), nextModelId);
        }
        setModelStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setAiModels([]);
        setSelectedModelId("");
        setModelStatus("error");
      });
    return () => {
      active = false;
    };
  }, [bookId, client]);

  useEffect(() => {
    workspaceLayoutReadyRef.current = false;
    setWorkspaceLayoutLoaded(false);
    const savedLayout = readWorkspaceLayout(bookId);
    setWorkspaceDefaultLayout(savedLayout);
    setWorkspaceLayoutLoaded(true);
    const timer = window.setTimeout(() => {
      if (savedLayout) {
        workspaceGroupRef.current?.setLayout(savedLayout);
        workspaceSidebarRef.current?.resize(`${savedLayout["workspace-sidebar"]}%`);
        workspaceEditorRef.current?.resize(`${savedLayout["workspace-editor"]}%`);
        workspaceChatRef.current?.resize(`${savedLayout["workspace-chat"]}%`);
      }
      workspaceLayoutReadyRef.current = true;
    }, 100);
    return () => window.clearTimeout(timer);
  }, [bookId, workspaceChatRef, workspaceEditorRef, workspaceGroupRef, workspaceSidebarRef]);

  const saveWorkspaceLayout = useCallback(
    (layout: Layout) => {
      if (!workspaceLayoutReadyRef.current) return;
      const serializableLayout = layout instanceof Map ? Object.fromEntries(layout) : layout;
      window.localStorage.setItem(workspaceLayoutKey(bookId), JSON.stringify(serializableLayout));
    },
    [bookId]
  );

  useEffect(() => {
    async function loadWorkspace() {
      if (bootstrapStartedRef.current === bookId) {
        return;
      }
      bootstrapStartedRef.current = bookId;
      setStatus("loading");
      setChatStatus("loading");
      try {
        const bootstrap = await client.getWorkspaceBootstrap(bookId);
        setWork(bootstrap.work);
        setCharacters(bootstrap.characters);
        setActiveCharacterId(bootstrap.characters[0]?.id ?? "");
        setSettings(bootstrap.settings);
        setActiveSettingId(bootstrap.settings[0]?.id ?? "");
        setProfile(bootstrap.profile);
        setNicknameDraft(bootstrap.profile.user.nickname);
        const loadedChapters = bootstrap.chapters;
        if (loadedChapters.length) {
          setChapters(loadedChapters);
          setActiveChapterId(loadedChapters[0].id);
          syncDraft(loadedChapters[0]);
        }

        setSessions(bootstrap.sessions.length ? bootstrap.sessions : [bootstrap.activeSession]);
        setActiveSessionId(bootstrap.activeSession.id);
        setMessages(bootstrap.messages.messages);
        setHasMoreMessages(bootstrap.messages.hasMore);
        setNextBefore(bootstrap.messages.nextBefore);
        setChatStatus("ready");
        setStatus("saved");
      } catch (error) {
        bootstrapStartedRef.current = null;
        if (error instanceof ApiError && error.status === 401) {
          router.replace(userLoginPath(`/books/${bookId}`));
          return;
        }
        setStatus("offline");
        setChatStatus("error");
      }
    }

    void loadWorkspace();
  }, [bookId, client, router, syncDraft]);

  const saveCurrentChapter = useCallback(
    async (overrides: Partial<Pick<Chapter, "title" | "summary" | "content">> = {}) => {
      if (!activeChapter) return null;
      const nextChapter: Chapter = {
        ...activeChapter,
        title: (overrides.title ?? title).trim() || "未命名章节",
        summary: overrides.summary ?? summary,
        content: overrides.content ?? content
      };
      setStatus("saving");
      setChapters((items) => items.map((chapter) => (chapter.id === nextChapter.id ? nextChapter : chapter)));
      if (nextChapter.id.startsWith("local-")) {
        const created = await client.createChapter(bookId, {
          title: nextChapter.title,
          summary: nextChapter.summary,
          content: nextChapter.content,
          order: nextChapter.order
        });
        setChapters((items) => items.map((chapter) => (chapter.id === nextChapter.id ? created : chapter)));
        setActiveChapterId(created.id);
        setTitle(created.title);
        setStatus("saved");
        return created;
      }
      try {
        const savedChapter = await client.updateChapter(bookId, nextChapter);
        setChapters((items) => items.map((chapter) => (chapter.id === savedChapter.id ? savedChapter : chapter)));
        setTitle(savedChapter.title);
        setStatus("saved");
        return savedChapter;
      } catch (error) {
        setStatus("error");
        throw error;
      }
    },
    [activeChapter, bookId, client, content, summary, title]
  );

  useEffect(() => {
    if (!activeChapter) return;
    const unchanged =
      activeChapter.title === title && activeChapter.summary === summary && activeChapter.content === content;
    if (unchanged) return;

    setStatus("dirty");
    const timer = window.setTimeout(() => {
      void saveCurrentChapter().catch(() => undefined);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [activeChapter, content, saveCurrentChapter, summary, title]);

  function persistRecentReferences(items: ChatReference[]) {
    setRecentReferences(items);
    window.localStorage.setItem(`${RECENT_REF_KEY}:${bookId}`, JSON.stringify(items));
  }

  function rememberReferences(items: ChatReference[]) {
    const next = dedupeReferences([...items, ...recentReferences]).slice(0, 3);
    persistRecentReferences(next);
  }

  function explicitReferences(message: string): ChatReference[] {
    return allReferenceItems.filter((ref) => message.includes(`@${ref.name}`));
  }

  function mentionReferences(mentions: ChatMention[]): ChatReference[] {
    return mentions.map((mention) => {
      const item = allReferenceItems.find((ref) => ref.type === mention.type && ref.id === mention.id);
      return {
        type: mention.type,
        id: mention.id,
        name: item?.name ?? mention.label,
        summary: item?.summary
      };
    });
  }

  function clearChatDraft() {
    setChatInput("");
    setChatMentions([]);
    setPendingReferences([]);
    chatInputRef.current?.clear();
  }

  function updateContent(value: string) {
    setContent(value);
    if (suggestions.length || overlay || analysisNotice) {
      clearAnalysis();
    }
  }

  async function selectChapter(chapterId: string) {
    if (chapterId === activeChapterId) return;
    const next = chapters.find((chapter) => chapter.id === chapterId) ?? chapters[0];
    if (!next) return;
    try {
      await saveCurrentChapter();
    } catch {
      setAnalysisNotice("当前章节保存失败，暂未切换章节");
      return;
    }
    setActiveChapterId(next.id);
    syncDraft(next);
  }

  async function createChapter() {
    try {
      await saveCurrentChapter();
    } catch {
      setAnalysisNotice("当前章节保存失败，暂未新建章节");
      return;
    }
    const draft: Chapter = {
      id: `local-${Date.now()}`,
      order: chapters.length + 1,
      title: `第 ${chapters.length + 1} 章 未命名章节`,
      summary: "",
      content: ""
    };
    setStatus("saving");
    try {
      const created = await client.createChapter(bookId, {
        title: draft.title,
        summary: draft.summary,
        content: draft.content,
        order: draft.order
      });
      setChapters((items) => [...items, created]);
      setActiveChapterId(created.id);
      syncDraft(created);
      setStatus("saved");
    } catch {
      setStatus("error");
      setAnalysisNotice("新建章节失败，请稍后重试");
    }
  }

  async function deleteActiveChapter() {
    if (!activeChapter) return;
    try {
      await saveCurrentChapter();
    } catch {
      setAnalysisNotice("当前章节保存失败，暂未删除章节");
      return;
    }
    setStatus("saving");
    try {
      if (!activeChapter.id.startsWith("local-")) {
        await client.deleteChapter(bookId, activeChapter.id);
      }
      const remaining = reorderChapters(chapters.filter((chapter) => chapter.id !== activeChapter.id));
      const nextChapter = remaining.find((chapter) => chapter.order >= activeChapter.order) ?? remaining.at(-1);
      setChapters(remaining);
      setActiveChapterId(nextChapter?.id ?? "");
      syncDraft(nextChapter);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  async function analyze() {
    if (!content.trim()) {
      setSuggestions([]);
      setActiveSuggestionIndex(null);
      setOverlay(false);
      setAnalysisNotice("当前章节暂无正文，无法检测");
      setStatus("analyzed");
      return;
    }
    setStatus("analyzing");
    setAnalysisNotice("");
    try {
      await saveCurrentChapter();
      setStatus("analyzing");
      const nextSuggestions = await client.analyzeChapter(bookId, content);
      setSuggestions(nextSuggestions);
      setActiveSuggestionIndex(null);
      setOverlay(false);
      setAnalysisNotice(nextSuggestions.length ? `发现 ${nextSuggestions.length} 处可检查内容` : "未发现明显问题");
      setStatus("analyzed");
    } catch (error) {
      setSuggestions([]);
      setActiveSuggestionIndex(null);
      setOverlay(false);
      setAnalysisNotice(apiErrorMessage(error));
      setStatus("error");
    }
  }

  function openSummaryModal() {
    setSummaryDraft(summary);
    setSummaryModalOpen(true);
  }

  async function saveSummary() {
    try {
      await saveCurrentChapter({ summary: summaryDraft });
      setSummary(summaryDraft);
      setSummaryModalOpen(false);
    } catch {
      setAnalysisNotice("章节提要保存失败，请稍后重试");
    }
  }

  async function acceptSuggestion(index = activeSuggestionIndex) {
    const suggestion = index === null ? null : suggestions[index];
    const nextReplacement = suggestion?.options[0] ?? "";
    if (!suggestion || !nextReplacement) return;
    const nextContent = applySuggestion(content, { quote: suggestion.quote, replacement: nextReplacement });
    setContent(nextContent);
    clearAnalysis();
    setOverlay(false);
    try {
      await saveCurrentChapter({ content: nextContent });
    } catch {
      setAnalysisNotice("建议已替换，但保存失败，请稍后重试");
    }
  }

  function sendSuggestionToChat(index = activeSuggestionIndex) {
    const suggestion = index === null ? null : suggestions[index];
    if (!suggestion) return;
    const nextReplacement = suggestion.options[0] ?? "";
    const ref: ChatReference = {
      type: "suggestion",
      id: `suggestion-${Date.now()}`,
      name: "AI 建议",
      summary: suggestion.issue,
      quote: suggestion.quote,
      issue: suggestion.issue,
      replacement: nextReplacement
    };
    setPendingReferences([ref]);
    setOverlay(false);
    const nextInput = `针对这段建议，我们再讨论一下其他处理方式：${nextReplacement}`;
    setChatInput(nextInput);
    setChatMentions([]);
    window.setTimeout(() => chatInputRef.current?.setText(nextInput), 0);
  }

  async function createSession() {
    setChatStatus("loading");
    try {
      const session = await client.createChatSession(bookId);
      setSessions((items) => [session, ...items]);
      setActiveSessionId(session.id);
      setMessages([]);
      setHasMoreMessages(false);
      setNextBefore(null);
      setShowHistory(false);
      clearChatDraft();
      setChatStatus("ready");
    } catch {
      setChatStatus("error");
    }
  }

  async function switchSession(sessionId: string) {
    if (sessionId === activeSessionId) {
      setShowHistory(false);
      return;
    }
    setActiveSessionId(sessionId);
    setShowHistory(false);
    clearChatDraft();
    try {
      await loadMessages(sessionId);
    } catch {
      setChatStatus("error");
    }
  }

  async function loadOlderMessages() {
    if (!activeSessionId || !hasMoreMessages || !nextBefore) return;
    const page = await client.listChatMessages(activeSessionId, 20, nextBefore);
    setMessages((items) => [...page.messages, ...items]);
    setHasMoreMessages(page.hasMore);
    setNextBefore(page.nextBefore);
  }

  function selectChatModel(modelId: string) {
    if (modelId === "__none") return;
    setSelectedModelId(modelId);
    window.localStorage.setItem(chatModelKey(bookId), modelId);
  }

  async function sendMessage() {
    const message = chatInput;
    if (!message.trim() || !selectedModelId) return;
    if (chatStatus === "streaming") {
      abortRef.current?.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    let sessionId = activeSessionId;
    if (!sessionId) {
      const session = await client.createChatSession(bookId);
      setSessions((items) => [session, ...items]);
      setActiveSessionId(session.id);
      sessionId = session.id;
    }
    const references = dedupeReferences([...pendingReferences, ...mentionReferences(chatMentions), ...explicitReferences(message)]);
    rememberReferences(references);
    const userMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: message,
      mentions: chatMentions,
      references,
      actions: [],
      createdAt: new Date().toISOString()
    };
    const assistantId = `local-assistant-${Date.now()}`;
    setStreamingMessageId(assistantId);
    const assistantDraft: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      mentions: [],
      references,
      actions: [],
      createdAt: new Date().toISOString()
    };
    setMessages((items) => [...items, userMessage, assistantDraft]);
    clearChatDraft();
    setChatStatus("streaming");
    window.setTimeout(() => chatInputRef.current?.focus(), 0);
    try {
      const final = await client.streamChatMessage(
        sessionId,
        message,
        references,
        chatMentions,
        (chunk) => {
          setMessages((items) =>
            items.map((item) => (item.id === assistantId ? { ...item, content: `${item.content}${chunk}` } : item))
          );
        },
        selectedModelId,
        (tool, status, data) => {
          if (status === "started") {
            setActiveToolCalls((prev) => prev.includes(tool) ? prev : [...prev, tool]);
          } else {
            setActiveToolCalls((prev) => prev.filter((t) => t !== tool));
            if (data) {
              setToolResults((prev) => [...prev, { tool, display: data.display ?? toolLabel(tool), result: data.result ?? "" }]);
            }
          }
        },
        (errorMessage) => {
          setMessages((items) =>
            items.map((item) => (item.id === assistantId ? { ...item, error: errorMessage } : item))
          );
        },
        controller.signal
      );
      setMessages((items) => items.map((item) => (item.id === assistantId ? final : item)));
      setSessions((items) =>
        items.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                title: session.title === "新的对话" ? truncate(message, 24) : session.title,
                lastMessagePreview: final.content,
                lastActiveAt: final.createdAt
              }
            : session
        )
      );
      setChatStatus("ready");
      setStreamingMessageId(null);
      setActiveToolCalls([]);
      setToolResults([]);
    } catch (error) {
      setStreamingMessageId(null);
      setActiveToolCalls([]);
      setToolResults([]);
      if (error instanceof DOMException && error.name === "AbortError") {
        setChatStatus("idle");
        return;
      }
      setChatStatus(error instanceof ApiError && error.status === 402 ? "no_points" : "error");
    }
  }

  function selectCharacter(item: NamedContent) {
    setActiveCharacterId(item.id);
    setCharacterMode("detail");
    setCharacterStatus("ready");
    setCharacterError("");
    setCharacterDeleteConfirm(false);
  }

  function startCreateCharacter() {
    setActiveTab("characters");
    setCharacterDraft({ name: "", summary: "", detail: "" });
    setCharacterMode("create");
    setCharacterStatus("ready");
    setCharacterError("");
    setCharacterDeleteConfirm(false);
  }

  function startEditCharacter() {
    if (!activeCharacter) return;
    setCharacterDraft({
      name: activeCharacter.name,
      summary: activeCharacter.summary,
      detail: activeCharacter.detail
    });
    setCharacterMode("edit");
    setCharacterStatus("ready");
    setCharacterError("");
    setCharacterDeleteConfirm(false);
  }

  async function saveCharacter() {
    const name = characterDraft.name.trim();
    const draftSummary = characterDraft.summary.trim();
    const detail = characterDraft.detail.trim();
    if (!name || !draftSummary) {
      setCharacterStatus("error");
      setCharacterError("角色名称和简介不能为空");
      return;
    }

    setCharacterStatus("saving");
    setCharacterError("");
    try {
      if (characterMode === "create") {
        const created = await client.createCharacter(bookId, { name, summary: draftSummary, detail });
        setCharacters((items) => [created, ...items]);
        setActiveCharacterId(created.id);
      } else if (activeCharacter) {
        const updated = await client.updateCharacter(bookId, { id: activeCharacter.id, name, summary: draftSummary, detail });
        setCharacters((items) => items.map((item) => (item.id === updated.id ? updated : item)));
        setActiveCharacterId(updated.id);
      }
      setCharacterMode("detail");
      setCharacterStatus("ready");
    } catch {
      setCharacterStatus("error");
      setCharacterError("保存失败，请稍后重试");
    }
  }

  async function deleteCharacter() {
    if (!activeCharacter) return;
    if (!characterDeleteConfirm) {
      setCharacterDeleteConfirm(true);
      return;
    }

    setCharacterStatus("deleting");
    setCharacterError("");
    try {
      await client.deleteCharacter(bookId, activeCharacter.id);
      const remaining = characters.filter((item) => item.id !== activeCharacter.id);
      setCharacters(remaining);
      setActiveCharacterId(remaining[0]?.id ?? "");
      setCharacterMode("detail");
      setCharacterDeleteConfirm(false);
      setCharacterStatus("ready");
    } catch {
      setCharacterStatus("error");
      setCharacterError("删除失败，请稍后重试");
    }
  }

  async function copyCharacterText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyNotice(`已复制${label}`);
      window.setTimeout(() => setCopyNotice(""), 1600);
    } catch {
      setCopyNotice("复制失败");
    }
  }

  function selectSetting(item: NamedContent) {
    setActiveSettingId(item.id);
    setSettingMode("detail");
    setSettingStatus("ready");
    setSettingError("");
    setSettingDeleteConfirm(false);
  }

  function startCreateSetting() {
    setActiveTab("settings");
    setSettingDraft({ name: "", summary: "", detail: "", type: "other" });
    setSettingMode("create");
    setSettingStatus("ready");
    setSettingError("");
    setSettingDeleteConfirm(false);
  }

  function startEditSetting() {
    if (!activeSetting) return;
    setSettingDraft({
      name: activeSetting.name,
      summary: activeSetting.summary,
      detail: activeSetting.detail,
      type: activeSetting.type ?? "other"
    });
    setSettingMode("edit");
    setSettingStatus("ready");
    setSettingError("");
    setSettingDeleteConfirm(false);
  }

  async function saveSetting() {
    const name = settingDraft.name.trim();
    const draftSummary = settingDraft.summary.trim();
    const detail = settingDraft.detail.trim();
    const type = settingDraft.type || "other";
    if (!name || !draftSummary) {
      setSettingStatus("error");
      setSettingError("设定名称和简介不能为空");
      return;
    }

    setSettingStatus("saving");
    setSettingError("");
    try {
      if (settingMode === "create") {
        const created = await client.createSetting(bookId, { name, summary: draftSummary, detail, type });
        setSettings((items) => [created, ...items]);
        setActiveSettingId(created.id);
      } else if (activeSetting) {
        const updated = await client.updateSetting(bookId, { id: activeSetting.id, name, summary: draftSummary, detail, type });
        setSettings((items) => items.map((item) => (item.id === updated.id ? updated : item)));
        setActiveSettingId(updated.id);
      }
      setSettingMode("detail");
      setSettingStatus("ready");
    } catch {
      setSettingStatus("error");
      setSettingError("保存失败，请稍后重试");
    }
  }

  async function deleteSetting() {
    if (!activeSetting) return;
    if (!settingDeleteConfirm) {
      setSettingDeleteConfirm(true);
      return;
    }
    setSettingStatus("deleting");
    setSettingError("");
    try {
      await client.deleteSetting(bookId, activeSetting.id);
      const remaining = settings.filter((item) => item.id !== activeSetting.id);
      setSettings(remaining);
      setActiveSettingId(remaining[0]?.id ?? "");
      setSettingMode("detail");
      setSettingDeleteConfirm(false);
      setSettingStatus("ready");
    } catch {
      setSettingStatus("error");
      setSettingError("删除失败，请稍后重试");
    }
  }

  async function copySettingText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyNotice(`已复制${label}`);
      window.setTimeout(() => setCopyNotice(""), 1600);
    } catch {
      setCopyNotice("复制失败");
    }
  }

  async function openAccount() {
    setAccountOpen(true);
    if (profile) return;
    setAccountStatus("loading");
    try {
      const nextProfile = await client.getMe();
      setProfile(nextProfile);
      setNicknameDraft(nextProfile.user.nickname);
      setAccountStatus("idle");
    } catch {
      setAccountStatus("error");
    }
  }

  async function saveNickname() {
    if (!nicknameDraft.trim()) return;
    setAccountStatus("saving");
    try {
      const user = await client.updateMe(nicknameDraft.trim());
      setProfile((value) => (value ? { ...value, user } : value));
      setAccountStatus("idle");
    } catch {
      setAccountStatus("error");
    }
  }

  async function openBilling() {
    setBillingOpen(true);
    setBillingStatus("loading");
    try {
      setBillingProducts(await client.listBillingProducts());
      setBillingStatus("idle");
    } catch {
      setBillingStatus("error");
    }
  }

  async function createOrder(productType: "plan" | "credit_pack", productId: string) {
    setBillingStatus("creating");
    try {
      setBillingOrder(await client.createBillingOrder(productType, productId));
      setBillingStatus("idle");
    } catch {
      setBillingStatus("error");
    }
  }

  async function simulateOrderPaid() {
    if (!billingOrder) return;
    setBillingStatus("creating");
    try {
      const paidOrder = await client.simulatePaid(billingOrder.id);
      const nextProfile = await client.getMe();
      setBillingOrder(paidOrder);
      setProfile(nextProfile);
      setNicknameDraft(nextProfile.user.nickname);
      setBillingStatus("paid");
    } catch {
      setBillingStatus("error");
    }
  }

  function renderMessageContent(message: ChatMessage) {
    const mentions = message.mentions
      .filter((mention) => mention.start >= 0 && mention.end > mention.start && mention.end <= message.content.length)
      .sort((left, right) => left.start - right.start);
    if (!mentions.length) return <p>{message.content}</p>;
    let cursor = 0;
    return (
      <p>
        {mentions.flatMap((mention, index) => {
          const nodes = [];
          if (mention.start > cursor) {
            nodes.push(<span key={`text-${index}`}>{message.content.slice(cursor, mention.start)}</span>);
          }
          nodes.push(
            <span key={`mention-${index}`} className={cn("mx-0.5 rounded border px-1.5 py-0.5 text-xs", referenceTone(mention.type))}>
              {message.content.slice(mention.start, mention.end)}
            </span>
          );
          cursor = mention.end;
          if (index === mentions.length - 1 && cursor < message.content.length) {
            nodes.push(<span key="text-tail">{message.content.slice(cursor)}</span>);
          }
          return nodes;
        })}
      </p>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background font-sans text-foreground">
      {workspaceLayoutLoaded ? (
      <ResizablePanelGroup
        defaultLayout={workspaceDefaultLayout}
        groupRef={workspaceGroupRef}
        id={workspaceLayoutKey(bookId)}
        key={`${bookId}:${workspaceDefaultLayout ? JSON.stringify(workspaceDefaultLayout) : "default"}`}
        className="min-h-0"
        onLayoutChanged={saveWorkspaceLayout}
        orientation="horizontal"
      >
        <ResizablePanel
          id="workspace-sidebar"
          defaultSize={`${workspaceDefaultLayout?.["workspace-sidebar"] ?? 18}%`}
          minSize="160px"
          maxSize="30%"
          panelRef={workspaceSidebarRef}
          className="min-h-0 min-w-0"
        >
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
          <MoreVertical size={16} className="shrink-0 text-muted-foreground" />
        </div>

        <div className="flex gap-1 border-b border-border bg-muted/40 p-2">
          {[
            { key: "chapters" as const, label: "章节", icon: BookOpen },
            { key: "characters" as const, label: "角色", icon: Users },
            { key: "settings" as const, label: "设定", icon: Database }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
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
            <button className="rounded bg-primary p-1.5 text-primary-foreground transition-colors hover:bg-primary/90" onClick={() => void createChapter()} aria-label="新建章节">
              <Plus size={16} />
            </button>
          ) : null}
          {activeTab === "characters" ? (
            <button className="rounded bg-primary p-1.5 text-primary-foreground transition-colors hover:bg-primary/90" onClick={startCreateCharacter} aria-label="新建角色">
              <Plus size={16} />
            </button>
          ) : null}
          {activeTab === "settings" ? (
            <button className="rounded bg-primary p-1.5 text-primary-foreground transition-colors hover:bg-primary/90" onClick={startCreateSetting} aria-label="新建设定">
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
                    className={cn(
                      "group relative w-full overflow-hidden rounded-lg border p-3 text-left transition-colors",
                      selected
                        ? "border-border bg-card shadow-sm"
                        : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    onClick={() => void selectChapter(chapter.id)}
                  >
                    {selected ? <span className="absolute bottom-0 left-0 top-0 w-1 bg-primary" /> : null}
                    <span className="flex items-start justify-between gap-2 pl-1">
                      <span className={cn("truncate text-sm", selected ? "font-bold text-foreground" : "font-medium")}>
                        {chapter.order}. {chapter.title}
                      </span>
                      <span className={cn("shrink-0 text-[11px]", selected ? "text-muted-foreground" : "text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100")}>
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
                  onChange={(event) => setCharacterSearch(event.target.value)}
                  className="h-9 rounded-lg border-border bg-background pl-9 text-xs"
                  placeholder="搜索名称或简介"
                />
              </div>

              {copyNotice ? <p className="mx-1 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">{copyNotice}</p> : null}

              <div className="space-y-1">
                {status === "loading" ? <p className="px-3 py-4 text-sm text-gray-400">角色加载中...</p> : null}
                {status !== "loading" && !characters.length ? (
                  <p className="mx-1 rounded-lg border border-dashed border-gray-200 bg-white p-4 text-xs leading-5 text-gray-400">
                    还没有角色，点击右上角创建。
                  </p>
                ) : null}
                {status !== "loading" && characters.length > 0 && !filteredCharacters.length ? (
                  <p className="mx-1 rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-400">没有匹配的角色</p>
                ) : null}
                {filteredCharacters.map((item) => {
                  const selected = item.id === activeCharacter?.id && characterMode === "detail";
                  return (
                    <button
                      key={item.id}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-colors",
                        selected ? "border-border bg-card shadow-sm" : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                      onClick={() => selectCharacter(item)}
                    >
                      <span className="block truncate text-sm font-medium text-foreground">{item.name}</span>
                      <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.summary || "暂无简介"}</span>
                      <span className="mt-2 flex items-center text-[10px] text-muted-foreground">
                        <Clock3 size={11} className="mr-1" />
                        {formatUpdatedAt(item.updatedAt)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeCharacter && characterMode === "detail" ? (
                <div className="mx-1 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-gray-900">{activeCharacter.name}</h3>
                      <p className="mt-1 text-xs leading-5 text-gray-500">{activeCharacter.summary}</p>
                    </div>
                    <button className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" onClick={startEditCharacter} aria-label="编辑角色">
                      <Edit3 size={14} />
                    </button>
                  </div>
                  <p className="mt-3 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-2 text-xs leading-5 text-muted-foreground">
                    {activeCharacter.detail || "暂无详情"}
                  </p>
                  {characterDeleteConfirm ? (
                    <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-600">再点一次确认删除。</p>
                  ) : null}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="rounded-lg border border-border py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground" onClick={() => void copyCharacterText("详情", activeCharacter.detail || activeCharacter.summary)}>
                      <Copy size={12} className="mr-1 inline" />
                      复制
                    </button>
                    <button className="rounded-lg border border-border py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground" onClick={() => void deleteCharacter()} disabled={characterStatus === "deleting"}>
                      {characterStatus === "deleting" ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> : <Trash2 size={12} className="mr-1 inline" />}
                      {characterDeleteConfirm ? "确认删除" : "删除"}
                    </button>
                  </div>
                </div>
              ) : null}
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
                    onChange={(event) => setSettingSearch(event.target.value)}
                    className="h-9 pl-9 text-xs"
                    placeholder="搜索名称、简介或详情"
                  />
                </div>
                <Select value={settingType} onValueChange={setSettingType}>
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
                {status !== "loading" && !settings.length ? (
                  <Empty className="mx-1 rounded-lg border border-dashed">
                    <EmptyHeader>
                      <EmptyTitle>还没有设定</EmptyTitle>
                      <EmptyDescription>点击右上角新建设定，也可以从 AI 对话保存设定草稿。</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button size="sm" onClick={startCreateSetting}>
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
                  const selected = item.id === activeSetting?.id && settingMode === "detail";
                  return (
                    <button
                      key={item.id}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-colors",
                        selected ? "border-border bg-card shadow-sm" : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                      onClick={() => selectSetting(item)}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
                        <Badge variant="secondary">{item.type || "other"}</Badge>
                      </span>
                      <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.summary || "暂无简介"}</span>
                      <span className="mt-2 flex items-center text-[10px] text-muted-foreground">
                        <Clock3 size={11} className="mr-1" />
                        {formatUpdatedAt(item.updatedAt)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeSetting && settingMode === "detail" ? (
                <div className="mx-1 rounded-lg border bg-card p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Badge variant="outline">{activeSetting.type || "other"}</Badge>
                      <h3 className="mt-2 truncate text-sm font-semibold">{activeSetting.name}</h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{activeSetting.summary}</p>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={startEditSetting} aria-label="编辑设定">
                      <Edit3 />
                    </Button>
                  </div>
                  <p className="mt-3 max-h-28 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-2 text-xs leading-5 text-muted-foreground">
                    {activeSetting.detail || "暂无详情"}
                  </p>
                  {settingDeleteConfirm ? <p className="mt-2 rounded-lg bg-muted px-2 py-1.5 text-xs text-muted-foreground">再点一次确认删除。</p> : null}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Button variant="outline" size="sm" onClick={() => void copySettingText("名称", activeSetting.name)}>
                      名称
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void copySettingText("简介", activeSetting.summary)}>
                      简介
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void copySettingText("详情", activeSetting.detail || activeSetting.summary)}>
                      详情
                    </Button>
                  </div>
                  <Button className="mt-2 w-full" variant="outline" size="sm" onClick={() => void deleteSetting()} disabled={settingStatus === "deleting"}>
                    {settingStatus === "deleting" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Trash2 data-icon="inline-start" />}
                    {settingDeleteConfirm ? "确认删除" : "删除设定"}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="border-t border-border bg-card p-4">
          <button className="group mb-3 flex w-full items-center justify-between text-left" onClick={() => void openAccount()} aria-label="账户中心">
            <div className="flex items-center gap-2">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground shadow-sm">
                {(profile?.user.nickname || profile?.user.email || "U").slice(0, 1).toUpperCase()}
                <div className="absolute -bottom-1 -right-1 rounded-full border border-background bg-background p-0.5 shadow-sm">
                  <Crown size={8} className="text-foreground" />
                </div>
              </div>
              <div>
                <span className="block text-sm font-medium text-foreground transition-colors group-hover:text-foreground">
                  {profile?.user.nickname || "账户中心"}
                </span>
                <span className="block text-[10px] font-medium text-muted-foreground">
                  {profile?.subscription ? "订阅生效中" : "未订阅套餐"}
                </span>
              </div>
            </div>
            <Settings size={16} className="text-gray-400 transition-colors group-hover:text-gray-600" />
          </button>
          <button className="w-full rounded-lg border border-border bg-muted p-3 text-left" onClick={() => void openBilling()} aria-label="套餐与积分">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="flex items-center text-muted-foreground">
                <Zap size={12} className="mr-1 text-foreground" />
                可用积分
              </span>
              <span className="font-semibold text-foreground">{profile?.points.totalPoints ?? 0}</span>
            </div>
            <div className="mb-1.5 h-1.5 w-full rounded-full bg-border">
              <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.min(100, ((profile?.points.totalPoints ?? 0) / 2000) * 100)}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>VIP 每日: {profile?.points.vipDailyPoints ?? 0}</span>
              <span>加油包: {profile?.points.creditPackPoints ?? 0}</span>
            </div>
          </button>
        </div>
      </aside>
        </ResizablePanel>

        <ResizableHandle withHandle aria-label="调整目录与正文宽度" className="z-30" />

        <ResizablePanel
          id="workspace-editor"
          defaultSize={`${workspaceDefaultLayout?.["workspace-editor"] ?? 56}%`}
          minSize="360px"
          panelRef={workspaceEditorRef}
          className="min-h-0 min-w-0"
        >
      <main data-testid="workspace-editor-panel" className="relative z-0 flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background">
        <div className="z-10 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
          <div className="flex items-center gap-4">
            <div className="flex select-none items-center gap-1.5 text-xs text-gray-400">
              <StatusIcon
                size={14}
                className={cn(
                  statusMeta.tone === "success" ? "text-green-500" : "text-gray-400",
                  status === "saving" || status === "loading" || status === "analyzing" ? "animate-spin" : ""
                )}
              />
              <span>{statusMeta.label}</span>
            </div>
            <button className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600" onClick={() => setChapterDeleteOpen(true)} aria-label="删除当前章节">
              <Trash2 size={16} />
            </button>
          </div>
          <button
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
            onClick={() => void analyze()}
            disabled={status === "analyzing"}
          >
            {status === "analyzing" ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            <span>AI 分析本章</span>
          </button>
        </div>

        <div className="flex min-h-0 w-full flex-1 justify-center overflow-y-auto">
          <div className="flex min-h-full w-full max-w-3xl min-w-0 flex-col px-4 py-12 md:px-10">
            {activeChapter ? (
              <>
                <input
                  aria-label="章节标题"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mb-6 border-none bg-transparent text-3xl font-bold text-foreground outline-none placeholder:text-muted-foreground"
                  placeholder="无标题章节"
                />

                <div className="group relative mb-10">
                  <div className="absolute -left-4 top-3 h-8 w-1 rounded-full bg-gray-200 transition-colors group-hover:bg-gray-300" />
                  <div className="relative min-h-[60px] rounded-xl border border-transparent bg-muted p-4 text-sm text-muted-foreground transition-all group-hover:border-border">
                    <div className="whitespace-pre-wrap pr-10 leading-relaxed">
                      {summary || <span className="text-gray-400">尚未填写章节提要，点击右侧编辑...</span>}
                    </div>
                    <button
                      onClick={openSummaryModal}
                      className="absolute right-3 top-3 rounded-lg border border-gray-200 bg-white p-1.5 text-gray-400 opacity-0 shadow-sm transition-all duration-200 hover:bg-gray-100 hover:text-gray-900 group-hover:opacity-100"
                      title="编辑章节提要"
                      aria-label="编辑章节提要"
                    >
                      <Edit3 size={14} />
                    </button>
                  </div>
                </div>

                {analysisNotice ? (
                  <div className="mb-5 rounded-lg border border-border bg-muted px-4 py-3 text-sm leading-6 text-foreground">
                    <span className="flex items-center font-medium">
                      <AlertCircle size={15} className="mr-1.5" />
                      {analysisNotice}
                    </span>
                  </div>
                ) : null}

                <ChapterPlainTextEditor
                  value={content}
                  suggestions={suggestions}
                  activeSuggestionIndex={activeSuggestionIndex}
                  disabled={status === "loading"}
                  onChange={updateContent}
                  onActivateSuggestion={(index) => {
                    setActiveSuggestionIndex(index);
                    setOverlay(true);
                  }}
                />
              </>
            ) : (
              <div className="grid flex-1 place-items-center text-sm text-gray-400">暂无章节</div>
            )}
          </div>
        </div>

        <div className="flex h-10 shrink-0 items-center justify-between border-t border-border bg-muted/40 px-6 text-[12px] font-medium text-muted-foreground">
          <div className="flex items-center">
            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-green-500" />
            本章字数: {count}
          </div>
          <div>今日字数: {todayCount}</div>
        </div>
      </main>
        </ResizablePanel>

        <ResizableHandle withHandle aria-label="调整正文与对话宽度" className="z-30" />

        <ResizablePanel
          id="workspace-chat"
          defaultSize={`${workspaceDefaultLayout?.["workspace-chat"] ?? 26}%`}
          minSize="240px"
          maxSize="38%"
          panelRef={workspaceChatRef}
          className="min-h-0 min-w-0"
        >
      <aside data-testid="workspace-chat-panel" className="relative z-20 flex h-full min-h-0 min-w-0 flex-col border-l border-gray-200 bg-white shadow-[-2px_0_12px_rgba(0,0,0,0.03)]">
        <div className="flex h-14 items-center justify-between border-b border-gray-100 p-4">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-gray-900">{activeSession?.title || "新的对话"}</h2>
            <p className="truncate text-xs text-gray-400">
              {chatStatus === "streaming" ? "AI 回复中" : "当前会话 · 已读取作品上下文"}
            </p>
          </div>
          <div className="flex gap-1">
            <button className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900" onClick={() => setShowHistory((value) => !value)} title="历史会话" aria-label="历史会话">
              <Clock3 size={16} />
            </button>
            <button className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900" onClick={() => void createSession()} title="新建会话" aria-label="新建会话">
              <MessageSquare size={16} />
            </button>
          </div>
        </div>

        {showHistory ? (
          <div className="border-b border-border bg-card p-3">
            <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-border bg-muted p-2">
              {sessions.length ? (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                      session.id === activeSessionId ? "border-primary bg-card text-foreground" : "border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    onClick={() => void switchSession(session.id)}
                  >
                    <span className="block truncate font-medium">{session.title}</span>
                    <span className="mt-1 block truncate text-muted-foreground">{session.lastMessagePreview || "暂无消息"}</span>
                  </button>
                ))
              ) : (
                <p className="px-2 py-3 text-xs text-gray-400">暂无历史会话</p>
              )}
            </div>
          </div>
        ) : null}

        {!overlay ? (
          <div className="flex flex-1 flex-col overflow-hidden bg-muted/30">
            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <div className="flex justify-center">
                <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">当前会话 · 已读取作品上下文</span>
              </div>
              {hasMoreMessages ? (
                <Button variant="secondary" size="sm" className="w-full rounded-full" onClick={() => void loadOlderMessages()}>
                  <History size={14} />
                  加载更早消息
                </Button>
              ) : null}
              {chatStatus === "loading" ? <p className="text-sm text-gray-400">消息加载中...</p> : null}
              {chatStatus === "no_points" ? (
                <div className="flex items-center rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 shadow-sm">
                  <AlertCircle size={16} className="mr-2 shrink-0" />
                  积分不足，暂时无法发送。
                </div>
              ) : null}
              {chatStatus === "error" ? (
                <div className="flex items-center rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
                  <AlertCircle size={16} className="mr-2 shrink-0" />
                  发送失败，请稍后重试。
                </div>
              ) : null}

              {messages.map((message) => (
                <div key={message.id} className={cn("animate-pop flex w-full", message.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[90%] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
                      message.role === "user"
                        ? "rounded-tr-sm border-primary bg-primary text-primary-foreground"
                        : "rounded-tl-sm border-border bg-card text-card-foreground"
                    )}
                  >
                    {renderMessageContent(message)}
                    {message.role === "assistant" && message.id === streamingMessageId && activeToolCalls.length > 0 && chatStatus === "streaming" ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {activeToolCalls.map((tool) => (
                          <span key={tool} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
                            <Loader2 size={12} className="animate-spin" />
                            {toolLabel(tool)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {message.role === "assistant" && message.id === streamingMessageId && toolResults.length > 0 ? (
                      <div className="mt-2 space-y-1.5">
                        {toolResults.map((result, index) => (
                          <div key={`tool-result-${index}`} className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs">
                            <div className="flex items-center gap-1 font-medium text-green-700">
                              <Check size={12} />
                              {result.display || toolLabel(result.tool)}
                            </div>
                            {result.result ? (
                              <p className="mt-1 text-green-600 line-clamp-3">{result.result.length > 200 ? `${result.result.slice(0, 200)}...` : result.result}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {message.role === "assistant" && message.billing_failed ? (
                      <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                        <AlertCircle size={12} className="shrink-0" />
                        计费异常，请联系管理员
                      </div>
                    ) : null}
                    {message.role === "assistant" && message.error ? (
                      <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                        <AlertCircle size={12} className="shrink-0" />
                        {message.error}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="mx-4 mb-4 rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              {/* Model selector bar */}
              <div className="flex items-center justify-between px-4 py-2">
                <div className="flex min-w-0 items-center gap-1.5 text-xs text-gray-400">
                  <Zap size={12} className="shrink-0 text-gray-300" />
                  {modelStatus === "loading" ? (
                    <span className="text-gray-300">模型加载中...</span>
                  ) : modelStatus === "error" ? (
                    <>
                      <span className="text-red-500">模型列表加载失败</span>
                      <button
                        type="button"
                        className="ml-1 underline hover:no-underline"
                        onClick={() => {
                          setModelStatus("loading");
                          client.listAiModels()
                            .then((models) => {
                              const nextModelId = models[0]?.id ?? "";
                              setAiModels(models);
                              setSelectedModelId(nextModelId);
                              if (nextModelId) window.localStorage.setItem(chatModelKey(bookId), nextModelId);
                              setModelStatus(nextModelId ? "ready" : "error");
                            })
                            .catch(() => setModelStatus("error"));
                        }}
                      >
                        重试
                      </button>
                    </>
                  ) : !selectedModel ? (
                    <span className="text-gray-300">暂无可用模型</span>
                  ) : (
                    <ModelPicker
                      models={aiModels}
                      selectedId={selectedModelId}
                      onSelect={selectChatModel}
                    />
                  )}
                </div>
              </div>

              {/* Input area */}
              {chatStatus === "streaming" && (
                <div className="flex justify-center border-t border-gray-100 px-4 py-2">
                  <button
                    className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                    onClick={() => {
                      abortRef.current?.abort();
                      setChatStatus("idle");
                    }}
                  >
                    <X size={12} />
                    停止生成
                  </button>
                </div>
              )}
              <ChatMentionInput
                ref={chatInputRef}
                valueText={chatInput}
                mentions={chatMentions}
                items={allReferenceItems}
                recentItems={recentReferences}
                pendingReferences={pendingReferences}
                disabled={chatStatus === "streaming" || modelStatus !== "ready" || !selectedModelId}
                onChange={(text, mentions) => {
                  setChatInput(text);
                  setChatMentions(mentions);
                }}
                onSelectReference={(reference) => rememberReferences([reference])}
                onRemoveReference={(reference) =>
                  setPendingReferences((items) => items.filter((item) => referenceKey(item) !== referenceKey(reference)))
                }
                onSubmit={() => void sendMessage()}
              />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 z-30 flex flex-col bg-background/95 backdrop-blur">
            <div className="flex h-14 items-center justify-between border-b border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <Wand2 size={16} className="text-foreground" />
                <span className="text-sm font-semibold text-foreground">AI 写作建议</span>
              </div>
              <button className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900" onClick={() => setOverlay(false)} aria-label="关闭写作建议">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {suggestions.map((suggestion, index) => {
                const selected = index === activeSuggestionIndex;
                return (
                  <div
                    key={`${suggestion.quote}-${index}`}
                    className={cn(
                      "flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm",
                      selected ? "border-primary" : "border-border"
                    )}
                  >
                    <button
                      className="border-b border-border bg-muted p-4 text-left"
                      onClick={() => setActiveSuggestionIndex(index)}
                    >
                      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        原文引用
                      </span>
                      <p className="line-clamp-3 text-sm text-muted-foreground">{suggestion.quote}</p>
                    </button>
                    <div className="border-b border-border p-4">
                      <div className="flex items-start text-sm">
                        <AlertCircle size={16} className="mr-2 mt-0.5 shrink-0 text-foreground" />
                        <span className="text-foreground">{suggestion.issue}</span>
                      </div>
                    </div>
                    <div className="bg-background p-4">
                      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        推荐修改方案
                      </span>
                      <p className="mb-5 text-sm text-foreground">{suggestion.options[0]}</p>
                      <div className="flex gap-3">
                        <button
                          className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                          onClick={() => {
                            setActiveSuggestionIndex(index);
                            void acceptSuggestion(index);
                          }}
                        >
                          采纳替换
                        </button>
                        <button
                          className="flex-1 rounded-lg border border-border bg-background py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                          onClick={() => {
                            setActiveSuggestionIndex(index);
                            sendSuggestionToChat(index);
                          }}
                        >
                          发送至对话
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </aside>
        </ResizablePanel>
      </ResizablePanelGroup>
      ) : null}

      <Dialog open={summaryModalOpen} onOpenChange={setSummaryModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑章节提要</DialogTitle>
            <DialogDescription>章节提要会作为列表预览和 AI 上下文的一部分。</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>章节提要</FieldLabel>
              <Textarea
                aria-label="章节提要"
                value={summaryDraft}
                onChange={(event) => setSummaryDraft(event.target.value)}
                className="h-40 resize-none"
                placeholder="写下这一章的核心事件、情绪转折或悬念..."
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSummaryModalOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void saveSummary()}>
              <Check data-icon="inline-start" />
              保存更改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={chapterDeleteOpen} onOpenChange={setChapterDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除章节？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{activeChapter?.title ?? "当前章节"}」的标题、正文和提要。删除后会自动切换到相邻章节。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteActiveChapter()}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={characterMode === "create" || characterMode === "edit"}
        onOpenChange={(open) => {
          if (!open) setCharacterMode("detail");
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{characterMode === "create" ? "新建角色" : "编辑角色"}</DialogTitle>
            <DialogDescription>维护角色名称、简介和可供 AI 引用的详细设定。</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>角色名称</FieldLabel>
              <Input
                aria-label="角色名称"
                value={characterDraft.name}
                onChange={(event) => setCharacterDraft((value) => ({ ...value, name: event.target.value }))}
                placeholder="角色名称"
              />
            </Field>
            <Field>
              <FieldLabel>角色简介</FieldLabel>
              <Textarea
                aria-label="角色简介"
                value={characterDraft.summary}
                onChange={(event) => setCharacterDraft((value) => ({ ...value, summary: event.target.value }))}
                className="min-h-24 resize-none"
                placeholder="角色简介"
              />
            </Field>
            <Field>
              <FieldLabel>角色详情</FieldLabel>
              <Textarea
                aria-label="角色详情"
                value={characterDraft.detail}
                onChange={(event) => setCharacterDraft((value) => ({ ...value, detail: event.target.value }))}
                className="min-h-32 resize-none"
                placeholder="角色详情"
              />
            </Field>
            {characterStatus === "error" && characterError ? <FieldError>{characterError}</FieldError> : null}
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCharacterMode("detail")}>
              取消
            </Button>
            <Button onClick={() => void saveCharacter()} disabled={characterStatus === "saving"}>
              {characterStatus === "saving" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
              保存角色
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={settingMode === "create" || settingMode === "edit"}
        onOpenChange={(open) => {
          if (!open) setSettingMode("detail");
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{settingMode === "create" ? "新建设定" : "编辑设定"}</DialogTitle>
            <DialogDescription>维护设定类型、简介和可供 AI 引用的详细内容。</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>设定类型</FieldLabel>
              <Select value={settingDraft.type} onValueChange={(value) => setSettingDraft((draft) => ({ ...draft, type: value }))}>
                <SelectTrigger className="w-full" aria-label="设定类型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {settingTypes.filter((item) => item.value !== "all").map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>设定名称</FieldLabel>
              <Input
                aria-label="设定名称"
                value={settingDraft.name}
                onChange={(event) => setSettingDraft((value) => ({ ...value, name: event.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel>设定简介</FieldLabel>
              <Textarea
                aria-label="设定简介"
                value={settingDraft.summary}
                onChange={(event) => setSettingDraft((value) => ({ ...value, summary: event.target.value }))}
                className="min-h-24 resize-none"
              />
            </Field>
            <Field>
              <FieldLabel>设定详情</FieldLabel>
              <Textarea
                aria-label="设定详情"
                className="min-h-32 resize-none"
                value={settingDraft.detail}
                onChange={(event) => setSettingDraft((value) => ({ ...value, detail: event.target.value }))}
              />
            </Field>
            {settingStatus === "error" && settingError ? <FieldError>{settingError}</FieldError> : null}
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingMode("detail")}>
              取消
            </Button>
            <Button onClick={() => void saveSetting()} disabled={settingStatus === "saving"}>
              {settingStatus === "saving" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
              保存设定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>账户中心</DialogTitle>
            <DialogDescription>查看账户状态、积分余额并修改昵称。</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>邮箱</FieldLabel>
              <Input value={profile?.user.email ?? ""} readOnly aria-label="账户邮箱" />
            </Field>
            <Field>
              <FieldLabel>昵称</FieldLabel>
              <Input value={nicknameDraft} onChange={(event) => setNicknameDraft(event.target.value)} aria-label="昵称" />
            </Field>
            <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">总积分</p>
                <p className="font-semibold">{profile?.points.totalPoints ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">VIP 每日</p>
                <p className="font-semibold">{profile?.points.vipDailyPoints ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">加油包</p>
                <p className="font-semibold">{profile?.points.creditPackPoints ?? 0}</p>
              </div>
            </div>
            {accountStatus === "error" ? <FieldError>账户信息保存失败，请稍后重试</FieldError> : null}
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => void openBilling()}>
              套餐与积分
            </Button>
            <Button onClick={() => void saveNickname()} disabled={accountStatus === "saving"}>
              {accountStatus === "saving" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
              保存昵称
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={billingOpen} onOpenChange={setBillingOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>套餐与积分</DialogTitle>
            <DialogDescription>购买套餐或加油包后，权益会在支付成功后到账。</DialogDescription>
          </DialogHeader>
          <div className="max-h-[66vh] overflow-y-auto pr-1">
            {billingStatus === "loading" ? <p className="py-8 text-center text-sm text-muted-foreground">商品加载中...</p> : null}
            {billingStatus === "error" ? <p className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">计费请求失败，请稍后重试。</p> : null}
            <div className="grid gap-3 md:grid-cols-2">
              {[...billingProducts.plans.map((item) => ({ ...item, productType: "plan" as const })), ...billingProducts.creditPacks.map((item) => ({ ...item, productType: "credit_pack" as const }))].map((item) => (
                <div key={item.id} className="rounded-lg border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{item.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">¥{item.priceAmount}</p>
                    </div>
                    <Badge variant="secondary">{item.productType === "plan" ? "套餐" : "加油包"}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {item.productType === "plan"
                      ? `VIP 每日 ${item.vipDailyPoints} 点，附赠积分包 ${item.bundledCreditPackPoints} 点`
                      : `${item.points} 点（永久有效）`}
                  </p>
                  <Button className="mt-4 w-full" size="sm" onClick={() => void createOrder(item.productType, item.id)} disabled={billingStatus === "creating"}>
                    {billingStatus === "creating" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Zap data-icon="inline-start" />}
                    创建订单
                  </Button>
                </div>
              ))}
            </div>
            {billingOrder ? (
              <div className="mt-4 rounded-lg border bg-muted p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{billingOrder.productName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">订单号：{billingOrder.orderNo}</p>
                  </div>
                  <Badge>{billingOrder.status}</Badge>
                </div>
                <p className="mt-3 break-all rounded-md bg-background p-3 text-xs text-muted-foreground">
                  {billingOrder.qrCode || "等待支付二维码"}
                </p>
                {testPaymentEnabled ? (
                  <Button className="mt-3" size="sm" variant="outline" onClick={() => void simulateOrderPaid()} disabled={billingStatus === "creating" || billingOrder.status === "paid"}>
                    模拟支付成功
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
