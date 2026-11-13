import { Db, Document, Filter, ObjectId, UpdateFilter } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { redis } from "@/lib/redis";
import { sendDiscordMessage } from "@/lib/discord";
import { checkRateLimit } from "@/lib/rateLimit";

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export const DISCORD_ID_REGEX = /^\d{17,22}$/;
export const DEFAULT_GUILD_ID =
  process.env.DISCORD_GUILD_ID || process.env.GUILD_ID || "863959415702028318";

export type MigrationConflictStrategy = "override" | "merge";

export type MigrationConflictStatus =
  | "clean"
  | "mergeable_conflict"
  | "blocked_driver_conflict";

export interface DiscordUserProfile {
  exists: boolean;
  apiAvailable: boolean;
  id: string;
  username?: string;
  globalName?: string | null;
  avatarUrl?: string | null;
  error?: string;
}

export interface DiscordGuildMemberInfo {
  inGuild: boolean;
  apiAvailable: boolean;
  nick?: string | null;
  roles: string[];
  error?: string;
}

export interface AccountFootprintSummary {
  hasUserDoc: boolean;
  hasDriverLink: boolean;
  hasOAuthAccount: boolean;
  userId?: string | null;
  name?: string | null;
  truckyId?: string | null;
  truckyRank?: string | null;
  truckyRole?: string | null;
  isDriver: boolean;
  role?: string | null;
  discordRole?: string | null;
  nismaraPlusActive: boolean;
  nismaraPlusExpiresAt?: string | null;
  totalNC: number;
  totalPoints: number;
  hasGarage: boolean;
  garageSlots: number;
  garageSlotsUsed: number;
  garageFuelStock: number;
  garageSafeboxStock: number;
  fleetsOwnedCount: number;
  fleetsDrivenCount: number;
  jobHistoriesCount: number;
  galleryPostsCount: number;
  galleryCommentsCount: number;
  transactionsCount: number;
  ticketsCount: number;
  vouchersCount: number;
  achievementsCount: number;
  seasonProgressCount: number;
  marketPurchasesCount: number;
  marketItemsCount: number;
  fuelListingsCount: number;
  teamsCount: number;
  ordersCount: number;
  staffRecordsCount: number;
  otherRecordsCount: number;
}

export interface MigrationRolePrediction {
  willAssignToNew: Array<{ key: string; label: string; roleId: string }>;
  willRevokeFromOld: Array<{ key: string; label: string; roleId: string }>;
  managerRoleNotice: string | null;
  targetNotInGuildWarning: string | null;
}

export interface MigrationPreviewResult {
  oldDiscordId: string;
  newDiscordId: string;
  sourceDiscord: DiscordUserProfile;
  targetDiscord: DiscordUserProfile;
  sourceMember: DiscordGuildMemberInfo;
  targetMember: DiscordGuildMemberInfo;
  sourceSummary: AccountFootprintSummary;
  targetSummary: AccountFootprintSummary;
  conflictStatus: MigrationConflictStatus;
  conflictReasons: string[];
  warnings: string[];
  canMigrate: boolean;
  blockReason: string | null;
  rolePrediction: MigrationRolePrediction;
}

export interface CollectionUpdateStat {
  collection: string;
  group: string;
  updatedCount: number;
  deletedConflictsCount: number;
  note?: string;
}

export interface MigrationRoleSyncReport {
  assigned: Array<{ label: string; roleId: string }>;
  revoked: Array<{ label: string; roleId: string }>;
  skipped: string[];
  errors: string[];
  managerRoleNotice: string | null;
}

export interface MigrationExecutionResult {
  migrationId: string;
  oldDiscordId: string;
  newDiscordId: string;
  strategy: MigrationConflictStrategy;
  canonicalUserId: string | null;
  totalDocumentsTouched: number;
  collections: CollectionUpdateStat[];
  roleSync: MigrationRoleSyncReport;
  redisKeysCleared: string[];
  executedAt: string;
}

interface RoleConfig {
  guildId: string;
  driverRoleId: string;
  internRoleId: string;
  nplusRoleId: string | null;
  managerRoleId: string;
  channelLog: string | null;
}

/**
 * Validasi akses Owner-only sesuai environment variable sistem.
 */
export function isOwnerDiscordId(discordId?: string | number | null): boolean {
  if (discordId === undefined || discordId === null) return false;
  const trimmed = String(discordId).trim();
  const ownerIds = [process.env.OWNER_DISCORD_ID, process.env.NISMARA_OWNER_DISCORD_ID]
    .filter((v): v is string => Boolean(v && v.trim()))
    .map((v) => v.trim());
  return ownerIds.includes(trimmed);
}

function buildDiscordAvatarUrl(id: string, avatar?: string | null): string | null {
  if (!avatar) return null;
  const ext = avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${id}/${avatar}.${ext}`;
}

/**
 * Mengambil profil user Discord secara live melalui Discord Bot API v10.
 */
export async function fetchDiscordUserProfile(discordId: string): Promise<DiscordUserProfile> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    return {
      exists: false,
      apiAvailable: false,
      id: discordId,
      error: "DISCORD_BOT_TOKEN tidak terkonfigurasi",
    };
  }

  try {
    const res = await fetch(`https://discord.com/api/v10/users/${discordId}`, {
      headers: { Authorization: `Bot ${token}` },
      cache: "no-store",
    });

    if (res.status === 404) {
      return {
        exists: false,
        apiAvailable: true,
        id: discordId,
        error: "Discord User ID tidak ditemukan di Discord.",
      };
    }

    if (!res.ok) {
      const body = await res.text();
      return {
        exists: false,
        apiAvailable: false,
        id: discordId,
        error: `Discord API HTTP ${res.status}: ${body.slice(0, 120)}`,
      };
    }

    const data = await res.json();
    return {
      exists: true,
      apiAvailable: true,
      id: data.id,
      username: data.username,
      globalName: data.global_name ?? null,
      avatarUrl: buildDiscordAvatarUrl(data.id, data.avatar),
    };
  } catch (err: unknown) {
    return {
      exists: false,
      apiAvailable: false,
      id: discordId,
      error: getErrorMessage(err, "Gagal menghubungi Discord API"),
    };
  }
}

/**
 * Mengambil data membership guild Discord user secara live.
 */
export async function fetchDiscordGuildMember(
  discordId: string,
  guildId = DEFAULT_GUILD_ID,
): Promise<DiscordGuildMemberInfo> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    return {
      inGuild: false,
      apiAvailable: false,
      roles: [],
      error: "DISCORD_BOT_TOKEN tidak terkonfigurasi",
    };
  }

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
      {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store",
      },
    );

    if (res.status === 404) {
      return {
        inGuild: false,
        apiAvailable: true,
        roles: [],
      };
    }

    if (!res.ok) {
      const body = await res.text();
      return {
        inGuild: false,
        apiAvailable: false,
        roles: [],
        error: `Discord Guild API HTTP ${res.status}: ${body.slice(0, 120)}`,
      };
    }

    const data = await res.json();
    return {
      inGuild: true,
      apiAvailable: true,
      nick: data.nick ?? null,
      roles: Array.isArray(data.roles) ? data.roles : [],
    };
  } catch (err: unknown) {
    return {
      inGuild: false,
      apiAvailable: false,
      roles: [],
      error: getErrorMessage(err, "Gagal mengecek member server Discord"),
    };
  }
}

async function resolveRoleConfig(db: Db, guildId = DEFAULT_GUILD_ID): Promise<RoleConfig> {
  const setting = await db.collection("guildsettings").findOne({ guildId });
  return {
    guildId,
    driverRoleId:
      process.env.DISCORD_DRIVER_ROLE_ID || setting?.roles?.driver || "1405532668472590437",
    internRoleId:
      process.env.DISCORD_INTERN_ROLE_ID || setting?.roles?.magang || "1405533443651272804",
    nplusRoleId: process.env.DISCORD_NISMARAPLUS_ROLE_ID || null,
    managerRoleId:
      process.env.DISCORD_MANAGER_ROLE_ID || setting?.roles?.manager || "1406574228794507354",
    channelLog: setting?.channelLog || null,
  };
}

async function findUserByDiscord(db: Db, discordId: string) {
  let user = await db.collection("users").findOne({ discordId });
  if (!user) {
    const acc = await db
      .collection("accounts")
      .findOne({ provider: "discord", providerAccountId: discordId });
    if (acc?.userId) {
      const uid =
        acc.userId instanceof ObjectId ? acc.userId : new ObjectId(String(acc.userId));
      user = await db.collection("users").findOne({ _id: uid });
    }
  }
  return user;
}

async function summarizeAccountFootprint(
  db: Db,
  discordId: string,
  guildId = DEFAULT_GUILD_ID,
): Promise<AccountFootprintSummary> {
  const [user, driverLink, oauthAccount] = await Promise.all([
    findUserByDiscord(db, discordId),
    db.collection("driverlinks").findOne({ guildId, userId: discordId }),
    db
      .collection("accounts")
      .findOne({ provider: "discord", providerAccountId: discordId }),
  ]);

  const userObjId = user?._id
    ? user._id instanceof ObjectId
      ? user._id
      : new ObjectId(String(user._id))
    : null;
  const userIdStr = userObjId ? userObjId.toString() : null;

  const [
    currency,
    point,
    garage,
    fleetsOwnedCount,
    fleetsDrivenCount,
    jobHistoriesCount,
    galleryPosts1Count,
    galleryPosts2Count,
    galleryCommentsCount,
    transactionsCount,
    ticketsCount,
    vouchersCount,
    achievementsCount,
    seasonProgressCount,
    marketPurchasesCount,
    marketItemsCount,
    fuelListingsCount,
    teamsCount,
    fleetOrdersCount,
    maintOrdersCount,
    nplusOrdersCount,
    seasonOrdersCount,
    haulmpAppsCount,
    quizAttemptsCount,
    leaveHistoriesCount,
    penaltyTicketsCount,
    staffEvalCount,
    staffSalaryCount,
    staffPromotionsCount,
  ] = await Promise.all([
    db.collection("currencies").findOne({ userId: discordId, guildId }),
    db.collection("points").findOne({ userId: discordId, guildId }),
    db.collection("garages").findOne({
      $or: [{ discordId }, ...(userObjId ? [{ userId: userObjId }] : [])],
    }),
    userObjId ? db.collection("fleets").countDocuments({ owner: userObjId }) : Promise.resolve(0),
    userObjId ? db.collection("fleets").countDocuments({ driver: userObjId }) : Promise.resolve(0),
    db.collection("jobhistories").countDocuments({ driverId: discordId }),
    db
      .collection("gallery_posts")
      .countDocuments({ $or: [{ userId: discordId }, { discordId }] }),
    db
      .collection("galleryposts")
      .countDocuments({ $or: [{ userId: discordId }, { discordId }] }),
    db
      .collection("gallery_comments")
      .countDocuments({ $or: [{ userId: discordId }, { discordId }] }),
    db.collection("transactions").countDocuments({
      $or: [{ discordId }, ...(userObjId ? [{ userId: userObjId }] : [])],
    }),
    db.collection("tickets").countDocuments({
      $or: [{ discordId }, ...(userIdStr ? [{ userId: userIdStr }] : [])],
    }),
    db.collection("uservouchers").countDocuments({ discordId }),
    db.collection("userachievements").countDocuments({ discordId }),
    db.collection("userseasonprogresses").countDocuments({ discordId }),
    db.collection("marketpurchases").countDocuments({ buyerId: discordId }),
    db.collection("marketitems").countDocuments({ sellerId: discordId }),
    db.collection("fuelmarketlistings").countDocuments({ sellerDiscordId: discordId }),
    userObjId
      ? db.collection("teams").countDocuments({
          $or: [
            { owner: userObjId },
            { members: userObjId },
            { pendingRequests: userObjId },
          ],
        })
      : Promise.resolve(0),
    db.collection("fleetorders").countDocuments({ discordId }),
    db.collection("fleetmaintenanceorders").countDocuments({ discordId }),
    db.collection("nismaraplusorders").countDocuments({ discordId }),
    db.collection("seasonpassorders").countDocuments({ discordId }),
    db.collection("haulmp_applications").countDocuments({ discordId }),
    db.collection("quizattempts").countDocuments({ discordId }),
    db
      .collection("leavehistories")
      .countDocuments({ $or: [{ discordId }, { userId: discordId }] }),
    db
      .collection("penaltytickets")
      .countDocuments({ $or: [{ discordId }, { userId: discordId }] }),
    db.collection("driverevaluations").countDocuments({
      $or: [
        { driverId: discordId },
        { openedByManagerId: discordId },
        { closedByManagerId: discordId },
      ],
    }),
    db.collection("managersalaryrecords").countDocuments({ managerId: discordId }),
    db.collection("internpromotions").countDocuments({
      $or: [{ internDiscordId: discordId }, { managerId: discordId }],
    }),
  ]);

  const now = new Date();
  const nplusExp = user?.nismaraplus?.expiresAt ? new Date(user.nismaraplus.expiresAt) : null;
  const nismaraPlusActive = Boolean(
    user?.nismaraplus?.status === true && (!nplusExp || nplusExp > now),
  );

  return {
    hasUserDoc: Boolean(user),
    hasDriverLink: Boolean(driverLink),
    hasOAuthAccount: Boolean(oauthAccount),
    userId: userIdStr,
    name: user?.name || driverLink?.name || null,
    truckyId: user?.truckyId
      ? String(user.truckyId)
      : driverLink?.truckyId
        ? String(driverLink.truckyId)
        : null,
    truckyRank: user?.truckyRank || null,
    truckyRole: user?.truckyRole || driverLink?.role || null,
    isDriver: Boolean(user?.isDriver),
    role: user?.role || null,
    discordRole: user?.discordRole || null,
    nismaraPlusActive,
    nismaraPlusExpiresAt: nplusExp ? nplusExp.toISOString() : null,
    totalNC: Number(currency?.totalNC || 0),
    totalPoints: Number(point?.totalPoints || 0),
    hasGarage: Boolean(garage),
    garageSlots: Number(garage?.fleetSlot || 0),
    garageSlotsUsed: Number(garage?.fleetSlotUsed || 0),
    garageFuelStock: Number(garage?.fuelStock || 0),
    garageSafeboxStock: Number(garage?.safeboxStock || 0),
    fleetsOwnedCount,
    fleetsDrivenCount,
    jobHistoriesCount,
    galleryPostsCount: galleryPosts1Count + galleryPosts2Count,
    galleryCommentsCount,
    transactionsCount,
    ticketsCount,
    vouchersCount,
    achievementsCount,
    seasonProgressCount,
    marketPurchasesCount,
    marketItemsCount,
    fuelListingsCount,
    teamsCount,
    ordersCount: fleetOrdersCount + maintOrdersCount + nplusOrdersCount + seasonOrdersCount,
    staffRecordsCount: staffEvalCount + staffSalaryCount + staffPromotionsCount,
    otherRecordsCount: haulmpAppsCount + quizAttemptsCount + leaveHistoriesCount + penaltyTicketsCount,
  };
}

function buildRolePrediction(
  sourceSummary: AccountFootprintSummary,
  sourceMember: DiscordGuildMemberInfo,
  targetMember: DiscordGuildMemberInfo,
  roleCfg: RoleConfig,
): MigrationRolePrediction {
  const willAssignToNew: Array<{ key: string; label: string; roleId: string }> = [];
  const willRevokeFromOld: Array<{ key: string; label: string; roleId: string }> = [];

  const isDriver =
    sourceSummary.isDriver ||
    sourceMember.roles.includes(roleCfg.driverRoleId) ||
    (sourceSummary.hasDriverLink && sourceSummary.truckyRole !== "Magang");

  const isIntern =
    !isDriver &&
    (sourceSummary.truckyRole === "Magang" ||
      sourceMember.roles.includes(roleCfg.internRoleId));

  if (isDriver && roleCfg.driverRoleId) {
    willAssignToNew.push({ key: "driver", label: "Driver", roleId: roleCfg.driverRoleId });
    willRevokeFromOld.push({ key: "driver", label: "Driver", roleId: roleCfg.driverRoleId });
  } else if (isIntern && roleCfg.internRoleId) {
    willAssignToNew.push({
      key: "intern",
      label: "Intern (Magang)",
      roleId: roleCfg.internRoleId,
    });
    willRevokeFromOld.push({
      key: "intern",
      label: "Intern (Magang)",
      roleId: roleCfg.internRoleId,
    });
  }

  if (sourceSummary.nismaraPlusActive && roleCfg.nplusRoleId) {
    willAssignToNew.push({
      key: "nismaraplus",
      label: "Nismara+",
      roleId: roleCfg.nplusRoleId,
    });
    willRevokeFromOld.push({
      key: "nismaraplus",
      label: "Nismara+",
      roleId: roleCfg.nplusRoleId,
    });
  } else if (sourceMember.roles.includes(roleCfg.nplusRoleId || "") && roleCfg.nplusRoleId) {
    willRevokeFromOld.push({
      key: "nismaraplus",
      label: "Nismara+",
      roleId: roleCfg.nplusRoleId,
    });
  }

  const holdsManagerDiscordRole =
    sourceMember.roles.includes(roleCfg.managerRoleId) ||
    sourceSummary.role === "manager" ||
    sourceSummary.discordRole === "manager";

  const managerRoleNotice = holdsManagerDiscordRole
    ? `Akun lama memiliki role Manager/Staff (${roleCfg.managerRoleId}). Demi keamanan, role Manager di Discord tidak dipindahkan otomatis — pindahkan manual di Discord Server jika diperlukan.`
    : null;

  const targetNotInGuildWarning =
    targetMember.apiAvailable && !targetMember.inGuild
      ? "Akun Discord baru belum bergabung ke server Discord Nismara. Migrasi database tetap bisa dijalankan, namun role server tidak dapat diberikan sampai user join server."
      : null;

  return {
    willAssignToNew,
    willRevokeFromOld,
    managerRoleNotice,
    targetNotInGuildWarning,
  };
}

function hasAnyFootprint(summary: AccountFootprintSummary): boolean {
  return (
    summary.hasUserDoc ||
    summary.hasDriverLink ||
    summary.hasOAuthAccount ||
    summary.totalNC > 0 ||
    summary.totalPoints > 0 ||
    summary.hasGarage ||
    summary.fleetsOwnedCount > 0 ||
    summary.fleetsDrivenCount > 0 ||
    summary.jobHistoriesCount > 0 ||
    summary.galleryPostsCount > 0 ||
    summary.galleryCommentsCount > 0 ||
    summary.transactionsCount > 0 ||
    summary.ticketsCount > 0 ||
    summary.vouchersCount > 0 ||
    summary.achievementsCount > 0 ||
    summary.seasonProgressCount > 0 ||
    summary.marketPurchasesCount > 0 ||
    summary.marketItemsCount > 0 ||
    summary.fuelListingsCount > 0 ||
    summary.teamsCount > 0 ||
    summary.ordersCount > 0 ||
    summary.staffRecordsCount > 0 ||
    summary.otherRecordsCount > 0
  );
}

/**
 * Menghasilkan preview komprehensif sebelum mengeksekusi migrasi akun Discord.
 */
export async function previewDiscordAccountMigration(
  oldDiscordIdRaw: string,
  newDiscordIdRaw: string,
): Promise<MigrationPreviewResult> {
  const oldDiscordId = oldDiscordIdRaw.trim();
  const newDiscordId = newDiscordIdRaw.trim();

  if (!DISCORD_ID_REGEX.test(oldDiscordId) || !DISCORD_ID_REGEX.test(newDiscordId)) {
    throw new Error("Discord ID harus berupa 17-22 digit angka.");
  }

  if (oldDiscordId === newDiscordId) {
    throw new Error("Discord ID lama dan Discord ID baru tidak boleh sama.");
  }

  const client = await clientPromise;
  const db = client.db();

  const [roleCfg, sourceDiscord, targetDiscord, sourceMember, targetMember, sourceSummary, targetSummary] =
    await Promise.all([
      resolveRoleConfig(db, DEFAULT_GUILD_ID),
      fetchDiscordUserProfile(oldDiscordId),
      fetchDiscordUserProfile(newDiscordId),
      fetchDiscordGuildMember(oldDiscordId, DEFAULT_GUILD_ID),
      fetchDiscordGuildMember(newDiscordId, DEFAULT_GUILD_ID),
      summarizeAccountFootprint(db, oldDiscordId, DEFAULT_GUILD_ID),
      summarizeAccountFootprint(db, newDiscordId, DEFAULT_GUILD_ID),
    ]);

  const rolePrediction = buildRolePrediction(sourceSummary, sourceMember, targetMember, roleCfg);

  const conflictReasons: string[] = [];
  const warnings: string[] = [];
  let conflictStatus: MigrationConflictStatus = "clean";
  let blockReason: string | null = null;

  const sourceTruckyId = sourceSummary.truckyId;
  const targetTruckyId = targetSummary.truckyId;

  if (sourceTruckyId && targetTruckyId && sourceTruckyId !== targetTruckyId) {
    conflictStatus = "blocked_driver_conflict";
    blockReason = `Konflik fatal: Akun baru (${newDiscordId}) sudah tertaut ke Trucky ID berbeda (#${targetTruckyId}), sedangkan akun lama tertaut ke #${sourceTruckyId}.`;
    conflictReasons.push(blockReason);
  } else if (hasAnyFootprint(targetSummary)) {
    conflictStatus = "mergeable_conflict";
    if (targetSummary.hasUserDoc) conflictReasons.push("Akun baru sudah pernah login ke web (memiliki dokumen users)");
    if (targetSummary.hasDriverLink) conflictReasons.push("Akun baru memiliki dokumen driverlinks");
    if (targetSummary.totalNC > 0) {
      conflictReasons.push(
        `Akun baru memiliki saldo ${targetSummary.totalNC.toLocaleString("id-ID")} NC`,
      );
    }
    if (targetSummary.totalPoints > 0) {
      conflictReasons.push(`Akun baru memiliki ${targetSummary.totalPoints} poin penalti`);
    }
    if (targetSummary.hasGarage) conflictReasons.push("Akun baru sudah memiliki garasi");
    if (targetSummary.fleetsOwnedCount > 0 || targetSummary.fleetsDrivenCount > 0) {
      conflictReasons.push(
        `Akun baru terkait dengan ${targetSummary.fleetsOwnedCount + targetSummary.fleetsDrivenCount} armada`,
      );
    }
    if (targetSummary.jobHistoriesCount > 0) {
      conflictReasons.push(`Akun baru memiliki ${targetSummary.jobHistoriesCount} riwayat job`);
    }
    if (targetSummary.transactionsCount > 0 || targetSummary.vouchersCount > 0) {
      conflictReasons.push("Akun baru sudah memiliki transaksi/voucher");
    }
    if (conflictReasons.length === 0) {
      conflictReasons.push("Akun baru sudah memiliki data tercatat di database");
    }
  }

  if (targetDiscord.apiAvailable && !targetDiscord.exists) {
    blockReason = `Discord ID baru (${newDiscordId}) tidak valid / tidak ditemukan di Discord.`;
  } else if (!targetDiscord.apiAvailable) {
    warnings.push("Peringatan: Tidak dapat memverifikasi target ke Discord API (DISCORD_BOT_TOKEN tidak aktif atau gangguan jaringan).");
  }

  if (!hasAnyFootprint(sourceSummary)) {
    blockReason =
      blockReason ||
      `Tidak ditemukan data apa pun untuk Discord ID lama (${oldDiscordId}) di database.`;
  }

  if (rolePrediction.targetNotInGuildWarning) {
    warnings.push(rolePrediction.targetNotInGuildWarning);
  }
  if (rolePrediction.managerRoleNotice) {
    warnings.push(rolePrediction.managerRoleNotice);
  }

  return {
    oldDiscordId,
    newDiscordId,
    sourceDiscord,
    targetDiscord,
    sourceMember,
    targetMember,
    sourceSummary,
    targetSummary,
    conflictStatus,
    conflictReasons,
    warnings,
    canMigrate: conflictStatus !== "blocked_driver_conflict" && blockReason === null,
    blockReason,
    rolePrediction,
  };
}

async function safeUpdateMany(
  db: Db,
  stats: CollectionUpdateStat[],
  group: string,
  collection: string,
  filter: Filter<Document>,
  update: UpdateFilter<Document>,
  note?: string,
) {
  const res = await db.collection(collection).updateMany(filter, update);
  if (res.modifiedCount > 0) {
    stats.push({
      collection,
      group,
      updatedCount: res.modifiedCount,
      deletedConflictsCount: 0,
      note,
    });
  }
  return res.modifiedCount;
}

async function deduplicateSimpleUniqueCollection(
  db: Db,
  stats: CollectionUpdateStat[],
  group: string,
  collection: string,
  oldIdField: string,
  oldDiscordId: string,
  newDiscordId: string,
  keyFields: string[],
  strategy: MigrationConflictStrategy,
  extraSet: Record<string, unknown> = {},
) {
  let deletedConflictsCount = 0;

  if (strategy === "override") {
    const delRes = await db.collection(collection).deleteMany({ [oldIdField]: newDiscordId });
    deletedConflictsCount = delRes.deletedCount;
  } else {
    const projection: Record<string, 1> = {};
    for (const kf of keyFields) projection[kf] = 1;
    const oldDocs = await db
      .collection(collection)
      .find({ [oldIdField]: oldDiscordId }, { projection })
      .toArray();

    for (const doc of oldDocs) {
      const collisionFilter: Record<string, unknown> = { [oldIdField]: newDiscordId };
      let hasAllKeys = true;
      for (const kf of keyFields) {
        if (doc[kf] === undefined || doc[kf] === null) {
          hasAllKeys = false;
          break;
        }
        collisionFilter[kf] = doc[kf];
      }
      if (hasAllKeys) {
        const del = await db.collection(collection).deleteMany(collisionFilter as Filter<Document>);
        deletedConflictsCount += del.deletedCount;
      }
    }
  }

  const upd = await db
    .collection(collection)
    .updateMany({ [oldIdField]: oldDiscordId }, { $set: { [oldIdField]: newDiscordId, ...extraSet } });

  if (upd.modifiedCount > 0 || deletedConflictsCount > 0) {
    stats.push({
      collection,
      group,
      updatedCount: upd.modifiedCount,
      deletedConflictsCount,
    });
  }
}

async function migrateStringArrayField(
  db: Db,
  stats: CollectionUpdateStat[],
  group: string,
  collection: string,
  field: string,
  oldDiscordId: string,
  newDiscordId: string,
) {
  const count = await db.collection(collection).countDocuments({ [field]: oldDiscordId });
  if (count === 0) return;

  await db
    .collection(collection)
    .updateMany({ [field]: oldDiscordId }, { $addToSet: { [field]: newDiscordId } });
  const pullRes = await db
    .collection(collection)
    .updateMany({ [field]: oldDiscordId }, { $pull: { [field]: oldDiscordId } } as UpdateFilter<Document>);

  stats.push({
    collection,
    group,
    updatedCount: pullRes.modifiedCount || count,
    deletedConflictsCount: 0,
    note: `Array ${field}`,
  });
}

async function migrateObjectArrayParticipants(
  db: Db,
  stats: CollectionUpdateStat[],
  group: string,
  collection: string,
  arrayField: string,
  idField: string,
  oldDiscordId: string,
  newDiscordId: string,
  sumFields: string[],
  alsoMirrorField?: string,
) {
  const docs = await db
    .collection(collection)
    .find({ [`${arrayField}.${idField}`]: oldDiscordId })
    .toArray();

  if (docs.length === 0) return;

  let modified = 0;
  for (const doc of docs) {
    const arr: Array<Record<string, unknown>> = Array.isArray(doc[arrayField])
      ? (doc[arrayField] as Array<Record<string, unknown>>)
      : [];
    const oldEntries = arr.filter((item) => item?.[idField] === oldDiscordId);
    const newEntries = arr.filter((item) => item?.[idField] === newDiscordId);
    const others = arr.filter(
      (item) => item?.[idField] !== oldDiscordId && item?.[idField] !== newDiscordId,
    );

    if (oldEntries.length === 0) continue;

    let mergedEntry: Record<string, unknown>;
    if (newEntries.length > 0) {
      mergedEntry = { ...newEntries[0], [idField]: newDiscordId };
      for (const oldItem of oldEntries) {
        for (const sf of sumFields) {
          mergedEntry[sf] = Number(mergedEntry[sf] || 0) + Number(oldItem?.[sf] || 0);
        }
      }
    } else {
      mergedEntry = { ...oldEntries[0], [idField]: newDiscordId };
      if (alsoMirrorField && mergedEntry[alsoMirrorField] === oldDiscordId) {
        mergedEntry[alsoMirrorField] = newDiscordId;
      }
    }

    const updatedArr = [...others, mergedEntry];
    await db
      .collection(collection)
      .updateOne({ _id: doc._id }, { $set: { [arrayField]: updatedArr } });
    modified++;
  }

  if (modified > 0) {
    stats.push({
      collection,
      group,
      updatedCount: modified,
      deletedConflictsCount: 0,
      note: `Deduplikasi array ${arrayField}`,
    });
  }
}

async function syncDiscordRoleSingle(
  guildId: string,
  userId: string,
  roleId: string,
  action: "add" | "remove",
): Promise<{ ok: boolean; notFound?: boolean; error?: string }> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return { ok: false, error: "DISCORD_BOT_TOKEN tidak tersedia" };

  const method = action === "add" ? "PUT" : "DELETE";
  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`,
      {
        method,
        headers: {
          Authorization: `Bot ${token}`,
          "X-Audit-Log-Reason": encodeURIComponent("Nismara Discord Account Migration"),
        },
        cache: "no-store",
      },
    );

    if (res.ok || res.status === 204) return { ok: true };
    if (res.status === 404) return { ok: false, notFound: true, error: "Member/Role 404" };
    const text = await res.text();
    return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 120)}` };
  } catch (err: unknown) {
    return { ok: false, error: getErrorMessage(err, "Discord API error") };
  }
}

/**
 * Mengeksekusi migrasi penuh seluruh data akun Discord lama ke akun Discord baru.
 */
export async function executeDiscordAccountMigration({
  oldDiscordId: rawOldId,
  newDiscordId: rawNewId,
  conflictStrategy,
  executedByDiscordId,
  executedByName,
}: {
  oldDiscordId: string;
  newDiscordId: string;
  conflictStrategy: MigrationConflictStrategy;
  executedByDiscordId: string;
  executedByName: string;
}): Promise<MigrationExecutionResult> {
  const oldDiscordId = rawOldId.trim();
  const newDiscordId = rawNewId.trim();

  if (!isOwnerDiscordId(executedByDiscordId)) {
    throw new Error("Akses ditolak: hanya Owner yang dapat mengeksekusi migrasi akun.");
  }

  const allowed = checkRateLimit(executedByDiscordId, "migrate_discord_account", 5000);
  if (!allowed) {
    throw new Error("Terlalu cepat. Tunggu beberapa detik sebelum migrasi berikutnya.");
  }

  const lockKey = `lock:migrate-account:${[oldDiscordId, newDiscordId].sort().join(":")}`;
  const lockValue = `${executedByDiscordId}:${Date.now()}`;
  const lockAcquired = await redis.set(lockKey, lockValue, "EX", 120, "NX");
  if (!lockAcquired) {
    throw new Error("Proses migrasi untuk pasangan akun ini sedang berjalan.");
  }

  try {
    const preview = await previewDiscordAccountMigration(oldDiscordId, newDiscordId);
    if (!preview.canMigrate) {
      throw new Error(preview.blockReason || "Migrasi diblokir oleh validasi sistem.");
    }

    const client = await clientPromise;
    const db = client.db();
    const now = new Date();
    const roleCfg = await resolveRoleConfig(db, DEFAULT_GUILD_ID);
    const stats: CollectionUpdateStat[] = [];

    // 1. Tentukan Canonical User._id (mongodb ObjectId - BSON 6)
    const oldUser = await findUserByDiscord(db, oldDiscordId);
    const newUser = await findUserByDiscord(db, newDiscordId);

    const oldUserId: ObjectId | null = oldUser?._id
      ? oldUser._id instanceof ObjectId
        ? oldUser._id
        : new ObjectId(String(oldUser._id))
      : null;
    const newUserId: ObjectId | null = newUser?._id
      ? newUser._id instanceof ObjectId
        ? newUser._id
        : new ObjectId(String(newUser._id))
      : null;

    const canonicalUserId: ObjectId | null = oldUserId ?? newUserId ?? null;
    const secondaryUserId: ObjectId | null =
      oldUserId && newUserId && !oldUserId.equals(newUserId) ? newUserId : null;

    // 2. Cabut seluruh session lama & target (kick hacker segera!)
    const sessionUserIds: Array<ObjectId | string> = [];
    if (oldUserId) sessionUserIds.push(oldUserId, oldUserId.toString());
    if (secondaryUserId) sessionUserIds.push(secondaryUserId, secondaryUserId.toString());
    if (sessionUserIds.length > 0) {
      const sessDel = await db
        .collection("sessions")
        .deleteMany({ userId: { $in: sessionUserIds } });
      if (sessDel.deletedCount > 0) {
        stats.push({
          collection: "sessions",
          group: "Auth & Profil",
          updatedCount: 0,
          deletedConflictsCount: sessDel.deletedCount,
          note: "Sesi aktif dicabut otomatis",
        });
      }
    }

    // 3. Kelola dokumen users (Gabung/Override jika secondaryUserId ada)
    if (oldUser && oldUserId) {
      let deletedTargetUsers = 0;
      const updateUserSet: Record<string, unknown> = {
        discordId: newDiscordId,
        migratedFromDiscordId: oldDiscordId,
        migratedAt: now,
        updatedAt: now,
      };

      // Update avatar hanya jika avatar lama masih dari Discord CDN
      if (
        preview.targetDiscord.avatarUrl &&
        (!oldUser.image || String(oldUser.image).includes("cdn.discordapp.com"))
      ) {
        updateUserSet.image = preview.targetDiscord.avatarUrl;
      }

      if (secondaryUserId && newUser) {
        if (conflictStrategy === "merge") {
          if (!oldUser.email && newUser.email) updateUserSet.email = newUser.email;
          if (!oldUser.bio && newUser.bio) updateUserSet.bio = newUser.bio;
          updateUserSet.isBooster = Boolean(oldUser.isBooster || newUser.isBooster);

          const oldPlus = oldUser.nismaraplus;
          const newPlus = newUser.nismaraplus;
          if (oldPlus?.status || newPlus?.status) {
            const oldExp = oldPlus?.expiresAt ? new Date(oldPlus.expiresAt).getTime() : 0;
            const newExp = newPlus?.expiresAt ? new Date(newPlus.expiresAt).getTime() : 0;
            const nowMs = now.getTime();
            const isLifetime = Boolean(oldPlus?.isLifetime || newPlus?.isLifetime);
            let mergedExpMs = Math.max(oldExp, newExp);
            if (!isLifetime && oldExp > nowMs && newExp > nowMs) {
              mergedExpMs = nowMs + (oldExp - nowMs) + (newExp - nowMs);
            }
            updateUserSet.nismaraplus = {
              ...(oldPlus || {}),
              ...(newPlus || {}),
              ...oldPlus,
              status: true,
              isLifetime,
              expiresAt: isLifetime ? null : mergedExpMs > 0 ? new Date(mergedExpMs) : null,
            };
          }
        }

        const delTargetUser = await db.collection("users").deleteOne({ _id: secondaryUserId });
        deletedTargetUsers = delTargetUser.deletedCount;
      }

      await db.collection("users").updateOne(
        { _id: oldUserId },
        {
          $set: updateUserSet,
          $addToSet: { previousDiscordIds: oldDiscordId },
        },
      );
      stats.push({
        collection: "users",
        group: "Auth & Profil",
        updatedCount: 1,
        deletedConflictsCount: deletedTargetUsers,
      });
    } else if (newUser && newUserId) {
      // Hanya target user ada; perkaya dari driverlinks lama bila ada
      const oldDl = await db
        .collection("driverlinks")
        .findOne({ guildId: DEFAULT_GUILD_ID, userId: oldDiscordId });
      const enrichSet: Record<string, unknown> = {
        migratedFromDiscordId: oldDiscordId,
        migratedAt: now,
        updatedAt: now,
      };
      if (oldDl?.truckyId && !newUser.truckyId) {
        enrichSet.truckyId = String(oldDl.truckyId);
        enrichSet.isDriver = true;
      }
      await db.collection("users").updateOne(
        { _id: newUserId },
        { $set: enrichSet, $addToSet: { previousDiscordIds: oldDiscordId } },
      );
      stats.push({
        collection: "users",
        group: "Auth & Profil",
        updatedCount: 1,
        deletedConflictsCount: 0,
      });
    }

    // Update referensi staff/promotor jika user lain dipromosikan oleh akun lama
    await safeUpdateMany(
      db,
      stats,
      "Staff & Pengaturan",
      "users",
      { promotedBy: oldDiscordId },
      { $set: { promotedBy: newDiscordId } },
      "Referensi promotedBy",
    );

    // 4. Kelola NextAuth `accounts` (unique: { provider, providerAccountId })
    if (canonicalUserId) {
      const existingNewAcc = await db
        .collection("accounts")
        .findOne({ provider: "discord", providerAccountId: newDiscordId });
      const existingOldAccs = await db
        .collection("accounts")
        .find({
          provider: "discord",
          $or: [
            { providerAccountId: oldDiscordId },
            ...(oldUserId ? [{ userId: oldUserId }, { userId: oldUserId.toString() }] : []),
          ],
        })
        .toArray();

      let accUpdated = 0;
      let accDeleted = 0;

      if (existingNewAcc) {
        if (existingOldAccs.length > 0) {
          const oldIdsToDelete = existingOldAccs
            .filter((a) => !a._id.equals(existingNewAcc._id))
            .map((a) => a._id);
          if (oldIdsToDelete.length > 0) {
            const delAcc = await db
              .collection("accounts")
              .deleteMany({ _id: { $in: oldIdsToDelete } });
            accDeleted += delAcc.deletedCount;
          }
        }
        await db
          .collection("accounts")
          .updateOne({ _id: existingNewAcc._id }, { $set: { userId: canonicalUserId } });
        accUpdated = 1;
      } else if (existingOldAccs.length > 0) {
        const primaryAcc = existingOldAccs[0];
        if (existingOldAccs.length > 1) {
          const extraIds = existingOldAccs.slice(1).map((a) => a._id);
          const delAcc = await db
            .collection("accounts")
            .deleteMany({ _id: { $in: extraIds } });
          accDeleted += delAcc.deletedCount;
        }
        await db.collection("accounts").updateOne(
          { _id: primaryAcc._id },
          {
            $set: {
              userId: canonicalUserId,
              provider: "discord",
              providerAccountId: newDiscordId,
              type: primaryAcc.type || "oauth",
            },
            $unset: {
              access_token: "",
              refresh_token: "",
              expires_at: "",
              id_token: "",
              token_type: "",
              scope: "",
            },
          },
        );
        accUpdated = 1;
      } else {
        await db.collection("accounts").insertOne({
          userId: canonicalUserId,
          type: "oauth",
          provider: "discord",
          providerAccountId: newDiscordId,
        });
        accUpdated = 1;
      }

      stats.push({
        collection: "accounts",
        group: "Auth & Profil",
        updatedCount: accUpdated,
        deletedConflictsCount: accDeleted,
      });
    }

    // 5. Kelola `driverlinks` (unique: { guildId, userId })
    const oldDriverLinks = await db
      .collection("driverlinks")
      .find({ userId: oldDiscordId })
      .toArray();
    let dlUpdated = 0;
    let dlDeleted = 0;

    for (const dl of oldDriverLinks) {
      const targetDl = await db
        .collection("driverlinks")
        .findOne({ guildId: dl.guildId, userId: newDiscordId });
      const prevSet = new Set<string>([
        ...(Array.isArray(dl.previousUserIds) ? dl.previousUserIds : []),
        ...(targetDl && conflictStrategy === "merge" && Array.isArray(targetDl.previousUserIds)
          ? targetDl.previousUserIds
          : []),
        oldDiscordId,
      ]);

      if (targetDl) {
        await db.collection("driverlinks").deleteOne({ _id: targetDl._id });
        dlDeleted++;
      }

      await db.collection("driverlinks").updateOne(
        { _id: dl._id },
        {
          $set: {
            userId: newDiscordId,
            previousUserIds: Array.from(prevSet),
            updatedAt: now,
          },
        },
      );
      dlUpdated++;
    }
    if (dlUpdated > 0 || dlDeleted > 0) {
      stats.push({
        collection: "driverlinks",
        group: "Auth & Profil",
        updatedCount: dlUpdated,
        deletedConflictsCount: dlDeleted,
      });
    }

    // 6. Ekonomi: `currencies`, `currencyhistories`, `points`, `pointhistories`
    const currGuilds = await db
      .collection("currencies")
      .distinct("guildId", { userId: { $in: [oldDiscordId, newDiscordId] } });
    const allCurrGuilds = Array.from(new Set([DEFAULT_GUILD_ID, ...currGuilds]));
    let currUpdated = 0;
    let currDeleted = 0;

    for (const gId of allCurrGuilds) {
      const oldCurr = await db
        .collection("currencies")
        .findOne({ userId: oldDiscordId, guildId: gId });
      const newCurr = await db
        .collection("currencies")
        .findOne({ userId: newDiscordId, guildId: gId });

      if (oldCurr && newCurr) {
        const addedNC = Number(newCurr.totalNC || 0);
        await db.collection("currencies").deleteOne({ _id: newCurr._id });
        currDeleted++;

        if (conflictStrategy === "merge") {
          await db.collection("currencies").updateOne(
            { _id: oldCurr._id },
            { $set: { userId: newDiscordId, updatedAt: now }, $inc: { totalNC: addedNC } },
          );
          if (addedNC !== 0) {
            await db.collection("currencyhistories").insertOne({
              userId: newDiscordId,
              guildId: gId,
              amount: addedNC,
              type: addedNC >= 0 ? "earn" : "spend",
              reason: `Merge saldo NC migrasi akun (${oldDiscordId} -> ${newDiscordId})`,
              createdAt: now,
            });
          }
        } else {
          await db
            .collection("currencies")
            .updateOne({ _id: oldCurr._id }, { $set: { userId: newDiscordId, updatedAt: now } });
        }
        currUpdated++;
      } else if (oldCurr) {
        await db
          .collection("currencies")
          .updateOne({ _id: oldCurr._id }, { $set: { userId: newDiscordId, updatedAt: now } });
        currUpdated++;
      } else if (newCurr && conflictStrategy === "override") {
        await db.collection("currencies").deleteOne({ _id: newCurr._id });
        currDeleted++;
      }
    }
    if (currUpdated > 0 || currDeleted > 0) {
      stats.push({
        collection: "currencies",
        group: "Ekonomi & Penalti",
        updatedCount: currUpdated,
        deletedConflictsCount: currDeleted,
      });
    }

    if (conflictStrategy === "override") {
      const delCh = await db.collection("currencyhistories").deleteMany({ userId: newDiscordId });
      const updCh = await db
        .collection("currencyhistories")
        .updateMany({ userId: oldDiscordId }, { $set: { userId: newDiscordId } });
      if (updCh.modifiedCount > 0 || delCh.deletedCount > 0) {
        stats.push({
          collection: "currencyhistories",
          group: "Ekonomi & Penalti",
          updatedCount: updCh.modifiedCount,
          deletedConflictsCount: delCh.deletedCount,
        });
      }
    } else {
      await safeUpdateMany(
        db,
        stats,
        "Ekonomi & Penalti",
        "currencyhistories",
        { userId: oldDiscordId },
        { $set: { userId: newDiscordId } },
      );
    }

    // Points (Penalti: tidak boleh negatif)
    const ptGuilds = await db
      .collection("points")
      .distinct("guildId", { userId: { $in: [oldDiscordId, newDiscordId] } });
    const allPtGuilds = Array.from(new Set([DEFAULT_GUILD_ID, ...ptGuilds]));
    let ptUpdated = 0;
    let ptDeleted = 0;

    for (const gId of allPtGuilds) {
      const oldPt = await db.collection("points").findOne({ userId: oldDiscordId, guildId: gId });
      const newPt = await db.collection("points").findOne({ userId: newDiscordId, guildId: gId });

      if (oldPt && newPt) {
        const addedPts = Math.max(0, Number(newPt.totalPoints || 0));
        const basePts = Math.max(0, Number(oldPt.totalPoints || 0));
        await db.collection("points").deleteOne({ _id: newPt._id });
        ptDeleted++;

        const nextPts = conflictStrategy === "merge" ? basePts + addedPts : basePts;
        await db
          .collection("points")
          .updateOne(
            { _id: oldPt._id },
            { $set: { userId: newDiscordId, totalPoints: nextPts, updatedAt: now } },
          );
        if (conflictStrategy === "merge" && addedPts > 0) {
          await db.collection("pointhistories").insertOne({
            userId: newDiscordId,
            guildId: gId,
            managerId: executedByDiscordId,
            points: addedPts,
            type: "add",
            reason: `Merge poin penalti migrasi akun (${oldDiscordId} -> ${newDiscordId})`,
            createdAt: now,
          });
        }
        ptUpdated++;
      } else if (oldPt) {
        await db.collection("points").updateOne(
          { _id: oldPt._id },
          {
            $set: {
              userId: newDiscordId,
              totalPoints: Math.max(0, Number(oldPt.totalPoints || 0)),
              updatedAt: now,
            },
          },
        );
        ptUpdated++;
      } else if (newPt && conflictStrategy === "override") {
        await db.collection("points").deleteOne({ _id: newPt._id });
        ptDeleted++;
      }
    }
    if (ptUpdated > 0 || ptDeleted > 0) {
      stats.push({
        collection: "points",
        group: "Ekonomi & Penalti",
        updatedCount: ptUpdated,
        deletedConflictsCount: ptDeleted,
      });
    }

    if (conflictStrategy === "override") {
      const delPh = await db.collection("pointhistories").deleteMany({ userId: newDiscordId });
      const updPh = await db
        .collection("pointhistories")
        .updateMany({ userId: oldDiscordId }, { $set: { userId: newDiscordId } });
      await db
        .collection("pointhistories")
        .updateMany({ managerId: oldDiscordId }, { $set: { managerId: newDiscordId } });
      if (updPh.modifiedCount > 0 || delPh.deletedCount > 0) {
        stats.push({
          collection: "pointhistories",
          group: "Ekonomi & Penalti",
          updatedCount: updPh.modifiedCount,
          deletedConflictsCount: delPh.deletedCount,
        });
      }
    } else {
      await safeUpdateMany(
        db,
        stats,
        "Ekonomi & Penalti",
        "pointhistories",
        { userId: oldDiscordId },
        { $set: { userId: newDiscordId } },
      );
      await safeUpdateMany(
        db,
        stats,
        "Ekonomi & Penalti",
        "pointhistories",
        { managerId: oldDiscordId },
        { $set: { managerId: newDiscordId } },
        "Riwayat manager penalti",
      );
    }

    // 7. Garasi, Armada & Tim (`garages`, `fleets`, `teams`)
    const oldGarage = await db.collection("garages").findOne({
      $or: [{ discordId: oldDiscordId }, ...(oldUserId ? [{ userId: oldUserId }] : [])],
    });
    const newGarage = secondaryUserId
      ? await db.collection("garages").findOne({
          $or: [{ discordId: newDiscordId }, { userId: secondaryUserId }],
        })
      : await db.collection("garages").findOne({ discordId: newDiscordId });

    let fleetsModified = 0;
    let fleetsDeleted = 0;
    if (secondaryUserId && canonicalUserId) {
      if (conflictStrategy === "merge") {
        const resOwner = await db
          .collection("fleets")
          .updateMany({ owner: secondaryUserId }, { $set: { owner: canonicalUserId } });
        const resDriver = await db
          .collection("fleets")
          .updateMany({ driver: secondaryUserId }, { $set: { driver: canonicalUserId } });
        fleetsModified = resOwner.modifiedCount + resDriver.modifiedCount;
      } else {
        const releaseLeased = await db.collection("fleets").updateMany(
          { owner: { $ne: secondaryUserId }, driver: secondaryUserId },
          { $set: { driver: null, status: "available" } },
        );
        const delOwned = await db.collection("fleets").deleteMany({ owner: secondaryUserId });
        fleetsModified = releaseLeased.modifiedCount;
        fleetsDeleted = delOwned.deletedCount;
      }
    }
    if (fleetsModified > 0 || fleetsDeleted > 0) {
      stats.push({
        collection: "fleets",
        group: "Garasi & Armada",
        updatedCount: fleetsModified,
        deletedConflictsCount: fleetsDeleted,
      });
    }

    const totalMergedOwnedFleets = canonicalUserId
      ? await db.collection("fleets").countDocuments({ owner: canonicalUserId })
      : 0;

    if (oldGarage && newGarage && !oldGarage._id.equals(newGarage._id)) {
      await db.collection("garages").deleteOne({ _id: newGarage._id });
      const mergedSet: Record<string, unknown> = {
        discordId: newDiscordId,
        ...(canonicalUserId ? { userId: canonicalUserId } : {}),
        updatedAt: now,
      };
      if (conflictStrategy === "merge") {
        const mergedUsed = Math.max(
          totalMergedOwnedFleets,
          Number(oldGarage.fleetSlotUsed || 0) + Number(newGarage.fleetSlotUsed || 0),
        );
        mergedSet.fleetSlotUsed = mergedUsed;
        mergedSet.fleetSlot = Math.max(
          Number(oldGarage.fleetSlot || 1),
          Number(newGarage.fleetSlot || 1),
          mergedUsed,
        );
        mergedSet.fleetSlotLevel = Math.max(
          Number(oldGarage.fleetSlotLevel || 1),
          Number(newGarage.fleetSlotLevel || 1),
        );
        mergedSet.fuelCapacity = Math.max(
          Number(oldGarage.fuelCapacity || 2000),
          Number(newGarage.fuelCapacity || 2000),
        );
        mergedSet.fuelTankLevel = Math.max(
          Number(oldGarage.fuelTankLevel || 1),
          Number(newGarage.fuelTankLevel || 1),
        );
        mergedSet.fuelStock = Number(oldGarage.fuelStock || 0) + Number(newGarage.fuelStock || 0);
        mergedSet.safeboxLevel = Math.max(
          Number(oldGarage.safeboxLevel || 1),
          Number(newGarage.safeboxLevel || 1),
        );
        mergedSet.safeboxStock =
          Number(oldGarage.safeboxStock || 0) + Number(newGarage.safeboxStock || 0);
      }
      await db.collection("garages").updateOne({ _id: oldGarage._id }, { $set: mergedSet });
      stats.push({
        collection: "garages",
        group: "Garasi & Armada",
        updatedCount: 1,
        deletedConflictsCount: 1,
      });
    } else if (oldGarage) {
      await db.collection("garages").updateOne(
        { _id: oldGarage._id },
        {
          $set: {
            discordId: newDiscordId,
            ...(canonicalUserId ? { userId: canonicalUserId } : {}),
            updatedAt: now,
          },
        },
      );
      stats.push({
        collection: "garages",
        group: "Garasi & Armada",
        updatedCount: 1,
        deletedConflictsCount: 0,
      });
    } else if (newGarage) {
      if (conflictStrategy === "override") {
        await db.collection("garages").deleteOne({ _id: newGarage._id });
        stats.push({
          collection: "garages",
          group: "Garasi & Armada",
          updatedCount: 0,
          deletedConflictsCount: 1,
        });
      } else {
        await db.collection("garages").updateOne(
          { _id: newGarage._id },
          {
            $set: {
              discordId: newDiscordId,
              ...(canonicalUserId ? { userId: canonicalUserId } : {}),
              updatedAt: now,
            },
          },
        );
        stats.push({
          collection: "garages",
          group: "Garasi & Armada",
          updatedCount: 1,
          deletedConflictsCount: 0,
        });
      }
    }

    // Teams (gunakan canonicalUserId jika secondaryUserId ada)
    if (secondaryUserId && canonicalUserId) {
      const teamsCol = db.collection<{
        owner: ObjectId;
        members: ObjectId[];
        pendingRequests: ObjectId[];
      }>("teams");
      let teamUpdated = 0;
      let teamDeleted = 0;
      if (conflictStrategy === "merge") {
        const ownUpd = await teamsCol.updateMany(
          { owner: secondaryUserId },
          { $set: { owner: canonicalUserId } },
        );
        teamUpdated += ownUpd.modifiedCount;
        await teamsCol.updateMany(
          { members: secondaryUserId },
          { $addToSet: { members: canonicalUserId } },
        );
        const pullMem = await teamsCol.updateMany(
          { members: secondaryUserId },
          { $pull: { members: secondaryUserId } },
        );
        teamUpdated += pullMem.modifiedCount;
        await teamsCol.updateMany(
          { pendingRequests: secondaryUserId },
          { $addToSet: { pendingRequests: canonicalUserId } },
        );
        await teamsCol.updateMany(
          { pendingRequests: secondaryUserId },
          { $pull: { pendingRequests: secondaryUserId } },
        );
      } else {
        const pullRes = await teamsCol.updateMany(
          { $or: [{ members: secondaryUserId }, { pendingRequests: secondaryUserId }] },
          { $pull: { members: secondaryUserId, pendingRequests: secondaryUserId } },
        );
        teamUpdated += pullRes.modifiedCount;
        const delOwnedTeams = await teamsCol.deleteMany({ owner: secondaryUserId });
        teamDeleted += delOwnedTeams.deletedCount;
      }
      if (teamUpdated > 0 || teamDeleted > 0) {
        stats.push({
          collection: "teams",
          group: "Garasi & Armada",
          updatedCount: teamUpdated,
          deletedConflictsCount: teamDeleted,
        });
      }
    }

    // 8. Season Pass (`userseasonprogresses`, `seasonpassmerchclaims`, `nplusweeklyquestclaims`)
    const oldProgresses = await db
      .collection("userseasonprogresses")
      .find({ discordId: oldDiscordId })
      .toArray();
    let spUpdated = 0;
    let spDeleted = 0;

    if (conflictStrategy === "override") {
      const delSp = await db
        .collection("userseasonprogresses")
        .deleteMany({ discordId: newDiscordId });
      spDeleted = delSp.deletedCount;
      const updSp = await db.collection("userseasonprogresses").updateMany(
        { discordId: oldDiscordId },
        {
          $set: {
            discordId: newDiscordId,
            ...(canonicalUserId ? { userId: canonicalUserId } : {}),
            updatedAt: now,
          },
        },
      );
      spUpdated = updSp.modifiedCount;
    } else {
      for (const oldSp of oldProgresses) {
        const newSp = await db.collection("userseasonprogresses").findOne({
          seasonNumber: oldSp.seasonNumber,
          discordId: newDiscordId,
        });

        const mergeSet: Record<string, unknown> = {
          discordId: newDiscordId,
          ...(canonicalUserId ? { userId: canonicalUserId } : {}),
          updatedAt: now,
        };

        if (newSp) {
          await db.collection("userseasonprogresses").deleteOne({ _id: newSp._id });
          spDeleted++;
          mergeSet.currentXp = Number(oldSp.currentXp || 0) + Number(newSp.currentXp || 0);
          mergeSet.currentLevel = Math.max(
            Number(oldSp.currentLevel || 0),
            Number(newSp.currentLevel || 0),
          );
          mergeSet.isPremium = Boolean(oldSp.isPremium || newSp.isPremium);
          mergeSet.purchasedAt = oldSp.purchasedAt || newSp.purchasedAt || null;
          mergeSet.claimedFreeLevels = Array.from(
            new Set([
              ...(Array.isArray(oldSp.claimedFreeLevels) ? oldSp.claimedFreeLevels : []),
              ...(Array.isArray(newSp.claimedFreeLevels) ? newSp.claimedFreeLevels : []),
            ]),
          ).sort((a, b) => a - b);
          mergeSet.claimedPremiumLevels = Array.from(
            new Set([
              ...(Array.isArray(oldSp.claimedPremiumLevels) ? oldSp.claimedPremiumLevels : []),
              ...(Array.isArray(newSp.claimedPremiumLevels) ? newSp.claimedPremiumLevels : []),
            ]),
          ).sort((a, b) => a - b);
          mergeSet.levelSkipsPurchased =
            Number(oldSp.levelSkipsPurchased || 0) + Number(newSp.levelSkipsPurchased || 0);
          if (!oldSp.merchClaim?.claimedAt && newSp.merchClaim?.claimedAt) {
            mergeSet.merchClaim = newSp.merchClaim;
          }
        }

        await db
          .collection("userseasonprogresses")
          .updateOne({ _id: oldSp._id }, { $set: mergeSet });
        spUpdated++;
      }
      if (canonicalUserId) {
        const remUpd = await db.collection("userseasonprogresses").updateMany(
          { discordId: newDiscordId },
          { $set: { userId: canonicalUserId } },
        );
        spUpdated += remUpd.modifiedCount;
      }
    }
    if (spUpdated > 0 || spDeleted > 0) {
      stats.push({
        collection: "userseasonprogresses",
        group: "Season Pass & Quest",
        updatedCount: spUpdated,
        deletedConflictsCount: spDeleted,
      });
    }

    await deduplicateSimpleUniqueCollection(
      db,
      stats,
      "Season Pass & Quest",
      "seasonpassmerchclaims",
      "discordId",
      oldDiscordId,
      newDiscordId,
      ["seasonNumber"],
      conflictStrategy,
      canonicalUserId ? { userId: canonicalUserId } : {},
    );
    await deduplicateSimpleUniqueCollection(
      db,
      stats,
      "Season Pass & Quest",
      "nplusweeklyquestclaims",
      "discordId",
      oldDiscordId,
      newDiscordId,
      ["weekKey", "questId"],
      conflictStrategy,
      canonicalUserId ? { userId: canonicalUserId } : {},
    );

    // 9. Koleksi dengan Unique Compound Index lainnya
    await deduplicateSimpleUniqueCollection(
      db,
      stats,
      "Market & Sosial",
      "marketpurchases",
      "buyerId",
      oldDiscordId,
      newDiscordId,
      ["marketItemId"],
      conflictStrategy,
    );
    await deduplicateSimpleUniqueCollection(
      db,
      stats,
      "Market & Sosial",
      "marketreviews",
      "buyerId",
      oldDiscordId,
      newDiscordId,
      ["marketItemId"],
      conflictStrategy,
    );
    await deduplicateSimpleUniqueCollection(
      db,
      stats,
      "Event & Minigame",
      "giveawaytickets",
      "discordId",
      oldDiscordId,
      newDiscordId,
      ["giveawayId", "questId"],
      conflictStrategy,
      canonicalUserId ? { userId: canonicalUserId } : {},
    );
    await deduplicateSimpleUniqueCollection(
      db,
      stats,
      "Lainnya & Survey",
      "survey_responses",
      "discordId",
      oldDiscordId,
      newDiscordId,
      ["surveyUri"],
      conflictStrategy,
    );
    await deduplicateSimpleUniqueCollection(
      db,
      stats,
      "Pekerjaan & Operasional",
      "validatedjobs",
      "userId",
      oldDiscordId,
      newDiscordId,
      ["guildId", "jobId"],
      conflictStrategy,
    );
    await deduplicateSimpleUniqueCollection(
      db,
      stats,
      "Staff & Pengaturan",
      "managersalaryrecords",
      "managerId",
      oldDiscordId,
      newDiscordId,
      ["month"],
      conflictStrategy,
    );

    // 10. Koleksi Personal 1-to-Many (Override bersihkan starter target terlebih dahulu)
    if (conflictStrategy === "override") {
      const overridePersonalDeletes: Array<[string, string, Filter<Document>]> = [
        ["uservouchers", "Order, Voucher & Tiket", { discordId: newDiscordId }],
        ["userachievements", "Event & Minigame", { discordId: newDiscordId }],
        ["collectibles", "Event & Minigame", { discordId: newDiscordId }],
        ["lottotickets", "Event & Minigame", { discordId: newDiscordId }],
        ["scratchtickets", "Event & Minigame", { discordId: newDiscordId }],
        ["racingtickets", "Event & Minigame", { discordId: newDiscordId }],
        ["aichathistories", "Lainnya & Survey", { discordId: newDiscordId }],
        ["securityalerts", "Lainnya & Survey", { discordId: newDiscordId }],
      ];
      for (const [col, group, filter] of overridePersonalDeletes) {
        const del = await db.collection(col).deleteMany(filter);
        if (del.deletedCount > 0) {
          stats.push({
            collection: col,
            group,
            updatedCount: 0,
            deletedConflictsCount: del.deletedCount,
            note: "Target starter data ditimpa (Override)",
          });
        }
      }
    }

    const simpleMappings: Array<{
      collection: string;
      group: string;
      filter: Filter<Document>;
      set: Record<string, unknown>;
      note?: string;
    }> = [
      // Pekerjaan & Operasional
      {
        collection: "jobhistories",
        group: "Pekerjaan & Operasional",
        filter: { driverId: oldDiscordId },
        set: { driverId: newDiscordId },
      },
      {
        collection: "activejobs",
        group: "Pekerjaan & Operasional",
        filter: { driverId: oldDiscordId },
        set: { driverId: newDiscordId },
      },
      {
        collection: "specialcontracthistories",
        group: "Pekerjaan & Operasional",
        filter: { driverId: oldDiscordId },
        set: { driverId: newDiscordId },
      },
      {
        collection: "fuelusagehistories",
        group: "Pekerjaan & Operasional",
        filter: { discordId: oldDiscordId },
        set: { discordId: newDiscordId },
      },
      {
        collection: "insuranceclaimhistories",
        group: "Pekerjaan & Operasional",
        filter: { discordId: oldDiscordId },
        set: { discordId: newDiscordId },
      },
      {
        collection: "leavehistories",
        group: "Pekerjaan & Operasional",
        filter: { discordId: oldDiscordId },
        set: { discordId: newDiscordId },
      },
      {
        collection: "leavehistories",
        group: "Pekerjaan & Operasional",
        filter: { userId: oldDiscordId },
        set: { userId: newDiscordId },
      },

      // Order, Voucher, Transaksi & Tiket
      {
        collection: "transactions",
        group: "Order, Voucher & Tiket",
        filter: { discordId: oldDiscordId },
        set: {
          discordId: newDiscordId,
          ...(canonicalUserId ? { userId: canonicalUserId } : {}),
        },
      },
      {
        collection: "fleetorders",
        group: "Order, Voucher & Tiket",
        filter: { discordId: oldDiscordId },
        set: {
          discordId: newDiscordId,
          ...(canonicalUserId ? { userId: canonicalUserId } : {}),
        },
      },
      {
        collection: "fleetorders",
        group: "Staff & Pengaturan",
        filter: { managerId: oldDiscordId },
        set: { managerId: newDiscordId },
      },
      {
        collection: "fleetmaintenanceorders",
        group: "Order, Voucher & Tiket",
        filter: { discordId: oldDiscordId },
        set: {
          discordId: newDiscordId,
          ...(canonicalUserId ? { userRef: canonicalUserId } : {}),
        },
      },
      {
        collection: "fleetmaintenanceorders",
        group: "Staff & Pengaturan",
        filter: { managerId: oldDiscordId },
        set: { managerId: newDiscordId },
      },
      {
        collection: "nismaraplusorders",
        group: "Order, Voucher & Tiket",
        filter: { discordId: oldDiscordId },
        set: {
          discordId: newDiscordId,
          ...(canonicalUserId ? { userId: canonicalUserId } : {}),
        },
      },
      {
        collection: "nismaraplusorders",
        group: "Staff & Pengaturan",
        filter: { managerId: oldDiscordId },
        set: { managerId: newDiscordId },
      },
      {
        collection: "seasonpassorders",
        group: "Season Pass & Quest",
        filter: { discordId: oldDiscordId },
        set: {
          discordId: newDiscordId,
          ...(canonicalUserId ? { userId: canonicalUserId } : {}),
        },
      },
      {
        collection: "seasonpassorders",
        group: "Staff & Pengaturan",
        filter: { processedBy: oldDiscordId },
        set: { processedBy: newDiscordId },
      },
      {
        collection: "seasonpassmerchclaims",
        group: "Staff & Pengaturan",
        filter: { processedBy: oldDiscordId },
        set: { processedBy: newDiscordId },
      },
      {
        collection: "uservouchers",
        group: "Order, Voucher & Tiket",
        filter: { discordId: oldDiscordId },
        set: {
          discordId: newDiscordId,
          ...(canonicalUserId ? { userId: canonicalUserId } : {}),
        },
      },
      {
        collection: "tickets",
        group: "Order, Voucher & Tiket",
        filter: { discordId: oldDiscordId },
        set: {
          discordId: newDiscordId,
          ...(canonicalUserId ? { userId: canonicalUserId.toString() } : {}),
        },
      },
      {
        collection: "tickets",
        group: "Staff & Pengaturan",
        filter: { managerId: oldDiscordId },
        set: { managerId: newDiscordId },
      },
      {
        collection: "penaltytickets",
        group: "Order, Voucher & Tiket",
        filter: { discordId: oldDiscordId },
        set: { discordId: newDiscordId },
      },
      {
        collection: "penaltytickets",
        group: "Order, Voucher & Tiket",
        filter: { userId: oldDiscordId },
        set: { userId: newDiscordId },
      },

      // Onboarding, Intern & Aplikasi
      {
        collection: "haulmp_applications",
        group: "Onboarding & Rekrutmen",
        filter: { discordId: oldDiscordId },
        set: { discordId: newDiscordId },
      },
      {
        collection: "haulmp_applications",
        group: "Staff & Pengaturan",
        filter: { reviewedBy: oldDiscordId },
        set: { reviewedBy: newDiscordId },
      },
      {
        collection: "applications",
        group: "Onboarding & Rekrutmen",
        filter: { userId: oldDiscordId },
        set: { userId: newDiscordId },
      },
      {
        collection: "applications",
        group: "Onboarding & Rekrutmen",
        filter: { discordId: oldDiscordId },
        set: { discordId: newDiscordId },
      },
      {
        collection: "applications",
        group: "Staff & Pengaturan",
        filter: { managerId: oldDiscordId },
        set: { managerId: newDiscordId },
      },
      {
        collection: "registrations",
        group: "Onboarding & Rekrutmen",
        filter: { userId: oldDiscordId },
        set: { userId: newDiscordId },
      },
      {
        collection: "registrations",
        group: "Onboarding & Rekrutmen",
        filter: { discordId: oldDiscordId },
        set: { discordId: newDiscordId },
      },
      {
        collection: "registrations",
        group: "Staff & Pengaturan",
        filter: { managerId: oldDiscordId },
        set: { managerId: newDiscordId },
      },
      {
        collection: "quizattempts",
        group: "Onboarding & Rekrutmen",
        filter: { discordId: oldDiscordId },
        set: { discordId: newDiscordId },
      },
      {
        collection: "internpromotions",
        group: "Onboarding & Rekrutmen",
        filter: { internDiscordId: oldDiscordId },
        set: { internDiscordId: newDiscordId },
      },
      {
        collection: "internpromotions",
        group: "Staff & Pengaturan",
        filter: { managerId: oldDiscordId },
        set: { managerId: newDiscordId },
      },
      {
        collection: "driverevaluations",
        group: "Onboarding & Rekrutmen",
        filter: { driverId: oldDiscordId },
        set: { driverId: newDiscordId },
      },
      {
        collection: "driverevaluations",
        group: "Staff & Pengaturan",
        filter: { openedByManagerId: oldDiscordId },
        set: { openedByManagerId: newDiscordId },
      },
      {
        collection: "driverevaluations",
        group: "Staff & Pengaturan",
        filter: { closedByManagerId: oldDiscordId },
        set: { closedByManagerId: newDiscordId },
      },

      // Galeri & Market
      {
        collection: "gallery_posts",
        group: "Market & Sosial",
        filter: { userId: oldDiscordId },
        set: { userId: newDiscordId },
      },
      {
        collection: "gallery_posts",
        group: "Market & Sosial",
        filter: { discordId: oldDiscordId },
        set: { discordId: newDiscordId },
      },
      {
        collection: "galleryposts",
        group: "Market & Sosial",
        filter: { userId: oldDiscordId },
        set: { userId: newDiscordId },
      },
      {
        collection: "galleryposts",
        group: "Market & Sosial",
        filter: { discordId: oldDiscordId },
        set: { discordId: newDiscordId },
      },
      {
        collection: "gallery_comments",
        group: "Market & Sosial",
        filter: { userId: oldDiscordId },
        set: { userId: newDiscordId },
      },
      {
        collection: "gallery_comments",
        group: "Market & Sosial",
        filter: { discordId: oldDiscordId },
        set: { discordId: newDiscordId },
      },
      {
        collection: "gallery_comments",
        group: "Market & Sosial",
        filter: { replyToUser: oldDiscordId },
        set: { replyToUser: newDiscordId },
      },
      {
        collection: "marketitems",
        group: "Market & Sosial",
        filter: { sellerId: oldDiscordId },
        set: { sellerId: newDiscordId },
      },
      {
        collection: "marketitems",
        group: "Staff & Pengaturan",
        filter: { reviewerId: oldDiscordId },
        set: { reviewerId: newDiscordId },
      },
      {
        collection: "fuelmarketlistings",
        group: "Market & Sosial",
        filter: { sellerDiscordId: oldDiscordId },
        set: {
          sellerDiscordId: newDiscordId,
          ...(canonicalUserId ? { sellerId: canonicalUserId } : {}),
        },
      },
      {
        collection: "fueltransactions",
        group: "Market & Sosial",
        filter: { buyerDiscordId: oldDiscordId },
        set: { buyerDiscordId: newDiscordId },
      },
      {
        collection: "fueltransactions",
        group: "Market & Sosial",
        filter: { sellerDiscordId: oldDiscordId },
        set: { sellerDiscordId: newDiscordId },
      },

      // Event, Achiev, Games, AI & Notifikasi
      {
        collection: "userachievements",
        group: "Event & Minigame",
        filter: { discordId: oldDiscordId },
        set: { discordId: newDiscordId },
      },
      {
        collection: "collectibles",
        group: "Event & Minigame",
        filter: { discordId: oldDiscordId },
        set: { discordId: newDiscordId },
      },
      {
        collection: "lottotickets",
        group: "Event & Minigame",
        filter: { discordId: oldDiscordId },
        set: { discordId: newDiscordId },
      },
      {
        collection: "scratchtickets",
        group: "Event & Minigame",
        filter: { discordId: oldDiscordId },
        set: { discordId: newDiscordId },
      },
      {
        collection: "racingtickets",
        group: "Event & Minigame",
        filter: { discordId: oldDiscordId },
        set: { discordId: newDiscordId },
      },
      {
        collection: "aichathistories",
        group: "Lainnya & Survey",
        filter: { discordId: oldDiscordId },
        set: { discordId: newDiscordId },
      },
      {
        collection: "securityalerts",
        group: "Lainnya & Survey",
        filter: { discordId: oldDiscordId },
        set: { discordId: newDiscordId },
      },
      {
        collection: "notifications",
        group: "Lainnya & Survey",
        filter: { recipient: oldDiscordId },
        set: { recipient: newDiscordId },
      },

      // Staff / Creator references
      {
        collection: "communitygoals",
        group: "Staff & Pengaturan",
        filter: { creatorId: oldDiscordId },
        set: { creatorId: newDiscordId },
      },
      {
        collection: "convoylobby",
        group: "Event & Minigame",
        filter: { roadCaptain: oldDiscordId },
        set: { roadCaptain: newDiscordId },
      },
      {
        collection: "convoylobby",
        group: "Event & Minigame",
        filter: { sweeper: oldDiscordId },
        set: { sweeper: newDiscordId },
      },
      {
        collection: "convoylobby",
        group: "Staff & Pengaturan",
        filter: { setBy: oldDiscordId },
        set: { setBy: newDiscordId },
      },
      {
        collection: "convoylobbies",
        group: "Event & Minigame",
        filter: { roadCaptain: oldDiscordId },
        set: { roadCaptain: newDiscordId },
      },
      {
        collection: "convoylobbies",
        group: "Event & Minigame",
        filter: { sweeper: oldDiscordId },
        set: { sweeper: newDiscordId },
      },
      {
        collection: "convoylobbies",
        group: "Staff & Pengaturan",
        filter: { setBy: oldDiscordId },
        set: { setBy: newDiscordId },
      },
      {
        collection: "contracts",
        group: "Staff & Pengaturan",
        filter: { setBy: oldDiscordId },
        set: { setBy: newDiscordId },
      },
      {
        collection: "contracthistories",
        group: "Staff & Pengaturan",
        filter: { setBy: oldDiscordId },
        set: { setBy: newDiscordId },
      },
      {
        collection: "ncevents",
        group: "Staff & Pengaturan",
        filter: { setBy: oldDiscordId },
        set: { setBy: newDiscordId },
      },
      {
        collection: "nceventhistories",
        group: "Staff & Pengaturan",
        filter: { setBy: oldDiscordId },
        set: { setBy: newDiscordId },
      },
      {
        collection: "coupons",
        group: "Staff & Pengaturan",
        filter: { setBy: oldDiscordId },
        set: { setBy: newDiscordId },
      },
      {
        collection: "giveaways",
        group: "Staff & Pengaturan",
        filter: { createdBy: oldDiscordId },
        set: { createdBy: newDiscordId },
      },
      {
        collection: "surveys",
        group: "Staff & Pengaturan",
        filter: { createdBy: oldDiscordId },
        set: { createdBy: newDiscordId },
      },
      {
        collection: "kb_articles",
        group: "Staff & Pengaturan",
        filter: { authorId: oldDiscordId },
        set: { authorId: newDiscordId },
      },
    ];

    for (const item of simpleMappings) {
      await safeUpdateMany(
        db,
        stats,
        item.group,
        item.collection,
        item.filter,
        { $set: item.set },
        item.note,
      );
    }

    // Re-point secondaryUserId (ObjectId) references yang tertinggal jika target juga punya riwayat
    if (secondaryUserId && canonicalUserId) {
      const refReMaps: Array<[string, string, string, boolean]> = [
        ["transactions", "Order, Voucher & Tiket", "userId", false],
        ["fleetorders", "Order, Voucher & Tiket", "userId", false],
        ["fleetmaintenanceorders", "Order, Voucher & Tiket", "userRef", false],
        ["nismaraplusorders", "Order, Voucher & Tiket", "userId", false],
        ["seasonpassorders", "Season Pass & Quest", "userId", false],
        ["seasonpassmerchclaims", "Season Pass & Quest", "userId", false],
        ["nplusweeklyquestclaims", "Season Pass & Quest", "userId", false],
        ["giveawaytickets", "Event & Minigame", "userId", false],
        ["uservouchers", "Order, Voucher & Tiket", "userId", false],
        ["fuelmarketlistings", "Market & Sosial", "sellerId", false],
        ["tickets", "Order, Voucher & Tiket", "userId", true],
      ];
      for (const [col, grp, field, asString] of refReMaps) {
        const valFrom = asString ? secondaryUserId.toString() : secondaryUserId;
        const valTo = asString ? canonicalUserId.toString() : canonicalUserId;
        await safeUpdateMany(
          db,
          stats,
          grp,
          col,
          { [field]: valFrom },
          { $set: { [field]: valTo } },
          "Re-point canonical User ObjectId",
        );
      }
    }

    // 11. Migrasi Array Footprints (likes, interested, readBy, deletedBy, participants, contributors, coupons, winners)
    const stringArrayTargets: Array<[string, string, string]> = [
      ["Market & Sosial", "gallery_posts", "likes"],
      ["Market & Sosial", "galleryposts", "likes"],
      ["Market & Sosial", "gallery_comments", "likes"],
      ["Event & Minigame", "convoylobby", "interested"],
      ["Event & Minigame", "convoylobbies", "interested"],
      ["Lainnya & Survey", "notifications", "readBy"],
      ["Lainnya & Survey", "notifications", "deletedBy"],
    ];
    for (const [grp, col, field] of stringArrayTargets) {
      await migrateStringArrayField(db, stats, grp, col, field, oldDiscordId, newDiscordId);
    }

    await migrateObjectArrayParticipants(
      db,
      stats,
      "Event & Minigame",
      "convoylobby",
      "partisipan",
      "discordId",
      oldDiscordId,
      newDiscordId,
      [],
    );
    await migrateObjectArrayParticipants(
      db,
      stats,
      "Event & Minigame",
      "convoylobbies",
      "partisipan",
      "discordId",
      oldDiscordId,
      newDiscordId,
      [],
    );
    await migrateObjectArrayParticipants(
      db,
      stats,
      "Event & Minigame",
      "communitygoals",
      "participants",
      "discordId",
      oldDiscordId,
      newDiscordId,
      ["jobs", "distance", "nc", "contribution"],
    );
    await migrateObjectArrayParticipants(
      db,
      stats,
      "Pekerjaan & Operasional",
      "contracts",
      "contributors",
      "driverId",
      oldDiscordId,
      newDiscordId,
      ["jobs", "totalNC", "totalDistance", "totalMass"],
    );
    await migrateObjectArrayParticipants(
      db,
      stats,
      "Pekerjaan & Operasional",
      "contracthistories",
      "contributors",
      "driverId",
      oldDiscordId,
      newDiscordId,
      ["jobs", "totalNC", "totalDistance", "totalMass"],
    );
    await migrateObjectArrayParticipants(
      db,
      stats,
      "Event & Minigame",
      "ncevents",
      "participants",
      "discordId",
      oldDiscordId,
      newDiscordId,
      ["totalEarned"],
    );
    await migrateObjectArrayParticipants(
      db,
      stats,
      "Event & Minigame",
      "nceventhistories",
      "participants",
      "discordId",
      oldDiscordId,
      newDiscordId,
      ["totalEarned"],
    );
    await migrateObjectArrayParticipants(
      db,
      stats,
      "Event & Minigame",
      "coupons",
      "driverClaims",
      "discordId",
      oldDiscordId,
      newDiscordId,
      ["amount"],
      "driverId",
    );
    await migrateObjectArrayParticipants(
      db,
      stats,
      "Event & Minigame",
      "giveaways",
      "winners",
      "discordId",
      oldDiscordId,
      newDiscordId,
      [],
    );

    // 12. Invalidasi Cache Redis (Profil Session & Cache Publik)
    const redisKeysCleared: string[] = [];
    const candidateKeys = [
      ...(oldUserId ? [`session:profile:${oldUserId.toString()}`] : []),
      ...(secondaryUserId ? [`session:profile:${secondaryUserId.toString()}`] : []),
      ...(canonicalUserId ? [`session:profile:${canonicalUserId.toString()}`] : []),
      "nismaraplus:supporters",
      "homepage:alldrivers",
      "homepage:top3drivers_v2",
      "trucky:members_map:35643",
    ];
    for (const k of Array.from(new Set(candidateKeys))) {
      try {
        const deleted = await redis.del(k);
        if (deleted > 0) redisKeysCleared.push(k);
      } catch (e) {
        console.error("Redis del error during migration:", k, e);
      }
    }

    // 13. Sinkronisasi Discord Server Roles (Assign Baru, Cabut Lama)
    const roleSync: MigrationRoleSyncReport = {
      assigned: [],
      revoked: [],
      skipped: [],
      errors: [],
      managerRoleNotice: preview.rolePrediction.managerRoleNotice,
    };

    if (!process.env.DISCORD_BOT_TOKEN) {
      roleSync.skipped.push("DISCORD_BOT_TOKEN tidak aktif di environment; sync role dilewati.");
    } else {
      for (const item of preview.rolePrediction.willRevokeFromOld) {
        const res = await syncDiscordRoleSingle(
          roleCfg.guildId,
          oldDiscordId,
          item.roleId,
          "remove",
        );
        if (res.ok) {
          roleSync.revoked.push({ label: item.label, roleId: item.roleId });
        } else if (res.notFound) {
          roleSync.skipped.push(
            `Cabut role ${item.label} dari akun lama dilewati (akun lama sudah keluar/di-ban dari server).`,
          );
        } else if (res.error) {
          roleSync.errors.push(`Gagal cabut ${item.label} (lama): ${res.error}`);
        }
      }

      if (!preview.targetMember.inGuild) {
        if (preview.rolePrediction.willAssignToNew.length > 0) {
          roleSync.skipped.push(
            `Pemberian role (${preview.rolePrediction.willAssignToNew
              .map((r) => r.label)
              .join(", ")}) ke akun baru dilewati karena user belum join server Discord.`,
          );
        }
      } else {
        for (const item of preview.rolePrediction.willAssignToNew) {
          const res = await syncDiscordRoleSingle(
            roleCfg.guildId,
            newDiscordId,
            item.roleId,
            "add",
          );
          if (res.ok) {
            roleSync.assigned.push({ label: item.label, roleId: item.roleId });
          } else if (res.error) {
            roleSync.errors.push(`Gagal berikan ${item.label} (baru): ${res.error}`);
          }
        }
      }
    }

    // 14. Catat Audit Trail `accountmigrations` & Kirim Notifikasi ke User Baru + Channel Log
    const totalDocumentsTouched = stats.reduce(
      (acc, s) => acc + s.updatedCount + s.deletedConflictsCount,
      0,
    );
    const migrationId = `MIG-${Date.now().toString(36).toUpperCase()}`;

    await db.collection("accountmigrations").insertOne({
      migrationId,
      oldDiscordId,
      newDiscordId,
      canonicalUserId,
      secondaryUserId,
      strategy: conflictStrategy,
      executedByDiscordId,
      executedByName,
      totalDocumentsTouched,
      collections: stats,
      roleSync,
      sourceTruckyId: preview.sourceSummary.truckyId,
      createdAt: now,
    });

    await db.collection("notifications").insertOne({
      recipient: newDiscordId,
      title: "Migrasi Akun Discord Selesai",
      message: `Seluruh data akun Nismara Transport dari Discord ID ${oldDiscordId} telah resmi dimigrasikan ke akun Discord Anda (${totalDocumentsTouched} catatan diperbarui).`,
      type: "success",
      link: "/dashboard",
      readBy: [],
      deletedBy: [],
      createdAt: now,
      updatedAt: now,
    });

    if (roleCfg.channelLog) {
      await sendDiscordMessage(roleCfg.channelLog, "", [
        {
          title: "🔄 Migrasi Akun Discord Selesai",
          color: 0x10b981,
          fields: [
            { name: "ID Migrasi", value: `\`${migrationId}\``, inline: true },
            { name: "Strategi", value: `\`${conflictStrategy.toUpperCase()}\``, inline: true },
            {
              name: "Eksekutor (Owner)",
              value: `<@${executedByDiscordId}> (${executedByName})`,
              inline: true,
            },
            { name: "Akun Lama", value: `<@${oldDiscordId}>\n\`${oldDiscordId}\``, inline: true },
            { name: "Akun Baru", value: `<@${newDiscordId}>\n\`${newDiscordId}\``, inline: true },
            {
              name: "Trucky ID",
              value: preview.sourceSummary.truckyId ? `#${preview.sourceSummary.truckyId}` : "-",
              inline: true,
            },
            {
              name: "Total Record Diproses",
              value: `${totalDocumentsTouched} dokumen/catatan pada ${stats.length} entri koleksi`,
              inline: false,
            },
          ],
          timestamp: now.toISOString(),
        },
      ]);
    }

    return {
      migrationId,
      oldDiscordId,
      newDiscordId,
      strategy: conflictStrategy,
      canonicalUserId: canonicalUserId ? canonicalUserId.toString() : null,
      totalDocumentsTouched,
      collections: stats,
      roleSync,
      redisKeysCleared,
      executedAt: now.toISOString(),
    };
  } finally {
    await redis.del(lockKey).catch(() => {});
  }
}
