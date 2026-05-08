"use client";

import { AlertCircle, Brain, Clock3, History, MessageSquare, Wand2, X } from "lucide-react";
import { type ReactNode, type RefObject, useRef, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { readWorkspaceMentionDragData, type WorkspaceMentionReference } from "./dnd";

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
  thinkingEnabled: boolean;
  onThinkingEnabledChange: (value: boolean) => void;
  thinkingIntensity: number;
  onThinkingIntensityChange: (value: number) => void;
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
  thinkingEnabled,
  onThinkingEnabledChange,
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
}: WorkspaceChatPanelProps) {
  const dragDepthRef = useRef(0);
  const [isDropActive, setIsDropActive] = useState(false);

  function readDraggedReference(dataTransfer: DataTransfer | null | undefined) {
    if (chatInputDisabled) return null;
    return readWorkspaceMentionDragData(dataTransfer);
  }

  return (
    <aside data-testid="workspace-chat-panel" className="relative z-20 flex h-full min-h-0 min-w-0 flex-col border-l border-border bg-card shadow-[-2px_0_12px_rgba(0,0,0,0.03)]">
      <div className="flex h-14 items-center justify-between border-b border-border p-4">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.6)]",
              chatStatus === "streaming" ? "animate-pulse bg-emerald-400" : "bg-muted-foreground/40"
            )}
          />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">{activeSession?.title || "新的对话"}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {chatStatus === "streaming" ? "AI 回复中" : "当前会话 · 已读取作品上下文"}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <DropdownMenu open={showHistory} onOpenChange={onHistoryOpenChange}>
            <DropdownMenuTrigger asChild>
              <button className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground" title="历史会话" aria-label="历史会话">
                <Clock3 size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-2">
              <div className="space-y-2">
                <div className="px-1 py-1 text-xs font-medium text-muted-foreground">最近会话</div>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {sessions.length ? (
                    sessions.map((session) => (
                      <button
                        key={session.id}
                        className={cn(
                          "w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                          session.id === activeSessionId
                            ? "border-primary bg-card text-foreground"
                            : "border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                        onClick={() => onSwitchSession(session.id)}
                      >
                        <span className="block truncate font-medium">{session.title}</span>
                        <span className="mt-1 block truncate text-muted-foreground">{session.lastMessagePreview || "暂无消息"}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-2 py-3 text-xs text-muted-foreground">暂无历史会话</p>
                  )}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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
              <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">当前会话 · 已读取作品上下文</span>
            </div>
            {hasMoreMessages ? (
              <Button variant="secondary" size="sm" className="w-full rounded-full" onClick={onLoadOlderMessages}>
                <History size={14} />
                加载更早消息
              </Button>
            ) : null}
            {chatStatus === "loading" ? <p className="text-sm text-muted-foreground">消息加载中...</p> : null}

            {messages.map((message) => (
              <div key={message.id} className={cn("animate-pop flex w-full gap-3", message.role === "user" ? "justify-end" : "justify-start")}>
                {message.role === "assistant" ? (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-bold text-primary">AI</div>
                ) : null}
                <div className="max-w-[85%]">
                  <div
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
                      message.role === "user"
                        ? "rounded-br-sm border-primary bg-primary text-primary-foreground"
                        : "rounded-tl-sm border-border bg-background text-card-foreground"
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
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">U</div>
                ) : null}
              </div>
            ))}
          </div>

          <div
            data-testid="workspace-chat-dropzone"
            className={cn(
              "mx-4 mb-4 rounded-2xl border bg-background shadow-sm transition-colors",
              isDropActive ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary))]" : "border-border"
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
            <div className="flex items-center justify-between pl-3 pr-4 py-2">
              <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                {modelStatus === "loading" ? (
                  <span className="text-muted-foreground/50">模型加载中...</span>
                ) : modelStatus === "error" ? (
                  <>
                    <span className="text-destructive">模型列表加载失败</span>
                    <button type="button" className="ml-1 underline hover:no-underline" onClick={onRetryModels}>
                      重试
                    </button>
                  </>
                ) : !selectedModel ? (
                  <span className="text-muted-foreground/50">暂无可用模型</span>
                ) : (
                  <ModelPicker models={aiModels} selectedId={selectedModelId} onSelect={onSelectChatModel} />
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Brain size={12} className="text-muted-foreground/60" />
                  <span>思考</span>
                  <Switch checked={thinkingEnabled} onCheckedChange={onThinkingEnabledChange} aria-label="开启思考" />
                </div>
                {thinkingEnabled ? (
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(thinkingIntensity * 100)}
                    onChange={(event) => onThinkingIntensityChange(Number(event.target.value) / 100)}
                    className="h-1 w-16 cursor-pointer accent-primary"
                    aria-label="思考强度"
                  />
                ) : null}
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
        <div className="absolute inset-0 z-30 flex flex-col bg-background/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between border-b border-border bg-background p-4">
            <div className="flex items-center gap-2">
              <Wand2 size={16} className="text-foreground" />
              <span className="text-sm font-semibold text-foreground">AI 写作建议</span>
            </div>
            <button className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground" onClick={onCloseOverlay} aria-label="关闭写作建议">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {suggestions.map((suggestion, index) => {
              const selected = index === activeSuggestionIndex;
              return (
                <div
                  key={`${suggestion.quote}-${index}`}
                  className={cn("flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm", selected ? "border-primary" : "border-border")}
                >
                  <button className="border-b border-border bg-muted p-4 text-left" onClick={() => onSelectSuggestion(index)}>
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">原文引用</span>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{suggestion.quote}</p>
                  </button>
                  <div className="border-b border-border p-4">
                    <div className="flex items-start text-sm">
                      <AlertCircle size={16} className="mr-2 mt-0.5 shrink-0 text-foreground" />
                      <span className="text-foreground">{suggestion.issue}</span>
                    </div>
                  </div>
                  <div className="bg-background p-4">
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">推荐修改方案</span>
                    <p className="mb-5 text-sm text-foreground">{suggestion.options[0]}</p>
                    <div className="flex gap-3">
                      <button
                        className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                        onClick={() => onAcceptSuggestion(index)}
                      >
                        采纳替换
                      </button>
                      <button
                        className="flex-1 rounded-lg border border-border bg-background py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
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
