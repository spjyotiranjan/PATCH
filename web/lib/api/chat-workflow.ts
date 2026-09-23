import { api, items, post, id, ApiRequestError } from "./http";
import type { AI, Session, Source, Turn } from "./contracts";
import { getEquipmentRecords, getProjectRecords } from "./resources";
import { getLibrary, getSource } from "./document-workflow";
import { listProcedures, versionPath } from "./workflows";

export const listSessions = () => items<Session>("/api/chat/sessions");
export const getSession = (sessionId: string) =>
  api<Session>(`/api/chat/sessions/${id(sessionId)}`);
export const listTurns = (sessionId: string) =>
  items<Turn>(`/api/chat/sessions/${id(sessionId)}/turns`);
export async function newSession() {
  const result = await post<Session>("/api/chat/sessions");
  window.dispatchEvent(new Event("patch:chat-updated"));
  return result;
}
export type Reference = AI["AssignedReference"] & { label: string };
export async function listReferences(): Promise<Reference[]> {
  const [scope, equipments, projects, documents] = await Promise.all([
    api<AI["RetrievalScopeManifest"]>("/api/chat/references"),
    getEquipmentRecords(),
    getProjectRecords(),
    getLibrary(),
  ]);
  return [
    ...(scope.entities ?? []).map((entity) => ({
      type: entity.type,
      id: entity.id,
      label:
        (entity.type === "PROJECT" ? projects : equipments).find(
          (item) => item.id === entity.id,
        )?.name ?? entity.id,
    })),
    ...Array.from(
      new Map(
        (scope.allowedDocumentVersions ?? []).map((version) => [
          version.documentId,
          {
            type: "DOCUMENT" as const,
            id: version.documentId,
            label:
              documents.find((doc) => doc.id === version.documentId)?.title ??
              version.documentId,
          },
        ]),
      ).values(),
    ),
  ];
}
export type TurnInput = {
  clientTurnId: string;
  question: string;
  assignedReferences: AI["AssignedReference"][];
};
/** The gateway emits validated whole results, never unverified token streams. */
export function sendTurn(
  sessionId: string,
  input: TurnInput,
  onProgress: (stage: string) => void,
  signal?: AbortSignal,
): Promise<Turn> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const url = new URL(
      `/ws/chat?sessionId=${encodeURIComponent(sessionId)}`,
      window.location.origin,
    );
    url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(url);
    let settled = false,
      sent = false;
    const finish = (turn?: Turn, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      socket.close();
      if (error) reject(error);
      else {
        window.dispatchEvent(new Event("patch:chat-updated"));
        resolve(turn!);
      }
    };
    const abort = () =>
      finish(undefined, new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(
      () => finish(undefined, new ApiRequestError("TURN_INTERRUPTED")),
      160000,
    );
    signal?.addEventListener("abort", abort, { once: true });
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data));
        if (
          data.type === "connection.ready" &&
          !sent &&
          data.sessionId === sessionId
        ) {
          sent = true;
          socket.send(JSON.stringify({ type: "turn.submit", ...input }));
          return;
        }
        if (data.type === "turn.error" && !data.clientTurnId) {
          finish(undefined, new ApiRequestError(data.code ?? "TURN_FAILED"));
          return;
        }
        if (data.clientTurnId !== input.clientTurnId) return;
        if (data.type === "turn.accepted" || data.type === "turn.processing")
          onProgress(data.type);
        if (data.type === "turn.completed") {
          if (
            data.turn?.clientTurnId !== input.clientTurnId ||
            data.turn?.sessionId !== sessionId ||
            data.turn?.state !== "COMPLETED"
          )
            throw new Error("Invalid turn");
          finish(data.turn);
        }
        if (data.type === "turn.error")
          finish(
            undefined,
            new ApiRequestError(data.code ?? "TURN_FAILED", 0, data.requestId),
          );
      } catch {
        finish(undefined, new ApiRequestError("INVALID_SOCKET_RESPONSE"));
      }
    };
    socket.onerror = () =>
      finish(undefined, new ApiRequestError("SOCKET_UNAVAILABLE"));
    socket.onclose = () =>
      finish(undefined, new ApiRequestError("TURN_INTERRUPTED"));
  });
}
export async function citationSource(
  citation: AI["Citation"],
): Promise<Source> {
  if (!citation.documentId)
    throw new ApiRequestError("SOURCE_UNAVAILABLE", 404);
  try {
    return await getSource(citation.documentVersionId);
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 404)
      throw error;
  }
  // Controlled procedures are a separate record family, not logical documents.
  for (const project of await getProjectRecords()) {
    const procedures = await listProcedures(project.id);
    if (
      procedures.items.some((procedure) => procedure.id === citation.documentId)
    )
      return api<Source>(
        `${versionPath({ projectId: project.id, procedureId: citation.documentId, id: citation.documentVersionId })}/source`,
      );
  }
  throw new ApiRequestError("SOURCE_UNAVAILABLE", 404);
}
