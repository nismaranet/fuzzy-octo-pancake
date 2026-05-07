/** @type {import('next').NextConfig} */
const nextConfig = {
  // Jika Anda menggunakan image dari domain tunnel
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.nismara.my.id",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "avatars.steamstatic.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "dev.nismara.my.id",
        pathname: "/**",
      },
    ],
  },
  // Izinkan tunnel untuk bypass proteksi host jika diperlukan
  experimental: {
    serverActions: {
      allowedOrigins: ["dev.nismara.my.id"],
    },
  },
};

module.exports = nextConfig;
