"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  FolderKanban,
  History,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  ThumbsDown,
  ThumbsUp,
  User,
  Wrench,
  X,
  AlertTriangle,
  CircleAlert,
  Clock3,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import {
  ASSIGNMENT_OPTIONS,
  CONVERSATION_EVIDENCE,
  DEFAULT_ASSIGNMENTS,
  DEFAULT_TITLE,
  INITIAL_MESSAGES,
  mockRetrieveAnswer,
  type ConversationAssignment,
  type ConversationAssignmentType,
  type ConversationEvidence,
  type ConversationMessage,
  type ConversationMessageState,
} from "@/lib/mockapi/chat-conversation";

type AssignmentType = ConversationAssignmentType;

type Assignment = ConversationAssignment;

type Evidence = ConversationEvidence;

type Message = ConversationMessage;

function getAssignmentIcon(type: AssignmentType) {
  if (type === "document") {
    return <FileText size={14} />;
  }

  if (type === "equipment") {
    return <Wrench size={14} />;
  }

  if (type === "project") {
    return <FolderKanban size={14} />;
  }

  return <Search size={14} />;
}

function getAssignmentLabel(type: AssignmentType) {
  if (type === "document") return "Document";
  if (type === "equipment") return "Equipment";
  if (type === "project") return "Project";
  return "Entity";
}

function readStoredConversation(conversationId: string | undefined): {
  messages: Message[];
  assignments: Assignment[];
  title: string;
} | null {
  if (!conversationId || typeof window === "undefined") {
    return null;
  }

  const saved = window.localStorage.getItem(
    `patch-chat-${conversationId}`,
  );

  if (!saved) {
    return null;
  }

  try {
    const parsed = JSON.parse(saved) as {
      messages?: Message[];
      assignments?: Assignment[];
      title?: string;
    };

    return {
      messages: parsed.messages ?? INITIAL_MESSAGES,
      assignments: parsed.assignments ?? DEFAULT_ASSIGNMENTS,
      title: parsed.title ?? DEFAULT_TITLE,
    };
  } catch {
    // Keep the default conversation when local storage is invalid.
    return null;
  }
}

export default function ChatConversationPage() {
  const params = useParams<{ conversationId: string }>();
  const router = useRouter();

  const conversationId = params?.conversationId;

  const [messages, setMessages] = useState<Message[]>(
    () =>
      readStoredConversation(conversationId)?.messages ??
      INITIAL_MESSAGES,
  );
  const [input, setInput] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>(
    () =>
      readStoredConversation(conversationId)?.assignments ??
      DEFAULT_ASSIGNMENTS,
  );

  const [showAssignmentMenu, setShowAssignmentMenu] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [selectedEvidence, setSelectedEvidence] =
    useState<Evidence | null>(null);
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const [title, setTitle] = useState(
    () =>
      readStoredConversation(conversationId)?.title ??
      DEFAULT_TITLE,
  );

  const activeEvidence = useMemo(() => {
    return CONVERSATION_EVIDENCE.filter((evidence) =>
      messages.some((message) =>
        message.citations?.includes(evidence.id),
      ),
    );
  }, [messages]);

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    window.localStorage.setItem(
      `patch-chat-${conversationId}`,
      JSON.stringify({
        messages,
        assignments,
        title,
      }),
    );
  }, [conversationId, messages, assignments, title]);

  function removeAssignment(id: string) {
    setAssignments((current) =>
      current.filter((assignment) => assignment.id !== id),
    );
  }

  function addAssignment(assignment: Assignment) {
    setAssignments((current) => {
      if (current.some((item) => item.id === assignment.id)) {
        return current;
      }

      return [...current, assignment];
    });

    setShowAssignmentMenu(false);
  }

  function sendMessage() {
    const trimmed = input.trim();

    if (!trimmed || isRetrieving) {
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
      time: new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsRetrieving(true);

    if (messages.length <= 2) {
      setTitle(
        trimmed.length > 42
          ? `${trimmed.slice(0, 42)}…`
          : trimmed,
      );
    }

    window.setTimeout(() => {
      const answer = mockRetrieveAnswer(
        trimmed,
        assignments,
      );

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: answer.text,
        citations: answer.citations,
        searchedIn: answer.searchedIn,
        state:
          answer.state === "normal"
            ? undefined
            : answer.state,
        time: new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
      };

      setMessages((current) => [...current, assistantMessage]);
      setIsRetrieving(false);
    }, 900);
  }

  function handleComposerKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function openEvidence(id: string) {
    const evidence = CONVERSATION_EVIDENCE.find((item) => item.id === id);

    if (!evidence) {
      return;
    }

    setSelectedEvidence(evidence);
    setShowEvidence(true);
  }

  function startNewChat() {
    router.push("/chat/new");
  }

  return (
    <AppShell title="Chat">
      <div className="chat-session-page">
        <header className="chat-session-header">
          <div className="chat-session-header-left">
            <button
              type="button"
              className="chat-icon-button"
              onClick={() => router.push("/chat")}
              aria-label="Back to conversations"
            >
              <ArrowLeft size={18} />
            </button>

            <div>
              <div className="chat-session-title-row">
                <h1>{title}</h1>

                <span className="chat-session-status">
                  <span />
                  Source-backed
                </span>
              </div>

              <p>
                P.A.T.C.H. Maintenance Assistant
              </p>
            </div>
          </div>

          <div className="chat-session-header-actions">
            <button
              type="button"
              className="chat-header-action"
              onClick={startNewChat}
            >
              <Plus size={17} />
              New chat
            </button>

            <button
              type="button"
              className="chat-icon-button"
              onClick={() => setShowMore((current) => !current)}
              aria-label="More actions"
            >
              <MoreHorizontal size={18} />
            </button>
          </div>

          {showMore && (
            <div className="chat-more-menu">
              <button type="button">
                <Copy size={15} />
                Copy conversation
              </button>

              <button type="button">
                <History size={15} />
                View history
              </button>
            </div>
          )}
        </header>

        <div className="chat-session-layout">
          <main className="chat-conversation">
            <div className="chat-conversation-scroll">
              <div className="chat-context-strip">
                <div className="chat-context-label">
                  <span>Search scope</span>
                  <strong>
                    {assignments.length} assignments
                  </strong>
                </div>

                <div className="chat-assignment-list">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="chat-assignment-chip"
                    >
                      {getAssignmentIcon(assignment.type)}

                      <span>
                        {assignment.name}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          removeAssignment(assignment.id)
                        }
                        aria-label={`Remove ${assignment.name}`}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}

                  <div className="chat-assignment-wrapper">
                    <button
                      type="button"
                      className="chat-add-assignment"
                      onClick={() =>
                        setShowAssignmentMenu(
                          (current) => !current,
                        )
                      }
                    >
                      <Plus size={14} />
                      Add assignment
                    </button>

                    {showAssignmentMenu && (
                      <div className="chat-assignment-menu">
                        <div className="chat-assignment-menu-title">
                          Search scope
                        </div>

                        {ASSIGNMENT_OPTIONS.map((option) => {
                          const selected = assignments.some(
                            (assignment) =>
                              assignment.id === option.id,
                          );

                          return (
                            <button
                              key={option.id}
                              type="button"
                              disabled={selected}
                              onClick={() =>
                                addAssignment(option)
                              }
                            >
                              {getAssignmentIcon(option.type)}

                              <span>
                                <strong>{option.name}</strong>
                                <small>
                                  {getAssignmentLabel(
                                    option.type,
                                  )}
                                </small>
                              </span>

                              {selected && (
                                <CheckCircle2 size={15} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="chat-messages">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`chat-message ${
                      message.role === "user"
                        ? "chat-message-user"
                        : "chat-message-assistant"
                    }`}
                  >
                    <div className="chat-message-avatar">
                      {message.role === "user" ? (
                        <User size={17} />
                      ) : (
                        <Bot size={17} />
                      )}
                    </div>

                    <div className="chat-message-body">
                      <div className="chat-message-meta">
                        <strong>
                          {message.role === "user"
                            ? "You"
                            : "P.A.T.C.H."}
                        </strong>

                        <span>{message.time}</span>
                      </div>

                      <div className="chat-message-text">
                        {message.text
                          .split("\n")
                          .map((paragraph, index) => (
                            <p key={index}>
                              {paragraph}
                            </p>
                          ))}
                      </div>

                      {message.state &&
                        message.state !== "normal" && (
                          <EvidenceState state={message.state} />
                        )}

                      {message.searchedIn &&
                        message.searchedIn.length > 0 && (
                          <div className="chat-searched-in">
                            <span>Searched in</span>

                            {message.searchedIn.map(
                              (scope) => (
                                <span
                                  key={scope}
                                  className="chat-scope-chip"
                                >
                                  {scope}
                                </span>
                              ),
                            )}
                          </div>
                        )}

                      {message.citations &&
                        message.citations.length > 0 && (
                          <div className="chat-citations">
                            <div className="chat-citations-label">
                              Evidence Used
                            </div>

                            <div className="chat-citation-list">
                              {message.citations.map(
                                (citationId, index) => {
                                  const evidence =
                                    CONVERSATION_EVIDENCE.find(
                                      (item) =>
                                        item.id ===
                                        citationId,
                                    );

                                  if (!evidence) {
                                    return null;
                                  }

                                  return (
                                    <button
                                      type="button"
                                      key={citationId}
                                      className="chat-citation-chip"
                                      onClick={() =>
                                        openEvidence(
                                          citationId,
                                        )
                                      }
                                    >
                                      <FileText size={13} />

                                      <span>
                                        [{index + 1}]{" "}
                                        {evidence.title}
                                      </span>

                                      <ChevronRight
                                        size={13}
                                      />
                                    </button>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        )}

                      {message.role === "assistant" && (
                        <div className="chat-message-actions">
                          <button
                            type="button"
                            aria-label="Helpful"
                          >
                            <ThumbsUp size={14} />
                          </button>

                          <button
                            type="button"
                            aria-label="Not helpful"
                          >
                            <ThumbsDown size={14} />
                          </button>

                          <button
                            type="button"
                            aria-label="Copy answer"
                            onClick={() =>
                              navigator.clipboard?.writeText(
                                message.text,
                              )
                            }
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}

                {isRetrieving && (
                  <article className="chat-message chat-message-assistant">
                    <div className="chat-message-avatar">
                      <Bot size={17} />
                    </div>

                    <div className="chat-message-body">
                      <div className="chat-message-meta">
                        <strong>P.A.T.C.H.</strong>
                      </div>

                      <div className="chat-retrieval-state">
                        <RefreshCw
                          size={16}
                          className="chat-spinner"
                        />

                        <div>
                          <strong>
                            Finding relevant Equipments and
                            current sources
                          </strong>

                          <span>
                            Searching approved source versions
                            within your selected scope.
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                )}
              </div>
            </div>

            <div className="chat-composer-area">
              <div className="chat-composer">
                <div className="chat-composer-top">
                  <textarea
                    value={input}
                    onChange={(event) =>
                      setInput(event.target.value)
                    }
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Ask a maintenance question..."
                    rows={3}
                    aria-label="Maintenance question"
                  />
                </div>

                <div className="chat-composer-bottom">
                  <div className="chat-composer-hint">
                    <button
                      type="button"
                      className="chat-composer-icon"
                      aria-label="Attach"
                    >
                      <Paperclip size={16} />
                    </button>

                    <span>
                      Use <strong>@</strong> to assign a
                      source or context
                    </span>
                  </div>

                  <button
                    type="button"
                    className="chat-send-button"
                    disabled={!input.trim() || isRetrieving}
                    onClick={sendMessage}
                  >
                    <Send size={16} />
                    Send
                  </button>
                </div>
              </div>

              <p className="chat-disclaimer">
                P.A.T.C.H. provides source-backed information
                for technician review. It does not control
                equipment or replace approved maintenance and
                safety decisions.
              </p>
            </div>
          </main>

          <aside
            className={`chat-evidence-panel ${
              showEvidence ? "chat-evidence-panel-open" : ""
            }`}
          >
            <div className="chat-evidence-header">
              <div>
                <span className="chat-eyebrow">
                  Current sources
                </span>

                <h2>Evidence Used</h2>

                <p>
                  {activeEvidence.length} source
                  {activeEvidence.length === 1 ? "" : "s"} used
                  in this conversation.
                </p>
              </div>

              <button
                type="button"
                className="chat-icon-button"
                onClick={() => setShowEvidence(false)}
                aria-label="Close evidence"
              >
                <X size={17} />
              </button>
            </div>

            <div className="chat-evidence-list">
              {activeEvidence.map((evidence) => (
                <EvidenceCard
                  key={evidence.id}
                  evidence={evidence}
                  selected={selectedEvidence?.id === evidence.id}
                  onOpen={() => openEvidence(evidence.id)}
                />
              ))}
            </div>

            <div className="chat-evidence-footer">
              <CheckCircle2 size={15} />

              <span>
                Evidence is limited to accessible current
                source versions.
              </span>
            </div>
          </aside>
        </div>

        {selectedEvidence && showEvidence && (
          <div className="chat-source-drawer">
            <div className="chat-source-drawer-header">
              <div>
                <span className="chat-eyebrow">
                  Source reference
                </span>

                <h2>{selectedEvidence.title}</h2>
              </div>

              <button
                type="button"
                className="chat-icon-button"
                onClick={() => setSelectedEvidence(null)}
                aria-label="Close source"
              >
                <X size={17} />
              </button>
            </div>

            <div className="chat-source-detail">
              <div className="chat-source-meta-grid">
                <div>
                  <span>Revision</span>
                  <strong>
                    {selectedEvidence.revision}
                  </strong>
                </div>

                <div>
                  <span>Location</span>
                  <strong>
                    {selectedEvidence.page}
                  </strong>
                </div>

                <div>
                  <span>Section</span>
                  <strong>
                    {selectedEvidence.section}
                  </strong>
                </div>

                <div>
                  <span>Approval</span>
                  <strong>
                    {selectedEvidence.approval}
                  </strong>
                </div>
              </div>

              <div className="chat-source-status">
                <CheckCircle2 size={16} />
                {selectedEvidence.status}
              </div>

              <div className="chat-source-excerpt">
                <div className="chat-source-excerpt-label">
                  Relevant excerpt
                </div>

                <p>{selectedEvidence.excerpt}</p>
              </div>

              <div className="chat-source-path">
                <span>Inclusion path</span>
                <strong>
                  {selectedEvidence.inclusionPath}
                </strong>
              </div>

              <Link
                className="chat-open-source-button"
                href="/documents"
              >
                <ExternalLink size={16} />
                Open source
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function EvidenceCard({
  evidence,
  selected,
  onOpen,
}: {
  evidence: Evidence;
  selected: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={`chat-evidence-card ${
        selected ? "chat-evidence-card-selected" : ""
      }`}
      onClick={onOpen}
    >
      <div className="chat-evidence-card-top">
        <div className="chat-evidence-document-icon">
          <FileText size={17} />
        </div>

        <div className="chat-evidence-card-heading">
          <strong>{evidence.title}</strong>

          <span>{evidence.revision}</span>
        </div>

        <ChevronRight size={16} />
      </div>

      <div className="chat-evidence-location">
        {evidence.page} · {evidence.section}
      </div>

      <div className="chat-evidence-tags">
        <span className="chat-evidence-current">
          <CheckCircle2 size={12} />
          {evidence.status}
        </span>

        <span>{evidence.approval}</span>
      </div>

      <p>{evidence.excerpt}</p>

      <div className="chat-evidence-path">
        {evidence.inclusionPath}
      </div>
    </button>
  );
}

function EvidenceState({
  state,
}: {
  state:
    | "insufficient"
    | "conflicting"
    | "outdated"
    | "unavailable";
}) {
  const config = {
    insufficient: {
      icon: <CircleAlert size={16} />,
      title: "Insufficient evidence",
      text:
        "The available approved sources do not provide enough information to answer this safely.",
    },
    conflicting: {
      icon: <AlertTriangle size={16} />,
      title: "Conflicting sources",
      text:
        "Current sources contain different information. Review the cited documents before proceeding.",
    },
    outdated: {
      icon: <Clock3 size={16} />,
      title: "Source may be outdated",
      text:
        "The relevant information is not available in a current active source version.",
    },
    unavailable: {
      icon: <CircleAlert size={16} />,
      title: "Source unavailable",
      text:
        "A referenced source could not be accessed, so the answer is not presented as verified.",
    },
  }[state];

  return (
    <div className={`chat-evidence-state chat-state-${state}`}>
      <div className="chat-evidence-state-icon">
        {config.icon}
      </div>

      <div>
        <strong>{config.title}</strong>
        <span>{config.text}</span>
      </div>
    </div>
  );
}