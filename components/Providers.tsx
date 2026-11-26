"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { NotificationProvider } from "./ui/NotificationProvider";
import { DialogContainer } from "./ui/DialogContainer";
import { AvatarDecorationProvider } from "./profile/AvatarDecorationProvider";
import type { AvatarDecorationDef } from "@/lib/avatarDecorations";

// WAJIB menggunakan 'export' agar bisa di-import di layout.tsx
export function Providers({
  children,
  avatarDecorations,
}: {
  children: ReactNode;
  avatarDecorations?: AvatarDecorationDef[];
}) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      <AvatarDecorationProvider items={avatarDecorations}>
        <NotificationProvider>
          <DialogContainer />
          {children}
        </NotificationProvider>
      </AvatarDecorationProvider>
    </SessionProvider>
  );
}
