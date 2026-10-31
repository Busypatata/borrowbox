import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** In-memory outbox. Only populated when SMTP is not configured (dev/test); never in production. */
const outbox: (OutboundEmail & { sentAt: Date })[] = [];
export const getOutbox = () => outbox;
export const clearOutbox = () => {
  outbox.length = 0;
};

let transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (!env.smtpConfigured) return null;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export type SendResult = { delivered: boolean; reason?: 'NOT_CONFIGURED' | 'FAILED' };

/**
 * Sends an email. Never throws: callers must not let email failures break core flows.
 * Returns whether the message was really handed to a provider.
 */
export async function sendEmail(mail: OutboundEmail): Promise<SendResult> {
  const t = getTransporter();
  if (!t) {
    if (env.isProd) {
      logger.warn({ to: '[redacted]' }, 'Email provider not configured; email not sent');
      return { delivered: false, reason: 'NOT_CONFIGURED' };
    }
    outbox.push({ ...mail, sentAt: new Date() });
    if (outbox.length > 200) outbox.shift();
    if (env.NODE_ENV === 'development') {
      // Development convenience only: SMTP is not configured, so show the message locally.
      // eslint-disable-next-line no-console
      console.log(`\n[dev email — SMTP not configured]\nTo: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}\n`);
    }
    return { delivered: false, reason: 'NOT_CONFIGURED' };
  }
  try {
    await t.sendMail({ from: env.EMAIL_FROM, ...mail });
    return { delivered: true };
  } catch (err) {
    logger.error({ err }, 'Failed to send email');
    return { delivered: false, reason: 'FAILED' };
  }
}

const layout = (title: string, body: string) => `<!doctype html><html><body style="margin:0;background:#FAF6F5;font-family:Inter,Arial,sans-serif;color:#30282B">
<div style="max-width:520px;margin:32px auto;background:#fff;border:1px solid #EAD7D9;border-radius:16px;padding:32px">
<div style="font-weight:700;font-size:20px;color:#773B49;margin-bottom:16px">BorrowBox</div>
<h1 style="font-size:20px;margin:0 0 12px">${title}</h1>${body}
<p style="color:#6b6064;font-size:12px;margin-top:28px">Borrow more. Buy less.</p></div></body></html>`;

const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${href}" style="background:#773B49;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${label}</a></p>
<p style="font-size:12px;color:#6b6064">If the button does not work, paste this link into your browser:<br>${href}</p>`;

export const emails = {
  verification(to: string, name: string, token: string): OutboundEmail {
    const link = `${env.CLIENT_URL}/verify-email?token=${encodeURIComponent(token)}`;
    return {
      to,
      subject: 'Verify your BorrowBox email',
      text: `Hi ${name},\n\nConfirm your email to start borrowing and lending:\n${link}\n\nThis link expires in 24 hours.`,
      html: layout('Confirm your email', `<p>Hi ${escapeHtml(name)}, confirm your email to start borrowing and lending.</p>${button(link, 'Verify email')}<p style="font-size:13px">This link expires in 24 hours.</p>`),
    };
  },
  alreadyRegistered(to: string, name: string): OutboundEmail {
    const link = `${env.CLIENT_URL}/forgot-password`;
    return {
      to,
      subject: 'You already have a BorrowBox account',
      text: `Hi ${name},\n\nSomeone tried to create a BorrowBox account with this email. You already have one — sign in, or reset your password here:\n${link}\n\nIf this wasn't you, you can ignore this message.`,
      html: layout('You already have an account', `<p>Hi ${escapeHtml(name)}, someone tried to sign up with this email. You already have an account.</p>${button(link, 'Reset password')}<p style="font-size:13px">If this wasn't you, ignore this message.</p>`),
    };
  },
  passwordReset(to: string, name: string, token: string): OutboundEmail {
    const link = `${env.CLIENT_URL}/reset-password?token=${encodeURIComponent(token)}`;
    return {
      to,
      subject: 'Reset your BorrowBox password',
      text: `Hi ${name},\n\nReset your password using this link (valid for 30 minutes):\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
      html: layout('Reset your password', `<p>Hi ${escapeHtml(name)}, use the button below to choose a new password. The link is valid for 30 minutes.</p>${button(link, 'Reset password')}<p style="font-size:13px">If you didn't ask for this, ignore this email.</p>`),
    };
  },
  security(to: string, name: string, what: string): OutboundEmail {
    return {
      to,
      subject: 'Security notice from BorrowBox',
      text: `Hi ${name},\n\n${what}\n\nIf this wasn't you, reset your password immediately: ${env.CLIENT_URL}/forgot-password`,
      html: layout('Security notice', `<p>Hi ${escapeHtml(name)},</p><p>${escapeHtml(what)}</p><p style="font-size:13px">If this wasn't you, reset your password immediately.</p>`),
    };
  },
  notification(to: string, name: string, title: string, body: string): OutboundEmail {
    return {
      to,
      subject: title,
      text: `Hi ${name},\n\n${body}\n\nOpen BorrowBox: ${env.CLIENT_URL}/notifications`,
      html: layout(escapeHtml(title), `<p>${escapeHtml(body)}</p>${button(`${env.CLIENT_URL}/notifications`, 'Open BorrowBox')}`),
    };
  },
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
