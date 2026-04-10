function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildPasswordResetEmail({
  appName,
  recipientName,
  resetUrl,
  expiresInMinutes,
}) {
  const safeAppName = escapeHtml(appName);
  const safeName = escapeHtml(recipientName || 'there');
  const safeResetUrl = escapeHtml(resetUrl);

  const subject = 'Reset Your Password';
  const text = [
    `Hi ${recipientName || 'there'},`,
    '',
    `We received a request to reset your password for ${appName}.`,
    `This link will expire in ${expiresInMinutes} minutes.`,
    '',
    `Reset your password: ${resetUrl}`,
    '',
    'If you didn’t request this, ignore this email.',
  ].join('\n');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
                <tr>
                  <td style="padding:32px 32px 24px;background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#ffffff;">
                    <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;opacity:0.8;">${safeAppName}</p>
                    <h1 style="margin:0;font-size:28px;line-height:1.2;">Reset your password</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;">
                    <p style="margin:0 0 16px;font-size:16px;">Hi ${safeName},</p>
                    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">
                      We received a request to reset your password. Use the secure button below to choose a new one.
                    </p>
                    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#475569;">
                      This link expires in <strong>${expiresInMinutes} minutes</strong> and can only be used once.
                    </p>
                    <p style="margin:0 0 28px;">
                      <a
                        href="${safeResetUrl}"
                        style="display:inline-block;padding:14px 22px;border-radius:12px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;"
                      >
                        Reset Password
                      </a>
                    </p>
                    <p style="margin:0 0 10px;font-size:13px;color:#64748b;">If the button doesn’t work, use this link instead:</p>
                    <p style="margin:0 0 24px;font-size:13px;line-height:1.7;word-break:break-all;">
                      <a href="${safeResetUrl}" style="color:#2563eb;text-decoration:none;">${safeResetUrl}</a>
                    </p>
                    <div style="padding:16px 18px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;">
                      <p style="margin:0;font-size:13px;line-height:1.7;color:#475569;">
                        If you didn’t request this, ignore this email. Your current password will remain unchanged.
                      </p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return { subject, text, html };
}
