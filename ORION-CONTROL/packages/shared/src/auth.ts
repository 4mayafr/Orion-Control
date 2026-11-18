/**
 * Authentication and administration schemas shared by the website's forms and
 * API routes. Passwords are hashed with bcrypt on the server; these schemas
 * only describe shape and strength requirements.
 */

import { z } from 'zod';
import { PERMISSIONS, ROLES } from './permissions.js';
import { API_KEY_SCOPES } from './api.js';

export const PASSWORD_MIN_LENGTH = 10;

export const emailSchema = z
  .string()
  .trim()
  .min(3, 'Email is required')
  .max(200)
  .email('Enter a valid email address')
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(200, 'Password is too long');

export const nameSchema = z.string().trim().min(2, 'Name is too short').max(120);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const setupSchema = z.object({
  token: z.string().min(1, 'Setup token is required').max(500),
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type SetupInput = z.infer<typeof setupSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(200),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const operatorCreateSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(ROLES),
});
export type OperatorCreateInput = z.infer<typeof operatorCreateSchema>;

export const permissionOverrideSchema = z.object({
  permission: z.enum(PERMISSIONS),
  granted: z.boolean(),
});

export const operatorUpdateSchema = z
  .object({
    name: nameSchema.optional(),
    role: z.enum(ROLES).optional(),
    status: z.enum(['active', 'suspended']).optional(),
    password: passwordSchema.optional(),
    permissions: z.array(permissionOverrideSchema).max(PERMISSIONS.length).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });
export type OperatorUpdateInput = z.infer<typeof operatorUpdateSchema>;

export const apiKeyCreateSchema = z.object({
  name: z.string().trim().min(2, 'Give the key a name').max(80),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1, 'Pick at least one scope').max(API_KEY_SCOPES.length),
});
export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateSchema>;

export const loginRateLimit = {
  windowMs: 5 * 60 * 1000,
  maxAttempts: 8,
} as const;
