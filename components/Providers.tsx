"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

// WAJIB menggunakan 'export' agar bisa di-import di layout.tsx
export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
