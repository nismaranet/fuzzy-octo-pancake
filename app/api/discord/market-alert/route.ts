import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import { getWebConfig } from "@/lib/webConfig";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const GUILD_ID =
  process.env.DISCORD_GUILD_ID || process.env.GUILD_ID || "863959415702028318";

function getBotToken(): string {
  return (process.env.DISCORD_BOT_TOKEN || "").trim();
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return jsonNoCache({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.isDriver) {
      return jsonNoCache({
        success: true,
        configured: false,
        eligible: false,
        enabled: false,
      });
    }

    const token = getBotToken();
    const cfg = await getWebConfig();
    const roleId = cfg.discordRoles?.marketPingRoleId?.trim() || "";

    if (!token || !roleId) {
      return jsonNoCache({
        success: true,
        configured: false,
        eligible: true,
        enabled: false,
      });
    }

    const discordId = String(session.user.discordId);
    const memberRes = await fetch(
      `${DISCORD_API_BASE}/guilds/${GUILD_ID}/members/${discordId}`,
      {
        headers: {
          Authorization: `Bot ${token}`,
        },
        cache: "no-store",
      }
    );

    if (memberRes.status === 404) {
      return jsonNoCache({
        success: true,
        configured: true,
        eligible: true,
        inGuild: false,
        enabled: false,
      });
    }

    if (!memberRes.ok) {
      console.error(
        "[GET /api/discord/market-alert] Discord member fetch failed:",
        memberRes.status
      );
      return jsonNoCache(
        {
          success: false,
          configured: true,
          error: "Gagal mengecek status role Discord saat ini.",
        },
        { status: 502 }
      );
    }

    const member = await memberRes.json();
    const roles: string[] = Array.isArray(member?.roles) ? member.roles : [];
    const enabled = roles.includes(roleId);

    return jsonNoCache({
      success: true,
      configured: true,
      eligible: true,
      inGuild: true,
      enabled,
    });
  } catch (err) {
    console.error("[GET /api/discord/market-alert] Error:", err);
    return jsonNoCache(
      { success: false, error: "Terjadi kesalahan saat mengecek notifikasi market." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return jsonNoCache({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.isDriver) {
      return jsonNoCache(
        {
          success: false,
          error: "Fitur Notifikasi Market Discord khusus untuk driver resmi Nismara Transport.",
        },
        { status: 403 }
      );
    }

    const discordId = String(session.user.discordId);
    if (!checkRateLimit(discordId, "discord-market-alert-toggle", 2000)) {
      return jsonNoCache(
        { success: false, error: "Terlalu cepat. Tunggu 2 detik sebelum mengubah lagi." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body?.enabled !== "boolean") {
      return jsonNoCache(
        { success: false, error: "Parameter 'enabled' (boolean) wajib dikirim." },
        { status: 400 }
      );
    }

    const token = getBotToken();
    const cfg = await getWebConfig();
    const roleId = cfg.discordRoles?.marketPingRoleId?.trim() || "";

    if (!token || !roleId) {
      return jsonNoCache(
        {
          success: false,
          error: "Role Market Alert belum dikonfigurasi oleh Owner di Web Config.",
        },
        { status: 503 }
      );
    }

    const method = body.enabled ? "PUT" : "DELETE";
    const reason = encodeURIComponent(
      body.enabled
        ? "Driver opt-in Notifikasi Market Discord via Website"
        : "Driver opt-out Notifikasi Market Discord via Website"
    );

    const res = await fetch(
      `${DISCORD_API_BASE}/guilds/${GUILD_ID}/members/${discordId}/roles/${roleId}`,
      {
        method,
        headers: {
          Authorization: `Bot ${token}`,
          "X-Audit-Log-Reason": reason,
        },
      }
    );

    if (res.status === 404) {
      return jsonNoCache(
        {
          success: false,
          error:
            "Akun Discord Anda tidak ditemukan di server Nismara Transport. Pastikan Anda sudah bergabung ke server Discord kami.",
        },
        { status: 404 }
      );
    }

    if (res.status === 403) {
      console.error(
        "[POST /api/discord/market-alert] Missing Permissions (403). Ensure Bot Natasya role is above marketPingRoleId."
      );
      return jsonNoCache(
        {
          success: false,
          error:
            "Bot Natasya tidak memiliki izin untuk mengubah role ini. Pastikan posisi role bot berada di atas role Market Alert di Discord.",
        },
        { status: 403 }
      );
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(
        `[POST /api/discord/market-alert] Discord ${method} failed (${res.status}):`,
        errText.slice(0, 300)
      );
      return jsonNoCache(
        { success: false, error: "Gagal memperbarui role notifikasi di Discord." },
        { status: 502 }
      );
    }

    return jsonNoCache({
      success: true,
      enabled: body.enabled,
      message: body.enabled
        ? "Notifikasi Market Discord diaktifkan! Kamu akan mendapat ping saat ada penawaran baru di Fuel & Community Market."
        : "Notifikasi Market Discord dimatikan. Kamu tidak akan menerima ping market lagi.",
    });
  } catch (err) {
    console.error("[POST /api/discord/market-alert] Error:", err);
    return jsonNoCache(
      { success: false, error: "Terjadi kesalahan sistem saat mengubah notifikasi." },
      { status: 500 }
    );
  }
}
