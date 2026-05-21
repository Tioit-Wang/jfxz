import type { Metadata } from "next";
import PublicPreviewShell from "./PublicPreviewShell";

export const metadata: Metadata = {
  title: "妙蛙写作",
  description: "阅读精彩作品",
};

export default async function PublicSharePage({
  params,
  searchParams,
}: {
  params: Promise<{ shareToken: string }>;
  searchParams: Promise<{ chapterId?: string }>;
}) {
  const { shareToken } = await params;
  const { chapterId } = await searchParams;
  return <PublicPreviewShell shareToken={shareToken} chapterId={chapterId} />;
}
