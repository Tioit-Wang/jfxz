import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center text-sm text-muted-foreground">加载登录页...</main>}>
      <LoginClient />
    </Suspense>
  );
}
