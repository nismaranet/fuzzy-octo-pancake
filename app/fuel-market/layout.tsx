import { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Fuel Market",
  description:
    "Pasar transaksi bahan bakar terpusat Nismara Transport. Tersedia harga sistem dan pasar P2P antar pengemudi.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
