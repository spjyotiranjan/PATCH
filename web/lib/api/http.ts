/** Browser-only, same-origin product API transport. Never log response bodies. */
export class ApiRequestError extends Error {
  constructor(
    public code: string,
    public status = 0,
    public requestId?: string,
  ) {
    super(
      code === "UNAUTHENTICATED" || status === 401
        ? "Your session has expired. Sign in again."
        : status === 403
          ? "You do not have access to this action."
          : status === 409
            ? "This record changed or the action is blocked. Refresh and review its current state."
            : status === 429
              ? "Too many requests. Wait briefly and try again."
              : `The request could not be completed (${code}).`,
    );
    this.name = "ApiRequestError";
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!path.startsWith("/api/")) throw new ApiRequestError("INVALID_API_PATH");
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiRequestError("NETWORK_UNAVAILABLE");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiRequestError(
      body?.error?.code ?? "REQUEST_FAILED",
      response.status,
      body?.requestId,
    );
  return body as T;
}
export const post = <T>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const remove = (path: string) =>
  api<unknown>(path, { method: "DELETE" });
export const items = async <T>(path: string) =>
  (await api<{ items: T[] }>(path)).items;
export const message = (error: unknown) =>
  error instanceof ApiRequestError
    ? error.message
    : "Unable to complete the request. Please try again.";
export const id = (value: string) => encodeURIComponent(value);
