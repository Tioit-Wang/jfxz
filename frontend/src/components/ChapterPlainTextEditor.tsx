"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiSuggestion } from "@/api";
import { cn } from "@/lib/utils";

type EditorStyleSettings = {
  fontStack: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  paragraphSpacing: number;
};

type ChapterPlainTextEditorProps = {
  value: string;
  suggestions: ApiSuggestion[];
  activeSuggestionIndex: number | null;
  disabled?: boolean;
  onChange: (value: string) => void;
  onActivateSuggestion: (index: number) => void;
  styleSettings?: EditorStyleSettings;
};

type HoverState = {
  index: number;
  issue: string;
  left: number;
  top: number;
};

const suggestionPluginKey = new PluginKey<DecorationSet>("chapter-suggestions");

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

function plainText(editor: Editor): string {
  return editor.getText({ blockSeparator: "\n" });
}

function buildSuggestionDecorations(editor: Editor, suggestions: ApiSuggestion[], activeIndex: number | null) {
  const decorations: Decoration[] = [];
  editor.state.doc.forEach((block, blockOffset) => {
    const chars: Array<{ char: string; pos: number }> = [];
    const paragraphStart = blockOffset + 1;
    block.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      [...node.text].forEach((char, index) => chars.push({ char, pos: paragraphStart + pos + index }));
    });
    const paragraphText = chars.map((item) => item.char).join("");
    suggestions.forEach((suggestion, index) => {
      const quote = suggestion.quote.trim();
      if (!quote) return;
      const start = paragraphText.indexOf(quote);
      if (start < 0) return;
      const end = start + quote.length - 1;
      const from = chars[start]?.pos;
      const to = chars[end]?.pos;
      if (from === undefined || to === undefined) return;
      decorations.push(
        Decoration.inline(from, to + 1, {
          class: cn(
            "cursor-pointer rounded-sm bg-[#FEF9E7] px-0.5 shadow-[0_0_0_1px_rgba(245,158,11,0.18)]",
            activeIndex === index ? "bg-[#FDE68A] shadow-[0_0_0_1px_rgba(217,119,6,0.45)]" : ""
          ),
          "data-ai-suggestion-index": String(index)
        })
      );
    });
  });
  return DecorationSet.create(editor.state.doc, decorations);
}

function suggestionIndexFromEvent(event: Event): number | null {
  const target = event.target instanceof Element ? event.target : null;
  const node = target?.closest("[data-ai-suggestion-index]");
  if (!node) return null;
  const value = Number(node.getAttribute("data-ai-suggestion-index"));
  return Number.isFinite(value) ? value : null;
}

export function ChapterPlainTextEditor({
  value,
  suggestions,
  activeSuggestionIndex,
  disabled = false,
  onChange,
  onActivateSuggestion,
  styleSettings
}: ChapterPlainTextEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const suggestionsRef = useRef(suggestions);
  const activeIndexRef = useRef(activeSuggestionIndex);
  const activateRef = useRef(onActivateSuggestion);
  const [hover, setHover] = useState<HoverState | null>(null);

  suggestionsRef.current = suggestions;
  activeIndexRef.current = activeSuggestionIndex;
  activateRef.current = onActivateSuggestion;

  const suggestionPlugin = useMemo(
    () =>
      new Plugin({
        key: suggestionPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(transaction, old) {
            const next = transaction.getMeta(suggestionPluginKey);
            if (next instanceof DecorationSet) return next;
            return old.map(transaction.mapping, transaction.doc);
          }
        },
        props: {
          decorations(state) {
            return suggestionPluginKey.getState(state);
          },
          handleDOMEvents: {
            mouseover: (_view, event) => {
              const index = suggestionIndexFromEvent(event);
              if (index === null) return false;
              const suggestion = suggestionsRef.current[index];
              const target = event.target instanceof Element ? event.target.closest("[data-ai-suggestion-index]") : null;
              const container = containerRef.current;
              if (!suggestion || !target || !container) return false;
              const targetRect = target.getBoundingClientRect();
              const containerRect = container.getBoundingClientRect();
              setHover({
                index,
                issue: suggestion.issue,
                left: targetRect.left - containerRect.left,
                top: targetRect.top - containerRect.top - 36
              });
              return false;
            },
            mouseout: (_view, event) => {
              if (suggestionIndexFromEvent(event) !== null) setHover(null);
              return false;
            },
            click: (_view, event) => {
              const index = suggestionIndexFromEvent(event);
              if (index === null) return false;
              event.preventDefault();
              activateRef.current(index);
              return true;
            }
          }
        }
      }),
    []
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bold: false,
        italic: false,
        strike: false,
        code: false
      })
    ],
    content: value ? textDoc(value) : emptyDoc(),
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "min-h-[58vh] flex-1 whitespace-pre-wrap break-words font-serif text-lg leading-9 text-gray-800 outline-none"
      },
      transformPastedText: (text) => text
    },
    onUpdate: ({ editor }) => {
      onChange(plainText(editor));
    }
  });

  useEffect(() => {
    if (!editor || editor.extensionManager.plugins.includes(suggestionPlugin)) return;
    editor.registerPlugin(suggestionPlugin);
  }, [editor, suggestionPlugin]);

  useEffect(() => {
    if (!editor) return;
    const current = plainText(editor);
    if (current === value) return;
    editor.commands.setContent(value ? textDoc(value) : emptyDoc(), { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const decorations = buildSuggestionDecorations(editor, suggestions, activeSuggestionIndex);
    editor.view.dispatch(editor.state.tr.setMeta(suggestionPluginKey, decorations));
    setHover(null);
  }, [activeSuggestionIndex, editor, suggestions]);

  return (
    <div ref={containerRef} className="editor-settings-scope relative flex min-h-[58vh] flex-1 flex-col">
      {styleSettings && (
        <style>{`
          .editor-settings-scope .ProseMirror {
            font-family: ${styleSettings.fontStack} !important;
            font-size: ${styleSettings.fontSize}px !important;
            line-height: ${styleSettings.lineHeight} !important;
            letter-spacing: ${styleSettings.letterSpacing}px !important;
          }
          .editor-settings-scope .ProseMirror p + p {
            margin-top: ${styleSettings.paragraphSpacing}px !important;
          }
        `}</style>
      )}
      {hover ? (
        <div
          className="pointer-events-none absolute z-20 max-w-xs rounded-lg border border-border bg-popover px-3 py-2 text-xs leading-5 text-popover-foreground shadow-lg"
          style={{ left: hover.left, top: Math.max(0, hover.top) }}
        >
          {hover.issue}
        </div>
      ) : null}
      <EditorContent editor={editor} aria-label="章节正文" className="flex min-h-[58vh] flex-1 flex-col" />
    </div>
  );
}
