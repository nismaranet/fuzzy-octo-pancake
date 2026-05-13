import type { Metadata, ResolvingMetadata } from "next";
import clientPromise from "@/lib/mongodb";

type Props = {
  params: Promise<{ uri: string }>;
};

/**
 * Fungsi untuk menghasilkan Metadata SEO secara dinamis
 */
export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const resolvedParams = await params;
  const uri = decodeURIComponent(resolvedParams.uri).toLowerCase();

  const client = await clientPromise;
  const db = client.db();

  // Cari data tim berdasarkan URI (sama dengan logika di page.tsx kamu)
  const team = await db.collection("teams").findOne({ uri: uri });

  if (!team) {
    return {
      title: "Team Not Found | Nismara Logistics",
    };
  }

  const teamName = team.name || "Nismara Team";
  const teamDescription =
    team.description ||
    `Halaman profil resmi untuk divisi ${teamName} di Nismara Transport.`;

  // Menggunakan logoUrl atau bannerUrl, fallback ke domain R2 kamu
  const ogImage =
    team.logoUrl ||
    team.bannerUrl ||
    "https://images.nismara.my.id/227300_188.jpg";

  return {
    title: `${teamName} | Nismara Teams`,
    description: teamDescription,
    openGraph: {
      title: `${teamName} - Nismara Logistics`,
      description: teamDescription,
      url: `https://nismara.web.id/teams/${uri}`,
      siteName: "Nismara Logistics",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `Logo ${teamName}`,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${teamName} | Nismara Logistics`,
      description: teamDescription,
      images: [ogImage],
    },
    alternates: {
      canonical: `https://nismara.web.id/teams/${uri}`,
    },
  };
}

export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <section className="min-h-screen bg-background">{children}</section>;
}
