-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- busca fuzzy

-- ============================================================
-- USERS & WORKSPACES (multi-tenancy core)
-- ============================================================

CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  phone text,
  is_staff boolean DEFAULT false,
  consent_given_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text,
  owner_id uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  office_id uuid REFERENCES public.offices(id),
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','business','enterprise')),
  trial_ends_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  default_import_regime text DEFAULT 'remessa_conforme' CHECK (default_import_regime IN ('remessa_conforme','formal')),
  default_entry_port text DEFAULT 'SP',
  default_ttd_409 boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','member')),
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE(workspace_id, user_id)
);

CREATE TABLE public.workspace_preferences (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  active_categories text[] DEFAULT '{}',
  notification_channels jsonb DEFAULT '{"email": true, "whatsapp": false, "telegram": false}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- CATEGORIES (nichos)
-- ============================================================
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name_pt text NOT NULL,
  name_zh text,
  name_en text,
  default_ncm_prefix text,
  matching_prompt_template text,
  benchmark_margin_min numeric(5,2),
  benchmark_margin_target numeric(5,2),
  regulatory_alerts jsonb DEFAULT '{}'::jsonb,
  ml_category_id text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- TAX RATES (alíquotas versionadas)
-- ============================================================
CREATE TABLE public.tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_type text NOT NULL CHECK (tax_type IN ('ii','ipi','pis_imp','cofins_imp','icms','rc_flat')),
  ncm_prefix text,
  state text,
  regime text,
  rate numeric(6,4) NOT NULL,
  fixed_amount numeric(10,2),
  valid_from date NOT NULL,
  valid_until date,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_tax_rates_lookup ON public.tax_rates(tax_type, ncm_prefix, state, regime, valid_from);

CREATE TABLE public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_from text NOT NULL,
  currency_to text NOT NULL DEFAULT 'BRL',
  rate numeric(12,6) NOT NULL,
  source text DEFAULT 'bcb',
  fetched_at timestamptz DEFAULT now()
);

CREATE INDEX idx_exchange_latest ON public.exchange_rates(currency_from, fetched_at DESC);

-- ============================================================
-- PRODUCTS CHINA (cache de resultados das APIs)
-- ============================================================
CREATE TABLE public.products_china (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('1688','alibaba','taobao','tmall','jd','pinduoduo')),
  external_id text NOT NULL,
  title_zh text,
  title_pt text,
  main_image_url text,
  images jsonb DEFAULT '[]'::jsonb,
  price_cny numeric(12,2),
  price_tiers jsonb,
  moq integer,
  currency text DEFAULT 'CNY',
  vendor_id text,
  vendor_name text,
  vendor_verified boolean,
  vendor_years integer,
  vendor_rating numeric(3,2),
  product_url text,
  specs jsonb DEFAULT '{}'::jsonb,
  raw_response jsonb,
  fetched_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  UNIQUE(source, external_id)
);

CREATE INDEX idx_products_china_title ON public.products_china USING gin(title_pt gin_trgm_ops);
CREATE INDEX idx_products_china_source ON public.products_china(source, fetched_at DESC);

-- ============================================================
-- PRODUCTS ML (cache de resultados do Mercado Livre)
-- ============================================================
CREATE TABLE public.products_ml (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ml_id text UNIQUE NOT NULL,
  title text NOT NULL,
  price_brl numeric(12,2) NOT NULL,
  original_price_brl numeric(12,2),
  ml_category_id text,
  condition text,
  sold_quantity integer DEFAULT 0,
  available_quantity integer,
  listing_type text,
  shipping_free boolean,
  seller_id bigint,
  seller_nickname text,
  seller_reputation jsonb,
  main_image_url text,
  permalink text,
  attributes jsonb DEFAULT '{}'::jsonb,
  raw_response jsonb,
  fetched_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX idx_products_ml_title ON public.products_ml USING gin(title gin_trgm_ops);
CREATE INDEX idx_products_ml_category ON public.products_ml(ml_category_id);

-- ============================================================
-- SEARCHES & RESULTS
-- ============================================================
CREATE TABLE public.searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  query text NOT NULL,
  category_slug text REFERENCES public.categories(slug),
  filters jsonb DEFAULT '{}'::jsonb,
  total_results integer DEFAULT 0,
  cost_usd numeric(10,4) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_searches_workspace ON public.searches(workspace_id, created_at DESC);

CREATE TABLE public.product_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id uuid REFERENCES public.searches(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  china_product_id uuid NOT NULL REFERENCES public.products_china(id),
  ml_products jsonb NOT NULL,
  ml_median_price numeric(12,2),
  ml_avg_sold_quantity integer,
  match_confidence numeric(5,2) NOT NULL,
  match_reasoning text,
  ncm_suggested text,
  landed_cost_brl numeric(12,2),
  landed_cost_breakdown jsonb,
  margin_pct numeric(6,2),
  markup_pct numeric(6,2),
  opportunity_score numeric(5,2),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_matches_search ON public.product_matches(search_id, opportunity_score DESC);
CREATE INDEX idx_matches_workspace ON public.product_matches(workspace_id, created_at DESC);

-- ============================================================
-- WATCHLISTS & ALERTS
-- ============================================================
CREATE TABLE public.watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  match_id uuid NOT NULL REFERENCES public.product_matches(id) ON DELETE CASCADE,
  name text,
  alert_threshold_margin numeric(5,2),
  alert_threshold_price_drop numeric(5,2),
  is_paused boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_watchlists_workspace ON public.watchlists(workspace_id, is_paused);

CREATE TABLE public.price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id uuid NOT NULL REFERENCES public.watchlists(id) ON DELETE CASCADE,
  china_price_cny numeric(12,2),
  ml_median_price_brl numeric(12,2),
  landed_cost_brl numeric(12,2),
  margin_pct numeric(6,2),
  snapshot_at timestamptz DEFAULT now()
);

CREATE INDEX idx_price_history_watchlist ON public.price_history(watchlist_id, snapshot_at DESC);

CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  watchlist_id uuid REFERENCES public.watchlists(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('margin_crossed','price_drop','price_rise','new_opportunity')),
  message text NOT NULL,
  payload jsonb,
  read_at timestamptz,
  sent_channels jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_alerts_workspace ON public.alerts(workspace_id, created_at DESC);

-- ============================================================
-- OAUTH & CREDENTIALS
-- ============================================================
CREATE TABLE public.oauth_states (
  state text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  provider text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.alibaba_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  aliid text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id)
);

-- ============================================================
-- USAGE & BILLING
-- ============================================================
CREATE TABLE public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id),
  event_type text NOT NULL,
  cost_usd numeric(10,4) DEFAULT 0,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_usage_workspace_month ON public.usage_events(workspace_id, created_at DESC);

CREATE TABLE public.usage_monthly (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  year_month text NOT NULL,
  searches_count integer DEFAULT 0,
  matches_count integer DEFAULT 0,
  total_cost_usd numeric(10,4) DEFAULT 0,
  PRIMARY KEY (workspace_id, year_month)
);

-- ============================================================
-- API CREDENTIALS (controle admin de providers)
-- ============================================================
CREATE TABLE public.api_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  credentials jsonb NOT NULL,
  is_active boolean DEFAULT true,
  priority integer DEFAULT 100,
  rate_limit_per_minute integer,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- CACHE
-- ============================================================
CREATE TABLE public.search_cache (
  cache_key text PRIMARY KEY,
  provider text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX idx_cache_expiry ON public.search_cache(expires_at);

-- ============================================================
-- TRIGGER pra updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER workspaces_updated BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER alibaba_tokens_updated BEFORE UPDATE ON public.alibaba_tokens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER workspace_preferences_updated BEFORE UPDATE ON public.workspace_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
