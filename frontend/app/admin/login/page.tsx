"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClient } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLoginPage() {
  const router = useRouter();
  const client = useMemo(() => new ApiClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await client.loginAdmin(email.trim(), password);
      router.replace("/admin/users");
    } catch {
      setError("登录失败，请确认管理员账号、密码和账户状态。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-5">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-card-float">
        <div className="flex flex-col items-center gap-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="size-6" />
          </span>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">管理员登录</h1>
            <p className="text-sm text-muted-foreground">进入妙蛙写作管理后台</p>
          </div>
        </div>

        <form className="mt-8 flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-email" className="text-xs font-medium">邮箱</Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-password" className="text-xs font-medium">密码</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10"
            />
          </div>
          {error ? (
            <p className="rounded-md bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>
          ) : null}
          <Button className="h-10 w-full font-medium tracking-[-0.01em]" disabled={loading} type="submit">
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            登录
          </Button>
        </form>
      </div>
    </main>
  );
}
