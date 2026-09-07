"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Filter, Plus, Search, Wrench } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui";
import { StatusBadge } from "@/components/ui";

/* ── hardcoded Equipment rows ─────────────────────────────── */
type EquipRow = {
  id: string;
  name: string;
  type: string;
  location: string;
  status: "Healthy" | "Warning";
  documents: "Up to date" | "Expiring soon" | "Out of date";
  profile: "Up to date" | "Stale";
};

const EQUIPMENTS: EquipRow[] = [
  { id: "eq-1", name: "Centrifugal Pump P-101", type: "Centrifugal Pump", location: "Utility Room",     status: "Healthy",  documents: "Up to date",   profile: "Up to date" },
  { id: "eq-2", name: "Boiler B-201",           type: "Boiler",           location: "Boiler House",     status: "Warning",  documents: "Expiring soon", profile: "Up to date" },
  { id: "eq-3", name: "Filler O2",              type: "Filler",           location: "Packaging Line 1", status: "Healthy",  documents: "Up to date",   profile: "Up to date" },
  { id: "eq-4", name: "Conveyor 11",            type: "Conveyor",         location: "Packaging Line 1", status: "Healthy",  documents: "Up to date",   profile: "Up to date" },
  { id: "eq-5", name: "Capper 04",              type: "Capper",           location: "Packaging Line 1", status: "Warning",  documents: "Out of date",  profile: "Up to date" },
  { id: "eq-6", name: "Labeler 01",             type: "Labeler",          location: "Packaging Line 1", status: "Healthy",  documents: "Up to date",   profile: "Up to date" },
  { id: "eq-7", name: "Compressor C-301",       type: "Compressor",       location: "Utility Room",     status: "Healthy",  documents: "Up to date",   profile: "Up to date" },
  { id: "eq-8", name: "Cooling Tower CT-01",    type: "Cooling Tower",    location: "Roof",             status: "Healthy",  documents: "Up to date",   profile: "Up to date" },
];

function docTone(val: EquipRow["documents"]): "success" | "attention" | "danger" {
  if (val === "Up to date") return "success";
  if (val === "Expiring soon") return "attention";
  return "danger";
}

export default function EquipmentsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [locationFilter, setLocationFilter] = useState("All locations");
  const [statusFilter, setStatusFilter] = useState("All status");

  const filtered = EQUIPMENTS.filter((e) => {
    const q = search.toLowerCase();
    return (
      (typeFilter === "All types" || e.type === typeFilter) &&
      (locationFilter === "All locations" || e.location === locationFilter) &&
      (statusFilter === "All status" || e.status === statusFilter) &&
      (q === "" || e.name.toLowerCase().includes(q) || e.type.toLowerCase().includes(q))
    );
  });

  const types = ["All types", ...Array.from(new Set(EQUIPMENTS.map((e) => e.type)))];
  const locations = ["All locations", ...Array.from(new Set(EQUIPMENTS.map((e) => e.location)))];

  return (
    <AppShell
      title="Equipments"
      actions={
        <Link href="/equipments/new">
          <Button icon={<Plus size={16} />}>Create equipment</Button>
        </Link>
      }
    >
      <div style={{ display: "grid", gap: 16, maxWidth: 1200 }}>
        {/* Filter bar */}
        <div className="filter-bar">
          <label className="search-field" htmlFor="equip-search">
            <Search size={16} color="var(--patch-muted)" />
            <input
              id="equip-search"
              type="search"
              placeholder="Search equipments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <FilterDropdown
            label={typeFilter}
            options={types}
            onSelect={setTypeFilter}
          />
          <FilterDropdown
            label={locationFilter}
            options={locations}
            onSelect={setLocationFilter}
          />
          <FilterDropdown
            label={statusFilter}
            options={["All status", "Healthy", "Warning"]}
            onSelect={setStatusFilter}
          />
          <button className="filter-select" type="button">
            <Filter size={15} />
            Filters
          </button>
        </div>

        {/* Table */}
        <div className="directory-panel">
          <div className="table-scroll">
            <table className="data-table" aria-label="Equipments directory">
              <thead>
                <tr>
                  <th scope="col">Name ↕</th>
                  <th scope="col">Type</th>
                  <th scope="col">Location</th>
                  <th scope="col">Status</th>
                  <th scope="col">Documents</th>
                  <th scope="col">Profile</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td className="table-empty" colSpan={7}>
                      No equipments match the current filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((eq) => (
                    <tr key={eq.id}>
                      <td>
                        <Link className="table-name-cell" href={`/equipments/${eq.id}`}>
                          <span className="equip-icon-cell" aria-hidden="true">
                            <Wrench size={16} strokeWidth={1.7} />
                          </span>
                          {eq.name}
                        </Link>
                      </td>
                      <td style={{ color: "var(--patch-muted)", fontSize: 14 }}>{eq.type}</td>
                      <td style={{ color: "var(--patch-muted)", fontSize: 14 }}>{eq.location}</td>
                      <td>
                        <StatusBadge tone={eq.status === "Healthy" ? "success" : "attention"}>
                          {eq.status}
                        </StatusBadge>
                      </td>
                      <td>
                        <StatusBadge tone={docTone(eq.documents)}>{eq.documents}</StatusBadge>
                      </td>
                      <td>
                        <StatusBadge tone={eq.profile === "Up to date" ? "success" : "attention"}>
                          {eq.profile}
                        </StatusBadge>
                      </td>
                      <td>
                        <button
                          className="row-overflow-btn"
                          type="button"
                          aria-label={`More actions for ${eq.name}`}
                        >
                          ···
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination-bar">
            <span>1–{filtered.length} of 128</span>
            <div className="pagination-controls" role="navigation" aria-label="Pagination">
              <button className="page-btn" type="button" disabled aria-label="Previous page">‹</button>
              <button className="page-btn page-btn-active" type="button" aria-current="page">1</button>
              <button className="page-btn" type="button">2</button>
              <button className="page-btn" type="button">3</button>
              <span style={{ padding: "0 4px", color: "var(--patch-muted)" }}>…</span>
              <button className="page-btn" type="button">16</button>
              <button className="page-btn" type="button" aria-label="Next page">›</button>
            </div>
            <button className="page-size-select" type="button">
              10 / page <ChevronDown size={13} />
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function FilterDropdown({
  label,
  options,
  onSelect,
}: {
  label: string;
  options: string[];
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        className="filter-select"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {label} <ChevronDown size={13} />
      </button>
      {open && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 20,
            minWidth: 180,
            background: "var(--patch-surface)",
            border: "1px solid var(--patch-boundary)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: "4px 0",
            listStyle: "none",
            margin: 0,
          }}
        >
          {options.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                role="option"
                aria-selected={label === opt}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 14px",
                  border: 0,
                  background: label === opt ? "color-mix(in srgb, var(--patch-accent) 8%, var(--patch-surface))" : "transparent",
                  color: "var(--patch-text)",
                  textAlign: "left",
                  fontSize: 14,
                  cursor: "pointer",
                }}
                onClick={() => { onSelect(opt); setOpen(false); }}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}