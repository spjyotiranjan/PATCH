"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/theme-provider";

export function AppProviders({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SessionProvider refetchOnWindowFocus>
      <ThemeProvider>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background:
                "var(--patch-surface)",
              color: "var(--patch-text)",
              border:
                "1px solid var(--patch-boundary)",
            },
          }}
        />
      </ThemeProvider>
    </SessionProvider>
  );
}