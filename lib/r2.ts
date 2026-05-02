import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Inisialisasi S3 Client untuk R2
export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED" as any,
  responseChecksumValidation: "WHEN_REQUIRED" as any,
});

// Fungsi untuk menghapus file di R2 berdasarkan URL publik
export async function deleteFileFromR2(publicUrl: string | null | undefined) {
  if (!publicUrl) return;

  try {
    // Ekstrak "Key" (path file) dari URL publik
    // Contoh: nismara.id/teams/logos/file.jpg -> teams/logos/file.jpg
    const url = new URL(publicUrl);
    const key = url.pathname.startsWith("/")
      ? url.pathname.substring(1)
      : url.pathname;

    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });

    await r2.send(command);
    console.log(`✅ Berhasil menghapus file dari R2: ${key}`);
  } catch (error) {
    console.error("❌ Gagal menghapus file di R2:", error);
  }
}
