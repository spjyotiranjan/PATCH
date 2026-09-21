"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Plus,
  Search,
  Clock3,
  ChevronRight,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui";
import {
  createChatSession,
  getChatSessions,
} from "@/lib/api/chat";

type ChatSessionGroup =
  | "Today"
  | "Yesterday"
  | "Earlier this week";

type ChatSessionView = {
  id: string;
  title: string;
  preview: string;
  time: string;
  group: ChatSessionGroup;
};

function groupFor(
  updatedAt: string,
  now: Date,
): ChatSessionGroup {
  const updated = new Date(updatedAt);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(
    startOfToday,
  );
  startOfYesterday.setDate(
    startOfYesterday.getDate() - 1,
  );

  if (updated >= startOfToday) {
    return "Today";
  }
  if (updated >= startOfYesterday) {
    return "Yesterday";
  }
  return "Earlier this week";
}

function timeFor(
  updatedAt: string,
  group: ChatSessionGroup,
): string {
  const updated = new Date(updatedAt);

  if (group === "Today") {
    return updated.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  if (group === "Yesterday") {
    return "Yesterday";
  }
  return updated.toLocaleDateString([], {
    weekday: "short",
  });
}

export default function ChatPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sessions, setSessions] = useState<
    ChatSessionView[]
  >([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] = useState<
    string | null
  >(null);
  const [reloadToken, setReloadToken] =
    useState(0);
  const [creating, setCreating] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const result =
          await getChatSessions();
        const now = new Date();

        if (!cancelled) {
          setSessions(
            result.map((session) => {
              const group = groupFor(
                session.updatedAt,
                now,
              );

              return {
                id: session.id,
                title: session.title,
                preview:
                  session.lastMessage ||
                  "No messages yet.",
                time: timeFor(
                  session.updatedAt,
                  group,
                ),
                group,
              };
            }),
          );
        }
      } catch {
        if (!cancelled) {
          setError(
            "Conversations could not be loaded. Check your connection and retry.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const filteredSessions = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) {
      return sessions;
    }

    return sessions.filter(
      (session) =>
        session.title.toLowerCase().includes(query) ||
        session.preview.toLowerCase().includes(query),
    );
  }, [search, sessions]);

  const groupedSessions = {
    Today: filteredSessions.filter((session) => session.group === "Today"),
    Yesterday: filteredSessions.filter(
      (session) => session.group === "Yesterday",
    ),
    "Earlier this week": filteredSessions.filter(
      (session) => session.group === "Earlier this week",
    ),
  };

  function createChat() {
    if (creating) {
      return;
    }

    setCreating(true);

    void createChatSession("New conversation")
      .then((session) => {
        router.push(`/chat/${session.id}`);
      })
      .catch(() => {
        setError(
          "A new chat could not be started. Retry to try again.",
        );
      })
      .finally(() => {
        setCreating(false);
      });
  }

  return (
    <AppShell title="Chat">
      <div className="chat-workspace">
        <section className="chat-home-main">
          <div className="chat-page-header">
            <div>
              <div className="chat-eyebrow">Maintenance Assistant</div>

              <h1>How can I help?</h1>

              <p>
                Ask a maintenance question and P.A.T.C.H. will search approved
                current sources for the equipment or project context.
              </p>
            </div>

            <button
              type="button"
              className="chat-primary-button"
              onClick={createChat}
              disabled={creating}
            >
              <Plus size={17} />
              {creating
                ? "Starting…"
                : "New chat"}
            </button>
          </div>

          {error && sessions.length > 0 ? (
            <p
              className="form-message form-message-error"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="chat-search-row">
            <div className="chat-search">
              <Search size={18} />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search conversations..."
                aria-label="Search conversations"
              />
            </div>
          </div>

          <div className="chat-session-list">
            {loading ? (
              <div
                className="chat-empty-state"
                aria-live="polite"
              >
                <h2>Loading conversations…</h2>

                <p>
                  Retrieving your maintenance
                  chat history.
                </p>
              </div>
            ) : error && sessions.length === 0 ? (
              <div
                className="chat-empty-state"
                role="alert"
              >
                <h2>
                  Conversations could not be
                  loaded
                </h2>

                <p>{error}</p>

                <button
                  type="button"
                  className="chat-secondary-button"
                  onClick={() =>
                    setReloadToken(
                      (token) => token + 1,
                    )
                  }
                >
                  Retry
                </button>
              </div>
            ) : (
              Object.entries(groupedSessions).map(
                ([group, groupSessions]) => {
                  if (
                    groupSessions.length === 0
                  ) {
                    return null;
                  }

                  return (
                    <section
                      key={group}
                      className="chat-session-group"
                    >
                      <div className="chat-session-group-title">
                        <Clock3 size={14} />
                        {group}
                      </div>

                      <div className="chat-session-items">
                        {groupSessions.map(
                          (session) => (
                            <button
                              key={session.id}
                              type="button"
                              className="chat-session-item"
                              onClick={() =>
                                router.push(
                                  `/chat/${session.id}`,
                                )
                              }
                            >
                              <span className="chat-session-icon">
                                <MessageSquare
                                  size={17}
                                />
                              </span>

                              <span className="chat-session-content">
                                <strong>
                                  {session.title}
                                </strong>

                                <span>
                                  {session.preview}
                                </span>
                              </span>

                              <span className="chat-session-time">
                                {session.time}
                              </span>

                              <ChevronRight
                                size={17}
                                className="chat-session-chevron"
                              />
                            </button>
                          ),
                        )}
                      </div>
                    </section>
                  );
                },
              )
            )}
          </div>

          {!loading &&
            !error &&
            filteredSessions.length === 0 && (
            <div className="chat-empty-state">
              <MessageSquare size={28} />

              <h2>No conversations found</h2>

              <p>
                Try a different search or start a new maintenance
                conversation.
              </p>

              <button
                type="button"
                className="chat-secondary-button"
                onClick={createChat}
              >
                <Plus size={16} />
                Start new chat
              </button>
            </div>
          )}
        </section>

        <aside className="chat-home-info">
          <div className="chat-info-card">
            <div className="chat-info-icon">
              <MessageSquare size={20} />
            </div>

            <h2>Source-backed answers</h2>

            <p>
              Answers are grounded in approved documents relevant to the
              selected equipment or project.
            </p>
          </div>

          <div className="chat-info-card">
            <h3>Use @ to narrow the search</h3>

            <p>
              Assign a document, Equipment, Project, or supported entity
              before asking your question.
            </p>

            <div className="chat-example-chip">@ Boiler B-201</div>
            <div className="chat-example-chip">@ Boiler Manual</div>
            <div className="chat-example-chip">@ Boiler Upgrade Project</div>
          </div>

          <div className="chat-info-card chat-info-warning">
            <h3>Evidence matters</h3>

            <p>
              P.A.T.C.H. shows the exact sources used for an answer. If the
              available sources are insufficient, conflicting, outdated, or
              unavailable, the answer will say so.
            </p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}