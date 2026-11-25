import clientPromise from "@/lib/mongodb";
import { jsonNoCache } from "@/lib/antiCache";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.toUpperCase();

    const client = await clientPromise;
    const db = client.db();

    const query: Record<string, any> = {};
    if (status === "COMPLETED" || status === "CANCELED" || status === "INACTIVE") {
      query.active = false;
    } else if (status === "ONGOING" || status === "SCHEDULED" || status === "ACTIVE") {
      query.active = true;
    } else {
      // Default: hanya tampilkan convoy yang masih aktif/akan datang
      query.active = true;
    }

    const convoys = await db
      .collection("convoylobby")
      .find(query)
      .sort({ startDate: 1, createdAt: -1 })
      .toArray();

    return jsonNoCache(convoys);
  } catch (error) {
    console.error("GET MCP Convoy Error:", error);
    return jsonNoCache(
      { error: "Gagal mengambil data convoy untuk MCP" },
      { status: 500 }
    );
  }
}
