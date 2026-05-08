"use client";

import { Check, Loader2, QrCode, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { BillingOrder } from "@/api";
import { cn } from "@/lib/utils";

type PaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: BillingOrder | null;
  creating: boolean;
  onSimulatePaid?: () => void;
  testEnabled?: boolean;
};

export function PaymentDialog({
  open,
  onOpenChange,
  order,
  creating,
  onSimulatePaid,
  testEnabled,
}: PaymentDialogProps) {
  const isPaid = order?.status === "paid";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-2rem)] overflow-hidden p-0 sm:max-w-lg [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:bg-white"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b border-neutral-200 bg-white px-6 py-5">
          <DialogTitle className="flex items-center gap-3 text-2xl font-black tracking-tight">
            <span className="grid size-10 place-items-center rounded-full border border-neutral-300 bg-white text-neutral-950">
              <ShieldCheck size={18} strokeWidth={2.5} />
            </span>
            支付订单
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-500">
            请使用支付宝扫描二维码完成支付，到账后权益会自动刷新。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 bg-white p-6">
          {order && (
            <div className="flex items-center justify-between rounded-2xl border border-neutral-950 bg-white p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-black text-neutral-950">{order.productName}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                  <span>订单号：{order.orderNo}</span>
                </p>
              </div>
              <div className="ml-4 flex flex-col items-end">
                <p className="text-2xl font-black tracking-tight text-neutral-950">
                  <span className="mr-0.5 text-sm font-medium text-neutral-500">¥</span>
                  {order.amount}
                </p>
                <span
                  className={cn(
                    "mt-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                    isPaid ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-300 bg-white text-neutral-500"
                  )}
                >
                  {isPaid ? "支付成功" : order.status === "pending" ? "等待扫码" : order.status}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center">
            <div className={cn(
              "relative flex w-full flex-col items-center justify-center overflow-hidden rounded-3xl border p-8 transition-all duration-500",
              isPaid 
                ? "border-neutral-950 bg-neutral-950 text-white"
                : "border-neutral-200 bg-white shadow-sm"
            )}>
              {creating && !order ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 animate-ping rounded-full bg-neutral-950/10" />
                    <Loader2 className="relative z-10 h-10 w-10 animate-spin text-neutral-950" strokeWidth={3} />
                  </div>
                  <p className="text-sm font-medium text-neutral-500">
                    正在创建支付订单...
                  </p>
                </div>
              ) : isPaid ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white text-neutral-950">
                    <Check size={40} strokeWidth={4} className="animate-in zoom-in duration-300" />
                  </div>
                  <p className="text-xl font-black">支付成功</p>
                  <p className="mt-2 text-center text-sm font-medium text-white/60">
                    灵感已就绪，立即开启你的创作之旅
                  </p>
                </div>
              ) : order?.qrCode ? (
                <div className="relative z-10 flex flex-col items-center">
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                    <QrCode size={180} className="text-gray-900" strokeWidth={1} />
                  </div>
                  <div className="mt-6 flex items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-950">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-neutral-950 text-[11px] font-bold text-white">
                      支
                    </span>
                    请使用支付宝扫一扫
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <QrCode size={64} className="text-neutral-500" strokeWidth={1} />
                  <p className="mt-4 text-sm font-medium text-neutral-500">
                    获取二维码失败
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="h-[72px] border-t border-neutral-200 bg-white p-0 sm:justify-center">
          <Button
            variant="outline"
            className="rounded-xl border-neutral-300 bg-white"
            onClick={() => onOpenChange(false)}
          >
            关闭
          </Button>
          {testEnabled && order && !isPaid ? (
            <Button
              className="rounded-xl bg-neutral-950 text-white hover:bg-neutral-800"
              onClick={onSimulatePaid}
              disabled={creating}
            >
              模拟支付成功
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
