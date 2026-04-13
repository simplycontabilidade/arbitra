-- Habilita RLS em todas as tabelas multi-tenant
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alibaba_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_monthly ENABLE ROW LEVEL SECURITY;

-- Função helper: verifica se usuário é membro do workspace
CREATE OR REPLACE FUNCTION public.is_workspace_member(workspace_uuid uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = workspace_uuid
      AND user_id = auth.uid()
      AND accepted_at IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.workspace_role(workspace_uuid uuid)
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT role FROM public.workspace_members
  WHERE workspace_id = workspace_uuid AND user_id = auth.uid()
  LIMIT 1;
$$;

-- USERS: cada um vê o próprio perfil
CREATE POLICY users_self ON public.users FOR ALL USING (id = auth.uid());

-- WORKSPACES: membros podem ver, owners/admins podem editar
CREATE POLICY workspaces_read ON public.workspaces FOR SELECT USING (public.is_workspace_member(id));
CREATE POLICY workspaces_update ON public.workspaces FOR UPDATE USING (public.workspace_role(id) IN ('owner','admin'));
CREATE POLICY workspaces_insert ON public.workspaces FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- WORKSPACE_MEMBERS
CREATE POLICY members_read ON public.workspace_members FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY members_insert ON public.workspace_members FOR INSERT WITH CHECK (
  public.workspace_role(workspace_id) IN ('owner','admin') OR user_id = auth.uid()
);
CREATE POLICY members_update ON public.workspace_members FOR UPDATE USING (public.workspace_role(workspace_id) IN ('owner','admin'));
CREATE POLICY members_delete ON public.workspace_members FOR DELETE USING (public.workspace_role(workspace_id) IN ('owner','admin'));

-- WORKSPACE_PREFERENCES
CREATE POLICY prefs_read ON public.workspace_preferences FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY prefs_write ON public.workspace_preferences FOR ALL USING (public.workspace_role(workspace_id) IN ('owner','admin'));

-- SEARCHES, MATCHES, WATCHLISTS, etc — padrão "membros do workspace"
CREATE POLICY searches_rw ON public.searches FOR ALL USING (public.is_workspace_member(workspace_id));
CREATE POLICY matches_rw ON public.product_matches FOR ALL USING (public.is_workspace_member(workspace_id));
CREATE POLICY watchlists_rw ON public.watchlists FOR ALL USING (public.is_workspace_member(workspace_id));
CREATE POLICY price_history_read ON public.price_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.watchlists w WHERE w.id = watchlist_id AND public.is_workspace_member(w.workspace_id))
);
CREATE POLICY alerts_rw ON public.alerts FOR ALL USING (public.is_workspace_member(workspace_id));
CREATE POLICY alibaba_tokens_rw ON public.alibaba_tokens FOR ALL USING (public.workspace_role(workspace_id) IN ('owner','admin'));
CREATE POLICY usage_events_read ON public.usage_events FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY usage_monthly_read ON public.usage_monthly FOR SELECT USING (public.is_workspace_member(workspace_id));

-- Tabelas públicas de referência: leitura liberada pra autenticados
CREATE POLICY categories_read ON public.categories FOR SELECT USING (auth.uid() IS NOT NULL);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY tax_rates_read ON public.tax_rates FOR SELECT USING (true);
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY exchange_rates_read ON public.exchange_rates FOR SELECT USING (true);
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Tabelas de cache: sem RLS (acesso apenas via service role)
-- products_china, products_ml, search_cache, api_credentials, oauth_states ficam sem RLS
-- pois são acessadas apenas pelas Edge Functions com service_role_key

-- OFFICES
CREATE POLICY offices_read ON public.offices FOR SELECT USING (
  owner_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.workspaces w
    JOIN public.workspace_members wm ON wm.workspace_id = w.id
    WHERE w.office_id = offices.id AND wm.user_id = auth.uid()
  )
);
CREATE POLICY offices_write ON public.offices FOR ALL USING (owner_id = auth.uid());
