import type { Metadata } from "next";
import PublicPreviewShell from "./PublicPreviewShell";

export const metadata: Metadata = {
  title: "妙蛙写作",
  description: "阅读精彩作品",
};

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  return <PublicPreviewShell shareToken={shareToken} />;
}
