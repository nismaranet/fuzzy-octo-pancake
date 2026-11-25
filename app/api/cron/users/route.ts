import User from "@/lib/models/User";
import { sendPersonalNotification } from "@/lib/services/NotificationService";
import dbConnect from "@/lib/mongoose";
import { redis } from "@/lib/redis";
import { jsonNoCache } from "@/lib/antiCache";
import { sendAccountHoldReminderEmail, sendAccountPurgedEmail } from "@/lib/email";
import { DELETE as executeUserPurge } from "@/app/api/manage/users/[discordId]/purge/route";
import clientPromise from "@/lib/mongodb";
import { refreshStaleActiveDrivingScores } from "@/lib/drivingScore";
import { getWebConfig } from "@/lib/webConfig";

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

async function sendDiscordDM(discordId: string, embed: Record<string, any>) {
  if (!DISCORD_BOT_TOKEN || !discordId) return;
  try {
    const channelRes = await fetch(
      "https://discord.com/api/v10/users/@me/channels",
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipient_id: discordId }),
      },
    );
    if (!channelRes.ok) return;

    const dmChannel = await channelRes.json();
    if (!dmChannel?.id) return;

    await fetch(
      `https://discord.com/api/v10/channels/${dmChannel.id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ embeds: [embed] }),
      },
    );
  } catch (err) {
    console.warn(
      `[Cron Users] Failed to send Discord DM to ${discordId}:`,
      err,
    );
  }
}

async function invalidateUserSessionCache(userId: string, discordId?: string) {
  try {
    const keys = [`session:profile:${userId}`];
    if (discordId) keys.push(`session:profile:${discordId}`);
    await redis.del(...keys);
  } catch (err) {
    console.warn(`[Cron Users] Failed to invalidate Redis session cache:`, err);
  }
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (
      !process.env.CRON_SECRET ||
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return jsonNoCache({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const now = new Date();

    const expiredUsers = await User.find({
      $or: [
        {
          "nismaraplus.status": true,
          "nismaraplus.expiredAt": { $ne: null, $lte: now },
        },
        {
          "insurance.status": true,
          "insurance.expiredAt": { $ne: null, $lte: now },
        },
        {
          "galleryBan.status": true,
          "galleryBan.expiredAt": { $ne: null, $lte: now },
        },
        {
          "topManager.status": true,
          "topManager.expiredAt": { $ne: null, $lte: now },
        },
      ],
    });

    let nismaraPlusCount = 0;
    let insuranceCount = 0;
    let galleryBanCount = 0;
    let topManagerCount = 0;

    for (const user of expiredUsers) {
      let anyModified = false;

      // 1. Atomic expiry: Nismara+
      if (
        user.nismaraplus?.status === true &&
        user.nismaraplus.expiredAt &&
        user.nismaraplus.expiredAt <= now
      ) {
        const res = await User.updateOne(
          {
            _id: user._id,
            "nismaraplus.status": true,
            "nismaraplus.expiredAt": { $ne: null, $lte: now },
          },
          {
            $set: {
              "nismaraplus.status": false,
              "nismaraplus.startedAt": null,
              "nismaraplus.expiredAt": null,
              "nismaraplus.notified3d": false,
            },
          },
        );

        if (res.modifiedCount > 0) {
          anyModified = true;
          nismaraPlusCount++;

          const plusRoleId = (await getWebConfig()).discordRoles.nismaraPlusRoleId;
          if (
            DISCORD_BOT_TOKEN &&
            GUILD_ID &&
            plusRoleId &&
            user.discordId
          ) {
            await fetch(
              `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${user.discordId}/roles/${plusRoleId}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
                },
              },
            ).catch((err) =>
              console.error(
                `Failed to remove Nismara+ role for ${user.discordId}`,
                err,
              ),
            );
          }

          await sendPersonalNotification(
            user.discordId,
            "Nismara+ Berakhir 👑",
            "Masa aktif langganan Nismara+ Anda telah berakhir. Terima kasih telah berlangganan dan mendukung Nismara! Anda dapat memperbaruinya di halaman pembelian jika ingin menikmati kembali fitur premium.",
            "info",
            "/dashboard",
          );

          await sendDiscordDM(user.discordId, {
            title: "❌ Langganan Nismara+ Berakhir",
            description:
              "Masa aktif langganan **Nismara+** kamu telah habis. Terima kasih telah menggunakan layanan Nismara+!",
            color: 0xef4444,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // 2. Atomic expiry: Insurance
      if (
        user.insurance?.status === true &&
        user.insurance.expiredAt &&
        user.insurance.expiredAt <= now
      ) {
        const startedAt = user.insurance.startedAt;
        const expiredAt = user.insurance.expiredAt;
        const res = await User.updateOne(
          {
            _id: user._id,
            "insurance.status": true,
            "insurance.expiredAt": { $ne: null, $lte: now },
          },
          {
            $set: {
              "insurance.status": false,
              "insurance.startedAt": null,
              "insurance.expiredAt": null,
            },
          },
        );

        if (res.modifiedCount > 0) {
          anyModified = true;
          insuranceCount++;

          await sendPersonalNotification(
            user.discordId,
            "Asuransi Kedaluwarsa 🛡️",
            "Polis Asuransi Pengemudi Anda telah hangus hari ini! Segera perbarui polis Anda untuk menghindari menanggung 100% biaya jika terjadi kecelakaan.",
            "warning",
            "/dashboard/insurance",
          );

          const periodStr =
            startedAt && expiredAt
              ? `${new Date(startedAt).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })} - ${new Date(expiredAt).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}`
              : "Periode berakhir";

          await sendDiscordDM(user.discordId, {
            title: "🔔 Asuransi Anda Telah Berakhir",
            description: `Polis Asuransi Pengemudi Anda (${periodStr}) telah berakhir. Segera perbarui polis Anda di dashboard agar tetap terlindungi.`,
            color: 0xef4444,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // 3. Atomic expiry: Gallery Ban
      if (
        user.galleryBan?.status === true &&
        user.galleryBan.expiredAt &&
        user.galleryBan.expiredAt <= now
      ) {
        const res = await User.updateOne(
          {
            _id: user._id,
            "galleryBan.status": true,
            "galleryBan.expiredAt": { $ne: null, $lte: now },
          },
          {
            $set: {
              "galleryBan.status": false,
              "galleryBan.expiredAt": null,
              "galleryBan.reason": null,
            },
          },
        );

        if (res.modifiedCount > 0) {
          anyModified = true;
          galleryBanCount++;

          await sendPersonalNotification(
            user.discordId,
            "Gallery Unbanned ⚖️",
            "Masa hukuman Anda dari Nismara Social Gallery telah selesai. Hak akses Anda untuk memposting telah dipulihkan. Mohon selalu mematuhi peraturan komunitas.",
            "success",
            "/dashboard/gallery",
          );
        }
      }

      // 4. Atomic expiry: Top Manager
      if (
        user.topManager?.status === true &&
        user.topManager.expiredAt &&
        user.topManager.expiredAt <= now
      ) {
        const res = await User.updateOne(
          {
            _id: user._id,
            "topManager.status": true,
            "topManager.expiredAt": { $ne: null, $lte: now },
          },
          {
            $set: {
              "topManager.status": false,
            },
          },
        );

        if (res.modifiedCount > 0) {
          anyModified = true;
          topManagerCount++;

          await sendPersonalNotification(
            user.discordId,
            "Masa Gelar Top Manager Berakhir 👑",
            "Masa aktif gelar Top Manager Anda untuk periode sebelumnya telah berakhir. Capai kembali 100 poin di bulan ini untuk mempertahankan mahkota dan badge Anda!",
            "info",
            "/dashboard/manage/payroll",
          );
        }
      }

      if (anyModified) {
        await invalidateUserSessionCache(user._id.toString(), user.discordId);
      }
    }

    // 5. Account Hold 90 Hari: Pengingat H-7 & Auto-Purge setelah melewati batas 90 hari
    let accountHoldReminders = 0;
    let accountHoldPurged = 0;
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 5a. Pengingat H-7 sebelum purge permanen via Resend
    const remindingUsers = await User.find({
      "accountHold.status": true,
      "accountHold.notified7d": { $ne: true },
      "accountHold.purgeScheduledAt": { $ne: null, $gt: now, $lte: sevenDaysFromNow },
    });

    for (const user of remindingUsers) {
      const lockRes = await User.updateOne(
        {
          _id: user._id,
          "accountHold.status": true,
          "accountHold.notified7d": { $ne: true },
        },
        { $set: { "accountHold.notified7d": true } }
      );
      if (lockRes.modifiedCount === 0) continue;

      if (user.email && user.accountHold?.purgeScheduledAt) {
        const mailRes = await sendAccountHoldReminderEmail({
          to: String(user.email),
          name: String(user.name || "Driver"),
          purgeScheduledAt: new Date(user.accountHold.purgeScheduledAt),
        });
        if (mailRes.success) {
          accountHoldReminders++;
        }
      }
    }

    // 5b. Auto-Purge Permanen untuk user yang telah melewati masa Hold 90 Hari
    const botSecret = process.env.NISMARA_SECRET_API;
    if (botSecret) {
      const duePurgeUsers = await User.find({
        "accountHold.status": true,
        "accountHold.purgeScheduledAt": { $ne: null, $lte: now },
      });

      for (const user of duePurgeUsers) {
        if (!user.discordId) continue;
        const userEmail = user.email ? String(user.email) : null;
        const userName = String(user.name || "Driver");

        try {
          const internalReq = new Request(
            `http://internal/api/manage/users/${encodeURIComponent(user.discordId)}/purge`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${botSecret}`,
              },
            }
          );
          const purgeRes = await executeUserPurge(internalReq, {
            params: Promise.resolve({ discordId: String(user.discordId) }),
          });
          const purgeData = await purgeRes.json().catch(() => ({}));

          if (purgeRes.ok && !purgeData?.deduplicated) {
            accountHoldPurged++;
            if (userEmail) {
              await sendAccountPurgedEmail({ to: userEmail, name: userName });
            }
          }
        } catch (purgeErr) {
          console.error(`[Cron Users] Failed auto-purge for held user ${user.discordId}:`, purgeErr);
        }
      }
    }

    // 6. Refresh status Driving Score (active -> inactive jika <5 job dalam 30 hari terakhir)
    let drivingScoresRefreshed = 0;
    try {
      const mongoClient = await clientPromise;
      drivingScoresRefreshed = await refreshStaleActiveDrivingScores(mongoClient.db(), 25);
    } catch (dsErr) {
      console.error("[Cron Users] Failed refreshing driving scores:", dsErr);
    }

    return jsonNoCache({
      success: true,
      processed: {
        nismaraPlusExpiring: nismaraPlusCount,
        insuranceExpiring: insuranceCount,
        galleryBanLifting: galleryBanCount,
        topManagerExpiring: topManagerCount,
        accountHoldReminders,
        accountHoldPurged,
        drivingScoresRefreshed,
      },
    });
  } catch (error: any) {
    console.error("Cron Users Error:", error);
    return jsonNoCache({ error: error.message }, { status: 500 });
  }
}
