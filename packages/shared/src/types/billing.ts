import type { Plan } from './workspace';

export interface PlanLimits {
  searchesPerMonth: number;
  watchlistItems: number;
  maxUsers: number;
  priceHistoryDays: number;
  advancedSimulator: boolean;
  emailAlerts: boolean;
  whatsappAlerts: boolean;
  excelExport: boolean;
  apiAccess: boolean;
  maxWorkspaces: number;
  cacheTtlHours: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    searchesPerMonth: 20,
    watchlistItems: 3,
    maxUsers: 1,
    priceHistoryDays: 7,
    advancedSimulator: false,
    emailAlerts: true,
    whatsappAlerts: false,
    excelExport: false,
    apiAccess: false,
    maxWorkspaces: 1,
    cacheTtlHours: 168, // 7 dias
  },
  pro: {
    searchesPerMonth: 500,
    watchlistItems: 50,
    maxUsers: 1,
    priceHistoryDays: 90,
    advancedSimulator: true,
    emailAlerts: true,
    whatsappAlerts: false,
    excelExport: true,
    apiAccess: false,
    maxWorkspaces: 1,
    cacheTtlHours: 24,
  },
  business: {
    searchesPerMonth: 2000,
    watchlistItems: Infinity,
    maxUsers: 5,
    priceHistoryDays: 730, // 2 anos
    advancedSimulator: true,
    emailAlerts: true,
    whatsappAlerts: true,
    excelExport: true,
    apiAccess: true,
    maxWorkspaces: 3,
    cacheTtlHours: 24,
  },
  enterprise: {
    searchesPerMonth: Infinity,
    watchlistItems: Infinity,
    maxUsers: Infinity,
    priceHistoryDays: 730,
    advancedSimulator: true,
    emailAlerts: true,
    whatsappAlerts: true,
    excelExport: true,
    apiAccess: true,
    maxWorkspaces: Infinity,
    cacheTtlHours: 24,
  },
};

export interface UsageEvent {
  id: string;
  workspaceId: string;
  userId?: string;
  eventType: 'search' | 'match' | 'watchlist_check';
  costUsd: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface UsageMonthly {
  workspaceId: string;
  yearMonth: string;
  searchesCount: number;
  matchesCount: number;
  totalCostUsd: number;
}
