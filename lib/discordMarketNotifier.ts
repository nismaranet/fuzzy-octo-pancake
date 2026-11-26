import { getWebConfig } from "@/lib/webConfig";
import type { ICommunityMarketBuyOrderCriteria } from "@/lib/models/CommunityMarketBuyOrder";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const PROD_SITE_URL = "https://transport.nismara.web.id";

function getPublicSiteUrl(): string {
  const candidate = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    PROD_SITE_URL
  )
    .trim()
    .replace(/\/+$/, "");

  // Discord Link Button menolak http://localhost atau URL non-HTTP(S)
  if (!/^https:\/\//i.test(candidate) || /localhost|127\.0\.0\.1/i.test(candidate)) {
    return PROD_SITE_URL;
  }
  return candidate;
}

function getBotToken(): string {
  return (process.env.DISCORD_BOT_TOKEN || "").trim();
}

function formatNC(amount: number): string {
  const num = Number(amount) || 0;
  return `${num.toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} NC`;
}

function formatNCFlat(amount: number): string {
  const num = Number(amount) || 0;
  return `${Math.round(num).toLocaleString("id-ID")} NC`;
}

function formatLiters(amount: number): string {
  return `${Math.floor(Number(amount) || 0).toLocaleString("id-ID")} L`;
}

function formatWIB(dateInput?: Date | string | null): string {
  if (!dateInput) return "-";
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "-";
  return (
    d.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB"
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  PENALTY_TICKET: "Tiket Hapus Penalti",
  FLEET_MAINTENANCE: "Voucher Servis Armada",
  FLEET_BUY: "Voucher Beli Armada",
  MARKET_MOD: "Voucher Mod Market",
  GARAGE_UPGRADE: "Voucher Upgrade Garasi",
  GARAGE_RENT: "Voucher Sewa Garasi",
  NC_BOOSTER: "Voucher NC Booster",
};

function formatCategoryLabel(category?: string | null): string {
  if (!category) return "Lainnya";
  return CATEGORY_LABELS[category] || category.replace(/_/g, " ");
}

function buildLinkButtonRow(label: string, url: string) {
  return [
    {
      type: 1, // Action Row
      components: [
        {
          type: 2, // Button
          style: 5, // Link Button
          label,
          url,
        },
      ],
    },
  ];
}

async function resolveMarketChannelConfig(): Promise<{
  channelId: string;
  pingRoleId: string;
} | null> {
  const token = getBotToken();
  if (!token) return null;

  try {
    const cfg = await getWebConfig();
    const channelId = cfg.discordChannels?.marketChannelId?.trim() || "";
    if (!channelId) return null;
    const pingRoleId = cfg.discordRoles?.marketPingRoleId?.trim() || "";
    return { channelId, pingRoleId };
  } catch (err) {
    console.error("[DiscordMarketNotifier] Failed reading WebConfig:", err);
    return null;
  }
}

async function postChannelMessage(
  channelId: string,
  payload: {
    content?: string;
    embeds: any[];
    components?: any[];
    pingRoleId?: string;
  }
): Promise<{ channelId: string; messageId: string } | null> {
  const token = getBotToken();
  if (!token || !channelId) return null;

  try {
    const allowedMentions: any = { parse: [] as string[] };
    if (payload.pingRoleId) {
      allowedMentions.roles = [payload.pingRoleId];
    }

    const res = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: payload.content || "",
        embeds: payload.embeds,
        components: payload.components ?? [],
        allowed_mentions: allowedMentions,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(
        `[DiscordMarketNotifier] POST message failed (${res.status}):`,
        errText.slice(0, 400)
      );
      return null;
    }

    const data = await res.json();
    if (!data?.id) return null;
    return { channelId, messageId: String(data.id) };
  } catch (err) {
    console.error("[DiscordMarketNotifier] POST message exception:", err);
    return null;
  }
}

async function editChannelMessage(
  channelId: string,
  messageId: string,
  payload: {
    content?: string;
    embeds: any[];
    components?: any[];
  }
): Promise<boolean> {
  const token = getBotToken();
  if (!token || !channelId || !messageId) return false;

  try {
    const res = await fetch(
      `${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(payload.content !== undefined ? { content: payload.content } : {}),
          embeds: payload.embeds,
          components: payload.components ?? [],
          allowed_mentions: { parse: [] },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(
        `[DiscordMarketNotifier] PATCH message failed (${res.status}):`,
        errText.slice(0, 400)
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[DiscordMarketNotifier] PATCH message exception:", err);
    return false;
  }
}

// =============================================================================
// 1. FUEL MARKET P2P NOTIFIER
// =============================================================================

export interface FuelP2PNotifyPayload {
  sellerDiscordId: string;
  sellerName?: string | null;
  amount: number;
  pricePerLiter: number;
  systemPrice?: number | null;
  status?: "active" | "sold" | "cancelled";
  buyerDiscordId?: string | null;
  buyerName?: string | null;
  isEdited?: boolean;
}

function buildFuelP2PEmbed(data: FuelP2PNotifyPayload) {
  const status = data.status || "active";
  const amount = Math.floor(Number(data.amount) || 0);
  const pricePerLiter = Number(data.pricePerLiter) || 0;
  const baseTotal = amount * pricePerLiter;
  const buyerTotal = Math.ceil(baseTotal * 1.05);

  let systemComparison = "";
  if (data.systemPrice && data.systemPrice > 0 && status === "active") {
    const diffPct = ((pricePerLiter - data.systemPrice) / data.systemPrice) * 100;
    if (diffPct <= -0.5) {
      systemComparison = `🔥 Lebih murah **${Math.abs(diffPct).toFixed(1)}%** dari harga sistem (${formatNC(data.systemPrice)}/L)`;
    } else if (diffPct >= 0.5) {
      systemComparison = `📈 +${diffPct.toFixed(1)}% di atas harga sistem (${formatNC(data.systemPrice)}/L)`;
    } else {
      systemComparison = `⚖️ Setara harga sistem (${formatNC(data.systemPrice)}/L)`;
    }
  }

  const strike = status !== "active";
  const wrap = (text: string) => (strike ? `~~${text}~~` : text);

  const color =
    status === "sold"
      ? 0x10b981 // Emerald (Sold)
      : status === "cancelled"
        ? 0x64748b // Slate (Cancelled)
        : 0xf59e0b; // Amber (Active Fuel P2P)

  const title =
    status === "sold"
      ? "✅ [TERJUAL] Penawaran Solar — Fuel Market P2P"
      : status === "cancelled"
        ? "❌ [DIBATALKAN] Penawaran Solar — Fuel Market P2P"
        : data.isEdited
          ? "⛽ [HARGA DIPERBARUI] Jual Solar — Fuel Market P2P"
          : "⛽ Penawaran Solar Baru — Fuel Market P2P";

  const descriptionLines: string[] = [];
  if (status === "sold") {
    descriptionLines.push(
      `Penawaran solar dari <@${data.sellerDiscordId}> telah **terjual**${
        data.buyerDiscordId ? ` kepada <@${data.buyerDiscordId}>` : ""
      }.`
    );
  } else if (status === "cancelled") {
    descriptionLines.push(
      `Penawaran solar dari <@${data.sellerDiscordId}> telah **ditarik kembali** ke garasi penjual.`
    );
  } else {
    descriptionLines.push(
      `<@${data.sellerDiscordId}> sedang menjual stok BBM di **Fuel Market P2P**!`
    );
    if (systemComparison) {
      descriptionLines.push(systemComparison);
    }
  }

  const fields: any[] = [
    {
      name: "Volume Solar",
      value: wrap(`**${formatLiters(amount)}**`),
      inline: true,
    },
    {
      name: "Harga / Liter",
      value: wrap(`**${formatNC(pricePerLiter)}**`),
      inline: true,
    },
    {
      name: "Estimasi Bayar (+5% Fee)",
      value: wrap(`**${formatNCFlat(buyerTotal)}**`),
      inline: true,
    },
  ];

  const footerText =
    status === "sold"
      ? `Terjual pada ${formatWIB(new Date())} · Nismara Transport Market`
      : status === "cancelled"
        ? `Dibatalkan pada ${formatWIB(new Date())} · Nismara Transport Market`
        : data.isEdited
          ? `Harga diperbarui ${formatWIB(new Date())} · Nismara Transport Market`
          : `Diposting ${formatWIB(new Date())} · Nismara Transport Market`;

  return {
    title,
    description: descriptionLines.join("\n"),
    color,
    fields,
    footer: { text: footerText },
    timestamp: new Date().toISOString(),
  };
}

export async function notifyFuelP2PCreated(
  data: FuelP2PNotifyPayload
): Promise<{ channelId: string; messageId: string } | null> {
  const cfg = await resolveMarketChannelConfig();
  if (!cfg) return null;

  const siteUrl = getPublicSiteUrl();
  const embed = buildFuelP2PEmbed({ ...data, status: "active" });
  const content = cfg.pingRoleId ? `<@&${cfg.pingRoleId}>` : "";

  return postChannelMessage(cfg.channelId, {
    content,
    embeds: [embed],
    components: buildLinkButtonRow("⛽ Buka Fuel Market P2P", `${siteUrl}/fuel-market`),
    pingRoleId: cfg.pingRoleId || undefined,
  });
}

export async function updateFuelP2PMessage(
  channelId: string | null | undefined,
  messageId: string | null | undefined,
  data: FuelP2PNotifyPayload
): Promise<boolean> {
  if (!channelId || !messageId) return false;
  const siteUrl = getPublicSiteUrl();
  const status = data.status || "active";
  const embed = buildFuelP2PEmbed(data);

  return editChannelMessage(channelId, messageId, {
    ...(status !== "active" ? { content: "" } : {}),
    embeds: [embed],
    components:
      status === "active"
        ? buildLinkButtonRow("⛽ Buka Fuel Market P2P", `${siteUrl}/fuel-market`)
        : [],
  });
}

// =============================================================================
// 2. COMMUNITY MARKET — SELL LISTING NOTIFIER
// =============================================================================

export interface CommunityListingNotifyPayload {
  slug: string;
  sellerDiscordId: string;
  sellerName?: string | null;
  itemType: "VOUCHER" | "PENALTY_TICKET";
  title: string;
  category: string;
  quantity: number;
  remainingQuantity: number;
  unitPrice: number;
  isFlashDeal?: boolean;
  itemExpiresAt?: Date | string | null;
  listingExpiresAt?: Date | string | null;
  status?: "active" | "sold" | "cancelled" | "expired";
  buyerDiscordId?: string | null;
}

function buildCommunityListingEmbed(data: CommunityListingNotifyPayload) {
  const status = data.status || "active";
  const strike = status !== "active";
  const wrap = (text: string) => (strike ? `~~${text}~~` : text);
  const totalValue = data.unitPrice * Math.max(1, data.remainingQuantity || data.quantity);

  const color =
    status === "sold"
      ? 0x10b981
      : status === "cancelled" || status === "expired"
        ? 0x64748b
        : data.isFlashDeal
          ? 0xf97316 // Flash Deal Orange-Red
          : 0x22c55e; // Active Green

  const title =
    status === "sold"
      ? `✅ [TERJUAL] ${data.title}`
      : status === "cancelled"
        ? `❌ [DIBATALKAN] ${data.title}`
        : status === "expired"
          ? `⏰ [BERAKHIR] ${data.title}`
          : data.isFlashDeal
            ? `⚡ [FLASH DEAL] Dijual: ${data.title}`
            : `🏷️ Dijual: ${data.title}`;

  const descLines: string[] = [];
  if (status === "sold") {
    descLines.push(
      `Listing dari <@${data.sellerDiscordId}> telah **terjual habis**${
        data.buyerDiscordId ? ` (pembeli terakhir: <@${data.buyerDiscordId}>)` : ""
      }.`
    );
  } else if (status === "cancelled") {
    descLines.push(
      `Listing dari <@${data.sellerDiscordId}> telah **dibatalkan** oleh penjual.`
    );
  } else if (status === "expired") {
    descLines.push(
      `Masa tayang listing dari <@${data.sellerDiscordId}> telah **berakhir** dan aset dikembalikan ke inventaris penjual.`
    );
  } else {
    descLines.push(
      `<@${data.sellerDiscordId}> memasang item untuk dijual di **Community Market**!`
    );
    if (data.remainingQuantity < data.quantity) {
      descLines.push(
        `📦 Sebagian sudah terjual — tersisa **${data.remainingQuantity} dari ${data.quantity}** unit.`
      );
    }
  }

  const fields: any[] = [
    {
      name: "Kategori",
      value: formatCategoryLabel(data.category),
      inline: true,
    },
    {
      name: "Harga Satuan",
      value: wrap(`**${formatNCFlat(data.unitPrice)}**`),
      inline: true,
    },
    {
      name: "Stok",
      value: wrap(
        status === "active" && data.quantity > 1
          ? `**${data.remainingQuantity} / ${data.quantity} unit**`
          : `**${data.quantity} unit**`
      ),
      inline: true,
    },
  ];

  if (data.quantity > 1 && status === "active") {
    fields.push({
      name: "Total Nilai Sisa",
      value: `**${formatNCFlat(totalValue)}**`,
      inline: true,
    });
  }

  if (data.itemType === "VOUCHER" && data.itemExpiresAt && status === "active") {
    fields.push({
      name: "Masa Berlaku Voucher",
      value: formatWIB(data.itemExpiresAt),
      inline: true,
    });
  }

  const footerText =
    status === "sold"
      ? `Terjual pada ${formatWIB(new Date())} · Community Market`
      : status === "cancelled"
        ? `Dibatalkan pada ${formatWIB(new Date())} · Community Market`
        : status === "expired"
          ? `Berakhir pada ${formatWIB(new Date())} · Community Market`
          : `Tayang s.d ${formatWIB(data.listingExpiresAt)} · Community Market`;

  return {
    title,
    description: descLines.join("\n"),
    color,
    fields,
    footer: { text: footerText },
    timestamp: new Date().toISOString(),
  };
}

export async function notifyCommunityListingCreated(
  data: CommunityListingNotifyPayload
): Promise<{ channelId: string; messageId: string } | null> {
  const cfg = await resolveMarketChannelConfig();
  if (!cfg) return null;

  const siteUrl = getPublicSiteUrl();
  const embed = buildCommunityListingEmbed({ ...data, status: "active" });
  const content = cfg.pingRoleId ? `<@&${cfg.pingRoleId}>` : "";

  return postChannelMessage(cfg.channelId, {
    content,
    embeds: [embed],
    components: buildLinkButtonRow(
      "🛒 Lihat & Beli Item",
      `${siteUrl}/community-market/${data.slug}`
    ),
    pingRoleId: cfg.pingRoleId || undefined,
  });
}

export async function updateCommunityListingMessage(
  channelId: string | null | undefined,
  messageId: string | null | undefined,
  data: CommunityListingNotifyPayload
): Promise<boolean> {
  if (!channelId || !messageId) return false;
  const siteUrl = getPublicSiteUrl();
  const status = data.status || "active";
  const embed = buildCommunityListingEmbed(data);

  return editChannelMessage(channelId, messageId, {
    ...(status !== "active" ? { content: "" } : {}),
    embeds: [embed],
    components:
      status === "active"
        ? buildLinkButtonRow(
            "🛒 Lihat & Beli Item",
            `${siteUrl}/community-market/${data.slug}`
          )
        : [],
  });
}

// =============================================================================
// 3. COMMUNITY MARKET — BUY ORDER (CARI BARANG) NOTIFIER
// =============================================================================

export interface CommunityBuyOrderNotifyPayload {
  slug: string;
  buyerDiscordId: string;
  buyerName?: string | null;
  itemType: "VOUCHER" | "PENALTY_TICKET";
  title: string;
  criteria?: ICommunityMarketBuyOrderCriteria | null;
  notes?: string | null;
  quantity: number;
  remainingQuantity: number;
  offerPrice: number;
  escrowTotal?: number;
  expiresAt?: Date | string | null;
  status?: "active" | "fulfilled" | "cancelled" | "expired";
  sellerDiscordId?: string | null;
}

function summarizeBuyOrderCriteria(
  itemType: "VOUCHER" | "PENALTY_TICKET",
  criteria?: ICommunityMarketBuyOrderCriteria | null
): string {
  if (itemType === "PENALTY_TICKET") {
    return "Tiket Hapus Penalti (Safebox)";
  }
  const parts: string[] = [];
  if (criteria?.category) {
    parts.push(formatCategoryLabel(criteria.category));
  }
  if (criteria?.minDiscountValue && criteria.minDiscountValue > 0) {
    parts.push(
      criteria.discountType === "fixed"
        ? `Min. potongan ${formatNCFlat(criteria.minDiscountValue)}`
        : `Min. diskon ${criteria.minDiscountValue}%`
    );
  }
  if (criteria?.minDurationHours && criteria.minDurationHours > 0) {
    parts.push(`Min. durasi ${criteria.minDurationHours} jam`);
  }
  if (criteria?.minRemainingDays && criteria.minRemainingDays > 0) {
    parts.push(`Sisa aktif ≥ ${criteria.minRemainingDays} hari`);
  }
  if (criteria?.requireUnlimitedMaxDiscount) {
    parts.push("Tanpa batas maks. diskon");
  }
  return parts.length > 0 ? parts.join(" · ") : "Voucher sesuai kategori";
}

function buildCommunityBuyOrderEmbed(data: CommunityBuyOrderNotifyPayload) {
  const status = data.status || "active";
  const strike = status !== "active";
  const wrap = (text: string) => (strike ? `~~${text}~~` : text);
  const totalBudget = data.offerPrice * Math.max(1, data.quantity);

  const color =
    status === "fulfilled"
      ? 0x10b981
      : status === "cancelled" || status === "expired"
        ? 0x64748b
        : 0x38bdf8; // Sky Blue (Wanted / Buy Order)

  const title =
    status === "fulfilled"
      ? `✅ [TERPENUHI] Buy Order: ${data.title}`
      : status === "cancelled"
        ? `❌ [DIBATALKAN] Buy Order: ${data.title}`
        : status === "expired"
          ? `⏰ [BERAKHIR] Buy Order: ${data.title}`
          : `🔎 Dicari Barang (Buy Order): ${data.title}`;

  const descLines: string[] = [];
  if (status === "fulfilled") {
    descLines.push(
      `Permintaan beli dari <@${data.buyerDiscordId}> telah **terpenuhi seluruhnya**${
        data.sellerDiscordId ? ` oleh <@${data.sellerDiscordId}>` : ""
      }.`
    );
  } else if (status === "cancelled") {
    descLines.push(
      `Buy Order dari <@${data.buyerDiscordId}> telah **dibatalkan** dan dana escrow dikembalikan.`
    );
  } else if (status === "expired") {
    descLines.push(
      `Buy Order dari <@${data.buyerDiscordId}> telah **berakhir** dan sisa escrow dikembalikan.`
    );
  } else {
    descLines.push(
      `<@${data.buyerDiscordId}> sedang **mencari barang** di Community Market! Dana **sudah diamankan di Escrow** (langsung cair ke penjual).`
    );
    if (data.remainingQuantity < data.quantity) {
      descLines.push(
        `📦 Sebagian terpenuhi — masih butuh **${data.remainingQuantity} dari ${data.quantity}** unit lagi.`
      );
    }
  }

  const fields: any[] = [
    {
      name: "Harga Tawaran / Unit",
      value: wrap(`**${formatNCFlat(data.offerPrice)}**`),
      inline: true,
    },
    {
      name: "Jumlah Dicari",
      value: wrap(
        status === "active" && data.quantity > 1
          ? `**Sisa ${data.remainingQuantity} / ${data.quantity} unit**`
          : `**${data.quantity} unit**`
      ),
      inline: true,
    },
    {
      name: "Total Escrow",
      value: wrap(`**${formatNCFlat(data.escrowTotal || totalBudget)}**`),
      inline: true,
    },
    {
      name: "Kriteria Item",
      value: summarizeBuyOrderCriteria(data.itemType, data.criteria),
      inline: false,
    },
  ];

  if (data.notes && data.notes.trim() && status === "active") {
    fields.push({
      name: "Catatan Pembeli",
      value: `> ${data.notes.trim().slice(0, 220)}`,
      inline: false,
    });
  }

  const footerText =
    status === "fulfilled"
      ? `Terpenuhi pada ${formatWIB(new Date())} · Community Market`
      : status === "cancelled"
        ? `Dibatalkan pada ${formatWIB(new Date())} · Community Market`
        : status === "expired"
          ? `Berakhir pada ${formatWIB(new Date())} · Community Market`
          : `Berlaku s.d ${formatWIB(data.expiresAt)} · Community Market`;

  return {
    title,
    description: descLines.join("\n"),
    color,
    fields,
    footer: { text: footerText },
    timestamp: new Date().toISOString(),
  };
}

export async function notifyCommunityBuyOrderCreated(
  data: CommunityBuyOrderNotifyPayload
): Promise<{ channelId: string; messageId: string } | null> {
  const cfg = await resolveMarketChannelConfig();
  if (!cfg) return null;

  const siteUrl = getPublicSiteUrl();
  const embed = buildCommunityBuyOrderEmbed({ ...data, status: "active" });
  const content = cfg.pingRoleId ? `<@&${cfg.pingRoleId}>` : "";

  return postChannelMessage(cfg.channelId, {
    content,
    embeds: [embed],
    components: buildLinkButtonRow(
      "💰 Penuhi Buy Order Ini",
      `${siteUrl}/community-market/${data.slug}`
    ),
    pingRoleId: cfg.pingRoleId || undefined,
  });
}

export async function updateCommunityBuyOrderMessage(
  channelId: string | null | undefined,
  messageId: string | null | undefined,
  data: CommunityBuyOrderNotifyPayload
): Promise<boolean> {
  if (!channelId || !messageId) return false;
  const siteUrl = getPublicSiteUrl();
  const status = data.status || "active";
  const embed = buildCommunityBuyOrderEmbed(data);

  return editChannelMessage(channelId, messageId, {
    ...(status !== "active" ? { content: "" } : {}),
    embeds: [embed],
    components:
      status === "active"
        ? buildLinkButtonRow(
            "💰 Penuhi Buy Order Ini",
            `${siteUrl}/community-market/${data.slug}`
          )
        : [],
  });
}
