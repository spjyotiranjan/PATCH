import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell";
import { DataTable, Drawer, Tabs } from "@/components/ui";

const mocks = vi.hoisted(() => ({
  status: "authenticated" as "authenticated" | "unauthenticated" | "loading",
  replace: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: mocks.status }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
  useRouter: () => ({ replace: mocks.replace }),
}));

describe("Phase 1 authenticated shell", () => {
  beforeEach(() => {
    mocks.status = "authenticated";
    mocks.replace.mockReset();
  });

  it("renders the canonical navigation and accessible content landmark", () => {
    render(<AppShell title="Settings">Account content</AppShell>);

    expect(
      screen.getByRole("navigation", { name: /primary navigation/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(
      screen.getByRole("link", { name: /skip to content/i }),
    ).toHaveAttribute("href", "#main-content");
  });

  it("redirects an unauthenticated user and withholds protected content", async () => {
    mocks.status = "unauthenticated";
    render(<AppShell title="Settings">Secret account content</AppShell>);

    expect(
      screen.queryByText("Secret account content"),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(
        "/sign-in?callbackUrl=%2Fsettings",
      ),
    );
  });

  it("provides accessible shared tabs, tables, and drawers", () => {
    const select = vi.fn();
    const close = vi.fn();
    render(
      <>
        <Tabs
          label="Equipment sections"
          items={[
            {
              id: "overview",
              label: "Overview",
              active: true,
              onSelect: select,
            },
          ]}
        />
        <DataTable
          caption="Equipments"
          columns={[{ key: "name", label: "Name" }]}
          rows={[]}
        />
        <Drawer open title="Evidence used" onClose={close}>
          Current sources
        </Drawer>
      </>,
    );

    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("table", { name: "Equipments" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Evidence used" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
  });
});
