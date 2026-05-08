import type { ChatReference } from "@/api";

export const WORKSPACE_MENTION_MIME = "application/x-goodgua-workspace-mention";

export type WorkspaceMentionReference = Pick<ChatReference, "id" | "name" | "summary"> & {
  type: "chapter" | "character";
};

type WorkspaceMentionDragPayload = {
  source: "workspace-sidebar";
  reference: WorkspaceMentionReference;
};

function isWorkspaceMentionReference(value: unknown): value is WorkspaceMentionReference {
  if (!value || typeof value !== "object") return false;
  const reference = value as Partial<WorkspaceMentionReference>;
  return (
    (reference.type === "chapter" || reference.type === "character") &&
    typeof reference.id === "string" &&
    typeof reference.name === "string" &&
    (reference.summary === undefined || typeof reference.summary === "string")
  );
}

export function serializeWorkspaceMentionDragPayload(reference: WorkspaceMentionReference): string {
  const payload: WorkspaceMentionDragPayload = {
    source: "workspace-sidebar",
    reference,
  };
  return JSON.stringify(payload);
}

export function parseWorkspaceMentionDragPayload(value: string): WorkspaceMentionReference | null {
  if (!value) return null;
  try {
    const payload = JSON.parse(value) as Partial<WorkspaceMentionDragPayload>;
    if (payload.source !== "workspace-sidebar" || !isWorkspaceMentionReference(payload.reference)) {
      return null;
    }
    return payload.reference;
  } catch {
    return null;
  }
}

export function writeWorkspaceMentionDragData(dataTransfer: DataTransfer, reference: WorkspaceMentionReference) {
  const payload = serializeWorkspaceMentionDragPayload(reference);
  dataTransfer.setData(WORKSPACE_MENTION_MIME, payload);
  dataTransfer.effectAllowed = "copy";
}

export function readWorkspaceMentionDragData(dataTransfer: DataTransfer | null | undefined): WorkspaceMentionReference | null {
  if (!dataTransfer) return null;
  return parseWorkspaceMentionDragPayload(dataTransfer.getData(WORKSPACE_MENTION_MIME));
}
