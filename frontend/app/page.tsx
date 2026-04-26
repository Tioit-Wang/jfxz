"use client";

import { BookOpen, PenLine, Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 lg:px-6">
          <Link href="/" className="text-sm font-medium">
            金番写作
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Button variant="ghost" asChild>
              <a href="#features">产品介绍</a>
            </Button>
            <Button variant="ghost" asChild>
              <a href="#pricing">价格</a>
            </Button>
            <Button asChild>
              <Link href="/books">
                <PenLine data-icon="inline-start" />
                开始写作
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-6xl items-center gap-8 px-4 py-10 lg:grid-cols-[1fr_420px] lg:px-6">
        <div className="flex max-w-3xl flex-col gap-6">
          <Badge variant="outline" className="w-fit">
            长篇写作工作台
          </Badge>
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-semibold tracking-normal md:text-5xl">金番写作</h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              面向长篇内容创作的 AI 辅助写作工作台，集中维护作品上下文、章节进度、角色设定与持续对话。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" asChild>
              <Link href="/books">
                <PenLine data-icon="inline-start" />
                开始写作
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#pricing">
                <Sparkles data-icon="inline-start" />
                查看价格
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/admin/login">
                <BookOpen data-icon="inline-start" />
                管理端
              </Link>
            </Button>
          </div>
        </div>

        <Card className="hidden lg:flex">
          <CardHeader>
            <CardTitle>今日工作台</CardTitle>
            <CardDescription>作品、章节、资料和 AI 会话集中在一个界面。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {[
              ["作品总纲", "梗概、题材标签、世界规则"],
              ["章节编辑", "提要、正文、AI 分析"],
              ["资料库", "角色与设定分区管理"],
              ["持续对话", "引用上下文后生成建议"],
            ].map(([title, text]) => (
              <div className="rounded-md border bg-muted/30 p-3" key={title}>
                <div className="text-sm font-medium">{title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{text}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section id="features" className="mx-auto grid max-w-6xl gap-4 px-4 py-10 md:grid-cols-4 lg:px-6">
        {[
          ["作品管理", "集中维护短简介、梗概、题材标签和世界规则。"],
          ["角色设定", "角色与非人物设定分开管理，避免上下文混杂。"],
          ["AI 对话", "基于作品、章节、角色和设定持续对话。"],
          ["AI 分析", "分析当前章节并给出可采纳的修改建议。"],
        ].map(([title, text]) => (
          <Card key={title}>
            <CardHeader>
              <Sparkles />
              <CardTitle>{title}</CardTitle>
              <CardDescription>{text}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold">套餐价格</h2>
          <p className="text-sm text-muted-foreground">按写作节奏选择月卡或加油包。</p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>创作月卡</CardTitle>
              <CardDescription>月度积分 + 附带加油包积分，适合持续写作。</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>灵感加油包</CardTitle>
              <CardDescription>单独补充积分，适合集中冲刺章节。</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <footer className="border-t px-4 py-8 text-center text-xs text-muted-foreground">© 2026 金番写作</footer>
    </main>
  );
}
