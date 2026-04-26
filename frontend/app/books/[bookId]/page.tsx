import WorkspaceClient from "./WorkspaceClient";

export default async function WorkspacePage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  return <WorkspaceClient bookId={bookId} />;
}
