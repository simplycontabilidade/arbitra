export type Plan = 'free' | 'pro' | 'business' | 'enterprise';
export type ImportRegime = 'remessa_conforme' | 'formal';
export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  officeId?: string;
  plan: Plan;
  trialEndsAt?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  defaultImportRegime: ImportRegime;
  defaultEntryPort: string;
  defaultTtd409: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  invitedAt: string;
  acceptedAt?: string;
}

export interface WorkspacePreferences {
  workspaceId: string;
  activeCategories: string[];
  notificationChannels: {
    email: boolean;
    whatsapp: boolean;
    telegram: boolean;
  };
}

export interface Category {
  id: string;
  slug: string;
  namePt: string;
  nameZh?: string;
  nameEn?: string;
  defaultNcmPrefix?: string;
  matchingPromptTemplate?: string;
  benchmarkMarginMin?: number;
  benchmarkMarginTarget?: number;
  regulatoryAlerts: Record<string, unknown>;
  mlCategoryId?: string;
  isActive: boolean;
}
