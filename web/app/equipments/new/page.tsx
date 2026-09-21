import { AppShell } from "@/components/app-shell";
import { EquipmentForm } from "@/components/equipments/equipment-form";

export default function NewEquipmentPage() {
  return (
    <AppShell title="Create Equipment">
      <EquipmentForm />
    </AppShell>
  );
}