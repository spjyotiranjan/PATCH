import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SignInPage from "@/app/sign-in/page";
import SignUpPage from "@/app/sign-up/page";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  search: new URLSearchParams(),
}));

vi.mock("next-auth/react", () => ({ signIn: mocks.signIn }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
  useSearchParams: () => mocks.search,
}));

describe("Phase 1 credentials UI", () => {
  beforeEach(() => {
    mocks.signIn.mockReset();
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
    mocks.search = new URLSearchParams();
    vi.unstubAllGlobals();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("signs in with email and password without social or passwordless options", async () => {
    mocks.search = new URLSearchParams("callbackUrl=%2Fsettings");
    mocks.signIn.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SignInPage />);

    expect(screen.queryByText(/sso/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sign-in link/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/^email/i), "owner@example.com");
    await user.type(screen.getByLabelText(/^password/i), "correct-pass");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() =>
      expect(mocks.signIn).toHaveBeenCalledWith("credentials", {
        email: "owner@example.com",
        password: "correct-pass",
        redirect: false,
      }),
    );
    expect(mocks.replace).toHaveBeenCalledWith("/settings");
  });

  it("submits exactly the four required signup fields and starts a session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { id: "user-1" } }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    mocks.signIn.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(screen.getByLabelText(/^name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/^email/i), "jane@example.com");
    await user.type(screen.getByLabelText(/^password/i), "strong-pass");
    await user.type(screen.getByLabelText(/^confirm password/i), "strong-pass");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toEqual({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "strong-pass",
      confirmPassword: "strong-pass",
    });
    expect(mocks.signIn).toHaveBeenCalledWith("credentials", {
      email: "jane@example.com",
      password: "strong-pass",
      redirect: false,
    });
    expect(mocks.replace).toHaveBeenCalledWith("/");
  });

  it("rejects mismatched passwords before contacting the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(screen.getByLabelText(/^name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/^email/i), "jane@example.com");
    await user.type(screen.getByLabelText(/^password/i), "strong-pass");
    await user.type(screen.getByLabelText(/^confirm password/i), "other-pass");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Passwords do not match.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
