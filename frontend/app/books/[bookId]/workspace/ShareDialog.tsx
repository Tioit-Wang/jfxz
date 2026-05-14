"use client";

import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Check, Copy, ExternalLink } from "lucide-react";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  shareEnabled: boolean;
  shareToken: string | null;
  onShareToggle: (enabled: boolean) => void;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex shrink-0 items-center gap-1 rounded-full border border-[#ebebeb] px-3 py-1.5 text-xs leading-4 text-[#4d4d4d] transition-colors hover:bg-[#fafafa]"
      aria-label={label}
    >
      {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
      {copied ? "已复制" : "复制"}
    </button>
  );
}

export default function ShareDialog({
  open,
  onOpenChange,
  bookId,
  shareEnabled,
  shareToken,
  onShareToggle,
}: ShareDialogProps) {
  const authorPreviewUrl = typeof window !== "undefined"
    ? `${window.location.origin}/books/${bookId}/preview`
    : "";
  const publicUrl = shareToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/s/${shareToken}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden rounded-xl bg-white p-0 shadow-[0px_1px_1px_rgba(0,0,0,0.02),0px_8px_16px_-4px_rgba(0,0,0,0.04),0px_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-[#00000014] sm:max-w-md [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:text-[#888888] [&_[data-slot=dialog-close]]:hover:bg-[#f5f5f5] [&_[data-slot=dialog-close]]:hover:text-[#171717]">
        <DialogHeader className="border-b border-[#ebebeb] px-6 py-5">
          <DialogTitle className="text-xl font-semibold tracking-[-0.6px] text-[#171717]">分享作品</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 px-6 py-5">
          {/* Author preview link */}
          <div className="space-y-2">
            <label className="text-sm leading-5 font-medium text-[#171717]">
              作者预览<span className="ml-1 text-xs leading-4 font-normal text-[#888888]">（仅限登录）</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={authorPreviewUrl}
                className="flex-1 rounded-sm border border-[#ebebeb] bg-[#fafafa] px-3 py-2 text-xs leading-4 text-[#4d4d4d] outline-none"
                onFocus={(e) => e.target.select()}
              />
              <CopyButton text={authorPreviewUrl} label="复制作者预览链接" />
              <a
                href={`/books/${bookId}/preview`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1 rounded-full border border-[#ebebeb] px-3 py-1.5 text-xs leading-4 text-[#4d4d4d] transition-colors hover:bg-[#fafafa]"
                aria-label="在新标签页打开作者预览"
              >
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#ebebeb]" />

          {/* Public sharing toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm leading-5 font-medium text-[#171717]">公开分享</label>
                <p className="mt-0.5 text-xs leading-4 text-[#888888]">
                  {shareEnabled
                    ? "任何人都可以通过链接阅读此作品"
                    : "开启后，任何拥有链接的人都可以阅读此作品"}
                </p>
              </div>
              <Switch
                checked={shareEnabled}
                onCheckedChange={onShareToggle}
                aria-label="开关公开分享"
              />
            </div>

            {shareEnabled && shareToken && (
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={publicUrl}
                  className="flex-1 rounded-sm border border-[#ebebeb] bg-[#fafafa] px-3 py-2 text-xs leading-4 text-[#4d4d4d] outline-none"
                  onFocus={(e) => e.target.select()}
                />
                <CopyButton text={publicUrl} label="复制公开分享链接" />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
