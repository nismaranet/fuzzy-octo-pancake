"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { revalidatePath } from "next/cache";
import { deleteFileFromR2 } from "@/lib/r2";
import { getDriverStats } from "@/lib/tmp";
import {
  createDiscordTicketChannel,
  sendDiscordMessage,
  deleteDiscordChannel,
} from "@/lib/discord";
import { getWebConfig } from "@/lib/webConfig";
import { redis } from "@/lib/redis";
import { sanitizeObjectPosition } from "@/lib/profilePosition";
import {
  canUseCustomProfileTheme,
  sanitizeProfileTheme,
  type UserProfileThemeConfig,
} from "@/lib/profileThemes";
import {
  checkDecorationEligibility,
  isUserStaffRole,
  isUserTopManagerActive,
} from "@/lib/avatarDecorations";
import { getAvatarDecorationsCatalog } from "@/lib/avatarDecorationsServer";

export async function updateProfile(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.truckyId) {
    return { success: false, message: "Unauthorized: Silakan login kembali." };
  }

  const name = formData.get("name") as string;
  const image = formData.get("image") as string; // URL Baru dari R2
  const bannerUrl = formData.get("bannerUrl") as string; // URL Baru dari R2
  const backgroundUrl = formData.get("backgroundUrl") as string; // URL Baru dari R2
  const rawBannerPosition = formData.get("bannerPosition") as string | null;
  const rawBackgroundPosition = formData.get("backgroundPosition") as string | null;
  const rawAvatarDecoration = formData.get("avatarDecoration") as string | null;
  const rawProfileThemePreset = formData.get("profileThemePreset") as string | null;
  const rawProfileThemeBaseColor = formData.get("profileThemeBaseColor") as string | null;
  const rawProfileThemeAccentColor = formData.get("profileThemeAccentColor") as string | null;

  const social_media = {
    youtube: formData.get("youtube") as string || "",
    facebook: formData.get("facebook") as string || "",
    instagram: formData.get("instagram") as string || "",
    twitter: formData.get("twitter") as string || "",
    tiktok: formData.get("tiktok") as string || "",
    world_of_truck: formData.get("world_of_truck") as string || "",
    website: formData.get("website") as string || "",
  };

  try {
    const client = await clientPromise;
    const db = client.db();

    // 1. Ambil data profil lama untuk mengecek URL foto lama (berdasarkan discordId kanonis)
    const oldUser = await db
      .collection("users")
      .findOne({ discordId: String(session.user.discordId) });

    if (!oldUser) {
      return { success: false, message: "User tidak ditemukan." };
    }

    // 2. Logika Pembersihan: Jika URL baru berbeda dengan URL lama, hapus file lama dari R2[cite: 17]

    // Cek Avatar
    if (image && oldUser.image && image !== oldUser.image) {
      await deleteFileFromR2(oldUser.image);
    }

    // Cek Banner
    if (bannerUrl && oldUser.bannerUrl && bannerUrl !== oldUser.bannerUrl) {
      await deleteFileFromR2(oldUser.bannerUrl);
    }

    // Cek Background
    if (
      backgroundUrl &&
      oldUser.backgroundUrl &&
      backgroundUrl !== oldUser.backgroundUrl
    ) {
      await deleteFileFromR2(oldUser.backgroundUrl);
    }

    // 3. Eksekusi Update ke Database[cite: 17]
    const setFields: Record<string, any> = {
      name: name,
      image: image,
      bannerUrl: bannerUrl,
      backgroundUrl: backgroundUrl,
      social_media: social_media,
      updatedAt: new Date(),
    };
    if (rawBannerPosition !== null) {
      setFields.bannerPosition = sanitizeObjectPosition(rawBannerPosition);
    }
    if (rawBackgroundPosition !== null) {
      setFields.backgroundPosition = sanitizeObjectPosition(rawBackgroundPosition);
    }
    if (rawAvatarDecoration !== null) {
      const normalizedDeco = rawAvatarDecoration.trim() || null;
      if (normalizedDeco) {
        const { items } = await getAvatarDecorationsCatalog({
          includeInactive: false,
        });
        const targetDef = items.find((d) => d.id === normalizedDeco);
        const eligibility = checkDecorationEligibility(targetDef, {
          isNismaraPlus: oldUser.nismaraplus?.status === true,
          isStaff:
            isUserStaffRole(session.user.role) ||
            isUserStaffRole(oldUser.discordRole || oldUser.role),
          isTopManager: isUserTopManagerActive(oldUser.topManager),
        });
        if (!eligibility.allowed) {
          return {
            success: false,
            message:
              eligibility.reason ||
              "Anda tidak memenuhi syarat untuk menggunakan dekorasi avatar ini.",
          };
        }
      }
      setFields.avatarDecoration = normalizedDeco;
    }

    if (rawProfileThemePreset !== null) {
      const sanitizedTheme = sanitizeProfileTheme({
        preset: rawProfileThemePreset,
        customBaseColor: rawProfileThemeBaseColor,
        customAccentColor: rawProfileThemeAccentColor,
      });
      if (
        sanitizedTheme.preset === "custom" &&
        !canUseCustomProfileTheme({
          isNismaraPlus: oldUser.nismaraplus?.status === true,
          isBooster: oldUser.isBooster === true,
        })
      ) {
        return {
          success: false,
          message:
            "Custom Color Picker profil khusus untuk member Nismara+ atau Discord Server Booster.",
        };
      }
      setFields.profileTheme = sanitizedTheme;
    }

    const updateResult = await db.collection("users").updateOne(
      { _id: oldUser._id },
      {
        $set: setFields,
      },
    );

    if (updateResult.matchedCount === 0) {
      return { success: false, message: "Gagal memperbarui profil." };
    }

    revalidatePath(`/profile/${session.user.truckyId}`);
    revalidatePath("/profile/[truckyId]", "page");
    revalidatePath("/dashboard/settings");

    return { success: true, message: "Profil berhasil diperbarui!" };
  } catch (error) {
    console.error("Update Profile Error:", error);
    return { success: false, message: "Terjadi kesalahan sistem." };
  }
}

export async function updateProfilePositions(
  bannerPosition: string,
  backgroundPosition: string,
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.discordId) {
    return { success: false, message: "Unauthorized: Silakan login kembali." };
  }

  const safeBannerPos = sanitizeObjectPosition(bannerPosition);
  const safeBgPos = sanitizeObjectPosition(backgroundPosition);

  try {
    const client = await clientPromise;
    const db = client.db();

    const updateResult = await db.collection("users").updateOne(
      { discordId: String(session.user.discordId) },
      {
        $set: {
          bannerPosition: safeBannerPos,
          backgroundPosition: safeBgPos,
          updatedAt: new Date(),
        },
      },
    );

    if (updateResult.matchedCount === 0) {
      return { success: false, message: "User tidak ditemukan." };
    }

    if (session.user.truckyId) {
      revalidatePath(`/profile/${session.user.truckyId}`);
    }
    revalidatePath("/profile/[truckyId]", "page");
    revalidatePath("/dashboard/settings");

    return {
      success: true,
      bannerPosition: safeBannerPos,
      backgroundPosition: safeBgPos,
      message: "Posisi banner & wallpaper berhasil disimpan!",
    };
  } catch (error) {
    console.error("Update Profile Positions Error:", error);
    return { success: false, message: "Terjadi kesalahan sistem." };
  }
}

export async function updateAvatarDecoration(decorationId: string | null) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.discordId) {
    return { success: false, message: "Unauthorized: Silakan login kembali." };
  }

  const normalizedId =
    typeof decorationId === "string" && decorationId.trim().length > 0
      ? decorationId.trim()
      : null;

  try {
    const client = await clientPromise;
    const db = client.db();
    const user = await db
      .collection("users")
      .findOne({ discordId: String(session.user.discordId) });

    if (!user) {
      return { success: false, message: "User tidak ditemukan." };
    }

    if (normalizedId) {
      const { items } = await getAvatarDecorationsCatalog({
        includeInactive: false,
      });
      const targetDef = items.find((d) => d.id === normalizedId);
      if (!targetDef) {
        return { success: false, message: "Dekorasi avatar tidak ditemukan atau sedang nonaktif." };
      }

      const eligibility = checkDecorationEligibility(targetDef, {
        isNismaraPlus: user.nismaraplus?.status === true,
        isStaff:
          isUserStaffRole(session.user.role) ||
          isUserStaffRole(user.discordRole || user.role),
        isTopManager: isUserTopManagerActive(user.topManager),
      });

      if (!eligibility.allowed) {
        return {
          success: false,
          message:
            eligibility.reason ||
            "Anda belum memenuhi syarat untuk memasang dekorasi ini.",
        };
      }
    }

    await db.collection("users").updateOne(
      { _id: user._id },
      {
        $set: {
          avatarDecoration: normalizedId,
          updatedAt: new Date(),
        },
      },
    );

    // Invalidate session Redis cache agar Navbar & Dashboard langsung menampilkan dekorasi baru
    try {
      if (process.env.REDIS_URL?.trim()) {
        await Promise.all([
          redis.del(`session:profile:${String(user._id)}`),
          redis.del(`session:profile:${String(session.user.discordId)}`),
        ]);
      }
    } catch {
      // non-fatal
    }

    if (user.truckyId) {
      revalidatePath(`/profile/${user.truckyId}`);
    }
    revalidatePath("/profile/[truckyId]", "page");
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    revalidatePath("/");
    revalidatePath("/currency-boost/[slug]", "page");

    return {
      success: true,
      avatarDecoration: normalizedId,
      message: normalizedId
        ? "Dekorasi avatar berhasil dipasang!"
        : "Dekorasi avatar berhasil dilepas.",
    };
  } catch (error) {
    console.error("Update Avatar Decoration Error:", error);
    return { success: false, message: "Terjadi kesalahan sistem." };
  }
}

export async function updateProfileTheme(themeInput: UserProfileThemeConfig) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.discordId) {
    return { success: false, message: "Unauthorized: Silakan login kembali." };
  }

  const sanitized = sanitizeProfileTheme(themeInput);

  try {
    const client = await clientPromise;
    const db = client.db();
    const user = await db
      .collection("users")
      .findOne({ discordId: String(session.user.discordId) });

    if (!user) {
      return { success: false, message: "User tidak ditemukan." };
    }

    if (
      sanitized.preset === "custom" &&
      !canUseCustomProfileTheme({
        isNismaraPlus: user.nismaraplus?.status === true,
        isBooster: user.isBooster === true,
      })
    ) {
      return {
        success: false,
        message:
          "Custom Color Picker profil khusus untuk member Nismara+ atau Discord Server Booster.",
      };
    }

    await db.collection("users").updateOne(
      { _id: user._id },
      {
        $set: {
          profileTheme: sanitized,
          updatedAt: new Date(),
        },
      },
    );

    if (user.truckyId) {
      revalidatePath(`/profile/${user.truckyId}`);
    }
    revalidatePath("/profile/[truckyId]", "page");
    revalidatePath("/dashboard/settings");

    return {
      success: true,
      profileTheme: sanitized,
      message: "Tema warna profil berhasil disimpan!",
    };
  } catch (error) {
    console.error("Update Profile Theme Error:", error);
    return { success: false, message: "Terjadi kesalahan sistem." };
  }
}

// Tambahkan fungsi ini di actions.ts
export async function getUserSettings() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.discordId) return null;

  try {
    const client = await clientPromise;
    const db = client.db();
    const user = await db
      .collection("users")
      .findOne({ discordId: String(session.user.discordId) });

    if (!user) return null;

    const [haulmpApp, decoCatalog] = await Promise.all([
      db.collection("haulmp_applications").findOne(
        { discordId: user.discordId },
        { sort: { createdAt: -1 } },
      ),
      getAvatarDecorationsCatalog({ includeInactive: false }),
    ]);

    // Pastikan mengembalikan objek plain (stringified) karena ini Server Action
    return {
      name: user.name || "",
      image: user.image || "",
      bannerUrl: user.bannerUrl || "",
      backgroundUrl: user.backgroundUrl || "",
      bannerPosition: sanitizeObjectPosition(user.bannerPosition),
      backgroundPosition: sanitizeObjectPosition(user.backgroundPosition),
      avatarDecoration: user.avatarDecoration || null,
      profileTheme: sanitizeProfileTheme(user.profileTheme),
      isNismaraPlus: user.nismaraplus?.status === true,
      isBooster: user.isBooster === true,
      isStaff:
        isUserStaffRole(session.user.role) ||
        isUserStaffRole(user.discordRole || user.role),
      isTopManager: isUserTopManagerActive(user.topManager),
      decorationsCatalog: decoCatalog.items,
      social_media: user.social_media || {
        youtube: "",
        facebook: "",
        instagram: "",
        twitter: "",
        tiktok: "",
        world_of_truck: "",
        website: "",
      },
      truckersmpId: user.truckersmpId || null,
      isTmpDriver: user.isTmpDriver || false,
      isDriver: user.isDriver || false,
      haulmpId: user.haulmpId || null,
      isHaulmpDriver: user.isHaulmpDriver || false,
      haulmpApplication: haulmpApp ? JSON.parse(JSON.stringify(haulmpApp)) : null,
      trackerToken: user.test_participation ? (user.trackerToken || null) : null,
      trackerLastSync:
        user.test_participation && user.trackerLastSync
          ? new Date(user.trackerLastSync).toISOString()
          : null,
      trackerVersion: user.test_participation ? (user.trackerVersion || null) : null,
    };
  } catch (error) {
    console.error("Error fetching settings:", error);
    return null;
  }
}

export async function submitHaulmpApplication(notes?: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.discordId) {
    return { success: false, message: "Unauthorized. Silakan login kembali." };
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const user = await db.collection("users").findOne({ discordId: String(session.user.discordId) });

    if (!user) {
      return { success: false, message: "User tidak ditemukan." };
    }

    if (!user.isDriver) {
      return { success: false, message: "Hanya driver resmi Nismara yang dapat mengajukan verifikasi VTC HaulMP." };
    }

    if (user.isHaulmpDriver) {
      return { success: false, message: "Anda sudah terdaftar sebagai Driver HaulMP aktif." };
    }

    // Cek apakah ada pengajuan pending
    const existingPending = await db.collection("haulmp_applications").findOne({
      discordId: user.discordId,
      status: "pending",
    });

    if (existingPending) {
      return { success: false, message: "Anda sudah memiliki pengajuan verifikasi yang sedang ditinjau." };
    }

    // 1. Buat Discord Ticket Channel di bawah kategori khusus (1562028644795416626)
    const categoryId = process.env.DISCORD_HAULMP_CATEGORY_ID || "1562028644795416626";
    const safeUsername = (user.name || "driver").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const channelName = `🎫│haulmp-${safeUsername}`.substring(0, 100);

    const ticketChannel = await createDiscordTicketChannel({
      categoryId,
      channelName,
      userDiscordId: user.discordId,
    });

    // 2. Kirim pesan pengantar & embed detail pengajuan ke channel tiket jika berhasil dibuat
    if (ticketChannel?.id) {
      const webConfig = await getWebConfig();
      const managerRoleId = webConfig.discordRoles.managerRoleId || "863968603681325066";
      await sendDiscordMessage(
        ticketChannel.id,
        `<@${user.discordId}> tiket verifikasi VTC HaulMP Anda berhasil dibuat! Mohon tunggu <@&${managerRoleId}> merespon.`,
        [
          {
            title: "🚛 Tiket Verifikasi Driver VTC HaulMP",
            color: 0x10b981,
            description: `Driver telah mengajukan permohonan verifikasi keanggotaan VTC HaulMP Nismara Transport.\n\nManajemen dapat meninjau dan memproses pengajuan ini melalui Dashboard Manajemen atau memberikan instruksi langsung di channel ini.`,
            fields: [
              { name: "Nama Driver", value: `${user.name}`, inline: true },
              { name: "Discord", value: `<@${user.discordId}>`, inline: true },
              { name: "Trucky ID", value: user.truckyId ? `@${user.truckyId}` : "-", inline: true },
              { name: "Catatan / Info", value: notes?.trim() || "Tidak ada catatan.", inline: false },
              { name: "Status", value: "⏳ Menunggu Peninjauan Manajemen", inline: false },
            ],
            footer: { text: "Nismara Transport Logistics • VTC HaulMP Verification" },
            timestamp: new Date().toISOString(),
          },
        ]
      );
    }

    // 3. Simpan pengajuan ke database bersama channel ID
    await db.collection("haulmp_applications").insertOne({
      discordId: user.discordId,
      name: user.name || "Driver",
      truckyId: user.truckyId || null,
      image: user.image || null,
      notes: notes?.trim() || "",
      channelId: ticketChannel?.id || null,
      discordChannelId: ticketChannel?.id || null,
      status: "pending",
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/manage/data/haulmp");
    return {
      success: true,
      message: "Pengajuan verifikasi VTC HaulMP berhasil dikirim! Channel tiket telah dibuat di Discord.",
    };
  } catch (error) {
    console.error("HaulMP Application Error:", error);
    return { success: false, message: "Terjadi kesalahan internal saat mengajukan verifikasi." };
  }
}

export async function cancelHaulmpApplication() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.discordId) {
    return { success: false, message: "Unauthorized." };
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const user = await db.collection("users").findOne({ discordId: String(session.user.discordId) });

    if (!user) {
      return { success: false, message: "User tidak ditemukan." };
    }

    const pendingApp = await db.collection("haulmp_applications").findOne({
      discordId: user.discordId,
      status: "pending",
    });

    if (!pendingApp) {
      return { success: false, message: "Tidak ada pengajuan tertunda yang dapat dibatalkan." };
    }

    // Hapus channel Discord jika ada
    if (pendingApp.channelId) {
      await deleteDiscordChannel(pendingApp.channelId);
    }

    await db.collection("haulmp_applications").deleteMany({
      discordId: user.discordId,
      status: "pending",
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/manage/data/haulmp");
    return { success: true, message: "Pengajuan verifikasi HaulMP berhasil dibatalkan dan channel tiket telah dihapus." };
  } catch (error) {
    console.error("Cancel HaulMP Error:", error);
    return { success: false, message: "Terjadi kesalahan sistem." };
  }
}

export async function syncTruckersMP(tmpId: number) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.discordId) {
    return { success: false, message: "Unauthorized." };
  }

  try {
    const data = await getDriverStats(tmpId);
    if (!data || data.error) {
      return { success: false, message: "ID TruckersMP tidak valid atau API sedang gangguan." };
    }

    const vtcInfo = data.response?.vtc;
    if (!vtcInfo || !vtcInfo.inVTC || vtcInfo.id !== 82362) {
      return { 
        success: false, 
        message: "Akun TruckersMP ini bukan member Nismara Transport. Silakan buat Ticket jika merasa ini kesalahan." 
      };
    }

    const client = await clientPromise;
    const db = client.db();
    const usersCol = db.collection("users");
    const myDiscordId = String(session.user.discordId);

    const existingUser = await usersCol.findOne({ truckersmpId: tmpId.toString() });
    if (existingUser && String(existingUser.discordId) !== myDiscordId) {
      return { success: false, message: "ID TruckersMP ini sudah ditautkan ke akun lain." };
    }

    const exactSteamId =
      data.response?.steamID64String ||
      (data.response?.steamID ? String(data.response.steamID) : undefined);

    const updateFields: Record<string, any> = {
      truckersmpId: tmpId.toString(),
      isTmpDriver: true,
    };
    if (exactSteamId) {
      updateFields.steamId = exactSteamId;
    }

    const updateResult = await usersCol.updateOne(
      { discordId: myDiscordId },
      {
        $set: updateFields,
      }
    );

    if (updateResult.modifiedCount > 0 || updateResult.matchedCount > 0) {
      revalidatePath("/dashboard/settings");
      return { success: true, message: "Akun TruckersMP berhasil ditautkan!" };
    }

    return { success: false, message: "Gagal memperbarui database." };
  } catch (error) {
    console.error("TMP Sync Error:", error);
    return { success: false, message: "Terjadi kesalahan internal." };
  }
}

export async function unlinkTruckersMP() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.discordId) {
    return { success: false, message: "Unauthorized." };
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const usersCol = db.collection("users");

    const updateResult = await usersCol.updateOne(
      { discordId: String(session.user.discordId) },
      { 
        $unset: { truckersmpId: "" },
        $set: { isTmpDriver: false }
      }
    );

    if (updateResult.modifiedCount > 0) {
      revalidatePath("/dashboard/settings");
      return { success: true, message: "Tautan TruckersMP berhasil diputuskan!" };
    }

    return { success: false, message: "Gagal memutus tautan database." };
  } catch (error) {
    console.error("TMP Unlink Error:", error);
    return { success: false, message: "Terjadi kesalahan internal." };
  }
}

export async function generateTrackerToken() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.discordId) {
    return { success: false, message: "Unauthorized. Silakan login kembali.", token: null };
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const usersCol = db.collection("users");

    const user = await usersCol.findOne({ discordId: String(session.user.discordId) });
    if (!user) {
      return { success: false, message: "User tidak ditemukan.", token: null };
    }

    if (!user.test_participation) {
      return {
        success: false,
        message: "Fitur Tracker saat ini hanya tersedia untuk peserta uji coba (tester).",
        token: null,
      };
    }

    if (!user.isDriver) {
      return {
        success: false,
        message: "Hanya Driver resmi Nismara Transport yang dapat membuat Tracker Token.",
        token: null,
      };
    }

    const crypto = await import("crypto");
    const part1 = crypto.randomBytes(3).toString("hex").toUpperCase();
    const part2 = crypto.randomBytes(3).toString("hex").toUpperCase();
    const part3 = crypto.randomBytes(3).toString("hex").toUpperCase();
    const part4 = crypto.randomBytes(3).toString("hex").toUpperCase();
    const newToken = `NSM-${part1}-${part2}-${part3}-${part4}`;

    await usersCol.updateOne(
      { _id: user._id },
      {
        $set: {
          trackerToken: newToken,
          updatedAt: new Date(),
        },
      }
    );

    revalidatePath("/dashboard/settings");
    return {
      success: true,
      message: "Nismara Tracker Token berhasil dibuat! Salin token ini ke dalam tablet in-game (F11).",
      token: newToken,
    };
  } catch (error) {
    console.error("Generate Tracker Token Error:", error);
    return { success: false, message: "Terjadi kesalahan internal saat membuat token.", token: null };
  }
}
