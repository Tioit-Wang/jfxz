"use client";

import { Check, Loader2, QrCode, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-xl font-bold">
            <ShieldCheck size={24} className="text-emerald-500" strokeWidth={2.5} />
            安全支付
          </DialogTitle>
          <DialogDescription className="text-center text-sm">
            请使用 <span className="font-semibold text-[#1677ff]">支付宝</span> 扫描下方二维码完成支付，权益将秒级到账
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* 订单摘要 */}
          {order && (
            <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold text-foreground">{order.productName}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>单号：{order.orderNo}</span>
                </p>
              </div>
              <div className="ml-4 flex flex-col items-end">
                <p className="text-2xl font-black tracking-tight text-foreground">
                  <span className="text-sm font-medium text-muted-foreground mr-0.5">¥</span>
                  {order.amount}
                </p>
                <Badge
                  variant={isPaid ? "default" : "secondary"}
                  className={cn(
                    "mt-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    isPaid ? "bg-emerald-500 hover:bg-emerald-600" : "bg-muted text-muted-foreground"
                  )}
                >
                  {isPaid ? "支付成功" : order.status === "pending" ? "等待扫码" : order.status}
                </Badge>
              </div>
            </div>
          )}

          {/* 二维码区域 */}
          <div className="flex flex-col items-center">
            <div className={cn(
              "relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border-2 p-8 transition-all duration-500",
              isPaid 
                ? "border-emerald-500 bg-emerald-50/50 shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)]" 
                : "border-border bg-card shadow-sm hover:border-[#1677ff]/30 hover:shadow-md"
            )}>
              {/* 背景装饰光效 */}
              {!isPaid && !creating && order?.qrCode && (
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1677ff]/5 to-transparent opacity-50" />
              )}
              
              {creating && !order ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    <Loader2 className="relative z-10 h-10 w-10 animate-spin text-primary" strokeWidth={3} />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    正在创建安全支付订单...
                  </p>
                </div>
              ) : isPaid ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                    <Check size={40} strokeWidth={4} className="animate-in zoom-in duration-300" />
                  </div>
                  <p className="text-xl font-bold text-emerald-600">支付成功！</p>
                  <p className="mt-2 text-center text-sm font-medium text-emerald-600/70">
                    灵感已就绪，立即开启你的创作之旅
                  </p>
                </div>
              ) : order?.qrCode ? (
                <div className="relative z-10 flex flex-col items-center">
                  <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                    <QrCode size={180} className="text-gray-900" strokeWidth={1} />
                  </div>
                  <div className="mt-6 flex items-center justify-center gap-2 rounded-full bg-[#1677ff]/10 px-4 py-2 text-sm font-medium text-[#1677ff]">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-[#1677ff] text-[11px] font-bold text-white shadow-sm">
                      支
                    </span>
                    请使用支付宝扫一扫
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <QrCode size={64} className="text-muted-foreground" strokeWidth={1} />
                  <p className="mt-4 text-sm font-medium text-muted-foreground">
                    获取二维码失败
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 测试支付按钮 */}
          {testEnabled && order && !isPaid && (
            <Button
              className="w-full"
              variant="outline"
              size="sm"
              onClick={onSimulatePaid}
              disabled={creating}
            >
              模拟支付成功
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}