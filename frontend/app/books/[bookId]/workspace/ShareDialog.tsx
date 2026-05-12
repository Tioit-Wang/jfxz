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
      className="flex shrink-0 items-center gap-1 rounded-md border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-neutral-50"
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>分享作品</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Author preview link */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700">
              作者预览<span className="ml-1 text-xs font-normal text-neutral-400">（仅限登录）</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={authorPreviewUrl}
                className="flex-1 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600 outline-none"
                onFocus={(e) => e.target.select()}
              />
              <CopyButton text={authorPreviewUrl} label="复制作者预览链接" />
              <a
                href={`/books/${bookId}/preview`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1 rounded-md border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-neutral-50"
                aria-label="在新标签页打开作者预览"
              >
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-neutral-100" />

          {/* Public sharing toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-neutral-700">公开分享</label>
                <p className="mt-0.5 text-xs text-neutral-400">
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
                  className="flex-1 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600 outline-none"
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
