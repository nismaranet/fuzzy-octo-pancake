import clientPromise from "@/lib/mongodb";
import { jsonNoCache } from "@/lib/antiCache";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const discordId = searchParams.get("discordId");

    const client = await clientPromise;
    const db = client.db();

    const query: Record<string, any> = {};
    if (discordId) {
      query.userId = discordId;
    }

    const posts = await db
      .collection("gallery_posts")
      .find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return jsonNoCache(posts);
  } catch (error) {
    console.error("GET MCP Gallery Error:", error);
    return jsonNoCache(
      { error: "Gagal mengambil data gallery untuk MCP" },
      { status: 500 },
    );
  }
}
