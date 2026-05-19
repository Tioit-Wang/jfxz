"use client";

import { Bold, Code, Heading3, Italic, LinkIcon, List, ListChecks, ListOrdered, Minus, Quote, Strikethrough } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import TipTapLink from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { cn } from "@/lib/utils";

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

export type RichTextEditorHandle = {
  insertText: (text: string) => void;
};

export const RichTextEditor = forwardRef<RichTextEditorHandle, {
  value: string;
  onChange: (value: string) => void;
  minHeight?: number;
}>(function RichTextEditor({ value, onChange, minHeight = 380 }, ref) {
  const prevValueRef = useRef(value);

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
      const md = editor.getMarkdown();
      prevValueRef.current = md;
      onChange(md);
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (value !== prevValueRef.current) {
      editor.commands.setContent(value, { emitUpdate: false });
      prevValueRef.current = value;
    }
  }, [value, editor]);

  useImperativeHandle(ref, () => ({
    insertText(text: string) {
      editor?.chain().focus().insertContent(text).run();
    },
  }), [editor]);

  if (!editor) {
    return (
      <div
        className="flex items-center justify-center rounded-sm border border-[#ebebeb] bg-white text-sm leading-5 text-[#888888]"
        style={{ minHeight }}
      >
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
      <div className="overflow-y-auto" style={{ minHeight: minHeight - 42 }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});
