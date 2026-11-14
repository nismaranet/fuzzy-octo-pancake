import Link from "next/link";
import { Map, Truck, Bus, Layers } from "lucide-react";
import JobList from "./jobList";
import { fetchJobs } from "./actions";

export const revalidate = 120;

export default async function PublicJobsPage(props: {
  searchParams: Promise<{ tab?: string; category?: string }>;
}) {
  const searchParams = await props.searchParams;

  // Logika 3 tab: default ke completed jika tidak ada parameter
  let currentTab: "ongoing" | "completed" | "canceled" = "completed";
  if (searchParams.tab === "ongoing") currentTab = "ongoing";
  if (searchParams.tab === "canceled") currentTab = "canceled";

  // Filter kategori: all | truck | coach
  let currentCategory: "all" | "truck" | "coach" = "all";
  if (searchParams.category === "truck") currentCategory = "truck";
  if (searchParams.category === "coach") currentCategory = "coach";

  const initialJobs = await fetchJobs(currentTab, 0, 12, currentCategory);

  const buildUrl = (tab: string, category: string) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (category && category !== "all") {
      params.set("category", category);
    }
    return `/jobs?${params.toString()}`;
  };

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-primary/20 rounded-2xl mb-4 border border-primary/30">
            <Map className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-extrabold text-foreground mb-2">
            Live <span className="text-gradient">Logbook</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Pantau aktivitas pengiriman truk logistik dan perjalanan bus penumpang Nismara Transport secara langsung.
          </p>
        </div>

        {/* Filter Bar: Status Tabs & Category Toggle */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-10">
          {/* Tab Navigasi 3 Opsi */}
          <div className="glass-panel inline-flex p-1 rounded-2xl bg-card/10 border border-border/50">
            <Link
              href={buildUrl("ongoing", currentCategory)}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                currentTab === "ongoing"
                  ? "bg-accent-sky text-white shadow-lg"
                  : "text-gray-400 hover:text-foreground"
              }`}
            >
              Ongoing
            </Link>
            <Link
              href={buildUrl("completed", currentCategory)}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                currentTab === "completed"
                  ? "bg-primary text-white shadow-lg"
                  : "text-gray-400 hover:text-foreground"
              }`}
            >
              Completed
            </Link>
            <Link
              href={buildUrl("canceled", currentCategory)}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                currentTab === "canceled"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "text-gray-400 hover:text-foreground"
              }`}
            >
              Canceled
            </Link>
          </div>

          {/* Filter Kategori: Semua / Truck / Coach */}
          <div className="glass-panel inline-flex p-1 rounded-2xl bg-card/10 border border-border/50">
            <Link
              href={buildUrl(currentTab, "all")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                currentCategory === "all"
                  ? "bg-foreground text-background shadow-lg"
                  : "text-gray-400 hover:text-foreground"
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Semua
            </Link>
            <Link
              href={buildUrl(currentTab, "truck")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                currentCategory === "truck"
                  ? "bg-orange-500 text-white shadow-lg"
                  : "text-gray-400 hover:text-foreground"
              }`}
            >
              <Truck className="w-3.5 h-3.5" /> Truck
            </Link>
            <Link
              href={buildUrl(currentTab, "coach")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                currentCategory === "coach"
                  ? "bg-sky-500 text-white shadow-lg"
                  : "text-gray-400 hover:text-foreground"
              }`}
            >
              <Bus className="w-3.5 h-3.5" /> Coach / Bus
            </Link>
          </div>
        </div>

        {/* Tabel dengan Key unik agar remount saat pindah tab/kategori */}
        <JobList
          key={`${currentTab}-${currentCategory}`}
          initialJobs={initialJobs}
          tab={currentTab}
          category={currentCategory}
        />
      </div>
    </main>
  );
}
