import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongoose";
import { upgradeToPremiumPass, getUserSeasonProgress } from "@/lib/seasonPass";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { seasonNumber = 1 } = body;

    await dbConnect();

    const result = await upgradeToPremiumPass(
      session.user.discordId,
      seasonNumber
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const updatedProgress = await getUserSeasonProgress(
      session.user.discordId,
      seasonNumber
    );

    return NextResponse.json({
      success: true,
      message: result.message,
      progress: updatedProgress,
    });
  } catch (error: any) {
    console.error("Season Pass Upgrade Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengupgrade Season Pass" },
      { status: 500 }
    );
  }
}
