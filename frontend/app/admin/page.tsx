"use client";

import {
  BrainCircuit,
  ChevronRight,
  Coins,
  CreditCard,
  FileClock,
  MessageSquareText,
  Package,
  PenLine,
  Receipt,
  Settings2,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type AdminStats } from "@/api";
import { AdminHeading, AdminPage } from "./_components";
import { adminClient } from "./admin-utils";
import { formatToken } from "@/lib/format";

const modules = [
  { title: "用户与权限", description: "查看用户资料、账户状态、订阅和积分", href: "/admin/users", icon: Users },
  { title: "模型管理", description: "管理 AI 模型配置和定价", href: "/admin/models", icon: BrainCircuit },
  { title: "套餐与加油包", description: "管理订阅套餐和积分加油包", href: "/admin/products", icon: Package },
  { title: "订单管理", description: "查看订单、支付状态和权益发放", href: "/admin/orders", icon: CreditCard },
  { title: "订阅管理", description: "查看用户订阅状态和周期", href: "/admin/subscriptions", icon: FileClock },
  { title: "积分流水", description: "查看用户积分发放与消费记录", href: "/admin/credit-transactions", icon: Receipt },
  { title: "会话审计", description: "查看 AI 对话记录和上下文", href: "/admin/sessions", icon: MessageSquareText },
  { title: "系统配置", description: "管理系统参数和配置项", href: "/admin/configs", icon: Settings2 },
];

const zeroStats: AdminStats = {
  active_users: 0, total_tokens: 0, cache_hit_tokens: 0, cache_miss_tokens: 0,
  completion_tokens: 0, points_consumed: 0, total_words: 0, ai_words: 0,
  human_words: 0, ai_conversations: 0, total_revenue: 0,
  active_subscriptions: 0, total_works: 0, new_users_today: 0,
};

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return (n / 1_000).toFixed(0) + "k";
  return n.toLocaleString();
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-card">
      <span className="flex size-9 items-center justify-center rounded-md bg-muted text-foreground/60">
        <Icon className="size-4" />
      </span>
      <div className="space-y-1">
        <p className="text-2xl font-semibold tabular-nums tracking-[-0.02em] text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub ? <p className="text-xs text-muted-foreground/70">{sub}</p> : null}
      </div>
    </div>
  );
}

export default function AdminHome() {
  const client = useMemo(() => adminClient(), []);
  const [stats, setStats] = useState<AdminStats>(zeroStats);

  useEffect(() => {
    client.getAdminStats().then(setStats).catch(() => {});
  }, [client]);

  return (
    <AdminPage>
      <AdminHeading title="后台概览" description="平台核心运营数据与功能入口。" />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="活跃用户"
          value={formatNum(stats.active_users)}
          sub={`今日新增 ${stats.new_users_today} 人`}
        />
        <StatCard
          icon={Zap}
          label="Token 消耗"
          value={stats.total_tokens > 0 ? formatToken(stats.total_tokens) : "0"}
          sub={`消耗 ${stats.points_consumed.toLocaleString()} 积分`}
        />
        <StatCard
          icon={PenLine}
          label="写作字数"
          value={formatNum(stats.total_words)}
          sub={`AI 辅助 ${formatNum(stats.ai_words)} · 人工 ${formatNum(stats.human_words)}`}
        />
        <StatCard
          icon={Coins}
          label="总收入"
          value={`¥${stats.total_revenue.toLocaleString()}`}
          sub={`${stats.active_subscriptions} 个活跃订阅`}
        />
      </div>

      {/* Secondary Stats */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-border bg-card px-5 py-3 text-xs text-muted-foreground shadow-card">
        <span>
          <MessageSquareText className="inline size-3 mr-1 align-[-2px]" />
          AI 对话 {formatNum(stats.ai_conversations)} 次
        </span>
        <span className="text-border">·</span>
        <span>
          <ShieldCheck className="inline size-3 mr-1 align-[-2px]" />
          {stats.total_works} 部作品
        </span>
        <span className="text-border">·</span>
        <span className="font-mono">
          缓存 {formatToken(stats.cache_hit_tokens)} · 未命中 {formatToken(stats.cache_miss_tokens)} · 输出 {formatToken(stats.completion_tokens)}
        </span>
      </div>

      {/* Module Navigation */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">功能模块</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-card-float"
            >
              <div className="flex items-start justify-between">
                <span className="flex size-9 items-center justify-center rounded-md bg-muted text-foreground/70">
                  <m.icon className="size-4" />
                </span>
                <ChevronRight className="size-4 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground/60" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold tracking-[-0.01em] text-foreground">{m.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{m.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AdminPage>
  );
}
