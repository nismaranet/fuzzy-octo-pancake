import NextAuth, { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { getCompanyMemberStats, getDriverStats } from "@/lib/trucky";
import { redis } from "@/lib/redis";
import { getWebConfig } from "@/lib/webConfig";
import {
  STAFF_SESSION_MAX_AGE_MS,
  LAST_ACTIVE_THROTTLE_MS,
  extractRequestFingerprint,
  isPrivilegedUser,
  recordSessionSecurityAlert,
  notifySessionAnomaly,
} from "@/lib/sessionSecurity";

const baseAdapter = MongoDBAdapter(clientPromise);

const customAdapter: any = {
  ...baseAdapter,
  async getUserByAccount(provider_providerAccountId: {
    provider: string;
    providerAccountId: string;
  }) {
    const userByAccount =
      await baseAdapter.getUserByAccount!(provider_providerAccountId);
    if (userByAccount) return userByAccount;

    // Fallback: Jika belum ada di `accounts`, tapi sudah ada di `users` dengan discordId ini
    if (provider_providerAccountId.provider === "discord") {
      const client = await clientPromise;
      const db = client.db();
      const discordId = String(provider_providerAccountId.providerAccountId);
      const existing = await db.collection("users").findOne({
        $or: [{ discordId: discordId }, { id: discordId }],
      });
      if (existing) {
        return {
          id: existing._id.toString(),
          name: existing.name || "Driver",
          email: existing.email || "",
          image: existing.image || null,
          emailVerified: existing.emailVerified || null,
        };
      }
    }
    return null;
  },
  async createUser(data: any) {
    const client = await clientPromise;
    const db = client.db();
    const discordId = data.id || data.discordId;

    const existing = await db.collection("users").findOne({
      $or: [
        ...(discordId
          ? [{ discordId: String(discordId) }, { id: String(discordId) }]
          : []),
      ],
    });

    if (existing) {
      await db.collection("users").updateOne(
        { _id: existing._id },
        {
          $set: {
            email: data.email || existing.email,
            image: data.image || existing.image,
            discordId: discordId ? String(discordId) : existing.discordId,
            updatedAt: new Date(),
          },
        },
      );
      return {
        id: existing._id.toString(),
        name: existing.name || data.name,
        email: data.email || existing.email,
        image: data.image || existing.image,
        emailVerified: existing.emailVerified || null,
      };
    }

    try {
      return await baseAdapter.createUser!(data);
    } catch (err: any) {
      // Resilience terhadap race condition unique index discordId_unique (E11000)
      if (err?.code === 11000 && discordId) {
        const dup = await db.collection("users").findOne({
          discordId: String(discordId),
        });
        if (dup) {
          return {
            id: dup._id.toString(),
            name: dup.name || data.name,
            email: data.email || dup.email || "",
            image: data.image || dup.image || null,
            emailVerified: dup.emailVerified || null,
          };
        }
      }
      throw err;
    }
  },
  async linkAccount(account: any) {
    // Jangan pernah menyimpan token OAuth Discord (access_token/refresh_token/id_token) ke database
    const sanitized = { ...account };
    delete sanitized.access_token;
    delete sanitized.refresh_token;
    delete sanitized.id_token;
    return baseAdapter.linkAccount!(sanitized);
  },
  async createSession(session: { sessionToken: string; userId: string; expires: Date }) {
    const created = await baseAdapter.createSession!(session);
    try {
      const client = await clientPromise;
      const db = client.db();
      const userFilter = ObjectId.isValid(created.userId)
        ? { _id: new ObjectId(created.userId) }
        : ({ _id: created.userId } as any);
      const dbUser = await db.collection("users").findOne(userFilter);

      const now = new Date();
      const privileged = await isPrivilegedUser(dbUser);
      const effectiveExpires = privileged
        ? new Date(Math.min(created.expires.getTime(), now.getTime() + STAFF_SESSION_MAX_AGE_MS))
        : created.expires;

      const fp = await extractRequestFingerprint();
      await db.collection("sessions").updateOne(
        { sessionToken: created.sessionToken },
        {
          $set: {
            expires: effectiveExpires,
            ...(fp
              ? {
                  securityMeta: {
                    ...fp,
                    createdAt: now,
                    lastActiveAt: now,
                  },
                }
              : {}),
          },
        },
      );
      return { ...created, expires: effectiveExpires };
    } catch (err) {
      console.error("❌ [AUTH] Error binding session fingerprint:", err);
      return created;
    }
  },
  async updateSession(session: any) {
    try {
      if (session?.expires) {
        const client = await clientPromise;
        const db = client.db();
        const sessionDoc = await db
          .collection("sessions")
          .findOne({ sessionToken: session.sessionToken });
        if (sessionDoc?.securityMeta?.createdAt) {
          const userFilter =
            sessionDoc.userId instanceof ObjectId || ObjectId.isValid(String(sessionDoc.userId))
              ? { _id: new ObjectId(String(sessionDoc.userId)) }
              : ({ _id: sessionDoc.userId } as any);
          const dbUser = await db.collection("users").findOne(userFilter);
          if (await isPrivilegedUser(dbUser)) {
            const hardCap =
              new Date(sessionDoc.securityMeta.createdAt).getTime() +
              STAFF_SESSION_MAX_AGE_MS;
            if (new Date(session.expires).getTime() > hardCap) {
              session = { ...session, expires: new Date(hardCap) };
            }
          }
        }
      }
    } catch (err) {
      console.error("❌ [AUTH] Error clamping staff session expiry:", err);
    }
    return baseAdapter.updateSession!(session);
  },
  async getSessionAndUser(sessionToken: string) {
    const res = await baseAdapter.getSessionAndUser!(sessionToken);
    if (!res) return null;

    try {
      const client = await clientPromise;
      const db = client.db();
      const userIdStr = String(res.user.id);
      const userFilter = ObjectId.isValid(userIdStr)
        ? { _id: new ObjectId(userIdStr) }
        : ({ _id: userIdStr } as any);

      const [sessionDoc, dbUser] = await Promise.all([
        db.collection("sessions").findOne({ sessionToken }),
        db.collection("users").findOne(userFilter),
      ]);

      const privileged = dbUser ? await isPrivilegedUser(dbUser) : false;

      // 1. Paksa hard cap 48 jam absolut untuk sesi Manager/Admin/Owner
      if (privileged && sessionDoc?.securityMeta?.createdAt) {
        const elapsed =
          Date.now() - new Date(sessionDoc.securityMeta.createdAt).getTime();
        if (elapsed > STAFF_SESSION_MAX_AGE_MS) {
          await Promise.resolve(baseAdapter.deleteSession?.(sessionToken)).catch(() => null);
          if (process.env.REDIS_URL?.trim()) {
            await redis.del(`session:profile:${userIdStr}`).catch(() => null);
          }
          return null;
        }
      }

      const fp = await extractRequestFingerprint();
      if (!fp) return res;

      // 2. Bind-on-first-use untuk sesi lama pre-deploy (mencegah mass logout)
      if (!sessionDoc?.securityMeta?.uaHash) {
        await db.collection("sessions").updateOne(
          { sessionToken },
          {
            $set: {
              securityMeta: {
                ...fp,
                createdAt: sessionDoc?.createdAt || new Date(),
                lastActiveAt: new Date(),
              },
            },
          },
        );
        return res;
      }

      const targetDiscordId = String(dbUser?.discordId || userIdStr);
      const now = new Date();
      const storedLang = sessionDoc.securityMeta.primaryLang || null;

      // 3. Cek ketidakcocokan Browser/OS Family atau bahasa utama browser -> AUTO-REVOKE SEKETIKA untuk semua user
      const uaMismatch = sessionDoc.securityMeta.uaHash !== fp.uaHash;
      const langMismatch = Boolean(
        storedLang && fp.primaryLang && storedLang !== fp.primaryLang,
      );
      if (uaMismatch || langMismatch) {
        await Promise.resolve(baseAdapter.deleteSession?.(sessionToken)).catch(() => null);
        if (process.env.REDIS_URL?.trim()) {
          await redis.del(`session:profile:${userIdStr}`).catch(() => null);
        }
        const detailText = `Cookie sesi dipakai dari perangkat/browser berbeda (${sessionDoc.securityMeta.deviceLabel} [${storedLang || "?"}] -> ${fp.deviceLabel} [${fp.primaryLang || "?"}], ${sessionDoc.securityMeta.country || "?"} -> ${fp.country || "?"}, IP ${fp.ipMasked || "-"}). Sesi diputus otomatis.`;
        await Promise.allSettled([
          recordSessionSecurityAlert({
            db,
            discordId: targetDiscordId,
            action: "STOLEN_SESSION_DETECTED",
            details: detailText,
          }),
          notifySessionAnomaly({
            db,
            discordId: targetDiscordId,
            title: "🚨 Peringatan Keamanan: Sesi Ditutup Otomatis",
            message:
              `Kami mendeteksi akses mencurigakan pada sesi login Anda dari **${fp.deviceLabel}**` +
              `${fp.country ? ` (${fp.country})` : ""} yang tidak cocok dengan perangkat awal (**${sessionDoc.securityMeta.deviceLabel}**).\n\n` +
              `Sesi tersebut telah **diputus otomatis**. Jika bukan Anda, segera periksa keamanan PC/Discord Anda.`,
            dedupKey: `sec:alert:ua:${targetDiscordId}`,
          }),
        ]);
        return null;
      }

      // 4. Cek perubahan negara (CF-IPCountry) -> Strict Staff vs Silent Driver Update
      const storedCountry = sessionDoc.securityMeta.country;
      if (storedCountry && fp.country && storedCountry !== fp.country) {
        if (privileged) {
          // Staff/Manager/Owner: auto-revoke seketika
          await Promise.resolve(baseAdapter.deleteSession?.(sessionToken)).catch(() => null);
          if (process.env.REDIS_URL?.trim()) {
            await redis.del(`session:profile:${userIdStr}`).catch(() => null);
          }
          const detailText = `Sesi Staff/Manager/Owner berpindah negara (${storedCountry} -> ${fp.country}, ${fp.deviceLabel}, IP ${fp.ipMasked || "-"}). Sesi diputus otomatis.`;
          await Promise.allSettled([
            recordSessionSecurityAlert({
              db,
              discordId: targetDiscordId,
              action: "STOLEN_SESSION_COUNTRY_MISMATCH",
              details: detailText,
            }),
            notifySessionAnomaly({
              db,
              discordId: targetDiscordId,
              title: "🚨 Sesi Staff Diputus: Perubahan Negara Terdeteksi",
              message:
                `Sesi akun Staff/Manager Anda berpindah negara dari **${storedCountry}** ke **${fp.country}** (**${fp.deviceLabel}**). ` +
                `Demi keamanan, sesi tersebut telah diputus otomatis dan silakan login ulang.`,
              dedupKey: `sec:alert:country:${targetDiscordId}`,
            }),
          ]);
          return null;
        } else {
          // Driver reguler: perbarui metadata lokasi secara senyap tanpa alert/DM agar bebas spam VPN/WARP
          await db.collection("sessions").updateOne(
            { sessionToken },
            {
              $set: {
                "securityMeta.country": fp.country,
                "securityMeta.ipMasked": fp.ipMasked,
                "securityMeta.lastActiveAt": now,
                ...(!storedLang && fp.primaryLang
                  ? { "securityMeta.primaryLang": fp.primaryLang }
                  : {}),
              },
            },
          );
          return res;
        }
      }

      // 5. Perbarui lastActiveAt maksimal sekali tiap 5 menit (atau backfill primaryLang jika belum ada)
      const lastActive = sessionDoc.securityMeta.lastActiveAt
        ? new Date(sessionDoc.securityMeta.lastActiveAt).getTime()
        : 0;
      const needsLangBackfill = Boolean(!storedLang && fp.primaryLang);
      if (now.getTime() - lastActive >= LAST_ACTIVE_THROTTLE_MS || needsLangBackfill) {
        await db.collection("sessions").updateOne(
          { sessionToken },
          {
            $set: {
              "securityMeta.lastActiveAt": now,
              ...(fp.ipMasked ? { "securityMeta.ipMasked": fp.ipMasked } : {}),
              ...(!storedCountry && fp.country ? { "securityMeta.country": fp.country } : {}),
              ...(needsLangBackfill ? { "securityMeta.primaryLang": fp.primaryLang } : {}),
            },
          },
        );
      }
    } catch (err) {
      console.error("❌ [AUTH] Error validating session fingerprint:", err);
    }

    return res;
  },
};

export const authOptions: NextAuthOptions = {
  adapter: customAdapter,
  session: {
    strategy: "database",
    maxAge: 7 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      issuer: "https://discord.com",
      authorization: {
        params: {
          scope: "email identify",
        },
      },
      profile(profile) {
        let imageUrl: string;
        if (profile.avatar === null) {
          const defaultAvatarNumber =
            profile.discriminator === "0"
              ? Number(BigInt(profile.id) >> BigInt(22)) % 6
              : parseInt(profile.discriminator, 10) % 5;
          imageUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
        } else {
          const format = profile.avatar.startsWith("a_") ? "gif" : "png";
          imageUrl = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`;
        }
        return {
          id: profile.id,
          discordId: profile.id,
          name: profile.global_name ?? profile.username,
          email: profile.email,
          image: imageUrl,
        } as any;
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      // --- REDIS CACHE CHECK ---
      const cacheKey = `session:profile:${user.id}`;
      try {
        const cachedProfile = await redis.get(cacheKey);
        if (cachedProfile) {
          const parsedProfile = JSON.parse(cachedProfile);
          session.user = { ...session.user, ...parsedProfile };
          return session;
        }
      } catch (err) {
        console.error("❌ [REDIS] Error reading session cache:", err);
      }

      const client = await clientPromise;
      const db = client.db();

      const account = await db.collection("accounts").findOne({
        userId: new ObjectId(user.id),
        provider: "discord",
      });

      // Default value
      let isDriver = false;
      let driverData = null;
      let userRole: "user" | "manager" | "admin" = "user";
      let isBooster = false;
      let nismaraplus: any = null;
      const guildId = process.env.DISCORD_GUILD_ID || "863959415702028318";

      // 1. Ambil data User dari DB terlebih dahulu
      const dbUser = await db
        .collection("users")
        .findOne({ _id: new ObjectId(user.id) });

      if (account) {
        const discordId = account.providerAccountId;

        // Cek kapan terakhir kali kita menembak API Discord untuk user ini
        const lastDiscordSync = dbUser?.lastDiscordSync
          ? new Date(dbUser.lastDiscordSync).getTime()
          : 0;
        const now = Date.now();
        const tenMinutes = 10 * 60 * 1000;

        let isInDiscordGuild: boolean | null = null;

        // 2. Jika data sudah kedaluwarsa (lebih dari 10 menit) ATAU belum pernah sync, fetch ke Discord
        if (now - lastDiscordSync > tenMinutes) {
          try {
            const response = await fetch(
              `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
              {
                headers: {
                  Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                },
              },
            );

            if (response.ok) {
              isInDiscordGuild = true;
              const memberData = await response.json();
              const webConfig = await getWebConfig();
              const managerRoleId = webConfig.discordRoles.managerRoleId;

              if (managerRoleId && memberData.roles.includes(managerRoleId))
                userRole = "manager";
              else
                userRole = "user";

              if (memberData.premium_since) isBooster = true;
              else isBooster = false;
              
              // NOTE: nismaraplus dikelola di DB, tidak dari Discord API

              // SIMPAN HASIL KE DATABASE AGAR TIDAK PERLU FETCH LAGI DALAM WAKTU DEKAT
              await db.collection("users").updateOne(
                { _id: new ObjectId(user.id) },
                {
                  $set: {
                    discordRole: userRole,
                    isBooster: isBooster,
                    lastDiscordSync: new Date(),
                  },
                },
              );
            } else if (response.status === 404) {
              // ❌ User SUDAH KELUAR / BUKAN Member Server Discord Nismara
              isInDiscordGuild = false;
              userRole = "user";
              isBooster = false;

              await db.collection("users").updateOne(
                { _id: new ObjectId(user.id) },
                {
                  $set: {
                    isDriver: false,
                    discordRole: "user",
                    isBooster: false,
                    lastDiscordSync: new Date(),
                  },
                },
              );
            } else {
              console.error("❌ [API DISCORD] Error Status:", response.status);
              isInDiscordGuild = dbUser?.isDriver !== false;
            }
          } catch (error) {
            console.error("❌ [FETCH] Gagal menghubungi Discord API:", error);
            isInDiscordGuild = dbUser?.isDriver !== false;
          }
        } else {
          // 3. JIKA BELUM 10 MENIT, GUNAKAN DATA DARI DATABASE (TIDAK SPAM API)
          userRole = dbUser?.discordRole || "user";
          isBooster = dbUser?.isBooster || false;
          isInDiscordGuild = dbUser?.isDriver !== false;
        }

        // --- FETCH NISMARA+ DARI DB (SELALU) ---
        nismaraplus = dbUser?.nismaraplus || { status: false };

        // --- UPDATE DISCORD ID & XP JIKA KOSONG ---
        await db.collection("users").updateOne(
          { _id: new ObjectId(user.id) },
          {
            $set: { discordId: discordId, lastSeen: new Date() },
          },
        );

        if (dbUser && dbUser.xp === undefined) {
          await db
            .collection("users")
            .updateOne(
              { _id: new ObjectId(user.id) },
              { $set: { xp: 0, level: 1 } },
            );
        }

        if (dbUser && dbUser.nismaraplus === undefined) {
          await db.collection("users").updateOne(
            { _id: new ObjectId(user.id) },
            {
              $set: {
                "nismaraplus.status": false,
                "nismaraplus.startedAt": null,
                "nismaraplus.expiredAt": null,
              },
            },
          );
        }

        if (dbUser && dbUser.insurance === undefined) {
          await db.collection("users").updateOne(
            { _id: new ObjectId(user.id) },
            {
              $set: {
                "insurance.status": false,
                "insurance.rating": 100,
                "insurance.startedAt": null,
                "insurance.expiredAt": null,
              },
            },
          );
        }

        // --- SYNC TRUCKY ID ---
        const driverLink = await db.collection("driverlinks").findOne({
          userId: discordId,
          guildId,
        });

        const isOnAccountHold = dbUser?.accountHold?.status === true;

        if (driverLink && isInDiscordGuild !== false && !isOnAccountHold) {
          isDriver = true;
          driverData = {
            truckyId: driverLink.truckyId,
            truckyName: driverLink.truckyName,
          };

          const updateData: any = { truckyId: driverLink.truckyId, isDriver: true };

          if (driverLink.createdAt && !dbUser?.createdAt) {
            updateData.createdAt = driverLink.createdAt;
          }

          // --- SYNC TRUCKY RANK & STEAM ID (12 Hour Throttle, atau segera jika steamId kosong) ---
          const lastTruckySync = dbUser?.lastTruckySync
            ? new Date(dbUser.lastTruckySync).getTime()
            : 0;

          const twelveHours = 12 * 60 * 60 * 1000;
          const missingSteamId = !dbUser?.steamId;

          if (now - lastTruckySync > twelveHours || missingSteamId) {
            try {
              const NISMARA_COMPANY_ID = process.env.TRUCKY_COMPANY_ID || "35643";
              const [truckyStats, driverProfile] = await Promise.all([
                getCompanyMemberStats(Number(NISMARA_COMPANY_ID), driverLink.truckyId),
                getDriverStats(Number(driverLink.truckyId)),
              ]);

              // Simpan Role (jabatan)
              const roleObj = truckyStats?.role || driverProfile?.role;
              if (roleObj) {
                updateData.truckyRole = typeof roleObj === "object" ? roleObj.name : roleObj;
                if (typeof roleObj === "object") {
                  if (roleObj.id) updateData.truckyRoleId = Number(roleObj.id);
                  if (roleObj.color) updateData.truckyRoleColor = roleObj.color;
                }
              }

              // Simpan Rank (tingkatan/level)
              if (truckyStats?.rank) {
                updateData.truckyRank = typeof truckyStats.rank === "object" ? truckyStats.rank.name : truckyStats.rank;
                if (typeof truckyStats.rank === "object" && truckyStats.rank.color) {
                  updateData.truckyRankColor = truckyStats.rank.color;
                }
              }

              // Simpan Steam ID (String presisi 64-bit dari Trucky API v2)
              if (driverProfile?.steam_profile?.steam_id) {
                updateData.steamId = String(driverProfile.steam_profile.steam_id);
              }
              if (driverProfile?.steam_profile?.steam_username) {
                updateData.steamUsername = String(driverProfile.steam_profile.steam_username);
              }

              updateData.lastTruckySync = new Date();
            } catch (err) {
              console.error("❌ [FETCH] Gagal menghubungi Trucky API:", err);
            }
          }

          await db
            .collection("users")
            .updateOne(
              { _id: new ObjectId(user.id) },
              { $set: updateData },
            );
        } else {
          isDriver = false;
          driverData = null;
          if (dbUser?.isDriver) {
            await db
              .collection("users")
              .updateOne(
                { _id: new ObjectId(user.id) },
                { $set: { isDriver: false } },
              );
          }
        }

        session.user.discordId = discordId;
      }

      // 4. MASUKKAN DATA KE SESSION
      session.user.isDriver = isDriver;
      session.user.driverData = driverData;
      session.user.role = userRole;
      session.user.isBooster = isBooster;
      session.user.nismaraplus = nismaraplus;
      session.user.topManager = dbUser?.topManager || { status: false };
      session.user.test_participation = Boolean(dbUser?.test_participation);
      session.user.xp = dbUser?.xp || 0;
      session.user.level = dbUser?.level || 1;
      session.user.teamId = dbUser?.teamId ? dbUser.teamId.toString() : null;
      session.user.truckyId = dbUser?.truckyId;
      session.user._id = dbUser?._id.toString() || user.id;

      // --- SAVE TO REDIS CACHE ---
      try {
        const profileToCache = {
          discordId: session.user.discordId,
          isDriver,
          driverData,
          role: userRole,
          isBooster,
          nismaraplus,
          topManager: session.user.topManager,
          test_participation: session.user.test_participation,
          xp: session.user.xp,
          level: session.user.level,
          teamId: session.user.teamId,
          truckyId: session.user.truckyId,
          _id: session.user._id,
        };
        // Set TTL to 15 minutes (900 seconds)
        await redis.setex(cacheKey, 900, JSON.stringify(profileToCache));
      } catch (err) {
        console.error("❌ [REDIS] Error saving session cache:", err);
      }

      return session;
    },
  },
  pages: { signIn: "/dashboard/" },
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
