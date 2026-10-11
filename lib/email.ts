// Envío de emails con Resend (https://resend.com). Si faltan RESEND_API_KEY o EMAIL_FROM,
// no se envía nada y la función devuelve false, así la app sigue funcionando sin email.
export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
// Avisos internos para el equipo (comentarios): alcanza con RESEND_API_KEY. Sin dominio propio se envía
// desde onboarding@resend.dev, que Resend solo entrega al email con el que se creó la cuenta.
export const adminEmailEnabled = () => Boolean(process.env.RESEND_API_KEY);
const ADMIN_FROM = 'NIDAPP <onboarding@resend.dev>';

export async function sendEmail({ to, subject, html, text, admin = false }: { to: string; subject: string; html: string; text: string; admin?: boolean }) {
  if (!(admin ? adminEmailEnabled() : emailEnabled())) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || ADMIN_FROM, to: [to], subject, html, text }),
  });
  if (!r.ok) console.error('resend', r.status, await r.text());
  return r.ok;
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
