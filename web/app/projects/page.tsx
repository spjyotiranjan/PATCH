"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  SlidersHorizontal,
  Users,
  Box,
  LockKeyhole,
  ChevronRight,
  X,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button, StatusBadge } from "@/components/ui";
import {
  getProjects,
  requestProjectAccess,
  getOwnerInbox,
  decideProjectAccess,
} from "@/lib/api/projects";
import type {
  AccessRequest,
  MembershipStatus,
  Project,
  ProjectStatus,
} from "@/lib/types/project";

const STATUS_LABELS: Record<
  ProjectStatus,
  string
> = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
  ON_HOLD: "On hold",
};

const MEMBERSHIP_LABELS: Record<
  MembershipStatus,
  string
> = {
  MEMBER: "Member",
  NOT_A_MEMBER: "Not a member",
  PENDING: "Pending",
  RESTRICTED: "Restricted",
};

function membershipTone(
  membership: MembershipStatus,
): "success" | "neutral" | "info" | "danger" {
  if (membership === "MEMBER") {
    return "success";
  }
  if (membership === "PENDING") {
    return "info";
  }
  if (membership === "RESTRICTED") {
    return "danger";
  }
  return "neutral";
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<
    Project[]
  >([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] = useState<
    string | null
  >(null);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState<ProjectStatus | "ALL">("ALL");

  const [membershipFilter, setMembershipFilter] =
    useState<MembershipStatus | "ALL">(
      "ALL",
    );

  const [selectedProjectId, setSelectedProjectId] =
    useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] =
    useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] =
    useState<string | null>(null);
  const [submitting, setSubmitting] =
    useState(false);

  const [showFilters, setShowFilters] =
    useState(false);
  const [reloadToken, setReloadToken] =
    useState(0);

  const [inboxOpen, setInboxOpen] =
    useState(false);
  const [inbox, setInbox] = useState<
    (AccessRequest & {
      projectName: string;
    })[]
  >([]);
  const [inboxLoading, setInboxLoading] =
    useState(true);
  const [inboxError, setInboxError] =
    useState<string | null>(null);
  const [decidingId, setDecidingId] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const result = await getProjects();

        if (!cancelled) {
          setProjects(result);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Projects could not be loaded. Check your connection and retry.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    async function loadInbox() {
      try {
        setInboxLoading(true);
        setInboxError(null);
        const result =
          await getOwnerInbox();

        if (!cancelled) {
          setInbox(result);
        }
      } catch {
        if (!cancelled) {
          setInboxError(
            "Access requests could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) {
          setInboxLoading(false);
        }
      }
    }

    void load();
    void loadInbox();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesSearch =
        !query ||
        project.name
          .toLowerCase()
          .includes(query) ||
        project.code
          .toLowerCase()
          .includes(query) ||
        project.owner
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        project.status === statusFilter;

      const matchesMembership =
        membershipFilter === "ALL" ||
        project.membership ===
          membershipFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesMembership
      );
    });
  }, [
    projects,
    search,
    statusFilter,
    membershipFilter,
  ]);

  const selectedProject =
    projects.find(
      (project) =>
        project.id === selectedProjectId,
    ) ?? null;

  const showJoinPanel =
    selectedProject !== null &&
    (selectedProject.membership ===
      "NOT_A_MEMBER" ||
      selectedProject.membership ===
        "PENDING" ||
      selectedProject.membership ===
        "RESTRICTED");

  const handleSelectProject = (
    projectId: string,
  ) => {
    setSelectedProjectId(projectId);
    setFormError(null);
    setMessage("");
  };

  const handleClosePanel = () => {
    setSelectedProjectId(null);
    setFormError(null);
    setMessage("");
  };

  const handleDecide = async (
    requestId: string,
    decision: "APPROVE" | "REJECT",
  ) => {
    if (decidingId) {
      return;
    }

    try {
      setDecidingId(requestId);
      await decideProjectAccess(
        requestId,
        decision,
      );

      setInbox((current) =>
        current.filter(
          (request) =>
            request.id !== requestId,
        ),
      );

      toast.success(
        decision === "APPROVE"
          ? "Access approved. The member was added to the project."
          : "Access request rejected.",
      );
    } catch {
      toast.error(
        "The decision could not be saved. Retry to try again.",
      );
    } finally {
      setDecidingId(null);
    }
  };

  const handleAskToJoin = async () => {
    if (!selectedProject || submitting) {
      return;
    }

    if (!name.trim()) {
      setFormError(
        "Enter your name so the owner knows who is requesting access.",
      );
      return;
    }

    if (
      !email.trim() ||
      !email.includes("@")
    ) {
      setFormError(
        "Enter a valid email address for the access request.",
      );
      return;
    }

    if (!organization.trim()) {
      setFormError(
        "Enter your organization for the access request.",
      );
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      await requestProjectAccess({
        projectId: selectedProject.id,
        name: name.trim(),
        email: email.trim(),
        organization: organization.trim(),
        message: message.trim(),
      });

      setProjects((current) =>
        current.map((project) =>
          project.id ===
          selectedProject.id
            ? {
                ...project,
                membership: "PENDING",
              }
            : project,
        ),
      );

      toast.success(
        "Access request sent. The project owner will review it.",
      );
      handleClosePanel();
    } catch {
      setFormError(
        "The request could not be sent. Check your connection and retry.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell title="Projects">
      <div className="projects-page">
        {/* Toolbar */}
        <div className="projects-toolbar">
          <div className="projects-search">
            <Search
              size={17}
              className="projects-search-icon"
              aria-hidden="true"
            />

            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              aria-label="Search projects"
            />
          </div>

          <select
            className="projects-filter-select"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as
                  | ProjectStatus
                  | "ALL",
              )
            }
            aria-label="Filter projects by status"
          >
            <option value="ALL">
              All status
            </option>

            {(
              Object.keys(
                STATUS_LABELS,
              ) as ProjectStatus[]
            ).map((status) => (
              <option
                key={status}
                value={status}
              >
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>

          <select
            className="projects-filter-select"
            value={membershipFilter}
            onChange={(event) =>
              setMembershipFilter(
                event.target.value as
                  | MembershipStatus
                  | "ALL",
              )
            }
            aria-label="Filter projects by membership"
          >
            <option value="ALL">
              All membership
            </option>

            {(
              Object.keys(
                MEMBERSHIP_LABELS,
              ) as MembershipStatus[]
            ).map((membership) => (
              <option
                key={membership}
                value={membership}
              >
                {
                  MEMBERSHIP_LABELS[
                    membership
                  ]
                }
              </option>
            ))}
          </select>

          <Button
            variant="secondary"
            type="button"
            onClick={() =>
              setShowFilters((value) => !value)
            }
            icon={
              <SlidersHorizontal size={16} />
            }
          >
            Filters
          </Button>
        </div>

        {/* Optional filters row */}
        {showFilters && (
          <div className="projects-filter-panel">
            <div>
              <span className="projects-filter-label">
                Showing
              </span>

              <strong>
                {filteredProjects.length}{" "}
                projects
              </strong>
            </div>

            <button
              type="button"
              className="projects-clear-filter"
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setMembershipFilter("ALL");
              }}
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Owner inbox */}
        <section
          className="projects-list-card owner-inbox"
          aria-label="Owner inbox"
        >
          <button
            type="button"
            className="owner-inbox-toggle"
            onClick={() =>
              setInboxOpen((value) => !value)
            }
            aria-expanded={inboxOpen}
          >
            <span>
              Owner inbox
              {inbox.length > 0 && (
                <strong className="owner-inbox-count">
                  {inbox.length} pending
                </strong>
              )}
            </span>
            <ChevronRight
              size={18}
              className={
                inboxOpen
                  ? "owner-inbox-chevron-open"
                  : "owner-inbox-chevron"
              }
              aria-hidden="true"
            />
          </button>

          {inboxOpen && (
            <div className="owner-inbox-body">
              {inboxLoading ? (
                <p role="status">
                  Loading access requests…
                </p>
              ) : inboxError ? (
                <div>
                  <p role="alert">
                    {inboxError}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setReloadToken(
                        (token) => token + 1,
                      )
                    }
                  >
                    Retry
                  </Button>
                </div>
              ) : inbox.length === 0 ? (
                <p>
                  No pending access requests.
                  New requests to projects you
                  own will appear here.
                </p>
              ) : (
                inbox.map((request) => (
                  <article
                    key={request.id}
                    className="owner-inbox-item"
                  >
                    <div>
                      <strong>
                        {request.name}
                      </strong>
                      <span>
                        {request.email} ·{" "}
                        {request.organization}
                      </span>
                      <p>
                        {request.projectName}
                        {request.message
                          ? ` — ${request.message}`
                          : ""}
                      </p>
                    </div>
                    <div className="owner-inbox-actions">
                      <Button
                        type="button"
                        disabled={
                          decidingId ===
                          request.id
                        }
                        onClick={() =>
                          void handleDecide(
                            request.id,
                            "APPROVE",
                          )
                        }
                      >
                        {decidingId ===
                        request.id
                          ? "Saving…"
                          : "Approve"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={
                          decidingId ===
                          request.id
                        }
                        onClick={() =>
                          void handleDecide(
                            request.id,
                            "REJECT",
                          )
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
        </section>

        {/* Main content */}
        <div className="projects-content">
          {/* Project list */}
          <section className="projects-list-card">
            {loading ? (
              <div
                className="projects-empty"
                aria-live="polite"
              >
                <h3>Loading projects…</h3>

                <p>
                  Retrieving the projects you
                  can discover.
                </p>
              </div>
            ) : error ? (
              <div className="projects-empty">
                <h3>
                  Projects could not be loaded
                </h3>

                <p>{error}</p>

                <Button
                  type="button"
                  onClick={() =>
                    setReloadToken(
                      (token) => token + 1,
                    )
                  }
                >
                  Retry
                </Button>
              </div>
            ) : filteredProjects.length ===
              0 ? (
              <div className="projects-empty">
                <Search size={28} />

                <h3>
                  No projects found
                </h3>

                <p>
                  Try changing your search or
                  filters.
                </p>
              </div>
            ) : (
              filteredProjects.map((project) => {
                const selected =
                  selectedProjectId ===
                  project.id;

                return (
                  <article
                    key={project.id}
                    className={`project-list-item ${
                      selected
                        ? "project-list-item-selected"
                        : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="project-list-select"
                      onClick={() =>
                        handleSelectProject(
                          project.id,
                        )
                      }
                      aria-expanded={
                        selected
                      }
                    >
                      <div className="project-list-main">
                        <div className="project-list-title">
                          {project.name}
                        </div>

                        <div className="project-list-description">
                          {project.description}
                        </div>
                      </div>

                      <div className="project-list-meta">
                        <div className="project-meta-column">
                          <span className="project-meta-label">
                            Owner
                          </span>

                          <span className="project-meta-value">
                            <Users size={16} />
                            {project.owner}
                          </span>
                        </div>

                        <div className="project-meta-column">
                          <span className="project-meta-label">
                            Equipment
                          </span>

                          <span className="project-meta-value">
                            <Box size={16} />
                            {
                              project.equipmentCount
                            }
                          </span>
                        </div>

                        <div className="project-meta-column">
                          <span className="project-meta-label">
                            Membership
                          </span>

                          <StatusBadge
                            tone={membershipTone(
                              project.membership,
                            )}
                          >
                            {
                              MEMBERSHIP_LABELS[
                                project.membership
                              ]
                            }
                          </StatusBadge>
                        </div>
                      </div>

                      <ChevronRight
                        size={18}
                        className="project-list-arrow"
                      />
                    </button>

                    <div className="project-list-open">
                      {project.membership ===
                      "MEMBER" ? (
                        <Link
                          href={`/projects/${project.id}`}
                          aria-label={`Open ${project.name} workspace`}
                        >
                          Open workspace
                        </Link>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}

            {/* Pagination */}
            <div className="projects-pagination">
              <span>
                1–{filteredProjects.length} of{" "}
                {filteredProjects.length}{" "}
                projects
              </span>

              <div className="projects-pagination-controls">
                <button
                  type="button"
                  disabled
                  aria-label="Previous page"
                >
                  ‹
                </button>

                <button
                  type="button"
                  className="active"
                  aria-current="page"
                >
                  1
                </button>

                <button
                  type="button"
                  disabled
                  aria-label="Next page"
                >
                  ›
                </button>

                <select
                  aria-label="Items per page"
                  defaultValue="10"
                >
                  <option value="10">
                    10 / page
                  </option>

                  <option value="25">
                    25 / page
                  </option>

                  <option value="50">
                    50 / page
                  </option>
                </select>
              </div>
            </div>
          </section>

          {/* Join panel */}
          {showJoinPanel && selectedProject && (
            <aside className="project-join-panel">
              {/* Header */}
              <div className="project-join-header">
                <h2>
                  {selectedProject.membership ===
                  "PENDING"
                    ? "Request sent"
                    : "Ask to join project"}
                </h2>

                <button
                  type="button"
                  onClick={handleClosePanel}
                  aria-label="Close join panel"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Icon */}
              <div className="project-join-icon">
                {selectedProject.membership ===
                "PENDING" ? (
                  <Send size={25} />
                ) : (
                  <LockKeyhole size={25} />
                )}
              </div>

              {/* Project name */}
              <h3>{selectedProject.name}</h3>

              {/* Request state */}
              {selectedProject.membership ===
              "PENDING" ? (
                <>
                  <p>
                    Your request to join this
                    project has been submitted.
                  </p>

                  <p className="project-join-description">
                    The project owner will
                    review your request and
                    decide whether to approve
                    your access.
                  </p>
                </>
              ) : selectedProject.membership ===
                "RESTRICTED" ? (
                <>
                  <p>
                    This project is restricted.
                  </p>

                  <p className="project-join-description">
                    You can still send a
                    request, and the project
                    owner will decide whether
                    to grant access.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    You&apos;re not a member of
                    this project.
                  </p>

                  <p className="project-join-description">
                    Send a request to join. The
                    project owner will review
                    your request and decide
                    whether to approve your
                    access.
                  </p>
                </>
              )}

              {/* Request form */}
              {selectedProject.membership !==
                "PENDING" && (
                <>
                  <div className="project-access-card">
                    <strong>
                      Your access request will
                      include:
                    </strong>

                    <div>
                      <Users size={17} />

                      <span>
                        Your name and email
                      </span>
                    </div>

                    <div>
                      <Box size={17} />

                      <span>
                        Your organization
                      </span>
                    </div>

                    <div>
                      <Users size={17} />

                      <span>
                        A request to join this
                        project
                      </span>
                    </div>
                  </div>

                  <label
                    htmlFor="join-name"
                    className="project-message-label"
                  >
                    Your name
                  </label>

                  <input
                    id="join-name"
                    type="text"
                    value={name}
                    onChange={(event) =>
                      setName(
                        event.target.value,
                      )
                    }
                    placeholder="e.g. Alex Morgan"
                    autoComplete="name"
                    className="project-join-input"
                  />

                  <label
                    htmlFor="join-email"
                    className="project-message-label"
                  >
                    Your email
                  </label>

                  <input
                    id="join-email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(
                        event.target.value,
                      )
                    }
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="project-join-input"
                  />

                  <label
                    htmlFor="join-organization"
                    className="project-message-label"
                  >
                    Your organization
                  </label>

                  <input
                    id="join-organization"
                    type="text"
                    value={organization}
                    onChange={(event) =>
                      setOrganization(
                        event.target.value,
                      )
                    }
                    placeholder="e.g. Maintenance Team"
                    autoComplete="organization"
                    className="project-join-input"
                  />

                  <label
                    htmlFor="join-message"
                    className="project-message-label"
                  >
                    Add a message{" "}
                    <span>(optional)</span>
                  </label>

                  <textarea
                    id="join-message"
                    value={message}
                    onChange={(event) =>
                      setMessage(
                        event.target.value,
                      )
                    }
                    maxLength={500}
                    placeholder="Tell the owner why you'd like to join this project..."
                  />

                  <div className="project-message-count">
                    {message.length} / 500
                  </div>
                </>
              )}

              {formError && (
                <p
                  className="form-message form-message-error"
                  role="alert"
                >
                  {formError}
                </p>
              )}

              {/* Action */}
              {selectedProject.membership !==
                "PENDING" && (
                <Button
                  type="button"
                  className="project-join-button"
                  onClick={() =>
                    void handleAskToJoin()
                  }
                  disabled={submitting}
                  icon={
                    <Send size={16} />
                  }
                >
                  {submitting
                    ? "Sending…"
                    : "Ask to join"}
                </Button>
              )}
            </aside>
          )}
        </div>
      </div>
    </AppShell>
  );
}
