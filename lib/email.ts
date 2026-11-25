const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Nismara Transport <noreply@nismara.web.id>";
const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://transport.nismara.web.id";
const DISCORD_INVITE_URL = "https://link.nismara.web.id/discord";
const TRUCKY_VTC_URL = "https://hub.truckyapp.com/vtc/nismara-logistic";
const LOGO_WHITE_URL = "https://nismara.web.id/images/nismara-group-logo-white.png";

function formatWIBDate(date: Date): string {
  return (
    new Date(date).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB"
  );
}

function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEmailShell(
  title: string,
  badgeColor: string,
  badgeLabel: string,
  bodyHtml: string,
): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#4c1d95 0%,#1e1b4b 100%);border-bottom:1px solid #334155;">
              <a href="${BASE_URL}" style="display:inline-block;text-decoration:none;margin-bottom:18px;">
                <img src="${LOGO_WHITE_URL}" alt="Nismara Transport" height="36" style="display:block;height:36px;width:auto;max-width:220px;border:0;outline:none;text-decoration:none;" />
              </a>
              <div>
                <span style="display:inline-block;padding:4px 12px;border-radius:999px;background-color:${badgeColor};color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">
                  ${escapeHtml(badgeLabel)}
                </span>
              </div>
              <h1 style="margin:12px 0 0 0;font-size:22px;line-height:1.3;color:#ffffff;">
                ${escapeHtml(title)}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;font-size:15px;line-height:1.65;color:#cbd5e1;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#0f172a;border-top:1px solid #334155;font-size:12px;color:#64748b;text-align:center;">
              Email ini dikirim otomatis oleh sistem <strong>Nismara Transport</strong> (<a href="${BASE_URL}" style="color:#a78bfa;text-decoration:none;">transport.nismara.web.id</a>).<br/>
              Mohon tidak membalas langsung ke alamat ini.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendResendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY tidak diatur; email dilewati.");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  if (!params.to || !params.to.includes("@")) {
    return { success: false, error: "Invalid recipient email" };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`[Email] Resend API error (${res.status}):`, data);
      return { success: false, error: data?.message || `HTTP ${res.status}` };
    }

    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error("[Email] Network error sending via Resend:", err);
    return { success: false, error: err?.message || "Network error" };
  }
}

export async function sendAccountHoldEmail(params: {
  to: string;
  name: string;
  reason: "LEFT_DISCORD" | "LEFT_TRUCKY" | "KICKED_TRUCKY";
  purgeScheduledAt: Date;
}) {
  const reasonText =
    params.reason === "LEFT_DISCORD"
      ? "Anda terdeteksi telah keluar dari server Discord resmi Nismara Transport (sesuai peraturan VTC, seluruh anggota wajib berada di server Discord selama aktif terdaftar, sehingga keanggotaan Trucky Anda juga telah dilepas)."
      : params.reason === "KICKED_TRUCKY"
        ? "Keanggotaan Anda di Trucky VTC Nismara Transport telah berakhir (dikeluarkan dari perusahaan)."
        : "Anda terdeteksi telah keluar dari Trucky VTC Nismara Transport.";

  const formattedDeadline = formatWIBDate(params.purgeScheduledAt);

  const html = renderEmailShell(
    "Data Akun Anda Ditahan Selama 90 Hari",
    "#d97706",
    "Status Keanggotaan • Hold 90 Hari",
    `
      <p style="margin:0 0 16px 0;">Halo <strong>${escapeHtml(params.name || "Driver")}</strong>,</p>
      <p style="margin:0 0 16px 0;">${escapeHtml(reasonText)}</p>
      <div style="background-color:#0f172a;border-left:4px solid #f59e0b;border-radius:8px;padding:16px 18px;margin:20px 0;">
        <p style="margin:0 0 8px 0;color:#fbbf24;font-weight:700;">⏳ Masa Tenggang Penyimpanan Data (90 Hari)</p>
        <p style="margin:0;font-size:14px;color:#cbd5e1;">
          Seluruh data Anda (saldo Nismara Coin, XP/Level, armada truk, garasi, dan riwayat perjalanan) <strong>tidak langsung dihapus</strong> melainkan dibekukan dengan aman hingga:<br/>
          <strong style="color:#ffffff;">${escapeHtml(formattedDeadline)}</strong>
        </p>
      </div>
      <p style="margin:0 0 16px 0;">
        Jika Anda ingin kembali bergabung dengan Nismara Transport sebelum tanggal tersebut, cukup <strong>bergabung kembali ke server Discord Nismara</strong> dan <strong>ajukan lamaran ulang di Trucky VTC</strong>. Begitu diterima kembali, seluruh data dan aset Anda akan pulih secara utuh.
      </p>
      <p style="margin:24px 0;">
        <a href="${DISCORD_INVITE_URL}" style="display:inline-block;padding:12px 20px;background-color:#5865F2;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;margin-right:10px;">Gabung Discord Nismara</a>
        <a href="${TRUCKY_VTC_URL}" style="display:inline-block;padding:12px 20px;background-color:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Halaman Trucky VTC</a>
      </p>
      <p style="margin:0;font-size:13px;color:#94a3b8;">
        Apabila melewati batas 90 hari tanpa bergabung kembali, seluruh data akun Anda akan dihapus permanen oleh sistem kami.
      </p>
    `,
  );

  return sendResendEmail({
    to: params.to,
    subject:
      "[Nismara Transport] Pemberitahuan Keanggotaan & Retensi Data 90 Hari",
    html,
  });
}

export async function sendAccountHoldReminderEmail(params: {
  to: string;
  name: string;
  purgeScheduledAt: Date;
}) {
  const formattedDeadline = formatWIBDate(params.purgeScheduledAt);
  const html = renderEmailShell(
    "Pengingat: 7 Hari Lagi Data Anda Akan Dihapus Permanen",
    "#dc2626",
    "Pengingat Terakhir • H-7",
    `
      <p style="margin:0 0 16px 0;">Halo <strong>${escapeHtml(params.name || "Driver")}</strong>,</p>
      <p style="margin:0 0 16px 0;">
        Masa tenggang 90 hari penyimpanan data akun Nismara Transport Anda akan berakhir dalam waktu <strong>7 hari</strong>, tepatnya pada:
      </p>
      <div style="background-color:#0f172a;border-left:4px solid #ef4444;border-radius:8px;padding:16px 18px;margin:20px 0;">
        <strong style="color:#fca5a5;font-size:16px;">${escapeHtml(formattedDeadline)}</strong>
      </div>
      <p style="margin:0 0 16px 0;">
        Setelah tanggal tersebut, seluruh data termasuk Nismara Coin (NC), Level/XP, armada truk, garasi, dan galeri Anda akan dihapus permanen dan tidak dapat dipulihkan. Jika Anda ingin kembali, silakan bergabung lagi ke server Discord dan ajukan lamaran di Trucky VTC sebelum batas waktu berakhir.
      </p>
      <p style="margin:24px 0;">
        <a href="${DISCORD_INVITE_URL}" style="display:inline-block;padding:12px 20px;background-color:#5865F2;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;margin-right:10px;">Gabung Discord Nismara</a>
        <a href="${TRUCKY_VTC_URL}" style="display:inline-block;padding:12px 20px;background-color:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Apply Ulang di Trucky</a>
      </p>
    `,
  );

  return sendResendEmail({
    to: params.to,
    subject:
      "[Nismara Transport] Pengingat H-7: Data Akun Akan Dihapus Permanen",
    html,
  });
}

export async function sendAccountPurgedEmail(params: {
  to: string;
  name: string;
}) {
  const html = renderEmailShell(
    "Penghapusan Data Akun Selesai",
    "#475569",
    "Notifikasi Retensi Data",
    `
      <p style="margin:0 0 16px 0;">Halo <strong>${escapeHtml(params.name || "Driver")}</strong>,</p>
      <p style="margin:0 0 16px 0;">
        Karena masa tenggang penyimpanan 90 hari telah berakhir, seluruh data akun Nismara Transport Anda kini telah <strong>dihapus secara permanen</strong> dari sistem kami.
      </p>
      <p style="margin:0;">
        Terima kasih atas kebersamaan Anda selama menjadi bagian dari Nismara Transport. Pintu kami selalu terbuka jika suatu hari Anda ingin mendaftar kembali sebagai anggota baru.
      </p>
    `,
  );

  return sendResendEmail({
    to: params.to,
    subject: "[Nismara Transport] Konfirmasi Penghapusan Permanen Data Akun",
    html,
  });
}

export async function sendAccountRestoredEmail(params: {
  to: string;
  name: string;
}) {
  const html = renderEmailShell(
    "Selamat Datang Kembali di Nismara Transport!",
    "#16a34a",
    "Akun Dipulihkan",
    `
      <p style="margin:0 0 16px 0;">Halo <strong>${escapeHtml(params.name || "Driver")}</strong>,</p>
      <p style="margin:0 0 16px 0;">
        Selamat datang kembali! Status penahanan (hold) akun Anda telah dicabut dan seluruh data lama Anda (Nismara Coin, Level/XP, armada, garasi, dan riwayat perjalanan) kini <strong>aktif kembali sepenuhnya</strong>.
      </p>
      <p style="margin:24px 0;">
        <a href="${BASE_URL}/dashboard" style="display:inline-block;padding:12px 20px;background-color:#16a34a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Buka Dashboard Nismara</a>
      </p>
    `,
  );

  return sendResendEmail({
    to: params.to,
    subject:
      "[Nismara Transport] Selamat Datang Kembali! Data Akun Anda Telah Dipulihkan",
    html,
  });
}
