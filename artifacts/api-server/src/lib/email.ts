import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY not set — skipping email');
    return;
  }
  try {
    await resend.emails.send({
      from: 'مُحكم ERP <noreply@muhkampro.com>',
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('[Email] Failed to send:', err);
  }
}
