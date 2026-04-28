"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { type AdminBalanceAdjustInput, type UserProfile } from "@/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: AdminBalanceAdjustInput) => Promise<void>;
}

const bucketLabels: Record<string, string> = {
  vip_daily: "VIP 每日积分",
  credit_pack: "加油包积分",
};

export function BalanceAdjustDialog({ user, open, onOpenChange, onSubmit }: Props) {
  const [changeType, setChangeType] = useState<"grant" | "deduct">("grant");
  const [bucketType, setBucketType] = useState<"vip_daily" | "credit_pack">("credit_pack");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setChangeType("grant");
      setBucketType("credit_pack");
      setAmount("");
      setReason("");
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }, [open]);

  if (!user) return null;

  const currentBalance =
    bucketType === "vip_daily"
      ? user.points.vipDailyPoints
      : user.points.creditPackPoints;

  const parsedAmount = parseFloat(amount);
  const isValidAmount = amount !== "" && !isNaN(parsedAmount) && parsedAmount > 0 && /^\d+(\.\d{1,2})?$/.test(amount);
  const isOverdraft = changeType === "deduct" && isValidAmount && parsedAmount > currentBalance;

  function handleConfirm() {
    if (!isValidAmount) return;
    if (isOverdraft) {
      toast.error("扣除金额不能超过当前余额");
      return;
    }
    setConfirmOpen(true);
  }

  async function doSubmit() {
    setSubmitting(true);
    try {
      await onSubmit({
        bucket_type: bucketType,
        change_type: changeType,
        amount: parsedAmount,
        reason: reason.trim() || undefined,
      });
      toast.success(changeType === "grant" ? "充值成功" : "扣除成功");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>余额操作</DialogTitle>
            <DialogDescription>对「{user.user.email}」的积分余额进行充值或扣除。</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>操作类型</Label>
                <Select value={changeType} onValueChange={(v) => setChangeType(v as "grant" | "deduct")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grant">充值</SelectItem>
                    <SelectItem value="deduct">扣除</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>积分类型</Label>
                <Select value={bucketType} onValueChange={(v) => setBucketType(v as "vip_daily" | "credit_pack")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vip_daily">VIP 每日积分</SelectItem>
                    <SelectItem value="credit_pack">加油包积分</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              当前{bucketLabels[bucketType]}余额：<span className="font-medium">{currentBalance.toFixed(2)}</span>
            </p>
            <div className="flex flex-col gap-1.5">
              <Label>金额</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="请输入金额"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {amount !== "" && !isValidAmount && (
                <p className="text-xs text-destructive">请输入大于 0 的金额，最多两位小数</p>
              )}
              {isOverdraft && (
                <p className="text-xs text-amber-600">扣除金额超过当前余额，将被拒绝</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>备注（可选）</Label>
              <Textarea
                placeholder="操作原因"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button onClick={handleConfirm} disabled={!isValidAmount || submitting}>
              {submitting ? "处理中…" : "确认"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认{changeType === "grant" ? "充值" : "扣除"}？</AlertDialogTitle>
            <AlertDialogDescription>
              将对「{user.user.email}」的{bucketLabels[bucketType]}
              {changeType === "grant" ? "充值" : "扣除"} {parsedAmount.toFixed(2)} 积分。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doSubmit()}>确认</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
