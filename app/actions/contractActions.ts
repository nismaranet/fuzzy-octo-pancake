"use server";

import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteFileFromR2 } from "@/lib/r2";
import { parseWIBDate } from "@/lib/utils";

type ContractCategory = "truck" | "coach";
type CoachMarketFilter = "all" | "company" | "tourist";

function normalizeCities(input: unknown): string[] {
  let raw: string[] = [];
  if (Array.isArray(input)) {
    raw = input.map((v) => String(v || "").trim());
  } else if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        raw = parsed.map((v) => String(v || "").trim());
      } else {
        raw = input.split(",").map((v) => v.trim());
      }
    } catch {
      raw = input.split(",").map((v) => v.trim());
    }
  }
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const city of raw) {
    if (!city) continue;
    const key = city.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      clean.push(city);
    }
  }
  return clean;
}

function getCoachFilterLabel(filter: CoachMarketFilter): string {
  if (filter === "company") return "Bus Company Job (Intercity Transit)";
  if (filter === "tourist") return "Bus Tourist Job (Tourist Charter)";
  return "Semua Layanan Bus (Company & Tourist)";
}

export async function createContractAction(formData: any) {
  const client = await clientPromise;
  const db = client.db();

  const {
    contractName,
    contractCategory: rawCategory,
    companyName,
    targetCities: rawCities,
    coachMarketFilter: rawFilter,
    minPassengers: rawMinPax,
    imageUrl,
    gameId,
    endAt,
    setBy,
    guildId,
    isScheduled,
    startDate,
  } = formData;

  const contractCategory: ContractCategory = rawCategory === "coach" ? "coach" : "truck";
  const isCoach = contractCategory === "coach";
  const targetCities = isCoach ? normalizeCities(rawCities) : [];
  const coachMarketFilter: CoachMarketFilter =
    rawFilter === "company" || rawFilter === "tourist" ? rawFilter : "all";
  const minPassengers = isCoach ? Math.max(0, Math.floor(Number(rawMinPax || 0))) : 0;
  const finalCompanyName = isCoach
    ? targetCities.join(", ")
    : String(companyName || "").trim();

  if (!String(contractName || "").trim()) {
    throw new Error("Nama kontrak wajib diisi.");
  }
  if (isCoach && targetCities.length === 0) {
    throw new Error("Pilih minimal 1 kota target untuk Special Contract Coaches.");
  }
  if (!isCoach && !finalCompanyName) {
    throw new Error("Nama perusahaan klien wajib diisi untuk Special Contract Truck.");
  }

  const isSched = Boolean(isScheduled);
  const startDt = isSched && startDate ? parseWIBDate(startDate) : new Date();
  const endDt = parseWIBDate(endAt, true);
  const now = new Date();

  if (endDt <= startDt) {
    throw new Error("Deadline kontrak harus lebih lama daripada waktu mulai!");
  }

  const isCurrentlyActive = !isSched || startDt <= now;
  const isTrulyScheduled = isSched && startDt > now;

  try {
    await db.collection("contracts").insertOne({
      guildId,
      contractName: String(contractName).trim(),
      contractCategory,
      companyName: finalCompanyName,
      targetCities,
      coachMarketFilter,
      minPassengers,
      imageUrl,
      gameId: String(gameId), // "1" untuk ETS2, "2" untuk ATS
      completedContracts: 0,
      totalNCEarned: 0,
      totalDistance: 0,
      totalMass: 0,
      totalPassengers: 0,
      setBy, // Discord ID Manager
      setAt: new Date(),
      startDate: startDt,
      endAt: endDt,
      isActive: isCurrentlyActive,
      isScheduled: isTrulyScheduled,
      contributors: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      throw new Error(
        `Sudah ada kontrak aktif untuk ${gameId === "2" ? "ATS" : "ETS2"} kategori ${isCoach ? "Coaches" : "Truck"}. Tutup kontrak aktif tersebut dulu atau jadwalkan untuk waktu mendatang.`
      );
    }
    throw err;
  }

  // Integrasi Discord (Notification & Scheduled Event)
  const { getWebConfig } = await import("@/lib/webConfig");
  const webConfig = await getWebConfig();
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = webConfig.discordChannels.generalDriverChannelId;
  const driverDiscordRole = webConfig.discordRoles.driverRoleId;
  const internDiscordRole = webConfig.discordRoles.internRoleId;

  if (botToken && guildId) {
    const slugify = (text: string) => text.toLowerCase().replace(/\s+/g, "-");
    const contractUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/special-contracts/${slugify(contractName)}`;
    const targetCitiesLabel = targetCities.join(", ");
    const coachFilterText = getCoachFilterLabel(coachMarketFilter);

    // 1. Kirim Pesan Notifikasi ke Channel Driver
    if (channelId) {
      try {
        const announcementContent = isTrulyScheduled
          ? `📅 **SPECIAL CONTRACT ${isCoach ? "COACHES " : ""}SCHEDULED** 📅\n-# <@&${driverDiscordRole}> <@&${internDiscordRole}>`
          : `${isCoach ? "🚌" : "🚨"} **NEW SPECIAL CONTRACT ${isCoach ? "COACHES " : ""}DEPLOYED** ${isCoach ? "🚌" : "🚨"}\n-# <@&${driverDiscordRole}> <@&${internDiscordRole}>`;

        const descMessage = isCoach
          ? isTrulyScheduled
            ? `Nismara Transport menjadwalkan Special Contract **Coaches** dengan target kota **${targetCitiesLabel}** (${coachFilterText}). Kontrak mulai pada <t:${Math.floor(startDt.getTime() / 1000)}:F> (<t:${Math.floor(startDt.getTime() / 1000)}:R>).`
            : `Special Contract **Coaches** baru telah dibuka! Ambil perjalanan bus dari, menuju, atau singgah di **${targetCitiesLabel}** (${coachFilterText}) untuk mendapatkan bonus 2x NC.`
          : isTrulyScheduled
            ? `Nismara Transport telah menjadwalkan special contract baru dari **${finalCompanyName}**! Kontrak akan resmi dimulai pada <t:${Math.floor(startDt.getTime() / 1000)}:F> (<t:${Math.floor(startDt.getTime() / 1000)}:R>). Bersiaplah!`
            : `Nismara Transport telah mendapatkan special contract dari **${finalCompanyName}**! Ayo segera ambil pekerjaan dari atau menuju ke ${finalCompanyName}. Jangan sampai terlambat!`;

        const embedFields: Array<{ name: string; value: string; inline?: boolean }> = [
          {
            name: "Kategori",
            value: isCoach ? "Coaches (Bus)" : "Truck (Logistik)",
            inline: true,
          },
          {
            name: "Target Game",
            value:
              gameId === "1"
                ? "Euro Truck Simulator 2"
                : "American Truck Simulator",
            inline: true,
          },
          {
            name: isTrulyScheduled ? "Waktu Mulai" : "Deadline",
            value: isTrulyScheduled
              ? `<t:${Math.floor(startDt.getTime() / 1000)}:R>`
              : `<t:${Math.floor(endDt.getTime() / 1000)}:R>`,
            inline: true,
          },
        ];

        if (isCoach) {
          embedFields.push({
            name: "Kota Target (Asal / Tujuan / Transit)",
            value: targetCitiesLabel,
            inline: false,
          });
          embedFields.push({
            name: "Layanan Bus",
            value: coachFilterText,
            inline: true,
          });
          if (minPassengers > 0) {
            embedFields.push({
              name: "Minimal Penumpang",
              value: `${minPassengers} pax`,
              inline: true,
            });
          }
        }

        await fetch(
          `https://discord.com/api/v10/channels/${channelId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content: announcementContent,
              embeds: [
                {
                  title: isTrulyScheduled ? `[SCHEDULED] ${contractName}` : `${contractName}`,
                  description: descMessage,
                  url: contractUrl,
                  color: isCoach ? 1096065 : gameId === "1" ? 3447003 : 15844367,
                  image: imageUrl ? { url: imageUrl } : undefined,
                  fields: embedFields,
                  footer: {
                    text: isCoach
                      ? "Nismara Transport - Special Contract Coaches"
                      : "Nismara Transport - Special Contract",
                  },
                },
              ],
              components: [
                {
                  type: 1,
                  components: [
                    {
                      type: 2,
                      style: 5,
                      label: "Lihat Detail Kontrak",
                      url: contractUrl,
                    },
                  ],
                },
              ],
            }),
          },
        );
      } catch (err) {
        console.error("Gagal mengirim notifikasi discord:", err);
      }
    }

    // 2. Buat Scheduled Event di Guild
    try {
      let base64Image = undefined;
      if (imageUrl) {
        try {
          const imgRes = await fetch(imageUrl);
          const arrayBuffer = await imgRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64 = buffer.toString("base64");
          base64Image = `data:image/webp;base64,${base64}`;
        } catch (e) {
          console.error(
            "Gagal mengonversi image ke base64 untuk Discord Event",
            e,
          );
        }
      }

      const eventStartTime = isTrulyScheduled
        ? startDt
        : new Date(Date.now() + 60000);

      if (endDt > eventStartTime) {
        const locationLabel = isCoach
          ? `${targetCitiesLabel} - ${gameId === "1" ? "ETS2" : "ATS"} Coaches`.slice(0, 100)
          : `${finalCompanyName} - ${gameId === "1" ? "ETS2" : "ATS"}`.slice(0, 100);

        const eventDescription = isCoach
          ? `Kontrak khusus Coaches (${coachFilterText}) untuk kota ${targetCitiesLabel}. Info lebih lanjut: ${contractUrl}`
          : `Kontrak logistik khusus dari ${finalCompanyName}. Info lebih lanjut: ${contractUrl}`;

        await fetch(
          `https://discord.com/api/v10/guilds/${guildId}/scheduled-events`,
          {
            method: "POST",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: contractName,
              privacy_level: 2, // GUILD_ONLY
              scheduled_start_time: eventStartTime.toISOString(),
              scheduled_end_time: endDt.toISOString(),
              entity_type: 3, // EXTERNAL
              entity_metadata: {
                location: locationLabel,
              },
              description: eventDescription,
              image: base64Image,
            }),
          },
        );
      }
    } catch (err) {
      console.error("Gagal membuat Discord Event:", err);
    }
  }

  revalidatePath("/dashboard/manage/events/contracts");
  revalidatePath("/special-contracts");
  revalidatePath("/calendar");
}

export async function updateContractAction(
  contractId: string,
  formData: FormData,
) {
  const client = await clientPromise;
  const db = client.db();

  const rawData = Object.fromEntries(formData.entries());

  try {
    const existingContract = await db
      .collection("contracts")
      .findOne({ _id: new ObjectId(contractId) });

    const contractCategory: ContractCategory =
      String(rawData.contractCategory || existingContract?.contractCategory || "truck") === "coach"
        ? "coach"
        : "truck";
    const isCoach = contractCategory === "coach";
    const targetCities = isCoach ? normalizeCities(rawData.targetCities) : [];
    const coachMarketFilter: CoachMarketFilter =
      rawData.coachMarketFilter === "company" || rawData.coachMarketFilter === "tourist"
        ? rawData.coachMarketFilter
        : "all";
    const minPassengers = isCoach ? Math.max(0, Math.floor(Number(rawData.minPassengers || 0))) : 0;
    const finalCompanyName = isCoach
      ? targetCities.join(", ")
      : String(rawData.companyName || "").trim();

    if (isCoach && targetCities.length === 0) {
      throw new Error("Pilih minimal 1 kota target untuk Special Contract Coaches.");
    }
    if (!isCoach && !finalCompanyName) {
      throw new Error("Nama perusahaan klien wajib diisi.");
    }

    const isSched = String(rawData.isScheduled) === "true";
    const startDt = isSched && rawData.startDate
      ? parseWIBDate(rawData.startDate as string)
      : (existingContract?.startDate ? new Date(existingContract.startDate) : new Date());
    const endDt = parseWIBDate(rawData.endAt as string, true);
    const now = new Date();

    if (endDt <= startDt) {
      throw new Error("Deadline kontrak harus lebih lama daripada waktu mulai!");
    }

    const isCurrentlyActive = !isSched || startDt <= now;
    const isTrulyScheduled = isSched && startDt > now;

    await db.collection("contracts").updateOne(
      { _id: new ObjectId(contractId) },
      {
        $set: {
          contractName: String(rawData.contractName || "").trim(),
          contractCategory,
          companyName: finalCompanyName,
          targetCities,
          coachMarketFilter,
          minPassengers,
          imageUrl: rawData.imageUrl || null,
          gameId: String(rawData.gameId),
          isActive: isCurrentlyActive,
          isScheduled: isTrulyScheduled,
          startDate: startDt,
          endAt: endDt,
          updatedAt: new Date(),
        },
      },
    );

    if (
      existingContract &&
      rawData.imageUrl &&
      existingContract.imageUrl !== rawData.imageUrl
    ) {
      await deleteFileFromR2(existingContract.imageUrl);
    }
  } catch (error: any) {
    console.error("Gagal update kontrak:", error);
    if (error?.code === 11000) {
      throw new Error(
        "Sudah ada kontrak aktif lain dengan game dan kategori yang sama."
      );
    }
    throw new Error(error?.message || "Gagal memperbarui data kontrak");
  }

  revalidatePath("/dashboard/manage/events/contracts");
  revalidatePath("/special-contracts");
  revalidatePath("/calendar");
  redirect("/dashboard/manage/events/contracts");
}

export async function closeContractAction(contractId: string) {
  const client = await clientPromise;
  const db = client.db();

  try {
    await db.collection("contracts").updateOne(
      { _id: new ObjectId(contractId) },
      {
        $set: {
          isActive: false,
          isScheduled: false,
          endAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );

    revalidatePath("/dashboard/manage/events/contracts");
    revalidatePath("/special-contracts");
    return { success: true };
  } catch (error: any) {
    console.error("Gagal menutup kontrak:", error);
    return { success: false, error: error.message || "Gagal menutup kontrak" };
  }
}

export async function deleteContractAction(contractId: string) {
  const client = await clientPromise;
  const db = client.db();

  try {
    const existing = await db
      .collection("contracts")
      .findOne({ _id: new ObjectId(contractId) });

    if (existing?.imageUrl) {
      await deleteFileFromR2(existing.imageUrl);
    }

    await db
      .collection("contracts")
      .deleteOne({ _id: new ObjectId(contractId) });

    revalidatePath("/dashboard/manage/events/contracts");
    revalidatePath("/special-contracts");
    return { success: true };
  } catch (error: any) {
    console.error("Gagal menghapus kontrak:", error);
    return { success: false, error: error.message || "Gagal menghapus kontrak" };
  }
}
