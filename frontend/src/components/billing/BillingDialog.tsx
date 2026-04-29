"use client";

import { Crown, Zap, Check, Loader2, Sparkles, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BillingProducts, BillingProduct } from "@/api";
import { cn } from "@/lib/utils";

type BillingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: BillingProducts;
  loading: boolean;
  error: boolean;
  purchasing: boolean;
  onPurchase: (type: "plan" | "credit_pack", id: string) => void;
};

/* ─── VIP 套餐卡片 ─── */
function VipPlanCard({
  plan,
  featured,
  purchasing,
  onPurchase,
}: {
  plan: BillingProduct;
  featured: boolean;
  purchasing: boolean;
  onPurchase: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl border p-6 transition-all duration-300",
        featured
          ? "border-amber-300/80 bg-gradient-to-b from-amber-50/80 to-white shadow-[0_8px_30px_-12px_rgba(245,158,11,0.2)] hover:border-amber-400 hover:shadow-[0_8px_30px_-12px_rgba(245,158,11,0.3)] hover:-translate-y-0.5"
          : "border-border bg-card hover:border-amber-200/60 hover:shadow-md hover:-translate-y-0.5"
      )}
    >
      {/* 推荐角标 */}
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-0.5 text-xs font-bold text-white shadow-sm ring-4 ring-white">
            <Star size={12} className="fill-white" />
            超值推荐
          </div>
        </div>
      )}

      {/* 头部 */}
      <div className="mb-4 mt-2 flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
            featured
              ? "bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600 group-hover:from-amber-200 group-hover:to-orange-200"
              : "bg-muted text-muted-foreground group-hover:bg-amber-50 group-hover:text-amber-600"
          )}
        >
          <Crown size={20} strokeWidth={2.5} />
        </div>
        <h4 className="text-lg font-bold tracking-tight text-foreground">{plan.name}</h4>
      </div>

      {/* 价格 */}
      <div className="mb-6 flex items-end gap-1">
        <span className="mb-1.5 text-lg font-medium text-muted-foreground">¥</span>
        <span className="text-4xl font-black tracking-tighter text-foreground">
          {plan.priceAmount}
        </span>
        <span className="mb-1.5 text-sm font-medium text-muted-foreground">/月</span>
      </div>

      {/* 权益列表 */}
      <ul className="mb-6 flex-1 space-y-3.5">
        <li className="flex items-start gap-3 text-sm text-muted-foreground">
          <div className="mt-0.5 rounded-full bg-amber-100 p-0.5 text-amber-600">
            <Check size={12} strokeWidth={3} />
          </div>
          <span>
            每日重置{" "}
            <strong className="font-bold text-foreground">
              {plan.vipDailyPoints}
            </strong>{" "}
            专属创作积分
          </span>
        </li>
        {plan.bundledCreditPackPoints > 0 && (
          <li className="flex items-start gap-3 text-sm text-muted-foreground">
            <div className="mt-0.5 rounded-full bg-amber-100 p-0.5 text-amber-600">
              <Check size={12} strokeWidth={3} />
            </div>
            <span>
              额外赠送{" "}
              <strong className="font-bold text-foreground">
                {plan.bundledCreditPackPoints}
              </strong>{" "}
              永久灵感加油包
            </span>
          </li>
        )}
        <li className="flex items-start gap-3 text-sm text-muted-foreground">
          <div className="mt-0.5 rounded-full bg-amber-100 p-0.5 text-amber-600">
            <Check size={12} strokeWidth={3} />
          </div>
          <span>解锁上下文感知记忆，无缝连贯写作</span>
        </li>
      </ul>

      {/* 购买按钮 */}
      <Button
        className={cn(
          "h-11 w-full rounded-xl text-sm font-bold shadow-sm transition-all",
          featured
            ? "border-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 hover:shadow-md"
            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
        )}
        onClick={onPurchase}
        disabled={purchasing}
      >
        {purchasing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        {purchasing ? "正在创建订单" : "立即升级 VIP"}
      </Button>
    </div>
  );
}

/* ─── 加油包卡片 ─── */
function CreditPackCard({
  pack,
  purchasing,
  onPurchase,
}: {
  pack: BillingProduct;
  purchasing: boolean;
  onPurchase: () => void;
}) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-300/80 hover:shadow-[0_8px_24px_-12px_rgba(59,130,246,0.15)]">
      {/* 装饰背景 */}
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-bl from-blue-100/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      
      {/* 头部 */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500 transition-colors group-hover:bg-blue-100 group-hover:text-blue-600">
          <Zap size={20} className="fill-current" />
        </div>
        <div>
          <h4 className="font-bold text-foreground">{pack.name}</h4>
          <p className="mt-0.5 text-[11px] text-muted-foreground">永久有效，随时取用</p>
        </div>
      </div>

      {/* 积分数 */}
      <div className="mb-6 flex items-baseline gap-1">
        <span className="text-3xl font-black tracking-tight text-foreground">
          {pack.points.toLocaleString()}
        </span>
        <span className="text-sm font-medium text-muted-foreground">积分点</span>
      </div>

      {/* 价格 + 购买 */}
      <div className="mt-auto flex items-center justify-between rounded-xl bg-muted/40 p-1.5 pl-4 backdrop-blur-sm">
        <div className="flex items-baseline gap-0.5">
          <span className="text-sm font-medium text-muted-foreground">¥</span>
          <span className="text-xl font-bold text-foreground">
            {pack.priceAmount}
          </span>
        </div>
        <Button
          size="sm"
          className="rounded-lg bg-blue-500 px-4 font-bold text-white shadow-sm transition-all hover:bg-blue-600 hover:shadow group-hover:scale-105"
          onClick={onPurchase}
          disabled={purchasing}
        >
          {purchasing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "充值"
          )}
        </Button>
      </div>
    </div>
  );
}

/* ─── 主弹窗 ─── */
export function BillingDialog({
  open,
  onOpenChange,
  products,
  loading,
  error,
  purchasing,
  onPurchase,
}: BillingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader className="mb-2">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Sparkles size={24} className="text-amber-500" />
            探索无限创作潜能
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            选择适合你的创作方案，解锁强大的 AI 写作记忆与智能分析。
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[66vh] space-y-10 overflow-y-auto px-0.5 pb-2">
          {/* 加载中 */}
          {loading && (
            <div className="flex flex-col items-center py-14 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="mt-3 text-sm">正在加载商品信息...</p>
            </div>
          )}

          {/* 加载失败 */}
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              商品信息加载失败，请关闭后重试
            </div>
          )}

          {/* ── VIP 套餐 ── */}
          {!loading && !error && products.plans.length > 0 && (
            <section>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100/80 ring-4 ring-amber-50/50">
                  <Crown size={20} className="text-amber-600" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">VIP 创作会员</h3>
                  <p className="text-xs font-medium text-muted-foreground">
                    沉浸式创作体验，每日专属算力，释放无穷灵感
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {products.plans.map((plan, i) => (
                  <VipPlanCard
                    key={plan.id}
                    plan={plan}
                    featured={i === 0}
                    purchasing={purchasing}
                    onPurchase={() => onPurchase("plan", plan.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── 灵感加油包 ── */}
          {!loading && !error && products.creditPacks.length > 0 && (
            <section>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 ring-4 ring-blue-50/30">
                  <Zap size={20} className="fill-blue-500 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">灵感加油包</h3>
                  <p className="text-xs font-medium text-muted-foreground">
                    灵活补充算力，告别卡壳，永不过期
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {products.creditPacks.map((pack) => (
                  <CreditPackCard
                    key={pack.id}
                    pack={pack}
                    purchasing={purchasing}
                    onPurchase={() => onPurchase("credit_pack", pack.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}