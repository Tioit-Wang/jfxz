"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  PenLine,
  ArrowRight,
  Users,
  MessageSquare,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="lp">
      {/* ============ Navigation ============ */}
      <header className="lp-nav">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-base font-semibold tracking-wide" style={{ color: "var(--lp-ink)" }}>
            金番写作
          </Link>
          <nav className="flex items-center gap-8">
            <a href="#features" className="hidden text-sm sm:block" style={{ color: "var(--lp-ink-light)" }}>
              功能
            </a>
            <a href="#workflow" className="hidden text-sm sm:block" style={{ color: "var(--lp-ink-light)" }}>
              流程
            </a>
            <a href="#pricing" className="hidden text-sm sm:block" style={{ color: "var(--lp-ink-light)" }}>
              价格
            </a>
            <Button asChild className="lp-btn-accent h-9 rounded-md px-5 text-sm">
              <Link href="/books">
                开始创作
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* ============ Hero ============ */}
      <section className="relative overflow-hidden">
        <div className="lp-hero-atmos" aria-hidden="true" />
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-20 lg:pb-28 lg:pt-32">
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            {/* Hero Text */}
            <div className={`lp-fade-up ${mounted ? "lp-visible" : ""}`}>
              <span
                className="mb-6 inline-block rounded-full border px-3 py-1 text-xs tracking-widest"
                style={{ color: "var(--lp-accent)", borderColor: "rgba(192,74,26,0.2)" }}
              >
                长篇写作工作台
              </span>
              <h1
                className="mb-6 text-5xl font-semibold leading-[1.08] tracking-tight md:text-6xl lg:text-7xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                让长篇创作
                <br />
                <em className="not-italic" style={{ color: "var(--lp-accent)" }}>有迹可循</em>
              </h1>
              <p className="mb-10 max-w-md text-lg leading-relaxed" style={{ color: "var(--lp-ink-light)" }}>
                面向长篇内容创作的 AI 辅助工作台。集中维护作品上下文、章节进度、角色设定与持续对话——让 AI 真正理解你的故事。
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" asChild className="lp-btn-accent rounded-lg text-base">
                  <Link href="/books">
                    <PenLine className="mr-2 h-4 w-4" />
                    开始创作
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="rounded-lg text-base"
                  style={{ borderColor: "var(--lp-border)", color: "var(--lp-ink)" }}
                >
                  <a href="#pricing">查看套餐</a>
                </Button>
              </div>
            </div>

            {/* Hero Visual — Workspace Mockup */}
            <div className={`lp-fade-up lp-fade-up-d1 ${mounted ? "lp-visible" : ""}`}>
              <div className="lp-mockup">
                {/* Sidebar */}
                <div className="lp-mockup-side">
                  <div className="lp-mockup-side-label">我的作品</div>
                  <div className="lp-mockup-side-active">第一章：相遇</div>
                  <div className="lp-mockup-side-item">第二章：冲突</div>
                  <div className="lp-mockup-side-item">第三章：转折</div>
                  <div className="lp-mockup-side-item">第四章：...</div>
                  <div className="lp-mockup-side-sep" />
                  <div className="lp-mockup-side-label">角色</div>
                  <div className="lp-mockup-side-item">林墨</div>
                  <div className="lp-mockup-side-item">苏晴</div>
                </div>
                {/* Editor */}
                <div className="lp-mockup-editor">
                  <div className="mb-2 text-[13px] font-semibold" style={{ color: "var(--lp-ink)" }}>
                    第一章：相遇
                  </div>
                  <p className="text-[11px] leading-[1.75]" style={{ color: "var(--lp-ink-light)" }}>
                    城市的边缘，有一座被遗忘的图书馆。林墨第一次走进这里时，空气中弥漫着旧书特有的墨香，光线从高窗落下，在书架间投下细长的影子。
                    <span className="lp-mockup-cursor" />
                  </p>
                </div>
                {/* AI Panel */}
                <div className="lp-mockup-ai">
                  <div className="lp-mockup-ai-badge">AI</div>
                  <p className="text-[10px] leading-[1.5]" style={{ color: "var(--lp-ink-light)" }}>
                    基于林墨「内向、热爱阅读」的人设，建议在图书馆场景中加入他与某本特定书籍的互动细节，强化人物特质。
                  </p>
                  <div className="lp-mockup-ai-input">输入你的问题...</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Features ============ */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14">
            <h2
              className="mb-3 text-3xl font-semibold tracking-tight md:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              核心能力
            </h2>
            <p className="max-w-md text-base" style={{ color: "var(--lp-ink-light)" }}>
              从作品架构到 AI 辅助，一站式解决长篇写作的核心需求。
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {/* Feature 1 — Wide */}
            <div className={`lp-card lp-fade-up md:col-span-2 ${mounted ? "lp-visible lp-fade-up-d1" : ""}`}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
                <div className="lp-card-icon shrink-0">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-semibold">作品管理</h3>
                  <p className="max-w-lg text-[15px] leading-relaxed" style={{ color: "var(--lp-ink-light)" }}>
                    集中维护短简介、梗概、题材标签和世界规则。所有创作上下文一目了然，不再需要在多个文档间跳转。
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className={`lp-card lp-fade-up ${mounted ? "lp-visible lp-fade-up-d2" : ""}`}>
              <div className="lp-card-icon mb-4">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">角色设定</h3>
              <p className="text-[15px] leading-relaxed" style={{ color: "var(--lp-ink-light)" }}>
                角色与非人物设定分区管理，避免上下文混杂。每个角色有独立的背景、性格和关系档案。
              </p>
            </div>

            {/* Feature 3 */}
            <div className={`lp-card lp-fade-up ${mounted ? "lp-visible lp-fade-up-d2" : ""}`}>
              <div className="lp-card-icon mb-4">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">AI 对话</h3>
              <p className="text-[15px] leading-relaxed" style={{ color: "var(--lp-ink-light)" }}>
                基于作品、章节、角色和设定的持续对话。AI 记住你的故事脉络，每次对话都在正确的上下文中。
              </p>
            </div>

            {/* Feature 4 — Wide */}
            <div className={`lp-card lp-fade-up md:col-span-2 ${mounted ? "lp-visible lp-fade-up-d3" : ""}`}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
                <div className="lp-card-icon shrink-0">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-semibold">AI 分析</h3>
                  <p className="max-w-lg text-[15px] leading-relaxed" style={{ color: "var(--lp-ink-light)" }}>
                    分析当前章节并给出可采纳的修改建议。从叙事节奏、人物一致性到情节逻辑，全方位审视你的创作。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ How It Works ============ */}
      <section id="workflow" className="py-24" style={{ background: "var(--lp-bg-alt)" }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14">
            <h2
              className="mb-3 text-3xl font-semibold tracking-tight md:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              写作流程
            </h2>
            <p className="max-w-md text-base" style={{ color: "var(--lp-ink-light)" }}>
              从创建作品到 AI 辅助分析，每一步都围绕你的创作节奏设计。
            </p>
          </div>

          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { num: "01", title: "创建作品", desc: "设定作品名称、题材、世界观规则，建立创作根基。" },
              { num: "02", title: "设定角色", desc: "建立角色档案，定义性格、背景和人物关系。" },
              { num: "03", title: "AI 辅助写作", desc: "在章节编辑器中与 AI 持续对话，获取上下文相关的创作建议。" },
              { num: "04", title: "智能分析", desc: "AI 审视章节内容，给出叙事、逻辑和一致性维度的改进建议。" },
            ].map((step, i) => (
              <div
                key={step.num}
                className={`lp-step lp-fade-up ${mounted ? `lp-visible lp-fade-up-d${i + 1}` : ""}`}
              >
                <span className="lp-step-num">{step.num}</span>
                <h3 className="mb-2 mt-3 text-base font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--lp-ink-light)" }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Pricing ============ */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-14 text-center">
            <h2
              className="mb-3 text-3xl font-semibold tracking-tight md:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              选择套餐
            </h2>
            <p className="mx-auto max-w-sm text-base" style={{ color: "var(--lp-ink-light)" }}>
              按你的写作节奏选择月卡或加油包。
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Monthly */}
            <div className="lp-card">
              <h3 className="mb-2 text-xl font-semibold">创作月卡</h3>
              <p className="mb-6 text-sm leading-relaxed" style={{ color: "var(--lp-ink-light)" }}>
                月度积分 + 附带加油包积分，适合持续写作。
              </p>
              <div className="mb-6 h-px" style={{ background: "var(--lp-border)" }} />
              <ul className="mb-8 flex flex-col gap-3 text-sm" style={{ color: "var(--lp-ink-light)" }}>
                <li>每月固定积分额度</li>
                <li>附带加油包积分</li>
                <li>所有 AI 功能可用</li>
              </ul>
              <Button
                variant="outline"
                asChild
                className="w-full rounded-lg"
                style={{ borderColor: "var(--lp-border)", color: "var(--lp-ink)" }}
              >
                <Link href="/books">选择月卡</Link>
              </Button>
            </div>

            {/* Booster */}
            <div className="lp-card lp-price-accent relative">
              <span
                className="absolute -top-3 right-6 rounded-full px-3 py-1 text-xs font-semibold text-white"
                style={{ background: "var(--lp-accent)" }}
              >
                推荐
              </span>
              <h3 className="mb-2 text-xl font-semibold">灵感加油包</h3>
              <p className="mb-6 text-sm leading-relaxed" style={{ color: "var(--lp-ink-light)" }}>
                单独补充积分，适合集中冲刺章节。
              </p>
              <div className="mb-6 h-px" style={{ background: "var(--lp-border)" }} />
              <ul className="mb-8 flex flex-col gap-3 text-sm" style={{ color: "var(--lp-ink-light)" }}>
                <li>按需购买积分</li>
                <li>不限使用期限</li>
                <li>所有 AI 功能可用</li>
              </ul>
              <Button asChild className="lp-btn-accent w-full rounded-lg">
                <Link href="/books">购买加油包</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Final CTA ============ */}
      <section className="py-24 text-center" style={{ background: "var(--lp-bg-alt)" }}>
        <div className="mx-auto max-w-2xl px-6">
          <h2
            className="mb-4 text-3xl font-semibold tracking-tight md:text-4xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            开始你的长篇创作
          </h2>
          <p className="mb-10 text-base" style={{ color: "var(--lp-ink-light)" }}>
            从第一行字到完整故事，金番写作陪你走完每一步。
          </p>
          <Button size="lg" asChild className="lp-btn-accent rounded-lg text-base">
            <Link href="/books">
              <PenLine className="mr-2 h-4 w-4" />
              免费开始
            </Link>
          </Button>
        </div>
      </section>

      {/* ============ Footer ============ */}
      <footer className="py-8" style={{ borderTop: "1px solid var(--lp-border)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <span className="text-sm font-semibold" style={{ fontFamily: "var(--lp-serif)" }}>
            金番写作
          </span>
          <span className="text-xs" style={{ color: "var(--lp-muted)" }}>
            &copy; 2026 金番写作
          </span>
        </div>
      </footer>
    </div>
  );
}
