"use client";

import React, { createContext, useContext, useMemo } from "react";
import {
  STARTER_AVATAR_DECORATIONS,
  getStarterDecorationById,
  type AvatarDecorationDef,
} from "@/lib/avatarDecorations";

const AvatarDecorationContext = createContext<Map<string, AvatarDecorationDef> | null>(
  null,
);

export function AvatarDecorationProvider({
  items,
  children,
}: {
  items?: AvatarDecorationDef[];
  children: React.ReactNode;
}) {
  const catalogMap = useMemo(() => {
    const source =
      items && items.length > 0 ? items : STARTER_AVATAR_DECORATIONS;
    return new Map(source.map((d) => [d.id, d]));
  }, [items]);

  return (
    <AvatarDecorationContext.Provider value={catalogMap}>
      {children}
    </AvatarDecorationContext.Provider>
  );
}

export function useAvatarDecorationFromCatalog(
  id?: string | null,
): AvatarDecorationDef | null {
  const ctx = useContext(AvatarDecorationContext);
  if (!id || typeof id !== "string") return null;
  const key = id.trim();
  if (!key) return null;
  if (ctx) {
    return ctx.get(key) || null;
  }
  return getStarterDecorationById(key);
}
