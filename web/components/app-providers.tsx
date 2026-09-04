"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/theme-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus>
      <ThemeProvider>{children}</ThemeProvider>
    </SessionProvider>
  );
}
