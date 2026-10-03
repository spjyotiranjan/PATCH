import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useResource, useSourceAccess } from "@/components/backend-state";
const session = vi.hoisted(() => ({
  status: "authenticated",
  userId: "owner",
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    status: session.status,
    data: { user: { id: session.userId } },
  }),
}));
beforeEach(() => {
  session.status = "authenticated";
  session.userId = "owner";
});
afterEach(() => vi.useRealTimers());

describe("authenticated browser resource lifecycle", () => {
  it("does not fetch protected content without a session", async () => {
    session.status = "unauthenticated";
    const loader = vi.fn().mockResolvedValue("private");
    const { result } = renderHook(() => useResource(loader));
    expect(loader).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });
  it("discards stale responses after changing routes", async () => {
    let resolveOld!: (value: string) => void;
    const oldLoader = () =>
      new Promise<string>((resolve) => {
        resolveOld = resolve;
      });
    const nextLoader = vi.fn().mockResolvedValue("current source");
    const { result, rerender } = renderHook(
      ({ loader }) => useResource(loader),
      { initialProps: { loader: oldLoader } },
    );
    rerender({ loader: nextLoader });
    await waitFor(() => expect(result.current.data).toBe("current source"));
    await act(async () => resolveOld("old private source"));
    expect(result.current.data).toBe("current source");
  });
  it("clears prior content immediately after a session change and fetches for the new actor", async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce("owner record")
      .mockResolvedValueOnce("other record");
    const { result, rerender } = renderHook(() => useResource(loader));
    await waitFor(() => expect(result.current.data).toBe("owner record"));
    session.userId = "other";
    rerender();
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.data).toBe("other record"));
  });
  it("clears previously visible content on authorization failure", async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce("source")
      .mockRejectedValueOnce(new Error("forbidden"));
    const { result } = renderHook(() => useResource(loader));
    await waitFor(() => expect(result.current.data).toBe("source"));
    await act(() => result.current.refresh());
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeTruthy();
  });
});
describe("short-lived source access", () => {
  it("clears access on expiry and rechecks authorization before reopening", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSourceAccess());
    await act(() =>
      result.current.open(async () => ({
        url: "https://private.example/source",
        expiresInSeconds: 20,
      })),
    );
    expect(result.current.url).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(15000));
    expect(result.current.url).toBeNull();
    await act(() =>
      result.current.open(async () => ({
        url: "https://private.example/renewed",
        expiresIn: 300,
      })),
    );
    await act(async () => {
      await expect(
        result.current.open(async () => {
          throw new Error("access revoked");
        }),
      ).rejects.toThrow();
    });
    expect(result.current.url).toBeNull();
  });
});
