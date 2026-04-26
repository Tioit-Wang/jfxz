"use client";

import Mention from "@tiptap/extension-mention";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Loader2, Send, X } from "lucide-react";
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { ChatMention, ChatReference } from "@/api";
import { cn } from "@/lib/utils";

export type ChatMentionInputHandle = {
  clear: () => void;
  focus: () => void;
  setText: (value: string) => void;
};

type MentionQuery = {
  open: boolean;
  query: string;
  range: { from: number; to: number } | null;
  activeIndex: number;
};

type ChatMentionInputProps = {
  valueText: string;
  mentions: ChatMention[];
  items: ChatReference[];
  recentItems: ChatReference[];
  disabled?: boolean;
  placeholder?: string;
  onChange: (text: string, mentions: ChatMention[]) => void;
  onSelectReference: (reference: ChatReference) => void;
  onSubmit: () => void;
};

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

function referenceTone(type: ChatReference["type"]): string {
  if (type === "setting") return "border-primary bg-primary text-primary-foreground";
  if (type === "character") return "border-foreground bg-background text-foreground";
  return "border-border bg-muted text-muted-foreground";
}

function emptyDoc() {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

function textDoc(value: string) {
  const lines = value.split("\n");
  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : undefined
    }))
  };
}

function extractMentionText(editor: Editor): { text: string; mentions: ChatMention[] } {
  let text = "";
  const mentions: ChatMention[] = [];

  editor.state.doc.forEach((block, _offset, index) => {
    if (index > 0) text += "\n";
    block.forEach((node) => {
      if (node.isText) {
        text += node.text ?? "";
        return;
      }
      if (node.type.name !== "mention") return;
      const id = String(node.attrs.id ?? "");
      const type = node.attrs.type as ChatMention["type"];
      const label = String(node.attrs.name ?? node.attrs.label ?? "");
      if (!id || !label || !["chapter", "character", "setting"].includes(type)) return;
      const mentionText = `@${label}`;
      const start = text.length;
      text += mentionText;
      mentions.push({ type, id, label, start, end: start + mentionText.length });
    });
  });

  return { text, mentions };
}

const StructuredMention = Mention.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      name: { default: null },
      type: { default: "chapter" },
      summary: { default: null }
    };
  }
}).configure({
  deleteTriggerWithBackspace: true,
  renderText({ node }) {
    return `@${node.attrs.label ?? node.attrs.name ?? ""}`;
  },
  renderHTML({ node }) {
    return [
      "span",
      {
        class:
          "inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground",
        "data-reference-type": node.attrs.type
      },
      `@${node.attrs.label ?? node.attrs.name ?? ""}`
    ];
  },
  suggestion: {
    char: "@",
    items: () => []
  }
});

export const ChatMentionInput = forwardRef<ChatMentionInputHandle, ChatMentionInputProps>(
  (
    {
      valueText,
      mentions,
      items,
      recentItems,
      disabled = false,
      placeholder = "@章节 或 @角色 后输入你的问题...",
      onChange,
      onSelectReference,
      onSubmit
    },
    ref
  ) => {
    const [mention, setMention] = useState<MentionQuery>({ open: false, query: "", range: null, activeIndex: 0 });
    const editorRef = useRef<Editor | null>(null);
    const mentionRef = useRef(mention);
    const mentionOptionsRef = useRef<ChatReference[]>([]);
    const onSubmitRef = useRef(onSubmit);
    const selectReferenceRef = useRef<(reference: ChatReference) => void>(() => undefined);

    const mentionOptions = useMemo(() => {
      const query = mention.query.trim().toLowerCase();
      const matches = (item: ChatReference) =>
        !query || item.name.toLowerCase().includes(query) || (item.summary ?? "").toLowerCase().includes(query);
      const recent = recentItems.filter(matches);
      const recentKeys = new Set(recent.map(referenceKey));
      if (!query) {
        return dedupeReferences([
          ...recent,
          ...items.filter((item) => item.type === "chapter" && !recentKeys.has(referenceKey(item)))
        ]);
      }
      const orderedTypes: ChatReference["type"][] = ["chapter", "character", "setting"];
      return dedupeReferences([
        ...recent,
        ...orderedTypes.flatMap((type) =>
          items.filter((item) => item.type === type && matches(item) && !recentKeys.has(referenceKey(item)))
        )
      ]);
    }, [items, mention.query, recentItems]);

    mentionRef.current = mention;
    mentionOptionsRef.current = mentionOptions;
    onSubmitRef.current = onSubmit;

    const editor = useEditor({
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: false,
          bulletList: false,
          orderedList: false,
          blockquote: false,
          codeBlock: false,
          horizontalRule: false
        }),
        StructuredMention
      ],
      content: valueText ? textDoc(valueText) : emptyDoc(),
      editable: !disabled,
      editorProps: {
        attributes: {
          class:
            "min-h-[68px] max-h-32 overflow-y-auto whitespace-pre-wrap break-words px-3 py-3 pr-12 text-sm text-foreground outline-none"
        },
        handleKeyDown: (_view, event) => {
          const currentMention = mentionRef.current;
          const currentOptions = mentionOptionsRef.current;
          if (currentMention.open && currentOptions.length) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setMention((current) => ({
                ...current,
                activeIndex: Math.min(current.activeIndex + 1, currentOptions.length - 1)
              }));
              return true;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setMention((current) => ({ ...current, activeIndex: Math.max(current.activeIndex - 1, 0) }));
              return true;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              selectReferenceRef.current(currentOptions[currentMention.activeIndex]);
              return true;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setMention((current) => ({ ...current, open: false, activeIndex: 0 }));
              return true;
            }
          }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            onSubmitRef.current();
            return true;
          }
          return false;
        }
      },
      onUpdate: ({ editor }) => {
        const next = extractMentionText(editor);
        onChange(next.text, next.mentions);
        updateMentionStateFromEditor(editor);
      },
      onSelectionUpdate: ({ editor }) => updateMentionStateFromEditor(editor),
      onBlur: () => {
        window.setTimeout(() => setMention((current) => ({ ...current, open: false, activeIndex: 0 })), 120);
      }
    });

    editorRef.current = editor;

    function updateMentionStateFromEditor(nextEditor: Editor) {
      const { from, empty } = nextEditor.state.selection;
      if (!empty) {
        setMention((current) => ({ ...current, open: false, activeIndex: 0 }));
        return;
      }
      const $from = nextEditor.state.selection.$from;
      const beforeCaret = $from.parent.textBetween(0, $from.parentOffset, "\n", "\0");
      const match = /(^|\s)@([^\s@]*)$/.exec(beforeCaret);
      if (!match) {
        setMention((current) => ({ ...current, open: false, query: "", range: null, activeIndex: 0 }));
        return;
      }
      const query = match[2];
      setMention({
        open: true,
        query,
        range: { from: from - query.length - 1, to: from },
        activeIndex: 0
      });
    }

    function selectReference(reference: ChatReference) {
      const currentEditor = editorRef.current;
      const currentMention = mentionRef.current;
      if (!currentEditor || !currentMention.range) return;
      currentEditor
        .chain()
        .focus()
        .deleteRange(currentMention.range)
        .insertContent([
          {
            type: "mention",
            attrs: {
              id: reference.id,
              label: reference.name,
              name: reference.name,
              type: reference.type,
              summary: reference.summary ?? ""
            }
          },
          { type: "text", text: " " }
        ])
        .run();
      setMention({ open: false, query: "", range: null, activeIndex: 0 });
      onSelectReference(reference);
    }

    selectReferenceRef.current = selectReference;

    useEffect(() => {
      if (!editor) return;
      const current = editor.getText({ blockSeparator: "\n" });
      if (current === valueText) return;
      editor.commands.setContent(valueText ? textDoc(valueText) : emptyDoc(), { emitUpdate: false });
      if (!mentions.length) {
        setMention({ open: false, query: "", range: null, activeIndex: 0 });
      }
    }, [editor, mentions.length, valueText]);

    useEffect(() => {
      editor?.setEditable(!disabled);
    }, [disabled, editor]);

    useImperativeHandle(
      ref,
      () => ({
        clear() {
          editor?.commands.setContent(emptyDoc(), { emitUpdate: false });
          setMention({ open: false, query: "", range: null, activeIndex: 0 });
          onChange("", []);
        },
        focus() {
          editor?.commands.focus("end");
        },
        setText(value: string) {
          editor?.commands.setContent(value ? textDoc(value) : emptyDoc(), { emitUpdate: false });
          setMention({ open: false, query: "", range: null, activeIndex: 0 });
          onChange(value, []);
          window.setTimeout(() => editor?.commands.focus("end"), 0);
        }
      }),
      [editor, onChange]
    );

    return (
      <div className="relative rounded-xl border border-input bg-background shadow-sm transition-all focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
        {mention.open && mentionOptions.length ? (
          <div className="absolute bottom-full left-0 right-0 z-20 mb-2 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-soft">
            {mentionOptions.map((item, index) => (
              <button
                key={referenceKey(item)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs",
                  index === mention.activeIndex
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectReference(item)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.name}</span>
                  <span
                    className={cn(
                      "block truncate",
                      index === mention.activeIndex ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}
                  >
                    {item.summary || item.type}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded border px-1.5 py-0.5",
                    index === mention.activeIndex ? "border-primary-foreground/70 text-primary-foreground" : referenceTone(item.type)
                  )}
                >
                  {item.type}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {editor?.isEmpty ? (
          <span className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground">{placeholder}</span>
        ) : null}
        <EditorContent editor={editor} aria-label="AI 对话输入" />
        <div className="absolute bottom-2 right-2">
          <button
            className="rounded-lg bg-primary p-2 text-primary-foreground opacity-90 transition-colors hover:bg-primary/90 hover:opacity-100 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-80"
            onClick={onSubmit}
            disabled={disabled}
            aria-label="发送消息"
          >
            {disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        <button
          className="absolute bottom-2 right-11 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={() => {
            editor?.commands.clearContent();
            onChange("", []);
          }}
          aria-label="清空输入"
          type="button"
        >
          <X size={14} />
        </button>
      </div>
    );
  }
);

ChatMentionInput.displayName = "ChatMentionInput";
