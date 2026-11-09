import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export const dynamic = "force-dynamic";

function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  const customHeader = req.headers.get("x-tracker-token");
  if (customHeader) {
    return customHeader.trim();
  }
  return null;
}

async function handleTrackerAuth(req: Request, bodyData?: any) {
  try {
    const token = extractToken(req) || bodyData?.token?.trim();
    if (!token || token.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_TOKEN_FORMAT",
          message: "Tracker token tidak ditemukan atau format tidak valid.",
        },
        { status: 401 }
      );
    }

    const client = await clientPromise;
    const db = client.db();
    const NISMARA_GUILD_ID = "863959415702028318";

    // Cari driver berdasarkan trackerToken di collection users
    const user = await db.collection("users").findOne({ trackerToken: token });
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "TOKEN_NOT_FOUND",
          message: "Token tidak valid atau sudah di-reset. Silakan periksa Dashboard Settings.",
        },
        { status: 401 }
      );
    }

    if (!user.isDriver) {
      return NextResponse.json(
        {
          success: false,
          error: "NOT_A_DRIVER",
          message: "Akun ini belum terdaftar sebagai Driver aktif Nismara Transport.",
        },
        { status: 403 }
      );
    }

    if (!user.test_participation) {
      return NextResponse.json(
        {
          success: false,
          error: "NOT_A_TESTER",
          message: "Akun ini belum memiliki akses uji coba (test_participation) Nismara Tracker.",
        },
        { status: 403 }
      );
    }

    // Persiapan masa depan: Validasi Steam ID (opsional, jika header/body mengirimkan steamId dan mode strict diaktifkan)
    const clientSteamId = req.headers.get("x-steam-id") || bodyData?.steamId || null;
    const pluginVersion = req.headers.get("x-plugin-version") || bodyData?.pluginVersion || "1.0.0";
    const activeGame = req.headers.get("x-game-id") || bodyData?.gameId || null;
    const steamMismatch =
      Boolean(clientSteamId && user.steamId && String(clientSteamId) !== String(user.steamId));

    // Ambil saldo NC dan Points aktual dari collection currencies & points berdasarkan userId (discordId) dan guildId 863959415702028318
    const currencyAndPointsFilter = {
      userId: String(user.discordId),
      guildId: NISMARA_GUILD_ID,
    };

    const [currencyDoc, pointsDoc, garageDoc, userFleets] = await Promise.all([
      db.collection("currencies").findOne(currencyAndPointsFilter),
      db.collection("points").findOne(currencyAndPointsFilter),
      db.collection("garages").findOne({
        $or: [
          { discordId: String(user.discordId) },
          { userId: user._id },
          { userId: user._id.toString() },
        ],
      }),
      db
        .collection("fleets")
        .aggregate([
          {
            $match: {
              $or: [
                { driver: user._id },
                { owner: user._id },
                { driver: user._id.toString() },
                { owner: user._id.toString() },
              ],
            },
          },
          {
            $addFields: {
              modelObjId: {
                $convert: {
                  input: "$model",
                  to: "objectId",
                  onError: "$model",
                  onNull: "$model",
                },
              },
            },
          },
          {
            $lookup: {
              from: "fleetstores",
              localField: "modelObjId",
              foreignField: "_id",
              as: "modelInfo",
            },
          },
          { $unwind: { path: "$modelInfo", preserveNullAndEmptyArrays: true } },
          {
            $addFields: {
              brandObjId: {
                $convert: {
                  input: "$modelInfo.brand",
                  to: "objectId",
                  onError: "$modelInfo.brand",
                  onNull: "$modelInfo.brand",
                },
              },
            },
          },
          {
            $lookup: {
              from: "fleetbrands",
              localField: "brandObjId",
              foreignField: "_id",
              as: "brandInfo",
            },
          },
          { $unwind: { path: "$brandInfo", preserveNullAndEmptyArrays: true } },
        ])
        .toArray(),
    ]);

    // Update timestamp sinkronisasi tracker
    const now = new Date();
    const updateFields: Record<string, any> = {
      trackerLastSync: now,
      trackerVersion: pluginVersion,
      lastSeen: now,
    };
    if (activeGame) {
      updateFields.trackerLastGame = activeGame;
    }

    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: updateFields }
    );

    const actualNcValue =
      typeof currencyDoc?.totalNC === "number" ? currencyDoc.totalNC : 0;

    const driverPoints =
      typeof pointsDoc?.totalPoints === "number" ? pointsDoc.totalPoints : 0;

    return NextResponse.json({
      success: true,
      serverTime: now.toISOString(),
      steamVerification: {
        clientSteamId,
        registeredSteamId: user.steamId || null,
        mismatch: steamMismatch,
      },
      driver: {
        id: user._id.toString(),
        name: user.name || "Driver",
        email: user.email || "",
        image: user.image || "",
        backgroundUrl: user.backgroundUrl || "",
        bannerUrl: user.bannerUrl || "",
        discordId: user.discordId || "",
        truckyId: user.truckyId ? Number(user.truckyId) : 0,
        steamId: user.steamId ? String(user.steamId) : "",
        truckersmpId: user.truckersmpId ? String(user.truckersmpId) : "",
        level: Number(user.level || 1),
        xp: Number(user.xp || 0),
        nc: Number(actualNcValue),
        totalNc: Number(actualNcValue),
        points: Number(driverPoints),
        joinedConvoy: Number(user.joinedConvoy || 0),
        isDriver: Boolean(user.isDriver),
        isOnLeave: Boolean(user.isOnLeave),
        isBooster: Boolean(user.isBooster),
        isGuildMember: Boolean(user.isGuildMember),
        isTmpDriver: Boolean(user.isTmpDriver),
        isHaulmpDriver: Boolean(user.isHaulmpDriver),
        isBestEmployeeETS2: Boolean(user.isBestEmployeeETS2),
        isBestEmployeeATS: Boolean(user.isBestEmployeeATS),
        discordRole: user.discordRole || "driver",
        truckyRank: user.truckyRank || "Driver",
        truckyRankColor: user.truckyRankColor || "#ffffff",
        truckyRole: user.truckyRole || "Driver",
        truckyRoleColor: user.truckyRoleColor || "#ffffff",
        insurance: {
          status: Boolean(user.insurance?.status),
          rating: Number(user.insurance?.rating ?? 0),
          startedAt: user.insurance?.startedAt
            ? new Date(user.insurance.startedAt).toISOString()
            : "",
          expiredAt: user.insurance?.expiredAt
            ? new Date(user.insurance.expiredAt).toISOString()
            : "",
        },
        nismaraplus: {
          status: Boolean(user.nismaraplus?.status),
          startedAt: user.nismaraplus?.startedAt
            ? new Date(user.nismaraplus.startedAt).toISOString()
            : "",
          expiredAt: user.nismaraplus?.expiredAt
            ? new Date(user.nismaraplus.expiredAt).toISOString()
            : "",
        },
        ncBoost: {
          active: Boolean(user.ncBoost?.active),
          multiplier: Number(user.ncBoost?.multiplier ?? 0),
          voucherTitle: user.ncBoost?.voucherTitle || "",
          voucherCode: user.ncBoost?.voucherCode || "",
          expiredAt: user.ncBoost?.expiredAt
            ? new Date(user.ncBoost.expiredAt).toISOString()
            : "",
        },
        topManager: {
          status: Boolean(user.topManager?.status),
          month: user.topManager?.month || "",
          expiredAt: user.topManager?.expiredAt
            ? new Date(user.topManager.expiredAt).toISOString()
            : "",
        },
        galleryBan: {
          status: Boolean(user.galleryBan?.status),
        },
        garage: garageDoc
          ? {
              status: String(garageDoc.status || "operational"),
              fleetSlot: Number(garageDoc.fleetSlot ?? 1),
              fleetSlotUsed: Number(userFleets?.length ?? garageDoc.fleetSlotUsed ?? 0),
              fleetSlotLevel: Number(garageDoc.fleetSlotLevel ?? 1),
              fuelStock: Number(garageDoc.fuelStock ?? 0),
              fuelCapacity: Number(garageDoc.fuelCapacity ?? 2000),
              fuelTankLevel: Number(garageDoc.fuelTankLevel ?? 1),
              safeboxStock: Number(garageDoc.safeboxStock ?? 0),
              safeboxLevel: Number(garageDoc.safeboxLevel ?? 1),
              operationalCost: Number(garageDoc.operational_cost ?? 0),
            }
          : null,
        fleets: (userFleets || []).map((f: any) => ({
          id: String(f.id || f._id),
          mongoId: f._id ? f._id.toString() : "",
          fleetNumber: String(f.fleet_number || ""),
          fleetName: String(f.fleet_name || ""),
          customName: String(f.customName || ""),
          customImage: String(f.customImage || ""),
          gameId: String(f.game_id ?? f.modelInfo?.game_id ?? "1"),
          odometer: Number(f.odometer ?? 0),
          wheels: String(f.wheels || "4x2"),
          status: String(f.status || "active"),
          hasInsurance: Boolean(f.has_insurance),
          maintenanceNeeded: Boolean(f.maintenance_needed),
          isAssignedDriver:
            Boolean(f.driver) && String(f.driver) === user._id.toString(),
          inGameId: String(f.modelInfo?.in_game_id || ""),
          modelName: String(f.modelInfo?.name || ""),
          modelType: String(f.modelInfo?.type || "truck"),
          photoUrl: String(f.customImage || f.modelInfo?.photo_url || ""),
          brandName: String(f.brandInfo?.name || ""),
          wear: {
            unfixEngine: Number(f.wear?.unfix_engine ?? 0),
            unfixTransmission: Number(f.wear?.unfix_transmission ?? 0),
            unfixBrakes: Number(f.wear?.unfix_brakes ?? 0),
            unfixTires: Number(f.wear?.unfix_tires ?? 0),
          },
          maintenance: {
            engine: Number(f.maintenance?.engine ?? 50000),
            tires: Number(f.maintenance?.tires ?? 20000),
            transmission: Number(f.maintenance?.transmission ?? 70000),
            brakes: Number(f.maintenance?.brakes ?? 35000),
          },
        })),
      },
    });
  } catch (error: any) {
    console.error("[Tracker API Auth Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Terjadi kesalahan internal pada server Nismara Logistics.",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handleTrackerAuth(req);
}

export async function POST(req: Request) {
  let bodyData: any = {};
  try {
    bodyData = await req.json();
  } catch {
    bodyData = {};
  }
  return handleTrackerAuth(req, bodyData);
}

