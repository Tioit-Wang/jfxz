"use client";

import { ChevronUp } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import type { AiModelOption } from "@/api";
import { formatToken } from "@/lib/format";
import { cn } from "@/lib/utils";

type ModelPickerProps = {
  models: AiModelOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ModelPicker({ models, selectedId, onSelect }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selected = models.find((m) => m.id === selectedId);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        role="combobox"
        aria-label="选择对话模型"
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
        onClick={() => setOpen((v) => !v)}
      >
        {selected?.display_name ?? "选择模型"}
        <ChevronUp
          size={12}
          className={cn("transition-transform", open ? "rotate-180" : "")}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="模型列表"
          className="absolute bottom-full left-0 z-30 mb-2 w-72 rounded-xl border border-gray-100 bg-white p-2 shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
        >
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {models.map((model) => {
              const active = model.id === selectedId;
              return (
                <button
                  key={model.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn(
                    "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                    active
                      ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                  onClick={() => {
                    onSelect(model.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{model.display_name}</span>
                    <span className={cn("text-[10px]", active ? "text-blue-400" : "text-gray-300")}>
                      ×{Number(model.output_multiplier).toFixed(1)}
                    </span>
                  </div>
                  <div className={cn("mt-1 flex gap-2 text-[10px]", active ? "text-blue-500" : "text-gray-400")}>
                    <span>逻辑 {model.logic_score}</span>
                    <span>文笔 {model.prose_score}</span>
                    <span>知识 {model.knowledge_score}</span>
                    <span>{formatToken(model.max_context_tokens)} / {formatToken(model.max_output_tokens)}</span>
                  </div>
                  {model.description ? (
                    <div className={cn("mt-1 line-clamp-1 text-[10px]", active ? "text-blue-400" : "text-gray-300")}>
                      {model.description}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
