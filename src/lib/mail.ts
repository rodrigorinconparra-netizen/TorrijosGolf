import "server-only";

/**
 * Envío de emails vía Resend (https://resend.com), usando su API REST directa
 * (sin dependencia). Si RESEND_API_KEY no está configurada, es no-op: la app
 * funciona igual pero sin emails.
 */

const FROM = process.env.MAIL_FROM ?? "Torrijos Golf <onboarding@resend.dev>";

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail(
  to: string[],
  subject: string,
  html: string,
): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key || to.length === 0) return;

  // Resend acepta hasta 50 destinatarios por petición vía bcc.
  const chunks: string[][] = [];
  for (let i = 0; i < to.length; i += 50) chunks.push(to.slice(i, i + 50));

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM,
            to: [FROM],
            bcc: chunk,
            subject,
            html,
          }),
        });
      } catch {
        /* el email es best-effort */
      }
    }),
  );
}

/** Plantilla simple con el branding del club. */
export function mailTemplate(title: string, body: string): string {
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7faf8;padding:32px 16px">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e2ebe5">
      <h2 style="color:#1f6c5c;margin:0 0 4px">Torrijos Golf</h2>
      <h3 style="color:#1c1c1e;margin:16px 0 8px">${title}</h3>
      <p style="color:#3a3a3c;line-height:1.6;white-space:pre-line">${body}</p>
      <p style="color:#a1a1a6;font-size:12px;margin-top:24px">
        Club de Golf Torrijos · Este es un aviso automático de la app del club.
      </p>
    </div>
  </div>`;
}
