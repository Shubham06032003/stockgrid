import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';
import { generateSecureToken, hashToken } from '../utils/crypto.js';
import { hashPassword, verifyPassword } from '../utils/passwords.js';
import { assertEmailServiceConfigured, sendPasswordResetEmail } from './emailService.js';
import { findUserByEmail } from './authService.js';

export const PASSWORD_RESET_REQUEST_RESPONSE =
  'If an account exists for this email, a reset link has been sent.';

const INVALID_RESET_TOKEN_MESSAGE = 'Reset token is invalid or has expired.';

function buildResetUrl(rawToken) {
  return `${env.frontendUrl}${env.resetPasswordPath}?token=${encodeURIComponent(rawToken)}`;
}

async function purgeExpiredPasswordResetTokens() {
  const { error } = await supabase
    .from('password_reset_tokens')
    .delete()
    .lte('expires_at', new Date().toISOString());

  if (error) {
    throw error;
  }
}

async function replaceUserPasswordResetToken(userId, tokenHash, expiresAt) {
  const { error: deleteError } = await supabase
    .from('password_reset_tokens')
    .delete()
    .eq('user_id', userId);

  if (deleteError) {
    throw deleteError;
  }

  const { data, error } = await supabase
    .from('password_reset_tokens')
    .insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function requestPasswordReset(email) {
  assertEmailServiceConfigured();
  await purgeExpiredPasswordResetTokens();

  const user = await findUserByEmail(email);
  if (!user || !user.is_active) {
    return PASSWORD_RESET_REQUEST_RESPONSE;
  }

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + env.passwordResetTokenTtlMinutes * 60 * 1000
  ).toISOString();

  const tokenRecord = await replaceUserPasswordResetToken(user.id, tokenHash, expiresAt);
  const resetUrl = buildResetUrl(rawToken);

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      expiresInMinutes: env.passwordResetTokenTtlMinutes,
    });
  } catch (error) {
    console.error('Password reset email delivery failed:', error);
    await supabase.from('password_reset_tokens').delete().eq('id', tokenRecord.id);
  }

  return PASSWORD_RESET_REQUEST_RESPONSE;
}

export async function resetPasswordWithToken(rawToken, newPassword) {
  await purgeExpiredPasswordResetTokens();

  const tokenHash = hashToken(rawToken);
  const now = new Date().toISOString();

  const { data: resetToken, error: tokenLookupError } = await supabase
    .from('password_reset_tokens')
    .select('id, user_id, expires_at')
    .eq('token_hash', tokenHash)
    .gt('expires_at', now)
    .maybeSingle();

  if (tokenLookupError) {
    throw tokenLookupError;
  }

  if (!resetToken) {
    throw new ApiError(INVALID_RESET_TOKEN_MESSAGE, 400);
  }

  const { data: user, error: userLookupError } = await supabase
    .from('users')
    .select('id, is_active, password_hash')
    .eq('id', resetToken.user_id)
    .maybeSingle();

  if (userLookupError) {
    throw userLookupError;
  }

  if (!user) {
    throw new ApiError(INVALID_RESET_TOKEN_MESSAGE, 400);
  }

  if (!user.is_active) {
    throw new ApiError('Account deactivated. Contact your administrator.', 403);
  }

  const isSamePassword = await verifyPassword(newPassword, user.password_hash);
  if (isSamePassword) {
    throw new ApiError('Choose a password you have not used recently.', 400);
  }

  // Delete first so the token cannot be replayed if the user retries the request.
  const { data: deletedToken, error: deleteError } = await supabase
    .from('password_reset_tokens')
    .delete()
    .eq('id', resetToken.id)
    .eq('token_hash', tokenHash)
    .select('id')
    .maybeSingle();

  if (deleteError) {
    throw deleteError;
  }

  if (!deletedToken) {
    throw new ApiError(INVALID_RESET_TOKEN_MESSAGE, 400);
  }

  const passwordHash = await hashPassword(newPassword);
  const { error: updateError } = await supabase
    .from('users')
    .update({
      password_hash: passwordHash,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (updateError) {
    throw new ApiError('Unable to update password. Please request a new reset link.', 500);
  }

  const { error: cleanupError } = await supabase
    .from('password_reset_tokens')
    .delete()
    .eq('user_id', user.id);

  if (cleanupError) {
    throw cleanupError;
  }

  return {
    message: 'Password updated successfully. You can sign in now.',
  };
}
