import clientPromise from "@/lib/mongodb";
import { redis } from "@/lib/redis";
import { getDriverStats, kickTruckyMemberBySteamId } from "@/lib/trucky";
import { sendAccountHoldEmail, sendAccountRestoredEmail } from "@/lib/email";
import { sendPersonalNotification } from "@/lib/services/NotificationService";
import { getWebConfig } from "@/lib/webConfig";

export type AccountHoldReason = "LEFT_DISCORD" | "LEFT_TRUCKY" | "KICKED_TRUCKY";

const HOLD_DAYS = 90;
const GUILD_ID = process.env.DISCORD_GUILD_ID || "863959415702028318";
const COMPANY_ID = Number(process.env.TRUCKY_COMPANY_ID || "35643");
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

async function removeDiscordDriverRoles(discordId: string, db: any) {
  if (!DISCORD_BOT_TOKEN || !GUILD_ID || !discordId) return [] as string[];

  const webConfig = await getWebConfig();
  const rolesToRemove = new Set<string>();
  if (webConfig.discordRoles.driverRoleId) rolesToRemove.add(webConfig.discordRoles.driverRoleId);
  if (webConfig.discordRoles.internRoleId) rolesToRemove.add(webConfig.discordRoles.internRoleId);

  const guildSettings = await db.collection("guildsettings").findOne({ guildId: GUILD_ID });
  if (Array.isArray(guildSettings?.roles?.driver)) {
    for (const r of guildSettings.roles.driver) rolesToRemove.add(String(r));
  }
  if (Array.isArray(guildSettings?.roles?.magang)) {
    for (const r of guildSettings.roles.magang) rolesToRemove.add(String(r));
  }

  const removed: string[] = [];
  await Promise.all(
    Array.from(rolesToRemove).map(async (roleId) => {
      try {
        const res = await fetch(
          `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordId}/roles/${roleId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
          }
        );
        if (res.ok || res.status === 204) {
          removed.push(roleId);
        }
      } catch {
        // User mungkin sudah tidak ada di guild Discord — abaikan
      }
    })
  );
  return removed;
}

async function invalidateCaches(discordId: string, userObjId?: string) {
  try {
    const keys = [`session:profile:${discordId}`, `trucky:members_map:${COMPANY_ID}`];
    if (userObjId) keys.push(`session:profile:${userObjId}`);
    await redis.del(...keys);
  } catch (err) {
    console.warn("[AccountHold] Redis invalidation warning:", err);
  }
}

/**
 * Menempatkan akun user ke status Hold (Soft-Freeze) 90 hari secara atomik & idempoten:
 * - Set accountHold.status = true, purgeScheduledAt = now + 90 hari, isDriver = false
 * - Jika kickFromTrucky = true (mis. keluar Discord), keluarkan juga dari Trucky VTC via Drivers' Hub API (steam_id)
 * - Cabut role Discord Driver/Intern bila masih ada di server
 * - Kirim email pemberitahuan via Resend (noreply@nismara.web.id)
 */
export async function placeUserOnHold(params: {
  discordId: string;
  reason: AccountHoldReason;
  kickFromTrucky?: boolean;
}) {
  const { discordId, reason, kickFromTrucky = false } = params;
  const client = await clientPromise;
  const db = client.db();

  const existingUser = await db.collection("users").findOne({
    $or: [{ discordId }, { id: discordId }],
  });

  if (!existingUser) {
    return {
      success: false,
      notFound: true,
      message: `User dengan discordId ${discordId} tidak ditemukan di koleksi users.`,
    };
  }

  // Idempotency guard: jika sudah dalam status hold (misal akibat kick Trucky memicu webhook member_kicked/member_left),
  // jangan reset tanggal purge dan jangan kirim email ganda.
  if (existingUser.accountHold?.status === true) {
    return {
      success: true,
      alreadyOnHold: true,
      discordId,
      purgeScheduledAt: existingUser.accountHold.purgeScheduledAt,
      reason: existingUser.accountHold.reason,
      truckyKick: { skipped: true, reason: "already_on_hold" },
      emailSent: false,
    };
  }

  const leftAt = new Date();
  const purgeScheduledAt = new Date(leftAt.getTime() + HOLD_DAYS * 24 * 60 * 60 * 1000);

  // Atomic gate: hanya 1 caller yang boleh mengubah status dari non-hold -> hold
  const updatedUser = await db.collection("users").findOneAndUpdate(
    {
      _id: existingUser._id,
      "accountHold.status": { $ne: true },
    },
    {
      $set: {
        isDriver: false,
        accountHold: {
          status: true,
          reason,
          leftAt,
          purgeScheduledAt,
          notified7d: false,
          notifiedEmailAt: null,
          restoredAt: null,
        },
        updatedAt: leftAt,
      },
    },
    { returnDocument: "after" }
  );

  if (!updatedUser) {
    return {
      success: true,
      alreadyOnHold: true,
      discordId,
      purgeScheduledAt: existingUser.accountHold?.purgeScheduledAt || purgeScheduledAt,
      truckyKick: { skipped: true, reason: "concurrent_hold" },
      emailSent: false,
    };
  }

  // 1. Jika user keluar Discord, kick juga dari Trucky VTC via Drivers' Hub API
  let truckyKickResult: { attempted: boolean; success: boolean; message?: string } = {
    attempted: false,
    success: false,
  };

  if (kickFromTrucky) {
    let steamId: string | null = updatedUser.steamId ? String(updatedUser.steamId) : null;

    // Fallback: ambil steam_id langsung dari Trucky API v2 jika belum tersimpan di DB
    if (!steamId && updatedUser.truckyId) {
      const profile = await getDriverStats(Number(updatedUser.truckyId));
      if (profile?.steam_profile?.steam_id) {
        steamId = String(profile.steam_profile.steam_id);
        await db.collection("users").updateOne(
          { _id: updatedUser._id },
          { $set: { steamId } }
        );
      }
    }

    if (steamId) {
      truckyKickResult.attempted = true;
      const kickRes = await kickTruckyMemberBySteamId(steamId);
      truckyKickResult.success = kickRes.success;
      truckyKickResult.message = kickRes.message;
    } else {
      truckyKickResult = {
        attempted: false,
        success: false,
        message: "steamId tidak ditemukan pada profil user",
      };
    }
  }

  // 2. Cabut role Discord Driver/Intern jika user masih berada di server Discord
  const removedRoles =
    reason !== "LEFT_DISCORD"
      ? await removeDiscordDriverRoles(discordId, db)
      : [];

  // 3. Invalidasi cache Redis Website
  await invalidateCaches(discordId, updatedUser._id.toString());

  // 4. Kirim email pemberitahuan 90 hari via Resend
  let emailSent = false;
  let emailError: string | undefined;
  if (updatedUser.email) {
    const mailRes = await sendAccountHoldEmail({
      to: String(updatedUser.email),
      name: String(updatedUser.name || "Driver"),
      reason,
      purgeScheduledAt,
    });
    emailSent = mailRes.success;
    emailError = mailRes.error;
    if (mailRes.success) {
      await db.collection("users").updateOne(
        { _id: updatedUser._id },
        { $set: { "accountHold.notifiedEmailAt": new Date() } }
      );
    }
  } else {
    emailError = "User tidak memiliki alamat email di database";
  }

  return {
    success: true,
    alreadyOnHold: false,
    discordId,
    name: updatedUser.name || null,
    truckyId: updatedUser.truckyId || null,
    reason,
    leftAt,
    purgeScheduledAt,
    truckyKick: truckyKickResult,
    removedRoles,
    emailSent,
    emailError,
  };
}

/**
 * Memulihkan akun dari status Hold 90 hari secara atomik ketika driver kembali bergabung.
 * - Set accountHold.status = false, isDriver = true
 * - Reset jatuh tempo garasi & mekanik agar tidak langsung kena tunggakan selama masa freeze
 * - Invalidasi cache Redis + kirim Email & Web Notification Welcome Back
 */
export async function restoreUserFromHold(params: { discordId: string }) {
  const { discordId } = params;
  const client = await clientPromise;
  const db = client.db();
  const now = new Date();

  const restoredUser = await db.collection("users").findOneAndUpdate(
    {
      $or: [{ discordId }, { id: discordId }],
      "accountHold.status": true,
    },
    {
      $set: {
        isDriver: true,
        "accountHold.status": false,
        "accountHold.purgeScheduledAt": null,
        "accountHold.notified7d": false,
        "accountHold.restoredAt": now,
        updatedAt: now,
      },
    },
    { returnDocument: "after" }
  );

  if (!restoredUser) {
    return {
      success: false,
      notOnHold: true,
      message: `User ${discordId} tidak ditemukan atau tidak sedang dalam status Hold.`,
    };
  }

  // Geser jatuh tempo sewa garasi & gaji mekanik yang terlewat selama masa freeze
  const garage = await db.collection("garages").findOne({ discordId });
  if (garage) {
    const garageSet: Record<string, any> = {};
    if (
      garage.status === "operational" &&
      garage.next_payment_date &&
      new Date(garage.next_payment_date) <= now
    ) {
      garageSet.next_payment_date = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
    if (garage.mechanics) {
      for (const spec of ["umum", "ban", "mesin"]) {
        const mech = garage.mechanics[spec];
        if (mech?.extendAt && new Date(mech.extendAt) <= now) {
          garageSet[`mechanics.${spec}.extendAt`] = new Date(
            now.getTime() + 7 * 24 * 60 * 60 * 1000
          );
        }
      }
    }
    if (Object.keys(garageSet).length > 0) {
      await db.collection("garages").updateOne({ _id: garage._id }, { $set: garageSet });
    }
  }

  await invalidateCaches(discordId, restoredUser._id.toString());

  // Kirim notifikasi web & email Welcome Back
  await sendPersonalNotification(
    discordId,
    "Selamat Datang Kembali! 🎉",
    "Status penahanan akun Anda telah dicabut. Seluruh data lama (NC, XP, armada, dan garasi) telah dipulihkan sepenuhnya.",
    "success",
    "/dashboard"
  );

  let emailSent = false;
  if (restoredUser.email) {
    const mailRes = await sendAccountRestoredEmail({
      to: String(restoredUser.email),
      name: String(restoredUser.name || "Driver"),
    });
    emailSent = mailRes.success;
  }

  return {
    success: true,
    discordId,
    name: restoredUser.name || null,
    restoredAt: now,
    emailSent,
  };
}
