import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Providers } from "@/components/Providers";

const roboto = Noto_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nismara Logistics | Virtual Command Center",
  description: "Sistem manajemen logistik virtual untuk armada Nismara.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body className={`${roboto.className} flex flex-col min-h-screen`}>
        {/* Navbar akan selalu ada di paling atas */}
        <Providers>
          <Navbar />

          <div className="flex-1">{children}</div>

          <Footer />
        </Providers>
      </body>
    </html>
  );
}
