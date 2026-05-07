import WorkspaceEntryClient from "./WorkspaceEntryClient";

export default async function WorkspacePage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  return <WorkspaceEntryClient bookId={bookId} />;
}
