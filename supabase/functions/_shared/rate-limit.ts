import { supabaseAdmin } from './supabase-client.ts';

interface PlanLimits {
  searchesPerMonth: number;
}

const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: { searchesPerMonth: 20 },
  pro: { searchesPerMonth: 500 },
  business: { searchesPerMonth: 2000 },
  enterprise: { searchesPerMonth: 999999 },
};

interface UsageCheckResult {
  allowed: boolean;
  remaining: number;
  plan: string;
  limit: number;
  used: number;
}

export async function checkAndIncrementUsage(
  workspaceId: string,
  eventType: string,
  userId?: string,
): Promise<UsageCheckResult> {
  // Busca plano do workspace
  const { data: workspace } = await supabaseAdmin
    .from('workspaces')
    .select('plan, trial_ends_at')
    .eq('id', workspaceId)
    .single();

  if (!workspace) {
    return { allowed: false, remaining: 0, plan: 'unknown', limit: 0, used: 0 };
  }

  // Verifica se trial expirou
  let effectivePlan = workspace.plan;
  if (workspace.trial_ends_at && new Date(workspace.trial_ends_at) < new Date()) {
    // Trial expirou e não tem assinatura — volta pro free
    if (effectivePlan === 'pro') {
      effectivePlan = 'free';
    }
  }

  const limits = PLAN_LIMITS[effectivePlan] ?? PLAN_LIMITS['free']!;

  // Busca uso do mês atual
  const yearMonth = new Date().toISOString().slice(0, 7); // '2026-04'
  const { data: usage } = await supabaseAdmin
    .from('usage_monthly')
    .select('searches_count')
    .eq('workspace_id', workspaceId)
    .eq('year_month', yearMonth)
    .single();

  const used = usage?.searches_count ?? 0;
  const remaining = Math.max(0, limits.searchesPerMonth - used);
  const allowed = used < limits.searchesPerMonth;

  if (allowed) {
    // Incrementa uso
    await supabaseAdmin.from('usage_events').insert({
      workspace_id: workspaceId,
      user_id: userId,
      event_type: eventType,
    });

    // Upsert mensal
    await supabaseAdmin.from('usage_monthly').upsert(
      {
        workspace_id: workspaceId,
        year_month: yearMonth,
        searches_count: used + 1,
      },
      { onConflict: 'workspace_id,year_month' },
    );
  }

  return {
    allowed,
    remaining: allowed ? remaining - 1 : 0,
    plan: effectivePlan,
    limit: limits.searchesPerMonth,
    used: used + (allowed ? 1 : 0),
  };
}
