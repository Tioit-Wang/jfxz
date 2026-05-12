import PreviewShell from "./PreviewShell";

export default async function PreviewPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  return <PreviewShell bookId={bookId} />;
}
