import { getServerSession } from "next-auth/next";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import NavbarClient from "@/components/NavbarClient";
import KBCategoryClient from "@/components/kb/KBCategoryClient";
import clientPromise from "@/lib/mongodb";
import { notFound, redirect } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categorySlug: string }>;
}) {
  const resolvedParams = await params;
  
  let categoryName = resolvedParams.categorySlug;
  try {
    const client = await clientPromise;
    const db = client.db();
    const categoryDoc = await db.collection("kb_categories").findOne({ slug: resolvedParams.categorySlug });
    if (categoryDoc && categoryDoc.name) {
      categoryName = categoryDoc.name;
    }
  } catch (error) {
    console.error("Error fetching category metadata:", error);
  }

  return {
    title: `Kategori: ${categoryName} - Knowledge Base`,
  };
}

export default async function KBCategoryPage({
  params,
}: {
  params: Promise<{ categorySlug: string }>;
}) {
  const session = await getServerSession(authOptions);
  const resolvedParams = await params;

  const isManager = session?.user?.role === "manager" || session?.user?.role === "admin";
  const isDriver = session?.user?.isDriver === true;

  const allowedAccess = ["public"];
  if (isDriver || isManager) allowedAccess.push("driver");
  if (isManager) allowedAccess.push("manager");

  try {
    const client = await clientPromise;
    const db = client.db();
    const categoryDoc = await db.collection("kb_categories").findOne({ slug: resolvedParams.categorySlug });

    if (!categoryDoc) {
      notFound();
    }

    const catAccess = categoryDoc.accessLevel || "public";
    if (!allowedAccess.includes(catAccess)) {
      if (!session) {
        redirect(`/login?callbackUrl=/kb/${resolvedParams.categorySlug}`);
      }
      notFound();
    }
  } catch (err: any) {
    if (err?.message?.includes("NEXT_NOT_FOUND") || err?.message?.includes("NEXT_REDIRECT") || err?.digest?.includes("NEXT_")) {
      throw err;
    }
    console.error("Error checking category access:", err);
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <NavbarClient session={session} />
      <div className="pt-24 pb-12 flex-1">
        <KBCategoryClient categorySlug={resolvedParams.categorySlug} session={session} />
      </div>
    </div>
  );
}
