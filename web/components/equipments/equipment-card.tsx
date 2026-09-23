import Link from "next/link";
import {
  ArrowRight,
  FileText,
  FolderKanban,
  MapPin,
  Wrench,
} from "lucide-react";

import type {
  Equipment,
  EquipmentStatus,
} from "@/lib/types/equipment";
import { StatusBadge } from "@/components/ui";

const statusConfig: Record<
  EquipmentStatus,
  {
    label: string;
    tone:
      | "success"
      | "attention"
      | "neutral";
  }
> = {
  ACTIVE: {
    label: "Active",
    tone: "success",
  },
  WARNING: {
    label: "Warning",
    tone: "attention",
  },
  INACTIVE: {
    label: "Inactive",
    tone: "neutral",
  },
  MAINTENANCE: {
    label: "Maintenance",
    tone: "attention",
  },
};

export function EquipmentCard({
  equipment,
}: {
  equipment: Equipment;
}) {
  const status =
    statusConfig[equipment.status];

  return (
    <Link
      href={`/equipments/${equipment.id}`}
      className="equipment-card"
    >
      <div className="equipment-card-header">
        <div className="equipment-card-icon">
          <Wrench size={20} />
        </div>

        <StatusBadge tone={status.tone}>
          {status.label}
        </StatusBadge>
      </div>

      <div className="equipment-card-body">
        <p className="equipment-type">
          {equipment.type}
        </p>

        <h2>{equipment.name}</h2>

        <p className="equipment-description">
          {equipment.description}
        </p>

        <div className="equipment-location">
          <MapPin size={15} />
          {equipment.location}
        </div>
      </div>

      <div className="equipment-card-footer">
        <span>
          <FileText size={15} />
          {equipment.documentsCount} documents
        </span>

        <span>
          <FolderKanban size={15} />
          {equipment.projectsCount} projects
        </span>

        <ArrowRight
          size={17}
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}