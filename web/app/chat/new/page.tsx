"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui";
import { createChatSession } from "@/lib/api/chat";

export default function NewChatPage() {
  const router = useRouter();
  const [error, setError] = useState<
    string | null
  >(null);
  const [reloadToken, setReloadToken] =
    useState(0);

  useEffect(() => {
    let cancelled = false;

    async function create() {
      try {
        if (!cancelled) {
          setError(null);
        }
        const session =
          await createChatSession(
            "New conversation",
          );

        if (!cancelled) {
          router.replace(
            `/chat/${session.id}`,
          );
        }
      } catch {
        if (!cancelled) {
          setError(
            "A new chat could not be started. Check your connection and retry.",
          );
        }
      }
    }

    void create();

    return () => {
      cancelled = true;
    };
  }, [router, reloadToken]);

  return (
    <AppShell title="New chat">
      <section
        className="empty-state"
        aria-live="polite"
      >
        {error ? (
          <>
            <h2>
              A new chat could not be started
            </h2>
            <p>{error}</p>
            <Button
              type="button"
              onClick={() =>
                setReloadToken(
                  (token) => token + 1,
                )
              }
            >
              Retry
            </Button>
          </>
        ) : (
          <>
            <h2>Starting a new chat…</h2>
            <p>
              Preparing a fresh
              source-backed conversation.
            </p>
          </>
        )}
      </section>
    </AppShell>
  );
}
