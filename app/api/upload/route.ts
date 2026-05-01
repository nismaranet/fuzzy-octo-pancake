import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Inisialisasi R2 langsung di sini (menggantikan @/lib/r2)
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
  // Matikan checksum agar tidak ditolak oleh Cloudflare di versi AWS SDK terbaru
  requestChecksumCalculation: "WHEN_REQUIRED" as any,
  responseChecksumValidation: "WHEN_REQUIRED" as any,
});

export async function POST(request: Request) {
  // Proteksi API agar hanya user login yang bisa upload
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Menggunakan variabel yang sama persis dengan project lamamu
    const { fileName, fileType, folder } = await request.json();

    // Bersihkan nama file dari spasi atau karakter aneh (Logika dari kodemu)
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "-");

    // Format path: folder/userId-timestamp-namafile.jpg
    const userIdentifier =
      session.user.id || session.user.discordId || "driver";
    const filePath = `${folder}/${userIdentifier}-${Date.now()}-${cleanFileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: filePath,
      ContentType: fileType,
    });

    // Buat URL yang valid selama 1 jam (3600 detik) - Persis seperti kodemu
    const signedUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });

    // Ganti domain ini dengan Custom Domain R2 kamu (URL dari .env)
    const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${filePath}`;

    return NextResponse.json({ signedUrl, publicUrl });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      { error: "Failed to generate presigned URL" },
      { status: 500 },
    );
  }
}
