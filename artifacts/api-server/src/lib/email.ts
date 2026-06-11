import { Resend } from 'resend';
import { logger } from './logger';

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
    logger.warn('[Email] RESEND_API_KEY not set — skipping email');
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
    logger.error({ err }, '[Email] Failed to send');
  }
}
