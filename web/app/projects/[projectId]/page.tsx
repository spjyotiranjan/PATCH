"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Edit2, Share2, Star, Wrench } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, StatusBadge, Tabs } from "@/components/ui";

/* ── hardcoded Project workspace data ────────────────────────── */
const PROJECT = {
  id: "proj-1",
  name: "Boiler Upgrade Project",
  status: "In progress" as const,
  description:
    "Upgrade the existing boiler system to improve thermal efficiency, ensure compliance with current standards, and increase overall reliability. The project includes new burner installation, control system upgrade, and safety enhancements.",
  details: {
    owner: "Engineering Team",
    status: "In progress",
    created: "May 10, 2025 9:15 AM",
    lastUpdated: "May 14, 2025 10:21 AM",
    membersCount: 7,
  },
  profile: {
    status: "Fresh",
    lastProfiled: "May 14, 2025 9:58 AM",
    generatedFrom: "8 Equipments",
  },
  equipments: [
    { id: "eq-1", name: "Boiler B-201", location: "Boiler House", status: "Healthy" },
    { id: "eq-2", name: "Boiler Feed Pump P-101", location: "Utility Room", status: "Healthy" },
    { id: "eq-3", name: "Economizer E-101", location: "Boiler House", status: "Healthy" },
    { id: "eq-4", name: "Feedwater Tank T-101", location: "Utility Room", status: "Healthy" },
  ],
  totalEquipments: 8,
  documents: {
    direct: {
      total: 18,
      upToDate: 16,
      upToDatePct: 89,
      outOfDate: 2,
      outOfDatePct: 11,
    },
    derived: {
      total: 42,
      upToDate: 40,
      upToDatePct: 95,
      outOfDate: 2,
      outOfDatePct: 5,
    },
    all: {
      total: 60,
      upToDate: 56,
      upToDatePct: 93,
      outOfDate: 4,
      outOfDatePct: 7,
    },
  },
};

type TabId =
  | "overview"
  | "equipments"
  | "documents"
  | "maintenance-logs"
  | "procedures"
  | "members"
  | "activity";

export default function ProjectWorkspacePage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "equipments", label: "Equipments" },
    { id: "documents", label: "Documents" },
    { id: "maintenance-logs", label: "Maintenance logs" },
    { id: "procedures", label: "Procedures" },
    { id: "members", label: "Members" },
    { id: "activity", label: "Activity" },
  ].map((t) => ({
    ...t,
    active: t.id === activeTab,
    onSelect: () => setActiveTab(t.id as TabId),
  }));

  return (
    <AppShell
      title={PROJECT.name}
      status={<StatusBadge tone="success">{PROJECT.status}</StatusBadge>}
      actions={
        <div style={{ display: "flex", gap: 4 }}>
          <button className="icon-button" type="button" aria-label="Favorite">
            <Star size={18} strokeWidth={1.7} />
          </button>
          <button className="icon-button" type="button" aria-label="Share">
            <Share2 size={18} strokeWidth={1.7} />
          </button>
          <button className="icon-button" type="button" aria-label="More actions">
            ···
          </button>
        </div>
      }
    >
      <Tabs label="Project sections" items={tabs} />

      {activeTab === "overview" && <OverviewTab />}
      {activeTab !== "overview" && (
        <section className="empty-state" style={{ minHeight: 320 }}>
          <p style={{ color: "var(--patch-muted)" }}>
            {activeTab
              .split("-")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ")}{" "}
            tab content will be available in a later phase.
          </p>
        </section>
      )}
    </AppShell>
  );
}

function OverviewTab() {
  const proj = PROJECT;

  return (
    <div className="overview-page" style={{ paddingTop: 20, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top 2-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Description */}
          <div className="overview-panel">
            <div className="overview-panel-header" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Description</h2>
              <Button variant="secondary" icon={<Edit2 size={14} />}>
                Edit
              </Button>
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--patch-text)" }}>
              {proj.description}
            </p>
          </div>

          {/* Included Equipments */}
          <div className="overview-panel">
            <div className="overview-panel-header" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
                Included Equipments ({proj.totalEquipments})
              </h2>
              <Link
                href="/equipments"
                style={{
                  color: "var(--patch-accent)",
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                View all
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {proj.equipments.map((eq) => (
                <div
                  key={eq.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--patch-boundary)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: "var(--patch-surface-muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--patch-muted)",
                      }}
                    >
                      <Wrench size={16} />
                    </div>
                    <Link
                      href={`/equipments/${eq.id}`}
                      style={{
                        color: "var(--patch-text)",
                        fontSize: 14,
                        fontWeight: 500,
                        textDecoration: "none",
                      }}
                    >
                      {eq.name}
                    </Link>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                    <span style={{ fontSize: 14, color: "var(--patch-muted)" }}>{eq.location}</span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--patch-success)",
                      }}
                    >
                      {eq.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <Link
                href="/equipments"
                style={{
                  fontSize: 14,
                  color: "var(--patch-accent)",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                +{proj.totalEquipments - proj.equipments.length} more Equipments
              </Link>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Project details */}
          <div className="overview-panel">
            <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 600 }}>Project details</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: "var(--patch-muted)" }}>Owner</span>
                <span style={{ fontWeight: 500 }}>{proj.details.owner}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
                <span style={{ color: "var(--patch-muted)" }}>Status</span>
                <StatusBadge tone="success">{proj.details.status}</StatusBadge>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: "var(--patch-muted)" }}>Created</span>
                <span>{proj.details.created}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: "var(--patch-muted)" }}>Last updated</span>
                <span>{proj.details.lastUpdated}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: "var(--patch-muted)" }}>Members</span>
                <span style={{ fontWeight: 600 }}>{proj.details.membersCount}</span>
              </div>
            </div>
            <div style={{ marginTop: 18 }}>
              <Button variant="secondary" style={{ width: "100%" }}>
                View members
              </Button>
            </div>
          </div>

          {/* Profile */}
          <div className="overview-panel">
            <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 600 }}>Profile</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
                <span style={{ color: "var(--patch-muted)" }}>Profile status</span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--patch-success)",
                    background: "rgba(22, 163, 74, 0.12)",
                    borderRadius: 999,
                    padding: "2px 10px",
                  }}
                >
                  <CheckCircle2 size={13} /> {proj.profile.status}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: "var(--patch-muted)" }}>Last profiled</span>
                <span>{proj.profile.lastProfiled}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: "var(--patch-muted)" }}>Generated from</span>
                <span>{proj.profile.generatedFrom}</span>
              </div>
            </div>
            <div style={{ marginTop: 18 }}>
              <Button variant="secondary" style={{ width: "100%" }}>
                View profile
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: Documents card */}
      <div className="overview-panel">
        <h2 style={{ margin: "0 0 18px", fontSize: 17, fontWeight: 600 }}>Documents</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24,
            paddingBottom: 20,
            borderBottom: "1px solid var(--patch-boundary)",
          }}
        >
          {/* Direct documents */}
          <div>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--patch-text)" }}>
              Direct documents
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--patch-muted)" }}>Total</span>
                <span style={{ fontWeight: 600 }}>{proj.documents.direct.total}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--patch-muted)" }}>Up to date</span>
                <span style={{ color: "var(--patch-success)", fontWeight: 600 }}>
                  {proj.documents.direct.upToDate} ({proj.documents.direct.upToDatePct}%)
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--patch-muted)" }}>Out of date</span>
                <span style={{ color: "var(--patch-danger)", fontWeight: 600 }}>
                  {proj.documents.direct.outOfDate} ({proj.documents.direct.outOfDatePct}%)
                </span>
              </div>
            </div>
          </div>

          {/* Equipment-derived documents */}
          <div>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--patch-text)" }}>
              Equipment-derived documents
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--patch-muted)" }}>Total</span>
                <span style={{ fontWeight: 600 }}>{proj.documents.derived.total}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--patch-muted)" }}>Up to date</span>
                <span style={{ color: "var(--patch-success)", fontWeight: 600 }}>
                  {proj.documents.derived.upToDate} ({proj.documents.derived.upToDatePct}%)
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--patch-muted)" }}>Out of date</span>
                <span style={{ color: "var(--patch-danger)", fontWeight: 600 }}>
                  {proj.documents.derived.outOfDate} ({proj.documents.derived.outOfDatePct}%)
                </span>
              </div>
            </div>
          </div>

          {/* All project documents */}
          <div>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--patch-text)" }}>
              All project documents
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--patch-muted)" }}>Total</span>
                <span style={{ fontWeight: 600 }}>{proj.documents.all.total}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--patch-muted)" }}>Up to date</span>
                <span style={{ color: "var(--patch-success)", fontWeight: 600 }}>
                  {proj.documents.all.upToDate} ({proj.documents.all.upToDatePct}%)
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--patch-muted)" }}>Out of date</span>
                <span style={{ color: "var(--patch-danger)", fontWeight: 600 }}>
                  {proj.documents.all.outOfDate} ({proj.documents.all.outOfDatePct}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <Button variant="secondary">View all documents</Button>
        </div>
      </div>
    </div>
  );
}
