import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongoose";
import SeasonPass from "@/lib/models/SeasonPass";
import SeasonPassOrder from "@/lib/models/SeasonPassOrder";
import UserSeasonProgress from "@/lib/models/UserSeasonProgress";
import User from "@/lib/models/User";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const season = await SeasonPass.findOne({ status: "ACTIVE" }).lean();
    if (!season) {
      return NextResponse.json({ error: "Tidak ada musim aktif" }, { status: 404 });
    }

    const pendingOrder = await SeasonPassOrder.findOne({
      discordId: String(session.user.discordId),
      seasonNumber: season.seasonNumber,
      status: "pending",
    }).lean();

    return NextResponse.json({
      success: true,
      pendingOrder: pendingOrder ? JSON.parse(JSON.stringify(pendingOrder)) : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized: Silakan login terlebih dahulu" }, { status: 401 });
    }

    await dbConnect();

    const body = await request.json().catch(() => ({}));
    const { seasonNumber = 1 } = body;

    const season = await SeasonPass.findOne({ seasonNumber });
    if (!season) {
      return NextResponse.json({ error: "Musim tidak ditemukan" }, { status: 404 });
    }

    const user = await User.findOne({ discordId: String(session.user.discordId) });
    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    const progress = await UserSeasonProgress.findOne({
      discordId: String(session.user.discordId),
      seasonNumber,
    });

    if (progress?.isPremium) {
      return NextResponse.json(
        { error: "Anda sudah memiliki Nismara Pass Premium musim ini!" },
        { status: 400 }
      );
    }

    // Cek apakah sudah ada pesanan pending
    const existingOrder = await SeasonPassOrder.findOne({
      discordId: String(session.user.discordId),
      seasonNumber,
      status: "pending",
    });

    if (existingOrder) {
      return NextResponse.json({
        success: true,
        order: existingOrder,
        message: "Anda masih memiliki pesanan Nismara Pass yang sedang menunggu konfirmasi Owner / Developer.",
      });
    }

    const amountIDR = season.premiumPriceIdr || 35000;
    const formattedPrice = `Rp ${amountIDR.toLocaleString("id-ID")},-`;
    const discordId = String(session.user.discordId);
    const username = session.user.name || "driver";
    const guildId = process.env.DISCORD_GUILD_ID;
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const categoryId = process.env.DISCORD_PLUS_CATEGORY_ID;
    const owner1 = process.env.OWNER_DISCORD_ID || "338418945620967434";
    const owner2 = process.env.NISMARA_OWNER_DISCORD_ID || "560419724249530369";

    let createdChannelId: string | undefined = undefined;

    // Discord Integration: Buat Channel Tiket jika konfigurasi Discord ada
    if (botToken && guildId) {
      try {
        const allowPermissions = (1024 + 2048 + 65536).toString();
        const denyPermissions = (1024).toString();

        const permissionOverwrites = [
          { id: guildId, type: 0, allow: "0", deny: denyPermissions },
          { id: discordId, type: 1, allow: allowPermissions, deny: "0" },
        ];

        if (owner1) {
          permissionOverwrites.push({
            id: owner1,
            type: 1,
            allow: allowPermissions,
            deny: "0",
          });
        }

        if (owner2 && owner2 !== owner1) {
          permissionOverwrites.push({
            id: owner2,
            type: 1,
            allow: allowPermissions,
            deny: "0",
          });
        }

        const channelRes = await fetch(
          `https://discord.com/api/v10/guilds/${guildId}/channels`,
          {
            method: "POST",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: `🏆pass-s${seasonNumber}-${username.toLowerCase().replace(/\s+/g, "-")}`,
              type: 0,
              parent_id: categoryId || null,
              topic: `Channel Pembelian Nismara Pass Season ${seasonNumber} (${formattedPrice}) | Driver: ${discordId}`,
              permission_overwrites: permissionOverwrites,
            }),
          }
        );

        if (channelRes.ok) {
          const channelData = await channelRes.json();
          createdChannelId = channelData.id;

          // Kirim Embed Invoice ke channel
          await fetch(
            `https://discord.com/api/v10/channels/${createdChannelId}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bot ${botToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                content: `<@${discordId}> | <@${owner1}> <@${owner2}>`,
                embeds: [
                  {
                    title: `✨ Permintaan Pembelian Nismara Pass Season ${seasonNumber}`,
                    description: `Halo **${username}**, terima kasih telah memilih untuk mendukung operasional Nismara Transport!\n\nSilakan lakukan pembayaran sesuai dengan rincian paket yang Anda pilih di bawah ini:`,
                    color: 16098851, // Amber Gold
                    fields: [
                      {
                        name: "📦 Paket yang Dipilih",
                        value: `**Nismara Pass Premium Season ${seasonNumber}** (90 Hari)`,
                        inline: true,
                      },
                      {
                        name: "💵 Total Tagihan",
                        value: `**${formattedPrice}**\n*(Akses Penuh 30 Level Premium)*`,
                        inline: true,
                      },
                      {
                        name: "🏦 Metode Pembayaran",
                        value: "",
                        inline: false,
                      },
                    ],
                    image: {
                      url: "https://images.nismara.my.id/Nismara_QR.jpg",
                    },
                    footer: {
                      text: "Silahkan lakukan pembayaran dengan QR diatas. Apabila sudah melakukan pembayaran kamu dapat mengirimkan foto/screenshot bukti transfer yang valid lalu silahkan tunggu sampai Nismara Pass anda diaktifkan.",
                    },
                    timestamp: new Date().toISOString(),
                  },
                ],
              }),
            }
          ).catch((e) => console.error("Discord message embed error:", e));
        }
      } catch (discordErr) {
        console.error("Discord channel create error:", discordErr);
      }
    }

    const newOrder = await SeasonPassOrder.create({
      discordId,
      userId: user._id,
      seasonNumber,
      amountIDR,
      channelId: createdChannelId,
      status: "pending",
    });

    return NextResponse.json({
      success: true,
      order: newOrder,
      message: "Pesanan Nismara Pass berhasil dibuat! Silakan selesaikan pembayaran dan tunggu konfirmasi dari Owner / Developer.",
      channelId: createdChannelId,
    });
  } catch (error: any) {
    console.error("Season Pass Order Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal membuat pesanan Nismara Pass" },
      { status: 500 }
    );
  }
}
