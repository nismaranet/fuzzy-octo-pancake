import clientPromise from "@/lib/mongodb";
import { notFound } from "next/navigation";
import { getCompanyMembersMap } from "@/lib/trucky";
import {
  Truck,
  MapPin,
  Award,
  ShieldCheck,
  Globe,
  Trophy,
  Star,
  Activity,
  Package,
  Coins,
  TriangleAlert,
  Link as LinkIcon,
} from "lucide-react";
import { YoutubeIcon, FacebookIcon } from "@/components/icons/SocialMedia";

export default async function PublicProfilePage(props: {
  params: Promise<{ truckyId: string }>;
}) {
  const { truckyId } = await props.params;
  const client = await clientPromise;
  const db = client.db();
  const GUILD_ID = "863959415702028318";

  // 1. Cari user di MongoDB
  const user = await db.collection("users").findOne({
    $or: [{ truckyId: truckyId }, { truckyId: Number(truckyId) }],
  });

  if (!user) {
    notFound();
  }

  const driverLink = await db.collection("driverlinks").findOne({
    $or: [{ truckyId: truckyId }, { truckyId: Number(truckyId) }],
  });

  if (!driverLink) {
    notFound();
  }

  const userDiscordId = driverLink?.userId;
  const currencies = await db.collection("currencies").findOne({
    userId: userDiscordId,
    guildId: GUILD_ID,
  });

  if (!currencies) {
    notFound();
  }

  const points = await db.collection("points").findOne({
    userId: userDiscordId,
    guildId: GUILD_ID,
  });

  if (!points) {
    notFound();
  }

  // 2. Ambil Data Lengkap dari Company Members Map
  // ID Company Nismara: 35643
  const membersMap = await getCompanyMembersMap(35643);
  const member = membersMap[Number(truckyId)];

  if (!member) {
    // Jika tidak ditemukan di map company, tampilkan not found atau fallback
    notFound();
  }

  // Helper untuk formatting angka
  const formatNum = (num: number) => num?.toLocaleString("id-ID") || "0";

  return (
    <main
      className="min-h-screen pt-32 pb-20 px-4 relative bg-background bg-fixed bg-cover bg-center"
      style={{
        // Jika user punya backgroundUrl, gunakan itu. Jika tidak, tetap gelap biasa.
        backgroundImage: user.backgroundUrl
          ? `url(${user.backgroundUrl})`
          : "none",
      }}
    >
      {/* Overlay Gelap agar teks tetap terbaca meskipun backgroundnya terang */}
      {user.backgroundUrl && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm pointer-events-none" />
      )}

      <div className="max-w-5xl mx-auto relative z-10">
        {/* --- HEADER PROFILE CARD --- */}
        <div className="glass-panel rounded-[3rem] overflow-hidden border-primary/20 mb-8 shadow-2xl relative bg-card/60 backdrop-blur-md">
          {/* 2. UBAH BAGIAN COVER/BANNER */}
          <div
            className="h-64 relative bg-cover bg-center"
            style={{
              // Jika punya bannerUrl pakai itu, jika tidak pakai warna Rank Trucky
              backgroundImage: user.bannerUrl
                ? `url(${user.bannerUrl})`
                : "none",
              backgroundColor: user.bannerUrl
                ? "transparent"
                : `${member.rank?.color || "#7e57c2"}33`,
            }}
          >
            {/* Gradient hitam di bagian bawah banner agar nyambung ke profil */}
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
          </div>

          <div className="px-8 pb-10 flex flex-col md:flex-row items-center md:items-end gap-8 -mt-20 relative z-10">
            {/* Avatar */}
            <div className="relative group">
              <div
                className="w-44 h-44 rounded-[3rem] border-8 border-background overflow-hidden bg-card shadow-2xl"
                style={{
                  backgroundColor: `${member.rank?.color}11`,
                  borderColor: `${member.rank?.color}44`,
                }}
              >
                <img
                  src={
                    user.image || member.avatar_url || "/placeholder-avatar.png"
                  }
                  alt={member.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Identity */}
            <div className="flex-1 text-center md:text-left pb-2">
              <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                <h1 className="text-4xl font-black text-(--foreground) tracking-tight">
                  {member.name}
                </h1>
                <span
                  className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border w-fit mx-auto md:mx-0"
                  style={{
                    color: member.rank?.color,
                    borderColor: `${member.rank?.color}44`,
                    backgroundColor: `${member.rank?.color}11`,
                  }}
                >
                  {member.rank?.name || "Driver"}
                </span>
              </div>
              <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <MapPin className="w-4 h-4" />{" "}
                  {member.language || "Indonesian"}
                </div>
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Globe className="w-4 h-4" /> {member?.role?.name} of Nismara
                  Transport
                </div>
              </div>
            </div>

            {/* Level Badge */}
            <div className="p-4 bg-card/50 rounded-2xl border border-border/50 text-center min-w-30">
              <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">
                Driver Level
              </p>
              <p className="text-2xl font-black text-(--foreground)">
                {member.level || 0}
              </p>
            </div>
          </div>
        </div>

        {/* --- STATS GRID --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="glass-panel p-8 rounded-3xl border-primary/20">
            <Coins className="text-primary w-6 h-6 mb-4" />
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">
              Total NC
            </p>
            <p className="text-2xl font-black text-(--foreground)]">
              {formatNum(currencies.totalNC)}
            </p>
          </div>

          <div className="glass-panel p-8 rounded-3xl border-accent-sky/20">
            <Truck className="text-accent-sky w-6 h-6 mb-4" />
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">
              Distance
            </p>
            <p className="text-2xl font-black text-(--foreground)">
              {formatNum(member.total_driven_distance_km)}{" "}
              <span className="text-xs text-gray-500">km</span>
            </p>
          </div>

          <div className="glass-panel p-8 rounded-3xl border-accent-lilac/20">
            <Package className="text-accent-lilac w-6 h-6 mb-4" />
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">
              Cargo Delivered
            </p>
            <p className="text-2xl font-black text-(--foreground)">
              {formatNum(member.total_cargo_mass_t)}{" "}
              <span className="text-xs text-gray-500">t</span>
            </p>
          </div>

          <div className="glass-panel p-8 rounded-3xl border-yellow-500/20">
            <TriangleAlert className="text-red-500 w-6 h-6 mb-4" />
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">
              Point Penalty
            </p>
            <p className="text-2xl font-black text-(--foreground)">
              {formatNum(points?.totalPoints)} Points
            </p>
          </div>
        </div>

        {/* --- SOCIALS & INFO --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Social Media Links */}
          <div className="glass-panel p-8 rounded-[2.5rem] border-border/40">
            <h2 className="text-xl font-bold text-(--foreground) mb-6">
              Social Accounts
            </h2>
            <div className="space-y-4">
              {member.youtube && (
                <a
                  href={member.youtube}
                  target="_blank"
                  className="flex items-center justify-between p-4 rounded-2xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-colors"
                >
                  <span className="text-sm font-bold text-(--foreground) flex items-center gap-3">
                    <YoutubeIcon className="text-red-500" /> YouTube
                  </span>
                  <ExternalLink className="w-4 h-4 text-gray-500" />
                </a>
              )}
              {member.facebook && (
                <a
                  href={member.facebook}
                  target="_blank"
                  className="flex items-center justify-between p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 transition-colors"
                >
                  <span className="text-sm font-bold text-(--foreground) flex items-center gap-3">
                    <FacebookIcon className="text-blue-500" /> Facebook
                  </span>
                  <ExternalLink className="w-4 h-4 text-gray-500" />
                </a>
              )}
              {member.wotr && (
                <a
                  href={member.wotr}
                  target="_blank"
                  className="flex items-center justify-between p-4 rounded-2xl bg-orange-500/5 border border-orange-500/10 hover:bg-orange-500/10 transition-colors"
                >
                  <span className="text-sm font-bold text-(--foreground) flex items-center gap-3">
                    <Globe className="text-orange-500" /> World of Trucks
                  </span>
                  <ExternalLink className="w-4 h-4 text-gray-500" />
                </a>
              )}
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="lg:col-span-2 glass-panel p-8 rounded-[2.5rem] border-border/40">
            <h2 className="text-xl font-bold text-(--foreground) mb-8 flex items-center gap-3">
              <Activity className="text-primary" /> Informasi Driver
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              {[
                {
                  label: "Tanggal Bergabung",
                  value: new Date(member?.created_at).toLocaleDateString(
                    "id-ID",
                  ),
                },
                {
                  label: "Last Online",
                  value: new Date(member?.updated_at).toLocaleDateString(
                    "id-ID",
                  ),
                },
                {
                  label: "Status",
                  value: `${member?.role?.name}`,
                },
                {
                  label: "Pendapatan",
                  value: `${formatNum(member?.total_earned)} Tc`,
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center py-3 border-b border-white/5"
                >
                  <span className="text-gray-500 font-medium text-sm">
                    {item.label}
                  </span>
                  <span className="text-(--primary-foreground) font-bold text-sm">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// Komponen Ikon Tambahan
function ExternalLink(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
