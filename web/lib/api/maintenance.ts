import type {
  CreateMaintenanceLogInput,
  MaintenanceLog,
  UpdateMaintenanceLogInput,
} from "@/lib/types/maintenance";

import {
  mockCreateMaintenanceLog,
  mockGetEquipmentMaintenanceLogs,
  mockGetMaintenanceLog,
  mockGetMaintenanceLogs,
  mockUpdateMaintenanceLog,
} from "@/lib/mockapi/maintenance";

/**
 * Maintenance-log service boundary.
 *
 * UI code consumes these functions. A future real backend replaces
 * the mock implementation inside this module without touching pages
 * or components.
 */

export async function getMaintenanceLogs(
  projectId: string,
): Promise<MaintenanceLog[]> {
  return mockGetMaintenanceLogs(projectId);
}

export async function getMaintenanceLog(
  logId: string,
): Promise<MaintenanceLog | null> {
  return mockGetMaintenanceLog(logId);
}

export async function getEquipmentMaintenanceLogs(
  equipmentId: string,
): Promise<MaintenanceLog[]> {
  return mockGetEquipmentMaintenanceLogs(
    equipmentId,
  );
}

export async function createMaintenanceLog(
  input: CreateMaintenanceLogInput,
): Promise<MaintenanceLog> {
  return mockCreateMaintenanceLog(input);
}

export async function updateMaintenanceLog(
  logId: string,
  input: UpdateMaintenanceLogInput,
): Promise<MaintenanceLog | null> {
  return mockUpdateMaintenanceLog(
    logId,
    input,
  );
}
