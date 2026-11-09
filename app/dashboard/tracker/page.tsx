import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import DriverAccessBlocker from "@/components/DriverAccessBlocker";
import TrackerClient from "./TrackerClient";
import clientPromise from "@/lib/mongodb";

export const metadata = {
  title: "Nismara Tracker & Companion Hub",
  description: "Unduh Nismara Companion dan kelola token in-game telemetry plugin Anda.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getLatestRelease() {
  const fallback = {
    tagName: "v1.0.0",
    name: "Nismara Companion v1.0.0",
    publishedAt: new Date().toISOString(),
    htmlUrl: "https://github.com/mhazm/fortune-cookie-client/releases/latest",
    downloads: {
      windowsExe:
        "https://github.com/mhazm/fortune-cookie-client/releases/latest/download/Nismara.Companion_1.0.0_x64-setup.exe",
      windowsMsi:
        "https://github.com/mhazm/fortune-cookie-client/releases/latest/download/Nismara.Companion_1.0.0_x64_en-US.msi",
      windowsDll:
        "https://github.com/mhazm/fortune-cookie-client/releases/latest/download/NismaraTracker.dll",
      linuxAppImage:
        "https://github.com/mhazm/fortune-cookie-client/releases/latest/download/Nismara.Companion_1.0.0_amd64.AppImage",
      linuxDeb:
        "https://github.com/mhazm/fortune-cookie-client/releases/latest/download/Nismara.Companion_1.0.0_amd64.deb",
      linuxRpm:
        "https://github.com/mhazm/fortune-cookie-client/releases/latest/download/Nismara.Companion-1.0.0-1.x86_64.rpm",
      macosDmg:
        "https://github.com/mhazm/fortune-cookie-client/releases/latest/download/Nismara.Companion_1.0.0_aarch64.dmg",
      macosTar:
        "https://github.com/mhazm/fortune-cookie-client/releases/latest/download/Nismara.Companion_aarch64.app.tar.gz",
    },
  };

  try {
    const res = await fetch(
      "https://api.github.com/repos/mhazm/fortune-cookie-client/releases/latest",
      {
        next: { revalidate: 60 },
        headers: {
          "User-Agent": "Nismara-Logistics-Hub",
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!res.ok) return fallback;

    const data = await res.json();
    const assets: Array<{ name: string; browser_download_url: string }> =
      data.assets || [];

    const findUrl = (regex: RegExp) =>
      assets.find((a) => regex.test(a.name))?.browser_download_url;

    return {
      tagName: data.tag_name || fallback.tagName,
      name: data.name || fallback.name,
      publishedAt: data.published_at || fallback.publishedAt,
      htmlUrl: data.html_url || fallback.htmlUrl,
      downloads: {
        windowsExe:
          findUrl(/_x64-setup\.exe$/i) || fallback.downloads.windowsExe,
        windowsMsi: findUrl(/\.msi$/i) || fallback.downloads.windowsMsi,
        windowsDll:
          findUrl(/NismaraTracker\.dll$/i) || fallback.downloads.windowsDll,
        linuxAppImage:
          findUrl(/\.AppImage$/i) || fallback.downloads.linuxAppImage,
        linuxDeb: findUrl(/\.deb$/i) || fallback.downloads.linuxDeb,
        linuxRpm: findUrl(/\.rpm$/i) || fallback.downloads.linuxRpm,
        macosDmg: findUrl(/\.dmg$/i) || fallback.downloads.macosDmg,
        macosTar: findUrl(/\.app\.tar\.gz$/i) || fallback.downloads.macosTar,
      },
    };
  } catch (err) {
    console.warn("Failed to fetch latest release from GitHub API:", err);
    return fallback;
  }
}

export default async function TrackerPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (!session.user?.isDriver || !session.user.driverData) {
    return <DriverAccessBlocker session={session} />;
  }

  const client = await clientPromise;
  const db = client.db();
  const user = await db
    .collection("users")
    .findOne({ email: session.user.email });

  if (!user) {
    redirect("/login");
  }

  // Hanya user yang memiliki hak uji coba (test_participation === true) yang dapat mengakses halaman Tracker
  if (!user.test_participation) {
    redirect("/dashboard");
  }

  const release = await getLatestRelease();

  return (
    <TrackerClient
      initialToken={user.trackerToken || null}
      trackerLastSync={
        user.trackerLastSync
          ? new Date(user.trackerLastSync).toISOString()
          : null
      }
      trackerVersion={user.trackerVersion || null}
      release={release}
    />
  );
}

