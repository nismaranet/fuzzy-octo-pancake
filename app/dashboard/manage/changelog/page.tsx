import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongoose";
import { isWebOwner } from "@/lib/webConfig";
import ChangelogEntry from "@/lib/models/ChangelogEntry";
import { sortChangelogEntriesDesc, type SerializedChangelogEntry } from "@/lib/changelog";
import ChangelogManageClient from "./ChangelogManageClient";

export const metadata = {
  title: "Manajemen Changelog",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function ManageChangelogPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.discordId) {
    redirect("/login");
  }

  const ownerAllowed = await isWebOwner(session.user.discordId);
  if (!ownerAllowed) {
    redirect("/dashboard/manage");
  }

  await dbConnect();
  const docs = await ChangelogEntry.find({})
    .sort({ releaseDate: -1, createdAt: -1 })
    .lean();

  const initialEntries: SerializedChangelogEntry[] = sortChangelogEntriesDesc(
    docs.map((doc) => ({
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
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
    }))
  );

  return <ChangelogManageClient initialEntries={initialEntries} />;
}
