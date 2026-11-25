import { addSeasonXp } from "@/lib/seasonPass";
import { jsonNoCache } from "@/lib/antiCache";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(request: Request) {
  try {
    const authHeader =
      request.headers.get("x-bot-secret") ||
      request.headers.get("authorization");
    const validSecret = process.env.NISMARA_SECRET_API;

    if (!validSecret) {
      console.error(
        "[Season Pass Add XP] NISMARA_SECRET_API is not configured",
      );
      return jsonNoCache(
        { error: "Server Error: Internal auth secret is not configured" },
        { status: 500 },
      );
    }

    if (
      !authHeader ||
      (authHeader !== validSecret && authHeader !== `Bearer ${validSecret}`)
    ) {
      return jsonNoCache(
        { error: "Unauthorized: Invalid Secret" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { discordId, xpAmount, reason = "Job Delivery XP" } = body;

    if (!discordId || !xpAmount) {
      return jsonNoCache(
        { error: "discordId dan xpAmount wajib diisi" },
        { status: 400 },
      );
    }

    const result = await addSeasonXp(discordId, Number(xpAmount), reason);

    if (!result.success) {
      return jsonNoCache({ error: result.error }, { status: 400 });
    }

    return jsonNoCache({
      success: true,
      data: result,
      message: result.capped
        ? result.message
        : `Berhasil menambahkan ${result.xpAdded?.toLocaleString("id-ID")} Seasonal XP ke driver ${discordId}.`,
    });
  } catch (error: any) {
    console.error("Add Season XP API Error:", error);
    return jsonNoCache(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
