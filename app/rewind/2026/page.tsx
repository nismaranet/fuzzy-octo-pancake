import React from "react";
import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getWebConfig,
  isRewind2026PubliclyLive,
  isWebOwner,
} from "@/lib/webConfig";
import {
  getCollectiveRewind2026,
  getPersonalRewind2026,
} from "@/lib/rewind2026";
import RewindStoryExperience from "@/components/rewind/RewindStoryExperience";
import RewindLockedTeaser from "@/components/rewind/RewindLockedTeaser";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Miles of Memories - Rewind 2026",
  description:
    "Kilas balik tahun pertama website Nismara Transport! Lihat total kilometer, prestasi Hardcore Simulation, julukan driver 2026, dan bagikan kartu kenanganmu.",
  openGraph: {
    title: "Miles of Memories - Rewind 2026",
    description:
      "Kilas balik perjalanan 2026 seluruh keluarga besar Nismara Transport. Lihat statistik kolektif dan cerita perjalanan pribadimu!",
    url: "https://transport.nismara.web.id/rewind/2026",
    siteName: "Nismara Transport",
    locale: "id_ID",
    type: "website",
    images: [
      {
        url: "https://images.nismara.my.id/227300_188.jpg",
        width: 1200,
        height: 630,
        alt: "Miles of Memories - Nismara Rewind 2026",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Miles of Memories - Rewind 2026",
    description:
      "Kilas balik tahun pertama Nismara Transport 2026 — Miles of Memories.",
    images: ["https://images.nismara.my.id/227300_188.jpg"],
  },
};

export default async function Rewind2026Page() {
  const [session, webConfig] = await Promise.all([
    getServerSession(authOptions),
    getWebConfig(),
  ]);

  const discordId = session?.user?.discordId
    ? String(session.user.discordId)
    : null;
  const isOwner = await isWebOwner(discordId);
  const isLive = isRewind2026PubliclyLive(webConfig);

  // Rahasiakan data sepenuhnya sebelum jadwal rilis (28 Des 2026 00:00 WIB) untuk non-Owner
  if (!isLive && !isOwner) {
    return (
      <RewindLockedTeaser
        releaseAtIso={webConfig.features.rewind2026.releaseAt}
        enabled={webConfig.features.rewind2026.enabled}
      />
    );
  }

  const [collective, personal] = await Promise.all([
    getCollectiveRewind2026(),
    discordId ? getPersonalRewind2026({ discordId }) : Promise.resolve(null),
  ]);

  return (
    <RewindStoryExperience
      collective={collective}
      personal={personal}
      musicUrl={webConfig.features.rewind2026.musicUrl}
      isOwnerPreview={!isLive && isOwner}
      releaseAtIso={webConfig.features.rewind2026.releaseAt}
      isLoggedIn={Boolean(session?.user)}
    />
  );
}
