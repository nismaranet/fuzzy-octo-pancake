import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import FleetMaintenanceOrder from "@/lib/models/FleetMaintenanceOrder";
import Fleet from "@/lib/models/Fleet";
import Garage from "@/lib/models/Garage";
import "@/lib/models/FleetStore";
import "@/lib/models/User";
import "@/lib/models/FleetBrand";
import "@/lib/models/UserVoucher";
import { getCurrencyDataLogic } from "@/lib/currency";
import { validateVoucher, calculateVoucherDiscount, consumeVoucher } from "@/lib/voucher";
import Transaction from "@/lib/models/Transaction";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { checkRateLimit } from "@/lib/rateLimit";
import { jsonNoCache } from "@/lib/antiCache";
import {
  evaluateFleetMaintenance,
  validateAndPriceMaintenanceSelection,
  FLEET_ADMIN_FEE,
} from "@/lib/fleetMaintenance";

import dbConnect from "@/lib/mongoose";
import { getWebConfig } from "@/lib/webConfig";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return jsonNoCache({ error: "Unauthorized" }, { status: 401 });
    }

    if (!checkRateLimit(session.user.discordId, "fleet-maintenance-create", 3000)) {
      return jsonNoCache(
        { error: "Terlalu banyak permintaan. Mohon tunggu beberapa detik." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { fleetId, voucherId, selections } = body;

    if (!fleetId) {
      return jsonNoCache(
        { error: "fleetId is required" },
        { status: 400 },
      );
    }

    await dbConnect();

    const client = await clientPromise;
    const db = client.db();
    const user = await db
      .collection("users")
      .findOne({ discordId: session.user.discordId });
    if (!user) {
      return jsonNoCache({ error: "User not found" }, { status: 404 });
    }

    const fleet = await Fleet.findById(fleetId).populate("model");
    if (!fleet) {
      return jsonNoCache({ error: "Fleet not found" }, { status: 404 });
    }

    // Verify ownership
    if (String(fleet.owner || fleet.driver) !== String(user._id)) {
      return jsonNoCache(
        { error: "Anda bukan pemilik/driver kendaraan ini" },
        { status: 403 },
      );
    }

    // Check garage status & fetch mechanics in one query
    const userGarage = await Garage.findOne({ discordId: session.user.discordId });
    if (userGarage?.status === "suspended") {
      return jsonNoCache(
        { error: "Akses ditolak! Garasi Anda sedang dibekukan (disita) karena tunggakan biaya operasional. Selesaikan tunggakan terlebih dahulu." },
        { status: 403 }
      );
    }

    // Prevent spam: Check if user already has a pending/waiting/in_service maintenance order for this fleet
    const existingOrder = await FleetMaintenanceOrder.findOne({
      fleetId: fleet._id,
      status: { $in: ["pending", "processing", "waiting", "in_service"] },
    });

    if (existingOrder) {
      return jsonNoCache(
        { error: "Kendaraan ini sudah dalam proses servis atau menunggu." },
        { status: 400 },
      );
    }

    // Server-side evaluation & strict validation (supports mandatory, early >=50%, and bundled selections)
    const evaluation = evaluateFleetMaintenance(fleet, userGarage?.mechanics || null);
    if (!evaluation.hasAnyEligible) {
      return jsonNoCache(
        { error: "Kendaraan masih prima dan belum memenuhi batas minimum servis (50%)." },
        { status: 400 },
      );
    }

    const priced = validateAndPriceMaintenanceSelection(evaluation, selections);
    if (!priced.valid) {
      return jsonNoCache(
        { error: priced.error || "Pilihan komponen servis tidak valid." },
        { status: 400 },
      );
    }

    const isReplace = priced.orderType === "replace";
    const totalComponentCost = priced.totalComponentCost;
    const adminFee = FLEET_ADMIN_FEE;
    const serviceDuration = priced.serviceDuration;

    // Voucher handling (Applies to component costs only, Admin Fee remains 500 NC)
    let appliedVoucher: any = null;
    let voucherDiscount = 0;

    if (voucherId) {
      const vRes = await validateVoucher(
        voucherId,
        session.user.discordId,
        "FLEET_MAINTENANCE",
        totalComponentCost
      );

      if (!vRes.valid) {
        return jsonNoCache({ error: vRes.error }, { status: 400 });
      }

      appliedVoucher = vRes.voucher;
      voucherDiscount = calculateVoucherDiscount(totalComponentCost, appliedVoucher);
    }

    const finalComponentCost = Math.max(0, totalComponentCost - voucherDiscount);
    const totalPrice = finalComponentCost + adminFee;

    // Check balance
    const currencyData = await getCurrencyDataLogic();
    if (currencyData.balance < totalPrice) {
      return jsonNoCache(
        { error: "Saldo NC tidak mencukupi untuk servis ini" },
        { status: 400 },
      );
    }

    // 1. Create Discord Channel
    const channelName = `🔧│Service-${fleet.fleet_number.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`;

    const webConfig = await getWebConfig();
    const CATEGORY_ID = webConfig.discordChannels.serviceFleetCategoryId;
    const MANAGER_ROLE_ID = webConfig.discordRoles.managerRoleId;

    const createChannelRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/channels`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: channelName,
          type: 0,
          parent_id: CATEGORY_ID,
          permission_overwrites: [
            {
              id: GUILD_ID,
              type: 0,
              deny: "1024",
            },
            {
              id: user.discordId,
              type: 1,
              allow: "68608",
            },
            {
              id: MANAGER_ROLE_ID,
              type: 0,
              allow: "68608",
            },
          ],
        }),
      },
    );

    if (!createChannelRes.ok) {
      const err = await createChannelRes.text();
      console.error("Discord API Error (Create Channel):", err);
      return jsonNoCache(
        { error: "Gagal membuat tiket Discord" },
        { status: 500 },
      );
    }

    const channelData = await createChannelRes.json();
    const discordChannelId = channelData.id;

    // 2. Post initial message to the channel
    const partsSummary = priced.items.map((item) => {
      const actionLabel = item.action === "replace" ? "Ganti Baru" : "Servis Rutin";
      const earlyTag = item.isEarly ? " • Lebih Awal" : "";
      return `• **${item.label}** (${actionLabel}${earlyTag}) — ${item.cost.toLocaleString("id-ID")} NC`;
    });

    const hasBothActions =
      priced.items.some((i) => i.action === "replace") &&
      priced.items.some((i) => i.action === "maintenance");
    const requestHeading = hasBothActions
      ? "🔧🔄 Permintaan Servis & Penggantian Komponen"
      : isReplace
        ? "🔄 Permintaan Penggantian Komponen"
        : "🔧 Permintaan Servis Kendaraan";

    await fetch(
      `https://discord.com/api/v10/channels/${discordChannelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: `<@${user.discordId}> permintaan ${hasBothActions ? "servis & penggantian komponen" : isReplace ? "penggantian komponen" : "servis"} kendaraan Anda sedang diproses. Mohon tunggu <@&${MANAGER_ROLE_ID}> untuk mengonfirmasi.`,
          embeds: [
            {
              title: requestHeading,
              color: isReplace ? 0xef4444 : 0xf59e0b,
              fields: [
                {
                  name: "Kendaraan",
                  value: `${fleet.model?.name || fleet.fleet_name} (${fleet.fleet_number})`,
                  inline: false,
                },
                {
                  name: "Rincian Komponen",
                  value: partsSummary.join("\n"),
                  inline: false,
                },
                {
                  name: "Durasi Estimasi",
                  value: `${serviceDuration} Hari`,
                  inline: true,
                },
                {
                  name: "Biaya Komponen",
                  value: `${totalComponentCost.toLocaleString("id-ID")} NC`,
                  inline: true,
                },
                ...(voucherDiscount > 0 && appliedVoucher
                  ? [
                      {
                        name: "🎟️ Diskon Voucher",
                        value: `-${voucherDiscount.toLocaleString("id-ID")} NC (${appliedVoucher.title})`,
                        inline: false,
                      },
                    ]
                  : []),
                {
                  name: "Biaya Admin",
                  value: `${adminFee.toLocaleString("id-ID")} NC`,
                  inline: true,
                },
                {
                  name: "Total Bayar",
                  value: `**${totalPrice.toLocaleString("id-ID")} NC**`,
                  inline: true,
                },
              ],
            },
          ],
        }),
      },
    );

    // 3. Save Order to Database
    const newOrder = await FleetMaintenanceOrder.create({
      userRef: user._id,
      discordId: user.discordId,
      fleetId: fleet._id,
      type: priced.orderType,
      status: "pending",
      managerId: null,
      discordChannelId: discordChannelId,
      components: priced.components,
      replaceComponents: priced.replaceComponents,
      basePrice: totalComponentCost,
      adminFee,
      voucherId: appliedVoucher?._id || null,
      voucherDiscount,
      totalPrice,
      serviceDuration,
    });

    // 4. Consume Voucher if used
    if (appliedVoucher) {
      await consumeVoucher(appliedVoucher._id, newOrder._id, user.discordId);
    }

    // 5. Create Pending Transaction
    await Transaction.create({
      trxId: `TRX-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      discordId: user.discordId,
      userId: user._id,
      title: hasBothActions
        ? "Servis & Penggantian Komponen Fleet"
        : isReplace
          ? "Penggantian Komponen Fleet"
          : "Servis Rutin Fleet",
      category: "maintenance",
      amount: totalPrice,
      currency: "NC",
      status: "pending",
      metadata: {
        orderId: newOrder._id,
        fleetId: fleet._id,
        voucherId: appliedVoucher?._id || null,
        voucherDiscount,
      }
    });

    try {
      revalidatePath("/dashboard/garage/fleet");
      revalidatePath(`/dashboard/garage/fleet/${fleet.id}`);
      revalidatePath("/dashboard/manage/fleet/service");
      revalidatePath("/dashboard/transactions");
    } catch (e) {
      console.error("Failed to revalidate maintenance paths", e);
    }

    return jsonNoCache({ success: true, order: newOrder });
  } catch (error) {
    console.error("Fleet Maintenance Order Error:", error);
    return jsonNoCache(
      { error: "Terjadi kesalahan internal" },
      { status: 500 },
    );
  }
}
