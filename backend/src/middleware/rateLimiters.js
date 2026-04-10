import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { hashToken } from '../utils/crypto.js';

function buildJsonRateLimiter(options) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: options.message?.error || 'Too many requests. Please try again later.',
      });
    },
    ...options,
  });
}

function buildEmailKey(req) {
  const email = typeof req.body?.email === 'string'
    ? req.body.email.trim().toLowerCase()
    : req.ip;

  return `forgot-password:${hashToken(email)}`;
}

export const apiLimiter = buildJsonRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests. Please slow down.' },
});

export const aiLimiter = buildJsonRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many AI requests, please slow down.' },
});

export const forgotPasswordIpLimiter = buildJsonRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: env.passwordResetRequestMaxPerHour,
  message: { error: 'Too many password reset requests. Please try again later.' },
});

export const forgotPasswordEmailLimiter = buildJsonRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: env.passwordResetRequestMaxPerHour,
  keyGenerator: buildEmailKey,
  message: { error: 'Too many password reset requests. Please try again later.' },
});

export const resetPasswordIpLimiter = buildJsonRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many password reset attempts. Please try again later.' },
});
