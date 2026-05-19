import { z } from 'zod';
import type { MemberRole } from '$lib/types/enums';

export const memberRoleEnum = z.enum(['OWNER', 'COLLABORATOR'] as [MemberRole, ...MemberRole[]]);

export const emailSchema = z.string().email().trim().toLowerCase();
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(256);
export const nameSchema = z.string().min(1).max(120);

export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1)
});

export const signupSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    name: nameSchema,
    workspaceName: z.string().min(1).max(80).default('Our case'),
    inviteToken: z.string().optional()
});

export const inviteSchema = z.object({
    email: emailSchema,
    role: memberRoleEnum.default('COLLABORATOR')
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
