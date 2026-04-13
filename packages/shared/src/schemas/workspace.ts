import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const onboardingSchema = z.object({
  activeCategories: z.array(z.string()).default([]),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email('E-mail inválido'),
  role: z.enum(['admin', 'member']),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const workspaceSettingsSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  defaultImportRegime: z.enum(['remessa_conforme', 'formal']).optional(),
  defaultEntryPort: z.string().max(2).optional(),
  defaultTtd409: z.boolean().optional(),
});

export type WorkspaceSettingsInput = z.infer<typeof workspaceSettingsSchema>;
