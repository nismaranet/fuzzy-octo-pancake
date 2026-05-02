"use server";

import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { deleteFileFromR2 } from "@/lib/r2";

// Helper untuk merubah teks menjadi format-kebab-case
function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");
}

// 1. Mengajukan Join
export async function joinTeamAction(teamId: string, userId: string) {
  const client = await clientPromise;
  const db = client.db();

  await db
    .collection("teams")
    .updateOne(
      { _id: new ObjectId(teamId) },
      { $addToSet: { pendingRequests: new ObjectId(userId) } },
    );

  revalidatePath(`/teams/[uri]`, "page");
  return { success: true };
}

export async function updateTeamSettingsAction(teamId: string, data: any) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const tId = new ObjectId(teamId);

    // 1. Ambil data tim lama untuk cek URL foto lama
    const oldTeam = await db.collection("teams").findOne({ _id: tId });
    if (!oldTeam) return { success: false, message: "Tim tidak ditemukan." };

    // 2. Jika Logo diganti, hapus yang lama dari R2[cite: 17]
    if (data.logoUrl && oldTeam.logoUrl && data.logoUrl !== oldTeam.logoUrl) {
      await deleteFileFromR2(oldTeam.logoUrl);
    }

    // 3. Jika Banner diganti, hapus yang lama dari R2[cite: 17]
    if (
      data.bannerUrl &&
      oldTeam.bannerUrl &&
      data.bannerUrl !== oldTeam.bannerUrl
    ) {
      await deleteFileFromR2(oldTeam.bannerUrl);
    }

    const cleanUri = slugify(data.uri || data.name);
    const cleanName = data.name.trim();

    // Validasi Keunikan
    const existing = await db.collection("teams").findOne({
      _id: { $ne: tId },
      $or: [
        { uri: cleanUri },
        { name: { $regex: new RegExp(`^${cleanName}$`, "i") } },
      ],
    });

    if (existing) {
      return {
        success: false,
        message:
          existing.uri === cleanUri
            ? "URI sudah digunakan."
            : "Nama tim sudah ada.",
      };
    }

    // 4. Update Database
    await db.collection("teams").updateOne(
      { _id: tId },
      {
        $set: {
          name: cleanName,
          tag: data.tag.trim().toUpperCase(),
          uri: cleanUri,
          description: data.description,
          logoUrl: data.logoUrl,
          bannerUrl: data.bannerUrl,
          updatedAt: new Date(),
        },
      },
    );

    revalidatePath(`/teams/${cleanUri}`);
    revalidatePath(`/teams/hq/${cleanUri}`);
    return { success: true, newUri: cleanUri };
  } catch (error) {
    return { success: false, message: "Gagal memperbarui pengaturan." };
  }
}

export async function manageMemberAction(
  teamId: string,
  userId: string,
  action: "ACCEPT" | "REJECT" | "KICK",
) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const tId = new ObjectId(teamId);
    const uId = new ObjectId(userId);

    if (action === "ACCEPT") {
      await db
        .collection("teams")
        .updateOne(
          { _id: tId },
          {
            $pull: { pendingRequests: uId as any },
            $addToSet: { members: uId as any },
          },
        );
      // Sync ke koleksi users[cite: 18]
      await db
        .collection("users")
        .updateOne({ _id: uId }, { $set: { teamId: tId, teamRole: "member" } });
    } else if (action === "REJECT") {
      await db
        .collection("teams")
        .updateOne({ _id: tId }, { $pull: { pendingRequests: uId as any } });
    } else if (action === "KICK") {
      await db
        .collection("teams")
        .updateOne({ _id: tId }, { $pull: { members: uId as any } });
      await db
        .collection("users")
        .updateOne({ _id: uId }, { $set: { teamId: null, teamRole: null } });
    }

    revalidatePath(`/teams/hq/[uri]`, "page");
    return { success: true };
  } catch (error) {
    return { success: false, message: "Gagal memproses anggota." };
  }
}

// app/actions/teamHqActions.ts

export async function deleteTeamAction(teamId: string) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const tId = new ObjectId(teamId);

    const team = await db.collection("teams").findOne({ _id: tId });
    if (!team) return { success: false, message: "Tim tidak ditemukan." };

    // 1. Hapus SEMUA aset gambar dari R2[cite: 17]
    await Promise.all([
      deleteFileFromR2(team.logoUrl),
      deleteFileFromR2(team.bannerUrl),
    ]);

    // 2. Reset status semua member tim[cite: 18]
    await db
      .collection("users")
      .updateMany({ teamId: tId }, { $set: { teamId: null, teamRole: null } });

    // 3. Hapus dokumen tim permanen[cite: 18]
    await db.collection("teams").deleteOne({ _id: tId });

    revalidatePath("/teams");
    return { success: true };
  } catch (error) {
    console.error("Delete team error:", error);
    return { success: false, message: "Gagal menghapus tim." };
  }
}
