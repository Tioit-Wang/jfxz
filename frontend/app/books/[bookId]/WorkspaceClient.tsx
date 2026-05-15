"use client";

import {
  AlertCircle,
  ArrowRight,
  Bold,
  BookMarked,
  Check,
  Clock3,
  Cloud,
  CloudOff,
  Code,
  Compass,
  Crown,
  Database,
  FileText,
  Heading3,
  Italic,
  Lightbulb,
  LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Mail,
  Minus,
  PencilLine,
  Quote,
  Save,
  ShieldAlert,
  Strikethrough,
  Tags,
  type LucideIcon,
  UserRound,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useGroupRef, usePanelRef, type Layout } from "react-resizable-panels";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { cjk } from "@streamdown/cjk";
import {
  ApiClient,
  ApiError,
  type AiModelOption,
  type AnalysisRound,
  type ApiSuggestion,
  type CheckInfo,
  type PersistedAnalysis,
  type BillingOrder,
  type BillingProducts,
  type ChatMention,
  type ChatMessage,
  type ChatReference,
  type ChatSession,
  type DailyWordProgress,
  type InspirationNote,
  type NamedContent,
  type UserProfile,
  type Volume,
  type WritingGoal,
} from "@/api";
import { userLoginPath } from "@/auth";
import { type ChatMentionInputHandle } from "@/components/ChatMentionInput";
import { parseRefMarks } from "@/lib/ref-mark";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import TipTapLink from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Textarea } from "@/components/ui/textarea";
import { PaymentDialog } from "@/components/billing/PaymentDialog";
import { cn } from "@/lib/utils";
import { applySuggestion, type Chapter, type Work, wordCount } from "@/domain";
import { type WorkspaceMentionReference } from "./workspace/dnd";
import { AnalyzeProgressModal } from "./workspace/AnalyzeProgressModal";
import { WorkspaceChatPanel } from "./workspace/WorkspaceChatPanel";
import { WorkspaceEditorPanel } from "./workspace/WorkspaceEditorPanel";
import ShareDialog from "./workspace/ShareDialog";
import VersionHistoryDialog from "./workspace/VersionHistoryDialog";
import { WorkspaceSidebarPanel } from "./workspace/WorkspaceSidebarPanel";
import { toolLabel, WorkspaceToolCall } from "./workspace/WorkspaceToolCall";

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
type InspirationNoteMode = "idle" | "create" | "edit";
type InspirationNoteDraft = { title: string; content: string; category: string };
const RECENT_REF_KEY = "goodgua-recent-references";
const CHAT_MODEL_KEY = "goodgua-chat-model";
const WORKSPACE_LAYOUT_PANEL_IDS = ["workspace-sidebar", "workspace-editor", "workspace-chat"] as const;
const testPaymentEnabled = process.env.NEXT_PUBLIC_ENABLE_TEST_PAYMENT === "true";
const settingTypes = [
  { value: "all", label: "全部设定" },
  { value: "location", label: "地点" },
  { value: "equipment", label: "装备" },
  { value: "attribute", label: "属性" },
  { value: "rule", label: "规则" },
  { value: "organization", label: "组织" },
  { value: "other", label: "其他" }
];

const EDITOR_SETTINGS_KEY = "goodgua-editor-settings";

const EDITOR_FONT_OPTIONS = [
  { value: "system-serif", label: "系统衬线", stack: "Georgia, 'Noto Serif', 'Times New Roman', serif" },
  { value: "songti", label: "宋体", stack: "'SimSun', '宋体', 'Songti SC', serif" },
  { value: "noto-serif-sc", label: "思源宋体", stack: "'Noto Serif SC', 'Source Han Serif SC', serif" },
  { value: "fangsong", label: "仿宋", stack: "'FangSong', '仿宋', 'STFangsong', serif" },
  { value: "kaiti", label: "楷体", stack: "'KaiTi', '楷体', 'STKaiti', serif" },
  { value: "heiti", label: "黑体", stack: "'SimHei', '黑体', 'STHeiti', sans-serif" },
  { value: "yahei", label: "微软雅黑", stack: "'Microsoft YaHei', '微软雅黑', sans-serif" },
  { value: "noto-sans-sc", label: "思源黑体", stack: "'Noto Sans SC', 'Source Han Sans SC', sans-serif" },
  { value: "lisu", label: "隶书", stack: "'LiSu', '隶书', 'STLiti', serif" },
  { value: "youyuan", label: "幼圆", stack: "'YouYuan', '幼圆', sans-serif" },
];

const DEFAULT_EDITOR_SETTINGS = {
  fontFamily: "lisu",
  fontSize: 28,
  lineHeight: 1.5,
  letterSpacing: 0,
  paragraphSpacing: 4,
};

const DEFAULT_WRITING_GOAL: WritingGoal = { id: "", targetWords: 2000, updatedAt: "" };
const DEFAULT_DAILY_PROGRESS: DailyWordProgress = { date: "", wordsAdded: 0, updatedAt: "" };

function formatStatus(status: SaveStatus): { label: string; tone: "success" | "muted" | "warning"; icon: LucideIcon } {
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

function isMentionReferenceType(type: ChatReference["type"]): type is "chapter" | "character" {
  return type === "chapter" || type === "character";
}

function filterMentionReferences(items: ChatReference[]): ChatReference[] {
  return items.filter((item) => isMentionReferenceType(item.type));
}

function workspaceLayoutKey(bookId: string): string {
  return `goodgua-workspace-layout:v1:${bookId}`;
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


const CHAT_MARKDOWN_PLUGINS = { code, cjk };

function referenceTone(type: ChatReference["type"]): string {
  if (type === "setting") return "border-[#ebebeb] bg-[#f5f5f5] text-[#171717]";
  if (type === "character") return "border-[#ebebeb] bg-[#f5f5f5] text-[#171717]";
  if (type === "suggestion") return "border-[#ebebeb] bg-[#f5f5f5] text-[#171717]";
  return "border-[#ebebeb] bg-[#f5f5f5] text-[#888888]";
}

function apiErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "请求失败，请稍后重试";
  if (error.status === 401) return "登录已过期，请重新登录";
  if (error.status === 402) return "积分不足，暂时无法检测";
  if (error.status === 429) return "请求过于频繁，请稍后再试";
  if (error.status === 500) return "服务器内部错误，请稍后重试";
  if (error.status === 502) return "AI 检测结果解析失败，请重试";
  if (error.status === 503) return "AI 检测暂未配置";
  return "AI 检测失败，请稍后重试";
}

export default function WorkspaceClient({ bookId }: WorkspaceClientProps) {
  const router = useRouter();
  const client = useMemo(() => new ApiClient(undefined, undefined, {
    onUnauthorized: () => router.replace(userLoginPath(`/books/${bookId}`))
  }), [bookId, router]);
  const chatInputRef = useRef<ChatMentionInputHandle | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const workspaceGroupRef = useGroupRef();
  const workspaceSidebarRef = usePanelRef();
  const workspaceEditorRef = usePanelRef();
  const workspaceChatRef = usePanelRef();
  const workspaceLayoutReadyRef = useRef(false);
  const bootstrapStartedRef = useRef<string | null>(null);
  const draftContentRef = useRef("");
  const pendingAddedWordsRef = useRef(0);
  const titleRef = useRef("");
  const summaryRef = useRef("");
  const contentRef = useRef("");
  const savePromiseRef = useRef<Promise<Chapter | null>>(Promise.resolve(null));
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEditTimeRef = useRef(0);
  const pendingRemoteUpdateRef = useRef<{ title: string; summary: string; content: string } | null>(null);
  const [work, setWork] = useState<Work | null>(null);
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [characters, setCharacters] = useState<NamedContent[]>([]);
  const [settings, setSettings] = useState<NamedContent[]>([]);
  const [inspirationNotes, setInspirationNotes] = useState<InspirationNote[]>([]);
  const [writingGoal, setWritingGoal] = useState<WritingGoal>(DEFAULT_WRITING_GOAL);
  const [dailyWordProgress, setDailyWordProgress] = useState<DailyWordProgress>(DEFAULT_DAILY_PROGRESS);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("chapters");
  const [activeChapterId, setActiveChapterId] = useState("");
  const activeChapterIdRef = useRef("");
  const activeChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === activeChapterId) ?? chapters[0],
    [activeChapterId, chapters]
  );
  const chapterOrder = useMemo(
    () => activeChapter ? chapters.indexOf(activeChapter) + 1 : 0,
    [activeChapter, chapters]
  );
  const currentChapterRef = useMemo(
    () =>
      activeChapter
        ? { type: "chapter" as const, id: activeChapter.id, name: activeChapter.title, summary: activeChapter.summary }
        : null,
    [activeChapter]
  );

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");
  const [content, setContent] = useState("");
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<ApiSuggestion[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null);
  const [analysisNotice, setAnalysisNotice] = useState("");
  const [activeChatTab, setActiveChatTab] = useState<"chat" | "suggestions">("chat");
  const [persistedAnalysis, setPersistedAnalysis] = useState<PersistedAnalysis | null>(null);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [remoteUpdateNotice, setRemoteUpdateNotice] = useState<string | null>(null);

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
  const [thinkingIntensity, setThinkingIntensity] = useState<"none" | "low" | "medium" | "high" | "xhigh">("xhigh");

  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const [characterSearch, setCharacterSearch] = useState("");
  const [activeCharacterId, setActiveCharacterId] = useState("");
  const activeCharacterIdRef = useRef("");
  const [characterMode, setCharacterMode] = useState<CharacterMode>("detail");
  const [characterDraft, setCharacterDraft] = useState<CharacterDraft>({ name: "", summary: "", detail: "" });
  const [characterStatus, setCharacterStatus] = useState<CharacterStatus>("ready");
  const [characterError, setCharacterError] = useState("");
  const [characterDeleteConfirm, setCharacterDeleteConfirm] = useState(false);
  const [copyNotice, setCopyNotice] = useState("");
  const [chapterDeleteOpen, setChapterDeleteOpen] = useState(false);
  const [volumeCreateOpen, setVolumeCreateOpen] = useState(false);
  const [volumeDraft, setVolumeDraft] = useState("");
  const [volumeStatus, setVolumeStatus] = useState<"ready" | "saving" | "error">("ready");
  const [volumeEditOpen, setVolumeEditOpen] = useState(false);
  const [editingVolumeId, setEditingVolumeId] = useState("");
  const [volumeEditDraft, setVolumeEditDraft] = useState("");
  const [volumeDeleteConfirm, setVolumeDeleteConfirm] = useState<Volume | null>(null);

  const COLLAPSED_KEY = `sidebar-collapsed-${bookId}`;
  const [collapsedVolumes, setCollapsedVolumes] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const toggleCollapse = useCallback((volumeId: string) => {
    setCollapsedVolumes((prev) => {
      const next = new Set(prev);
      if (next.has(volumeId)) next.delete(volumeId);
      else next.add(volumeId);
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  }, [COLLAPSED_KEY]);

  const [settingSearch, setSettingSearch] = useState("");
  const [settingType, setSettingType] = useState("all");
  const [activeSettingId, setActiveSettingId] = useState("");
  const activeSettingIdRef = useRef("");
  const [settingMode, setSettingMode] = useState<SettingMode>("detail");
  const [settingDraft, setSettingDraft] = useState<SettingDraft>({ name: "", summary: "", detail: "", type: "other" });
  const [settingStatus, setSettingStatus] = useState<SettingStatus>("ready");
  const [settingError, setSettingError] = useState("");
  const [settingDeleteConfirm, setSettingDeleteConfirm] = useState(false);
  const [noteMode, setNoteMode] = useState<InspirationNoteMode>("idle");
  const [activeNoteId, setActiveNoteId] = useState("");
  const [noteDraft, setNoteDraft] = useState<InspirationNoteDraft>({ title: "", content: "", category: "灵感" });
  const [noteStatus, setNoteStatus] = useState<"ready" | "saving" | "error">("ready");
  const [noteError, setNoteError] = useState("");
  const [goalEditOpen, setGoalEditOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState({ targetWords: "2000" });
  const [goalStatus, setGoalStatus] = useState<"ready" | "saving" | "error">("ready");

  const [accountOpen, setAccountOpen] = useState(false);
  const [nicknameEditOpen, setNicknameEditOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [accountStatus, setAccountStatus] = useState<"idle" | "loading" | "saving" | "error">("idle");

  const [workEditOpen, setWorkEditOpen] = useState(false);
  const [workDraft, setWorkDraft] = useState({ title: "", shortIntro: "", synopsis: "", backgroundRules: "", focusRequirements: "", forbiddenRequirements: "", tags: "" });
  const [workSaveStatus, setWorkSaveStatus] = useState<"idle" | "saving" | "error">("idle");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [billingProducts, setBillingProducts] = useState<BillingProducts>({ plans: [], creditPacks: [] });
  const [billingOrder, setBillingOrder] = useState<BillingOrder | null>(null);
  const [billingStatus, setBillingStatus] = useState<"idle" | "loading" | "creating" | "paid" | "error">("idle");
  const [workspaceDefaultLayout, setWorkspaceDefaultLayout] = useState<Layout | undefined>(() => readWorkspaceLayout(bookId));
  const [workspaceLayoutLoaded, setWorkspaceLayoutLoaded] = useState(false);
  const [editorSettingsOpen, setEditorSettingsOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [editorSettings, setEditorSettings] = useState<typeof DEFAULT_EDITOR_SETTINGS>(() => {
    if (typeof window === "undefined") return DEFAULT_EDITOR_SETTINGS;
    try {
      const saved = window.localStorage.getItem(EDITOR_SETTINGS_KEY);
      if (saved) return { ...DEFAULT_EDITOR_SETTINGS, ...JSON.parse(saved) };
    } catch { /* ignore */ }
    return DEFAULT_EDITOR_SETTINGS;
  });

  const editorFontStack = EDITOR_FONT_OPTIONS.find((f) => f.value === editorSettings.fontFamily)?.stack ?? EDITOR_FONT_OPTIONS[0].stack;

  function updateEditorSetting<K extends keyof typeof DEFAULT_EDITOR_SETTINGS>(key: K, value: (typeof DEFAULT_EDITOR_SETTINGS)[K]) {
    setEditorSettings((prev) => {
      const next = { ...prev, [key]: value };
      window.localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }

  const count = useMemo(() => wordCount(content), [content]);
  const totalWordCount = useMemo(() => chapters.reduce((sum, chapter) => sum + wordCount(chapter.content), 0), [chapters]);
  const todayCount = dailyWordProgress.wordsAdded;
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

  useEffect(() => {
    activeChapterIdRef.current = activeChapterId;
  }, [activeChapterId]);

  useEffect(() => {
    activeCharacterIdRef.current = activeCharacterId;
  }, [activeCharacterId]);

  useEffect(() => {
    activeSettingIdRef.current = activeSettingId;
  }, [activeSettingId]);

  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { summaryRef.current = summary; }, [summary]);
  useEffect(() => { contentRef.current = content; }, [content]);

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
    return [...chapterRefs, ...characterRefs];
  }, [chapters, characters]);

  const moduleMeta = {
    chapters: { title: "章节目录", count: `${chapters.length} 章 · 共 ${totalWordCount} 字` },
    characters: { title: "角色管理", count: `${characters.length} 个角色` },
    settings: { title: "设定资料", count: `${settings.length} 条设定` }
  }[activeTab];

  const [staleSet, setStaleSet] = useState<Set<number>>(new Set());

  const clearAnalysis = useCallback(() => {
    setSuggestions([]);
    setActiveSuggestionIndex(null);
    setAnalysisNotice("");
    setStaleSet(new Set());
  }, []);

  const validateSuggestions = useCallback((text: string, items: ApiSuggestion[]) => {
    const next = new Set<number>();
    for (let i = 0; i < items.length; i++) {
      if (text.indexOf(items[i].quote) === -1) next.add(i);
    }
    setStaleSet(next);
  }, []);

  const syncDraft = useCallback((chapter: Chapter | undefined) => {
    setTitle(chapter?.title ?? "");
    setSummary(chapter?.summary ?? "");
    setSummaryDraft(chapter?.summary ?? "");
    const nextContent = chapter?.content ?? "";
    setContent(nextContent);
    draftContentRef.current = nextContent;
    pendingAddedWordsRef.current = 0;
    setSuggestions([]);
    setActiveSuggestionIndex(null);
    setAnalysisNotice("");
    setStaleSet(new Set());
    if (chapter) {
      try {
        const raw = localStorage.getItem(`jfxz_analysis_${bookId}_${chapter.id}`);
        setPersistedAnalysis(raw ? JSON.parse(raw) : null);
      } catch {
        setPersistedAnalysis(null);
      }
    } else {
      setPersistedAnalysis(null);
    }
  }, [bookId]);

  const recordContentDraft = useCallback((value: string) => {
    const previousCount = wordCount(draftContentRef.current);
    const nextCount = wordCount(value);
    if (nextCount > previousCount) {
      pendingAddedWordsRef.current += nextCount - previousCount;
    }
    draftContentRef.current = value;
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
        setRecentReferences(filterMentionReferences(JSON.parse(saved) as ChatReference[]));
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
        setVolumes(bootstrap.volumes);
        setCharacters(bootstrap.characters);
        setActiveCharacterId(bootstrap.characters[0]?.id ?? "");
        setSettings(bootstrap.settings);
        setActiveSettingId(bootstrap.settings[0]?.id ?? "");
        setInspirationNotes(bootstrap.inspirationNotes);
        setWritingGoal(bootstrap.writingGoal);
        setDailyWordProgress(bootstrap.dailyWordProgress);
        setShareEnabled(bootstrap.work.shareEnabled ?? false);
        setShareToken(bootstrap.work.shareToken ?? null);
        setGoalDraft({
          targetWords: String(bootstrap.writingGoal.targetWords)
        });
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

  async function saveCurrentChapter(overrides: Partial<Pick<Chapter, "title" | "summary" | "content">> = {}) {
    const currentChapter = chapters.find((ch) => ch.id === activeChapterIdRef.current) ?? chapters[0];
    if (!currentChapter) return null;

    const effectiveTitle = (overrides.title ?? titleRef.current).trim() || "未命名章节";
    const effectiveSummary = overrides.summary ?? summaryRef.current;
    const effectiveContent = overrides.content ?? contentRef.current;

    if (overrides.content !== undefined) {
      recordContentDraft(overrides.content);
    }

    const nextChapter: Chapter = {
      ...currentChapter,
      title: effectiveTitle,
      summary: effectiveSummary,
      content: effectiveContent,
    };
    const addedWords = pendingAddedWordsRef.current;

    const doSave = async (): Promise<Chapter | null> => {
      setStatus("saving");
      setChapters((items) => items.map((chapter) => (chapter.id === nextChapter.id ? nextChapter : chapter)));
      if (nextChapter.id.startsWith("local-")) {
        const created = await client.createChapter(bookId, {
          title: nextChapter.title,
          summary: nextChapter.summary,
          content: nextChapter.content,
          order: nextChapter.order,
          volumeId: nextChapter.volumeId,
          wordsAdded: addedWords,
        });
        setChapters((items) => items.map((chapter) => (chapter.id === nextChapter.id ? created : chapter)));
        setActiveChapterId(created.id);
        setTitle(created.title);
        if (addedWords) {
          setDailyWordProgress((value) => ({ ...value, wordsAdded: value.wordsAdded + addedWords }));
        }
        pendingAddedWordsRef.current = 0;
        draftContentRef.current = created.content;
        retryCountRef.current = 0;
        if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
        setStatus("saved");
        return created;
      }
      try {
        const savedChapter = await client.updateChapter(bookId, nextChapter, addedWords);
        setChapters((items) => items.map((chapter) => (chapter.id === savedChapter.id ? savedChapter : chapter)));
        setTitle(savedChapter.title);
        if (addedWords) {
          setDailyWordProgress((value) => ({ ...value, wordsAdded: value.wordsAdded + addedWords }));
        }
        pendingAddedWordsRef.current = 0;
        draftContentRef.current = savedChapter.content;
        retryCountRef.current = 0;
        if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
        setStatus("saved");
        return savedChapter;
      } catch (error) {
        setStatus("error");
        if (retryCountRef.current < 3) {
          const delay = 5000 * Math.pow(2, retryCountRef.current);
          retryCountRef.current += 1;
          retryTimerRef.current = setTimeout(() => {
            void saveCurrentChapter(overrides).catch(() => undefined);
          }, delay);
        }
        throw error;
      }
    };

    const previousPromise = savePromiseRef.current;
    let resolveChain: () => void;
    const chainPromise = new Promise<void>((resolve) => { resolveChain = resolve; });
    savePromiseRef.current = chainPromise.then(() => null);
    await previousPromise;
    try {
      const result = await doSave();
      return result;
    } finally {
      resolveChain!();
    }
  }

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
  }, [activeChapter, content, summary, title]);

  function persistRecentReferences(items: ChatReference[]) {
    const next = dedupeReferences(filterMentionReferences(items)).slice(0, 3);
    setRecentReferences(next);
    window.localStorage.setItem(`${RECENT_REF_KEY}:${bookId}`, JSON.stringify(next));
  }

  function rememberReferences(items: ChatReference[]) {
    const next = dedupeReferences([...filterMentionReferences(items), ...recentReferences]).slice(0, 3);
    persistRecentReferences(next);
  }

  function clearChatDraft() {
    setChatInput("");
    setChatMentions([]);
    setPendingReferences([]);
    chatInputRef.current?.clear();
  }

  function updateContent(value: string) {
    lastEditTimeRef.current = Date.now();
    recordContentDraft(value);
    setContent(value);
    if (suggestions.length) {
      validateSuggestions(value, suggestions);
    }
  }

  function acceptRemoteUpdate() {
    const pending = pendingRemoteUpdateRef.current;
    if (!pending) return;
    setTitle(pending.title);
    setSummary(pending.summary);
    setSummaryDraft(pending.summary);
    setContent(pending.content);
    titleRef.current = pending.title;
    summaryRef.current = pending.summary;
    contentRef.current = pending.content;
    draftContentRef.current = pending.content;
    pendingAddedWordsRef.current = 0;
    pendingRemoteUpdateRef.current = null;
    setRemoteUpdateNotice(null);
    setStatus("saved");
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

  async function createChapter(volumeId = activeChapter?.volumeId ?? volumes[0]?.id) {
    try {
      await saveCurrentChapter();
    } catch {
      setAnalysisNotice("当前章节保存失败，暂未新建章节");
      return;
    }
    const volumeChapterCount = chapters.filter((chapter) => chapter.volumeId === volumeId).length;
    const draft: Chapter = {
      id: `local-${Date.now()}`,
      volumeId,
      order: volumeChapterCount + 1,
      title: "未命名章节",
      summary: "",
      content: ""
    };
    setStatus("saving");
    try {
      const created = await client.createChapter(bookId, {
        title: draft.title,
        summary: draft.summary,
        content: draft.content,
        order: draft.order,
        volumeId: draft.volumeId,
        wordsAdded: 0
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

  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [enabledChecks, setEnabledChecks] = useState<CheckInfo[]>([]);
  const [checkProgress, setCheckProgress] = useState<Record<string, "loading" | "done" | "error">>({});
  const [checkErrors, setCheckErrors] = useState<Record<string, string>>({});
  const [progressOpen, setProgressOpen] = useState(false);

  function cancelAnalysis() {
    abortController?.abort();
    setAbortController(null);
    setProgressOpen(false);
    setStatus("analyzed");
  }

  async function analyze() {
    if (!content.trim()) {
      setAnalysisNotice("当前章节暂无正文，无法检测");
      setStatus("analyzed");
      return;
    }
    try { await saveCurrentChapter(); } catch { /* proceed */ }
    setStatus("analyzing");
    setAnalysisNotice("");
    const chapterId = activeChapterIdRef.current;

    let checks: CheckInfo[] = [];
    try {
      const res = await client.getAnalysisChecks(bookId);
      checks = res.checks;
    } catch {
      setAnalysisNotice("获取检查配置失败");
      setStatus("error");
      return;
    }
    const active = checks.filter((c) => c.has_model);
    setEnabledChecks(active);
    if (!active.length) {
      setAnalysisNotice("没有启用且已配置模型的检查项");
      setStatus("analyzed");
      return;
    }

    const ctrl = new AbortController();
    setAbortController(ctrl);
    setCheckProgress(Object.fromEntries(active.map((c) => [c.id, "loading"])));
    setCheckErrors({});
    setProgressOpen(true);

    const results: AnalysisRound[] = [];
    const promises = active.map(async (check) => {
      try {
        const round = await client.analyzeChapterCheck(bookId, chapterId, content, check.id, ctrl.signal);
        results.push(round);
        setCheckProgress((p) => ({ ...p, [check.id]: "done" }));
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setCheckProgress((p) => ({ ...p, [check.id]: "error" }));
        setCheckErrors((e) => ({ ...e, [check.id]: apiErrorMessage(err) }));
      }
    });

    await Promise.allSettled(promises);
    if (ctrl.signal.aborted) return;

    const flatSuggestions = results.flatMap((r) => r.suggestions);
    setSuggestions(flatSuggestions);
    setActiveSuggestionIndex(null);
    setStaleSet(new Set());
    const totalSuggestions = results.reduce((s, r) => s + r.suggestions.length, 0);
    const analysis: PersistedAnalysis = {
      chapterId,
      chapterTitle: activeChapter?.title ?? "",
      workId: bookId,
      analyzedAt: new Date().toISOString(),
      rounds: results,
      totalSuggestions,
    };
    setPersistedAnalysis(analysis);
    try {
      localStorage.setItem(`jfxz_analysis_${bookId}_${chapterId}`, JSON.stringify(analysis));
    } catch { /* storage full, ignore */ }
    setActiveChatTab("suggestions");
    setAnalysisNotice(totalSuggestions ? `发现 ${totalSuggestions} 处可检查内容` : "未发现明显问题");
    setStatus("analyzed");
    setAbortController(null);
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
    setActiveChatTab("chat");
    const nextInput = `针对这段建议，我们再讨论一下其他处理方式：${nextReplacement}`;
    setChatInput(nextInput);
    setChatMentions([]);
    window.setTimeout(() => chatInputRef.current?.setText(nextInput), 0);
  }

  async function createSession() {
    setChatStatus("loading");
    setExpandedTools(new Set());
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
    setExpandedTools(new Set());
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

  async function retryModels() {
    setModelStatus("loading");
    try {
      const models = await client.listAiModels();
      const nextModelId = models[0]?.id ?? "";
      setAiModels(models);
      setSelectedModelId(nextModelId);
      if (nextModelId) {
        window.localStorage.setItem(chatModelKey(bookId), nextModelId);
      }
      setModelStatus(nextModelId ? "ready" : "error");
    } catch {
      setModelStatus("error");
    }
  }

  function selectChatModel(modelId: string) {
    if (modelId === "__none") return;
    setSelectedModelId(modelId);
    window.localStorage.setItem(chatModelKey(bookId), modelId);
  }

  function insertDroppedMention(reference: WorkspaceMentionReference) {
    if (modelStatus !== "ready" || !selectedModelId) return;
    rememberReferences([reference]);
    chatInputRef.current?.insertMention(reference);
  }

  function handleQuoteToChat(chapterId: string, chapterName: string, range: string) {
    if (chatStatus === "streaming") return;
    chatInputRef.current?.insertQuoteMention(
      { id: chapterId, name: chapterName, summary: "", type: "chapter" },
      range
    );
  }

  async function sendMessage() {
    const message = chatInput;
    if (!message.trim() || !selectedModelId) return;
    if (chatStatus === "streaming") {
      abortRef.current?.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const currentController = controller;
    let sessionId = activeSessionId;
    if (!sessionId) {
      const session = await client.createChatSession(bookId);
      setSessions((items) => [session, ...items]);
      setActiveSessionId(session.id);
      sessionId = session.id;
    }
    const references = dedupeReferences([...pendingReferences]);
    rememberReferences(references);
    const userMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: message,
      actions: [],
      createdAt: new Date().toISOString()
    };
    const assistantId = `local-assistant-${Date.now()}`;
    setStreamingMessageId(assistantId);
    const assistantDraft: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      actions: [],
      createdAt: new Date().toISOString()
    };
    setMessages((items) => [...items, userMessage, assistantDraft]);
    clearChatDraft();
    setChatStatus("streaming");
    window.setTimeout(() => chatInputRef.current?.focus(), 0);
    let sseErrorShown = false;
    try {
      const final = await client.streamChatMessage(
        sessionId,
        message,
        (chunk) => {
          setMessages((items) =>
            items.map((item) => {
              if (item.id !== assistantId) return item;
              const blocks = item.blocks ?? [];
              const last = blocks[blocks.length - 1];
              const updatedBlocks = (last && last.type === "text")
                ? blocks.map((b, i) => i === blocks.length - 1 && b.type === "text" ? { ...b, text: b.text + chunk } : b)
                : [...blocks, { type: "text" as const, text: chunk }];
              return { ...item, content: item.content + chunk, blocks: updatedBlocks };
            })
          );
        },
        selectedModelId,
        thinkingIntensity !== "none" ? ({ low: 0.25, medium: 0.5, high: 0.75, xhigh: 1.0 }[thinkingIntensity]) : undefined,
        (tool, status, data) => {
          setMessages((items) =>
            items.map((item) => {
              if (item.id !== assistantId) return item;
              const blocks = item.blocks ?? [];
              if (status === "started") {
                return {
                  ...item,
                  blocks: [...blocks, { type: "tool_call", tool, display: data?.display ?? toolLabel(tool), status: "started" as const }],
                };
              } else {
                let startedIdx = -1;
                for (let index = blocks.length - 1; index >= 0; index -= 1) {
                  const block = blocks[index];
                  if (block.type === "tool_call" && block.tool === tool && block.status === "started") {
                    startedIdx = index;
                    break;
                  }
                }
                if (startedIdx === -1) {
                  return {
                    ...item,
                    blocks: [
                      ...blocks,
                      {
                        type: "tool_call",
                        tool,
                        display: data?.display ?? toolLabel(tool),
                        status: (status === "error" ? "error" : "completed") as "error" | "completed",
                        result: data?.result
                      }
                    ],
                  };
                }
                setExpandedTools((prev) => new Set(prev).add(`${item.id}-tool-${startedIdx}`));
                const updated = blocks.map((b, i) =>
                  i === startedIdx
                    ? b.type === "tool_call"
                      ? { ...b, display: data?.display ?? b.display, status: (status === "error" ? "error" : "completed") as "error" | "completed", result: data?.result }
                      : b
                    : b
                );
                return { ...item, blocks: updated };
              }
            })
          );

          // Sync workspace data when tool execution completes
          if (status === "completed" && data?.result) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let result: any;
            try {
              result = JSON.parse(data.result);
            } catch {
              return;
            }
            try {
              switch (tool) {
                case "create_or_update_character": {
                  if (result.id && result.name) {
                    const mapped: NamedContent = {
                      id: result.id,
                      name: result.name,
                      summary: result.summary ?? "",
                      detail: result.detail ?? "",
                      type: result.type,
                      updatedAt: result.updated_at ?? "",
                    };
                    setCharacters((prev) => {
                      const exists = prev.some((c) => c.id === mapped.id);
                      return exists ? prev.map((c) => (c.id === mapped.id ? mapped : c)) : [mapped, ...prev];
                    });
                    setActiveCharacterId(mapped.id);
                  }
                  break;
                }
                case "delete_character": {
                  const characterDeletedId = (result.character_id ?? result.id) as string | undefined;
                  if (characterDeletedId) {
                    setCharacters((prev) => {
                      const remaining = prev.filter((c) => c.id !== characterDeletedId);
                      if (activeCharacterIdRef.current === characterDeletedId) {
                        setActiveCharacterId(remaining[0]?.id ?? "");
                      }
                      return remaining;
                    });
                  }
                  break;
                }
                case "create_or_update_setting": {
                  if (result.id && result.name) {
                    const mapped: NamedContent = {
                      id: result.id,
                      name: result.name,
                      summary: result.summary ?? "",
                      detail: result.detail ?? "",
                      type: result.type,
                      updatedAt: result.updated_at ?? "",
                    };
                    setSettings((prev) => {
                      const exists = prev.some((s) => s.id === mapped.id);
                      return exists ? prev.map((s) => (s.id === mapped.id ? mapped : s)) : [mapped, ...prev];
                    });
                    setActiveSettingId(mapped.id);
                  }
                  break;
                }
                case "delete_setting": {
                  const settingDeletedId = (result.setting_id ?? result.id) as string | undefined;
                  if (settingDeletedId) {
                    setSettings((prev) => {
                      const remaining = prev.filter((s) => s.id !== settingDeletedId);
                      if (activeSettingIdRef.current === settingDeletedId) {
                        setActiveSettingId(remaining[0]?.id ?? "");
                      }
                      return remaining;
                    });
                  }
                  break;
                }
                case "update_chapter": {
                  const chapterId = (result.chapter_id ?? result.id) as string;
                  if (!chapterId) break;
                  const hasContentChange = result.content_changed === true || result.old_content_preview != null;
                  if (hasContentChange) {
                    // Content was modified — refresh full chapter data from server
                    void client.listChapters(bookId).then((freshChapters) => {
                      setChapters(freshChapters);
                      const freshChapter = freshChapters.find((chapter) => chapter.id === chapterId);
                      if (!freshChapter) return;
                      if (activeChapterIdRef.current === chapterId) {
                        const idleMs = Date.now() - lastEditTimeRef.current;
                        if (idleMs >= 3000) {
                          setTitle(freshChapter.title);
                          setSummary(freshChapter.summary);
                          setSummaryDraft(freshChapter.summary);
                          setContent(freshChapter.content);
                          titleRef.current = freshChapter.title;
                          summaryRef.current = freshChapter.summary;
                          contentRef.current = freshChapter.content;
                          draftContentRef.current = freshChapter.content;
                          pendingAddedWordsRef.current = 0;
                          setStatus("saved");
                        } else {
                          pendingRemoteUpdateRef.current = {
                            title: freshChapter.title,
                            summary: freshChapter.summary,
                            content: freshChapter.content,
                          };
                          setRemoteUpdateNotice(`AI 已修改「${freshChapter.title}」的内容`);
                        }
                      }
                    }).catch(() => undefined);
                  } else {
                    // Only title/summary changed — update from tool result
                    const newTitle = (result.title as string) ?? "";
                    const newSummary = (result.summary as string) ?? "";
                    setChapters((prev) =>
                      prev.map((ch) => {
                        if (ch.id !== chapterId) return ch;
                        const updated = { ...ch };
                        if (newTitle) updated.title = newTitle;
                        if (result.summary !== undefined) updated.summary = newSummary;
                        return updated;
                      })
                    );
                    if (activeChapterIdRef.current === chapterId) {
                      if (newTitle) {
                        setTitle(newTitle);
                        titleRef.current = newTitle;
                      }
                      if (result.summary !== undefined) {
                        setSummary(newSummary);
                        setSummaryDraft(newSummary);
                        summaryRef.current = newSummary;
                      }
                    }
                  }
                  break;
                }
                case "create_chapter": {
                  if (result.id && result.title) {
                    const newChapter = {
                      id: result.id,
                      order: result.order_index,
                      title: result.title,
                      content: "",
                      summary: result.summary ?? "",
                      volumeId: result.volume_id ?? "",
                    };
                    setChapters((prev) => {
                      const exists = prev.some((ch) => ch.id === newChapter.id);
                      if (exists) return prev;
                      const inserted = [...prev, newChapter].sort((a, b) => a.order - b.order);
                      return inserted;
                    });
                    setActiveChapterId(newChapter.id);
                    setTitle(newChapter.title);
                    setContent("");
                    setSummary(newChapter.summary);
                    setSummaryDraft(newChapter.summary);
                  }
                  break;
                }
                case "update_work_info": {
                  const field = result.field as string;
                  const value = result.value as string;
                  setWork((prev) => {
                    if (!prev) return prev;
                    const updates: Partial<Work> = {};
                    if (field === "title") updates.title = value;
                    else if (field === "short_intro") updates.shortIntro = value;
                    else if (field === "synopsis") updates.synopsis = value;
                    else if (field === "background_rules") updates.backgroundRules = value;
                    else if (field === "focus_requirements") updates.focusRequirements = value;
                    else if (field === "forbidden_requirements") updates.forbiddenRequirements = value;
                    else if (field === "tags") updates.tags = value.split(",").map((t: string) => t.trim()).filter(Boolean);
                    return { ...prev, ...updates };
                  });
                  break;
                }
              }
            } catch (err) {
              console.error("[workspace] tool sync error:", tool, err);
            }
          }
        },
        (errorMessage) => {
          if (errorMessage.includes("interrupted") || errorMessage.includes("cancelled")) {
            return;
          }
          sseErrorShown = true;
          setMessages((items) =>
            items.map((item) => (item.id === assistantId ? { ...item, error: errorMessage } : item))
          );
        },
        controller.signal
      );
      setMessages((items) =>
        items.map((item) => {
          if (item.id !== assistantId) return item;
          const resolvedBlocks = final.blocks ?? item.blocks;
          return {
            ...item,
            ...final,
            ...(resolvedBlocks && resolvedBlocks.length ? { blocks: resolvedBlocks } : {})
          };
        })
      );
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
      try {
        const nextProfile = await client.getMe();
        setProfile(nextProfile);
        setNicknameDraft(nextProfile.user.nickname);
      } catch {
        // Ignore balance refresh failures so chat completion is not blocked.
      }
    } catch (error) {
      if (abortRef.current !== currentController) {
        return;
      }
      setStreamingMessageId(null);
      if (error instanceof DOMException && error.name === "AbortError") {
        setChatStatus("idle");
        return;
      }
      if (!sseErrorShown) {
        const errorMsg = error instanceof ApiError && error.status === 402
          ? "积分不足，暂时无法发送"
          : "发送失败，请稍后重试";
        setMessages((items) =>
          items.map((item) => (item.id === assistantId ? { ...item, error: errorMsg } : item))
        );
      }
      setChatStatus("idle");
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

  async function deleteCharacterConfirm() {
    if (!activeCharacter) return;
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

  async function saveWorkEdit() {
    if (!work) return;
    setWorkSaveStatus("saving");
    try {
      const updated = await client.updateWork({
        ...work,
        title: workDraft.title.trim(),
        shortIntro: workDraft.shortIntro.trim(),
        synopsis: workDraft.synopsis.trim(),
        backgroundRules: workDraft.backgroundRules.trim(),
        focusRequirements: workDraft.focusRequirements.trim(),
        forbiddenRequirements: workDraft.forbiddenRequirements.trim(),
        tags: workDraft.tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      setWork(updated);
      setWorkEditOpen(false);
      setWorkSaveStatus("idle");
    } catch {
      setWorkSaveStatus("error");
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

  async function deleteSettingConfirm() {
    if (!activeSetting) return;
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

  function openCreateVolume() {
    setVolumeDraft(`第 ${volumes.length + 1} 卷`);
    setVolumeStatus("ready");
    setVolumeCreateOpen(true);
  }

  async function saveVolume() {
    setStatus("saving");
    setVolumeStatus("saving");
    try {
      const created = await client.createVolume(bookId, volumeDraft.trim() || `第 ${volumes.length + 1} 卷`);
      setVolumes((items) => [...items, created]);
      setVolumeCreateOpen(false);
      setVolumeStatus("ready");
      setStatus("saved");
    } catch {
      setVolumeStatus("error");
      setStatus("error");
      setAnalysisNotice("新建卷失败，请稍后重试");
    }
  }

  function openEditVolume(volume: Volume) {
    setEditingVolumeId(volume.id);
    setVolumeEditDraft(volume.title);
    setVolumeEditOpen(true);
  }

  async function saveVolumeEdit() {
    if (!editingVolumeId) return;
    const title = volumeEditDraft.trim();
    if (!title) return;
    setStatus("saving");
    try {
      const updated = await client.updateVolume(bookId, editingVolumeId, title);
      setVolumes((items) => items.map((v) => (v.id === editingVolumeId ? updated : v)));
      setVolumeEditOpen(false);
      setEditingVolumeId("");
      setStatus("saved");
    } catch {
      setStatus("error");
      setAnalysisNotice("重命名卷失败，请稍后重试");
    }
  }

  function openDeleteVolume(volume: Volume) {
    setVolumeDeleteConfirm(volume);
  }

  async function confirmDeleteVolume() {
    const volume = volumeDeleteConfirm;
    if (!volume) return;
    setStatus("saving");
    try {
      await client.deleteVolume(bookId, volume.id);
      setVolumes((items) => items.filter((v) => v.id !== volume.id));
      setVolumeDeleteConfirm(null);
      setStatus("saved");
    } catch {
      setStatus("error");
      setAnalysisNotice("删除卷失败，请稍后重试");
    }
  }

  async function handleReorderChapter(chapterId: string, targetVolumeId: string, targetOrder: number) {
    const sourceChapter = chapters.find((c) => c.id === chapterId);
    if (!sourceChapter) return;

    const sourceVolId = sourceChapter.volumeId || "";
    const sourceVolChapters = chapters.filter((c) => (c.volumeId || "") === sourceVolId);
    const currentIndex = sourceVolChapters.findIndex((c) => c.id === chapterId);
    if (sourceVolId === targetVolumeId && currentIndex === targetOrder) return;

    const remaining = chapters.filter((c) => c.id !== chapterId);
    const newChapters = [...remaining];

    const beforeIndex = newChapters.findIndex((c) => {
      const cVolId = c.volumeId || "";
      if (cVolId !== targetVolumeId) return false;
      const targetChapters = chapters.filter((ch) => (ch.volumeId || "") === targetVolumeId);
      const targetChIndex = targetChapters.findIndex((tc) => tc.id === c.id);
      return targetChIndex >= targetOrder;
    });

    const inserted = { ...sourceChapter, volumeId: targetVolumeId };
    if (beforeIndex === -1) {
      newChapters.push(inserted);
    } else {
      newChapters.splice(beforeIndex, 0, inserted);
    }

    const prevChapters = chapters;
    setChapters(newChapters);

    try {
      await client.reorderChapters(
        bookId,
        newChapters.map((c) => ({ id: c.id, volumeId: c.volumeId || "" }))
      );
    } catch {
      setChapters(prevChapters);
      setAnalysisNotice("章节排序保存失败，已还原");
    }
  }

  function startCreateNote() {
    setNoteDraft({ title: "", content: "", category: "灵感" });
    setActiveNoteId("");
    setNoteMode("create");
    setNoteStatus("ready");
    setNoteError("");
  }

  function startEditNote(note: InspirationNote) {
    setNoteDraft({ title: note.title, content: note.content, category: note.category });
    setActiveNoteId(note.id);
    setNoteMode("edit");
    setNoteStatus("ready");
    setNoteError("");
  }

  async function saveNote() {
    const title = noteDraft.title.trim();
    const content = noteDraft.content.trim();
    const category = noteDraft.category.trim() || "灵感";
    if (!title) {
      setNoteStatus("error");
      setNoteError("便签标题不能为空");
      return;
    }

    setNoteStatus("saving");
    setNoteError("");
    try {
      if (noteMode === "create") {
        const created = await client.createInspirationNote(bookId, { title, content, category });
        setInspirationNotes((items) => [created, ...items]);
      } else if (activeNoteId) {
        const updated = await client.updateInspirationNote(bookId, { id: activeNoteId, title, content, category });
        setInspirationNotes((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      }
      setNoteMode("idle");
      setNoteStatus("ready");
    } catch {
      setNoteStatus("error");
      setNoteError("保存便签失败，请稍后重试");
    }
  }

  async function deleteNote(note: InspirationNote) {
    try {
      await client.deleteInspirationNote(bookId, note.id);
      setInspirationNotes((items) => items.filter((item) => item.id !== note.id));
    } catch {
      setCopyNotice("删除便签失败");
      window.setTimeout(() => setCopyNotice(""), 1600);
    }
  }

  function openGoalEdit() {
    setGoalDraft({ targetWords: String(writingGoal.targetWords || 2000) });
    setGoalStatus("ready");
    setGoalEditOpen(true);
  }

  async function saveGoal() {
    const targetWords = Number(goalDraft.targetWords);
    if (!Number.isFinite(targetWords) || targetWords < 1) {
      setGoalStatus("error");
      return;
    }
    setGoalStatus("saving");
    try {
      const result = await client.updateWritingGoal(bookId, {
        targetWords: Math.round(targetWords)
      });
      setWritingGoal(result.goal);
      setDailyWordProgress(result.dailyWordProgress);
      setGoalEditOpen(false);
      setGoalStatus("ready");
    } catch {
      setGoalStatus("error");
    }
  }

  async function loadBillingProducts() {
    setBillingStatus("loading");
    try {
      setBillingProducts(await client.listBillingProducts());
      setBillingStatus("idle");
    } catch {
      setBillingStatus("error");
    }
  }

  async function openAccount() {
    setAccountOpen(true);
    if (!billingProducts.plans.length && !billingProducts.creditPacks.length && billingStatus !== "loading") {
      void loadBillingProducts();
    }
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
      setNicknameEditOpen(false);
      setAccountStatus("idle");
    } catch {
      setAccountStatus("error");
    }
  }

  async function createOrder(productType: "plan" | "credit_pack", productId: string) {
    setAccountOpen(false);
    setPaymentOpen(true);
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

  function renderMarkdown(text: string, isStreaming = false) {
    return (
      <Streamdown
        className={cn("chat-md break-words", isStreaming && "streaming-cursor")}
        isAnimating={isStreaming}
        plugins={CHAT_MARKDOWN_PLUGINS}
      >
        {text}
      </Streamdown>
    );
  }

  function toggleToolExpand(key: string) {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function renderMessageContent(message: ChatMessage) {
    const isStreaming = message.id === streamingMessageId;

    // Render with blocks (streaming + completed messages with tool calls)
    if (message.blocks && message.blocks.length > 0) {
      // Check if last block is text and streaming — add cursor
      const lastBlockIdx = message.blocks.length - 1;
      return (
        <div className="space-y-2">
          {message.blocks.map((block, index) => {
            if (block.type === "text") {
              if (!block.text) return null;
              const isLastText = index === lastBlockIdx && isStreaming;
              return <div key={`text-${index}`}>{renderMarkdown(block.text, isLastText)}</div>;
            }
            const toolKey = `${message.id}-tool-${index}`;
            const isStarted = block.status === "started";
            const isExpanded = expandedTools.has(toolKey) || isStarted;
            return (
              <WorkspaceToolCall
                key={`tool-${index}`}
                block={block}
                expanded={isExpanded}
                onToggle={() => toggleToolExpand(toolKey)}
              />
            );
          })}
        </div>
      );
    }

    // Render without blocks (simple messages, user messages with ref marks)
    const refMarks = parseRefMarks(message.content);
    if (!refMarks.length) return renderMarkdown(message.content, isStreaming);

    const nodes: ReactNode[] = [];
    let cursor = 0;
    refMarks.forEach((mark, index) => {
      if (mark.start > cursor) {
        nodes.push(<span key={`t-${index}`}>{message.content.slice(cursor, mark.start)}</span>);
      }
      const display = mark.range ? `@${mark.label} [${mark.range}]` : `@${mark.label}`;
      nodes.push(
        <span key={`r-${index}`} className={cn("mx-0.5 rounded border px-1.5 py-0.5 text-xs", referenceTone(mark.type))}>
          {display}
        </span>
      );
      cursor = mark.end;
    });
    if (cursor < message.content.length) {
      nodes.push(<span key="tail">{message.content.slice(cursor)}</span>);
    }
    return <p>{nodes}</p>;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white font-sans text-[#171717]">
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
          minSize="220px"
          maxSize="30%"
          panelRef={workspaceSidebarRef}
          className="min-h-0 min-w-0"
        >
          <WorkspaceSidebarPanel
            work={work}
            onOpenWorkEdit={() => {
              if (work) {
                setWorkDraft({
                  title: work.title,
                  shortIntro: work.shortIntro,
                  synopsis: work.synopsis,
                  backgroundRules: work.backgroundRules,
                  focusRequirements: work.focusRequirements,
                  forbiddenRequirements: work.forbiddenRequirements,
                  tags: (work.tags ?? []).join(", "),
                });
              }
              setWorkEditOpen(true);
            }}
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
            moduleMeta={moduleMeta}
            volumes={volumes}
            chapters={chapters}
            activeChapterId={activeChapterId}
            onSelectChapter={(chapterId) => void selectChapter(chapterId)}
            onCreateChapter={(volumeId) => void createChapter(volumeId)}
            onCreateVolume={openCreateVolume}
            isWorkspaceLoading={status === "loading"}
            characterSearch={characterSearch}
            onCharacterSearchChange={setCharacterSearch}
            copyNotice={copyNotice}
            characters={characters}
            filteredCharacters={filteredCharacters}
            activeCharacter={activeCharacter}
            isCharacterDetail={characterMode === "detail"}
            onSelectCharacter={selectCharacter}
            onStartCreateCharacter={startCreateCharacter}
            onStartEditCharacter={(item) => {
              selectCharacter(item);
              startEditCharacter();
            }}
            onDeleteCharacter={(item) => {
              selectCharacter(item);
              setCharacterDeleteConfirm(true);
            }}
            settingSearch={settingSearch}
            onSettingSearchChange={setSettingSearch}
            settingType={settingType}
            onSettingTypeChange={setSettingType}
            settingTypes={settingTypes}
            settings={settings}
            filteredSettings={filteredSettings}
            activeSetting={activeSetting}
            isSettingDetail={settingMode === "detail"}
            onSelectSetting={selectSetting}
            onStartCreateSetting={startCreateSetting}
            onStartEditSetting={(item) => {
              selectSetting(item);
              startEditSetting();
            }}
            onDeleteSetting={(item) => {
              selectSetting(item);
              setSettingDeleteConfirm(true);
            }}
            inspirationNotes={inspirationNotes}
            writingGoal={writingGoal}
            dailyWordProgress={dailyWordProgress}
            onStartCreateNote={startCreateNote}
            onStartEditNote={startEditNote}
            onDeleteNote={(item) => void deleteNote(item)}
            onOpenGoalEdit={openGoalEdit}
            formatUpdatedAt={formatUpdatedAt}
            collapsedVolumes={collapsedVolumes}
            onToggleCollapse={toggleCollapse}
            onEditVolume={openEditVolume}
            onDeleteVolume={openDeleteVolume}
            onReorderChapter={handleReorderChapter}
          />
        </ResizablePanel>

        <ResizableHandle withHandle aria-label="调整目录与正文宽度" className="z-30" />

        <ResizablePanel
          id="workspace-editor"
          defaultSize={`${workspaceDefaultLayout?.["workspace-editor"] ?? 56}%`}
          minSize="360px"
          panelRef={workspaceEditorRef}
          className="min-h-0 min-w-0"
        >
          <WorkspaceEditorPanel
            activeChapter={activeChapter}
            chapterOrder={chapterOrder}
            title={title}
            summary={summary}
            content={content}
            status={status}
            statusLabel={statusMeta.label}
            statusTone={statusMeta.tone}
            StatusIcon={StatusIcon}
            count={count}
            todayCount={todayCount}
            analysisNotice={analysisNotice}
            suggestions={suggestions}
            activeSuggestionIndex={activeSuggestionIndex}
            accountLabel={profile?.user.nickname || "账户中心"}
            accountSubtitle={profile?.subscription ? "VIP 创作中" : "免费版"}
            styleSettings={{
              fontStack: editorFontStack,
              fontSize: editorSettings.fontSize,
              lineHeight: editorSettings.lineHeight,
              letterSpacing: editorSettings.letterSpacing,
              paragraphSpacing: editorSettings.paragraphSpacing,
            }}
            onTitleChange={setTitle}
            onOpenSummaryModal={openSummaryModal}
            onDeleteChapter={() => setChapterDeleteOpen(true)}
            onPreview={() => {
              const chapterId = activeChapterIdRef.current;
              if (chapterId) window.open(`/books/${bookId}/preview?chapterId=${chapterId}`, "_blank");
            }}
            onOpenShare={() => setShareDialogOpen(true)}
            onOpenEditorSettings={() => setEditorSettingsOpen(true)}
            onOpenVersionHistory={() => setVersionHistoryOpen(true)}
            onOpenAccount={() => void openAccount()}
            showSuggestions={activeChatTab === "suggestions"}
            onAnalyze={() => void analyze()}
            onContentChange={updateContent}
            onActivateSuggestion={(index) => {
              setActiveSuggestionIndex(index);
              setActiveChatTab("suggestions");
            }}
            onQuoteToChat={activeChapter ? (range) => handleQuoteToChat(activeChapter.id, activeChapter.title, range) : undefined}
            remoteUpdateNotice={remoteUpdateNotice}
            onAcceptRemoteUpdate={acceptRemoteUpdate}
          />
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
          <WorkspaceChatPanel
            activeTab={activeChatTab}
            onTabChange={setActiveChatTab}
            suggestions={suggestions}
            activeSuggestionIndex={activeSuggestionIndex}
            persistedAnalysis={persistedAnalysis}
            onSelectSuggestion={setActiveSuggestionIndex}
            staleIndices={staleSet}
            onAcceptSuggestion={(index) => void acceptSuggestion(index)}
            onSendSuggestionToChat={sendSuggestionToChat}
            chatStatus={chatStatus}
            activeSession={activeSession}
            showHistory={showHistory}
            onHistoryOpenChange={setShowHistory}
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSwitchSession={(sessionId) => void switchSession(sessionId)}
            onCreateSession={() => void createSession()}
            hasMoreMessages={hasMoreMessages}
            onLoadOlderMessages={() => void loadOlderMessages()}
            messages={messages}
            renderMessageContent={renderMessageContent}
            modelStatus={modelStatus}
            selectedModel={selectedModel}
            aiModels={aiModels}
            selectedModelId={selectedModelId}
            onRetryModels={() => void retryModels()}
            onSelectChatModel={selectChatModel}
            thinkingIntensity={thinkingIntensity}
            onThinkingIntensityChange={setThinkingIntensity}
            chatInputRef={chatInputRef}
            chatInput={chatInput}
            chatMentions={chatMentions}
            allReferenceItems={allReferenceItems}
            recentReferences={recentReferences}
            pendingReferences={pendingReferences}
            chatInputDisabled={modelStatus !== "ready" || !selectedModelId}
            onStop={() => {
              abortRef.current?.abort();
              setChatStatus("idle");
              setStreamingMessageId(null);
            }}
            onInputChange={(text, mentions) => {
              setChatInput(text);
              setChatMentions(mentions);
            }}
            onSelectReference={(reference) => rememberReferences([reference])}
            onRemoveReference={(reference) =>
              setPendingReferences((items) => items.filter((item) => referenceKey(item) !== referenceKey(reference)))
            }
            onSubmit={() => void sendMessage()}
            onMentionDrop={insertDroppedMention}
            workTitle={work?.title || ""}
            currentChapterRef={currentChapterRef}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
      ) : null}

      <AnalyzeProgressModal
        open={progressOpen}
        checks={enabledChecks}
        progress={checkProgress}
        errors={checkErrors}
        hasResults={suggestions.length > 0}
        onCancel={cancelAnalysis}
        onViewResults={() => { setProgressOpen(false); setActiveChatTab("suggestions"); }}
      />

      <Dialog open={summaryModalOpen} onOpenChange={setSummaryModalOpen}>
        <DialogContent className="overflow-hidden rounded-xl bg-white p-0 shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#00000014] sm:max-w-lg [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:text-[#888888] [&_[data-slot=dialog-close]]:hover:bg-[#f5f5f5] [&_[data-slot=dialog-close]]:hover:text-[#171717]">
          <DialogHeader className="border-b border-[#ebebeb] px-6 py-5">
            <DialogTitle className="text-xl font-semibold tracking-[-0.6px] text-[#171717]">编辑章节提要</DialogTitle>
            <DialogDescription className="mt-1 text-sm leading-5 text-[#888888]">章节提要会作为列表预览和 AI 上下文的一部分。</DialogDescription>
          </DialogHeader>
          <FieldGroup className="p-6">
            <Field>
              <FieldLabel>章节提要</FieldLabel>
              <Textarea
                aria-label="章节提要"
                value={summaryDraft}
                onChange={(event) => setSummaryDraft(event.target.value)}
                className="h-40 resize-none rounded-sm border-[#ebebeb] bg-white leading-6"
                placeholder="写下这一章的核心事件、情绪转折或悬念..."
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mx-0 mb-0 rounded-none bg-white flex items-center justify-end gap-4 border-t border-[#ebebeb] px-6 py-5">
            <Button variant="outline" className="rounded-full border-[#ebebeb] bg-white text-[#171717] hover:bg-[#fafafa]" onClick={() => setSummaryModalOpen(false)}>
              取消
            </Button>
            <Button className="rounded-full bg-[#171717] text-white hover:bg-[#171717]/90" onClick={() => void saveSummary()}>
              <Check data-icon="inline-start" />
              保存更改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={chapterDeleteOpen} onOpenChange={setChapterDeleteOpen}>
        <AlertDialogContent className="overflow-hidden rounded-xl bg-white p-0 shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#00000014] sm:max-w-sm">
          <AlertDialogHeader className="border-b border-[#ebebeb] px-6 py-5 text-left">
            <AlertDialogTitle className="text-xl font-semibold tracking-[-0.6px] text-[#171717]">确认删除章节？</AlertDialogTitle>
            <AlertDialogDescription className="mt-1 text-sm leading-5 text-[#888888]">
              将删除「{activeChapter?.title ?? "当前章节"}」的标题、正文和提要。删除后会自动切换到相邻章节。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mx-0 mb-0 rounded-none bg-white flex items-center justify-end gap-4 border-t border-[#ebebeb] px-6 py-5">
            <AlertDialogCancel className="rounded-full border-[#ebebeb] bg-white text-[#171717] hover:bg-[#fafafa]">取消</AlertDialogCancel>
            <AlertDialogAction className="rounded-full bg-[#ee0000] text-white hover:bg-[#c50000]" onClick={() => void deleteActiveChapter()}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={characterMode === "create" || characterMode === "edit"}
        onOpenChange={(open) => {
          if (!open) setCharacterMode("detail");
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-white p-0 shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#00000014] sm:max-w-3xl lg:max-w-4xl [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:z-20 [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:text-[#888888] [&_[data-slot=dialog-close]]:hover:bg-[#f5f5f5] [&_[data-slot=dialog-close]]:hover:text-[#171717]">
          <DialogHeader className="sr-only">
            <DialogTitle>{characterMode === "create" ? "新建角色" : "编辑角色"}</DialogTitle>
            <DialogDescription>维护角色名称、简介和可供 AI 引用的详细设定。</DialogDescription>
          </DialogHeader>
          <div className="text-[#171717]">
            <div className="border-b border-[#ebebeb] px-6 py-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-10 place-items-center rounded-full border border-[#ebebeb] bg-white text-[#171717]"><UserRound size={18} /></span>
                <div>
                  <h2 className="text-xl font-semibold tracking-[-0.6px]">{characterMode === "create" ? "新建角色" : "编辑角色"}</h2>
                  <p className="mt-1 text-sm leading-5 text-[#888888]">角色资料会进入 AI 可引用的作品上下文。</p>
                </div>
              </div>
            </div>
            <div className="grid gap-5 p-6 sm:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="rounded-xl border border-[#171717] bg-[#171717] p-5 text-white">
                <h3 className="line-clamp-2 text-xl font-semibold tracking-[-0.6px]">{characterDraft.name || "未命名角色"}</h3>
                <p className="mt-3 line-clamp-5 text-sm leading-5 text-white/60">{characterDraft.summary || "用一句话写清角色身份、气质或当前处境。"}</p>
              </aside>
              <FieldGroup>
                <Field>
                  <FieldLabel>角色名称</FieldLabel>
                  <Input aria-label="角色名称" value={characterDraft.name} onChange={(event) => setCharacterDraft((value) => ({ ...value, name: event.target.value }))} className="h-11 rounded-sm border-[#ebebeb] bg-white font-semibold" placeholder="例如：林雾" />
                </Field>
                <Field>
                  <FieldLabel>角色简介</FieldLabel>
                  <Textarea aria-label="角色简介" value={characterDraft.summary} onChange={(event) => setCharacterDraft((value) => ({ ...value, summary: event.target.value }))} className="min-h-24 resize-none rounded-sm border-[#ebebeb] bg-white leading-6" placeholder="一句话说明身份、气质或当前处境。" />
                </Field>
                <Field>
                  <FieldLabel>角色详情</FieldLabel>
                  <Textarea aria-label="角色详情" value={characterDraft.detail} onChange={(event) => setCharacterDraft((value) => ({ ...value, detail: event.target.value }))} className="min-h-40 resize-none rounded-sm border-[#ebebeb] bg-white leading-6" placeholder="经历、关系、能力、秘密、人物弧光。" />
                </Field>
                {characterStatus === "error" && characterError ? <FieldError>{characterError}</FieldError> : null}
              </FieldGroup>
            </div>
            <DialogFooter className="mx-0 mb-0 rounded-none bg-white flex items-center justify-end gap-4 border-t border-[#ebebeb] px-6 py-5">
              <Button variant="outline" className="rounded-full border-[#ebebeb] bg-white text-[#171717] hover:bg-[#fafafa]" onClick={() => setCharacterMode("detail")}>
                取消
              </Button>
              <Button className="rounded-full bg-[#171717] text-white hover:bg-[#171717]/90" onClick={() => void saveCharacter()} disabled={characterStatus === "saving"}>
                {characterStatus === "saving" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
                保存角色
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={characterDeleteConfirm} onOpenChange={setCharacterDeleteConfirm}>
        <AlertDialogContent className="overflow-hidden rounded-xl bg-white p-0 shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#00000014] sm:max-w-sm">
          <AlertDialogHeader className="border-b border-[#ebebeb] px-6 py-5 text-left">
            <AlertDialogTitle className="text-xl font-semibold tracking-[-0.6px] text-[#171717]">确认删除角色？</AlertDialogTitle>
            <AlertDialogDescription className="mt-1 text-sm leading-5 text-[#888888]">
              将删除角色「{activeCharacter?.name ?? "选中角色"}」的所有信息。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mx-0 mb-0 rounded-none bg-white flex items-center justify-end gap-4 border-t border-[#ebebeb] px-6 py-5">
            <AlertDialogCancel className="rounded-full border-[#ebebeb] bg-white text-[#171717] hover:bg-[#fafafa]">取消</AlertDialogCancel>
            <AlertDialogAction className="rounded-full bg-[#ee0000] text-white hover:bg-[#c50000]" onClick={() => void deleteCharacterConfirm()}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={settingMode === "create" || settingMode === "edit"}
        onOpenChange={(open) => {
          if (!open) setSettingMode("detail");
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-white p-0 shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#00000014] sm:max-w-3xl lg:max-w-4xl [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:z-20 [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:text-[#888888] [&_[data-slot=dialog-close]]:hover:bg-[#f5f5f5] [&_[data-slot=dialog-close]]:hover:text-[#171717]">
          <DialogHeader className="sr-only">
            <DialogTitle>{settingMode === "create" ? "新建设定" : "编辑设定"}</DialogTitle>
            <DialogDescription>维护设定类型、简介和可供 AI 引用的详细内容。</DialogDescription>
          </DialogHeader>
          <div className="text-[#171717]">
            <div className="border-b border-[#ebebeb] px-6 py-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-10 place-items-center rounded-full border border-[#ebebeb] bg-white text-[#171717]"><Database size={18} /></span>
                <div>
                  <h2 className="text-xl font-semibold tracking-[-0.6px]">{settingMode === "create" ? "新建设定" : "编辑设定"}</h2>
                  <p className="mt-1 text-sm leading-5 text-[#888888]">地点、规则、组织和物品都可以作为设定保存。</p>
                </div>
              </div>
            </div>
            <div className="grid gap-5 p-6 sm:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="rounded-xl border border-[#ebebeb] bg-[#fafafa] p-5">
                <h3 className="line-clamp-2 text-xl font-semibold tracking-[-0.6px]">{settingDraft.name || "未命名设定"}</h3>
                <p className="mt-3 line-clamp-5 text-sm leading-5 text-[#888888]">{settingDraft.summary || "用一句话说明这个设定的作用。"}</p>
              </aside>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <Field>
                    <FieldLabel>设定类型</FieldLabel>
                    <Select value={settingDraft.type} onValueChange={(value) => setSettingDraft((draft) => ({ ...draft, type: value }))}>
                      <SelectTrigger className="h-11 w-full rounded-sm border-[#ebebeb] bg-white data-[size=default]:h-11" aria-label="设定类型"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectGroup>{settingTypes.filter((item) => item.value !== "all").map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>设定名称</FieldLabel>
                    <Input aria-label="设定名称" value={settingDraft.name} onChange={(event) => setSettingDraft((value) => ({ ...value, name: event.target.value }))} className="h-11 rounded-sm border-[#ebebeb] bg-white font-semibold" placeholder="例如：雾港学院" />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>设定简介</FieldLabel>
                  <Textarea aria-label="设定简介" value={settingDraft.summary} onChange={(event) => setSettingDraft((value) => ({ ...value, summary: event.target.value }))} className="min-h-24 resize-none rounded-sm border-[#ebebeb] bg-white leading-6" placeholder="一句话说明这个设定的作用。" />
                </Field>
                <Field>
                  <FieldLabel>设定详情</FieldLabel>
                  <Textarea aria-label="设定详情" className="min-h-40 resize-none rounded-sm border-[#ebebeb] bg-white leading-6" value={settingDraft.detail} onChange={(event) => setSettingDraft((value) => ({ ...value, detail: event.target.value }))} placeholder="规则、限制、历史、和角色或章节的关联。" />
                </Field>
                {settingStatus === "error" && settingError ? <FieldError>{settingError}</FieldError> : null}
              </FieldGroup>
            </div>
            <DialogFooter className="mx-0 mb-0 rounded-none bg-white flex items-center justify-end gap-4 border-t border-[#ebebeb] px-6 py-5">
              <Button variant="outline" className="rounded-full border-[#ebebeb] bg-white text-[#171717] hover:bg-[#fafafa]" onClick={() => setSettingMode("detail")}>
                取消
              </Button>
              <Button className="rounded-full bg-[#171717] text-white hover:bg-[#171717]/90" onClick={() => void saveSetting()} disabled={settingStatus === "saving"}>
                {settingStatus === "saving" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
                保存设定
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={settingDeleteConfirm} onOpenChange={setSettingDeleteConfirm}>
        <AlertDialogContent className="overflow-hidden rounded-xl bg-white p-0 shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#00000014] sm:max-w-sm">
          <AlertDialogHeader className="border-b border-[#ebebeb] px-6 py-5 text-left">
            <AlertDialogTitle className="text-xl font-semibold tracking-[-0.6px] text-[#171717]">确认删除设定？</AlertDialogTitle>
            <AlertDialogDescription className="mt-1 text-sm leading-5 text-[#888888]">
              将删除设定「{activeSetting?.name ?? "选中设定"}」的所有信息。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mx-0 mb-0 rounded-none bg-white flex items-center justify-end gap-4 border-t border-[#ebebeb] px-6 py-5">
            <AlertDialogCancel className="rounded-full border-[#ebebeb] bg-white text-[#171717] hover:bg-[#fafafa]">取消</AlertDialogCancel>
            <AlertDialogAction className="rounded-full bg-[#ee0000] text-white hover:bg-[#c50000]" onClick={() => void deleteSettingConfirm()}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={volumeCreateOpen} onOpenChange={setVolumeCreateOpen}>
        <DialogContent className="overflow-hidden rounded-xl bg-white p-0 shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#00000014] sm:max-w-md [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:text-[#888888] [&_[data-slot=dialog-close]]:hover:bg-[#f5f5f5] [&_[data-slot=dialog-close]]:hover:text-[#171717]">
          <DialogHeader className="border-b border-[#ebebeb] px-6 py-5">
            <DialogTitle className="text-xl font-semibold tracking-[-0.6px] text-[#171717]">新建卷</DialogTitle>
            <DialogDescription className="mt-1 text-sm leading-5 text-[#888888]">卷会绑定当前作品，新章节可以按卷归档。</DialogDescription>
          </DialogHeader>
          <FieldGroup className="p-6">
            <Field>
              <FieldLabel>卷名</FieldLabel>
              <Input
                aria-label="卷名"
                value={volumeDraft}
                onChange={(event) => setVolumeDraft(event.target.value)}
                className="h-11 rounded-sm border-[#ebebeb] bg-white font-semibold"
                placeholder="例如：第一卷 雾港"
              />
            </Field>
            <p className="mt-2 text-xs leading-4 text-[#888888]">
              建议用阶段、地点或主线变化命名。创建后可在侧栏中管理章节排序。
            </p>
            {volumeStatus === "error" ? <FieldError>新建卷失败，请稍后重试</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mx-0 mb-0 rounded-none bg-white flex items-center justify-end gap-4 border-t border-[#ebebeb] px-6 py-5">
            <Button variant="outline" className="rounded-full border-[#ebebeb] bg-white text-[#171717] hover:bg-[#fafafa]" onClick={() => setVolumeCreateOpen(false)}>取消</Button>
            <Button className="rounded-full bg-[#171717] text-white hover:bg-[#171717]/90" onClick={() => void saveVolume()} disabled={volumeStatus === "saving"}>
              {volumeStatus === "saving" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
              创建卷
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={volumeEditOpen} onOpenChange={setVolumeEditOpen}>
        <DialogContent className="overflow-hidden rounded-xl bg-white p-0 shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#00000014] sm:max-w-md [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:text-[#888888] [&_[data-slot=dialog-close]]:hover:bg-[#f5f5f5] [&_[data-slot=dialog-close]]:hover:text-[#171717]">
          <DialogHeader className="border-b border-[#ebebeb] px-6 py-5">
            <DialogTitle className="text-xl font-semibold tracking-[-0.6px] text-[#171717]">重命名卷</DialogTitle>
            <DialogDescription className="mt-1 text-sm leading-5 text-[#888888]">修改当前卷的名称。</DialogDescription>
          </DialogHeader>
          <FieldGroup className="p-6">
            <div className="mb-5 rounded-md border border-[#ebebeb] bg-[#fafafa] px-4 py-3">
              <p className="text-xs leading-4 text-[#888888]">当前名称</p>
              <p className="mt-1 text-sm font-medium text-[#171717]">{volumes.find((v) => v.id === editingVolumeId)?.title ?? "未命名"}</p>
            </div>
            <Field>
              <FieldLabel>新卷名</FieldLabel>
              <Input
                aria-label="新卷名"
                value={volumeEditDraft}
                onChange={(event) => setVolumeEditDraft(event.target.value)}
                className="h-11 rounded-sm border-[#ebebeb] bg-white font-semibold"
                placeholder="输入新的卷名称"
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mx-0 mb-0 rounded-none bg-white flex items-center justify-end gap-4 border-t border-[#ebebeb] px-6 py-5">
            <Button variant="outline" className="rounded-full border-[#ebebeb] bg-white text-[#171717] hover:bg-[#fafafa]" onClick={() => setVolumeEditOpen(false)}>取消</Button>
            <Button className="rounded-full bg-[#171717] text-white hover:bg-[#171717]/90" onClick={() => void saveVolumeEdit()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={volumeDeleteConfirm !== null}
        onOpenChange={(open) => { if (!open) setVolumeDeleteConfirm(null); }}
      >
        <AlertDialogContent className="overflow-hidden rounded-xl bg-white p-0 shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#00000014] sm:max-w-sm">
          <AlertDialogHeader className="border-b border-[#ebebeb] px-6 py-5 text-left">
            <AlertDialogTitle className="text-xl font-semibold tracking-[-0.6px] text-[#171717]">确认删除卷</AlertDialogTitle>
            <AlertDialogDescription className="mt-1 text-sm leading-5 text-[#888888]">
              确认删除卷「{volumeDeleteConfirm?.title}」？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mx-0 mb-0 rounded-none bg-white flex items-center justify-end gap-4 border-t border-[#ebebeb] px-6 py-5">
            <AlertDialogCancel className="rounded-full border-[#ebebeb] bg-white text-[#171717] hover:bg-[#fafafa]">取消</AlertDialogCancel>
            <AlertDialogAction className="rounded-full bg-[#ee0000] text-white hover:bg-[#c50000]" onClick={() => void confirmDeleteVolume()}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={noteMode === "create" || noteMode === "edit"}
        onOpenChange={(open) => {
          if (!open) setNoteMode("idle");
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-white p-0 shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#00000014] sm:max-w-3xl [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:z-20 [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:text-[#888888] [&_[data-slot=dialog-close]]:hover:bg-[#f5f5f5] [&_[data-slot=dialog-close]]:hover:text-[#171717]">
          <DialogHeader className="sr-only">
            <DialogTitle>{noteMode === "create" ? "新建灵感便签" : "编辑灵感便签"}</DialogTitle>
            <DialogDescription>记录绑定当前作品的伏笔、剧情灵感或临时想法。</DialogDescription>
          </DialogHeader>
          <div className="text-[#171717]">
            <div className="border-b border-[#ebebeb] px-6 py-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-10 place-items-center rounded-full border border-[#ebebeb] bg-white text-[#171717]"><Lightbulb size={18} /></span>
                <div>
                  <h2 className="text-xl font-semibold tracking-[-0.6px]">{noteMode === "create" ? "新建灵感便签" : "编辑灵感便签"}</h2>
                  <p className="mt-1 text-sm leading-5 text-[#888888]">便签绑定当前作品，用来暂存伏笔、桥段和灵感。</p>
                </div>
              </div>
            </div>
            <FieldGroup className="p-6">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
                <Field>
                  <FieldLabel>标题</FieldLabel>
                  <Input
                    aria-label="便签标题"
                    value={noteDraft.title}
                    onChange={(event) => setNoteDraft((draft) => ({ ...draft, title: event.target.value }))}
                    className="h-11 rounded-sm border-[#ebebeb] bg-white font-semibold"
                    placeholder="例如：学院入学考转折"
                  />
                </Field>
                <Field>
                  <FieldLabel>分类</FieldLabel>
                  <Input
                    aria-label="便签分类"
                    value={noteDraft.category}
                    onChange={(event) => setNoteDraft((draft) => ({ ...draft, category: event.target.value }))}
                    className="h-11 rounded-sm border-[#ebebeb] bg-white"
                    placeholder="灵感 / 伏笔"
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel>内容</FieldLabel>
                <NoteRichTextEditor
                  value={noteDraft.content}
                  onChange={(value) => setNoteDraft((draft) => ({ ...draft, content: value }))}
                />
              </Field>
              {noteStatus === "error" && noteError ? <FieldError>{noteError}</FieldError> : null}
            </FieldGroup>
            <DialogFooter className="mx-0 mb-0 rounded-none bg-white flex items-center justify-end gap-4 border-t border-[#ebebeb] px-6 py-5">
              <Button variant="outline" className="rounded-full border-[#ebebeb] bg-white text-[#171717] hover:bg-[#fafafa]" onClick={() => setNoteMode("idle")}>取消</Button>
              <Button className="rounded-full bg-[#171717] text-white hover:bg-[#171717]/90" onClick={() => void saveNote()} disabled={noteStatus === "saving"}>
                {noteStatus === "saving" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
                保存便签
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={goalEditOpen} onOpenChange={setGoalEditOpen}>
        <DialogContent className="overflow-hidden rounded-xl bg-white p-0 shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#00000014] sm:max-w-md [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:text-[#888888] [&_[data-slot=dialog-close]]:hover:bg-[#f5f5f5] [&_[data-slot=dialog-close]]:hover:text-[#171717]">
          <DialogHeader className="border-b border-[#ebebeb] px-6 py-5">
            <DialogTitle className="text-xl font-semibold tracking-[-0.6px] text-[#171717]">今日创作目标</DialogTitle>
            <DialogDescription className="mt-1 text-sm leading-5 text-[#888888]">目标绑定当前作品，今日新增字数按保存时正向增量累计。</DialogDescription>
          </DialogHeader>
          <FieldGroup className="p-6">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-[#ebebeb] bg-white p-3 text-center">
                <p className="text-lg font-semibold tracking-[-0.6px]">{dailyWordProgress.wordsAdded}</p>
                <p className="mt-1 text-xs leading-4 text-[#888888]">今日新增</p>
              </div>
              <div className="rounded-md border border-[#ebebeb] bg-white p-3 text-center">
                <p className="text-lg font-semibold tracking-[-0.6px]">{writingGoal.targetWords}</p>
                <p className="mt-1 text-xs leading-4 text-[#888888]">当前目标</p>
              </div>
              <div className="rounded-md border border-[#ebebeb] bg-white p-3 text-center">
                <p className="text-lg font-semibold tracking-[-0.6px]">{writingGoal.targetWords ? Math.min(100, Math.round((dailyWordProgress.wordsAdded / writingGoal.targetWords) * 100)) : 0}%</p>
                <p className="mt-1 text-xs leading-4 text-[#888888]">完成度</p>
              </div>
            </div>
            <Field>
              <FieldLabel>目标字数</FieldLabel>
              <Input
                aria-label="目标字数"
                inputMode="numeric"
                value={goalDraft.targetWords}
                onChange={(event) => setGoalDraft((draft) => ({ ...draft, targetWords: event.target.value }))}
                className="h-11 rounded-sm border-[#ebebeb] bg-white font-semibold"
              />
            </Field>
            {goalStatus === "error" ? <FieldError>目标字数需要大于 0，请稍后重试</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mx-0 mb-0 rounded-none bg-white flex items-center justify-end gap-4 border-t border-[#ebebeb] px-6 py-5">
            <Button variant="outline" className="rounded-full border-[#ebebeb] bg-white text-[#171717] hover:bg-[#fafafa]" onClick={() => setGoalEditOpen(false)}>取消</Button>
            <Button className="rounded-full bg-[#171717] text-white hover:bg-[#171717]/90" onClick={() => void saveGoal()} disabled={goalStatus === "saving"}>
              {goalStatus === "saving" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
              保存目标
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="overflow-hidden rounded-xl bg-white p-0 shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#00000014] sm:max-w-5xl xl:max-w-6xl [&_[data-slot=dialog-close]]:right-5 [&_[data-slot=dialog-close]]:top-5 [&_[data-slot=dialog-close]]:z-20 [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:text-[#888888] [&_[data-slot=dialog-close]]:hover:bg-[#f5f5f5] [&_[data-slot=dialog-close]]:hover:text-[#171717]">
          <DialogHeader className="sr-only">
            <DialogTitle>账户中心</DialogTitle>
            <DialogDescription>查看会员状态、积分余额并选择创作套餐。</DialogDescription>
          </DialogHeader>
          <div className="relative bg-[#f7f3ea] text-[#171717]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(202,138,4,0.18),transparent_28%),linear-gradient(135deg,rgba(23,23,23,0.05)_0_1px,transparent_1px_12px)]" />
            <div className="relative grid max-h-[82vh] gap-5 overflow-y-auto p-6 pt-14 lg:grid-cols-[360px_minmax(0,1fr)]">
              <section className="rounded-xl border border-[#171717]/90 bg-[#171717] p-5 text-white shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#ffffff14]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold text-white/45">账户卡片</p>
                    <h3 className="mt-3 max-w-64 truncate text-xl font-semibold tracking-[-0.6px]">{profile?.user.nickname || "创作者"}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs leading-4 text-white/55">
                      <Mail size={12} />
                      {profile?.user.email || "账户信息加载中"}
                    </p>
                  </div>
                  <button
                    className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white/65 transition-colors hover:bg-white hover:text-[#171717]"
                    onClick={() => {
                      setNicknameDraft(profile?.user.nickname ?? "");
                      setNicknameEditOpen(true);
                    }}
                    aria-label="修改昵称"
                  >
                    <PencilLine size={17} />
                  </button>
                </div>

                <div className="mt-7 rounded-md border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-white/45">当前身份</p>
                      <p className="mt-1 text-base font-semibold">{profile?.subscription ? "VIP 创作会员" : "免费创作版"}</p>
                    </div>
                    <span className="grid size-11 place-items-center rounded-full border border-white/15 bg-white/10">
                      <Crown size={20} className={profile?.subscription ? "text-amber-200" : "text-white/45"} />
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 text-xs leading-4">
                    <div>
                      <p className="text-white/40">会员周期</p>
                      <p className="mt-1 font-medium text-white/80">31 天</p>
                    </div>
                    <div>
                      <p className="text-white/40">有效期至</p>
                      <p className="mt-1 font-medium text-white/80">
                        {profile?.subscription ? formatUpdatedAt(profile.subscription.end_at) : "未开通"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {[
                    { label: "可用合计", value: profile?.points.totalPoints ?? 0, hint: "AI 写作可消耗" },
                    { label: "今日 VIP 积分", value: profile?.points.vipDailyPoints ?? 0, hint: "每日额度，适合持续创作" },
                    { label: "加油包积分", value: profile?.points.creditPackPoints ?? 0, hint: "一次到账，长期有效" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-md border border-white/10 bg-white/90 px-4 py-3 text-[#171717]">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-[11px] font-semibold text-[#4d4d4d]">{item.label}</p>
                        <p className="text-xl font-semibold tabular-nums tracking-[-0.6px]">{item.value.toLocaleString()}</p>
                      </div>
                      <p className="mt-1 text-[10px] text-[#888888]">{item.hint}</p>
                    </div>
                  ))}
                </div>

                {accountStatus === "loading" ? (
                  <p className="mt-4 flex items-center gap-2 text-xs leading-4 text-white/55">
                    <Loader2 size={13} className="animate-spin" />
                    正在读取账户信息...
                  </p>
                ) : null}
                {accountStatus === "error" ? <p className="mt-4 text-xs leading-4 text-rose-200">账户信息保存失败，请稍后重试</p> : null}
              </section>

              <section className="min-w-0 rounded-xl border border-[#ebebeb] bg-white/86 p-5 shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_2px_2px_rgba(0,0,0,0.04)] backdrop-blur">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold text-[#888888]">套餐升级</p>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.6px] text-[#171717]">选择适合本书节奏的创作额度</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-5 text-[#888888]">
                      月卡提供每日 VIP 积分和一笔加油包积分，适合稳定写作、AI 对话和章节分析；加油包一次到账、长期有效，适合临时加速。
                    </p>
                  </div>
                </div>

                {billingStatus === "loading" ? (
                  <div className="mt-6 grid min-h-56 place-items-center rounded-md border border-dashed border-[#ebebeb] text-sm leading-5 text-[#888888]">
                    <span className="flex items-center gap-2">
                      <Loader2 size={15} className="animate-spin" />
                      正在读取套餐配置...
                    </span>
                  </div>
                ) : null}

                {billingStatus === "error" ? (
                  <div className="mt-6 rounded-md border border-[#f7d4d6] bg-[#f7d4d6] px-4 py-3 text-sm leading-5 text-[#ee0000]">
                    套餐信息加载失败。
                    <button className="ml-2 font-bold underline underline-offset-2" onClick={() => void loadBillingProducts()}>
                      重试
                    </button>
                  </div>
                ) : null}

                {billingStatus !== "loading" && billingStatus !== "error" ? (
                  <div className="mt-6 space-y-5">
                    <div className="grid gap-3 md:grid-cols-3">
                      {billingProducts.plans.map((plan, index) => {
                        const featured = index === 1 || (billingProducts.plans.length === 1 && index === 0);
                        return (
                          <article
                            key={plan.id}
                            className={cn(
                              "relative flex min-h-64 flex-col overflow-hidden rounded-xl border p-4 transition-transform hover:-translate-y-0.5",
                              featured ? "border-[#171717] bg-[#171717] text-white shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)]" : "border-[#ebebeb] bg-[#fbfaf6] text-[#171717]"
                            )}
                          >
                            {featured ? <span className="absolute right-3 top-3 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-[#171717]">推荐</span> : null}
                            <p className={cn("text-[10px] font-semibold", featured ? "text-white/55" : "text-[#888888]")}>31 天月卡</p>
                            <h4 className="mt-2 text-base font-semibold">{plan.name}</h4>
                            <div className="mt-4 flex items-end gap-1">
                              <span className={cn("mb-1 text-xs leading-4 font-semibold", featured ? "text-white/45" : "text-[#888888]")}>¥</span>
                              <span className="text-2xl font-semibold tracking-[-0.08em]">{plan.priceAmount}</span>
                              <span className={cn("mb-1 text-xs leading-4", featured ? "text-white/45" : "text-[#888888]")}>/31天</span>
                            </div>
                            <div className={cn("mt-4 space-y-2 rounded-md border p-3 text-xs leading-4", featured ? "border-white/10 bg-white/5 text-white/72" : "border-[#ebebeb] bg-white text-[#4d4d4d]")}>
                              <p>每日发放 {plan.vipDailyPoints.toLocaleString()} VIP 积分</p>
                              <p>附带 {plan.bundledCreditPackPoints.toLocaleString()} 加油包积分</p>
                              <p>用于 AI 对话、章节分析与续写辅助</p>
                            </div>
                            <Button
                              className={cn("mt-auto h-10 rounded-full font-semibold", featured ? "bg-amber-200 text-[#171717] hover:bg-amber-100" : "bg-[#171717] text-white hover:bg-[#171717]/90")}
                              onClick={() => void createOrder("plan", plan.id)}
                              disabled={billingStatus === "creating"}
                            >
                              {billingStatus === "creating" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Crown data-icon="inline-start" />}
                              创建订单
                            </Button>
                          </article>
                        );
                      })}
                    </div>

                    {billingProducts.creditPacks.length ? (
                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <Zap size={15} className="fill-[#171717]" />
                          <h4 className="text-sm leading-5 font-semibold text-[#171717]">灵感加油包</h4>
                          <span className="text-xs leading-4 text-[#888888]">长期有效，适合临时补充</span>
                        </div>
                        <div className="grid gap-2 md:grid-cols-3">
                          {billingProducts.creditPacks.map((pack) => (
                            <button
                              key={pack.id}
                              className="group flex items-center justify-between gap-3 rounded-full border border-[#ebebeb] bg-white px-4 py-3 text-left transition-all hover:bg-[#fafafa] disabled:opacity-60"
                              onClick={() => void createOrder("credit_pack", pack.id)}
                              disabled={billingStatus === "creating"}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm leading-5 font-semibold text-[#171717]">{pack.name}</span>
                                <span className="mt-1 block text-xs leading-4 text-[#888888]">{pack.points.toLocaleString()} 积分 · ¥{pack.priceAmount}</span>
                              </span>
                              {billingStatus === "creating" ? <Loader2 size={14} className="animate-spin text-[#888888]" /> : <ArrowRight size={14} className="text-[#a1a1a1] transition-colors group-hover:text-[#171717]" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={nicknameEditOpen} onOpenChange={setNicknameEditOpen}>
        <DialogContent className="overflow-hidden rounded-xl bg-white p-0 shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#00000014] sm:max-w-sm [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:text-[#888888] [&_[data-slot=dialog-close]]:hover:bg-[#f5f5f5] [&_[data-slot=dialog-close]]:hover:text-[#171717]">
          <DialogHeader className="border-b border-[#ebebeb] px-6 py-5">
            <DialogTitle className="text-xl font-semibold tracking-[-0.6px] text-[#171717]">修改昵称</DialogTitle>
            <DialogDescription className="mt-1 text-sm leading-5 text-[#888888]">昵称只影响账户展示，不会改变登录邮箱。</DialogDescription>
          </DialogHeader>
          <FieldGroup className="p-6">
            <Field>
              <FieldLabel>昵称</FieldLabel>
              <Input
                value={nicknameDraft}
                onChange={(event) => setNicknameDraft(event.target.value)}
                aria-label="昵称"
                className="h-11 rounded-sm border-[#ebebeb] bg-white font-semibold"
                placeholder="输入创作者昵称"
              />
            </Field>
            {accountStatus === "error" ? <FieldError>昵称保存失败，请稍后重试</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mx-0 mb-0 rounded-none bg-white flex items-center justify-end gap-4 border-t border-[#ebebeb] px-6 py-5">
            <Button variant="outline" className="rounded-full border-[#ebebeb] bg-white text-[#171717] hover:bg-[#fafafa]" onClick={() => setNicknameEditOpen(false)}>取消</Button>
            <Button className="rounded-full bg-[#171717] text-white hover:bg-[#171717]/90" onClick={() => void saveNickname()} disabled={accountStatus === "saving"}>
              {accountStatus === "saving" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
              保存昵称
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        bookId={bookId}
        shareEnabled={shareEnabled}
        shareToken={shareToken}
        activeChapterId={activeChapterId}
        onShareToggle={async (enabled) => {
          try {
            const result = await client.toggleShare(bookId, enabled);
            setShareEnabled(result.share_enabled);
            setShareToken(result.share_token);
          } catch { /* ignore */ }
        }}
      />

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        order={billingOrder}
        creating={billingStatus === "creating" && !billingOrder}
        onSimulatePaid={() => void simulateOrderPaid()}
        testEnabled={testPaymentEnabled}
      />

      <Dialog open={editorSettingsOpen} onOpenChange={setEditorSettingsOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-white p-0 shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#00000014] sm:max-w-2xl [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:text-[#888888] [&_[data-slot=dialog-close]]:hover:bg-[#f5f5f5] [&_[data-slot=dialog-close]]:hover:text-[#171717]">
          <DialogHeader className="border-b border-[#ebebeb] px-6 py-5">
            <DialogTitle className="text-xl font-semibold tracking-[-0.6px] text-[#171717]">编辑器排版设置</DialogTitle>
            <DialogDescription className="mt-1 text-sm leading-5 text-[#888888]">自定义字体和排版，设置仅保存在本地浏览器。</DialogDescription>
          </DialogHeader>
          <div className="max-h-[58vh] space-y-5 overflow-y-auto p-6">
            <Field>
              <FieldLabel>字体</FieldLabel>
              <Select value={editorSettings.fontFamily} onValueChange={(v) => updateEditorSetting("fontFamily", v)}>
                <SelectTrigger className="h-11 w-full rounded-sm border-[#ebebeb] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {EDITOR_FONT_OPTIONS.map((font) => (
                      <SelectItem key={font.value} value={font.value}>
                        {font.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <div
                className="mt-2 rounded-sm border border-[#ebebeb] bg-white p-4 text-[#171717]"
                style={{ fontSize: `${editorSettings.fontSize}px`, lineHeight: editorSettings.lineHeight, letterSpacing: `${editorSettings.letterSpacing}px` }}
              >
                <p style={{ fontFamily: editorFontStack, marginBottom: `${editorSettings.paragraphSpacing}px` }}>
                  晨曦初露，薄雾轻笼远山。林间小径上，露珠沿着草叶缓缓滑落，在初升的阳光中闪烁着细碎的光芒。
                </p>
                <p style={{ fontFamily: editorFontStack, marginBottom: `${editorSettings.paragraphSpacing}px` }}>
                  溪水潺潺，绕过青石蜿蜒而下。偶有飞鸟掠过头顶，留下几声清脆的鸣叫，随即消失在茂密的树冠之间。
                </p>
                <p style={{ fontFamily: editorFontStack, marginBottom: 0 }}>
                  远处传来隐隐的钟声，穿过层层叠叠的枝叶，在这静谧的清晨里显得格外悠远而安详。
                </p>
              </div>
            </Field>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium leading-none text-[#171717]">字号</span>
                <span className="tabular-nums text-xs leading-4 text-[#888888]">{editorSettings.fontSize}px</span>
              </div>
              <input
                type="range" min={14} max={28} step={1}
                value={editorSettings.fontSize}
                onChange={(e) => updateEditorSetting("fontSize", Number(e.target.value))}
                className="w-full cursor-pointer accent-[#171717]"
              />
              <div className="flex justify-between text-[10px] text-[#888888]/60">
                <span>14</span><span>28</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium leading-none text-[#171717]">行高</span>
                <span className="tabular-nums text-xs leading-4 text-[#888888]">{editorSettings.lineHeight.toFixed(1)}</span>
              </div>
              <input
                type="range" min={1.2} max={3.0} step={0.1}
                value={editorSettings.lineHeight}
                onChange={(e) => updateEditorSetting("lineHeight", Number(e.target.value))}
                className="w-full cursor-pointer accent-[#171717]"
              />
              <div className="flex justify-between text-[10px] text-[#888888]/60">
                <span>1.2</span><span>3.0</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium leading-none text-[#171717]">字间距</span>
                <span className="tabular-nums text-xs leading-4 text-[#888888]">{editorSettings.letterSpacing}px</span>
              </div>
              <input
                type="range" min={0} max={4} step={0.5}
                value={editorSettings.letterSpacing}
                onChange={(e) => updateEditorSetting("letterSpacing", Number(e.target.value))}
                className="w-full cursor-pointer accent-[#171717]"
              />
              <div className="flex justify-between text-[10px] text-[#888888]/60">
                <span>0</span><span>4</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium leading-none text-[#171717]">段落间距</span>
                <span className="tabular-nums text-xs leading-4 text-[#888888]">{editorSettings.paragraphSpacing}px</span>
              </div>
              <input
                type="range" min={0} max={32} step={4}
                value={editorSettings.paragraphSpacing}
                onChange={(e) => updateEditorSetting("paragraphSpacing", Number(e.target.value))}
                className="w-full cursor-pointer accent-[#171717]"
              />
              <div className="flex justify-between text-[10px] text-[#888888]/60">
                <span>0</span><span>32</span>
              </div>
            </div>
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-none bg-white flex items-center justify-end gap-4 border-t border-[#ebebeb] px-6 py-5">
            <Button variant="outline" className="rounded-full border-[#ebebeb] bg-white text-[#171717] hover:bg-[#fafafa]" onClick={() => {
              setEditorSettings(DEFAULT_EDITOR_SETTINGS);
              window.localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(DEFAULT_EDITOR_SETTINGS));
            }}>
              恢复默认
            </Button>
            <Button className="rounded-full bg-[#171717] text-white hover:bg-[#171717]/90" onClick={() => setEditorSettingsOpen(false)}>
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VersionHistoryDialog
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
        workId={bookId}
        chapterId={activeChapter?.id}
        client={client}
        onRestored={async () => {
          try {
            const list = await client.listChapters(bookId);
            setChapters(list);
            const updated = list.find((c) => c.id === activeChapter?.id);
            if (updated) {
              setTitle(updated.title);
              setSummary(updated.summary);
              setContent(updated.content);
              titleRef.current = updated.title;
              summaryRef.current = updated.summary;
              contentRef.current = updated.content;
            }
          } catch { /* ignore */ }
        }}
      />

      <Dialog open={workEditOpen} onOpenChange={setWorkEditOpen}>
        <DialogContent className="overflow-hidden rounded-xl bg-white p-0 shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#00000014] sm:max-w-5xl xl:max-w-6xl [&_[data-slot=dialog-close]]:right-5 [&_[data-slot=dialog-close]]:top-5 [&_[data-slot=dialog-close]]:z-20 [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:text-[#888888] [&_[data-slot=dialog-close]]:hover:bg-[#f5f5f5] [&_[data-slot=dialog-close]]:hover:text-[#171717]">
          <DialogHeader className="sr-only">
            <DialogTitle>编辑作品信息</DialogTitle>
            <DialogDescription>修改作品的基本设定、大纲和创作规则。</DialogDescription>
          </DialogHeader>

          <div className="relative flex max-h-[84vh] flex-col overflow-hidden bg-white text-[#171717]">
            <div className="relative min-h-0 flex-1 overflow-y-auto">
              <div className="grid gap-5 p-6 pt-14 lg:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="flex flex-col rounded-xl border border-[#171717] bg-[#171717] p-5 text-white shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#ffffff14]">
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#171717]">
                  <BookMarked size={13} />
                  作品档案
                </span>
                <div className="mt-8">
                  <p className="text-xs leading-4 font-medium text-white/40">作品标题</p>
                  <h2 className="mt-2 line-clamp-3 text-2xl font-semibold leading-tight tracking-[-0.6px]">
                    {workDraft.title || "未命名作品"}
                  </h2>
                  <p className="mt-4 line-clamp-5 text-sm leading-5 text-white/58">
                    {workDraft.shortIntro || "给作品留下一句清晰的入口介绍，方便你和 AI 快速回到这本书的语气与方向。"}
                  </p>
                </div>

                <div className="mt-8 grid gap-2">
                  {[
                    { label: "大纲", value: workDraft.synopsis, icon: FileText },
                    { label: "背景规则", value: workDraft.backgroundRules, icon: Compass },
                    { label: "禁忌要求", value: workDraft.forbiddenRequirements, icon: ShieldAlert },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2">
                        <span className="inline-flex items-center gap-2 text-xs leading-4 text-white/55">
                          <Icon size={13} />
                          {item.label}
                        </span>
                        <span className="text-[10px] font-semibold text-white/35">{item.value.trim() ? "已填写" : "待补充"}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-auto pt-8">
                  <div className="rounded-md border border-white/10 bg-white/90 p-4 text-[#171717]">
                    <p className="flex items-center gap-2 text-xs leading-4 font-semibold text-[#4d4d4d]">
                      <Tags size={13} />
                      类型标签
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm leading-5 font-medium">
                      {workDraft.tags || "奇幻, 冒险, 群像"}
                    </p>
                  </div>
                </div>
              </aside>

              <section className="min-w-0 rounded-xl border border-[#ebebeb] bg-white shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_2px_2px_rgba(0,0,0,0.04)]">
                <div className="border-b border-[#ebebeb] px-5 py-4">
                  <p className="text-[11px] font-semibold text-[#888888]">作品信息</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-[-0.6px] text-[#171717]">编辑作品档案</h3>
                  <p className="mt-1 text-sm leading-5 text-[#888888]">这些信息会影响作品展示，也会作为 AI 理解作品时的重要上下文。</p>
                </div>

                <div className="grid gap-5 p-5">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
                    <Field>
                      <FieldLabel>作品标题</FieldLabel>
                      <Input
                        aria-label="作品标题"
                        value={workDraft.title}
                        onChange={(e) => setWorkDraft((d) => ({ ...d, title: e.target.value }))}
                        className="h-12 rounded-sm border-[#ebebeb] bg-[#fafafa] text-base font-bold"
                        placeholder="例如：雾港学院"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>类型标签（逗号分隔）</FieldLabel>
                      <Input
                        aria-label="类型标签"
                        value={workDraft.tags}
                        onChange={(e) => setWorkDraft((d) => ({ ...d, tags: e.target.value }))}
                        className="h-12 rounded-sm border-[#ebebeb] bg-[#fafafa]"
                        placeholder="奇幻, 冒险, 群像"
                      />
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel>一句话简介</FieldLabel>
                    <Textarea
                      aria-label="简介"
                      value={workDraft.shortIntro}
                      onChange={(e) => setWorkDraft((d) => ({ ...d, shortIntro: e.target.value }))}
                      className="min-h-24 resize-none rounded-sm border-[#ebebeb] bg-[#fafafa] leading-6"
                      placeholder="这本书最想让读者记住的钩子。"
                    />
                  </Field>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <Field>
                      <FieldLabel className="inline-flex items-center gap-2"><FileText size={14} />大纲</FieldLabel>
                      <Textarea
                        aria-label="大纲"
                        value={workDraft.synopsis}
                        onChange={(e) => setWorkDraft((d) => ({ ...d, synopsis: e.target.value }))}
                        className="min-h-44 resize-none rounded-sm border-[#ebebeb] bg-white leading-6"
                        placeholder="主线、阶段目标、关键反转。"
                      />
                    </Field>
                    <Field>
                      <FieldLabel className="inline-flex items-center gap-2"><Compass size={14} />背景规则</FieldLabel>
                      <Textarea
                        aria-label="背景规则"
                        value={workDraft.backgroundRules}
                        onChange={(e) => setWorkDraft((d) => ({ ...d, backgroundRules: e.target.value }))}
                        className="min-h-44 resize-none rounded-sm border-[#ebebeb] bg-white leading-6"
                        placeholder="世界运行规则、能力限制、组织秩序。"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <Field>
                      <FieldLabel>创作重点</FieldLabel>
                      <Textarea
                        aria-label="创作重点"
                        value={workDraft.focusRequirements}
                        onChange={(e) => setWorkDraft((d) => ({ ...d, focusRequirements: e.target.value }))}
                        className="min-h-36 resize-none rounded-sm border-[#ebebeb] bg-white leading-6"
                        placeholder="希望 AI 和作者始终优先照顾的风格、节奏、人物关系。"
                      />
                    </Field>
                    <Field>
                      <FieldLabel className="inline-flex items-center gap-2"><ShieldAlert size={14} />禁忌要求</FieldLabel>
                      <Textarea
                        aria-label="禁忌要求"
                        value={workDraft.forbiddenRequirements}
                        onChange={(e) => setWorkDraft((d) => ({ ...d, forbiddenRequirements: e.target.value }))}
                        className="min-h-36 resize-none rounded-sm border-[#ebebeb] bg-white leading-6"
                        placeholder="不要出现的桥段、语气、设定冲突或风格偏差。"
                      />
                    </Field>
                  </div>

                  {workSaveStatus === "error" ? <FieldError>保存失败，请稍后重试</FieldError> : null}
                </div>

              </section>
              </div>
            </div>
            <DialogFooter className="mx-0 mb-0 rounded-none bg-white flex items-center justify-end gap-4 border-t border-[#ebebeb] px-6 py-5">
              <Button variant="outline" className="rounded-full border-[#ebebeb] bg-white text-[#171717] hover:bg-[#fafafa]" onClick={() => setWorkEditOpen(false)}>
                取消
              </Button>
              <Button className="rounded-full bg-[#171717] text-white hover:bg-[#171717]/90" onClick={() => void saveWorkEdit()} disabled={workSaveStatus === "saving"}>
                {workSaveStatus === "saving" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
                保存作品档案
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function NoteRichTextEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Markdown, TipTapLink, TaskList, TaskItem],
    content: value,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none px-4 py-3 outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getMarkdown());
    },
  });

  if (!editor) {
    return (
      <div className="flex min-h-[380px] items-center justify-center rounded-sm border border-[#ebebeb] bg-white text-sm leading-5 text-[#888888]">
        编辑器加载中...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-sm border border-[#ebebeb] bg-white">
      <div className="flex items-center gap-0.5 border-b border-[#ebebeb] bg-[#fafafa] px-3 py-1.5">
        <ToolbarBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="加粗"
        >
          <Bold size={15} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="斜体"
        >
          <Italic size={15} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          label="删除线"
        >
          <Strikethrough size={15} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
          label="行内代码"
        >
          <Code size={15} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("link")}
          onClick={() => {
            if (editor.isActive("link")) {
              editor.chain().focus().unsetLink().run();
              return;
            }
            const url = window.prompt("输入链接地址");
            if (url) {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          label="链接"
        >
          <LinkIcon size={15} />
        </ToolbarBtn>
        <span className="mx-1 h-4 w-px bg-[#ebebeb]" />
        <ToolbarBtn
          active={editor.isActive("heading")}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          label="小标题"
        >
          <Heading3 size={15} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="无序列表"
        >
          <List size={15} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="有序列表"
        >
          <ListOrdered size={15} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          label="任务列表"
        >
          <ListChecks size={15} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          label="引用"
        >
          <Quote size={15} />
        </ToolbarBtn>
        <span className="mx-1 h-4 w-px bg-[#ebebeb]" />
        <ToolbarBtn
          active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          label="分割线"
        >
          <Minus size={15} />
        </ToolbarBtn>
      </div>
      <div className="h-[380px] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolbarBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "grid size-8 place-items-center rounded-full transition-colors",
        active ? "bg-[#f5f5f5] text-[#171717]" : "text-[#888888] hover:bg-[#f5f5f5] hover:text-[#171717]"
      )}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
