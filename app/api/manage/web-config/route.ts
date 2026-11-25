import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { jsonNoCache } from "@/lib/antiCache";
import {
  DEFAULT_REWIND_2026_RELEASE_AT,
  WEB_CONFIG_DB_KEY,
  getWebConfig,
  invalidateWebConfigCache,
  isWebOwner,
  type SeasonThemeMode,
  type WebConfig,
} from "@/lib/webConfig";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const SNOWFLAKE_RE = /^\d{15,22}$/;

function cleanSnowflake(val: any, fieldName: string, required = false): { value: string; error?: string } {
  const s = typeof val === "string" ? val.trim() : "";
  if (!s) {
    return required ? { value: "", error: `${fieldName} wajib diisi.` } : { value: "" };
  }
  if (!SNOWFLAKE_RE.test(s)) {
    return { value: s, error: `${fieldName} harus berupa Discord ID angka 15–22 digit.` };
  }
  return { value: s };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId || !(await isWebOwner(session.user.discordId))) {
      return jsonNoCache({ error: "Akses ditolak: khusus Developer dan Owner Nismara." }, { status: 403 });
    }

    const client = await clientPromise;
    const doc = await client
      .db()
      .collection("systemsettings")
      .findOne({ key: WEB_CONFIG_DB_KEY });

    const config = await getWebConfig(true);
    return jsonNoCache({
      success: true,
      config,
      meta: {
        hasDbRecord: Boolean(doc),
        updatedAt: doc?.updatedAt || null,
        updatedBy: doc?.updatedBy || null,
      },
    });
  } catch (error: any) {
    console.error("[GET /api/manage/web-config] Error:", error);
    return jsonNoCache({ error: "Gagal memuat konfigurasi web." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const actorId = session?.user?.discordId;
    if (!actorId || !(await isWebOwner(actorId))) {
      return jsonNoCache({ error: "Akses ditolak: khusus Developer dan Owner Nismara." }, { status: 403 });
    }

    const body = await request.json();
    const errors: string[] = [];

    const check = (val: any, label: string, required = false) => {
      const res = cleanSnowflake(val, label, required);
      if (res.error) errors.push(res.error);
      return res.value;
    };

    const nextConfig: WebConfig = {
      owners: {
        developerDiscordId: check(body?.owners?.developerDiscordId, "Developer Discord ID", true),
        nismaraOwnerDiscordId: check(body?.owners?.nismaraOwnerDiscordId, "Nismara Owner Discord ID", true),
      },
      discordChannels: {
        generalDriverChannelId: check(body?.discordChannels?.generalDriverChannelId, "General Driver Channel ID"),
        interviewChannelId: check(body?.discordChannels?.interviewChannelId, "Interview Channel ID"),
        plusCategoryId: check(body?.discordChannels?.plusCategoryId, "Nismara+ Category ID"),
        ticketCategoryId: check(body?.discordChannels?.ticketCategoryId, "Ticket Category ID"),
        registrationCategoryId: check(body?.discordChannels?.registrationCategoryId, "Registration Category ID"),
        serviceFleetCategoryId: check(body?.discordChannels?.serviceFleetCategoryId, "Service Fleet Category ID"),
        fleetOrderCategoryId: check(body?.discordChannels?.fleetOrderCategoryId, "Fleet Order Category ID"),
        communityGoalsCategoryId: check(body?.discordChannels?.communityGoalsCategoryId, "Community Goals Category ID"),
      },
      discordRoles: {
        driverRoleId: check(body?.discordRoles?.driverRoleId, "Driver Role ID"),
        internRoleId: check(body?.discordRoles?.internRoleId, "Intern Role ID"),
        managerRoleId: check(body?.discordRoles?.managerRoleId, "Manager Role ID"),
        nismaraPlusRoleId: check(body?.discordRoles?.nismaraPlusRoleId, "Nismara+ Role ID"),
        lottoRoleId: check(body?.discordRoles?.lottoRoleId, "Lotto Role ID"),
        staffHrRoleId: check(body?.discordRoles?.staffHrRoleId, "Staff HR Role ID"),
        staffOperationalRoleId: check(body?.discordRoles?.staffOperationalRoleId, "Staff Operational Role ID"),
        staffGeneralManagerRoleId: check(body?.discordRoles?.staffGeneralManagerRoleId, "Staff General Manager Role ID"),
        staffDeputyRoleId: check(body?.discordRoles?.staffDeputyRoleId, "Staff Deputy Role ID"),
        staffDirectorRoleId: check(body?.discordRoles?.staffDirectorRoleId, "Staff Director Role ID"),
      },
      features: (() => {
        const rawMode = body?.features?.seasonTheme;
        const seasonTheme: SeasonThemeMode =
          rawMode === "none" || rawMode === "halloween" || rawMode === "christmas_new_year"
            ? rawMode
            : body?.features?.halloweenTheme
              ? "halloween"
              : "none";

        const rawRewind = body?.features?.rewind2026 || {};
        const rewindEnabled =
          typeof rawRewind.enabled === "boolean" ? rawRewind.enabled : true;

        let rewindReleaseAt = DEFAULT_REWIND_2026_RELEASE_AT;
        if (typeof rawRewind.releaseAt === "string" && rawRewind.releaseAt.trim()) {
          const parsed = new Date(rawRewind.releaseAt.trim());
          if (Number.isNaN(parsed.getTime())) {
            errors.push("Jadwal rilis Rewind 2026 tidak valid.");
          } else {
            rewindReleaseAt = rawRewind.releaseAt.trim();
          }
        }

        let rewindMusicUrl = "";
        if (typeof rawRewind.musicUrl === "string" && rawRewind.musicUrl.trim()) {
          const m = rawRewind.musicUrl.trim();
          if (m.startsWith("/") || m.startsWith("https://") || m.startsWith("http://")) {
            rewindMusicUrl = m;
          } else {
            errors.push("URL musik Rewind 2026 harus diawali https:// atau /audio/...");
          }
        }

        return {
          seasonTheme,
          halloweenTheme: seasonTheme === "halloween",
          rewind2026: {
            enabled: rewindEnabled,
            releaseAt: rewindReleaseAt,
            musicUrl: rewindMusicUrl,
          },
        };
      })(),
    };

    if (errors.length > 0) {
      return jsonNoCache({ error: errors.join(" "), details: errors }, { status: 400 });
    }

    const client = await clientPromise;
    const now = new Date();
    await client.db().collection("systemsettings").updateOne(
      { key: WEB_CONFIG_DB_KEY },
      {
        $set: {
          key: WEB_CONFIG_DB_KEY,
          value: nextConfig,
          description: "Konfigurasi dinamis website Nismara Transport (Discord Channel/Role ID, Owner IDs, Feature Flags)",
          updatedBy: String(actorId),
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    );

    await invalidateWebConfigCache();
    revalidatePath("/", "layout");
    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/rewind/2026");
    revalidatePath("/dashboard/manage/data/web-config");

    return jsonNoCache({
      success: true,
      config: nextConfig,
      updatedAt: now.toISOString(),
    });
  } catch (error: any) {
    console.error("[PUT /api/manage/web-config] Error:", error);
    return jsonNoCache({ error: "Gagal menyimpan konfigurasi web." }, { status: 500 });
  }
}
