"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button, Drawer, Field } from "@/components/ui";
import {
  LoadState,
  RecordState,
  useAction,
  useResource,
  useSourceAccess,
} from "@/components/backend-state";
import { VisualImage } from "@/components/document-workspace";
import * as chat from "@/lib/api/chat-workflow";
import { message } from "@/lib/api/http";
import type { AI, Turn } from "@/lib/api/contracts";

export function ChatDirectory({
  createOnly = false,
}: {
  createOnly?: boolean;
}) {
  const resource = useResource(chat.listSessions);
  const action = useAction();
  const router = useRouter();
  return (
    <AppShell title={createOnly ? "New chat" : "Chat"}>
      <div className="integration-toolbar">
        <Button
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              const session = await chat.newSession();
              router.push(`/chat/${session.id}`);
            })
          }
        >
          Start new chat
        </Button>
      </div>
      <p>
        Ask about current sources you can access. Use assignments to focus
        retrieval on a document, Equipment or Project.
      </p>
      {action.error && <p role="alert">{action.error}</p>}
      <LoadState {...resource} retry={resource.refresh} />
      <section className="panel integration-panel">
        <h2>Your conversations</h2>
        {resource.data?.map((session) => (
          <div className="list-row" key={session.id}>
            <Link href={`/chat/${session.id}`}>{session.title}</Link>
            <time>{new Date(session.updatedAt).toLocaleString()}</time>
          </div>
        ))}
        {resource.data?.length === 0 && <p>No conversations yet.</p>}
      </section>
    </AppShell>
  );
}

export function LiveChat({ sessionId }: { sessionId: string }) {
  const loader = useCallback(
    async () => ({
      session: await chat.getSession(sessionId),
      turns: await chat.listTurns(sessionId),
    }),
    [sessionId],
  );
  const resource = useResource(loader, 10000);
  const references = useResource(chat.listReferences);
  const [question, setQuestion] = useState("");
  const [assigned, setAssigned] = useState<chat.Reference[]>([]);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<chat.TurnInput | null>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<Turn | null>(null);
  const controller = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => () => controller.current?.abort(), [sessionId]);
  const persistedPending =
    resource.data?.turns.some((turn) => turn.state === "PENDING") ?? false;
  const pendingResult =
    pending &&
    resource.data?.turns.find(
      (turn) => turn.clientTurnId === pending.clientTurnId,
    );
  const lastResult = resource.data?.turns
    .filter((turn) => turn.result)
    .at(-1)?.result;
  const followUpBlocked = lastResult?.followUpAllowed === false;
  async function submit(event?: FormEvent, retry = false) {
    event?.preventDefault();
    if (
      lock.current ||
      (!retry &&
        (!question.trim() || pending || persistedPending || followUpBlocked))
    )
      return;
    const input =
      retry && pending
        ? pending
        : {
            clientTurnId: crypto.randomUUID(),
            question: question.trim(),
            assignedReferences: assigned.map(({ type, id }) => ({ type, id })),
          };
    lock.current = true;
    setSending(true);
    setError(null);
    setPending(input);
    setProgress("Connecting…");
    controller.current = new AbortController();
    try {
      await chat.sendTurn(
        sessionId,
        input,
        () => setProgress("Finding current sources and verifying evidence…"),
        controller.current.signal,
      );
      setPending(null);
      setQuestion("");
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === "AbortError"))
        setError(message(cause));
    } finally {
      lock.current = false;
      setSending(false);
      await resource.refresh();
    }
  }
  return (
    <AppShell title={resource.data?.session.title ?? "Conversation"}>
      <LoadState {...resource} retry={resource.refresh} />
      {resource.data && (
        <div className="live-chat-layout">
          <section
            className="live-transcript"
            aria-label="Conversation"
            aria-live="polite"
          >
            {!resource.data.turns.length && (
              <p>
                No messages yet. Ask a question about your approved sources.
              </p>
            )}
            {resource.data.turns.map((turn) => (
              <article className="integration-record" key={turn.id}>
                <div className="chat-user-message">
                  <strong>You</strong>
                  <p className="integration-prewrap">{turn.question}</p>
                  {turn.assignedReferences.map((ref) => (
                    <span
                      className="integration-chip"
                      key={`${ref.type}:${ref.id}`}
                    >
                      {references.data?.find(
                        (item) => item.id === ref.id && item.type === ref.type,
                      )?.label ?? ref.id}
                    </span>
                  ))}
                </div>
                {turn.result ? (
                  <Answer turn={turn} onEvidence={() => setEvidence(turn)} />
                ) : (
                  <p role="status">
                    Turn is processing. History will refresh automatically.
                  </p>
                )}
              </article>
            ))}
            {pending && !pendingResult && (
              <article className="integration-record">
                <strong>You</strong>
                <p>{pending.question}</p>
                <p role="status">
                  {sending
                    ? progress
                    : "Delivery interrupted. Check saved history before retrying this same turn."}
                </p>
              </article>
            )}
          </section>
          {error && (
            <div role="alert">
              <p>{error}</p>
              <Button
                variant="secondary"
                onClick={() => void resource.refresh()}
              >
                Check saved history
              </Button>
              {pending && !sending && pendingResult?.state !== "COMPLETED" && (
                <Button onClick={() => void submit(undefined, true)}>
                  Retry identical turn
                </Button>
              )}
            </div>
          )}
          {pendingResult?.state === "COMPLETED" && !sending && (
            <div role="status">
              <p>The previous turn is saved in history.</p>
              <Button
                onClick={() => {
                  setPending(null);
                  setQuestion("");
                  setError(null);
                }}
              >
                Continue conversation
              </Button>
            </div>
          )}
          <form
            className="panel integration-panel live-composer"
            onSubmit={submit}
          >
            <details>
              <summary>@ Assign sources</summary>
              <LoadState {...references} retry={references.refresh} />
              <Field label="Find a document, Equipment or Project">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </Field>
              <div className="reference-options">
                {references.data
                  ?.filter((ref) =>
                    ref.label.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((ref) => (
                    <label
                      className="integration-check"
                      key={`${ref.type}:${ref.id}`}
                    >
                      <input
                        type="checkbox"
                        disabled={sending}
                        checked={assigned.some(
                          (item) =>
                            item.id === ref.id && item.type === ref.type,
                        )}
                        onChange={(e) =>
                          setAssigned((current) =>
                            e.target.checked
                              ? [...current, ref].slice(0, 50)
                              : current.filter(
                                  (item) =>
                                    item.id !== ref.id ||
                                    item.type !== ref.type,
                                ),
                          )
                        }
                      />
                      {ref.type}: {ref.label}
                    </label>
                  ))}
              </div>
            </details>
            {assigned.map((ref) => (
              <span className="integration-chip" key={`${ref.type}:${ref.id}`}>
                {ref.label}
                <button
                  type="button"
                  aria-label={`Remove ${ref.label}`}
                  disabled={sending}
                  onClick={() =>
                    setAssigned((current) =>
                      current.filter((item) => item !== ref),
                    )
                  }
                >
                  ×
                </button>
              </span>
            ))}
            <Field label="Question">
              <textarea
                required
                maxLength={10000}
                value={question}
                disabled={
                  sending || !!pending || persistedPending || followUpBlocked
                }
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about current technical sources…"
              />
            </Field>
            <Button
              type="submit"
              disabled={
                sending ||
                !!pending ||
                persistedPending ||
                followUpBlocked ||
                !question.trim()
              }
            >
              {sending
                ? "Verifying…"
                : persistedPending
                  ? "Previous turn processing"
                  : "Send question"}
            </Button>
            <p>
              Only verified results are displayed. Source navigation remains
              available when AI is unavailable.
            </p>
            {followUpBlocked && (
              <p>
                This response does not allow follow-up.{" "}
                <Link href="/chat/new">Start a new conversation</Link>.
              </p>
            )}
          </form>
        </div>
      )}
      <Drawer
        open={!!evidence}
        title="Evidence used in this response"
        onClose={() => setEvidence(null)}
      >
        {evidence?.result && (
          <>
            <p>
              Approval and revision are recorded at answer time. Opening a
              source checks your current access.
            </p>
            {(evidence.result.citations ?? []).map((citation) => (
              <CitationCard citation={citation} key={citation.id} />
            ))}
            {["approved", "incomplete"].includes(evidence.result.status) &&
              evidence.result.visualEvidenceState === "AVAILABLE" &&
              evidence.result.visualCitations?.map((citation) => (
                <section key={citation.id}>
                  <p>
                    Exact visual · page {citation.page} ·{" "}
                    {citation.relevanceRole.toLowerCase()}
                  </p>
                  <VisualImage
                    assetId={citation.assetId}
                    label={`Page ${citation.page}, document version ${citation.documentVersionId}`}
                  />
                </section>
              ))}
            <h3>Searched in (not evidence)</h3>
            {(evidence.result.routing.selectedEntities ?? []).map((entity) => (
              <p key={entity.id}>
                {references.data?.find((item) => item.id === entity.id)
                  ?.label ?? entity.id}
              </p>
            ))}
          </>
        )}
      </Drawer>
    </AppShell>
  );
}
function Answer({ turn, onEvidence }: { turn: Turn; onEvidence: () => void }) {
  const result = turn.result!;
  const safeText =
    result.status === "approved" || result.status === "incomplete";
  const safeVisual = safeText && result.visualEvidenceState === "AVAILABLE";
  return (
    <div className="chat-assistant-message">
      <h2>P.A.T.C.H.</h2>
      <RecordState value={result.status.toUpperCase()} />
      <p>Visual evidence: {result.visualEvidenceState ?? "TEXT_ONLY"}</p>
      {safeText &&
        (result.answer.steps ?? []).map((step) => (
          <div key={step.id}>
            <p className="integration-prewrap">{step.text}</p>
            {step.citationIds.map((citationId) => (
              <Button variant="quiet" key={citationId} onClick={onEvidence}>
                Source {citationId}
              </Button>
            ))}
          </div>
        ))}
      {safeVisual &&
        result.visualObservations?.map((observation, index) => (
          <div key={index}>
            <p>{observation.text}</p>
            {observation.visualCitationIds.map((citationId) => {
              const citation = result.visualCitations?.find(
                (item) => item.id === citationId,
              );
              return citation ? (
                <VisualImage
                  key={citationId}
                  assetId={citation.assetId}
                  label={`Verified visual observation, page ${citation.page}`}
                />
              ) : null;
            })}
          </div>
        ))}
      {(result.warnings ?? []).map((warning, index) => (
        <p className="info-banner" key={index}>
          {warning}
        </p>
      ))}
      {!safeText && (
        <p>
          Verified guidance is not available for this turn. Consult current
          sources and the responsible reviewer.
        </p>
      )}
      <Button variant="secondary" onClick={onEvidence}>
        Evidence used
      </Button>
    </div>
  );
}
export function CitationCard({ citation }: { citation: AI["Citation"] }) {
  const action = useAction();
  const access = useSourceAccess();
  const url = access.url;
  return (
    <article className="integration-record">
      <h3>{citation.documentTitle}</h3>
      <p>
        Revision {citation.revision} · page {citation.page ?? "—"} ·{" "}
        {citation.section ?? ""} · {citation.approvalState}
      </p>
      <blockquote className="integration-prewrap">
        {citation.excerpt}
      </blockquote>
      <Button
        variant="secondary"
        disabled={action.busy}
        onClick={() =>
          void action.run(async () =>
            access.open(() => chat.citationSource(citation)),
          )
        }
      >
        Get current source access
      </Button>
      {url && (
        <a
          href={`${url}${citation.page ? `#page=${citation.page}` : ""}`}
          target="_blank"
          rel="noreferrer"
        >
          Open exact source
        </a>
      )}
      {action.error && <p role="alert">{action.error}</p>}
    </article>
  );
}
