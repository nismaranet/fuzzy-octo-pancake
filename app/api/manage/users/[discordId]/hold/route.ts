import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { jsonNoCache } from "@/lib/antiCache";
import {
  placeUserOnHold,
  restoreUserFromHold,
  type AccountHoldReason,
} from "@/lib/accountHold";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

async function isAuthorized(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  const expectedBotToken = process.env.NISMARA_SECRET_API;

  if (expectedBotToken && authHeader === `Bearer ${expectedBotToken}`) {
    return true;
  }

  const session = await getServerSession(authOptions);
  return Boolean(session && session.user?.role === "manager");
}

/**
 * POST /api/manage/users/[discordId]/hold
 * Menempatkan akun ke status Hold 90 Hari (soft-freeze + email Resend + opsional kick Trucky)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ discordId: string }> }
) {
  try {
    if (!(await isAuthorized(req))) {
      return jsonNoCache({ error: "Unauthorized" }, { status: 401 });
    }

    const { discordId } = await params;
    if (!discordId) {
      return jsonNoCache({ error: "Missing discordId parameter" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const rawReason = String(body?.reason || "LEFT_DISCORD");
    const reason: AccountHoldReason =
      rawReason === "LEFT_TRUCKY" || rawReason === "KICKED_TRUCKY"
        ? rawReason
        : "LEFT_DISCORD";
    const kickFromTrucky = Boolean(body?.kickFromTrucky);

    const result = await placeUserOnHold({
      discordId,
      reason,
      kickFromTrucky,
    });

    if (!result.success && (result as any).notFound) {
      return jsonNoCache(result, { status: 404 });
    }

    return jsonNoCache(result);
  } catch (error: any) {
    console.error("Account Hold POST Error:", error);
    return jsonNoCache(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/manage/users/[discordId]/hold
 * Memulihkan akun dari status Hold 90 Hari
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ discordId: string }> }
) {
  try {
    if (!(await isAuthorized(req))) {
      return jsonNoCache({ error: "Unauthorized" }, { status: 401 });
    }

    const { discordId } = await params;
    if (!discordId) {
      return jsonNoCache({ error: "Missing discordId parameter" }, { status: 400 });
    }

    const result = await restoreUserFromHold({ discordId });
    if (!result.success && (result as any).notOnHold) {
      return jsonNoCache(result, { status: 404 });
    }

    return jsonNoCache(result);
  } catch (error: any) {
    console.error("Account Hold DELETE (Restore) Error:", error);
    return jsonNoCache(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
