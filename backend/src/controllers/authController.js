import { asyncHandler } from '../utils/asyncHandler.js';
import {
  deactivateTeamMember,
  deleteOrganization,
  inviteTeamMember,
  listTeamMembers,
  loginUser,
  reactivateTeamMember,
  registerUser,
} from '../services/authService.js';
import {
  PASSWORD_RESET_REQUEST_RESPONSE,
  requestPasswordReset,
  resetPasswordWithToken,
} from '../services/passwordResetService.js';

export const register = asyncHandler(async (req, res) => {
  const result = await registerUser(req.validated.body);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req, res) => {
  const result = await loginUser(req.validated.body);
  res.json(result);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.validated.body;
  const message = await requestPasswordReset(email);
  res.json({ message: message || PASSWORD_RESET_REQUEST_RESPONSE });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.validated.body;
  const result = await resetPasswordWithToken(token, newPassword);
  res.json(result);
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

export const invite = asyncHandler(async (req, res) => {
  const user = await inviteTeamMember({
    organizationId: req.user.organization_id,
    ...req.validated.body,
  });

  res.status(201).json({ user });
});

export const team = asyncHandler(async (req, res) => {
  const teamMembers = await listTeamMembers(req.user.organization_id);
  res.json({ team: teamMembers });
});

export const reactivate = asyncHandler(async (req, res) => {
  const user = await reactivateTeamMember({
    organizationId: req.user.organization_id,
    targetUserId: req.validated.params.id,
  });

  res.json({ user });
});

export const deactivate = asyncHandler(async (req, res) => {
  const user = await deactivateTeamMember({
    organizationId: req.user.organization_id,
    actorUserId: req.user.id,
    targetUserId: req.validated.params.id,
  });

  res.json({ user });
});

export const removeOrganization = asyncHandler(async (req, res) => {
  await deleteOrganization(req.user.organization_id);
  res.json({ message: 'Workspace deleted successfully and all data purged' });
});
