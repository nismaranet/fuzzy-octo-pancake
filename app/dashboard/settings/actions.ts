"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const session = await getServerSession(authOptions);

  // Pastikan session dan email tersedia
  if (!session || !session.user?.email) {
    return { success: false, message: "Unauthorized: Silakan login kembali." };
  }

  const name = formData.get("name") as string;
  const image = formData.get("image") as string;
  const bannerUrl = formData.get("bannerUrl") as string;
  const backgroundUrl = formData.get("backgroundUrl") as string;

  try {
    const client = await clientPromise;
    const db = client.db();

    // KUNCI PERBAIKAN: Cari berdasarkan EMAIL, bukan ObjectId
    const updateResult = await db.collection("users").updateOne(
      { email: session.user.email },
      {
        $set: {
          name: name,
          image: image,
          bannerUrl: bannerUrl,
          backgroundUrl: backgroundUrl,
          updatedAt: new Date(),
        },
      },
    );

    // Cek apakah data benar-benar ada yang berubah/ditemukan
    if (updateResult.matchedCount === 0) {
      return { success: false, message: "Akun tidak ditemukan di database." };
    }

    // Refresh cache agar halaman langsung berubah tanpa perlu F5
    revalidatePath("/profile/[truckyId]", "page");
    revalidatePath("/dashboard/settings");

    return { success: true, message: "Profil berhasil diperbarui!" };
  } catch (error) {
    console.error("Update Profile Error:", error);
    return {
      success: false,
      message: "Terjadi kesalahan saat menyimpan ke database.",
    };
  }
}

// Tambahkan fungsi ini di actions.ts
export async function getUserSettings() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) return null;

  try {
    const client = await clientPromise;
    const db = client.db();
    const user = await db
      .collection("users")
      .findOne({ email: session.user.email });

    if (!user) return null;

    // Pastikan mengembalikan objek plain (stringified) karena ini Server Action
    return {
      name: user.name || "",
      image: user.image || "",
      bannerUrl: user.bannerUrl || "",
      backgroundUrl: user.backgroundUrl || "",
    };
  } catch (error) {
    console.error("Error fetching settings:", error);
    return null;
  }
}
