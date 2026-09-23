"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Button, StatusBadge } from "@/components/ui";
import { message } from "@/lib/api/http";
import type { Source } from "@/lib/api/contracts";

/** Signed access is transient, cleared before reauthorization and at expiry. */
export function useSourceAccess() {
  const [url, setUrl] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sequence = useRef(0);
  useEffect(
    () => () => {
      ++sequence.current;
      clearTimeout(timer.current);
    },
    [],
  );
  const clear = () => {
    ++sequence.current;
    clearTimeout(timer.current);
    setUrl(null);
  };
  const open = async (loader: () => Promise<Source>) => {
    clear();
    const current = sequence.current;
    const source = await loader();
    if (current !== sequence.current) return;
    const ttl = Math.min(
      300,
      source.expiresInSeconds ?? source.expiresIn ?? 300,
    );
    setUrl(source.url);
    timer.current = setTimeout(() => setUrl(null), Math.max(1, ttl - 5) * 1000);
  };
  return { url, open, clear };
}

/** Poll only while authenticated; invalidate stale loads after navigation/sign-out. */
export function useResource<T>(loader: () => Promise<T>, interval = 0) {
  const { status, data: session } = useSession();
  const userId = session?.user?.id;
  const [snapshot, setSnapshot] = useState<{
    loader: typeof loader;
    userId: typeof userId;
    data: T | null;
    error: string | null;
  } | null>(null);
  const sequence = useRef({ value: 0 });
  const refresh = useCallback(async () => {
    if (status !== "authenticated") return;
    const current = ++sequence.current.value;
    try {
      const result = await loader();
      if (current === sequence.current.value)
        setSnapshot({ loader, userId, data: result, error: null });
    } catch (cause) {
      if (current === sequence.current.value)
        setSnapshot({ loader, userId, data: null, error: message(cause) });
    }
  }, [loader, status, userId]);
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const counter = sequence.current;
    const tick = async () => {
      await refresh();
      if (live && interval) timer = setTimeout(tick, interval);
    };
    void tick();
    return () => {
      live = false;
      ++counter.value;
      clearTimeout(timer);
    };
  }, [refresh, interval]);
  const current =
    status === "authenticated" &&
    snapshot?.loader === loader &&
    snapshot.userId === userId
      ? snapshot
      : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: !current,
    refresh,
  };
}
export function LoadState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string | null;
  retry: () => unknown;
}) {
  return error ? (
    <div className="form-message form-message-error" role="alert">
      {error}{" "}
      <Button variant="secondary" onClick={() => void retry()}>
        Retry
      </Button>
    </div>
  ) : loading ? (
    <p role="status">Loading…</p>
  ) : null;
}
export function RecordState({ value }: { value: string }) {
  const danger = /FAILED|REJECT|SEVERE|CONFLICT|UNAVAILABLE/.test(value);
  const good =
    /^(ACTIVE|APPROVED|PUBLISHED|COMPLETED|SUBMITTED|FRESH|READY)$/.test(value);
  return (
    <StatusBadge tone={danger ? "danger" : good ? "success" : "neutral"}>
      {value.replaceAll("_", " ").toLowerCase()}
    </StatusBadge>
  );
}
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const run = async (action: () => Promise<unknown>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(message(cause));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  return { busy, error, run };
}
