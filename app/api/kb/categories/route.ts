import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const isManager = session?.user?.role === "manager" || session?.user?.role === "admin";
    const isDriver = session?.user?.isDriver === true;

    const allowedAccess = ["public"];
    if (isDriver || isManager) allowedAccess.push("driver");
    if (isManager) allowedAccess.push("manager");

    const client = await clientPromise;
    const db = client.db();

    const categoryFilter: any = {
      $or: [
        { accessLevel: { $in: allowedAccess } },
        { accessLevel: { $exists: false } }
      ]
    };

    const categories = await db.collection("kb_categories")
      .find(categoryFilter)
      .sort({ order: 1, createdAt: 1 })
      .toArray();

    return NextResponse.json({ success: true, categories });
  } catch (error: any) {
    console.error("KB Categories Fetch Error:", error);
    return NextResponse.json({ success: false, error: "Gagal mengambil kategori KB" }, { status: 500 });
  }
}
