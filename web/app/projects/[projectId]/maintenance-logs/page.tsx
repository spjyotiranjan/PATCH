"use client";

import { use, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  MoreHorizontal,
  Plus,
  Search,
  UploadCloud,
  User,
  X,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button, StatusBadge, Tabs } from "@/components/ui";
import { toast } from "sonner";

interface MaintenanceLog {
  id: string;
  title: string;
  status: "Submitted" | "Draft";
  scopeType: "Overall Project" | "Specific Equipment";
  equipmentName?: string;
  timestamp: string;
  author: string;
  description: string;
  evidence?: string;
  attachmentsCount: number;
}

const INITIAL_LOGS: MaintenanceLog[] = [
  {
    id: "log-1",
    title: "Boiler annual inspection",
    status: "Submitted",
    scopeType: "Specific Equipment",
    equipmentName: "Boiler B-201",
    timestamp: "May 13, 2025 10:15 AM",
    author: "John Smith",
    description:
      "Completed visual internal inspection, refractory lining check, and safety relief valve tag verification. No thermal cracking observed along welds.",
    evidence: "P-101 Maintenance Manual · Rev 2",
    attachmentsCount: 2,
  },
  {
    id: "log-2",
    title: "Safety valve test",
    status: "Draft",
    scopeType: "Overall Project",
    timestamp: "May 12, 2025 2:30 PM",
    author: "Sarah Johnson",
    description:
      "Pop test and reseat pressure verified on steam header isolation valves. Calibration seals intact. Awaiting final torque sign-off.",
    evidence: "Facility Safety Standard 2024",
    attachmentsCount: 1,
  },
  {
    id: "log-3",
    title: "Feed pump vibration check",
    status: "Submitted",
    scopeType: "Specific Equipment",
    equipmentName: "Boiler Feed Pump P-101",
    timestamp: "May 11, 2025 9:05 AM",
    author: "Mike Davis",
    description:
      "Measured overall vibration at DE and NDE bearings. Radial RMS was 3.8 mm/s, well within 4.5 mm/s acceptable limit.",
    evidence: "Pump Vibration Survey · Rev 1",
    attachmentsCount: 3,
  },
  {
    id: "log-4",
    title: "Water chemistry analysis",
    status: "Draft",
    scopeType: "Overall Project",
    timestamp: "May 10, 2025 4:45 PM",
    author: "Emily Wilson",
    description:
      "TDS and phosphate levels recorded in feed tank. Conductivity within normal operating envelope of 1500–2000 µS/cm.",
    attachmentsCount: 0,
  },
  {
    id: "log-5",
    title: "Burner performance check",
    status: "Submitted",
    scopeType: "Overall Project",
    timestamp: "May 9, 2025 11:20 AM",
    author: "David Brown",
    description:
      "Flame detector scanner aligned. High-fire O2 trim verified at 3.2%. Turndown ratio smoothly maintained across modulation curve.",
    evidence: "Burner Technical Manual · Rev 3",
    attachmentsCount: 1,
  },
  {
    id: "log-6",
    title: "Feedwater tank inspection",
    status: "Submitted",
    scopeType: "Specific Equipment",
    equipmentName: "Feedwater Tank T-101",
    timestamp: "May 8, 2025 1:40 PM",
    author: "Alex Chen",
    description:
      "Completed external inspection of feedwater tank including connections, valves, gauges and visible surfaces.",
    evidence: "Tank Inspection Procedure · Rev 2",
    attachmentsCount: 2,
  },
  {
    id: "log-7",
    title: "Economizer inspection",
    status: "Draft",
    scopeType: "Specific Equipment",
    equipmentName: "Economizer E-101",
    timestamp: "May 7, 2025 9:20 AM",
    author: "Alex Chen",
    description:
      "Initial inspection completed. Final findings and photographs still need to be attached.",
    attachmentsCount: 0,
  },
];

const PROJECT_EQUIPMENTS = [
  "Boiler B-201",
  "Boiler Feed Pump P-101",
  "Economizer E-101",
  "Feedwater Tank T-101",
];

const EVIDENCE_OPTIONS = [
  "P-101 Maintenance Manual · Rev 2",
  "Pump Vibration Survey · Rev 1",
  "Facility Safety Standard 2024",
  "Burner Technical Manual · Rev 3",
  "Tank Inspection Procedure · Rev 2",
];

export default function MaintenanceLogsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();

  const [logs, setLogs] = useState<MaintenanceLog[]>(INITIAL_LOGS);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(
    INITIAL_LOGS[0].id
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "All" | "Submitted" | "Draft"
  >("All");

  const [title, setTitle] = useState("");
  const [scopeType, setScopeType] = useState<
    "Overall Project" | "Specific Equipment"
  >("Specific Equipment");
  const [equipment, setEquipment] = useState(PROJECT_EQUIPMENTS[0]);
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedLog = useMemo(
    () => logs.find((log) => log.id === selectedLogId) ?? null,
    [logs, selectedLogId]
  );

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesSearch =
        !query ||
        log.title.toLowerCase().includes(query) ||
        log.description.toLowerCase().includes(query) ||
        log.author.toLowerCase().includes(query) ||
        log.equipmentName?.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All" || log.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [logs, search, statusFilter]);

  const submittedCount = logs.filter(
    (log) => log.status === "Submitted"
  ).length;

  const draftCount = logs.filter((log) => log.status === "Draft").length;

  const handleSelectLog = (log: MaintenanceLog) => {
    setSelectedLogId(log.id);
    setTitle(log.title);
    setScopeType(log.scopeType);
    setEquipment(log.equipmentName || PROJECT_EQUIPMENTS[0]);
    setDescription(log.description);
    setEvidence(log.evidence || "");
    setAttachments([]);
  };

  const handleNewLog = () => {
    setSelectedLogId(null);
    setTitle("");
    setScopeType("Specific Equipment");
    setEquipment(PROJECT_EQUIPMENTS[0]);
    setDescription("");
    setEvidence("");
    setAttachments([]);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    const selectedFiles = Array.from(files);

    const validFiles = selectedFiles.filter((file) => {
      const validType =
        file.type === "application/pdf" ||
        file.type === "image/jpeg" ||
        file.type === "image/png";

      const validSize = file.size <= 25 * 1024 * 1024;

      return validType && validSize;
    });

    setAttachments((current) => [...current, ...validFiles]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((current) => current.filter((_, i) => i !== index));
  };

  const showToast = (message: string) => {
    setSuccessToast(message);

    window.setTimeout(() => {
      setSuccessToast(null);
    }, 3500);
  };

  const handleSave = (status: "Submitted" | "Draft") => {
    if (!title.trim()) {
      toast.error("Please enter a log title.");
      return;
    }

    if (status === "Submitted" && !description.trim()) {
      toast.error(
        "Please enter a description before submitting the log.",
      );
      return;
    }

    const attachmentCount = attachments.length;

    if (selectedLogId) {
      setLogs((current) =>
        current.map((log) =>
          log.id === selectedLogId
            ? {
                ...log,
                title: title.trim(),
                status,
                scopeType,
                equipmentName:
                  scopeType === "Specific Equipment" ? equipment : undefined,
                description:
                  description.trim() || "No detailed notes provided.",
                evidence: evidence || undefined,
                attachmentsCount:
                  attachmentCount > 0
                    ? attachmentCount
                    : log.attachmentsCount,
              }
            : log
        )
      );

      showToast(
        `Log entry "${title.trim()}" updated as ${status.toLowerCase()}.`
      );

      return;
    }

    const newLog: MaintenanceLog = {
      id: `log-${Date.now()}`,
      title: title.trim(),
      status,
      scopeType,
      equipmentName:
        scopeType === "Specific Equipment" ? equipment : undefined,
      timestamp: "Just now",
      author: "Alex Chen",
      description:
        description.trim() || "No detailed notes provided.",
      evidence: evidence || undefined,
      attachmentsCount: attachmentCount,
    };

    setLogs((current) => [newLog, ...current]);
    setSelectedLogId(newLog.id);

    showToast(
      `Log entry "${newLog.title}" saved as ${status.toLowerCase()}.`
    );
  };

  const handleDelete = (id: string) => {
    const log = logs.find((item) => item.id === id);

    if (!log) return;

    const confirmed = window.confirm(
      `Delete "${log.title}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    const remainingLogs = logs.filter((item) => item.id !== id);

    setLogs(remainingLogs);

    if (selectedLogId === id) {
      const nextLog = remainingLogs[0];

      if (nextLog) {
        handleSelectLog(nextLog);
      } else {
        handleNewLog();
      }
    }

    showToast("Maintenance log deleted.");
  };

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      onSelect: () => router.push(`/projects/${projectId}?tab=overview`),
    },
    {
      id: "equipments",
      label: "Equipment",
      onSelect: () => router.push(`/projects/${projectId}?tab=equipments`),
    },
    {
      id: "documents",
      label: "Documents",
      onSelect: () =>
        router.push(`/projects/${projectId}/documents`),
    },
    {
      id: "maintenance-logs",
      label: "Maintenance logs",
      active: true,
      onSelect: () => {},
    },
    {
      id: "procedures",
      label: "Procedures",
      onSelect: () =>
        router.push(`/projects/${projectId}/procedures`),
    },
    {
      id: "members",
      label: "Members",
      onSelect: () => router.push(`/projects/${projectId}?tab=members`),
    },
    {
      id: "activity",
      label: "Activity",
      onSelect: () => router.push(`/projects/${projectId}?tab=activity`),
    },
  ];

  return (
    <AppShell
      title="Boiler Upgrade Project"
      status={<StatusBadge tone="success">In progress</StatusBadge>}
    >
      <Tabs label="Project sections" items={tabs} />

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 20,
          paddingTop: 24,
          paddingBottom: 20,
          borderBottom: "1px solid var(--patch-boundary)",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              color: "var(--patch-muted)",
              marginBottom: 6,
            }}
          >
            PRJ-2025-089
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            Maintenance logs
          </h1>

          <p
            style={{
              margin: "6px 0 0",
              color: "var(--patch-muted)",
              fontSize: 14,
            }}
          >
            Record, review, and manage maintenance activity for this project.
          </p>
        </div>

        <Button onClick={handleNewLog}>
          <Plus size={16} style={{ marginRight: 6 }} />
          New maintenance log
        </Button>
      </div>

      {/* Toast */}
      {successToast && (
        <div
          style={{
            marginTop: 16,
            padding: "11px 14px",
            background: "var(--patch-success-bg, #ecfdf5)",
            border: "1px solid var(--patch-success)",
            color: "var(--patch-success)",
            borderRadius: 7,
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <CheckCircle2 size={16} />
          {successToast}
        </div>
      )}

      {/* Summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 14,
          paddingTop: 20,
        }}
      >
        <div className="card" style={{ padding: 18 }}>
          <div
            style={{
              color: "var(--patch-muted)",
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            Total logs
          </div>

          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {logs.length}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div
            style={{
              color: "var(--patch-muted)",
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            Submitted
          </div>

          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--patch-success)",
            }}
          >
            {submittedCount}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div
            style={{
              color: "var(--patch-muted)",
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            Drafts
          </div>

          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--patch-attention)",
            }}
          >
            {draftCount}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div
            style={{
              color: "var(--patch-muted)",
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            Equipment covered
          </div>

          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {
              new Set(
                logs
                  .map((log) => log.equipmentName)
                  .filter(Boolean)
              ).size
            }
          </div>
        </div>
      </div>

      {/* Main workspace */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.15fr) minmax(380px, 0.85fr)",
          gap: 20,
          paddingTop: 20,
          alignItems: "start",
        }}
      >
        {/* LEFT */}
        <div
          className="card"
          style={{
            padding: 0,
            overflow: "hidden",
          }}
        >
          {/* Search/filter bar */}
          <div
            style={{
              padding: 16,
              borderBottom: "1px solid var(--patch-boundary)",
              display: "flex",
              gap: 10,
            }}
          >
            <div
              style={{
                position: "relative",
                flex: 1,
              }}
            >
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--patch-muted)",
                }}
              />

              <input
                type="search"
                placeholder="Search maintenance logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-select"
                style={{
                  width: "100%",
                  paddingLeft: 38,
                }}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "All" | "Submitted" | "Draft"
                )
              }
              className="form-select"
              style={{
                width: 145,
              }}
            >
              <option value="All">All status</option>
              <option value="Submitted">Submitted</option>
              <option value="Draft">Draft</option>
            </select>
          </div>

          {/* List header */}
          <div
            style={{
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              color: "var(--patch-muted)",
              fontSize: 12,
              borderBottom: "1px solid var(--patch-boundary)",
            }}
          >
            <span>
              Showing{" "}
              <strong style={{ color: "var(--patch-text)" }}>
                {filteredLogs.length}
              </strong>{" "}
              logs
            </span>

            <span>Most recent first</span>
          </div>

          {/* Log list */}
          <div>
            {filteredLogs.length === 0 ? (
              <div
                style={{
                  padding: 50,
                  textAlign: "center",
                  color: "var(--patch-muted)",
                }}
              >
                <FileText
                  size={30}
                  style={{ margin: "0 auto 12px" }}
                />

                <div
                  style={{
                    color: "var(--patch-text)",
                    fontWeight: 600,
                    marginBottom: 5,
                  }}
                >
                  No maintenance logs found
                </div>

                <div style={{ fontSize: 13 }}>
                  Try changing your search or filters.
                </div>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const selected = log.id === selectedLogId;

                return (
                  <div
                    key={log.id}
                    onClick={() => handleSelectLog(log)}
                    style={{
                      padding: 18,
                      cursor: "pointer",
                      borderBottom:
                        "1px solid var(--patch-boundary)",
                      background: selected
                        ? "var(--patch-surface-elevated)"
                        : "transparent",
                      borderLeft: selected
                        ? "3px solid var(--patch-accent)"
                        : "3px solid transparent",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 9,
                            marginBottom: 8,
                          }}
                        >
                          <h3
                            style={{
                              margin: 0,
                              fontSize: 15,
                              fontWeight: 650,
                            }}
                          >
                            {log.title}
                          </h3>

                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "3px 7px",
                              borderRadius: 999,
                              background:
                                log.status === "Submitted"
                                  ? "rgba(22, 163, 74, 0.12)"
                                  : "rgba(217, 119, 6, 0.12)",
                              color:
                                log.status === "Submitted"
                                  ? "var(--patch-success)"
                                  : "var(--patch-attention)",
                            }}
                          >
                            {log.status}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: 13,
                            color: "var(--patch-muted)",
                            marginBottom: 10,
                          }}
                        >
                          {log.description.length > 145
                            ? `${log.description.slice(0, 145)}...`
                            : log.description}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: 12,
                            fontSize: 11,
                            color: "var(--patch-muted)",
                          }}
                        >
                          <span>
                            Scope:{" "}
                            <strong
                              style={{
                                color: "var(--patch-text)",
                              }}
                            >
                              {log.equipmentName ||
                                "Overall Project"}
                            </strong>
                          </span>

                          <span>·</span>

                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Clock size={12} />
                            {log.timestamp}
                          </span>

                          <span>·</span>

                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <User size={12} />
                            {log.author}
                          </span>

                          {log.attachmentsCount > 0 && (
                            <>
                              <span>·</span>
                              <span>
                                {log.attachmentsCount} attachment
                                {log.attachmentsCount !== 1
                                  ? "s"
                                  : ""}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Log actions"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(log.id);
                        }}
                        style={{
                          flexShrink: 0,
                          width: 30,
                          height: 30,
                        }}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          <div
            style={{
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 12,
              color: "var(--patch-muted)",
            }}
          >
            <span>
              1–{filteredLogs.length} of {filteredLogs.length} logs
            </span>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <button
                className="icon-button"
                disabled
                style={{ width: 28, height: 28 }}
              >
                <ChevronLeft size={14} />
              </button>

              <span
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  background: "var(--patch-accent)",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                1
              </span>

              <button
                className="icon-button"
                disabled
                style={{ width: 28, height: 28 }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div
          className="card"
          style={{
            padding: 22,
            position: "sticky",
            top: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 650,
                }}
              >
                {selectedLog ? "Edit maintenance log" : "New maintenance log"}
              </h2>

              <p
                style={{
                  margin: "5px 0 0",
                  color: "var(--patch-muted)",
                  fontSize: 12,
                }}
              >
                Record the maintenance activity and supporting evidence.
              </p>
            </div>

            {selectedLog && (
              <button
                type="button"
                className="icon-button"
                aria-label="Create new log"
                onClick={handleNewLog}
              >
                <X size={17} />
              </button>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave("Submitted");
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 17,
            }}
          >
            {/* Title */}
            <div>
              <label
                htmlFor="maintenance-title"
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                Title{" "}
                <span style={{ color: "var(--patch-danger)" }}>
                  *
                </span>
              </label>

              <input
                id="maintenance-title"
                name="title"
                type="text"
                placeholder="e.g. Boiler annual inspection"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="form-select"
                style={{ width: "100%" }}
                required
              />
            </div>

            {/* Scope */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                Scope{" "}
                <span style={{ color: "var(--patch-danger)" }}>
                  *
                </span>
              </label>

              <div
                style={{
                  display: "flex",
                  gap: 18,
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="scope"
                    checked={scopeType === "Overall Project"}
                    onChange={() =>
                      setScopeType("Overall Project")
                    }
                  />
                  Overall Project
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="scope"
                    checked={scopeType === "Specific Equipment"}
                    onChange={() =>
                      setScopeType("Specific Equipment")
                    }
                  />
                  Specific Equipment
                </label>
              </div>
            </div>

            {/* Equipment */}
            {scopeType === "Specific Equipment" && (
              <div>
                <label
                  htmlFor="maintenance-equipment"
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Equipment{" "}
                  <span style={{ color: "var(--patch-danger)" }}>
                    *
                  </span>
                </label>

                <select
                  id="maintenance-equipment"
                  name="equipment"
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  className="form-select"
                  style={{ width: "100%" }}
                >
                  {PROJECT_EQUIPMENTS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Description */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <label
                  htmlFor="maintenance-description"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Description{" "}
                  <span style={{ color: "var(--patch-danger)" }}>
                    *
                  </span>
                </label>

                <span
                  style={{
                    fontSize: 11,
                    color: "var(--patch-muted)",
                  }}
                >
                  {description.length}/1000
                </span>
              </div>

              <textarea
                id="maintenance-description"
                name="description"
                placeholder="Describe the maintenance activity, findings, observations, and actions taken."
                rows={5}
                maxLength={1000}
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
                className="form-select"
                style={{
                  width: "100%",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
                required
              />
            </div>

            {/* Evidence */}
            <div>
              <label
                htmlFor="maintenance-evidence"
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                Evidence
              </label>

              <select
                id="maintenance-evidence"
                name="evidence"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                className="form-select"
                style={{ width: "100%" }}
              >
                <option value="">
                  Select evidence document (optional)
                </option>

                {EVIDENCE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            {/* Attachments */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 7,
                }}
              >
                Attachments
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                hidden
                onChange={(e) => handleFiles(e.target.files)}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFiles(e.dataTransfer.files);
                }}
                style={{
                  width: "100%",
                  border: "2px dashed var(--patch-boundary)",
                  borderRadius: 8,
                  padding: "22px 14px",
                  textAlign: "center",
                  background: "var(--patch-surface-muted)",
                  color: "var(--patch-text)",
                  cursor: "pointer",
                }}
              >
                <UploadCloud
                  size={26}
                  style={{
                    color: "var(--patch-muted)",
                    margin: "0 auto 8px",
                  }}
                />

                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  Drag and drop files here or click to browse
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: "var(--patch-muted)",
                    marginTop: 5,
                  }}
                >
                  PDF, JPG, PNG · up to 25 MB each
                </div>
              </button>

              {attachments.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    marginTop: 9,
                  }}
                >
                  {attachments.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: 6,
                        background:
                          "var(--patch-surface-muted)",
                        fontSize: 12,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          minWidth: 0,
                        }}
                      >
                        <FileText size={14} />

                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {file.name}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          removeAttachment(index)
                        }
                        style={{
                          border: 0,
                          background: "transparent",
                          color: "var(--patch-muted)",
                          cursor: "pointer",
                          padding: 2,
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                marginTop: 4,
                paddingTop: 15,
                borderTop:
                  "1px solid var(--patch-boundary)",
              }}
            >
              {selectedLogId ? (
                <button
                  type="button"
                  onClick={() => handleDelete(selectedLogId)}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "var(--patch-danger)",
                    cursor: "pointer",
                    fontSize: 12,
                    padding: 6,
                  }}
                >
                  Delete log
                </button>
              ) : (
                <span />
              )}

              <div
                style={{
                  display: "flex",
                  gap: 8,
                }}
              >
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleSave("Draft")}
                >
                  Save draft
                </Button>

                <Button type="submit">
                  <CheckCircle2
                    size={15}
                    style={{ marginRight: 6 }}
                  />
                  Submit log
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}