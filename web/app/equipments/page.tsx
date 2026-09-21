"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  CircleCheck,
  TriangleAlert,
  Clock3,
  CircleX,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui";
import { getEquipments } from "@/lib/api/equipments";
import type {
  Equipment,
  EquipmentStatus,
} from "@/lib/types/equipment";

const statuses: Array<EquipmentStatus | "ALL"> = [
  "ALL",
  "ACTIVE",
  "WARNING",
  "MAINTENANCE",
  "INACTIVE",
];

export default function EquipmentsPage() {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] =
    useState<EquipmentStatus | "ALL">("ALL");
  const [type, setType] = useState("ALL");
  const [location, setLocation] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const result = await getEquipments();

        if (!cancelled) {
          setEquipments(result);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load equipments.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const types = useMemo(() => {
    return [
      "ALL",
      ...Array.from(
        new Set(equipments.map((equipment) => equipment.type)),
      ),
    ];
  }, [equipments]);

  const locations = useMemo(() => {
    return [
      "ALL",
      ...Array.from(
        new Set(
          equipments.map((equipment) => equipment.location),
        ),
      ),
    ];
  }, [equipments]);

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return equipments.filter((equipment) => {
      const matchesSearch =
        !normalized ||
        equipment.name.toLowerCase().includes(normalized) ||
        equipment.type.toLowerCase().includes(normalized) ||
        equipment.location.toLowerCase().includes(normalized);

      const matchesStatus =
        status === "ALL" ||
        equipment.status === status;

      const matchesType =
        type === "ALL" ||
        equipment.type === type;

      const matchesLocation =
        location === "ALL" ||
        equipment.location === location;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesLocation
      );
    });
  }, [
    equipments,
    search,
    status,
    type,
    location,
  ]);

  return (
    <AppShell
      title="Equipments"
      actions={
        <Link href="/equipments/new">
          <Button icon={<Plus size={17} />}>
            Create Equipment
          </Button>
        </Link>
      }
    >
      <div className="equipment-directory">
        <section className="equipment-directory-toolbar">
          <div className="equipment-search">
            <Search
              size={17}
              aria-hidden="true"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search equipments..."
              aria-label="Search equipments"
            />
          </div>

          <select
            value={type}
            onChange={(event) =>
              setType(event.target.value)
            }
            aria-label="Filter by equipment type"
            className="equipment-filter-select"
          >
            {types.map((item) => (
              <option key={item} value={item}>
                {item === "ALL" ? "All types" : item}
              </option>
            ))}
          </select>

          <select
            value={location}
            onChange={(event) =>
              setLocation(event.target.value)
            }
            aria-label="Filter by location"
            className="equipment-filter-select"
          >
            {locations.map((item) => (
              <option key={item} value={item}>
                {item === "ALL"
                  ? "All locations"
                  : item}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(event) =>
              setStatus(
                event.target.value as
                  | EquipmentStatus
                  | "ALL",
              )
            }
            aria-label="Filter by status"
            className="equipment-filter-select"
          >
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item === "ALL"
                  ? "All status"
                  : formatStatus(item)}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="equipment-filter-button"
          >
            <Filter size={16} />
            Filters
          </button>
        </section>

        {loading ? (
          <section className="equipment-table-shell">
            <div className="equipment-table-loading">
              Loading equipments...
            </div>
          </section>
        ) : error ? (
          <section className="equipment-table-shell">
            <div className="equipment-table-empty">
              <WrenchIcon />

              <h2>Unable to load equipments</h2>

              <p>{error}</p>

              <Button
                type="button"
                onClick={() =>
                  window.location.reload()
                }
              >
                Try again
              </Button>
            </div>
          </section>
        ) : filtered.length === 0 ? (
          <section className="equipment-table-shell">
            <div className="equipment-table-empty">
              <Search size={30} />

              <h2>No equipments found</h2>

              <p>
                Try another search or filter.
              </p>

              <Link href="/equipments/new">
                <Button
                  icon={<Plus size={17} />}
                >
                  Create Equipment
                </Button>
              </Link>
            </div>
          </section>
        ) : (
          <EquipmentDirectoryTable
            equipments={filtered}
          />
        )}
      </div>
    </AppShell>
  );
}

function EquipmentDirectoryTable({
  equipments,
}: {
  equipments: Equipment[];
}) {
  const [openMenuId, setOpenMenuId] =
    useState<string | null>(null);

  return (
    <section className="equipment-table-shell">
      <div className="equipment-table-scroll">
        <table className="equipment-table">
          <thead>
            <tr>
              <th className="equipment-name-column">
                <span className="sortable-header">
                  Name
                  <ChevronUp size={14} />
                </span>
              </th>

              <th>Type</th>

              <th>Location</th>

              <th>Status</th>

              <th>Documents</th>

              <th>Profile</th>

              <th
                className="equipment-actions-column"
                aria-label="Actions"
              />
            </tr>
          </thead>

          <tbody>
            {equipments.map((equipment) => (
              <EquipmentRow
                key={equipment.id}
                equipment={equipment}
                menuOpen={
                  openMenuId === equipment.id
                }
                onToggleMenu={() =>
                  setOpenMenuId((current) =>
                    current === equipment.id
                      ? null
                      : equipment.id,
                  )
                }
                onCloseMenu={() =>
                  setOpenMenuId(null)
                }
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="equipment-table-footer">
        <span>
          1–{equipments.length} of{" "}
          {equipments.length}
        </span>

        <div className="equipment-pagination">
          <button
            type="button"
            disabled
            aria-label="Previous page"
          >
            <ChevronLeft size={17} />
          </button>

          <button
            type="button"
            className="active"
          >
            1
          </button>

          <button type="button">
            2
          </button>

          <button type="button">
            3
          </button>

          <span>...</span>

          <button type="button">
            16
          </button>

          <button
            type="button"
            aria-label="Next page"
          >
            <ChevronRight size={17} />
          </button>

          <select
            defaultValue="10"
            aria-label="Rows per page"
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
  );
}

function EquipmentRow({
  equipment,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
}: {
  equipment: Equipment;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
}) {
  return (
    <tr>
      <td>
        <Link
          href={`/equipments/${equipment.id}`}
          className="equipment-name-link"
        >
          <span className="equipment-row-icon">
            <EquipmentIcon
              type={equipment.type}
            />
          </span>

          <span>
            <strong>
              {equipment.name}
            </strong>

            <small>
              {getEquipmentIdentifier(
                equipment,
              )}
            </small>
          </span>
        </Link>
      </td>

      <td>
        {equipment.type}
      </td>

      <td>
        {equipment.location}
      </td>

      <td>
        <StatusBadge
          status={equipment.status}
        />
      </td>

      <td>
        <DocumentStatus
          equipment={equipment}
        />
      </td>

      <td>
        <ProfileStatus
          equipment={equipment}
        />
      </td>

      <td>
        <div className="equipment-row-menu-wrap">
          <button
            type="button"
            className="equipment-row-menu"
            aria-label={`Actions for ${equipment.name}`}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={onToggleMenu}
          >
            <MoreHorizontal size={18} />
          </button>

          {menuOpen ? (
            <>
              <button
                type="button"
                className="equipment-menu-backdrop"
                aria-label="Close actions menu"
                onClick={onCloseMenu}
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    "Escape"
                  ) {
                    onCloseMenu();
                  }
                }}
              />

              <div
                className="equipment-row-dropdown"
                role="menu"
                aria-label={`Actions for ${equipment.name}`}
              >
                <Link
                  href={`/equipments/${equipment.id}`}
                  role="menuitem"
                  onClick={onCloseMenu}
                >
                  View details
                </Link>

                <Link
                  href={`/equipments/${equipment.id}/documents`}
                  role="menuitem"
                  onClick={onCloseMenu}
                >
                  Manage documents
                </Link>

                <Link
                  href={`/equipments/${equipment.id}?tab=activity`}
                  role="menuitem"
                  onClick={onCloseMenu}
                >
                  View activity
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({
  status,
}: {
  status: EquipmentStatus;
}) {
  if (status === "WARNING") {
    return (
      <span className="equipment-status-badge warning">
        <TriangleAlert size={14} />
        Warning
      </span>
    );
  }

  if (status === "MAINTENANCE") {
    return (
      <span className="equipment-status-badge maintenance">
        <Clock3 size={14} />
        Maintenance
      </span>
    );
  }

  if (status === "INACTIVE") {
    return (
      <span className="equipment-status-badge inactive">
        <CircleX size={14} />
        Inactive
      </span>
    );
  }

  return (
    <span className="equipment-status-badge healthy">
      <CircleCheck size={14} />
      Healthy
    </span>
  );
}

function DocumentStatus({
  equipment,
}: {
  equipment: Equipment;
}) {
  const documentCount =
    "documentCount" in equipment
      ? Number(
          (equipment as Equipment & {
            documentCount?: number;
          }).documentCount ?? 0,
        )
      : 0;

  if (documentCount === 0) {
    return (
      <span className="equipment-meta-status neutral">
        <Clock3 size={14} />
        No documents
      </span>
    );
  }

  return (
    <span className="equipment-meta-status success">
      <CircleCheck size={14} />
      Up to date
    </span>
  );
}

function ProfileStatus({
  equipment,
}: {
  equipment: Equipment;
}) {
  const profileStatus =
    "profileStatus" in equipment
      ? (
          equipment as Equipment & {
            profileStatus?: string;
          }
        ).profileStatus
      : undefined;

  if (
    profileStatus === "STALE" ||
    profileStatus === "stale"
  ) {
    return (
      <span className="equipment-meta-status warning">
        <Clock3 size={14} />
        Profile stale
      </span>
    );
  }

  return (
    <span className="equipment-meta-status success">
      <CircleCheck size={14} />
      Up to date
    </span>
  );
}

function EquipmentIcon({
  type,
}: {
  type: string;
}) {
  return (
    <span className="equipment-type-icon">
      <WrenchIcon />
    </span>
  );
}

function WrenchIcon() {
  return <CircleCheck size={22} />;
}

function getEquipmentIdentifier(
  equipment: Equipment,
) {
  if ("serialNumber" in equipment) {
    const serialNumber = (
      equipment as Equipment & {
        serialNumber?: string;
      }
    ).serialNumber;

    if (serialNumber) {
      return serialNumber;
    }
  }

  return equipment.id;
}

function formatStatus(
  status: EquipmentStatus,
) {
  return (
    status.charAt(0) +
    status.slice(1).toLowerCase()
  );
}