import Link from "next/link";
import clientPromise from "@/lib/mongodb"; //[cite: 5]
// import { Team } from "@/lib/models/Team"; // Gunakan ini jika file tersebut mengekspor TypeScript Interface/Type

export const dynamic = "force-dynamic";

export default async function TeamsIndexPage() {
  // Menggunakan MongoClient dari lib/mongodb[cite: 5]
  const client = await clientPromise; //[cite: 5]
  const db = client.db();

  // Mengambil data dari collection "teams"[cite: 5]
  const teams = await db.collection("teams").find({}).toArray(); //[cite: 5]

  return (
    // Background dan teks utama sudah diatur oleh body di global.css, cukup berikan padding
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 text-center md:text-left">
          <h1 className="text-4xl font-extrabold text-gradient mb-4">
            {/* Menggunakan custom utility .text-gradient dari global.css[cite: 6] */}
            Eksplorasi Tim
          </h1>
          <p className="text-foreground/70 text-lg opacity-80">
            Temukan dan bergabunglah dengan tim yang sesuai dengan visimu.
          </p>
        </header>

        {teams.length === 0 ? (
          <div className="text-center py-20 glass-panel rounded-2xl">
            {/* Menggunakan .glass-panel[cite: 6] */}
            <p className="text-foreground/70">
              Belum ada tim yang terdaftar saat ini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <Link
                href={`/teams/${team.uri}`}
                key={team._id.toString()}
                className="group block glass-panel rounded-2xl p-6 transition-all duration-300 hover:border-primary/60 hover:shadow-[0_0_20px_var(--color-primary)] hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                    {team.name}
                  </h2>
                  <span className="bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full border border-primary/20">
                    {team.members?.length || 0} Anggota
                  </span>
                </div>

                <p className="text-foreground/70 mb-6 line-clamp-3">
                  {team.description || "Tidak ada deskripsi untuk tim ini."}
                </p>

                <div className="flex items-center text-sm font-medium text-primary group-hover:text-accent-sky transition-colors">
                  Lihat Detail
                  <svg
                    className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
