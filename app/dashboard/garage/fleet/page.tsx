import React from "react";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { Truck, Plus, History } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import FleetListClient, {
  SerializedFleetItem,
  FleetComponentStatus,
} from "./FleetListClient";

export const metadata = {
  title: "Fleet",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function FleetDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.discordId) {
    redirect("/auth/signin");
  }

  const client = await clientPromise;
  const db = client.db();

  const user = await db
    .collection("users")
    .findOne({ discordId: session.user.discordId });
  if (!user) redirect("/auth/signin");

  // --- AUTO MIGRATION UNTUK KENDARAAN MILIK USER YANG BELUM PUNYA OWNER ---
  await db
    .collection("fleets")
    .updateMany(
      {
        driver: user._id,
        $or: [{ owner: { $exists: false } }, { owner: null }],
      },
      { $set: { owner: user._id } }
    );

  // Get user's fleet
  const userFleet = await db
    .collection("fleets")
    .aggregate([
      { $match: { $or: [{ driver: user._id }, { owner: user._id }] } },
      {
        $lookup: {
          from: "fleetstores",
          localField: "model",
          foreignField: "_id",
          as: "modelInfo",
        },
      },
      { $unwind: { path: "$modelInfo", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "fleetbrands",
          localField: "modelInfo.brand",
          foreignField: "_id",
          as: "brandInfo",
        },
      },
      { $unwind: { path: "$brandInfo", preserveNullAndEmptyArrays: true } },
    ])
    .toArray();

  // Fetch active maintenance orders for all of user's fleets in a single query
  const fleetObjectIds = userFleet.map((f) => f._id);
  const activeOrders =
    fleetObjectIds.length > 0
      ? await db
          .collection("fleetmaintenanceorders")
          .find({
            fleetId: { $in: fleetObjectIds },
            status: { $in: ["pending", "waiting", "in_service"] },
          })
          .toArray()
      : [];

  const activeOrderMap = new Map<string, any>();
  for (const order of activeOrders) {
    activeOrderMap.set(String(order.fleetId), order);
  }

  const serializedFleets: SerializedFleetItem[] = userFleet.map((fleet) => {
    const odometer = Number(fleet.odometer || 0);
    const brandName = fleet.brandInfo?.name || "";
    const modelName = fleet.modelInfo?.name || "Unknown Model";
    const displayName =
      fleet.customName ||
      `${brandName ? `${brandName} ` : ""}${modelName}`.trim();

    // Determine Game (1 = ETS2, 2 = ATS)
    const rawGame = fleet.modelInfo?.game_id ?? fleet.game_id ?? 1;
    const gameStr = String(rawGame).trim().toLowerCase();
    const game: "ETS2" | "ATS" =
      gameStr === "2" || gameStr === "ats" ? "ATS" : "ETS2";

    // Determine Vehicle Type ("truck" | "bus" | "car")
    const rawType = String(fleet.modelInfo?.type || "")
      .trim()
      .toLowerCase();
    let vehicleType: "truck" | "bus" | "car" = "truck";
    if (rawType === "bus" || rawType === "car" || rawType === "truck") {
      vehicleType = rawType;
    } else {
      const nameCheck = `${modelName} ${fleet.fleet_name || ""}`.toLowerCase();
      if (/bus|coach|touring|marcopolo|setra|irizar/i.test(nameCheck)) {
        vehicleType = "bus";
      } else if (/car|scout|skoda/i.test(nameCheck)) {
        vehicleType = "car";
      }
    }

    // Component thresholds & wear calculation (matches /dashboard/garage/fleet/[id]/page.tsx)
    const baseIntervals = fleet.modelInfo?.component_cost_unfix_wear || {
      engine: 45000,
      tires: 20000,
      transmission: 80000,
      brakes: 25000,
    };

    const maintenanceCost = fleet.modelInfo?.component_cost_maintenance || {
      engine: 2000,
      tires: 500,
      transmission: 1500,
      brakes: 800,
    };

    const replaceCost = fleet.modelInfo?.component_cost_unfix_wear || {
      engine: 40000,
      tires: 30000,
      transmission: 60000,
      brakes: 40000,
    };

    const thresholds = {
      engine: Number(fleet.maintenance?.engine || baseIntervals.engine || 45000),
      tires: Number(fleet.maintenance?.tires || baseIntervals.tires || 20000),
      transmission: Number(
        fleet.maintenance?.transmission || baseIntervals.transmission || 80000
      ),
      brakes: Number(fleet.maintenance?.brakes || baseIntervals.brakes || 25000),
    };

    const wear = {
      unfix_engine: Number(fleet.wear?.unfix_engine || 0),
      unfix_tires: Number(fleet.wear?.unfix_tires || 0),
      unfix_transmission: Number(fleet.wear?.unfix_transmission || 0),
      unfix_brakes: Number(fleet.wear?.unfix_brakes || 0),
    };

    const componentDefs: {
      key: "engine" | "tires" | "transmission" | "brakes";
      label: string;
      threshold: number;
      wearVal: number;
      maintCost: number;
      repCost: number;
    }[] = [
      {
        key: "engine",
        label: "Mesin",
        threshold: thresholds.engine,
        wearVal: wear.unfix_engine,
        maintCost: Number(maintenanceCost.engine || 2000),
        repCost: Number(replaceCost.engine || 40000),
      },
      {
        key: "tires",
        label: "Ban",
        threshold: thresholds.tires,
        wearVal: wear.unfix_tires,
        maintCost: Number(maintenanceCost.tires || 500),
        repCost: Number(replaceCost.tires || 30000),
      },
      {
        key: "transmission",
        label: "Transmisi",
        threshold: thresholds.transmission,
        wearVal: wear.unfix_transmission,
        maintCost: Number(maintenanceCost.transmission || 1500),
        repCost: Number(replaceCost.transmission || 60000),
      },
      {
        key: "brakes",
        label: "Rem",
        threshold: thresholds.brakes,
        wearVal: wear.unfix_brakes,
        maintCost: Number(maintenanceCost.brakes || 800),
        repCost: Number(replaceCost.brakes || 40000),
      },
    ];

    const components: FleetComponentStatus[] = componentDefs.map((c) => {
      const needsMaintenance = odometer >= c.threshold;
      const needsReplace = c.wearVal >= 100;
      const kmPct =
        c.threshold > 0
          ? Math.min(100, Math.round((odometer / c.threshold) * 100))
          : 0;
      const wearPct = Math.min(100, Number(c.wearVal.toFixed(1)));

      return {
        key: c.key,
        label: c.label,
        odometer,
        threshold: c.threshold,
        kmPct,
        wearPct,
        needsMaintenance,
        needsReplace,
      };
    });

    const isReplaceNeeded = components.some((c) => c.needsReplace);
    const isMaintenanceNeeded =
      components.some((c) => c.needsMaintenance) ||
      fleet.status === "need_maintenance" ||
      fleet.maintenance_needed === true;

    const activeOrder = activeOrderMap.get(String(fleet._id));
    const isInService = Boolean(activeOrder) || fleet.status === "onservice";

    let serviceState: SerializedFleetItem["serviceState"] = "healthy";
    if (isInService) {
      serviceState = "in_service";
    } else if (isReplaceNeeded) {
      serviceState = "needs_replace";
    } else if (isMaintenanceNeeded) {
      serviceState = "needs_maintenance";
    }

    const adminFee = 500;
    let componentCostSum = 0;
    if (isReplaceNeeded) {
      for (const c of componentDefs) {
        if (c.wearVal >= 100) componentCostSum += c.repCost;
      }
    } else if (isMaintenanceNeeded) {
      for (const c of componentDefs) {
        if (odometer >= c.threshold) componentCostSum += c.maintCost;
      }
    }
    const estimatedServiceCost =
      componentCostSum > 0 ? componentCostSum + adminFee : 0;

    const issuesList = components
      .filter((c) => c.needsReplace || c.needsMaintenance)
      .map((c) => c.label);

    return {
      _id: String(fleet._id),
      id: String(fleet.id),
      displayName,
      customName: fleet.customName || null,
      brandName,
      brandLogo: fleet.brandInfo?.logo_url || null,
      modelName,
      imageUrl: fleet.customImage || fleet.modelInfo?.photo_url || null,
      fleetNumber: String(fleet.fleet_number || "-"),
      odometer,
      wheels: String(fleet.wheels || "4x2"),
      game,
      vehicleType,
      isCurrentlyDriven: String(fleet.driver) === String(user._id),
      rawStatus: String(fleet.status || "active"),
      serviceState,
      activeOrderStatus: activeOrder?.status || null,
      maintenanceEndAt: activeOrder?.maintenanceEndAt
        ? new Date(activeOrder.maintenanceEndAt).toISOString()
        : null,
      estimatedServiceCost,
      issuesList,
      components,
    };
  });

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 pb-10 animate-in fade-in duration-700">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-sky/10 rounded-lg text-accent-sky">
              <Truck size={24} />
            </div>
            <h1 className="text-4xl font-black text-foreground tracking-tighter uppercase">
              Fleet Management
            </h1>
          </div>
          <p className="text-foreground/40 font-bold uppercase text-[10px] tracking-[0.2em] ml-11">
            Nismara Transport Hub • Real-time Asset &amp; Maintenance Tracking
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Link
            href="/dashboard/transactions"
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-card border border-border hover:bg-muted text-sm font-bold uppercase tracking-wider transition-all"
          >
            <History size={16} /> Riwayat Pesanan
          </Link>
          <Link
            href="/dashboard/garage/fleet/buy"
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold uppercase tracking-wider transition-all shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5"
          >
            <Plus size={18} /> Beli Kendaraan Baru
          </Link>
        </div>
      </div>

      {/* MAIN CONTENT */}
      {serializedFleets.length > 0 ? (
        <FleetListClient fleets={serializedFleets} />
      ) : (
        <div className="bg-card/50 border border-border border-dashed rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 border border-primary/20">
            <Truck size={40} className="text-primary" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-widest mb-2">
            Belum Ada Kendaraan
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">
            Anda belum memiliki kendaraan yang ditugaskan. Beli kendaraan baru
            untuk memulai perjalanan logistik Anda bersama Nismara.
          </p>
          <Link
            href="/dashboard/garage/fleet/buy"
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest transition-all shadow-lg hover:shadow-primary/25 hover:-translate-y-1"
          >
            <Plus size={18} /> Beli Sekarang
          </Link>
        </div>
      )}
    </div>
  );
}
