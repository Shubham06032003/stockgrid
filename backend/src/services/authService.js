import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';
import { hashPassword, verifyPassword } from '../utils/passwords.js';

const SAFE_USER_FIELDS = 'id, name, email, role, organization_id, is_active, created_at, updated_at';
const USER_WITH_PASSWORD_FIELDS = `${SAFE_USER_FIELDS}, password_hash`;

function signAuthToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      organizationId: user.organization_id,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const { password_hash, ...safeUser } = user;
  return safeUser;
}

export async function findUserByEmail(email, { includePasswordHash = false } = {}) {
  const { data, error } = await supabase
    .from('users')
    .select(includePasswordHash ? USER_WITH_PASSWORD_FIELDS : SAFE_USER_FIELDS)
    .eq('email', email)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function findUserById(userId, { includePasswordHash = false } = {}) {
  const { data, error } = await supabase
    .from('users')
    .select(includePasswordHash ? USER_WITH_PASSWORD_FIELDS : SAFE_USER_FIELDS)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function registerUser({ name, email, password, organizationName }) {
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw new ApiError('Email already registered', 409);
  }

  const organizationId = uuidv4();
  const userId = uuidv4();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);

  const { error: organizationError } = await supabase
    .from('organizations')
    .insert({
      id: organizationId,
      name: organizationName,
      plan: 'starter',
      created_at: now,
      updated_at: now,
    });

  if (organizationError) {
    throw organizationError;
  }

  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        id: userId,
        name,
        email,
        password_hash: passwordHash,
        role: 'admin',
        organization_id: organizationId,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .select(SAFE_USER_FIELDS)
      .single();

    if (userError) {
      throw userError;
    }

    return {
      token: signAuthToken(user),
      user,
    };
  } catch (error) {
    await supabase.from('organizations').delete().eq('id', organizationId);
    throw error;
  }
}

export async function loginUser({ email, password }) {
  const user = await findUserByEmail(email, { includePasswordHash: true });

  if (!user) {
    throw new ApiError('Invalid credentials', 401);
  }

  if (!user.is_active) {
    throw new ApiError('Account deactivated', 403);
  }

  const isPasswordValid = await verifyPassword(password, user.password_hash);
  if (!isPasswordValid) {
    throw new ApiError('Invalid credentials', 401);
  }

  return {
    token: signAuthToken(user),
    user: sanitizeUser(user),
  };
}

export async function inviteTeamMember({
  organizationId,
  name,
  email,
  role,
  password,
}) {
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw new ApiError('Email already registered', 409);
  }

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);
  const userId = uuidv4();

  const { data: user, error } = await supabase
    .from('users')
    .insert({
      id: userId,
      name,
      email,
      password_hash: passwordHash,
      role,
      organization_id: organizationId,
      is_active: true,
      created_at: now,
      updated_at: now,
    })
    .select(SAFE_USER_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  return user;
}

export async function listTeamMembers(organizationId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, is_active, updated_at')
    .eq('organization_id', organizationId)
    .order('name');

  if (error) {
    throw error;
  }

  return (data || []).map((member) => ({
    ...member,
    deactivated_at: member.is_active ? null : member.updated_at || null,
  }));
}

export async function reactivateTeamMember({ organizationId, targetUserId }) {
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id, is_active, updated_at')
    .eq('id', targetUserId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  if (user.is_active) {
    throw new ApiError('User is already active', 400);
  }

  if (user.updated_at) {
    const daysSinceDeactivation = (Date.now() - new Date(user.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDeactivation > 45) {
      throw new ApiError('Reactivation window has expired for this member', 403);
    }
  }

  const { data, error } = await supabase
    .from('users')
    .update({
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetUserId)
    .eq('organization_id', organizationId)
    .select(SAFE_USER_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deactivateTeamMember({
  organizationId,
  actorUserId,
  targetUserId,
}) {
  if (actorUserId === targetUserId) {
    throw new ApiError('You cannot deactivate your own account', 400);
  }

  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id, is_active')
    .eq('id', targetUserId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  if (!user.is_active) {
    throw new ApiError('User is already deactivated', 400);
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('users')
    .update({
      is_active: false,
      updated_at: now,
    })
    .eq('id', targetUserId)
    .eq('organization_id', organizationId)
    .select(SAFE_USER_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteOrganization(organizationId) {
  const { data: organization, error: fetchError } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', organizationId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!organization) {
    throw new ApiError('Organization not found', 404);
  }

  const { error } = await supabase
    .from('organizations')
    .delete()
    .eq('id', organizationId);

  if (error) {
    throw error;
  }
}
