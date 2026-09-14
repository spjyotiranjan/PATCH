"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderOpen, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, StatusBadge } from "@/components/ui";

const MOCK_PROJECTS = [
  {
    id: "prj-1",
    name: "Cooling Water System Upgrade 2025",
    code: "PRJ-2025-089",
    status: "In Progress" as const,
    startDate: "Jan 15, 2025",
    targetCompletion: "Nov 30, 2025",
    associatedEquipmentCount: 2,
    directDocCount: 3,
    inheritedDocCount: 3,
  },
  {
    id: "prj-2",
    name: "Boiler Feedwater Line Overhaul",
    code: "PRJ-2024-042",
    status: "Completed" as const,
    startDate: "Jun 01, 2024",
    targetCompletion: "Dec 15, 2024",
    associatedEquipmentCount: 4,
    directDocCount: 8,
    inheritedDocCount: 6,
  },
];

export default function ProjectsPage() {
  const [search, setSearch] = useState("");

  const filteredProjects = MOCK_PROJECTS.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell title="Projects Directory">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ position: "relative", width: 320 }}>
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
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-select"
            style={{
              paddingLeft: 36,
              backgroundImage: "none",
              appearance: "auto",
              width: "100%",
            }}
          />
        </div>

        <Link href="/projects/new">
          <Button size="sm">
            <Plus size={14} style={{ marginRight: 6 }} /> Create New Project
          </Button>
        </Link>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Project Name &amp; Code</th>
              <th>Status</th>
              <th>Target Completion</th>
              <th>Associated Equipment</th>
              <th>Project Documents</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((prj) => (
              <tr key={prj.id}>
                <td>
                  <div>
                    <Link
                      href={`/projects/${prj.id}`}
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: "var(--patch-text)",
                        textDecoration: "none",
                      }}
                    >
                      {prj.name}
                    </Link>
                    <div style={{ fontSize: 12, color: "var(--patch-muted)" }}>{prj.code}</div>
                  </div>
                </td>
                <td>
                  <StatusBadge tone={prj.status === "In Progress" ? "info" : "success"}>
                    {prj.status}
                  </StatusBadge>
                </td>
                <td style={{ fontSize: 13, color: "var(--patch-muted)" }}>{prj.targetCompletion}</td>
                <td style={{ fontSize: 13 }}>{prj.associatedEquipmentCount} Assets</td>
                <td style={{ fontSize: 13 }}>
                  <strong>{prj.directDocCount} direct</strong> + {prj.inheritedDocCount} inherited
                </td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <Link href={`/projects/${prj.id}`}>
                      <Button variant="secondary" size="sm">Overview</Button>
                    </Link>
                    <Link href={`/projects/${prj.id}/documents`}>
                      <Button size="sm">Manage Docs</Button>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}