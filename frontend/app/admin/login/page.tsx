"use client";

import { LockKeyhole, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClient } from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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
    <section className="grid min-h-screen place-items-center bg-background px-5">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-3 grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground">
            <LockKeyhole />
          </div>
          <CardTitle className="text-2xl">管理员登录</CardTitle>
          <CardDescription>进入妙蛙写作管理后台。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="admin-email">邮箱</FieldLabel>
                <Input id="admin-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-password">密码</FieldLabel>
                <Input id="admin-password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
              </Field>
            </FieldGroup>
            {error ? <FieldError>{error}</FieldError> : null}
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
              登录
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
