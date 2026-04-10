import express from 'express';
import { body, param } from 'express-validator';
import * as authController from '../controllers/authController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  forgotPasswordEmailLimiter,
  forgotPasswordIpLimiter,
  resetPasswordIpLimiter,
} from '../middleware/rateLimiters.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = express.Router();

const normalizeEmail = (value) => String(value).trim().toLowerCase();

const passwordRules = (fieldName, label = 'Password') =>
  body(fieldName)
    .isString().withMessage(`${label} is required`)
    .isLength({ min: 8 }).withMessage(`${label} must be at least 8 characters long`)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
    .withMessage(`${label} must include uppercase, lowercase, and a number`);

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email required').customSanitizer(normalizeEmail),
    passwordRules('password'),
    body('organizationName').trim().notEmpty().withMessage('Organization name is required'),
  ],
  validateRequest,
  authController.register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required').customSanitizer(normalizeEmail),
    body('password').isString().notEmpty().withMessage('Password is required'),
  ],
  validateRequest,
  authController.login
);

router.post(
  '/forgot-password',
  forgotPasswordIpLimiter,
  forgotPasswordEmailLimiter,
  [
    body('email').isEmail().withMessage('Valid email required').customSanitizer(normalizeEmail),
  ],
  validateRequest,
  authController.forgotPassword
);

router.post(
  '/reset-password',
  resetPasswordIpLimiter,
  [
    body('token')
      .trim()
      .isLength({ min: 64, max: 64 }).withMessage('Reset token is invalid')
      .matches(/^[a-f0-9]+$/i).withMessage('Reset token is invalid'),
    passwordRules('newPassword', 'New password'),
    body('confirmPassword')
      .custom((value, { req }) => value === req.body.newPassword)
      .withMessage('Passwords do not match'),
  ],
  validateRequest,
  authController.resetPassword
);

router.get('/me', authenticate, authController.me);

router.post(
  '/invite',
  authenticate,
  requireRole('admin'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email required').customSanitizer(normalizeEmail),
    body('role').isIn(['manager', 'staff']).withMessage('Role must be manager or staff'),
    passwordRules('password', 'Temporary password'),
  ],
  validateRequest,
  authController.invite
);

router.get('/team', authenticate, requireRole('admin', 'manager'), authController.team);

router.patch(
  '/reactivate/:id',
  authenticate,
  requireRole('admin'),
  [param('id').isUUID().withMessage('Valid user ID required')],
  validateRequest,
  authController.reactivate
);

router.patch(
  '/deactivate/:id',
  authenticate,
  requireRole('admin'),
  [param('id').isUUID().withMessage('Valid user ID required')],
  validateRequest,
  authController.deactivate
);

router.delete(
  '/organization',
  authenticate,
  requireRole('admin'),
  authController.removeOrganization
);

export default router;
