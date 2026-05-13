import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://transport.nismara.web.id";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Jika ada rute seperti admin dashboard yang tidak ingin diindex, taruh di disallow:
      disallow: ["/dashboard/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
