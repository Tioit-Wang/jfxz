"use client";

import { ArrowRight, Check, Crown, Loader2, ReceiptText, Sparkles, Zap } from "lucide-react";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

function Price({ amount, suffix }: { amount: number; suffix?: string }) {
  return (
    <div className="flex items-end gap-1">
      <span className="mb-1 text-sm font-bold text-neutral-500">¥</span>
      <span className="text-4xl font-black tracking-[-0.08em] text-neutral-950">{amount}</span>
      {suffix ? <span className="mb-1.5 text-xs font-semibold text-neutral-500">{suffix}</span> : null}
    </div>
  );
}

function PlanCard({
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
    <article
      className={cn(
        "relative overflow-hidden rounded-[1.5rem] border p-5 transition-transform duration-300 hover:-translate-y-0.5",
        featured
          ? "border-neutral-950 bg-neutral-950 text-white shadow-[10px_10px_0_rgba(23,23,23,0.12)]"
          : "border-neutral-200 bg-white text-neutral-950 shadow-sm"
      )}
    >
      <div className={cn("absolute -right-10 -top-10 size-32 rounded-full", featured ? "bg-amber-300/20" : "bg-amber-100/70")} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className={cn("text-[10px] font-bold uppercase tracking-[0.24em]", featured ? "text-amber-200" : "text-neutral-400")}>
            会员套餐
          </p>
          <h4 className="mt-2 text-xl font-black tracking-tight">{plan.name}</h4>
        </div>
        <span className={cn("grid size-10 place-items-center rounded-full", featured ? "bg-white text-neutral-950" : "bg-neutral-950 text-white")}>
          <Crown size={18} />
        </span>
      </div>

      <div className="relative mt-6">
        <Price amount={plan.priceAmount} suffix="/月" />
      </div>

      <div className={cn("relative mt-5 space-y-2 rounded-2xl border p-3 text-xs", featured ? "border-white/10 bg-white/5" : "border-neutral-200 bg-neutral-50")}>
        <Feature featured={featured}>每日 {plan.vipDailyPoints.toLocaleString()} VIP 创作积分</Feature>
        {plan.bundledCreditPackPoints > 0 ? (
          <Feature featured={featured}>赠送 {plan.bundledCreditPackPoints.toLocaleString()} 加油包积分</Feature>
        ) : null}
        <Feature featured={featured}>上下文记忆与连续创作支持</Feature>
      </div>

      <Button
        className={cn(
          "relative mt-5 h-11 w-full rounded-xl font-bold",
          featured ? "bg-amber-300 text-neutral-950 hover:bg-amber-200" : "bg-neutral-950 text-white hover:bg-neutral-800"
        )}
        onClick={onPurchase}
        disabled={purchasing}
      >
        {purchasing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
        升级会员
      </Button>
    </article>
  );
}

function Feature({ children, featured }: { children: ReactNode; featured: boolean }) {
  return (
    <p className={cn("flex items-start gap-2", featured ? "text-white/72" : "text-neutral-600")}>
      <Check size={13} className={cn("mt-0.5 shrink-0", featured ? "text-amber-200" : "text-neutral-950")} />
      <span>{children}</span>
    </p>
  );
}

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
    <article className="group flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-neutral-950">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#eef3e7] text-neutral-950">
        <Zap size={20} className="fill-current" />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-black text-neutral-950">{pack.name}</h4>
        <p className="mt-1 text-xs text-neutral-500">{pack.points.toLocaleString()} 积分 · 长期有效</p>
      </div>
      <div className="text-right">
        <p className="text-lg font-black tracking-tight text-neutral-950">¥{pack.priceAmount}</p>
        <button
          className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-neutral-500 transition-colors group-hover:text-neutral-950 disabled:opacity-50"
          onClick={onPurchase}
          disabled={purchasing}
        >
          充值
          {purchasing ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
        </button>
      </div>
    </article>
  );
}

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
      <DialogContent className="overflow-hidden p-0 sm:max-w-5xl xl:max-w-6xl [&_[data-slot=dialog-close]]:right-5 [&_[data-slot=dialog-close]]:top-5 [&_[data-slot=dialog-close]]:z-20 [&_[data-slot=dialog-close]]:bg-white/85 [&_[data-slot=dialog-close]]:backdrop-blur">
        <DialogHeader className="sr-only">
          <DialogTitle>套餐与积分</DialogTitle>
          <DialogDescription>选择适合当前创作节奏的会员套餐或积分加油包。</DialogDescription>
        </DialogHeader>

        <div className="relative max-h-[82vh] overflow-y-auto bg-[#f7f3ea] text-neutral-950">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(202,138,4,0.18),transparent_26%),linear-gradient(135deg,rgba(23,23,23,0.05)_0_1px,transparent_1px_13px)]" />
          <div className="relative grid gap-6 p-6 pt-14 lg:grid-cols-[300px_1fr]">
            <aside className="rounded-[1.6rem] border border-neutral-950 bg-neutral-950 p-5 text-white shadow-[12px_12px_0_rgba(23,23,23,0.12)]">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-200">
                <ReceiptText size={13} />
                套餐中心
              </span>
              <h2 className="mt-8 text-3xl font-black leading-tight tracking-tight">给故事留一盏不断电的灯。</h2>
              <p className="mt-4 text-sm leading-6 text-white/58">
                VIP 适合稳定日更，积分包适合临时加速。两者都会优先服务当前创作工作流。
              </p>
            </aside>

            <main className="min-w-0 space-y-6">
              {loading ? (
                <div className="grid min-h-80 place-items-center rounded-[1.4rem] border border-neutral-200 bg-white/75 text-sm text-neutral-500">
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    正在加载商品信息...
                  </span>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  商品信息加载失败，请关闭后重试。
                </div>
              ) : null}

              {!loading && !error && products.plans.length > 0 ? (
                <section>
                  <div className="mb-3 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold text-neutral-500">会员套餐</p>
                      <h3 className="mt-1 text-xl font-black text-neutral-950">VIP 创作会员</h3>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {products.plans.map((plan, index) => (
                      <PlanCard
                        key={plan.id}
                        plan={plan}
                        featured={index === 0}
                        purchasing={purchasing}
                        onPurchase={() => onPurchase("plan", plan.id)}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {!loading && !error && products.creditPacks.length > 0 ? (
                <section>
                  <div className="mb-3">
                    <p className="text-[11px] font-bold text-neutral-500">积分加油包</p>
                    <h3 className="mt-1 text-xl font-black text-neutral-950">灵感加油包</h3>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
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
              ) : null}
            </main>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
