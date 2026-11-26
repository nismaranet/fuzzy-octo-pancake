import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongoose";
import { isWebOwner } from "@/lib/webConfig";
import ChangelogEntry, { type ChangelogProduct } from "@/lib/models/ChangelogEntry";
import {
  isValidChangelogProduct,
  sortChangelogEntriesDesc,
  type SerializedChangelogEntry,
} from "@/lib/changelog";
import ChangelogClient from "./ChangelogClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Catatan Perubahan",
  description:
    "Lacak fitur baru, peningkatan, dan perbaikan di seluruh layanan Nismara Transport, termasuk Web Transport, Bot Natasya, dan Nismara Tracker.",
  openGraph: {
    title: "Catatan Perubahan",
    description:
      "Lacak fitur baru, peningkatan, dan perbaikan di seluruh layanan Nismara Transport, termasuk Web Transport, Bot Natasya, dan Nismara Tracker.",
    url: "https://transport.nismara.web.id/changelog",
    siteName: "Nismara Transport",
    locale: "id_ID",
    type: "website",
    images: [
      {
        url: "https://images.nismara.my.id/227300_188.jpg",
        width: 1200,
        height: 630,
        alt: "Catatan Perubahan Nismara Transport",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Catatan Perubahan",
    description:
      "Lacak fitur baru, peningkatan, dan perbaikan terbaru di Web Transport, Bot Natasya, dan Nismara Tracker.",
    images: ["https://images.nismara.my.id/227300_188.jpg"],
  },
  keywords: [
    "Catatan Perubahan Nismara",
    "Changelog Nismara Transport",
    "Update Bot Natasya",
    "Update Nismara Tracker",
    "Patch Notes VTC Indonesia",
  ],
};

export default async function ChangelogPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const resolvedParams = await searchParams;
  const initialTab: ChangelogProduct = isValidChangelogProduct(resolvedParams?.tab)
    ? resolvedParams.tab
    : "web";

  let entriesByProduct: Record<ChangelogProduct, SerializedChangelogEntry[]> = {
    web: [],
    natasya: [],
    tracker: [],
  };
  let isOwner = false;

  if (process.env.MONGODB_URI?.trim()) {
    try {
      const [session] = await Promise.all([
        getServerSession(authOptions).catch(() => null),
        dbConnect(),
      ]);

      if (session?.user?.discordId) {
        isOwner = await isWebOwner(session.user.discordId).catch(() => false);
      }

      const docs = await ChangelogEntry.find({ status: "published" })
        .sort({ releaseDate: -1, createdAt: -1 })
        .lean();

      const grouped: Record<ChangelogProduct, SerializedChangelogEntry[]> = {
        web: [],
        natasya: [],
        tracker: [],
      };

      for (const doc of docs) {
        const serialized: SerializedChangelogEntry = {
          _id: String(doc._id),
          product: doc.product,
          version: doc.version,
          title: doc.title,
          summary: doc.summary,
          releaseDate: new Date(doc.releaseDate).toISOString(),
          status: doc.status,
          sections: {
            added: Array.isArray(doc.sections?.added) ? doc.sections.added : [],
            improved: Array.isArray(doc.sections?.improved) ? doc.sections.improved : [],
            fixed: Array.isArray(doc.sections?.fixed) ? doc.sections.fixed : [],
          },
          articleUrl: doc.articleUrl || null,
          highlightFeatureUrl: doc.highlightFeatureUrl || null,
          highlightFeatureLabel: doc.highlightFeatureLabel || null,
          publishedAt: doc.publishedAt ? new Date(doc.publishedAt).toISOString() : null,
        };
        if (grouped[doc.product]) {
          grouped[doc.product].push(serialized);
        }
      }

      entriesByProduct = {
        web: sortChangelogEntriesDesc(grouped.web),
        natasya: sortChangelogEntriesDesc(grouped.natasya),
        tracker: sortChangelogEntriesDesc(grouped.tracker),
      };
    } catch (err) {
      console.error("[ChangelogPage] Failed loading entries:", err);
    }
  }

  return (
    <ChangelogClient
      initialTab={initialTab}
      entriesByProduct={entriesByProduct}
      isOwner={isOwner}
    />
  );
}
