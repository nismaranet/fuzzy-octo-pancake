import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongoose";
import {
  claimLevelReward,
  claimAllAvailableRewards,
  getActiveSeason,
  getUserSeasonProgress,
} from "@/lib/seasonPass";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { level, track, claimAll, seasonNumber = 1 } = body;

    await dbConnect();

    let result;

    if (claimAll) {
      result = await claimAllAvailableRewards(
        session.user.discordId,
        seasonNumber
      );
    } else {
      if (!level || !track) {
        return NextResponse.json(
          { error: "Parameter level dan track (free/premium) wajib diisi" },
          { status: 400 }
        );
      }
      result = await claimLevelReward(
        session.user.discordId,
        seasonNumber,
        level,
        track
      );
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const updatedProgress = await getUserSeasonProgress(
      session.user.discordId,
      seasonNumber
    );

    return NextResponse.json({
      success: true,
      result,
      progress: updatedProgress,
    });
  } catch (error: any) {
    console.error("Season Pass Claim Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengklaim hadiah" },
      { status: 500 }
    );
  }
}
