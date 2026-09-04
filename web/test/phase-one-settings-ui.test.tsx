import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "@/app/settings/page";

const mocks = vi.hoisted(() => ({
  theme: "system" as "light" | "dark" | "system",
  setTheme: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next-auth/react", () => ({ signOut: mocks.signOut }));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({ theme: mocks.theme, setTheme: mocks.setTheme }),
}));

describe("Phase 1 settings integration", () => {
  beforeEach(() => {
    mocks.theme = "system";
    mocks.setTheme.mockReset();
    mocks.signOut.mockReset();
    vi.unstubAllGlobals();
  });

  it("loads account data and persists profile and theme changes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          profile: { name: "Jane Doe", email: "jane@example.com" },
          preferences: { theme: "SYSTEM" },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          profile: { name: "Jane Smith", email: "jane@example.com" },
          preferences: { theme: "SYSTEM" },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          profile: { name: "Jane Smith", email: "jane@example.com" },
          preferences: { theme: "DARK" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SettingsPage />);

    const name = await screen.findByLabelText(/^name/i);
    expect(name).toHaveValue("Jane Doe");
    expect(screen.getByLabelText(/^email/i)).toHaveValue("jane@example.com");
    expect(screen.queryByText(/sso/i)).not.toBeInTheDocument();

    await user.clear(name);
    await user.type(name, "Jane Smith");
    await user.click(screen.getByRole("button", { name: /save profile/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      name: "Jane Smith",
    });

    await user.click(screen.getByRole("button", { name: /^dark$/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(mocks.setTheme).toHaveBeenCalledWith("dark");
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({
      theme: "DARK",
    });
  });
});
