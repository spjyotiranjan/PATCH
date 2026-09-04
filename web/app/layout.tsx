import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { AppProviders } from "@/components/app-providers";

export const metadata: Metadata = {
  title: "P.A.T.C.H.",
  description: "Precision Assistant for Technical Context & Hardware",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
