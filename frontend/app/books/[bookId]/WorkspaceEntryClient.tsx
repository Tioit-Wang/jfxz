"use client";

import dynamic from "next/dynamic";

const WorkspaceClient = dynamic(() => import("./WorkspaceClient"), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-background" />
});

export default function WorkspaceEntryClient({ bookId }: { bookId: string }) {
  return <WorkspaceClient bookId={bookId} />;
}
