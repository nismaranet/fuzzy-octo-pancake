import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ truckyId: string }>;
}): Promise<Metadata> {
  const { truckyId } = await params;
  const webConfig = await getWebConfig();

  // Sebelum jadwal rilis, jangan bocorkan statistik driver di embed metadata
  if (!isRewind2026PubliclyLive(webConfig)) {
    return {
      title: "Miles of Memories - Rewind 2026",
      description:
        "Kilas balik perjalanan 2026 Nismara Transport akan segera dibuka pada 28 Desember 2026.",
    };
  }

  const personal = await getPersonalRewind2026({ truckyId });
  if (!personal) {
    return { title: "Rewind Driver Tidak Ditemukan" };
  }

  const title = `Miles of Memories 2026: ${personal.driver.name}`;
  const hcSnippet = personal.hardcore.title
    ? ` | Hardcore: ${personal.hardcore.title.title} (${personal.hardcore.avgRating.toFixed(1)}★)`
    : "";
  const description = `${personal.driver.name} meraih julukan ${personal.persona.title} dengan ${personal.totalKm.toLocaleString("id-ID")} km dan ${personal.totalJobs.toLocaleString("id-ID")} job sepanjang 2026${hcSnippet}.`;
  const coverImage =
    personal.gallery.topPhoto?.imageUrl ||
    "https://images.nismara.my.id/227300_188.jpg";
  const pageUrl = `https://transport.nismara.web.id/rewind/2026/${truckyId}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "Nismara Transport",
      locale: "id_ID",
      type: "website",
      images: [
        {
          url: coverImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [coverImage],
    },
  };
}

export default async function SharedDriverRewind2026Page({
  params,
}: {
  params: Promise<{ truckyId: string }>;
}) {
  const { truckyId } = await params;
  const [session, webConfig] = await Promise.all([
    getServerSession(authOptions),
    getWebConfig(),
  ]);

  const discordId = session?.user?.discordId
    ? String(session.user.discordId)
    : null;
  const isOwner = await isWebOwner(discordId);
  const isLive = isRewind2026PubliclyLive(webConfig);

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
    getPersonalRewind2026({ truckyId }),
  ]);

  if (!personal) {
    notFound();
  }

  return (
    <RewindStoryExperience
      collective={collective}
      personal={personal}
      musicUrl={webConfig.features.rewind2026.musicUrl}
      isOwnerPreview={!isLive && isOwner}
      releaseAtIso={webConfig.features.rewind2026.releaseAt}
      isSharedView={personal.driver.discordId !== discordId}
      isLoggedIn={Boolean(session?.user)}
    />
  );
}
