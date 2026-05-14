"use client";

import { AlertCircle, Brain, Clock3, History, MessageSquare, PenLine, Sparkles, Users, Wand2, X } from "lucide-react";
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import type {
  AiModelOption,
  ApiSuggestion,
  ChatMention,
  ChatMessage,
  ChatReference,
  ChatSession,
} from "@/api";
import { ChatMentionInput, type ChatMentionInputHandle } from "@/components/ChatMentionInput";
import { ModelPicker } from "@/components/ModelPicker";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { readWorkspaceMentionDragData, type WorkspaceMentionReference } from "./dnd";

const THINKING_LEVELS = ["none", "low", "medium", "high", "xhigh"] as const;
type ThinkingLevel = (typeof THINKING_LEVELS)[number];

const THINKING_LABELS: Record<ThinkingLevel, string> = {
  none: "不思考",
  low: "低",
  medium: "中",
  high: "高",
  xhigh: "极限",
};

const THINKING_ICON_COLORS: Record<ThinkingLevel, string> = {
  none: "text-muted-foreground/30",
  low: "text-emerald-400",
  medium: "text-sky-400",
  high: "text-amber-400",
  xhigh: "text-rose-500",
};

const THINKING_BAR_COLORS: Record<ThinkingLevel, string> = {
  none: "bg-muted",
  low: "bg-emerald-400",
  medium: "bg-sky-400",
  high: "bg-amber-400",
  xhigh: "bg-rose-500",
};

type WorkspaceChatPanelProps = {
  overlay: boolean;
  suggestions: ApiSuggestion[];
  activeSuggestionIndex: number | null;
  onSelectSuggestion: (index: number) => void;
  onAcceptSuggestion: (index: number) => void;
  onSendSuggestionToChat: (index: number) => void;
  onCloseOverlay: () => void;
  chatStatus: "loading" | "ready" | "streaming" | "error" | "no_points" | "idle";
  activeSession?: ChatSession;
  showHistory: boolean;
  onHistoryOpenChange: (open: boolean) => void;
  sessions: ChatSession[];
  activeSessionId: string;
  onSwitchSession: (sessionId: string) => void;
  onCreateSession: () => void;
  hasMoreMessages: boolean;
  onLoadOlderMessages: () => void;
  messages: ChatMessage[];
  renderMessageContent: (message: ChatMessage) => ReactNode;
  modelStatus: "loading" | "ready" | "error";
  selectedModel?: AiModelOption;
  aiModels: AiModelOption[];
  selectedModelId: string;
  onRetryModels: () => void;
  onSelectChatModel: (modelId: string) => void;
  thinkingIntensity: ThinkingLevel;
  onThinkingIntensityChange: (value: ThinkingLevel) => void;
  chatInputRef: RefObject<ChatMentionInputHandle | null>;
  chatInput: string;
  chatMentions: ChatMention[];
  allReferenceItems: ChatReference[];
  recentReferences: ChatReference[];
  pendingReferences: ChatReference[];
  chatInputDisabled: boolean;
  onStop: () => void;
  onInputChange: (text: string, mentions: ChatMention[]) => void;
  onSelectReference: (reference: ChatReference) => void;
  onRemoveReference: (reference: ChatReference) => void;
  onSubmit: () => void;
  onMentionDrop: (reference: WorkspaceMentionReference) => void;
  workTitle: string;
  currentChapterRef: (Pick<ChatReference, "id" | "name" | "summary"> & { type: "chapter" | "character" }) | null;
};

export function WorkspaceChatPanel({
  overlay,
  suggestions,
  activeSuggestionIndex,
  onSelectSuggestion,
  onAcceptSuggestion,
  onSendSuggestionToChat,
  onCloseOverlay,
  chatStatus,
  activeSession,
  showHistory,
  onHistoryOpenChange,
  sessions,
  activeSessionId,
  onSwitchSession,
  onCreateSession,
  hasMoreMessages,
  onLoadOlderMessages,
  messages,
  renderMessageContent,
  modelStatus,
  selectedModel,
  aiModels,
  selectedModelId,
  onRetryModels,
  onSelectChatModel,
  thinkingIntensity,
  onThinkingIntensityChange,
  chatInputRef,
  chatInput,
  chatMentions,
  allReferenceItems,
  recentReferences,
  pendingReferences,
  chatInputDisabled,
  onStop,
  onInputChange,
  onSelectReference,
  onRemoveReference,
  onSubmit,
  onMentionDrop,
  workTitle,
  currentChapterRef,
}: WorkspaceChatPanelProps) {
  const dragDepthRef = useRef(0);
  const [isDropActive, setIsDropActive] = useState(false);
  const [showThinkingPopup, setShowThinkingPopup] = useState(false);
  const thinkingPopupRef = useRef<HTMLDivElement>(null);

  const PROMPT_SUGGESTIONS = [
    { icon: PenLine, text: "帮我梳理这一章的情节走向", hint: "头脑风暴" },
    { icon: Sparkles, text: "按照我的风格续写这一章", hint: "续写章节" },
    { icon: Users, text: "为这一章中的角色深化人设", hint: "角色塑造" },
  ];

  const handlePromptClick = useCallback(
    (promptText: string) => {
      if (currentChapterRef && chatInputRef.current) {
        chatInputRef.current.insertMentionWithText(currentChapterRef, promptText);
      } else {
        onInputChange(promptText, []);
      }
    },
    [currentChapterRef, chatInputRef, onInputChange]
  );

  useEffect(() => {
    if (!showThinkingPopup) return;
    function onClickOutside(e: MouseEvent) {
      if (thinkingPopupRef.current && !thinkingPopupRef.current.contains(e.target as Node)) {
        setShowThinkingPopup(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showThinkingPopup]);

  function readDraggedReference(dataTransfer: DataTransfer | null | undefined) {
    if (chatInputDisabled) return null;
    return readWorkspaceMentionDragData(dataTransfer);
  }

  return (
    <aside data-testid="workspace-chat-panel" className="relative z-20 flex h-full min-h-0 min-w-0 flex-col border-l border-[#ebebeb] bg-white shadow-[-2px_0_12px_rgba(0,0,0,0.03)]">
      <div className="flex h-14 items-center justify-between border-b border-[#ebebeb] p-4">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.6)]",
              chatStatus === "streaming" ? "animate-pulse bg-emerald-400" : "bg-[#888888]/40"
            )}
          />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-[#171717]">{activeSession?.title || "新的对话"}</h2>
            <p className="truncate text-xs text-[#888888]">
              {chatStatus === "streaming" ? "AI 回复中" : "当前会话 · 已读取作品上下文"}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <DropdownMenu open={showHistory} onOpenChange={onHistoryOpenChange}>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full p-1.5 text-[#888888] transition-colors hover:bg-[#f5f5f5] hover:text-[#171717]" title="历史会话" aria-label="历史会话">
                <Clock3 size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-2">
              <div className="space-y-2">
                <div className="px-1 py-1 text-xs font-medium text-[#888888]">最近会话</div>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {sessions.length ? (
                    sessions.map((session) => (
                      <button
                        key={session.id}
                        className={cn(
                          "w-full rounded-md border px-3 py-2 text-left text-xs transition-colors",
                          session.id === activeSessionId
                            ? "border-[#171717] bg-[#f5f5f5] text-[#171717]"
                            : "border-transparent bg-transparent text-[#888888] hover:bg-[#f5f5f5] hover:text-[#171717]"
                        )}
                        onClick={() => onSwitchSession(session.id)}
                      >
                        <span className="block truncate font-medium">{session.title}</span>
                        <span className="mt-1 block truncate text-[#888888]">{session.lastMessagePreview || "暂无消息"}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-2 py-3 text-xs text-[#888888]">暂无历史会话</p>
                  )}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            className="rounded-full p-1.5 text-[#888888] transition-colors hover:bg-[#f5f5f5] hover:text-[#171717]"
            onClick={onCreateSession}
            title="新建会话"
            aria-label="新建会话"
          >
            <MessageSquare size={16} />
          </button>
        </div>
      </div>

      {!overlay ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="chat-scroll flex-1 space-y-5 overflow-y-auto p-4">
            <div className="flex justify-center">
              <span className="rounded-full bg-[#f5f5f5] px-3 py-1 text-xs text-[#888888]">当前会话 · 已读取作品上下文</span>
            </div>
            {hasMoreMessages ? (
              <button className="w-full rounded-full border border-[#ebebeb] bg-white px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#fafafa]" onClick={onLoadOlderMessages}>
                <History size={14} className="inline mr-1.5" />
                加载更早消息
              </button>
            ) : null}
            {chatStatus === "loading" ? <p className="text-sm text-muted-foreground">消息加载中...</p> : null}

            {messages.length === 0 && chatStatus === "ready" ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#171717]/10 to-[#171717]/5 ring-1 ring-[#171717]/10">
                  <MessageSquare size={28} className="text-[#171717]/60" />
                </div>
                <h3 className="mb-1 text-xl font-semibold tracking-tight text-[#171717]">
                  {workTitle || "开始创作"}
                </h3>
                <p className="mb-8 max-w-xs text-sm text-[#888888]">
                  当前还没有消息，选择一个方向开始与 AI 协作写作
                </p>
                <div className="flex w-full max-w-sm flex-col gap-3">
                  {PROMPT_SUGGESTIONS.map((prompt) => (
                    <button
                      key={prompt.text}
                      onClick={() => handlePromptClick(prompt.text)}
                      className="group flex items-center gap-4 rounded-xl border border-[#ebebeb] bg-white px-5 py-4 text-left shadow-sm transition-all hover:border-[#171717]/40 hover:bg-[#171717]/[0.02] hover:shadow-md"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#171717]/5 text-[#171717]/60 transition-colors group-hover:bg-[#171717]/10 group-hover:text-[#171717]">
                        <prompt.icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#171717]">{prompt.text}</p>
                        <p className="mt-0.5 text-xs text-[#888888]">{prompt.hint}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={cn("animate-pop flex w-full gap-3", message.role === "user" ? "justify-end" : "justify-start")}>
                  {message.role === "assistant" ? (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ebebeb] bg-[#f5f5f5] text-xs font-bold text-[#171717]">AI</div>
                  ) : null}
                  <div className="max-w-[85%]">
                    <div
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
                        message.role === "user"
                          ? "rounded-br-sm border-[#171717] bg-[#171717] text-white"
                          : "rounded-tl-sm border-[#ebebeb] bg-white text-[#171717]"
                      )}
                    >
                      {renderMessageContent(message)}
                      {message.role === "assistant" && message.billing_failed ? (
                        <div className="mt-2 flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                          <AlertCircle size={12} className="shrink-0" />
                          计费异常，请联系管理员
                        </div>
                      ) : null}
                      {message.role === "assistant" && message.error ? (
                        <div
                          className={cn(
                            "mt-2 flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs",
                            message.error.includes("积分") || message.error.includes("402")
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-destructive/20 bg-destructive/5 text-destructive"
                          )}
                        >
                          <AlertCircle size={12} className="shrink-0" />
                          {message.error}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {message.role === "user" ? (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#171717] text-xs font-bold text-white">U</div>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <div
            data-testid="workspace-chat-dropzone"
            className={cn(
              "mx-4 mb-4 rounded-2xl border bg-background shadow-sm transition-colors",
              isDropActive ? "border-[#171717] bg-[#171717]/5 shadow-[0_0_0_1px_#171717]" : "border-[#ebebeb]"
            )}
            onDragEnter={(event) => {
              if (!readDraggedReference(event.dataTransfer)) return;
              dragDepthRef.current += 1;
              setIsDropActive(true);
            }}
            onDragOver={(event) => {
              if (!readDraggedReference(event.dataTransfer)) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDragLeave={(event) => {
              if (!readDraggedReference(event.dataTransfer)) return;
              event.preventDefault();
              dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
              if (dragDepthRef.current === 0) {
                setIsDropActive(false);
              }
            }}
            onDrop={(event) => {
              const reference = readDraggedReference(event.dataTransfer);
              dragDepthRef.current = 0;
              setIsDropActive(false);
              if (!reference) return;
              event.preventDefault();
              onMentionDrop(reference);
            }}
          >
            <div className="flex items-center pl-3 pr-4 py-2">
              <div className="flex min-w-0 items-center text-xs text-[#888888]">
                {modelStatus === "loading" ? (
                  <span className="text-[#888888]/50">模型加载中...</span>
                ) : modelStatus === "error" ? (
                  <>
                    <span className="text-[#ee0000]">模型列表加载失败</span>
                    <button type="button" className="ml-1 underline hover:no-underline" onClick={onRetryModels}>
                      重试
                    </button>
                  </>
                ) : !selectedModel ? (
                  <span className="text-[#888888]/50">暂无可用模型</span>
                ) : (
                  <ModelPicker models={aiModels} selectedId={selectedModelId} onSelect={onSelectChatModel} />
                )}
              </div>
              <div className="relative ml-[2px]" ref={thinkingPopupRef}>
                <button
                  className={cn(
                    "flex items-center justify-center rounded-full p-1 text-[#888888] transition-colors hover:bg-[#f5f5f5] hover:text-[#171717]",
                    THINKING_ICON_COLORS[thinkingIntensity]
                  )}
                  onClick={() => setShowThinkingPopup((v) => !v)}
                  aria-label="思考设置"
                >
                  <Brain size={14} />
                </button>
                {showThinkingPopup && (
                  <div className="absolute bottom-full left-0 z-50 mb-2 w-52 rounded-xl border border-[#ebebeb] bg-white p-3 shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#00000014]">
                    <span className="text-[11px] text-[#888888]">思考强度</span>
                    <div className="mt-2 flex gap-1">
                      {THINKING_LEVELS.map((level, index) => {
                        const activeIndex = THINKING_LEVELS.indexOf(thinkingIntensity);
                        const isFilled = thinkingIntensity !== "none" && index <= activeIndex;
                        return (
                          <button
                            key={level}
                            className={cn(
                              "h-2 flex-1 rounded-full transition-all",
                              isFilled ? THINKING_BAR_COLORS[thinkingIntensity] : "bg-[#f5f5f5]"
                            )}
                            onClick={() => onThinkingIntensityChange(level)}
                          />
                        );
                      })}
                    </div>
                    <div className="mt-1.5 flex">
                      {THINKING_LEVELS.map((level) => (
                        <span
                          key={level}
                          className={cn(
                            "flex-1 text-center text-[10px] transition-colors",
                            level === thinkingIntensity ? THINKING_ICON_COLORS[thinkingIntensity] : "text-[#888888]/60"
                          )}
                        >
                          {THINKING_LABELS[level]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <ChatMentionInput
              ref={chatInputRef}
              valueText={chatInput}
              mentions={chatMentions}
              items={allReferenceItems}
              recentItems={recentReferences}
              pendingReferences={pendingReferences}
              disabled={chatInputDisabled}
              isStreaming={chatStatus === "streaming"}
              onStop={onStop}
              onChange={onInputChange}
              onSelectReference={onSelectReference}
              onRemoveReference={onRemoveReference}
              onSubmit={onSubmit}
            />
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 z-30 flex flex-col bg-white/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between border-b border-[#ebebeb] bg-white p-4">
            <div className="flex items-center gap-2">
              <Wand2 size={16} className="text-[#171717]" />
              <span className="text-sm font-semibold text-[#171717]">AI 写作建议</span>
            </div>
            <button className="rounded-full p-1.5 text-[#888888] transition-colors hover:bg-[#f5f5f5] hover:text-[#171717]" onClick={onCloseOverlay} aria-label="关闭写作建议">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {suggestions.map((suggestion, index) => {
              const selected = index === activeSuggestionIndex;
              return (
                <div
                  key={`${suggestion.quote}-${index}`}
                  className={cn("flex flex-col overflow-hidden rounded-xl border bg-white shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_2px_2px_rgba(0,0,0,0.04)]", selected ? "border-[#171717]" : "border-[#ebebeb]")}
                >
                  <button className="border-b border-[#ebebeb] bg-[#fafafa] p-4 text-left" onClick={() => onSelectSuggestion(index)}>
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[#888888]">原文引用</span>
                    <p className="line-clamp-3 text-sm leading-5 text-[#888888]">{suggestion.quote}</p>
                  </button>
                  <div className="border-b border-[#ebebeb] p-4">
                    <div className="flex items-start text-sm leading-5">
                      <AlertCircle size={16} className="mr-2 mt-0.5 shrink-0 text-[#171717]" />
                      <span className="text-[#171717]">{suggestion.issue}</span>
                    </div>
                  </div>
                  <div className="bg-white p-4">
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[#888888]">推荐修改方案</span>
                    <p className="mb-5 text-sm leading-5 text-[#171717]">{suggestion.options[0]}</p>
                    <div className="flex gap-3">
                      <button
                        className="flex-1 rounded-full bg-[#171717] py-2 text-sm font-medium text-white transition-colors hover:bg-[#171717]/90"
                        onClick={() => onAcceptSuggestion(index)}
                      >
                        采纳替换
                      </button>
                      <button
                        className="flex-1 rounded-full border border-[#ebebeb] bg-white py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#fafafa]"
                        onClick={() => onSendSuggestionToChat(index)}
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
  );
}
