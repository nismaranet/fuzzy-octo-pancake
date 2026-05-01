import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import clientPromise from "@/lib/mongodb";
import { getCompanyMembersMap } from "@/lib/trucky";
import {
  Users,
  ShieldCheck,
  ExternalLink,
  Search,
  Filter,
  MoreVertical,
  Truck,
} from "lucide-react";
import Image from "next/image";

export default async function ManageUsersPage() {
  const session = await getServerSession(authOptions);

  // PROTEKSI: Hanya Manager yang bisa akses
  if (!session || session.user.role !== "manager") {
    redirect("/dashboard");
  }

  const client = await clientPromise;
  const db = client.db();

  // 1. Ambil semua akun dari driverlinks (Data Member VTC)
  const driverLinks = await db.collection("driverlinks").find({}).toArray();

  // 2. Ambil semua user dari collection 'users' (Data Login Web)
  // Kita ambil untuk mencocokkan siapa yang sudah pernah login ke web
  const webUsers = await db.collection("users").find({}).toArray();

  // 3. Ambil Map Member dari Trucky (Cached 1 jam)
  const membersMap = await getCompanyMembersMap(35643);

  // 4. Gabungkan Data
  const allMembers = driverLinks.map((link) => {
    const truckyProfile = membersMap[Number(link.truckyId)];
    // Cari apakah user ini punya akun di web (NextAuth)
    // Biasanya dicocokkan lewat email atau discordId jika disimpan
    const hasWebAccount = webUsers.find(
      (u) => u.email === truckyProfile?.email,
    );

    return {
      id: link._id.toString(),
      discordId: link.userId,
      truckyId: link.truckyId,
      truckyName: truckyProfile?.name || link.truckyName || "Unknown",
      avatarUrl: truckyProfile?.avatar_url || null,
      role: truckyProfile?.role?.name || "Driver",
      joinedAt: truckyProfile?.joined_at || link.createdAt,
      isWebActive: !!hasWebAccount,
    };
  });

  return (
    <main className="min-h-screen pt-24 pb-12 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Manajemen */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              <Users className="text-primary" /> Member Management
            </h1>
            <p className="text-gray-400 mt-1">
              Kelola dan pantau seluruh pengemudi Nismara Transport.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="glass-panel px-4 py-2 rounded-xl flex items-center gap-3 border-primary/20">
              <div className="text-right">
                <p className="text-[10px] text-gray-500 font-bold uppercase">
                  Total Members
                </p>
                <p className="text-xl font-black text-white">
                  {allMembers.length}
                </p>
              </div>
              <Users className="text-primary w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Toolbar: Search & Filter */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Cari berdasarkan nama atau Trucky ID..."
              className="w-full bg-card/50 border border-border/50 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-primary/50 transition-all"
            />
          </div>
          <button className="glass-panel flex items-center justify-center gap-2 font-bold text-gray-400 hover:text-white transition-colors">
            <Filter className="w-4 h-4" /> Filter Status
          </button>
        </div>

        {/* Table View */}
        <div className="glass-panel rounded-3xl overflow-hidden border-border/40 shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-card/50 border-b border-border/50 text-[10px] uppercase tracking-widest text-gray-500 font-bold">
                  <th className="px-6 py-5">Driver & ID</th>
                  <th className="px-6 py-5">Discord ID</th>
                  <th className="px-6 py-5">Role VTC</th>
                  <th className="px-6 py-5">Web Status</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {allMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-border/50 bg-card shrink-0">
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-primary font-bold bg-primary/10">
                              {member.truckyName.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-white leading-tight">
                            {member.truckyName}
                          </p>
                          <p className="text-[10px] text-primary font-mono mt-1">
                            TRUCKY: {member.truckyId}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs text-gray-500 bg-black/20 px-2 py-1 rounded border border-white/5">
                        {member.discordId}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-gray-400 uppercase">
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {member.isWebActive ? (
                        <div className="flex items-center gap-2 text-green-400 text-[10px] font-bold uppercase">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />{" "}
                          Registered
                        </div>
                      ) : (
                        <div className="text-gray-600 text-[10px] font-bold uppercase">
                          Not Logged In
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 hover:bg-primary/20 rounded-lg text-gray-500 hover:text-primary transition-all">
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button className="p-2 hover:bg-card rounded-lg text-gray-500 hover:text-white transition-all">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
