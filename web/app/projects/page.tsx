"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Filter, FolderKanban, Lock, Mail, Plus, Search, User, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui";
import { StatusBadge } from "@/components/ui";

/* ── hardcoded project rows ───────────────────────────────── */
type Membership = "owner" | "member" | "none";
type ProjStatus = "In progress" | "Active" | "Planning" | "On hold";

type Project = {
  id: string;
  name: string;
  description: string;
  owner: string;
  equipments: number;
  status: ProjStatus;
  membership: Membership;
};

const PROJECTS: Project[] = [
  {
    id: "proj-1",
    name: "Boiler Upgrade Project",
    description: "Upgrade boiler system for improved efficiency, reliability, and compliance.",
    owner: "Engineering Team",
    equipments: 8,
    status: "In progress",
    membership: "member",
  },
  {
    id: "proj-2",
    name: "Cooling Tower Optimization",
    description: "Improve cooling tower performance and reduce water consumption.",
    owner: "Facilities Team",
    equipments: 5,
    status: "Active",
    membership: "member",
  },
  {
    id: "proj-3",
    name: "Plant Expansion Project",
    description: "Expand production capacity with new line installation and infrastructure upgrades.",
    owner: "Capital Projects",
    equipments: 12,
    status: "Planning",
    membership: "none",
  },
  {
    id: "proj-4",
    name: "Compressor Reliability Improvement",
    description: "Enhance compressor reliability and reduce unplanned downtime.",
    owner: "Maintenance Team",
    equipments: 6,
    status: "Active",
    membership: "member",
  },
];

/* ── Join request panel data ─────────────────────────────── */
type JoinProject = Project & {};

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All status");
  const [memberFilter, setMemberFilter] = useState("All membership");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [joinMessage, setJoinMessage] = useState("");
  const [joinSent, setJoinSent] = useState<string[]>([]);

  const filtered = PROJECTS.filter((p) => {
    const q = search.toLowerCase();
    const memberMatch =
      memberFilter === "All membership" ||
      (memberFilter === "Member" && p.membership !== "none") ||
      (memberFilter === "Not a member" && p.membership === "none");
    const statusMatch = statusFilter === "All status" || p.status === statusFilter;
    const textMatch = q === "" || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    return memberMatch && statusMatch && textMatch;
  });

  function memberBadge(m: Membership) {
    if (m === "owner") return <span className="membership-badge membership-owner">Owner</span>;
    if (m === "member") return <span className="membership-badge membership-member">✓ Member</span>;
    return <span className="membership-badge membership-none">Not a member</span>;
  }

  function handleJoin() {
    if (selectedProject) {
      setJoinSent((s) => [...s, selectedProject.id]);
      setSelectedProject(null);
      setJoinMessage("");
    }
  }

  const hasJoinPanel = selectedProject !== null;

  return (
    <AppShell
      title="Projects"
      actions={
        <Link href="/projects/new">
          <Button icon={<Plus size={16} />}>Create project</Button>
        </Link>
      }
    >
      <div style={{ display: "grid", gap: 16, maxWidth: 1200 }}>
        {/* Filter bar */}
        <div className="filter-bar">
          <label className="search-field" htmlFor="proj-search">
            <Search size={16} color="var(--patch-muted)" />
            <input
              id="proj-search"
              type="search"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <FilterPill
            label={statusFilter}
            options={["All status", "In progress", "Active", "Planning", "On hold", "Completed"]}
            onSelect={setStatusFilter}
          />
          <FilterPill
            label={memberFilter}
            options={["All membership", "Member", "Not a member"]}
            onSelect={setMemberFilter}
          />
          <button className="filter-select" type="button">
            <Filter size={15} />
            Filters
          </button>
        </div>

        {/* Layout: project list + optional join panel */}
        <div className={hasJoinPanel ? "discover-layout" : ""}>
          {/* Project list */}
          <div>
            <div className="project-list" role="list">
              {filtered.length === 0 ? (
                <div style={{ padding: "40px 24px", textAlign: "center", background: "var(--patch-surface)", color: "var(--patch-muted)" }}>
                  No projects match the current filters.
                </div>
              ) : (
                filtered.map((proj) => (
                  <div
                    key={proj.id}
                    role="listitem"
                    className={`project-card ${selectedProject?.id === proj.id ? "selected" : ""}`}
                    onClick={() => proj.membership === "none" && setSelectedProject(proj)}
                    style={{ cursor: proj.membership === "none" ? "pointer" : "default" }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        {proj.membership !== "none" ? (
                          <Link href={`/projects/${proj.id}`} onClick={(e) => e.stopPropagation()}>
                            <h3 className="project-card-name">{proj.name}</h3>
                          </Link>
                        ) : (
                          <h3 className="project-card-name">{proj.name}</h3>
                        )}
                        <p className="project-card-desc">{proj.description}</p>
                        <div className="project-card-meta">
                          <span className="project-meta-item">
                            <User size={14} /> {proj.owner}
                          </span>
                          <span className="project-meta-item">
                            <FolderKanban size={14} /> {proj.equipments} Equipments
                          </span>
                          <span className="project-meta-item">
                            {memberBadge(proj.membership)}
                          </span>
                        </div>
                      </div>
                      {proj.membership === "none" && selectedProject?.id !== proj.id && (
                        <span style={{ color: "var(--patch-muted)", marginTop: 4 }} aria-hidden="true">›</span>
                      )}
                    </div>
                    {joinSent.includes(proj.id) && (
                      <div style={{ marginTop: 10 }}>
                        <StatusBadge tone="info">Request sent</StatusBadge>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            {/* Pagination */}
            <div className="pagination-bar" style={{ background: "transparent", border: 0, paddingInline: 0 }}>
              <span>1–{filtered.length} of {filtered.length} projects</span>
              <div className="pagination-controls">
                <button className="page-btn" type="button" disabled>‹</button>
                <button className="page-btn page-btn-active" type="button" aria-current="page">1</button>
                <button className="page-btn" type="button">›</button>
              </div>
              <button className="page-size-select" type="button">10 / page <ChevronDown size={13} /></button>
            </div>
          </div>

          {/* Join panel */}
          {selectedProject && (
            <aside className="join-panel" aria-label="Request project membership">
              <div className="join-panel-header">
                <h2>Ask to join project</h2>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Close join panel"
                  onClick={() => setSelectedProject(null)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="join-panel-body">
                <div className="join-panel-icon" aria-hidden="true">
                  <Lock size={26} />
                </div>
                <div>
                  <h3>{selectedProject.name}</h3>
                  <p className="join-panel-desc">
                    You're not a member of this project.<br />
                    Send a request to join. The project owner will review your request and decide whether to approve your access.
                  </p>
                </div>
                <div className="join-info-box">
                  <p>Your access request will include:</p>
                  <div className="join-info-row"><User size={15} /> Your name and email</div>
                  <div className="join-info-row"><Mail size={15} /> Your organization</div>
                  <div className="join-info-row"><FolderKanban size={15} /> A request to join this project</div>
                </div>
                <div>
                  <div className="join-message-label">
                    Add a message <span>(optional)</span>
                  </div>
                  <textarea
                    className="join-textarea"
                    placeholder="Tell the owner why you'd like to join this project..."
                    value={joinMessage}
                    onChange={(e) => setJoinMessage(e.target.value.slice(0, 500))}
                    aria-label="Message to project owner"
                  />
                  <div className="join-char-count">{joinMessage.length} / 500</div>
                </div>
                <Button style={{ width: "100%" }} onClick={handleJoin}>
                  Ask to join
                </Button>
              </div>
            </aside>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function FilterPill({ label, options, onSelect }: { label: string; options: string[]; onSelect: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button className="filter-select" type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        {label} <ChevronDown size={13} />
      </button>
      {open && (
        <ul role="listbox" style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 20,
          minWidth: 180, background: "var(--patch-surface)", border: "1px solid var(--patch-boundary)",
          borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", padding: "4px 0", listStyle: "none", margin: 0,
        }}>
          {options.map((opt) => (
            <li key={opt}>
              <button type="button" role="option" aria-selected={label === opt} style={{
                display: "block", width: "100%", padding: "8px 14px", border: 0,
                background: label === opt ? "color-mix(in srgb, var(--patch-accent) 8%, var(--patch-surface))" : "transparent",
                color: "var(--patch-text)", textAlign: "left", fontSize: 14, cursor: "pointer",
              }} onClick={() => { onSelect(opt); setOpen(false); }}>
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}