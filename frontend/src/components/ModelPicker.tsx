"use client";

import { Brain, Check, ChevronUp, Cpu, Feather, GraduationCap } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import type { AiModelOption } from "@/api";
import { formatToken } from "@/lib/format";
import { cn } from "@/lib/utils";

type ModelPickerProps = {
  models: AiModelOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function scoreTone(score: number): string {
  if (score >= 8) return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
  if (score >= 6) return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
  return "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400";
}

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
        className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition-colors hover:bg-accent"
        onClick={() => setOpen((v) => !v)}
      >
        <Cpu size={12} className="text-muted-foreground/50" />
        <span className="font-medium text-muted-foreground">{selected?.display_name ?? "选择模型"}</span>
        <ChevronUp
          size={11}
          className={cn("text-muted-foreground/40 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="模型列表"
          className="absolute bottom-full left-0 z-30 mb-1 w-[264px] rounded-xl border border-border bg-popover p-1 shadow-lg"
        >
          <div className="max-h-72 space-y-0.5 overflow-y-auto">
            {models.map((model) => {
              const active = model.id === selectedId;
              return (
                <button
                  key={model.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn(
                    "w-full rounded-lg border-l-2 px-3 py-2.5 text-left transition-colors",
                    active
                      ? "border-l-primary bg-primary/5"
                      : "border-l-transparent hover:bg-accent"
                  )}
                  onClick={() => {
                    onSelect(model.id);
                    setOpen(false);
                  }}
                >
                  {/* Name + Token badge + Active check */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn(
                      "truncate text-xs",
                      active ? "font-semibold text-primary" : "font-medium text-popover-foreground"
                    )}>
                      {model.display_name}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                        {formatToken(model.max_context_tokens)}→{formatToken(model.max_output_tokens)}
                      </span>
                      {active && <Check size={13} className="text-primary" strokeWidth={2.5} />}
                    </div>
                  </div>

                  {/* Score indicators */}
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {([
                      { icon: Brain, value: model.logic_score },
                      { icon: Feather, value: model.prose_score },
                      { icon: GraduationCap, value: model.knowledge_score },
                    ] as const).map((dim) => {
                      const Icon = dim.icon;
                      return (
                        <span
                          key={Icon.displayName}
                          className={cn(
                            "inline-flex items-center gap-0.5 rounded px-1 py-px text-[10px] font-medium tabular-nums leading-none",
                            scoreTone(dim.value)
                          )}
                        >
                          <Icon size={10} className="opacity-70" />
                          {dim.value}
                        </span>
                      );
                    })}
                    {model.description ? (
                      <span className="ml-0.5 truncate text-[10px] text-muted-foreground/50">
                        {model.description}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
