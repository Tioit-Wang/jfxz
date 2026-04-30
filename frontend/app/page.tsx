"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  PenLine,
  ArrowRight,
  Users,
  MessageSquare,
  Sparkles,
  Zap,
  FileText,
  Shuffle,
  Globe,
  Layers,
  Star,
  Heart,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ApiClient, type BillingProducts } from "@/api";

const fallbackPlans: BillingProducts["plans"] = [
  { id: "plan-1", name: "创作月卡", priceAmount: 29, vipDailyPoints: 10000, bundledCreditPackPoints: 2000, points: 0 },
  { id: "plan-2", name: "专业月卡", priceAmount: 69, vipDailyPoints: 30000, bundledCreditPackPoints: 8000, points: 0 },
  { id: "plan-3", name: "至尊月卡", priceAmount: 129, vipDailyPoints: 50000, bundledCreditPackPoints: 15000, points: 0 },
];

const fallbackCreditPacks: BillingProducts["creditPacks"] = [
  { id: "pack-1", name: "灵感补给包", priceAmount: 19, vipDailyPoints: 0, bundledCreditPackPoints: 0, points: 10000 },
  { id: "pack-2", name: "创意扩充包", priceAmount: 49, vipDailyPoints: 0, bundledCreditPackPoints: 0, points: 30000 },
  { id: "pack-3", name: "创作畅享包", priceAmount: 129, vipDailyPoints: 0, bundledCreditPackPoints: 0, points: 100000 },
];

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<BillingProducts | null>(null);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    new ApiClient()
      .listBillingProducts()
      .then(setProducts)
      .catch(() => setProducts(null))
      .finally(() => setProductsLoading(false));
  }, []);

  return (
    <div className="lp">
      {/* ============ Navigation ============ */}
      <header className="lp-nav">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-base font-semibold tracking-tight">
            妙蛙写作
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
            <Button asChild className="lp-btn-primary">
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
        <div className="lp-hero-atmos" aria-hidden="true">
          <div className="lp-grad-bubble-1" />
          <div className="lp-grad-bubble-2" />
          <div className="lp-grad-bubble-3" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-20 lg:pb-32 lg:pt-32">
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-24">

            {/* Hero Text */}
            <div className={`lp-fade-up ${mounted ? "lp-visible" : ""}`}>
              <span className="lp-tag mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                AI 驱动 · 长篇写作工作台
              </span>
              <h1
                className="mb-6 text-6xl font-semibold leading-[1.05] tracking-tight md:text-7xl lg:text-[80px]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                让每个故事
                <br />
                <em className="not-italic" style={{ color: "var(--lp-accent)" }}>掷地有声</em>
              </h1>
              <p className="mb-10 max-w-lg text-lg leading-relaxed" style={{ color: "var(--lp-ink-light)" }}>
                面向长篇创作者的 AI 智能写作平台。上下文感知、角色记忆、章节管理——让 AI 真正理解你的故事世界，成为你的创作搭档。
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" asChild className="lp-btn-primary">
                  <Link href="/books">
                    <PenLine className="mr-2 h-4 w-4" />
                    免费开始创作
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="lp-btn-secondary">
                  <a href="#features">探索功能</a>
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

      <hr className="lp-section-divider" />

      {/* ============ Platform / Capability Showcase ============ */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className={`lp-fade-up mb-12 text-center ${mounted ? "lp-visible" : ""}`}>
            <span className="lp-tag mb-4">全场景创作覆盖</span>
            <h2
              className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              一个平台，<span style={{ color: "var(--lp-accent)" }}>完整创作流</span>
            </h2>
          </div>
          <div className="lp-platform-grid">
            {[
              { icon: <BookOpen className="h-5 w-5" />, label: "长篇作品", color: "#505EE2" },
              { icon: <FileText className="h-5 w-5" />, label: "章节管理", color: "#8B10D6" },
              { icon: <Users className="h-5 w-5" />, label: "角色设定", color: "#EF7953" },
              { icon: <MessageSquare className="h-5 w-5" />, label: "AI 对话", color: "#505EE2" },
              { icon: <Sparkles className="h-5 w-5" />, label: "智能续写", color: "#8B10D6" },
              { icon: <Shuffle className="h-5 w-5" />, label: "情节推演", color: "#EF7953" },
              { icon: <Globe className="h-5 w-5" />, label: "世界观构建", color: "#505EE2" },
              { icon: <BarChart3 className="h-5 w-5" />, label: "创作分析", color: "#8B10D6" },
            ].map((item, i) => (
              <div
                key={item.label}
                className={`lp-platform-item lp-fade-up ${mounted ? `lp-visible lp-fade-up-d${i + 1}` : ""}`}
              >
                <div className="lp-platform-icon" style={{ background: `${item.color}12`, color: item.color }}>
                  {item.icon}
                </div>
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Features ============ */}
      <section id="features" className="py-24" style={{ background: "var(--lp-bg-alt)" }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className={`mb-14 ${mounted ? "" : ""}`}>
            <span className="lp-tag mb-4">
              <Zap className="h-3.5 w-3.5" />
              核心能力
            </span>
            <h2
              className="mt-4 mb-4 text-4xl font-semibold tracking-tight md:text-5xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              不只是写作工具
              <br />
              <span style={{ color: "var(--lp-accent)" }}>是你的创作操作系统</span>
            </h2>
            <p className="max-w-lg text-base" style={{ color: "var(--lp-ink-light)" }}>
              从灵感捕捉到章节完稿，从角色设定到世界观构建——一站式解决长篇创作的核心需求。
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
                  <h3 className="mb-2 text-lg font-semibold">智能作品管理</h3>
                  <p className="max-w-lg text-[15px] leading-relaxed" style={{ color: "var(--lp-ink-light)" }}>
                    集中维护梗概、题材标签、世界观规则和创作上下文。所有信息一目了然，告别在多个文档间反复跳转的低效。
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className={`lp-card lp-fade-up ${mounted ? "lp-visible lp-fade-up-d2" : ""}`}>
              <div className="lp-card-icon mb-4">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">角色档案系统</h3>
              <p className="text-[15px] leading-relaxed" style={{ color: "var(--lp-ink-light)" }}>
                角色与非人物设定分区管理，避免上下文混杂。每个角色拥有独立的背景、性格和关系网络档案。
              </p>
            </div>

            {/* Feature 3 */}
            <div className={`lp-card lp-fade-up ${mounted ? "lp-visible lp-fade-up-d2" : ""}`}>
              <div className="lp-card-icon mb-4">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">上下文感知对话</h3>
              <p className="text-[15px] leading-relaxed" style={{ color: "var(--lp-ink-light)" }}>
                AI 记住你的故事脉络、角色关系和世界观设定。每次对话都在正确的上下文中，给出的建议精准可用。
              </p>
            </div>

            {/* Feature 4 — Wide */}
            <div className={`lp-card lp-fade-up md:col-span-2 ${mounted ? "lp-visible lp-fade-up-d3" : ""}`}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
                <div className="lp-card-icon shrink-0">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-semibold">多维创作分析</h3>
                  <p className="max-w-lg text-[15px] leading-relaxed" style={{ color: "var(--lp-ink-light)" }}>
                    从叙事节奏、人物弧光到情节逻辑，AI 全方位审视你的创作并给出可落地的修改建议，而非泛泛而谈。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ How It Works ============ */}
      <section id="workflow" className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className={`mb-14 ${mounted ? "" : ""}`}>
            <span className="lp-tag mb-4">
              <Layers className="h-3.5 w-3.5" />
              写作流程
            </span>
            <h2
              className="mt-4 mb-4 text-4xl font-semibold tracking-tight md:text-5xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              从想法到完稿
              <br />
              <span style={{ color: "var(--lp-accent)" }}>每一步都为你设计</span>
            </h2>
          </div>

          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { num: "01", title: "创建作品", desc: "设定名称、题材和世界观规则，建立创作的坚实根基。" },
              { num: "02", title: "塑造角色", desc: "建立角色档案，定义性格、背景和人物关系网。" },
              { num: "03", title: "AI 辅助写作", desc: "在章节编辑器中与 AI 持续对话，获取上下文精准的创作建议。" },
              { num: "04", title: "智能分析", desc: "AI 从叙事、逻辑、一致性维度审视章节，给出具体改进方案。" },
            ].map((step, i) => (
              <div
                key={step.num}
                className={`lp-step lp-fade-up ${mounted ? `lp-visible lp-fade-up-d${i + 1}` : ""}`}
              >
                <span className="lp-step-num">{step.num}</span>
                <h3 className="mb-2 mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--lp-ink-light)" }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="lp-section-divider" />

      {/* ============ Pricing ============ */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-14 text-center">
            <span className="lp-tag mb-4">灵活选择</span>
            <h2
              className="mt-4 mb-4 text-4xl font-semibold tracking-tight md:text-5xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              按你的节奏<span style={{ color: "var(--lp-accent)" }}>创作付费</span>
            </h2>
            <p className="mx-auto max-w-sm text-base" style={{ color: "var(--lp-ink-light)" }}>
              按月订阅，或按需加油——选择最适合你创作节奏的方案。
            </p>
          </div>

          {/* Plans — 订阅月卡 */}
          <div className={`mb-8 text-center ${productsLoading ? "animate-pulse" : ""}`}>
            <p className="mb-8 text-sm font-semibold tracking-widest uppercase" style={{ color: "var(--lp-muted)" }}>
              订阅月卡 · 每日领积分
            </p>
          </div>

          {productsLoading ? (
            <div className="grid gap-6 md:grid-cols-3 mb-16">
              {[1, 2, 3].map((i) => (
                <div key={i} className="lp-card min-h-[320px] animate-pulse">
                  <div className="h-6 w-20 rounded bg-gray-200 mb-4" />
                  <div className="h-10 w-16 rounded bg-gray-200 mb-6" />
                  <div className="h-px bg-gray-100 mb-6" />
                  <div className="space-y-3">
                    <div className="h-4 w-full rounded bg-gray-100" />
                    <div className="h-4 w-3/4 rounded bg-gray-100" />
                    <div className="h-4 w-2/3 rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-3 mb-16">
              {(products?.plans ?? fallbackPlans).map((plan, i) => (
                <div
                  key={plan.id}
                  className={`lp-card lp-fade-up relative ${mounted ? `lp-visible lp-fade-up-d${i + 1}` : ""} ${
                    i === 1 ? "lp-price-accent" : ""
                  }`}
                >
                  {i === 1 && (
                    <span
                      className="absolute -top-3 right-6 rounded-full px-3 py-1 text-xs font-semibold text-white"
                      style={{ background: "linear-gradient(135deg, var(--lp-accent), var(--lp-accent-3))" }}
                    >
                      推荐
                    </span>
                  )}
                  <h3 className="mb-1 text-lg font-semibold">{plan.name}</h3>
                  <div className="mb-5 flex items-baseline gap-1">
                    <span className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
                      ¥{plan.priceAmount}
                    </span>
                    <span className="text-sm" style={{ color: "var(--lp-ink-light)" }}>
                      /月
                    </span>
                  </div>
                  <div className="mb-6 h-px" style={{ background: "var(--lp-border-light)" }} />
                  <ul className="mb-8 flex flex-col gap-3 text-sm" style={{ color: "var(--lp-ink-light)" }}>
                    <li className="flex items-center gap-2">
                      <span className="font-semibold" style={{ color: "var(--lp-accent)" }}>
                        {plan.vipDailyPoints.toLocaleString()}
                      </span>
                      积分/每日到账
                    </li>
                    <li className="flex items-center gap-2">
                      赠 <span className="font-semibold" style={{ color: "var(--lp-ink)" }}>
                        {plan.bundledCreditPackPoints.toLocaleString()}
                      </span>
                      加油积分（首次）
                    </li>
                    <li>全部 AI 功能开放</li>
                  </ul>
                  <Button asChild className={`w-full ${i === 1 ? "lp-btn-primary" : "lp-btn-secondary"}`}>
                    <Link href="/books">{i === 1 ? "立即订阅" : "选择方案"}</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Credit Packs — 加油包 */}
          <div className={`mb-8 text-center ${productsLoading ? "animate-pulse" : ""}`}>
            <p className="mb-8 text-sm font-semibold tracking-widest uppercase" style={{ color: "var(--lp-muted)" }}>
              积分加油包 · 按需补充
            </p>
          </div>

          {productsLoading ? (
            <div className="grid gap-6 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="lp-card min-h-[240px] animate-pulse">
                  <div className="h-6 w-20 rounded bg-gray-200 mb-4" />
                  <div className="h-10 w-16 rounded bg-gray-200 mb-6" />
                  <div className="h-px bg-gray-100 mb-6" />
                  <div className="space-y-3">
                    <div className="h-4 w-full rounded bg-gray-100" />
                    <div className="h-4 w-3/4 rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {(products?.creditPacks ?? fallbackCreditPacks).map((pack, i) => (
                <div
                  key={pack.id}
                  className={`lp-card lp-fade-up ${mounted ? `lp-visible lp-fade-up-d${i + 1}` : ""}`}
                >
                  <h3 className="mb-1 text-lg font-semibold">{pack.name}</h3>
                  <p className="mb-5 text-sm" style={{ color: "var(--lp-ink-light)" }}>
                    一次性充值，永久有效
                  </p>
                  <div className="mb-6 h-px" style={{ background: "var(--lp-border-light)" }} />
                  <div className="mb-2 flex items-baseline gap-1">
                    <span className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
                      ¥{pack.priceAmount}
                    </span>
                  </div>
                  <p className="mb-6 text-sm" style={{ color: "var(--lp-ink-light)" }}>
                    到账{" "}
                    <span className="font-semibold" style={{ color: "var(--lp-accent)" }}>
                      {pack.points.toLocaleString()}
                    </span>{" "}
                    积分
                  </p>
                  <Button asChild className="lp-btn-secondary w-full">
                    <Link href="/books">购买</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <hr className="lp-section-divider" />

      {/* ============ Social Proof ============ */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          {/* Stats */}
          <div className={`lp-fade-up mb-16 text-center ${mounted ? "lp-visible" : ""}`}>
            <span className="lp-tag mb-4">
              <Heart className="h-3.5 w-3.5" />
              创作者信赖
            </span>
            <h2
              className="mt-4 mb-4 text-4xl font-semibold tracking-tight md:text-5xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              与 <span style={{ color: "var(--lp-accent)" }}>数万创作者</span> 同行
            </h2>
            <div className="lp-stats-bar mt-12">
              {[
                { value: "12,800+", label: "活跃创作者" },
                { value: "36,000+", label: "作品已创建" },
                { value: "2.8 亿+", label: "累计创作字数" },
              ].map((s) => (
                <div key={s.label} className="lp-stat-item">
                  <div className="lp-stat-value">{s.value}</div>
                  <div className="lp-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonials */}
          <div className={`lp-fade-up lp-fade-up-d1 ${mounted ? "lp-visible" : ""}`}>
            <p className="mb-8 text-center text-sm font-semibold tracking-widest uppercase" style={{ color: "var(--lp-muted)" }}>
              创作者说
            </p>
            <div className="lp-testimonial-scroll">
              {[
                {
                  book: "《长安浮世录》",
                  text: "以前写长篇最怕上下文混乱，角色性格前后不一。妙蛙的角色档案系统和上下文感知对话彻底解决了这个痛点，AI 真的能记住我几百章前的设定。",
                  name: "沈墨白",
                  role: "网文作者 · 连载 3 年",
                  avatar: "沈",
                  color: "linear-gradient(135deg, #505EE2, #8B10D6)",
                },
                {
                  book: "《星海迷途》",
                  text: "世界观设定太庞大了，自己管理力不从心。妙蛙的世界观构建模块让我把几百条规则整理得井井有条，AI 对话时还能自动引用，非常省心。",
                  name: "林知远",
                  role: "科幻作者 · 完结 2 部",
                  avatar: "林",
                  color: "linear-gradient(135deg, #EF7953, #F76E85)",
                },
                {
                  book: "《旧梦如尘》",
                  text: "最惊喜的是创作分析功能，AI 会指出我章节中的叙事节奏问题和情节漏洞，甚至给出具体的修改方案。这不是泛泛而谈，是真的有用。",
                  name: "苏晚晴",
                  role: "现实主义作者",
                  avatar: "苏",
                  color: "linear-gradient(135deg, #8B10D6, #505EE2)",
                },
                {
                  book: "《剑道无疆》",
                  text: "作为新人作者，最怕写崩。妙蛙帮我理清角色关系、把控情节节奏，半年写了 80 万字，读者反馈说人物刻画比之前细腻太多了。",
                  name: "江辰宇",
                  role: "新人作者 · 首部连载中",
                  avatar: "江",
                  color: "linear-gradient(135deg, #505EE2, #EF7953)",
                },
                {
                  book: "《第七重梦境》",
                  text: "悬疑小说对逻辑要求极高。每次写完一章我都会先跑一遍 AI 分析，它能揪出我忽略的逻辑矛盾和伏笔遗漏，省去了大量改稿时间。",
                  name: "顾临渊",
                  role: "悬疑作者 · 出版签约",
                  avatar: "顾",
                  color: "linear-gradient(135deg, #F76E85, #8B10D6)",
                },
              ].map((t, i) => (
                <div key={t.name} className="lp-testimonial-card">
                  <div className="lp-testimonial-stars">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="h-3.5 w-3.5 fill-current" />
                    ))}
                  </div>
                  <p className="lp-testimonial-text">"{t.text}"</p>
                  <span className="lp-testimonial-book">{t.book}</span>
                  <div className="lp-testimonial-author">
                    <div className="lp-testimonial-avatar" style={{ background: t.color }}>
                      {t.avatar}
                    </div>
                    <div>
                      <div className="lp-testimonial-name">{t.name}</div>
                      <div className="lp-testimonial-role">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ Final CTA ============ */}
      <section className="relative overflow-hidden py-24 text-center" style={{ background: "var(--lp-bg-alt)" }}>
        <div className="lp-hero-atmos" aria-hidden="true">
          <div className="lp-grad-bubble-1" />
        </div>
        <div className="relative mx-auto max-w-2xl px-6">
          <h2
            className="mb-4 text-5xl font-semibold tracking-tight md:text-6xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            准备好<span style={{ color: "var(--lp-accent)" }}>开始创作</span>了吗？
          </h2>
          <p className="mb-10 text-lg" style={{ color: "var(--lp-ink-light)" }}>
            从第一个字到最后一章，妙蛙写作陪你完成每一个值得被讲述的故事。
          </p>
          <div className="flex justify-center gap-3">
            <Button size="lg" asChild className="lp-btn-primary">
              <Link href="/books">
                <PenLine className="mr-2 h-4 w-4" />
                免费开始
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="lp-btn-secondary">
              <a href="#features">了解更多</a>
            </Button>
          </div>
        </div>
      </section>

      {/* ============ Footer ============ */}
      <footer className="py-8" style={{ borderTop: "1px solid var(--lp-border-light)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <span className="text-sm font-semibold">
            妙蛙写作
          </span>
          <span className="text-xs" style={{ color: "var(--lp-muted)" }}>
            &copy; 2026 妙蛙写作
          </span>
        </div>
      </footer>
    </div>
  );
}
