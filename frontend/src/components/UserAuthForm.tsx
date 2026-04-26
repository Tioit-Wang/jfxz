"use client";

import { Loader2, Mail } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { ApiClient } from "@/api";
import { isLikelyEmail } from "@/auth";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type UserAuthFormProps = {
  client: ApiClient;
  onAuthenticated: () => void;
};

export function UserAuthForm({ client, onAuthenticated }: UserAuthFormProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"ready" | "loading" | "error">("ready");
  const [error, setError] = useState("");

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!isLikelyEmail(email)) {
      setStatus("error");
      setError("请输入有效邮箱");
      return;
    }
    if (password.length < 8) {
      setStatus("error");
      setError("密码至少需要 8 位");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      if (mode === "register") {
        await client.registerWithEmail(email.trim(), email.split("@")[0], password);
      } else {
        await client.loginWithEmail(email.trim(), password);
      }
      setStatus("ready");
      onAuthenticated();
    } catch {
      setStatus("error");
      setError(mode === "register" ? "注册失败，请确认邮箱未被使用" : "登录失败，请确认邮箱、密码和账户状态");
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
      <Tabs value={mode} onValueChange={(value) => setMode(value as "login" | "register")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">登录</TabsTrigger>
          <TabsTrigger value="register">注册</TabsTrigger>
        </TabsList>
      </Tabs>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="auth-email">邮箱</FieldLabel>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="auth-email"
              className="pl-9"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="auth-password">密码</FieldLabel>
          <Input
            id="auth-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="至少 8 位"
          />
        </Field>
      </FieldGroup>
      {status === "error" && error ? <FieldError>{error}</FieldError> : null}
      <Button className="w-full" disabled={status === "loading"} type="submit">
        {status === "loading" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
        {mode === "register" ? "注册" : "登录"}
      </Button>
    </form>
  );
}
