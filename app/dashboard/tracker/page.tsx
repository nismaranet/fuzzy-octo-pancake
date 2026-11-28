import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import DriverAccessBlocker from "@/components/DriverAccessBlocker";
import TrackerClient from "./TrackerClient";
import clientPromise from "@/lib/mongodb";

export const metadata = {
  title: "Nismara Tracker & Companion Hub",
  description: "Unduh Nismara Companion dan kelola perangkat yang terhubung ke akun driver Anda.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RELEASES_BASE_URL = (
  process.env.RELEASES_BASE_URL ||
  process.env.NEXT_PUBLIC_RELEASES_BASE_URL ||
  "https://releases.nismara.web.id"
)
  .trim()
  .replace(/\/+$/, "");

async function getLatestRelease() {
  const fallback = {
    tagName: "v1.0.4-beta",
    name: "Nismara Companion v1.0.4-beta",
    publishedAt: new Date().toISOString(),
    downloads: {
      windowsExe: `${RELEASES_BASE_URL}/latest/Nismara-Companion-Setup.exe`,
      windowsMsi: null as string | null,
      windowsDll: `${RELEASES_BASE_URL}/latest/NismaraTracker.dll`,
      linuxAppImage: `${RELEASES_BASE_URL}/latest/Nismara-Companion.AppImage`,
      linuxDeb: null as string | null,
    },
  };

  try {
    const res = await fetch(`${RELEASES_BASE_URL}/version.json`, {
      next: { revalidate: 60 },
      headers: {
        "User-Agent": "Nismara-Logistics-Hub",
        Accept: "application/json",
      },
    });

    if (!res.ok) return fallback;

    const data = await res.json();
    const tagName =
      data.tag ||
      (data.version
        ? String(data.version).startsWith("v")
          ? String(data.version)
          : `v${data.version}`
        : fallback.tagName);

    return {
      tagName,
      name: `Nismara Companion ${tagName}`,
      publishedAt: data.pub_date || fallback.publishedAt,
      downloads: {
        windowsExe:
          data.downloads?.windows_setup ||
          data.stable_latest?.windows_setup ||
          fallback.downloads.windowsExe,
        windowsMsi: data.downloads?.windows_msi || null,
        windowsDll:
          data.downloads?.plugin_dll ||
          data.stable_latest?.plugin_dll ||
          fallback.downloads.windowsDll,
        linuxAppImage:
          data.downloads?.linux_appimage ||
          data.stable_latest?.linux_appimage ||
          fallback.downloads.linuxAppImage,
        linuxDeb: data.downloads?.linux_deb || null,
      },
    };
  } catch (err) {
    console.warn("Failed to fetch latest release from Cloudflare R2:", err);
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

  const rawDevices = Array.isArray(user.trackerDevices) ? user.trackerDevices : [];
  const serializedDevices = rawDevices.map((d: Record<string, unknown>) => ({
    deviceId: String(d.deviceId || ""),
    deviceName: String(d.deviceName || "Unknown PC"),
    platform: String(d.platform || "Windows"),
    clientType: d.clientType === "plugin" ? ("plugin" as const) : ("companion" as const),
    clientVersion: d.clientVersion ? String(d.clientVersion) : null,
    lastGame: d.lastGame ? String(d.lastGame) : null,
    activeGame: d.activeGame ? String(d.activeGame) : null,
    lastInGameSyncAt: d.lastInGameSyncAt
      ? new Date(d.lastInGameSyncAt as string | Date).toISOString()
      : null,
    firstSeenAt: d.firstSeenAt
      ? new Date(d.firstSeenAt as string | Date).toISOString()
      : null,
    lastSyncAt: d.lastSyncAt
      ? new Date(d.lastSyncAt as string | Date).toISOString()
      : null,
    revoked: Boolean(d.revoked),
    revokedAt: d.revokedAt
      ? new Date(d.revokedAt as string | Date).toISOString()
      : null,
  }));

  return (
    <TrackerClient
      trackerLastSync={
        user.trackerLastSync
          ? new Date(user.trackerLastSync).toISOString()
          : null
      }
      trackerVersion={user.trackerVersion || null}
      trackerLastGame={user.trackerLastGame || null}
      initialDevices={serializedDevices}
      release={release}
    />
  );
}

