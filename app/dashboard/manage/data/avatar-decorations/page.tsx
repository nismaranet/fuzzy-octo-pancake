import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getAvatarDecorationsCatalog } from "@/lib/avatarDecorationsServer";
import AvatarDecorationsClient from "./AvatarDecorationsClient";

export const metadata = {
  title: "Manage Avatar Decorations",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function ManageAvatarDecorationsPage() {
  const session = await getServerSession(authOptions);
  const isManager =
    session?.user?.role === "manager" || session?.user?.role === "admin";

  if (!session?.user?.discordId || !isManager) {
    redirect("/dashboard");
  }

  const { items, isSeeded } = await getAvatarDecorationsCatalog({
    includeInactive: true,
    bypassCache: true,
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <AvatarDecorationsClient
        initialItems={isSeeded ? items : []}
        initialIsSeeded={isSeeded}
        previewAvatarUrl={session.user.image || "/placeholder-avatar.png"}
        previewUserName={session.user.name || "Driver"}
      />
    </div>
  );
}
