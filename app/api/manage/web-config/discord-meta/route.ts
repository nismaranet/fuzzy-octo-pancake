import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { jsonNoCache } from "@/lib/antiCache";
import { isWebOwner } from "@/lib/webConfig";
import { getDiscordGuildMeta } from "@/lib/discordGuildMeta";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId || !(await isWebOwner(session.user.discordId))) {
      return jsonNoCache(
        { error: "Akses ditolak: khusus Developer dan Owner Nismara." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1";

    const meta = await getDiscordGuildMeta(forceRefresh);
    return jsonNoCache(meta);
  } catch (error: any) {
    console.error("[GET /api/manage/web-config/discord-meta] Error:", error);
    return jsonNoCache(
      { ok: false, error: "Gagal sinkronisasi data Discord." },
      { status: 500 }
    );
  }
}
