import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInteger(process.env.PORT, 5000),
  appName: process.env.APP_NAME || 'StockGrid',
  frontendUrl,
  resetPasswordPath: process.env.RESET_PASSWORD_PATH || '/reset-password',
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseServiceKey: requireEnv('SUPABASE_SERVICE_KEY'),
  bcryptRounds: parseInteger(process.env.BCRYPT_ROUNDS, 12),
  passwordResetTokenTtlMinutes: clamp(parseInteger(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES, 15), 15, 30),
  passwordResetRequestMaxPerHour: parseInteger(process.env.PASSWORD_RESET_REQUEST_MAX_PER_HOUR, 3),
  smtpHost: process.env.SMTP_HOST?.trim() || '',
  smtpPort: parseInteger(process.env.SMTP_PORT, 587),
  smtpSecure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  smtpUser: process.env.SMTP_USER?.trim() || '',
  smtpPass: process.env.SMTP_PASS || '',
  mailFromEmail: process.env.MAIL_FROM_EMAIL?.trim() || '',
  mailFromName: process.env.MAIL_FROM_NAME?.trim() || 'StockGrid',
});

export function isSmtpConfigured() {
  return Boolean(
    env.smtpHost &&
    env.smtpPort &&
    env.smtpUser &&
    env.smtpPass &&
    env.mailFromEmail
  );
}
