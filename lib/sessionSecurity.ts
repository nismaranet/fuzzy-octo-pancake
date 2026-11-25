import crypto from "crypto";
import { ObjectId, type Db } from "mongodb";
import { redis } from "@/lib/redis";
import { sendDiscordDM } from "@/lib/discord";
import { isWebOwner } from "@/lib/webConfig";

/** Hard cap masa aktif sesi khusus Staff/Manager/Owner (48 jam absolut sejak login) */
export const STAFF_SESSION_MAX_AGE_MS = 48 * 60 * 60 * 1000;

/** Interval minimum pembaruan timestamp lastActiveAt agar tidak membebani MongoDB */
export const LAST_ACTIVE_THROTTLE_MS = 5 * 60 * 1000;

export interface ParsedUserAgent {
  osFamily: string;
  browserFamily: string;
  deviceType: "desktop" | "mobile";
  uaFamily: string;
  deviceLabel: string;
}

export interface SessionFingerprint {
  uaHash: string;
  uaFamily: string;
  deviceLabel: string;
  deviceType: "desktop" | "mobile";
  primaryLang: string | null;
  country: string | null;
  ipMasked: string | null;
}

/**
 * Mengekstrak kode bahasa utama 2-3 huruf dari header Accept-Language (mis. "id-ID,id;q=0.9" -> "id").
 */
export function extractPrimaryLanguage(
  rawAcceptLang: string | null | undefined,
): string | null {
  if (!rawAcceptLang) return null;
  const firstSegment = String(rawAcceptLang).split(",")[0];
  if (!firstSegment) return null;
  const langTag = firstSegment.split(";")[0]?.trim().toLowerCase();
  if (!langTag) return null;
  const primarySubtag = langTag.split(/[-_]/)[0];
  if (!primarySubtag || !/^[a-z]{2,3}$/.test(primarySubtag)) {
    return null;
  }
  return primarySubtag;
}

/**
 * Mengurai User-Agent menjadi identitas keluarga perangkat yang stabil
 * (mengabaikan nomor versi minor browser agar auto-update tidak memicu false logout).
 */
export function parseUserAgentFamily(
  rawUa: string | null | undefined,
  secChPlatform?: string | null,
): ParsedUserAgent {
  const ua = String(rawUa || "").trim();

  if (!ua) {
    return {
      osFamily: "Unknown",
      browserFamily: "Bot/CLI",
      deviceType: "desktop",
      uaFamily: "Unknown|Bot/CLI|desktop",
      deviceLabel: "Unknown Client",
    };
  }

  // Deteksi script/otomasi/CLI (umum dipakai saat replay cookie curian)
  if (
    /\b(curl|wget|python-requests|python-urllib|httpx|aiohttp|postmanruntime|insomnia|httpie|go-http-client|node-fetch|undici|axios|libwww-perl|powershell)\b/i.test(
      ua,
    )
  ) {
    return {
      osFamily: "CLI",
      browserFamily: "Bot/CLI",
      deviceType: "desktop",
      uaFamily: "CLI|Bot/CLI|desktop",
      deviceLabel: "Bot / CLI Tool",
    };
  }

  // Deteksi OS Family
  let osFamily = "Other";
  if (/windows nt|win64|wow64/i.test(ua)) {
    osFamily = "Windows";
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    osFamily = "iOS";
  } else if (/android/i.test(ua)) {
    osFamily = "Android";
  } else if (/cros/i.test(ua)) {
    osFamily = "ChromeOS";
  } else if (/macintosh|mac os x/i.test(ua)) {
    osFamily = "macOS";
  } else if (/linux|x11/i.test(ua)) {
    osFamily = "Linux";
  }

  // Gunakan Sec-CH-UA-Platform sebagai tie-breaker jika UA tereduksi/OS tidak terbaca
  if (osFamily === "Other" && secChPlatform) {
    const cleanPlatform = String(secChPlatform).replace(/["']/g, "").trim().toLowerCase();
    if (cleanPlatform === "windows") osFamily = "Windows";
    else if (cleanPlatform === "macos") osFamily = "macOS";
    else if (cleanPlatform === "android") osFamily = "Android";
    else if (cleanPlatform === "ios") osFamily = "iOS";
    else if (cleanPlatform === "chrome os" || cleanPlatform === "chromeos") osFamily = "ChromeOS";
    else if (cleanPlatform === "linux") osFamily = "Linux";
  }

  // Deteksi Device Type
  const isMobile =
    osFamily === "Android" ||
    osFamily === "iOS" ||
    /\bmobile\b|tablet/i.test(ua);
  const deviceType: "desktop" | "mobile" = isMobile ? "mobile" : "desktop";

  // Deteksi Browser Family (urutan penting karena UA sering menyertakan string Safari/Chrome)
  let browserFamily = "Other";
  if (/samsungbrowser/i.test(ua)) {
    browserFamily = "SamsungBrowser";
  } else if (/edg\/|edga\/|edgios\//i.test(ua)) {
    browserFamily = "Edge";
  } else if (/opr\/|opera/i.test(ua)) {
    browserFamily = "Opera";
  } else if (/firefox\/|fxios\//i.test(ua)) {
    browserFamily = "Firefox";
  } else if (/chrome\/|crios\//i.test(ua)) {
    browserFamily = "Chrome";
  } else if (/safari\//i.test(ua)) {
    browserFamily = "Safari";
  }

  const uaFamily = `${osFamily}|${browserFamily}|${deviceType}`;
  const deviceLabel = `${browserFamily} di ${osFamily}`;

  return {
    osFamily,
    browserFamily,
    deviceType,
    uaFamily,
    deviceLabel,
  };
}

/**
 * Menghasilkan hash SHA-256 yang disalt NEXTAUTH_SECRET dari UA Family.
 */
export function computeUaHash(uaFamily: string): string {
  const salt = process.env.NEXTAUTH_SECRET || "nismara-session-salt";
  return crypto.createHash("sha256").update(`${salt}:${uaFamily}`).digest("hex");
}

/**
 * Menyamarkan alamat IP agar tidak menyimpan IP mentah di database.
 * IPv4: `114.122.x.x` | IPv6: `2001:4860::xxxx`
 */
export function maskIpAddress(rawIp: string | null | undefined): string | null {
  if (!rawIp) return null;
  const firstIp = String(rawIp).split(",")[0]?.trim();
  if (!firstIp) return null;

  // IPv4-mapped IPv6 (e.g., ::ffff:192.168.1.1)
  const cleanIp = firstIp.startsWith("::ffff:") ? firstIp.slice(7) : firstIp;

  const ipv4Parts = cleanIp.split(".");
  if (ipv4Parts.length === 4 && ipv4Parts.every((p) => /^\d{1,3}$/.test(p))) {
    return `${ipv4Parts[0]}.${ipv4Parts[1]}.x.x`;
  }

  if (cleanIp.includes(":")) {
    const groups = cleanIp.split(":").filter(Boolean);
    if (groups.length >= 2) {
      return `${groups[0]}:${groups[1]}::xxxx`;
    }
    return "ipv6::xxxx";
  }

  return null;
}

/**
 * Menormalisasi kode negara dari header Cloudflare CF-IPCountry.
 * Mengabaikan nilai lokal/unknown/Tor (`XX`, `T1`, kosong).
 */
export function normalizeCountry(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = String(raw).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") {
    return null;
  }
  return code;
}

/**
 * Mengambil fingerprint HTTP request aktif di Next.js App Router secara aman.
 */
export async function extractRequestFingerprint(): Promise<SessionFingerprint | null> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const userAgent = h.get("user-agent");
    const secChPlatform = h.get("sec-ch-ua-platform");
    const parsed = parseUserAgentFamily(userAgent, secChPlatform);
    const uaHash = computeUaHash(parsed.uaFamily);
    const primaryLang = extractPrimaryLanguage(h.get("accept-language"));
    const country = normalizeCountry(h.get("cf-ipcountry"));
    const rawIp = h.get("cf-connecting-ip") || h.get("x-forwarded-for") || h.get("x-real-ip");
    const ipMasked = maskIpAddress(rawIp);

    return {
      uaHash,
      uaFamily: parsed.uaFamily,
      deviceLabel: parsed.deviceLabel,
      deviceType: parsed.deviceType,
      primaryLang,
      country,
      ipMasked,
    };
  } catch {
    return null;
  }
}

/**
 * Membaca NextAuth database session token dari cookie server (tidak pernah dikirim balik ke client).
 */
export async function getCurrentSessionTokenFromCookie(): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    return (
      cookieStore.get("__Secure-next-auth.session-token")?.value ||
      cookieStore.get("next-auth.session-token")?.value ||
      null
    );
  } catch {
    return null;
  }
}

/**
 * Menentukan apakah akun memiliki hak istimewa (Manager, Admin, atau Web Owner).
 */
export async function isPrivilegedUser(userDoc: any): Promise<boolean> {
  if (!userDoc) return false;
  const discordRole = String(userDoc.discordRole || "").toLowerCase();
  const role = String(userDoc.role || "").toLowerCase();
  if (
    discordRole === "manager" ||
    discordRole === "admin" ||
    role === "manager" ||
    role === "admin"
  ) {
    return true;
  }
  return await isWebOwner(userDoc.discordId);
}

/**
 * Mencatat alert keamanan sesi ke koleksi `securityalerts`.
 */
export async function recordSessionSecurityAlert({
  db,
  discordId,
  action,
  details,
}: {
  db: Db;
  discordId: string;
  action: string;
  details: string;
}): Promise<void> {
  try {
    await db.collection("securityalerts").insertOne({
      discordId: String(discordId || "unknown"),
      action,
      amount: 0,
      details,
      isResolved: false,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("[SessionSecurity] Gagal mencatat SecurityAlert:", err);
  }
}

/**
 * Mengirim DM peringatan ke Discord user & notifikasi web dengan dedup Redis 5 menit.
 */
export async function notifySessionAnomaly({
  db,
  discordId,
  title,
  message,
  dedupKey,
}: {
  db: Db;
  discordId: string;
  title: string;
  message: string;
  dedupKey: string;
}): Promise<void> {
  if (!discordId) return;

  try {
    if (process.env.REDIS_URL?.trim()) {
      const acquired = await redis
        .set(dedupKey, "1", "EX", 300, "NX")
        .catch(() => "OK");
      if (acquired !== "OK") {
        return; // Sudah terkirim notifikasi serupa dalam 5 menit terakhir
      }
    }

    await Promise.allSettled([
      sendDiscordDM(String(discordId), "", [
        {
          title,
          description: message,
          color: 0xef4444,
          footer: { text: "Nismara Security Guard" },
          timestamp: new Date().toISOString(),
        },
      ]),
      db.collection("notifications").insertOne({
        recipient: String(discordId),
        title,
        message,
        type: "warning",
        isRead: false,
        link: "/dashboard/settings?tab=security",
        createdAt: new Date(),
      }),
    ]);
  } catch (err) {
    console.error("[SessionSecurity] Gagal mengirim notifikasi anomali:", err);
  }
}

/**
 * Menghapus dokumen sesi di MongoDB & membersihkan cache sesi Redis milik user.
 */
export async function revokeUserSessions(
  db: Db,
  userId: string,
  options?: { exceptSessionToken?: string | null },
): Promise<{ deletedCount: number }> {
  const idStr = String(userId);
  const userFilters: any[] = [{ userId: idStr }];
  if (ObjectId.isValid(idStr)) {
    userFilters.push({ userId: new ObjectId(idStr) });
  }

  const query: Record<string, any> = { $or: userFilters };
  if (options?.exceptSessionToken) {
    query.sessionToken = { $ne: options.exceptSessionToken };
  }

  const res = await db.collection("sessions").deleteMany(query);

  // Hapus cache profil Redis hanya jika ikut mencabut sesi aktif saat ini (tanpa pengecualian)
  if (!options?.exceptSessionToken && process.env.REDIS_URL?.trim()) {
    await redis.del(`session:profile:${idStr}`).catch(() => null);
  }

  return { deletedCount: res.deletedCount || 0 };
}
