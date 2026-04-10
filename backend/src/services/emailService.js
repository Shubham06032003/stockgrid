import nodemailer from 'nodemailer';
import { env, isSmtpConfigured } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';
import { buildPasswordResetEmail } from '../utils/emailTemplates.js';

let transporter;

function getTransporter() {
  if (!isSmtpConfigured()) {
    throw new ApiError('Password reset email service is not configured.', 503);
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    });
  }

  return transporter;
}

export function assertEmailServiceConfigured() {
  if (!isSmtpConfigured()) {
    throw new ApiError('Password reset email service is not configured.', 503);
  }
}

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
  expiresInMinutes,
}) {
  const mailer = getTransporter();
  const { subject, text, html } = buildPasswordResetEmail({
    appName: env.appName,
    recipientName: name,
    resetUrl,
    expiresInMinutes,
  });

  await mailer.sendMail({
    from: `"${env.mailFromName}" <${env.mailFromEmail}>`,
    to,
    subject,
    text,
    html,
  });
}
