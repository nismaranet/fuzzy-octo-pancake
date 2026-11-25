import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import {
  WEB_CONFIG_DB_KEY,
  getWebConfig,
  isWebOwner,
} from "@/lib/webConfig";
import { getDiscordGuildMeta } from "@/lib/discordGuildMeta";
import WebConfigClient from "./WebConfigClient";

export const metadata = {
  title: "Web Configuration",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function WebConfigPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.discordId || !(await isWebOwner(session.user.discordId))) {
    redirect("/dashboard/manage/data");
  }

  const [config, doc, discordMeta] = await Promise.all([
    getWebConfig(true),
    clientPromise
      .then((c) => c.db().collection("systemsettings").findOne({ key: WEB_CONFIG_DB_KEY }))
      .catch(() => null),
    getDiscordGuildMeta(false),
  ]);

  return (
    <WebConfigClient
      initialConfig={config}
      initialDiscordMeta={discordMeta}
      meta={{
        hasDbRecord: Boolean(doc),
        updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
        updatedBy: doc?.updatedBy ? String(doc.updatedBy) : null,
      }}
    />
  );
}
