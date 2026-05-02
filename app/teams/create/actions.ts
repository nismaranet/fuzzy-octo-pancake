"use server";

import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

// Fungsi untuk merubah teks menjadi format-kebab-case (nismara-skill-issue)
function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Ganti spasi dengan -
    .replace(/[^\w-]+/g, "") // Hapus karakter non-word
    .replace(/--+/g, "-"); // Ganti double -- dengan single -[cite: 17]
}

export async function createTeamAction(data: {
  name: string;
  uri: string;
  tag: string;
  description: string;
  logoUrl: string;
  bannerUrl: string;
}) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    return { success: false, message: "Sesi habis. Silakan login kembali." };
  }

  try {
    const client = await clientPromise;
    const db = client.db();

    const currentUser = await db
      .collection("users")
      .findOne({ email: session.user.email });

    if (!currentUser)
      return { success: false, message: "User tidak ditemukan." };

    if (currentUser?.teamId) {
      return { success: false, message: "Kamu sudah terdaftar di sebuah tim." };
    }

    const cleanName = data.name.trim();
    const cleanUri = slugify(data.uri || data.name);
    const cleanTag = data.tag.trim().toUpperCase();

    const existingTeam = await db.collection("teams").findOne({
      $or: [
        { name: { $regex: new RegExp(`^${cleanName}$`, "i") } },
        { uri: cleanUri },
      ],
    });

    if (existingTeam) {
      return {
        success: false,
        message:
          existingTeam.uri === cleanUri
            ? "Tautan (URI) sudah digunakan tim lain."
            : "Nama tim ini sudah terdaftar.",
      };
    }

    const newTeam = {
      name: cleanName,
      uri: cleanUri,
      tag: cleanTag,
      description: data.description,
      logoUrl: data.logoUrl,
      bannerUrl: data.bannerUrl,
      owner: currentUser._id,
      members: [currentUser._id],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("teams").insertOne(newTeam);

    await db.collection("users").updateOne(
      { _id: currentUser._id },
      {
        $set: {
          teamId: result.insertedId,
          teamRole: "owner",
        },
      },
    );

    revalidatePath("/teams");

    return { success: true, uri: cleanUri };
  } catch (error) {
    console.error("Database Error:", error);
    return { success: false, message: "Gagal menyimpan data ke server." };
  }
}
