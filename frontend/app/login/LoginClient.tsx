"use client";

import { BookOpenText, CheckCircle2, PenLine, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiClient } from "@/api";
import { sanitizeUserNextPath } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAuthForm } from "@/components/UserAuthForm";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const client = useMemo(() => new ApiClient(), []);
  const nextPath = sanitizeUserNextPath(searchParams.get("next"));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_420px] lg:px-6">
        <section className="flex flex-col justify-between gap-10 rounded-lg border bg-muted/30 p-6 lg:p-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="text-lg font-semibold">
              金番写作
            </Link>
            <Badge variant="outline">长篇写作工作台</Badge>
          </div>

          <div className="flex max-w-2xl flex-col gap-6">
            <div className="grid size-12 place-items-center rounded-lg bg-primary text-primary-foreground">
              <PenLine />
            </div>
            <div className="flex flex-col gap-4">
              <h1 className="text-4xl font-semibold tracking-normal md:text-5xl">登录后继续创作</h1>
              <p className="text-base leading-7 text-muted-foreground">
                进入作品库，继续维护章节、角色、设定与 AI 对话上下文，让长篇项目保持连贯。
              </p>
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-3">
              {[
                [BookOpenText, "作品资料集中管理"],
                [Sparkles, "AI 建议贴合作品上下文"],
                [ShieldCheck, "账号数据云端保存"],
              ].map(([Icon, text]) => (
                <div className="flex items-center gap-2 rounded-md border bg-background p-3" key={text as string}>
                  <Icon />
                  <span>{text as string}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 />
              <span>章节、人物和设定随作品同步</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 />
              <span>登录成功后自动回到刚才访问的页面</span>
            </div>
          </div>
        </section>

        <section className="flex items-center">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-2xl">使用邮箱继续</CardTitle>
              <CardDescription>登录已有账号，或注册一个新的写作账号。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <UserAuthForm client={client} onAuthenticated={() => router.replace(nextPath)} />
              <p className="text-center text-xs leading-5 text-muted-foreground">
                登录或注册即表示同意
                <Link className="mx-1 underline-offset-4 hover:underline" href="/terms">
                  用户协议
                </Link>
                和
                <Link className="ml-1 underline-offset-4 hover:underline" href="/privacy">
                  隐私政策
                </Link>
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
