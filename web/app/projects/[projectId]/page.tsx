"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Edit2,
  FileText,
  Filter,
  History,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Star,
  UserPlus,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button, StatusBadge, Tabs } from "@/components/ui";
import { toast } from "sonner";

/* =========================================================
   PROJECT DATA
   ========================================================= */

const PROJECT = {
  id: "proj-1",
  name: "Boiler Upgrade Project",
  code: "PRJ-2025-089",
  status: "In progress" as const,

  description:
    "Upgrade the existing boiler system to improve thermal efficiency, ensure compliance with current standards, and increase overall reliability. The project includes new burner installation, control system upgrade, and safety enhancements.",

  details: {
    owner: "Engineering Team",
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
    {
      id: "eq-1",
      name: "Boiler B-201",
      location: "Boiler House",
      status: "Healthy",
      type: "Equipment",
    },
    {
      id: "eq-2",
      name: "Boiler Feed Pump P-101",
      location: "Utility Room",
      status: "Healthy",
      type: "Equipment",
    },
    {
      id: "eq-3",
      name: "Economizer E-101",
      location: "Boiler House",
      status: "Healthy",
      type: "Equipment",
    },
    {
      id: "eq-4",
      name: "Feedwater Tank T-101",
      location: "Utility Room",
      status: "Healthy",
      type: "Equipment",
    },
    {
      id: "eq-5",
      name: "Burner BNR-201",
      location: "Boiler House",
      status: "Healthy",
      type: "Equipment",
    },
    {
      id: "eq-6",
      name: "Control Panel CP-201",
      location: "Control Room",
      status: "Healthy",
      type: "Equipment",
    },
    {
      id: "eq-7",
      name: "Steam Drum SD-201",
      location: "Boiler House",
      status: "Healthy",
      type: "Equipment",
    },
    {
      id: "eq-8",
      name: "Condensate Pump P-201",
      location: "Utility Room",
      status: "Healthy",
      type: "Equipment",
    },
  ],

  documents: [
    {
      id: "doc-1",
      name: "Project Execution Plan & Scope of Work",
      file: "PRJ-2025-PEP-V2.pdf",
      type: "Project Plan",
      revision: "v2.0",
      status: "Active",
      coverage: "96%",
      updated: "May 01, 2025",
      source: "Direct project document",
    },
    {
      id: "doc-2",
      name: "Boiler Upgrade Safety Procedure",
      file: "PRJ-2025-SAF-V3.pdf",
      type: "Safety Procedure",
      revision: "v3.0",
      status: "Needs review",
      coverage: "81%",
      updated: "Apr 28, 2025",
      source: "Direct project document",
    },
    {
      id: "doc-3",
      name: "Commissioning Checklist",
      file: "PRJ-2025-COM-V1.pdf",
      type: "Checklist",
      revision: "v1.0",
      status: "Active",
      coverage: "100%",
      updated: "Apr 25, 2025",
      source: "Direct project document",
    },
    {
      id: "doc-4",
      name: "Boiler Operations Manual",
      file: "BOILER-OPS-V4.pdf",
      type: "Equipment Manual",
      revision: "Rev. 4.2",
      status: "Active",
      coverage: "98%",
      updated: "Apr 20, 2025",
      source: "Inherited from Boiler B-201",
    },
    {
      id: "doc-5",
      name: "Boiler Maintenance Procedure",
      file: "BOILER-MAINT-V3.pdf",
      type: "Maintenance Procedure",
      revision: "Rev. 3.1",
      status: "Active",
      coverage: "94%",
      updated: "Apr 18, 2025",
      source: "Inherited from Boiler B-201",
    },
    {
      id: "doc-6",
      name: "Feed Pump Service Manual",
      file: "PUMP-SERVICE-V2.pdf",
      type: "Service Manual",
      revision: "Rev. 2.1",
      status: "Needs review",
      coverage: "76%",
      updated: "Apr 12, 2025",
      source: "Inherited from Boiler Feed Pump P-101",
    },
  ],

  members: [
    {
      id: "u1",
      name: "Mark Stevens",
      role: "Project Owner",
      team: "Engineering Team",
      status: "Active",
    },
    {
      id: "u2",
      name: "Sarah Johnson",
      role: "Maintenance Engineer",
      team: "Maintenance",
      status: "Active",
    },
    {
      id: "u3",
      name: "David Wilson",
      role: "Safety Manager",
      team: "Safety",
      status: "Active",
    },
    {
      id: "u4",
      name: "James Miller",
      role: "Technician",
      team: "Operations",
      status: "Active",
    },
    {
      id: "u5",
      name: "Emily Davis",
      role: "Engineer",
      team: "Engineering",
      status: "Active",
    },
    {
      id: "u6",
      name: "Robert Brown",
      role: "Technician",
      team: "Operations",
      status: "Active",
    },
    {
      id: "u7",
      name: "Linda Taylor",
      role: "Reviewer",
      team: "Quality",
      status: "Active",
    },
  ],
};

/* =========================================================
   TYPES
   ========================================================= */

type TabId =
  | "overview"
  | "equipments"
  | "documents"
  | "maintenance-logs"
  | "procedures"
  | "members"
  | "activity";

type LogStatus = "Open" | "In review" | "Resolved";

type ProcedureStatus =
  | "Draft"
  | "Under review"
  | "Published"
  | "Needs changes";

/* =========================================================
   MOCK MAINTENANCE LOGS
   ========================================================= */

const INITIAL_LOGS = [
  {
    id: "LOG-2025-041",
    title: "Boiler feedwater pressure drop",
    equipment: "Boiler Feed Pump P-101",
    technician: "James Miller",
    status: "In review" as LogStatus,
    priority: "High",
    date: "May 14, 2025",
    description:
      "Feedwater pressure dropped below the expected operating range during routine operation.",
  },
  {
    id: "LOG-2025-040",
    title: "Burner inspection completed",
    equipment: "Burner BNR-201",
    technician: "Robert Brown",
    status: "Resolved" as LogStatus,
    priority: "Normal",
    date: "May 13, 2025",
    description:
      "Routine burner inspection completed. No abnormal wear was identified.",
  },
  {
    id: "LOG-2025-039",
    title: "Control panel alarm review",
    equipment: "Control Panel CP-201",
    technician: "Sarah Johnson",
    status: "Open" as LogStatus,
    priority: "Medium",
    date: "May 12, 2025",
    description:
      "Repeated warning alarm observed during startup sequence.",
  },
  {
    id: "LOG-2025-038",
    title: "Economizer temperature check",
    equipment: "Economizer E-101",
    technician: "James Miller",
    status: "Resolved" as LogStatus,
    priority: "Normal",
    date: "May 11, 2025",
    description:
      "Temperature readings checked against the approved operating range.",
  },
];

/* =========================================================
   MOCK PROCEDURES
   ========================================================= */

const PROCEDURES = [
  {
    id: "PROC-001",
    title: "Boiler Startup Procedure",
    version: "v3.1",
    status: "Published" as ProcedureStatus,
    owner: "Safety Manager",
    updated: "May 13, 2025",
    steps: 12,
    evidence: 8,
  },
  {
    id: "PROC-002",
    title: "Boiler Shutdown Procedure",
    version: "v2.4",
    status: "Published" as ProcedureStatus,
    owner: "Safety Manager",
    updated: "May 10, 2025",
    steps: 9,
    evidence: 6,
  },
  {
    id: "PROC-003",
    title: "Emergency Burner Isolation",
    version: "Draft",
    status: "Under review" as ProcedureStatus,
    owner: "David Wilson",
    updated: "May 14, 2025",
    steps: 7,
    evidence: 5,
  },
  {
    id: "PROC-004",
    title: "Feedwater Pump Inspection",
    version: "Draft",
    status: "Needs changes" as ProcedureStatus,
    owner: "Sarah Johnson",
    updated: "May 09, 2025",
    steps: 8,
    evidence: 3,
  },
];

/* =========================================================
   ACTIVITY
   ========================================================= */

const ACTIVITIES = [
  {
    id: 1,
    actor: "Sarah Johnson",
    action: "updated maintenance log",
    target: "Boiler feedwater pressure drop",
    time: "10 minutes ago",
    icon: Wrench,
  },
  {
    id: 2,
    actor: "David Wilson",
    action: "requested review for procedure",
    target: "Emergency Burner Isolation",
    time: "42 minutes ago",
    icon: ShieldCheck,
  },
  {
    id: 3,
    actor: "Mark Stevens",
    action: "uploaded a new document version",
    target: "Project Execution Plan & Scope of Work",
    time: "2 hours ago",
    icon: FileText,
  },
  {
    id: 4,
    actor: "James Miller",
    action: "created maintenance log",
    target: "Boiler feedwater pressure drop",
    time: "3 hours ago",
    icon: Plus,
  },
  {
    id: 5,
    actor: "Linda Taylor",
    action: "reviewed document",
    target: "Boiler Upgrade Safety Procedure",
    time: "Yesterday",
    icon: CheckCircle2,
  },
];

/* =========================================================
   MAIN PAGE
   ========================================================= */

export default function ProjectWorkspacePage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const initialTab = use(
    searchParams ?? Promise.resolve<{ tab?: string }>({}),
  ).tab;
  const [activeTab, setActiveTab] =
    useState<TabId>(
      initialTab === "equipments" ||
      initialTab === "documents" ||
      initialTab === "maintenance-logs" ||
      initialTab === "procedures" ||
      initialTab === "members" ||
      initialTab === "activity"
        ? initialTab
        : "overview",
    );

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "equipments", label: "Equipments" },
    { id: "documents", label: "Documents" },
    { id: "maintenance-logs", label: "Maintenance logs" },
    { id: "procedures", label: "Procedures" },
    { id: "members", label: "Members" },
    { id: "activity", label: "Activity" },
  ].map((tab) => ({
    ...tab,
    active: tab.id === activeTab,
    onSelect: () => setActiveTab(tab.id as TabId),
  }));

  return (
    <AppShell
      title={PROJECT.name}
      status={<StatusBadge tone="success">{PROJECT.status}</StatusBadge>}
      actions={
        <div style={{ display: "flex", gap: 4 }}>
          <button
            className="icon-button"
            type="button"
            aria-label="Favorite project"
          >
            <Star size={18} strokeWidth={1.7} />
          </button>

          <button
            className="icon-button"
            type="button"
            aria-label="Share project"
          >
            <Share2 size={18} strokeWidth={1.7} />
          </button>

          <button
            className="icon-button"
            type="button"
            aria-label="More project actions"
          >
            <MoreHorizontal size={19} />
          </button>
        </div>
      }
    >
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            color: "var(--patch-accent)",
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 8,
          }}
        >
          {PROJECT.code}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--patch-muted)",
            fontSize: 14,
          }}
        >
          <span>{PROJECT.details.owner}</span>
          <span>•</span>
          <span>{PROJECT.equipments.length} equipments</span>
          <span>•</span>
          <span>{PROJECT.details.membersCount} members</span>
        </div>
      </div>

      <Tabs label="Project sections" items={tabs} />

      <div style={{ paddingTop: 4 }}>
        {activeTab === "overview" && <OverviewTab />}

        {activeTab === "equipments" && <EquipmentsTab />}

        {activeTab === "documents" && <DocumentsTab />}

        {activeTab === "maintenance-logs" && <MaintenanceLogsTab />}

        {activeTab === "procedures" && <ProceduresTab />}

        {activeTab === "members" && <MembersTab />}

        {activeTab === "activity" && <ActivityTab />}
      </div>
    </AppShell>
  );
}

/* =========================================================
   OVERVIEW
   ========================================================= */

function OverviewTab() {
  return (
    <div
      style={{
        paddingTop: 20,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div className="overview-panel">
            <div
              className="overview-panel-header"
              style={{ marginBottom: 12 }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 17,
                  fontWeight: 600,
                }}
              >
                Description
              </h2>

              <Button
                variant="secondary"
                icon={<Edit2 size={14} />}
              >
                Edit
              </Button>
            </div>

            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.6,
                color: "var(--patch-text)",
              }}
            >
              {PROJECT.description}
            </p>
          </div>

          <EquipmentSummary />

          <DocumentSummary />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <ProjectDetails />

          <ProfileCard />

          <QuickActions />
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   PROJECT DETAILS
   ========================================================= */

function ProjectDetails() {
  return (
    <div className="overview-panel">
      <h2
        style={{
          margin: "0 0 16px",
          fontSize: 17,
          fontWeight: 600,
        }}
      >
        Project details
      </h2>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 13,
        }}
      >
        <InfoRow label="Owner" value={PROJECT.details.owner} />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 14,
          }}
        >
          <span style={{ color: "var(--patch-muted)" }}>
            Status
          </span>

          <StatusBadge tone="success">
            {PROJECT.status}
          </StatusBadge>
        </div>

        <InfoRow
          label="Created"
          value={PROJECT.details.created}
        />

        <InfoRow
          label="Last updated"
          value={PROJECT.details.lastUpdated}
        />

        <InfoRow
          label="Members"
          value={String(PROJECT.details.membersCount)}
          strong
        />
      </div>

      <div style={{ marginTop: 18 }}>
        <Button variant="secondary" style={{ width: "100%" }}>
          View members
        </Button>
      </div>
    </div>
  );
}

/* =========================================================
   PROFILE
   ========================================================= */

function ProfileCard() {
  return (
    <div className="overview-panel">
      <h2
        style={{
          margin: "0 0 16px",
          fontSize: 17,
          fontWeight: 600,
        }}
      >
        Project profile
      </h2>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 13,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 14,
          }}
        >
          <span style={{ color: "var(--patch-muted)" }}>
            Profile status
          </span>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              color: "var(--patch-success)",
              background: "rgba(22,163,74,.12)",
              borderRadius: 999,
              padding: "3px 10px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={13} />
            {PROJECT.profile.status}
          </span>
        </div>

        <InfoRow
          label="Last profiled"
          value={PROJECT.profile.lastProfiled}
        />

        <InfoRow
          label="Generated from"
          value={PROJECT.profile.generatedFrom}
        />
      </div>

      <div
        style={{
          marginTop: 18,
          display: "flex",
          gap: 8,
        }}
      >
        <Button variant="secondary" style={{ flex: 1 }}>
          <RefreshCw size={14} />
          Refresh
        </Button>

        <Button variant="secondary" style={{ flex: 1 }}>
          View profile
        </Button>
      </div>
    </div>
  );
}

/* =========================================================
   QUICK ACTIONS
   ========================================================= */

function QuickActions() {
  return (
    <div className="overview-panel">
      <h2
        style={{
          margin: "0 0 14px",
          fontSize: 17,
          fontWeight: 600,
        }}
      >
        Quick actions
      </h2>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <Button variant="secondary">
          <Plus size={15} />
          New maintenance log
        </Button>

        <Button variant="secondary">
          <FileText size={15} />
          Add document
        </Button>

        <Button variant="secondary">
          <ShieldCheck size={15} />
          Review procedures
        </Button>
      </div>
    </div>
  );
}

/* =========================================================
   EQUIPMENT SUMMARY
   ========================================================= */

function EquipmentSummary() {
  return (
    <div className="overview-panel">
      <div
        className="overview-panel-header"
        style={{ marginBottom: 16 }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 600,
          }}
        >
          Included Equipments ({PROJECT.equipments.length})
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

      <div
        style={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        {PROJECT.equipments.slice(0, 4).map((equipment) => (
          <Link
            key={equipment.id}
            href={`/equipments/${equipment.id}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 0",
              borderBottom:
                "1px solid var(--patch-boundary)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 7,
                  background:
                    "var(--patch-surface-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--patch-muted)",
                }}
              >
                <Wrench size={16} />
              </div>

              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {equipment.name}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: "var(--patch-muted)",
                    marginTop: 2,
                  }}
                >
                  {equipment.location}
                </div>
              </div>
            </div>

            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                color: "var(--patch-success)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "var(--patch-success)",
                }}
              />
              Healthy
            </span>
          </Link>
        ))}
      </div>

      <Link
        href="/equipments"
        style={{
          display: "inline-block",
          marginTop: 14,
          fontSize: 14,
          color: "var(--patch-accent)",
          fontWeight: 500,
          textDecoration: "none",
        }}
      >
        +{PROJECT.equipments.length - 4} more Equipments
      </Link>
    </div>
  );
}

/* =========================================================
   DOCUMENT SUMMARY
   ========================================================= */

function DocumentSummary() {
  return (
    <div className="overview-panel">
      <div
        className="overview-panel-header"
        style={{ marginBottom: 18 }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 600,
          }}
        >
          Documents
        </h2>

        <span
          style={{
            color: "var(--patch-accent)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {PROJECT.documents.length} linked
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        <StatCard
          label="Direct project docs"
          value="3"
          color="var(--patch-accent)"
        />

        <StatCard
          label="Inherited equipment docs"
          value="3"
          color="var(--patch-accent)"
        />

        <StatCard
          label="Needs review"
          value="2"
          color="var(--patch-warning)"
        />
      </div>
    </div>
  );
}

/* =========================================================
   EQUIPMENTS TAB
   ========================================================= */

function EquipmentsTab() {
  const [search, setSearch] = useState("");

  const filtered = PROJECT.equipments.filter((equipment) =>
    `${equipment.name} ${equipment.location}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div style={{ paddingTop: 20 }}>
      <PageIntro
        title="Project equipments"
        description="Equipment associated with this project."
        count={`${PROJECT.equipments.length} equipments`}
      />

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 20,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            position: "relative",
            flex: 1,
            maxWidth: 400,
          }}
        >
          <Search
            size={17}
            style={{
              position: "absolute",
              left: 14,
              top: 13,
              color: "var(--patch-muted)",
            }}
          />

          <input
            aria-label="Search equipments"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search equipments..."
            style={inputStyle}
          />
        </div>

        <Button variant="secondary">
          <Filter size={15} />
          Filters
        </Button>
      </div>

      <div className="overview-panel" style={{ padding: 0 }}>
        <div style={tableHeaderStyle}>
          <span>EQUIPMENT</span>
          <span>LOCATION</span>
          <span>STATUS</span>
          <span>TYPE</span>
          <span />
        </div>

        {filtered.map((equipment) => (
          <Link
            key={equipment.id}
            href={`/equipments/${equipment.id}`}
            style={tableRowStyle}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={equipmentIconStyle}>
                <Wrench size={16} />
              </div>

              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {equipment.name}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: "var(--patch-muted)",
                    marginTop: 3,
                  }}
                >
                  {equipment.id}
                </div>
              </div>
            </div>

            <span style={mutedTextStyle}>
              {equipment.location}
            </span>

            <span
              style={{
                color: "var(--patch-success)",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              ● Healthy
            </span>

            <span style={mutedTextStyle}>
              {equipment.type}
            </span>

            <ChevronRight
              size={17}
              color="var(--patch-muted)"
            />
          </Link>
        ))}

        {filtered.length === 0 && (
          <EmptyState
            title="No equipments found"
            description="Try another search term."
          />
        )}
      </div>
    </div>
  );
}

/* =========================================================
   DOCUMENTS TAB
   ========================================================= */

function DocumentsTab() {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("All sources");

  const filtered = PROJECT.documents.filter((doc) => {
    const matchesSearch =
      `${doc.name} ${doc.file} ${doc.type}`
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesSource =
      source === "All sources" ||
      doc.source === source;

    return matchesSearch && matchesSource;
  });

  return (
    <div style={{ paddingTop: 20 }}>
      <PageIntro
        title="Project documents"
        description="Manage project documents and documents inherited from associated equipment."
        count={`${PROJECT.documents.length} linked documents`}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(0, 1fr))",
          gap: 16,
          marginTop: 24,
        }}
      >
        <StatCard
          label="Direct project docs"
          value="3"
        />

        <StatCard
          label="Inherited equipment docs"
          value="3"
        />

        <StatCard
          label="Total linked docs"
          value="6"
          color="var(--patch-success)"
        />

        <StatCard
          label="Needs review"
          value="2"
          color="var(--patch-warning)"
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 24,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            position: "relative",
            flex: 1,
          }}
        >
          <Search
            size={17}
            style={{
              position: "absolute",
              left: 14,
              top: 13,
              color: "var(--patch-muted)",
            }}
          />

          <input
            aria-label="Search project documents"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search project documents..."
            style={inputStyle}
          />
        </div>

        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={{
            ...inputStyle,
            width: 230,
            paddingLeft: 14,
          }}
          aria-label="Document source"
        >
          <option>All sources</option>
          <option>Direct project document</option>
          <option>Inherited from Boiler B-201</option>
          <option>
            Inherited from Boiler Feed Pump P-101
          </option>
        </select>

        <Button variant="secondary">
          <RefreshCw size={15} />
          Refresh profile
        </Button>

        <Button>
          <Plus size={15} />
          Add document
        </Button>
      </div>

      <div className="overview-panel" style={{ padding: 0 }}>
        <div style={documentHeaderStyle}>
          <span>DOCUMENT</span>
          <span>TYPE</span>
          <span>REVISION</span>
          <span>STATUS</span>
          <span>COVERAGE</span>
          <span>UPDATED</span>
          <span />
        </div>

        {filtered.map((doc) => (
          <div key={doc.id} style={documentRowStyle}>
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {doc.name}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "var(--patch-muted)",
                  marginTop: 4,
                }}
              >
                {doc.file} · {doc.source}
              </div>
            </div>

            <span style={mutedTextStyle}>
              {doc.type}
            </span>

            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {doc.revision}
            </span>

            <StatusBadge
              tone={
                doc.status === "Active"
                  ? "success"
                  : "attention"
              }
            >
              {doc.status}
            </StatusBadge>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  doc.coverage === "100%"
                    ? "rgba(22,163,74,.12)"
                    : "rgba(37,99,235,.12)",
                color:
                  doc.coverage === "100%"
                    ? "var(--patch-success)"
                    : "var(--patch-accent)",
                borderRadius: 999,
                padding: "5px 10px",
                fontSize: 12,
                fontWeight: 600,
                width: "fit-content",
              }}
            >
              {doc.coverage}
            </span>

            <span style={mutedTextStyle}>
              {doc.updated}
            </span>

            <Button variant="secondary">
              View
            </Button>
          </div>
        ))}

        {filtered.length === 0 && (
          <EmptyState
            title="No documents found"
            description="No project documents match your filters."
          />
        )}
      </div>
    </div>
  );
}

/* =========================================================
   MAINTENANCE LOGS
   ========================================================= */

function MaintenanceLogsTab() {
  const [logs, setLogs] = useState(INITIAL_LOGS);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"All" | LogStatus>("All");

  const visibleLogs =
    filter === "All"
      ? logs
      : logs.filter((log) => log.status === filter);

  function resolveLog(id: string) {
    setLogs((current) =>
      current.map((log) =>
        log.id === id
          ? {
              ...log,
              status: "Resolved" as LogStatus,
            }
          : log,
      ),
    );
  }

  return (
    <div style={{ paddingTop: 20 }}>
      <PageIntro
        title="Maintenance logs"
        description="Create, review, and track maintenance activity within this project."
        count={`${logs.length} logs`}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(0, 1fr))",
          gap: 16,
          marginTop: 24,
        }}
      >
        <StatCard
          label="Total logs"
          value={String(logs.length)}
        />

        <StatCard
          label="Open"
          value={String(
            logs.filter((x) => x.status === "Open")
              .length,
          )}
          color="var(--patch-warning)"
        />

        <StatCard
          label="In review"
          value={String(
            logs.filter(
              (x) => x.status === "In review",
            ).length,
          )}
          color="var(--patch-accent)"
        />

        <StatCard
          label="Resolved"
          value={String(
            logs.filter(
              (x) => x.status === "Resolved",
            ).length,
          )}
          color="var(--patch-success)"
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 24,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {(["All", "Open", "In review", "Resolved"] as const).map(
            (item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                style={{
                  border:
                    "1px solid var(--patch-boundary)",
                  background:
                    filter === item
                      ? "var(--patch-accent)"
                      : "var(--patch-surface)",
                  color:
                    filter === item
                      ? "#fff"
                      : "var(--patch-text)",
                  borderRadius: 7,
                  padding: "8px 13px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {item}
              </button>
            ),
          )}
        </div>

        <Button onClick={() => setShowForm(true)}>
          <Plus size={15} />
          New maintenance log
        </Button>
      </div>

      <div className="overview-panel" style={{ padding: 0 }}>
        {visibleLogs.map((log) => (
          <div
            key={log.id}
            style={{
              padding: 18,
              borderBottom:
                "1px solid var(--patch-boundary)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 20,
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 7,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--patch-muted)",
                      fontWeight: 600,
                    }}
                  >
                    {log.id}
                  </span>

                  <StatusBadge
                    tone={
                      log.status === "Resolved"
                        ? "success"
                        : log.status === "In review"
                          ? "info"
                          : "attention"
                    }
                  >
                    {log.status}
                  </StatusBadge>

                  {log.priority === "High" && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        color: "var(--patch-danger)",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <AlertTriangle size={13} />
                      High priority
                    </span>
                  )}
                </div>

                <h3
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  {log.title}
                </h3>

                <p
                  style={{
                    margin: "7px 0 10px",
                    fontSize: 13,
                    color: "var(--patch-muted)",
                    lineHeight: 1.5,
                  }}
                >
                  {log.description}
                </p>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 16,
                    fontSize: 12,
                    color: "var(--patch-muted)",
                  }}
                >
                  <span>
                    Equipment:{" "}
                    <strong style={{ color: "var(--patch-text)" }}>
                      {log.equipment}
                    </strong>
                  </span>

                  <span>
                    Technician:{" "}
                    <strong style={{ color: "var(--patch-text)" }}>
                      {log.technician}
                    </strong>
                  </span>

                  <span>
                    {log.date}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {log.status !== "Resolved" && (
                  <Button
                    variant="secondary"
                    onClick={() => resolveLog(log.id)}
                  >
                    <CheckCircle2 size={14} />
                    Resolve
                  </Button>
                )}

                <Button variant="secondary">
                  View
                </Button>
              </div>
            </div>
          </div>
        ))}

        {visibleLogs.length === 0 && (
          <EmptyState
            title="No maintenance logs"
            description="There are no logs matching this filter."
          />
        )}
      </div>

      {showForm && (
        <Modal
          title="New maintenance log"
          onClose={() => setShowForm(false)}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <label style={labelStyle}>
              Title
              <input
                name="title"
                placeholder="Describe the maintenance issue"
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Equipment
              <select
                name="equipment"
                style={inputStyle}
              >
                {PROJECT.equipments.map((equipment) => (
                  <option key={equipment.id}>
                    {equipment.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              Description
              <textarea
                name="description"
                placeholder="Describe what happened..."
                rows={5}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                }}
              />
            </label>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <Button
                variant="secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>

              <Button
                onClick={() => {
                  setShowForm(false);
                  toast.success(
                    "Maintenance log saved.",
                  );
                }}
              >
                Save log
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* =========================================================
   PROCEDURES
   ========================================================= */

function ProceduresTab() {
  const [procedures, setProcedures] =
    useState(PROCEDURES);

  function publishProcedure(id: string) {
    setProcedures((current) =>
      current.map((procedure) =>
        procedure.id === id
          ? {
              ...procedure,
              status: "Published" as ProcedureStatus,
              version:
                procedure.version === "Draft"
                  ? "v1.0"
                  : procedure.version,
            }
          : procedure,
      ),
    );
  }

  return (
    <div style={{ paddingTop: 20 }}>
      <PageIntro
        title="Procedures"
        description="Review, edit, approve, and publish project-specific maintenance procedures."
        count={`${procedures.length} procedures`}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 24,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            color: "var(--patch-muted)",
            fontSize: 13,
          }}
        >
          <span>
            {procedures.filter(
              (p) => p.status === "Published",
            ).length}{" "}
            published
          </span>

          <span>•</span>

          <span>
            {procedures.filter(
              (p) => p.status !== "Published",
            ).length}{" "}
            need review
          </span>
        </div>

        <Button>
          <Plus size={15} />
          Generate procedure
        </Button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(2, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        {procedures.map((procedure) => (
          <div
            key={procedure.id}
            className="overview-panel"
            style={{
              padding: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    color: "var(--patch-muted)",
                    fontSize: 12,
                    marginBottom: 6,
                  }}
                >
                  {procedure.id}
                </div>

                <h3
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                >
                  {procedure.title}
                </h3>
              </div>

              <StatusBadge
                tone={
                  procedure.status === "Published"
                    ? "success"
                    : procedure.status ===
                        "Needs changes"
                      ? "attention"
                      : "info"
                }
              >
                {procedure.status}
              </StatusBadge>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(3, 1fr)",
                gap: 10,
                marginTop: 18,
                paddingTop: 14,
                borderTop:
                  "1px solid var(--patch-boundary)",
              }}
            >
              <MiniStat
                label="Version"
                value={procedure.version}
              />

              <MiniStat
                label="Steps"
                value={String(procedure.steps)}
              />

              <MiniStat
                label="Evidence"
                value={String(procedure.evidence)}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 16,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "var(--patch-muted)",
                }}
              >
                Owner: {procedure.owner}
                <br />
                Updated: {procedure.updated}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                }}
              >
                <Button variant="secondary">
                  Edit
                </Button>

                {procedure.status !== "Published" && (
                  <Button
                    onClick={() =>
                      publishProcedure(procedure.id)
                    }
                  >
                    Publish
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 20,
          padding: 15,
          border:
            "1px solid rgba(245,158,11,.35)",
          background: "rgba(245,158,11,.06)",
          borderRadius: 8,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--patch-muted)",
        }}
      >
        <AlertTriangle
          size={17}
          color="var(--patch-warning)"
          style={{ flexShrink: 0 }}
        />

        <span>
          AI-generated procedure content requires human
          review before publication. P.A.T.C.H. does not
          automatically approve or publish safety
          procedures.
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   MEMBERS
   ========================================================= */

function MembersTab() {
  return (
    <div style={{ paddingTop: 20 }}>
      <PageIntro
        title="Project members"
        description="People who have access to this project."
        count={`${PROJECT.members.length} members`}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 20,
          marginBottom: 14,
        }}
      >
        <Button>
          <UserPlus size={15} />
          Add member
        </Button>
      </div>

      <div className="overview-panel" style={{ padding: 0 }}>
        {PROJECT.members.map((member) => (
          <div
            key={member.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 18px",
              borderBottom:
                "1px solid var(--patch-boundary)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background:
                    "var(--patch-surface-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--patch-muted)",
                }}
              >
                <Users size={18} />
              </div>

              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {member.name}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: "var(--patch-muted)",
                    marginTop: 3,
                  }}
                >
                  {member.role} · {member.team}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <StatusBadge tone="success">
                {member.status}
              </StatusBadge>

              <button
                type="button"
                className="icon-button"
                aria-label={`Actions for ${member.name}`}
              >
                <MoreHorizontal size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   ACTIVITY
   ========================================================= */

function ActivityTab() {
  return (
    <div style={{ paddingTop: 20 }}>
      <PageIntro
        title="Activity"
        description="Recent project actions and audit history."
        count="Recent activity"
      />

      <div
        className="overview-panel"
        style={{
          marginTop: 20,
          padding: 0,
        }}
      >
        {ACTIVITIES.map((activity) => {
          const Icon = activity.icon;

          return (
            <div
              key={activity.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                padding: 18,
                borderBottom:
                  "1px solid var(--patch-boundary)",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background:
                    "var(--patch-surface-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--patch-accent)",
                  flexShrink: 0,
                }}
              >
                <Icon size={17} />
              </div>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  <strong>{activity.actor}</strong>{" "}
                  {activity.action}{" "}
                  <strong>{activity.target}</strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    marginTop: 5,
                    fontSize: 12,
                    color: "var(--patch-muted)",
                  }}
                >
                  <Clock3 size={12} />
                  {activity.time}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   SHARED COMPONENTS
   ========================================================= */

function PageIntro({
  title,
  description,
  count,
}: {
  title: string;
  description: string;
  count?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 20,
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 21,
            fontWeight: 650,
          }}
        >
          {title}
        </h1>

        <p
          style={{
            margin: "7px 0 0",
            color: "var(--patch-muted)",
            fontSize: 14,
          }}
        >
          {description}
        </p>
      </div>

      {count && (
        <div
          style={{
            color: "var(--patch-accent)",
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {count}
        </div>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 15,
        fontSize: 14,
      }}
    >
      <span style={{ color: "var(--patch-muted)" }}>
        {label}
      </span>

      <span
        style={{
          fontWeight: strong ? 600 : 500,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        border:
          "1px solid var(--patch-boundary)",
        background:
          "var(--patch-surface-muted)",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div
        style={{
          color: "var(--patch-muted)",
          fontSize: 12,
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 24,
          lineHeight: 1,
          fontWeight: 650,
          color: color || "var(--patch-text)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: "var(--patch-muted)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        padding: 50,
        textAlign: "center",
        color: "var(--patch-muted)",
      }}
    >
      <FileText
        size={30}
        style={{ opacity: 0.5 }}
      />

      <h3
        style={{
          margin: "12px 0 5px",
          color: "var(--patch-text)",
          fontSize: 15,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: 0,
          fontSize: 13,
        }}
      >
        {description}
      </p>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "var(--patch-surface)",
          border:
            "1px solid var(--patch-boundary)",
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 18px",
            borderBottom:
              "1px solid var(--patch-boundary)",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 600,
            }}
          >
            {title}
          </h2>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <XCircle size={18} />
          </button>
        </div>

        <div style={{ padding: 18 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   STYLES
   ========================================================= */

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 42,
  borderRadius: 7,
  border: "1px solid var(--patch-boundary)",
  background: "var(--patch-surface-muted)",
  color: "var(--patch-text)",
  padding: "0 14px 0 42px",
  outline: "none",
  fontSize: 13,
};

const mutedTextStyle: React.CSSProperties = {
  color: "var(--patch-muted)",
  fontSize: 13,
};

const equipmentIconStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 7,
  background: "var(--patch-surface-muted)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--patch-muted)",
};

const tableHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "2fr 1.1fr 1fr 1fr 30px",
  gap: 15,
  padding: "14px 18px",
  borderBottom:
    "1px solid var(--patch-boundary)",
  color: "var(--patch-muted)",
  fontSize: 11,
  fontWeight: 700,
};

const tableRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "2fr 1.1fr 1fr 1fr 30px",
  gap: 15,
  alignItems: "center",
  padding: "16px 18px",
  borderBottom:
    "1px solid var(--patch-boundary)",
  color: "inherit",
  textDecoration: "none",
};

const documentHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "2.2fr 1fr .8fr 1fr .8fr 1fr .6fr",
  gap: 14,
  padding: "14px 18px",
  borderBottom:
    "1px solid var(--patch-boundary)",
  color: "var(--patch-muted)",
  fontSize: 11,
  fontWeight: 700,
};

const documentRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "2.2fr 1fr .8fr 1fr .8fr 1fr .6fr",
  gap: 14,
  alignItems: "center",
  padding: "17px 18px",
  borderBottom:
    "1px solid var(--patch-boundary)",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
  color: "var(--patch-muted)",
  fontSize: 13,
  fontWeight: 500,
};