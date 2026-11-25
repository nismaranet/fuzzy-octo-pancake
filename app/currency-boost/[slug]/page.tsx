import clientPromise from "@/lib/mongodb";
import BoostDetailClient from "./BoostDetailClient";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function generateMetadata({ params }: any): Promise<Metadata> {
  const resolvedParams = await params;
  const client = await clientPromise;
  const db = client.db();
  const event = await db
    .collection("ncevents")
    .findOne({ slug: resolvedParams.slug });
  if (!event) return { title: "Event Tidak Ditemukan" };

  const title = `${event.nameEvent}`;
  const basePct = Math.round(Number(event.multiplier || 0) * 100);
  const dsBonus = event.drivingScoreBonus;
  const dsText = dsBonus?.enabled
    ? ` Plus extra +${Math.round(Number(dsBonus.gradeABonus ?? 0.1) * 100)}% untuk Grade A dan +${Math.round(Number(dsBonus.gradeSBonus ?? 0.2) * 100)}% untuk Grade S!`
    : "";
  const description = `Ikuti event ${event.nameEvent} dan dapatkan bonus dasar +${basePct}% NC!${dsText}`;
  const imageUrl = event.imageUrl || "https://images.nismara.my.id/227300_188.jpg";
  const pageUrl = `https://transport.nismara.web.id/currency-boost/${resolvedParams.slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "Nismara Transport",
      locale: "id_ID",
      type: "website",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function CurrencyBoostDetailPage({ params }: any) {
  const resolvedParams = await params;
  const client = await clientPromise;
  const db = client.db();
  const event = await db
    .collection("ncevents")
    .findOne({ slug: resolvedParams.slug });

  if (!event) {
    notFound();
  }

  const participants = event.participants || [];
  const participantIds = participants.map((p: any) => p.discordId);

  // Ambil detail user untuk participants
  const users = await db
    .collection("users")
    .find({ discordId: { $in: participantIds } })
    .toArray();

  const enrichedParticipants = participants.map((p: any) => {
    const user = users.find((u) => u.discordId === p.discordId);
    return {
      ...p,
      name: user?.name || "Unknown Driver",
      avatarUrl: user?.image || "https://i.imgur.com/6M5rN9n.png",
      truckyId: user?.truckyId,
      truckyRank: user?.truckyRank,
      role: user?.discordRole || user?.role,
      isBooster: user?.isBooster,
      isNismaraPlus: user?.nismaraplus?.status === true,
      nismaraPlusStartedAt: user?.nismaraplus?.startedAt,
      topManager: user?.topManager || null,
    };
  });

  // Ambil detail user untuk creator / organizer
  const organizerUser = event.setBy
    ? await db.collection("users").findOne({ discordId: event.setBy })
    : null;
  const organizerLink = (!organizerUser && event.setBy)
    ? await db.collection("driverlinks").findOne({ userId: event.setBy })
    : null;

  const organizer = {
    discordId: event.setBy,
    name: organizerUser?.name || organizerUser?.global_name || organizerLink?.truckyName || "Management Nismara",
    avatarUrl: organizerUser?.image || null,
    truckyId: organizerUser?.truckyId || organizerLink?.truckyId || null,
    role: organizerUser?.discordRole || organizerUser?.role || null,
    isBooster: organizerUser?.isBooster || false,
    isNismaraPlus: organizerUser?.nismaraplus?.status === true,
    nismaraPlusStartedAt: organizerUser?.nismaraplus?.startedAt || null,
  };

  const session = await getServerSession(authOptions);
  let currentUserDrivingScore: {
    score: number;
    grade: string;
    status: string;
  } | null = null;

  if (session?.user?.discordId) {
    const me = await db
      .collection("users")
      .findOne(
        { discordId: session.user.discordId },
        { projection: { drivingScore: 1 } }
      );
    if (me?.drivingScore) {
      currentUserDrivingScore = {
        score: Number(me.drivingScore.score ?? 0),
        grade: String(me.drivingScore.grade ?? "N/A"),
        status: String(me.drivingScore.status ?? "inactive"),
      };
    } else {
      currentUserDrivingScore = {
        score: 0,
        grade: "N/A",
        status: "inactive",
      };
    }
  }

  const serializedEvent = {
    _id: event._id.toString(),
    slug: event.slug,
    nameEvent: event.nameEvent,
    multiplier: event.multiplier,
    imageUrl: event.imageUrl,
    type: event.type,
    gameId: event.gameId,
    jobCategory:
      event.jobCategory === "truck" || event.jobCategory === "coach"
        ? event.jobCategory
        : "all",
    drivingScoreBonus: event.drivingScoreBonus
      ? {
          enabled: Boolean(event.drivingScoreBonus.enabled),
          gradeABonus: Number(event.drivingScoreBonus.gradeABonus ?? 0.1),
          gradeSBonus: Number(event.drivingScoreBonus.gradeSBonus ?? 0.2),
          requireRealMiles:
            event.drivingScoreBonus.requireRealMiles !== undefined
              ? Boolean(event.drivingScoreBonus.requireRealMiles)
              : true,
        }
      : {
          enabled: false,
          gradeABonus: 0.1,
          gradeSBonus: 0.2,
          requireRealMiles: true,
        },
    isActive: event.isActive,
    isScheduled: event.isScheduled,
    startDate: event.startDate ? event.startDate.toISOString() : null,
    endAt:
      event.realEndAt || event.endAt
        ? (event.realEndAt || event.endAt).toISOString()
        : null,
    setAt: event.setAt ? event.setAt.toISOString() : null,
    setBy: event.setBy,
    organizer,
    participants: enrichedParticipants
      .map((p: any) => ({
        discordId: p.discordId,
        totalEarned: p.totalEarned,
        jobsCount: Number(p.jobsCount || 0),
        gradeBonusEarned: Number(p.gradeBonusEarned || 0),
        joinedAt: p.joinedAt ? p.joinedAt.toISOString() : null,
        name: p.name,
        avatarUrl: p.avatarUrl,
        truckyId: p.truckyId,
        truckyRank: p.truckyRank,
        role: p.role,
        isBooster: p.isBooster,
        isNismaraPlus: p.isNismaraPlus,
        nismaraPlusStartedAt: p.nismaraPlusStartedAt,
        topManager: p.topManager,
      }))
      .sort((a: any, b: any) => b.totalEarned - a.totalEarned),
  };

  return (
    <BoostDetailClient
      event={serializedEvent}
      currentUserDrivingScore={currentUserDrivingScore}
    />
  );
}
