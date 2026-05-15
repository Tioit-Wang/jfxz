"use client";

import {
  BrainCircuit,
  Calendar,
  ChevronRight,
  Coins,
  CreditCard,
  FileClock,
  MessageSquareText,
  Minus,
  Package,
  PenLine,
  Receipt,
  Settings2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type AdminStats } from "@/api";
import { AdminPage } from "./_components";
import { adminClient } from "./admin-utils";
import { formatToken } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const presets = [
  { label: "今天", getRange: () => { const d = today(); return { from: d, to: d }; } },
  { label: "昨天", getRange: () => { const d = dayDelta(1); return { from: d, to: d }; } },
  { label: "近 7 天", getRange: () => ({ from: dayDelta(6), to: today() }) },
  { label: "近 30 天", getRange: () => ({ from: dayDelta(29), to: today() }) },
] as const;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function dayDelta(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const zeroStats: AdminStats = {
  active_users: 0, total_tokens: 0, cache_hit_tokens: 0, cache_miss_tokens: 0,
  completion_tokens: 0, points_consumed: 0, total_words: 0, ai_words: 0,
  human_words: 0, ai_conversations: 0, total_revenue: 0,
  active_subscriptions: 0, total_works: 0, new_users: 0,
  period: { from: null, to: null }, previous: null, trend: null, daily: null,
};

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return (n / 1_000).toFixed(0) + "k";
  return n.toLocaleString();
}

function trendIcon(val: number | null | undefined) {
  if (val == null) return <Minus className="size-3 text-muted-foreground/50" />;
  if (val > 0) return <TrendingUp className="size-3 text-emerald-500" />;
  if (val < 0) return <TrendingDown className="size-3 text-red-500" />;
  return <Minus className="size-3 text-muted-foreground/50" />;
}

function trendColor(val: number | null | undefined) {
  if (val == null) return "text-muted-foreground/50";
  if (val > 0) return "text-emerald-500";
  if (val < 0) return "text-red-500";
  return "text-muted-foreground/50";
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: number | null;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-card">
      <span className="flex size-9 items-center justify-center rounded-md bg-muted text-foreground/60">
        <Icon className="size-4" />
      </span>
      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-semibold tabular-nums tracking-[-0.02em] text-foreground">{value}</p>
          {trend != null ? (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${trendColor(trend)}`}>
              {trendIcon(trend)}
              {Math.abs(trend)}%
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub ? <p className="text-xs text-muted-foreground/70">{sub}</p> : null}
      </div>
    </div>
  );
}

export default function AdminHome() {
  const client = useMemo(() => adminClient(), []);
  const [stats, setStats] = useState<AdminStats>(zeroStats);
  const [preset, setPreset] = useState<string>("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const fetchStats = useCallback(
    (from?: string, to?: string) => {
      client.getAdminStats(from, to).then(setStats).catch(() => {});
    },
    [client],
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  function selectRange(label: string, from: string, to: string) {
    setPreset(label);
    setCustomFrom(from);
    setCustomTo(to);
    fetchStats(from, to);
  }

  function selectCustom() {
    if (!customFrom || !customTo) return;
    setPreset("");
    fetchStats(customFrom, customTo);
  }

  const showTimeRange = stats.period.from || stats.period.to;
  const t = stats.trend;

  return (
    <AdminPage>


      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-6">
        {/* Time Range Selector */}
        <div className="flex flex-wrap items-center gap-3">
        <Calendar className="size-4 text-muted-foreground shrink-0" />
        <Tabs value={preset} onValueChange={(v) => {
          const p = presets.find((x) => x.label === v);
          if (p) { const r = p.getRange(); selectRange(v, r.from, r.to); }
        }}>
          <TabsList className="h-8 border border-border">
            <TabsTrigger value="" onClick={() => { setPreset(""); setCustomFrom(""); setCustomTo(""); fetchStats(); }} className="text-xs data-[state=active]:bg-card">
              全部
            </TabsTrigger>
            {presets.map((p) => (
              <TabsTrigger key={p.label} value={p.label} className="text-xs data-[state=active]:bg-card">
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <span className="h-4 w-px bg-border" />
        <Input
          type="date"
          className="h-8 w-34 text-xs"
          value={customFrom}
          onChange={(e) => { setCustomFrom(e.target.value); setPreset(""); }}
        />
        <span className="text-xs text-muted-foreground">至</span>
        <Input
          type="date"
          className="h-8 w-34 text-xs"
          value={customTo}
          onChange={(e) => { setCustomTo(e.target.value); setPreset(""); }}
        />
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={selectCustom} disabled={!customFrom || !customTo}>
          应用
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label={showTimeRange ? "新增用户" : "活跃用户"}
          value={showTimeRange ? formatNum(stats.new_users) : formatNum(stats.active_users)}
          sub={showTimeRange ? `总计活跃 ${formatNum(stats.active_users)} 人` : undefined}
          trend={showTimeRange ? t?.new_users : undefined}
        />
        <StatCard
          icon={Zap}
          label="Token 消耗"
          value={stats.total_tokens > 0 ? formatToken(stats.total_tokens) : "0"}
          sub={`消耗 ${stats.points_consumed.toLocaleString()} 积分`}
          trend={showTimeRange ? t?.total_tokens : undefined}
        />
        <StatCard
          icon={PenLine}
          label="写作字数"
          value={formatNum(stats.total_words)}
          sub={`AI 辅助 ${formatNum(stats.ai_words)} · 人工 ${formatNum(stats.human_words)}`}
          trend={showTimeRange ? t?.total_words : undefined}
        />
        <StatCard
          icon={Coins}
          label="总收入"
          value={`¥${stats.total_revenue.toLocaleString()}`}
          sub={`${stats.active_subscriptions} 个活跃订阅`}
          trend={showTimeRange ? t?.total_revenue : undefined}
        />
      </div>

      {/* Secondary Stats */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-border bg-card px-5 py-3 text-xs text-muted-foreground shadow-card">
        <span>
          <MessageSquareText className="inline size-3 mr-1 align-[-2px]" />
          AI 对话 {formatNum(stats.ai_conversations)} 次
          {showTimeRange && t?.ai_conversations != null ? (
            <span className={`ml-1 inline-flex items-center gap-0.5 ${trendColor(t.ai_conversations)}`}>
              {trendIcon(t.ai_conversations)}{Math.abs(t.ai_conversations)}%
            </span>
          ) : null}
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
      </div>
    </AdminPage>
  );
}
