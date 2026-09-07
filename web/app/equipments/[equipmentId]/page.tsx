"use client";

import { useState } from "react";
import Link from "next/link";
import { Edit2, RefreshCw, Share2, Star, ThumbsUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui";
import { StatusBadge, Tabs } from "@/components/ui";

/* ── hardcoded Equipment detail ───────────────────────────── */
const EQUIPMENT = {
  id: "eq-1",
  name: "Centrifugal Pump P-101",
  status: "Healthy" as const,
  description: "Horizontal end-suction centrifugal pump used for cooling water circulation in the utility system. Variable speed motor with mechanical seal.",
  generatedDescription: "AI-generated from available documents and data.\nLast updated: May 14, 2025 10:21 AM",
  keyFacts: [
    ["Type",          "Centrifugal Pump"],
    ["Model",         "XH-150/400"],
    ["Manufacturer",  "FlowTech"],
    ["Serial number", "FT-21-P101-4S87"],
    ["Install date",  "Mar 15, 2021"],
    ["Location",      "Utility Room"],
    ["System",        "Cooling Water"],
    ["Criticality",   "High"],
  ],
  currentStatus: { label: "Healthy", note: "Operating within normal parameters.", lastUpdated: "May 14, 2025 10:21 AM" },
  documents: { total: 24, upToDate: 22, upToDatePct: 92, expiringSoon: 1, expiringSoonPct: 4, outOfDate: 1, outOfDatePct: 4 },
  profile: { status: "Up to date", lastUpdated: "May 14, 2025 9:58 AM", generatedFrom: "18 documents" },
};

type TabId = "overview" | "documents" | "projects" | "activity";

export default function EquipmentDetailPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const tabs = [
    { id: "overview",   label: "Overview" },
    { id: "documents",  label: "Documents" },
    { id: "projects",   label: "Projects" },
    { id: "activity",   label: "Activity" },
  ].map((t) => ({ ...t, active: t.id === activeTab, onSelect: () => setActiveTab(t.id as TabId) }));

  return (
    <AppShell
      title={EQUIPMENT.name}
      status={<StatusBadge tone="success">{EQUIPMENT.status}</StatusBadge>}
      actions={
        <div style={{ display: "flex", gap: 4 }}>
          <button className="icon-button" type="button" aria-label="Favourite">
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
      <Tabs label="Equipment sections" items={tabs} />

      {activeTab === "overview" && <OverviewTab />}
      {activeTab !== "overview" && (
        <section className="empty-state" style={{ minHeight: 320 }}>
          <p style={{ color: "var(--patch-muted)" }}>
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} tab content will be available in a later phase.
          </p>
        </section>
      )}
    </AppShell>
  );
}

function OverviewTab() {
  const eq = EQUIPMENT;
  return (
    <div className="overview-page" style={{ paddingTop: 20 }}>
      {/* Top row */}
      <div className="overview-top-grid">
        {/* Description */}
        <div className="overview-panel">
          <div className="overview-panel-header">
            <h2>Description</h2>
            <Button variant="secondary" icon={<Edit2 size={14} />}>Edit</Button>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--patch-text)" }}>
            {eq.description}
          </p>
          <div style={{ marginTop: 20, borderTop: "1px solid var(--patch-boundary)", paddingTop: 16 }}>
            <div className="overview-panel-header" style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: 15 }}>Generated description <span style={{ fontSize: 13, color: "var(--patch-muted)", fontWeight: 400 }}>ⓘ</span></h2>
              <Button variant="secondary" icon={<RefreshCw size={14} />}>Regenerate</Button>
            </div>
            <p className="generated-meta" style={{ whiteSpace: "pre-line" }}>{eq.generatedDescription}</p>
            <button className="looks-good-btn" type="button">
              <ThumbsUp size={15} /> Looks good
            </button>
          </div>
        </div>

        {/* Key facts */}
        <div className="overview-panel">
          <h2 style={{ margin: "0 0 16px", fontSize: 17 }}>Key facts</h2>
          <div className="detail-grid">
            {eq.keyFacts.map(([k, v]) => (
              <>
                <span key={`k-${k}`} className="detail-key">{k}</span>
                <span key={`v-${k}`} className="detail-val">{v}</span>
              </>
            ))}
          </div>
        </div>

        {/* Current status */}
        <div className="overview-panel">
          <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>Current status</h2>
          <div style={{ marginBottom: 12 }}>
            <StatusBadge tone="success">{eq.currentStatus.label}</StatusBadge>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--patch-muted)", lineHeight: 1.5 }}>
            {eq.currentStatus.note}
          </p>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--patch-muted)" }}>Last updated</p>
          <p style={{ margin: "0 0 16px", fontSize: 14 }}>{eq.currentStatus.lastUpdated}</p>
          <Button variant="secondary" style={{ width: "100%" }}>View latest activity</Button>
        </div>
      </div>

      {/* Bottom row */}
      <div className="overview-bottom-grid">
        {/* Documents summary */}
        <div className="overview-panel">
          <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>Documents</h2>
          <div className="overview-stat-row">
            <span className="overview-stat-label">Total documents</span>
            <span style={{ fontWeight: 600 }}>{eq.documents.total}</span>
          </div>
          <div className="overview-stat-row">
            <span className="overview-stat-label">Up to date</span>
            <span style={{ color: "var(--patch-success)", fontWeight: 600 }}>
              {eq.documents.upToDate} ({eq.documents.upToDatePct}%)
            </span>
          </div>
          <div className="overview-stat-row">
            <span className="overview-stat-label">Expiring soon</span>
            <span style={{ color: "var(--patch-attention)", fontWeight: 600 }}>
              {eq.documents.expiringSoon} ({eq.documents.expiringSoonPct}%)
            </span>
          </div>
          <div className="overview-stat-row">
            <span className="overview-stat-label">Out of date</span>
            <span style={{ color: "var(--patch-danger)", fontWeight: 600 }}>
              {eq.documents.outOfDate} ({eq.documents.outOfDatePct}%)
            </span>
          </div>
          <div style={{ marginTop: 16 }}>
            <Button variant="secondary">View documents</Button>
          </div>
        </div>

        {/* Profile summary */}
        <div className="overview-panel">
          <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>Profile</h2>
          <div className="overview-stat-row">
            <span className="overview-stat-label">Profile status</span>
            <span style={{ color: "var(--patch-success)", fontWeight: 600 }}>{eq.profile.status}</span>
          </div>
          <div className="overview-stat-row">
            <span className="overview-stat-label">Last updated</span>
            <span>{eq.profile.lastUpdated}</span>
          </div>
          <div className="overview-stat-row">
            <span className="overview-stat-label">Generated from</span>
            <span>{eq.profile.generatedFrom}</span>
          </div>
          <div style={{ marginTop: 16 }}>
            <Button variant="secondary">View profile</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
