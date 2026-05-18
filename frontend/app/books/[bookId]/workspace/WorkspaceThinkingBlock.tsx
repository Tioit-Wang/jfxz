"use client";

import { Brain, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type WorkspaceThinkingBlockProps = {
  content: string;
  expanded: boolean;
  onToggle: () => void;
  isStreaming?: boolean;
};

export function WorkspaceThinkingBlock({ content, expanded, onToggle, isStreaming }: WorkspaceThinkingBlockProps) {
  return (
    <div className={cn("flex overflow-hidden rounded-[10px] border border-[#eee] bg-[#fafafa]", isStreaming && "streaming")}>
      <div className={cn("w-[3px] shrink-0 bg-gradient-to-b from-[#b0b0b0] to-[#ccc] transition-all", isStreaming && "animate-pulse from-[#999] to-[#bbb]")} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="flex w-full cursor-pointer select-none items-center gap-1.5 px-3 py-2 text-left transition-colors hover:bg-[rgba(0,0,0,0.02)]"
          onClick={onToggle}
        >
          <Brain size={13} className="shrink-0 text-[#aaa]" />
          <span className={cn("text-[11px] font-medium", isStreaming ? "text-[#777]" : "text-[#999]")}>
            {isStreaming ? "思考中" : "思考过程"}
          </span>
          <span className="text-[10px] text-[#bbb]">
            {content.length > 0 ? `${content.length}字` : ""}
          </span>
          <ChevronDown
            size={12}
            className={cn("ml-auto shrink-0 text-[#ccc] transition-transform duration-300", expanded && "rotate-180")}
          />
        </button>
        <div className={cn("tool-collapse", expanded && "expanded")}>
          <div>
            <div className="border-t border-[#eee] p-2.5">
              <p className="max-h-64 overflow-auto whitespace-pre-wrap text-[11px] leading-[1.65] text-[#888] italic">
                {content}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
