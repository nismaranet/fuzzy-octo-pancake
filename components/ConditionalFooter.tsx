"use client";

import { usePathname } from "next/navigation";

/**
 * Hides the global Footer on full-viewport interactive routes such as `/livemap`.
 */
export default function ConditionalFooter({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname?.startsWith("/livemap")) {
    return null;
  }
  return <>{children}</>;
}
