import crypto from "crypto";
import type { Db } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { redis } from "@/lib/redis";
import { jsonNoCache } from "@/lib/antiCache";
import { getCompanyMemberStats, getCompanyMembersMap, getDriverStats } from "@/lib/trucky";
import { sendPersonalNotification } from "@/lib/services/NotificationService";
import { placeUserOnHold, restoreUserFromHold } from "@/lib/accountHold";
import { getWebConfig } from "@/lib/webConfig";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || "863959415702028318";
const COMPANY_ID = Number(process.env.TRUCKY_COMPANY_ID || "35643");

const APPLICATION_EVENTS = new Set([
  "application_created",
  "application_accepted",
  "application_rejected",
]);

const MEMBER_LEAVE_EVENTS = new Set(["member_left", "member_kicked"]);

const ACHIEVEMENT_EVENTS = new Set([
  "achievement_earned",
  "member_achievement_earned",
  "achievement_unlocked",
]);

function verifyTruckySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;
  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  const expectedBuf = Buffer.from(expectedHex, "utf8");
  const receivedBuf = Buffer.from(signatureHeader.trim().toLowerCase(), "utf8");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

async function sendDiscordMessage(channelId: string, message: string, embeds?: any[]) {
  if (!DISCORD_BOT_TOKEN || !channelId) return;
  const payload: any = {};
  if (message) payload.content = message;
  if (embeds && embeds.length > 0) payload.embeds = embeds;

  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }).catch((err) => console.error("[Trucky Webhook] Failed to send Discord message:", err));
}

async function sendDiscordDM(discordId: string, message: string, embeds?: any[]) {
  if (!DISCORD_BOT_TOKEN || !discordId) return;
  try {
    const res = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: discordId }),
    });
    if (res.ok) {
      const channel = await res.json();
      await sendDiscordMessage(channel.id, message, embeds);
    }
  } catch (e) {
    console.error("[Trucky Webhook] Failed to send Discord DM:", e);
  }
}

async function deleteDiscordChannel(channelId: string) {
  if (!DISCORD_BOT_TOKEN || !channelId) return;
  await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
    method: "DELETE",
    headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
  }).catch((err) => console.error("[Trucky Webhook] Failed to delete channel:", err));
}

async function assignDiscordRole(discordId: string, roleId: string) {
  if (!DISCORD_BOT_TOKEN || !GUILD_ID || !discordId || !roleId) return;
  await fetch(
    `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordId}/roles/${roleId}`,
    {
      method: "PUT",
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    }
  ).catch((err) => console.error("[Trucky Webhook] Failed to assign role:", err));
}

async function removeDiscordRole(discordId: string, roleId: string) {
  if (!DISCORD_BOT_TOKEN || !GUILD_ID || !discordId || !roleId) return;
  await fetch(
    `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordId}/roles/${roleId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    }
  ).catch((err) => console.error("[Trucky Webhook] Failed to remove role:", err));
}

async function invalidateSessionCache(discordId?: string, userObjId?: string) {
  try {
    const keys: string[] = [];
    if (discordId) keys.push(`session:profile:${discordId}`);
    if (userObjId) keys.push(`session:profile:${userObjId}`);
    if (keys.length > 0) await redis.del(...keys);
  } catch (err) {
    console.warn("[Trucky Webhook] Failed to invalidate Redis session cache:", err);
  }
}

function extractIdentifiers(payload: any, allowDataIdAsUser = false) {
  const data = payload?.data || {};
  const steamIdRaw =
    data?.steam_profile?.steam_id ??
    data?.user?.steam_profile?.steam_id ??
    data?.driver?.steam_profile?.steam_id ??
    data?.member?.steam_profile?.steam_id ??
    data?.steam_id ??
    payload?.steam_profile?.steam_id ??
    null;

  const truckyIdRaw =
    data?.user?.id ??
    data?.driver?.id ??
    data?.member?.id ??
    data?.user_id ??
    data?.driver_id ??
    data?.member_id ??
    (allowDataIdAsUser ? data?.id : undefined) ??
    payload?.user_id ??
    null;

  const steamId = steamIdRaw !== null && steamIdRaw !== undefined ? String(steamIdRaw).trim() : null;
  const truckyIdNum =
    truckyIdRaw !== null && truckyIdRaw !== undefined && Number.isFinite(Number(truckyIdRaw))
      ? Number(truckyIdRaw)
      : null;

  return { steamId: steamId || null, truckyId: truckyIdNum };
}

async function findDriverByTruckyOrSteam(
  db: Db,
  { steamId, truckyId }: { steamId: string | null; truckyId: number | null }
) {
  const userOrFilters: Record<string, any>[] = [];
  if (steamId) userOrFilters.push({ steamId });
  if (truckyId !== null) {
    userOrFilters.push({ truckyId });
    userOrFilters.push({ truckyId: String(truckyId) });
  }

  let user: any = null;
  if (userOrFilters.length > 0) {
    user = await db.collection("users").findOne({ $or: userOrFilters });
  }

  let driverLink: any = null;
  if (!user && truckyId !== null) {
    driverLink = await db.collection("driverlinks").findOne({
      guildId: GUILD_ID,
      truckyId: { $in: [truckyId, String(truckyId)] },
    });
    if (!driverLink) {
      driverLink = await db.collection("driverlinks").findOne({
        truckyId: { $in: [truckyId, String(truckyId)] },
      });
    }
    if (driverLink?.userId) {
      user = await db.collection("users").findOne({ discordId: String(driverLink.userId) });
    }
  }

  const discordId: string | null =
    (user?.discordId ? String(user.discordId) : null) ||
    (driverLink?.userId ? String(driverLink.userId) : null);
  const resolvedTruckyId: number | null =
    truckyId ??
    (user?.truckyId ? Number(user.truckyId) : null) ??
    (driverLink?.truckyId ? Number(driverLink.truckyId) : null);

  return { user, driverLink, discordId, truckyId: resolvedTruckyId };
}

/**
 * Handler 1: member_role_assigned
 * Auto-sync truckyRole / truckyRank / steamId + invalidasi cache Redis + Web Notification
 */
async function handleMemberRoleAssigned(db: Db, payload: any) {
  const ids = extractIdentifiers(payload, true);
  const { user, discordId, truckyId } = await findDriverByTruckyOrSteam(db, ids);

  if (!user || !discordId) {
    return jsonNoCache({
      success: true,
      ignored: true,
      event: "member_role_assigned",
      reason: "Driver tidak ditemukan di database",
    });
  }

  const data = payload?.data || {};
  const updateData: Record<string, any> = {
    lastTruckySync: new Date(),
    updatedAt: new Date(),
  };

  if (ids.steamId) {
    updateData.steamId = ids.steamId;
  }

  // Ambil langsung dari payload jika tersedia
  const payloadRole = data?.role || data?.user?.role;
  const payloadRank = data?.rank || data?.user?.rank;

  if (payloadRole) {
    updateData.truckyRole = typeof payloadRole === "object" ? payloadRole.name : String(payloadRole);
    if (typeof payloadRole === "object") {
      if (payloadRole.id) updateData.truckyRoleId = Number(payloadRole.id);
      if (payloadRole.color) updateData.truckyRoleColor = payloadRole.color;
    }
  }
  if (payloadRank) {
    updateData.truckyRank = typeof payloadRank === "object" ? payloadRank.name : String(payloadRank);
    if (typeof payloadRank === "object" && payloadRank.color) {
      updateData.truckyRankColor = payloadRank.color;
    }
  }

  // Jika payload tidak menyertakan objek role/rank lengkap, fetch live dari Trucky API
  if ((!updateData.truckyRole || !updateData.truckyRank) && truckyId) {
    try {
      const [memberStats, driverProfile] = await Promise.all([
        getCompanyMemberStats(COMPANY_ID, truckyId),
        getDriverStats(truckyId),
      ]);

      const roleObj = memberStats?.role || driverProfile?.role;
      if (roleObj) {
        updateData.truckyRole = typeof roleObj === "object" ? roleObj.name : String(roleObj);
        if (typeof roleObj === "object") {
          if (roleObj.id) updateData.truckyRoleId = Number(roleObj.id);
          if (roleObj.color) updateData.truckyRoleColor = roleObj.color;
        }
      }
      if (memberStats?.rank) {
        updateData.truckyRank =
          typeof memberStats.rank === "object" ? memberStats.rank.name : String(memberStats.rank);
        if (typeof memberStats.rank === "object" && memberStats.rank.color) {
          updateData.truckyRankColor = memberStats.rank.color;
        }
      }
      if (!updateData.steamId && driverProfile?.steam_profile?.steam_id) {
        updateData.steamId = String(driverProfile.steam_profile.steam_id);
      }
    } catch (err) {
      console.error("[Trucky Webhook] Failed fetching fresh role/rank:", err);
    }
  }

  await db.collection("users").updateOne({ _id: user._id }, { $set: updateData });

  // Invalidasi Redis session cache + company members map cache
  await invalidateSessionCache(discordId, user._id.toString());
  try {
    await redis.del(`trucky:members_map:${COMPANY_ID}`);
  } catch (err) {
    console.warn("[Trucky Webhook] Failed clearing members_map cache:", err);
  }

  const roleChanged = updateData.truckyRole && updateData.truckyRole !== user.truckyRole;
  const rankChanged = updateData.truckyRank && updateData.truckyRank !== user.truckyRank;

  if (roleChanged || rankChanged) {
    const parts: string[] = [];
    if (roleChanged) parts.push(`Role: **${updateData.truckyRole}**`);
    if (rankChanged) parts.push(`Rank: **${updateData.truckyRank}**`);

    await sendPersonalNotification(
      discordId,
      "Pembaruan Pangkat Trucky 🏅",
      `Status keanggotaan Anda di Trucky VTC telah diperbarui (${parts.join(" • ")}).`,
      "success",
      "/dashboard"
    );
  }

  return jsonNoCache({
    success: true,
    processed: "member_role_assigned",
    discordId,
    truckyRole: updateData.truckyRole || user.truckyRole || null,
    truckyRank: updateData.truckyRank || user.truckyRank || null,
  });
}

/**
 * Handler 1b: role_updated
 * Sinkronisasi nama & warna role (truckyRole, truckyRoleColor, truckyRoleId) ke seluruh driver pemegang role tersebut
 * + refresh Redis cache `trucky:members_map:*` dan invalidasi `session:profile:*`
 */
async function handleRoleUpdated(db: Db, payload: any) {
  const data = payload?.data || {};
  const roleId = Number(data?.id);
  const roleName = data?.name ? String(data.name) : null;
  const roleColor = data?.color ? String(data.color) : null;
  const targetCompanyId = Number(data?.company_id || COMPANY_ID);

  if (!Number.isFinite(roleId) || !roleName) {
    return jsonNoCache({
      success: true,
      ignored: true,
      event: "role_updated",
      reason: "Payload role_updated tidak memiliki id atau name",
    });
  }

  // Force refresh daftar member company agar tahu semua member yang memegang role_id ini (termasuk saat role di-rename)
  const membersMap = await getCompanyMembersMap(targetCompanyId, true);
  const matchingTruckyIds: number[] = [];
  for (const member of Object.values(membersMap || {})) {
    const mRoleId = Number((member as any)?.role_id ?? (member as any)?.role?.id);
    if (mRoleId === roleId && (member as any)?.id) {
      matchingTruckyIds.push(Number((member as any).id));
    }
  }

  const userOrFilters: Record<string, any>[] = [
    { truckyRoleId: roleId },
    { truckyRole: roleName },
  ];
  if (matchingTruckyIds.length > 0) {
    userOrFilters.push({
      truckyId: {
        $in: [...matchingTruckyIds, ...matchingTruckyIds.map((id) => String(id))],
      },
    });
  }

  const affectedUsers = await db
    .collection("users")
    .find(
      { $or: userOrFilters },
      { projection: { _id: 1, discordId: 1 } }
    )
    .toArray();

  const setFields: Record<string, any> = {
    truckyRoleId: roleId,
    truckyRole: roleName,
    updatedAt: new Date(),
  };
  if (roleColor) {
    setFields.truckyRoleColor = roleColor;
  }

  const updateRes = await db
    .collection("users")
    .updateMany({ $or: userOrFilters }, { $set: setFields });

  // Invalidasi Redis session cache seluruh driver yang terdampak
  if (affectedUsers.length > 0) {
    try {
      const cacheKeys: string[] = [];
      for (const u of affectedUsers) {
        if (u._id) cacheKeys.push(`session:profile:${u._id.toString()}`);
        if (u.discordId) cacheKeys.push(`session:profile:${String(u.discordId)}`);
      }
      if (cacheKeys.length > 0) {
        await redis.del(...cacheKeys);
      }
    } catch (err) {
      console.warn("[Trucky Webhook] Failed invalidating session caches on role_updated:", err);
    }
  }

  return jsonNoCache({
    success: true,
    processed: "role_updated",
    roleId,
    roleName,
    roleColor,
    matchedUsers: updateRes.matchedCount,
    modifiedUsers: updateRes.modifiedCount,
  });
}

/**
 * Handler 2: member_left & member_kicked
 * Menempatkan akun ke status Hold 90 Hari (soft-freeze + email Resend + cabut role Discord + log HR).
 * Tidak langsung purge agar data terjaga 90 hari dan tidak bentrok saat sistem kick otomatis dari Discord leave.
 */
async function handleMemberLeftOrKicked(db: Db, eventType: string, payload: any) {
  const ids = extractIdentifiers(payload, true);
  const { user, driverLink, discordId, truckyId } = await findDriverByTruckyOrSteam(db, ids);

  if (!discordId) {
    return jsonNoCache({
      success: true,
      ignored: true,
      event: eventType,
      reason: "Driver tidak ditemukan di database",
    });
  }

  const displayName =
    user?.name ||
    driverLink?.truckyName ||
    payload?.data?.name ||
    payload?.data?.steam_profile?.steam_username ||
    `Trucky #${truckyId}`;

  const reason = eventType === "member_kicked" ? "KICKED_TRUCKY" : "LEFT_TRUCKY";
  const holdResult = await placeUserOnHold({
    discordId,
    reason,
    kickFromTrucky: false,
  });

  // Jika sudah dalam status hold (misal baru saja dipicu keluar Discord / event member_kicked sebelumnya), skip notifikasi duplikat
  if (holdResult.alreadyOnHold) {
    return jsonNoCache({
      success: true,
      deduplicated: true,
      event: eventType,
      discordId,
      purgeScheduledAt: holdResult.purgeScheduledAt,
    });
  }

  const guildSettings = await db.collection("guildsettings").findOne({ guildId: GUILD_ID });
  if (guildSettings?.channelLog && holdResult.success) {
    const actionLabel = eventType === "member_kicked" ? "Dikeluarkan (Kicked)" : "Keluar (Left)";
    const deadlineText = holdResult.purgeScheduledAt
      ? new Date(holdResult.purgeScheduledAt).toLocaleString("id-ID", {
          timeZone: "Asia/Jakarta",
          day: "2-digit",
          month: "long",
          year: "numeric",
        }) + " WIB"
      : "90 hari dari sekarang";

    await sendDiscordMessage(guildSettings.channelLog, "", [
      {
        title: `⏳ Account Hold 90 Hari via Trucky Webhook (${actionLabel})`,
        description: `Driver <@${discordId}> (**${displayName}**, Trucky ID: \`${truckyId ?? "-"}\`) terdeteksi **${actionLabel}** dari Trucky VTC.\n\nData akun **ditahan & dibekukan selama 90 hari** hingga **${deadlineText}** sebelum di-purge otomatis. Role Driver/Intern telah dicabut.\n• **Email Pemberitahuan (Resend):** ${holdResult.emailSent ? "✅ Terkirim" : "⚠️ Tidak terkirim / tidak ada email"}`,
        color: 0xf59e0b,
        footer: { text: "Nismara Transport • 90-Day Retention System" },
        timestamp: new Date().toISOString(),
      },
    ]);
  }

  return jsonNoCache({
    success: true,
    processed: eventType,
    discordId,
    truckyId,
    holdApplied: holdResult.success,
    purgeScheduledAt: holdResult.purgeScheduledAt || null,
    emailSent: holdResult.emailSent || false,
  });
}

/**
 * Handler 2b: user_joined_company
 * Auto-Restore jika eks-driver kembali bergabung ke Trucky VTC dalam masa Hold 90 Hari
 * (memastikan user juga sudah berada di server Discord Nismara).
 */
async function handleUserJoinedCompany(db: Db, payload: any) {
  const ids = extractIdentifiers(payload, true);
  const { user, discordId, truckyId } = await findDriverByTruckyOrSteam(db, ids);

  if (!user || !discordId || user.accountHold?.status !== true) {
    return jsonNoCache({
      success: true,
      ignored: true,
      event: "user_joined_company",
      reason: "Bukan akun dalam status Hold 90 Hari",
    });
  }

  // Pastikan user sudah bergabung kembali ke server Discord Nismara
  if (DISCORD_BOT_TOKEN && GUILD_ID) {
    const memberRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordId}`,
      {
        headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
      }
    ).catch(() => null);

    if (!memberRes || !memberRes.ok) {
      return jsonNoCache({
        success: true,
        ignored: true,
        event: "user_joined_company",
        discordId,
        reason: "User belum bergabung kembali ke server Discord Nismara",
      });
    }
  }

  const restoreRes = await restoreUserFromHold({ discordId });

  // Berikan kembali role Intern/Driver sesuai konfigurasi
  const webConfig = await getWebConfig();
  if (restoreRes.success && webConfig.discordRoles.driverRoleId) {
    await assignDiscordRole(discordId, webConfig.discordRoles.driverRoleId);
  }

  const guildSettings = await db.collection("guildsettings").findOne({ guildId: GUILD_ID });
  if (guildSettings?.channelLog && restoreRes.success) {
    await sendDiscordMessage(guildSettings.channelLog, "", [
      {
        title: "🎉 Akun Dipulihkan Otomatis (Welcome Back!)",
        description: `Eks-driver <@${discordId}> (**${user.name || "Driver"}**, Trucky ID: \`${truckyId ?? "-"}\`) telah bergabung kembali dalam masa Hold 90 Hari.\n\nSeluruh data lama (NC, XP, armada, dan garasi) telah dipulihkan secara otomatis.`,
        color: 0x16a34a,
        footer: { text: "Nismara Transport • 90-Day Retention System" },
        timestamp: new Date().toISOString(),
      },
    ]);
  }

  return jsonNoCache({
    success: true,
    processed: "user_joined_company",
    restored: restoreRes.success,
    discordId,
    truckyId,
  });
}

/**
 * Handler 3: job_deleted
 * Tandai jobhistories sebagai DELETED (atomik) + buat SecurityAlert agar Manager dapat mengaudit NC/XP
 */
async function handleJobDeleted(db: Db, payload: any) {
  const data = payload?.data || {};
  const rawJobId = data?.id ?? data?.job_id ?? payload?.job_id;
  if (rawJobId === undefined || rawJobId === null) {
    return jsonNoCache({
      success: true,
      ignored: true,
      event: "job_deleted",
      reason: "Missing job_id in payload",
    });
  }

  const jobIdNum = Number(rawJobId);
  const jobIdFilter = Number.isFinite(jobIdNum)
    ? { $in: [jobIdNum, String(rawJobId)] }
    : String(rawJobId);

  const flaggedJob = await db.collection("jobhistories").findOneAndUpdate(
    {
      jobId: jobIdFilter,
      jobStatus: { $ne: "DELETED" },
    },
    {
      $set: {
        jobStatus: "DELETED",
        deletedByTrucky: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { returnDocument: "before" }
  );

  if (!flaggedJob) {
    return jsonNoCache({
      success: true,
      ignored: true,
      event: "job_deleted",
      jobId: rawJobId,
      reason: "Job tidak ditemukan di jobhistories atau sudah ditandai DELETED",
    });
  }

  const ids = extractIdentifiers(payload, false);
  let targetDiscordId = flaggedJob.driverId ? String(flaggedJob.driverId) : null;
  if (!targetDiscordId) {
    const resolved = await findDriverByTruckyOrSteam(db, ids);
    targetDiscordId = resolved.discordId;
  }

  const ncAwarded = Number(
    flaggedJob?.nc?.total ?? flaggedJob?.nc?.net ?? flaggedJob?.ncEarned ?? 0
  );
  const distanceKm = Number(flaggedJob?.distanceKm ?? 0);

  // Buat SecurityAlert di koleksi securityalerts agar muncul di /dashboard/manage/security
  await db.collection("securityalerts").insertOne({
    discordId: targetDiscordId || `trucky:${flaggedJob.truckyId || ids.truckyId || "unknown"}`,
    action: "TRUCKY_JOB_DELETED",
    amount: Math.max(0, Math.round(ncAwarded)),
    details: `Job #${rawJobId} (${distanceKm} km, status awal: ${flaggedJob.jobStatus || "UNKNOWN"}, NC: ${ncAwarded} NC) dihapus di Trucky VTC Hub. Status di jobhistories telah ditandai DELETED; mohon audit koreksi NC/XP bila diperlukan.`,
    isResolved: false,
    createdAt: new Date(),
  });

  return jsonNoCache({
    success: true,
    processed: "job_deleted",
    jobId: rawJobId,
    driverId: targetDiscordId,
    previousStatus: flaggedJob.jobStatus || null,
    ncAwarded,
  });
}

/**
 * Handler 4: achievement_earned / member_achievement_earned / achievement_unlocked
 * Simpan ke userachievements secara idempoten + kirim Web Notification
 */
async function handleAchievementEarned(db: Db, eventType: string, payload: any) {
  const data = payload?.data || {};
  const ids = extractIdentifiers(payload, false);
  const { discordId, truckyId } = await findDriverByTruckyOrSteam(db, ids);

  if (!discordId) {
    return jsonNoCache({
      success: true,
      ignored: true,
      event: eventType,
      reason: "Driver tidak ditemukan di database",
    });
  }

  const achievementName =
    data?.achievement?.name ||
    data?.name ||
    data?.title ||
    null;
  const achievementCode =
    data?.achievement?.code ||
    data?.achievement?.id ||
    data?.codeId ||
    null;

  const achOrFilters: Record<string, any>[] = [];
  if (achievementName) {
    const escaped = String(achievementName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    achOrFilters.push({ name: { $regex: new RegExp(`^${escaped}$`, "i") } });
  }
  if (achievementCode !== null && achievementCode !== undefined) {
    achOrFilters.push({ codeId: String(achievementCode) });
  }

  if (achOrFilters.length === 0) {
    return jsonNoCache({
      success: true,
      ignored: true,
      event: eventType,
      reason: "Nama/kode achievement tidak ditemukan di payload",
    });
  }

  const targetAchievement = await db.collection("achievements").findOne({ $or: achOrFilters });
  if (!targetAchievement) {
    return jsonNoCache({
      success: true,
      ignored: true,
      event: eventType,
      reason: `Achievement '${achievementName || achievementCode}' belum terdaftar di master achievements`,
    });
  }

  // Deduplikasi (mencegah dobel insert jika Silvia/achievementsWatcher juga mencatatnya dalam 5 menit terakhir)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const existingRecent = await db.collection("userachievements").findOne({
    discordId,
    achievementId: targetAchievement._id,
    createdAt: { $gte: fiveMinutesAgo },
  });

  if (existingRecent) {
    return jsonNoCache({
      success: true,
      deduplicated: true,
      event: eventType,
      achievement: targetAchievement.name,
    });
  }

  await db.collection("userachievements").insertOne({
    discordId,
    truckyId: truckyId ?? null,
    achievementId: targetAchievement._id,
    remarks: "Otomatis direkam dari Trucky API Webhook",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await sendPersonalNotification(
    discordId,
    "Achievement Baru Diraih! 🏆",
    `Selamat! Anda baru saja meraih pencapaian **${targetAchievement.name}** di Trucky VTC.`,
    "success",
    "/achievements"
  );

  return jsonNoCache({
    success: true,
    processed: eventType,
    discordId,
    achievement: targetAchievement.name,
  });
}

export async function POST(req: Request) {
  try {
    // 1. Baca raw body terlebih dahulu (wajib untuk validasi HMAC SHA-256 langsung dari Trucky)
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-signature-sha256");
    const legacySecretHeader = req.headers.get("x-webhook-secret");

    const truckyKey = process.env.TRUCKY_WEBHOOK_KEY;
    const legacySecret = process.env.TRUCKY_WEBHOOK_SECRET;

    if (!truckyKey && !legacySecret) {
      console.error(
        "[Trucky Webhook] Neither TRUCKY_WEBHOOK_KEY nor TRUCKY_WEBHOOK_SECRET is configured"
      );
      return jsonNoCache(
        { error: "Server Error: Webhook key not configured" },
        { status: 500 }
      );
    }

    const isValidHmac =
      Boolean(truckyKey && signatureHeader) &&
      verifyTruckySignature(rawBody, signatureHeader, truckyKey!);
    const isValidLegacy =
      Boolean(legacySecret && legacySecretHeader) &&
      legacySecretHeader === legacySecret;

    if (!isValidHmac && !isValidLegacy) {
      console.warn("[Trucky Webhook] Unauthorized: Invalid signature or secret");
      return jsonNoCache({ error: "Unauthorized. Invalid Signature." }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return jsonNoCache({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const type: string | undefined = payload?.event || payload?.type;
    if (!type) {
      return jsonNoCache({ error: "Invalid payload, missing event/type" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    // --- ROUTE EVENT HANDLERS ---
    if (type === "role_updated") {
      return await handleRoleUpdated(db, payload);
    }

    if (type === "member_role_assigned") {
      return await handleMemberRoleAssigned(db, payload);
    }

    if (MEMBER_LEAVE_EVENTS.has(type)) {
      return await handleMemberLeftOrKicked(db, type, payload);
    }

    if (type === "user_joined_company") {
      return await handleUserJoinedCompany(db, payload);
    }

    if (type === "job_deleted") {
      return await handleJobDeleted(db, payload);
    }

    if (ACHIEVEMENT_EVENTS.has(type)) {
      // Sementara ditahan hingga format payload live dari Trucky terverifikasi
      return jsonNoCache({
        success: true,
        ignored: true,
        event: type,
        reason: "Achievement webhook paused pending live payload verification",
      });
    }

    if (!APPLICATION_EVENTS.has(type)) {
      // Abaikan event lain dengan 200 OK agar Trucky tidak melakukan retry terus-menerus
      return jsonNoCache({ success: true, ignored: true, event: type });
    }

    // --- LEGACY / APPLICATION EVENTS ---
    const rawTruckyId =
      payload?.data?.user?.id ?? payload?.data?.user_id ?? payload?.user_id;
    const truckyId =
      rawTruckyId !== undefined && rawTruckyId !== null ? String(rawTruckyId) : null;

    if (!truckyId) {
      return jsonNoCache({
        success: true,
        ignored: true,
        event: type,
        reason: "Missing user_id",
      });
    }

    const registration = await db.collection("registrations").findOne({
      truckyId: { $in: [truckyId, Number(truckyId)] },
      status: "pending",
    });

    if (!registration) {
      return jsonNoCache({
        success: true,
        ignored: true,
        event: type,
        reason: "No pending registration found for this truckyId",
      });
    }

    const { _id, managerId, userId: discordId, username } = registration;
    const discordChannelId = registration.discordChannelId || registration.channelId;

    if (type === "application_created") {
      if (discordChannelId) {
        const mention = managerId ? `<@${managerId}>` : "Tim HR";
        await sendDiscordMessage(
          discordChannelId,
          `🔔 <@${discordId}> Pendaftaran Anda sedang divalidasi oleh sistem. ${mention}, mohon cek Trucky VTC!`,
          [
            {
              title: "📥 Lamaran Diterima di Trucky",
              description:
                "Pendaftar baru saja melakukan *apply* langsung ke VTC Trucky!\nMohon segera periksa dan ambil keputusan (Terima/Tolak) di Dashboard Trucky VTC.",
              color: 3447003,
              footer: { text: "Sistem Pendaftaran Nismara Transport" },
              timestamp: new Date().toISOString(),
            },
          ]
        );
      }
    } else if (type === "application_accepted") {
      const locked = await db.collection("registrations").findOneAndUpdate(
        { _id, status: "pending" },
        { $set: { status: "approved", updatedAt: new Date() } },
        { returnDocument: "after" }
      );
      if (!locked) {
        return jsonNoCache({ success: true, ignored: true, reason: "Already processed" });
      }

      await db.collection("driverlinks").updateOne(
        { userId: discordId },
        {
          $set: {
            guildId: GUILD_ID,
            userId: discordId,
            truckyId: Number(truckyId),
            truckyName: username,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );

      const ids = extractIdentifiers(payload, false);
      const userSet: Record<string, any> = {
        discordId,
        truckyId: Number(truckyId),
        isDriver: true,
        updatedAt: new Date(),
      };
      if (ids.steamId) userSet.steamId = ids.steamId;

      const userDoc = await db.collection("users").findOneAndUpdate(
        { $or: [{ discordId }, { id: discordId }] },
        { $set: userSet },
        { upsert: true, returnDocument: "after" }
      );

      await invalidateSessionCache(discordId, userDoc?._id?.toString());

      const webConfig = await getWebConfig();
      if (webConfig.discordRoles.internRoleId) {
        await assignDiscordRole(discordId, webConfig.discordRoles.internRoleId);
      }

      await sendDiscordDM(discordId, `Halo <@${discordId}>,`, [
        {
          title: "🎉 SELAMAT! Lamaran Anda Diterima",
          description:
            "Lamaran Anda ke VTC Nismara Transport telah **DITERIMA**.\nAnda sekarang resmi menjadi Intern kami. Silakan kembali ke server Discord, role Anda telah kami sesuaikan!",
          color: 3066993,
          thumbnail: { url: "https://images.nismara.my.id/nismara-logo.png" },
          footer: { text: "Nismara Transport HR" },
          timestamp: new Date().toISOString(),
        },
      ]);

      if (managerId) {
        await sendDiscordDM(managerId, `Halo <@${managerId}>,`, [
          {
            title: "📌 PENGINGAT SOP HR: Anggota Baru Diterima",
            description: `Pendaftar dengan Discord <@${discordId}> (**${username}**) baru saja resmi diterima masuk ke VTC Nismara Transport.\n\nSesuai SOP, mohon segera hubungi (DM atau mention) anggota baru tersebut untuk **memberikan sambutan selamat datang** dan **memberikan Guide Book** agar mereka mengerti peraturan dan tata cara bermain di Nismara Transport.`,
            color: 3447003,
            footer: { text: "Nismara Transport HR System" },
            timestamp: new Date().toISOString(),
          },
        ]);
      }

      if (discordChannelId) {
        await deleteDiscordChannel(discordChannelId);
      }
    } else if (type === "application_rejected") {
      const locked = await db.collection("registrations").findOneAndUpdate(
        { _id, status: "pending" },
        { $set: { status: "rejected", updatedAt: new Date() } },
        { returnDocument: "after" }
      );
      if (!locked) {
        return jsonNoCache({ success: true, ignored: true, reason: "Already processed" });
      }

      await sendDiscordDM(discordId, `Halo <@${discordId}>,`, [
        {
          title: "❌ Mohon Maaf, Lamaran Anda Ditolak",
          description:
            "Lamaran Anda ke VTC Nismara Transport telah **DITOLAK** di Trucky.\nTerima kasih atas ketertarikan Anda. Jangan menyerah dan mungkin kita bisa bertemu di lain kesempatan!",
          color: 15158332,
          thumbnail: { url: "https://images.nismara.my.id/nismara-logo.png" },
          footer: { text: "Nismara Transport HR" },
          timestamp: new Date().toISOString(),
        },
      ]);

      if (discordChannelId) {
        await deleteDiscordChannel(discordChannelId);
      }
    }

    return jsonNoCache({ success: true, processed: type });
  } catch (error: any) {
    console.error("Webhook Trucky Error:", error);
    return jsonNoCache({ error: error.message }, { status: 500 });
  }
}
