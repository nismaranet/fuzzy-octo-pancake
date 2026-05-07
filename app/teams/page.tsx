import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import {
  Users,
  Plus,
  ArrowRight,
  Shield,
  Trophy,
  Globe,
  Search,
  LayoutGrid,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TeamsIndexPage() {
  const session = await getServerSession(authOptions);
  const client = await clientPromise;
  const db = client.db();

  // 1. Ambil data semua tim
  const teams = await db.collection("teams").find({}).toArray();

  // 2. Cek apakah user sudah bergabung atau memiliki tim
  let userTeam = null;
  if (session?.user?.discordId) {
    userTeam = await db.collection("teams").findOne({
      $or: [
        { leaderId: session.user.discordId },
        { "members.userId": session.user.discordId },
      ],
    });
  }

  return (
    <main className="min-h-screen p-6 md:p-12 bg-(-background) relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-125 h-125 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-12 relative z-10">
        {/* HEADER SECTION */}
        <header className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-border/50 pb-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-primary mb-2">
              <Users size={32} />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-foreground/30">
                Nismara Hub
              </span>
            </div>
            <h1 className="text-5xl font-black text-(-primary-foreground) tracking-tighter uppercase leading-none">
              Explore <span className="text-gradient">Teams</span>
            </h1>
            <p className="text-foreground/40 font-medium max-w-lg">
              Temukan unit operasional yang sesuai dengan spesialisasi Anda.
              Bergabunglah untuk meningkatkan efisiensi kargo.
            </p>
          </div>

          {/* SMART ACTION BUTTON */}
          <div className="w-full md:w-auto">
            {userTeam ? (
              <Link
                href={`/teams/${userTeam.uri}`}
                className="flex items-center justify-center gap-3 px-8 py-4 bg-card border border-primary/30 rounded-2xl text-primary font-black uppercase tracking-widest text-[10px] hover:bg-primary/10 transition-all group"
              >
                <Shield size={16} /> Visit My Team{" "}
                <ArrowRight
                  size={16}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </Link>
            ) : (
              <Link
                href="/teams/create"
                className="flex items-center justify-center gap-3 px-8 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-primary/80 transition-all shadow-lg shadow-primary/20 group"
              >
                <Plus size={16} /> Create New Team{" "}
                <ChevronRight
                  size={16}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </Link>
            )}
          </div>
        </header>

        {/* TEAMS GRID */}
        {teams.length === 0 ? (
          <div className="py-32 text-center glass-panel rounded-[3rem] border-dashed border-2 border-border opacity-30">
            <LayoutGrid size={48} className="mx-auto mb-4" />
            <p className="font-black uppercase italic tracking-widest text-foreground/40">
              No teams registered yet
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {teams.map((team: any) => (
              <Link
                key={team._id.toString()}
                href={`/teams/${team.uri}`}
                className="group relative glass-panel p-8 rounded-[2.5rem] border border-border bg-card/20 hover:border-primary/50 hover:bg-card/40 transition-all duration-500 overflow-hidden flex flex-col"
              >
                {/* Team Icon/Logo Placeholder */}
                <div className="mb-6 flex justify-between items-start">
                  <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-primary/20 to-accent-sky/20 border border-white/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-500">
                    {team.logoUrl ? (
                      <img
                        src={team.logoUrl}
                        alt={team.name}
                        className="w-full h-full object-cover rounded-2xl"
                      />
                    ) : (
                      <Shield size={32} />
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-foreground/20 uppercase tracking-widest leading-none mb-1">
                      Status
                    </span>
                    <span className="text-[10px] font-black text-emerald-500 uppercase italic">
                      Active
                    </span>
                  </div>
                </div>

                <div className="space-y-2 flex-1">
                  <h2 className="text-2xl font-black text-(-primary-foreground) uppercase italic tracking-tight group-hover:text-primary transition-colors">
                    {team.name}
                  </h2>
                  <p className="text-xs text-foreground/40 font-medium leading-relaxed line-clamp-3">
                    {team.description ||
                      "Divisi strategis Nismara Transport yang fokus pada pengiriman kargo skala besar."}
                  </p>
                </div>

                {/* Team Stats Bar */}
                <div className="mt-8 pt-6 border-t border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-foreground/20 uppercase tracking-widest">
                        Members
                      </span>
                      <span className="text-sm font-black text-(-primary-foreground)">
                        {team.members?.length || 1}
                      </span>
                    </div>
                    <div className="w-px h-6 bg-border/50" />
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-foreground/20 uppercase tracking-widest">
                        Tag
                      </span>
                      <span className="text-sm font-black text-accent-sky uppercase text-[11px]">
                        {team.tag || "Logistics"}
                      </span>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-white/5 text-foreground/20 group-hover:bg-primary group-hover:text-white transition-all">
                    <ArrowRight size={16} />
                  </div>
                </div>

                {/* Decorative Pattern */}
                <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
                  <Users size={120} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ChevronRight({
  size,
  className,
}: {
  size: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
