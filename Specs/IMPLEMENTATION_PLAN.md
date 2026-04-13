# Arbitra — Plano de Implementação

> Documento técnico executável. Descreve **como** construir, incluindo schema SQL, Edge Functions, prompts da Anthropic API, estrutura de pastas e ordem de execução.

---

## 1. Estrutura de pastas

```
arbitra/
├── CLAUDE.md                          # contexto permanente
├── SPEC.md                            # especificação funcional
├── IMPLEMENTATION_PLAN.md             # este arquivo
├── README.md
├── .env.example
├── .gitignore
├── package.json                       # monorepo root (pnpm workspaces)
├── pnpm-workspace.yaml
│
├── apps/
│   └── web/                           # frontend React + Vite
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── routes/                # file-based routing
│       │   ├── components/
│       │   │   ├── ui/                # shadcn components
│       │   │   ├── search/
│       │   │   ├── product/
│       │   │   ├── watchlist/
│       │   │   └── billing/
│       │   ├── hooks/
│       │   ├── lib/
│       │   │   ├── supabase.ts
│       │   │   ├── api.ts
│       │   │   └── utils.ts
│       │   ├── stores/                # zustand
│       │   └── styles/
│       ├── public/
│       ├── index.html
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       └── tsconfig.json
│
├── supabase/
│   ├── config.toml
│   ├── migrations/                    # SQL versionado
│   │   ├── 00001_initial_schema.sql
│   │   ├── 00002_rls_policies.sql
│   │   ├── 00003_seed_categories.sql
│   │   └── 00004_seed_tax_rates.sql
│   ├── functions/                     # Edge Functions (Deno)
│   │   ├── _shared/
│   │   │   ├── supabase-client.ts
│   │   │   ├── anthropic-client.ts
│   │   │   ├── rate-limit.ts
│   │   │   ├── cache.ts
│   │   │   └── types.ts
│   │   ├── arbitra-oauth-alibaba/     # OAuth callback
│   │   ├── arbitra-search/            # endpoint principal de busca
│   │   ├── arbitra-search-china/      # wrapper providers China
│   │   ├── arbitra-search-ml/         # wrapper Mercado Livre
│   │   ├── arbitra-match-products/    # matching com Claude
│   │   ├── arbitra-calculate-landed/  # cálculo landed cost
│   │   ├── arbitra-watchlist-cron/    # cron diário de watchlist
│   │   ├── arbitra-stripe-webhook/    # webhook Stripe
│   │   └── arbitra-exchange-rate/     # cron câmbio BCB
│   └── seed.sql
│
├── packages/
│   └── shared/                        # tipos compartilhados
│       ├── src/
│       │   ├── types/
│       │   │   ├── products.ts
│       │   │   ├── workspace.ts
│       │   │   └── billing.ts
│       │   └── schemas/               # zod schemas
│       └── package.json
│
└── scripts/
    ├── seed-dev-data.ts
    └── export-supabase-types.sh
```

---

## 2. Variáveis de ambiente (.env.example)

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx          # só Edge Functions

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx

# RapidAPI (MVP)
RAPIDAPI_KEY=xxx
RAPIDAPI_HOST_1688=alibaba-1688-product-search.p.rapidapi.com
RAPIDAPI_HOST_TAOBAO=taobao-tmall-tao-api.p.rapidapi.com

# Alibaba OAuth (pós-MVP)
ALIBABA_APP_KEY=xxx
ALIBABA_APP_SECRET=xxx
ALIBABA_CALLBACK_URL=https://xxx.supabase.co/functions/v1/arbitra-oauth-alibaba

# Mercado Livre
ML_APP_ID=xxx                          # opcional no MVP (busca pública não exige)
ML_CLIENT_SECRET=xxx

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_BUSINESS=price_xxx

# Banco Central (câmbio - pública, sem key)
# App
ARBITRA_APP_URL=https://arbitra.app
```

---

## 3. Schema SQL completo

### 3.1 — Migration `00001_initial_schema.sql`

```sql
-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- busca fuzzy
CREATE EXTENSION IF NOT EXISTS "vector";      -- embeddings futuros

-- ============================================================
-- USERS & WORKSPACES (multi-tenancy core)
-- ============================================================

-- A tabela `auth.users` já existe no Supabase. Vamos estender com perfil.
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
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  cnpj text,
  owner_id uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  office_id uuid REFERENCES public.offices(id),    -- nullable: workspace pode existir sem escritório
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','business','enterprise')),
  trial_ends_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  default_import_regime text DEFAULT 'remessa_conforme' CHECK (default_import_regime IN ('remessa_conforme','formal')),
  default_entry_port text DEFAULT 'SP',            -- SP, SC, PR, ES
  default_ttd_409 boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug text UNIQUE NOT NULL,
  name_pt text NOT NULL,
  name_zh text,
  name_en text,
  default_ncm_prefix text,
  matching_prompt_template text,
  benchmark_margin_min numeric(5,2),
  benchmark_margin_target numeric(5,2),
  regulatory_alerts jsonb DEFAULT '{}'::jsonb,
  ml_category_id text,                             -- ex: "MLB1743" pra Autos no ML
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- TAX RATES (alíquotas versionadas)
-- ============================================================
CREATE TABLE public.tax_rates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tax_type text NOT NULL CHECK (tax_type IN ('ii','ipi','pis_imp','cofins_imp','icms','rc_flat')),
  ncm_prefix text,                                 -- '8708' matches '8708.xx.xx'; null = default
  state text,                                      -- ex: 'SP', 'SC' (pra ICMS)
  regime text,                                     -- 'remessa_conforme', 'formal'
  rate numeric(6,4) NOT NULL,                      -- 0.2000 = 20%
  fixed_amount numeric(10,2),                      -- pra taxas fixas (raro)
  valid_from date NOT NULL,
  valid_until date,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_tax_rates_lookup ON public.tax_rates(tax_type, ncm_prefix, state, regime, valid_from);

CREATE TABLE public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  currency_from text NOT NULL,                     -- 'USD', 'CNY'
  currency_to text NOT NULL DEFAULT 'BRL',
  rate numeric(12,6) NOT NULL,
  source text DEFAULT 'bcb',                       -- 'bcb', 'manual'
  fetched_at timestamptz DEFAULT now()
);

CREATE INDEX idx_exchange_latest ON public.exchange_rates(currency_from, fetched_at DESC);

-- ============================================================
-- PRODUCTS CHINA (cache de resultados das APIs)
-- ============================================================
CREATE TABLE public.products_china (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source text NOT NULL CHECK (source IN ('1688','alibaba','taobao','tmall','jd','pinduoduo')),
  external_id text NOT NULL,
  title_zh text,
  title_pt text,                                   -- traduzido via Claude
  main_image_url text,
  images jsonb DEFAULT '[]'::jsonb,
  price_cny numeric(12,2),
  price_tiers jsonb,                               -- [{"min_qty": 1, "price": 12.5}, ...]
  moq integer,                                     -- minimum order quantity
  currency text DEFAULT 'CNY',
  vendor_id text,
  vendor_name text,
  vendor_verified boolean,
  vendor_years integer,
  vendor_rating numeric(3,2),
  product_url text,
  specs jsonb DEFAULT '{}'::jsonb,                 -- atributos normalizados
  raw_response jsonb,                              -- resposta completa do provider
  fetched_at timestamptz DEFAULT now(),
  expires_at timestamptz,                          -- pra cache
  UNIQUE(source, external_id)
);

CREATE INDEX idx_products_china_title ON public.products_china USING gin(title_pt gin_trgm_ops);
CREATE INDEX idx_products_china_source ON public.products_china(source, fetched_at DESC);

-- ============================================================
-- PRODUCTS ML (cache de resultados do Mercado Livre)
-- ============================================================
CREATE TABLE public.products_ml (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ml_id text UNIQUE NOT NULL,                      -- MLB12345...
  title text NOT NULL,
  price_brl numeric(12,2) NOT NULL,
  original_price_brl numeric(12,2),
  ml_category_id text,
  condition text,                                  -- 'new', 'used'
  sold_quantity integer DEFAULT 0,
  available_quantity integer,
  listing_type text,                               -- 'gold_pro', 'gold_special'
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
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  query text NOT NULL,
  category_slug text REFERENCES public.categories(slug),
  filters jsonb DEFAULT '{}'::jsonb,
  total_results integer DEFAULT 0,
  cost_usd numeric(10,4) DEFAULT 0,               -- custo total em APIs pra essa busca
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_searches_workspace ON public.searches(workspace_id, created_at DESC);

-- Matches: produto China <-> agregado ML com análise da IA
CREATE TABLE public.product_matches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  search_id uuid REFERENCES public.searches(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  china_product_id uuid NOT NULL REFERENCES public.products_china(id),
  ml_products jsonb NOT NULL,                      -- array de ml_id com dados agregados
  ml_median_price numeric(12,2),
  ml_avg_sold_quantity integer,
  match_confidence numeric(5,2) NOT NULL,          -- 0-100
  match_reasoning text,                            -- explicação do Claude
  ncm_suggested text,
  landed_cost_brl numeric(12,2),
  landed_cost_breakdown jsonb,                     -- {fob, frete, ii, ipi, pis, cofins, icms, total}
  margin_pct numeric(6,2),                         -- margem % sobre venda
  markup_pct numeric(6,2),                         -- markup % sobre custo
  opportunity_score numeric(5,2),                  -- 0-100, considera margem + volume + confiança
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_matches_search ON public.product_matches(search_id, opportunity_score DESC);
CREATE INDEX idx_matches_workspace ON public.product_matches(workspace_id, created_at DESC);

-- ============================================================
-- WATCHLISTS & ALERTS
-- ============================================================
CREATE TABLE public.watchlists (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  match_id uuid NOT NULL REFERENCES public.product_matches(id) ON DELETE CASCADE,
  name text,                                       -- apelido do usuário
  alert_threshold_margin numeric(5,2),             -- ex: 80.00 = avisa se margem > 80%
  alert_threshold_price_drop numeric(5,2),         -- ex: 10.00 = avisa se preço china -10%
  is_paused boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_watchlists_workspace ON public.watchlists(workspace_id, is_paused);

CREATE TABLE public.price_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  watchlist_id uuid NOT NULL REFERENCES public.watchlists(id) ON DELETE CASCADE,
  china_price_cny numeric(12,2),
  ml_median_price_brl numeric(12,2),
  landed_cost_brl numeric(12,2),
  margin_pct numeric(6,2),
  snapshot_at timestamptz DEFAULT now()
);

CREATE INDEX idx_price_history_watchlist ON public.price_history(watchlist_id, snapshot_at DESC);

CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id),
  event_type text NOT NULL,                        -- 'search', 'match', 'watchlist_check'
  cost_usd numeric(10,4) DEFAULT 0,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_usage_workspace_month ON public.usage_events(workspace_id, created_at DESC);

-- Uso agregado por mês (materialized view ou refresh periódico)
CREATE TABLE public.usage_monthly (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  year_month text NOT NULL,                        -- '2026-04'
  searches_count integer DEFAULT 0,
  matches_count integer DEFAULT 0,
  total_cost_usd numeric(10,4) DEFAULT 0,
  PRIMARY KEY (workspace_id, year_month)
);

-- ============================================================
-- API CREDENTIALS (controle admin de providers)
-- ============================================================
CREATE TABLE public.api_credentials (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider text NOT NULL UNIQUE,                   -- 'rapidapi_1688', 'onebound', 'mercado_livre'
  credentials jsonb NOT NULL,                      -- encriptado em produção
  is_active boolean DEFAULT true,
  priority integer DEFAULT 100,                    -- menor = usado primeiro
  rate_limit_per_minute integer,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- CACHE
-- ============================================================
CREATE TABLE public.search_cache (
  cache_key text PRIMARY KEY,                      -- hash do query+categoria+filtros+provider
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
```

### 3.2 — Migration `00002_rls_policies.sql`

```sql
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
LANGUAGE sql SECURITY DEFINER
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
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT role FROM public.workspace_members
  WHERE workspace_id = workspace_uuid AND user_id = auth.uid()
  LIMIT 1;
$$;

-- USERS: cada um vê o próprio perfil
CREATE POLICY users_self ON public.users FOR ALL USING (id = auth.uid());

-- WORKSPACES: membros podem ver, owners podem editar
CREATE POLICY workspaces_read ON public.workspaces FOR SELECT USING (public.is_workspace_member(id));
CREATE POLICY workspaces_update ON public.workspaces FOR UPDATE USING (public.workspace_role(id) IN ('owner','admin'));
CREATE POLICY workspaces_insert ON public.workspaces FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- WORKSPACE_MEMBERS
CREATE POLICY members_read ON public.workspace_members FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY members_manage ON public.workspace_members FOR ALL USING (public.workspace_role(workspace_id) IN ('owner','admin'));

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

-- Tabelas públicas de referência (categorias, NCM, tax_rates, exchange_rates): leitura liberada pra autenticados
CREATE POLICY categories_read ON public.categories FOR SELECT USING (auth.uid() IS NOT NULL);
-- tax_rates e exchange_rates mesmas policies ou sem RLS se forem 100% públicas
```

### 3.3 — Migration `00003_seed_categories.sql`

```sql
INSERT INTO public.categories (slug, name_pt, name_zh, default_ncm_prefix, ml_category_id, benchmark_margin_min, benchmark_margin_target, regulatory_alerts) VALUES
('auto_parts', 'Auto Peças', '汽车配件', '8708', 'MLB1743', 50.00, 80.00, '{}'::jsonb),
('home_goods', 'Utilidades Domésticas', '家居用品', '7323', 'MLB1574', 40.00, 70.00, '{}'::jsonb),
('toys', 'Brinquedos', '玩具', '9503', 'MLB1132', 45.00, 75.00, '{"inmetro_required": true, "warning": "Brinquedos vendidos no Brasil exigem certificação Inmetro. Considere custos de certificação no landed cost."}'::jsonb),
('generic', 'Outros', '其他', null, null, 30.00, 50.00, '{}'::jsonb);
```

### 3.4 — Migration `00004_seed_tax_rates.sql`

> Alíquotas padrão. Ajustar conforme legislação atual. **Todas com `valid_from` = data da migration.**

```sql
-- Remessa Conforme (padrão simplificado)
INSERT INTO public.tax_rates (tax_type, regime, rate, valid_from, description) VALUES
('rc_flat', 'remessa_conforme', 0.2000, CURRENT_DATE, 'RC até USD 50: 20% II + ICMS estadual'),
('rc_flat', 'remessa_conforme', 0.6000, CURRENT_DATE, 'RC acima USD 50: 60% II + ICMS estadual');

-- Importação Formal (valores padrão, podem ser sobrescritos por NCM específico)
INSERT INTO public.tax_rates (tax_type, regime, rate, valid_from, description) VALUES
('ii', 'formal', 0.1600, CURRENT_DATE, 'II padrão (ajustar por NCM específico)'),
('ipi', 'formal', 0.0000, CURRENT_DATE, 'IPI padrão'),
('pis_imp', 'formal', 0.0210, CURRENT_DATE, 'PIS-Importação'),
('cofins_imp', 'formal', 0.1065, CURRENT_DATE, 'COFINS-Importação');

-- ICMS por estado (formal)
INSERT INTO public.tax_rates (tax_type, regime, state, rate, valid_from, description) VALUES
('icms', 'formal', 'SP', 0.1800, CURRENT_DATE, 'ICMS SP'),
('icms', 'formal', 'SC', 0.1700, CURRENT_DATE, 'ICMS SC padrão'),
('icms', 'formal', 'PR', 0.1800, CURRENT_DATE, 'ICMS PR'),
('icms', 'formal', 'RJ', 0.2000, CURRENT_DATE, 'ICMS RJ');

-- ICMS Remessa Conforme
INSERT INTO public.tax_rates (tax_type, regime, state, rate, valid_from, description) VALUES
('icms', 'remessa_conforme', 'SP', 0.1700, CURRENT_DATE, 'ICMS RC SP'),
('icms', 'remessa_conforme', 'SC', 0.1700, CURRENT_DATE, 'ICMS RC SC');
```

---

## 4. Edge Functions — implementação

### 4.1 — `_shared/types.ts`

```typescript
export interface ChinaProduct {
  source: '1688' | 'alibaba' | 'taobao' | 'tmall';
  externalId: string;
  titleZh: string;
  titlePt?: string;
  mainImageUrl?: string;
  images: string[];
  priceCny: number;
  priceTiers?: Array<{ minQty: number; price: number }>;
  moq?: number;
  vendorName?: string;
  vendorVerified?: boolean;
  vendorYears?: number;
  productUrl: string;
  specs: Record<string, unknown>;
}

export interface MLProduct {
  mlId: string;
  title: string;
  priceBrl: number;
  soldQuantity: number;
  condition: 'new' | 'used';
  sellerId: number;
  sellerNickname?: string;
  mainImageUrl?: string;
  permalink: string;
  attributes: Record<string, unknown>;
}

export interface ProductMatch {
  chinaProduct: ChinaProduct;
  mlProducts: MLProduct[];
  mlMedianPrice: number;
  mlAvgSoldQuantity: number;
  matchConfidence: number;
  matchReasoning: string;
  ncmSuggested?: string;
  landedCostBrl: number;
  landedCostBreakdown: LandedCostBreakdown;
  marginPct: number;
  markupPct: number;
  opportunityScore: number;
}

export interface LandedCostBreakdown {
  fob_brl: number;
  freight_brl: number;
  insurance_brl: number;
  ii_brl: number;
  ipi_brl: number;
  pis_imp_brl: number;
  cofins_imp_brl: number;
  icms_brl: number;
  customs_fees_brl: number;
  total_brl: number;
  exchange_rate_used: number;
  regime: 'remessa_conforme' | 'formal';
  notes?: string[];
}
```

### 4.2 — `_shared/anthropic-client.ts`

```typescript
import Anthropic from 'npm:@anthropic-ai/sdk@0.27.0';

export const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
});

export const MODELS = {
  FAST: 'claude-haiku-4-5',
  SMART: 'claude-sonnet-4-6',
} as const;
```

### 4.3 — Provider China (padrão adapter)

`_shared/china-providers/index.ts`:

```typescript
import type { ChinaProduct } from '../types.ts';

export interface ChinaSearchQuery {
  query: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}

export interface ChinaSourceProvider {
  readonly name: string;
  search(query: ChinaSearchQuery): Promise<ChinaProduct[]>;
  getProduct(externalId: string): Promise<ChinaProduct | null>;
}

// Factory que retorna provider ativo (prioridade configurável)
export async function getChinaProvider(): Promise<ChinaSourceProvider> {
  const providerName = Deno.env.get('CHINA_PROVIDER') ?? 'rapidapi_1688';
  switch (providerName) {
    case 'rapidapi_1688':
      return new RapidApi1688Provider();
    case 'onebound':
      return new OneboundProvider();
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}
```

`_shared/china-providers/rapidapi-1688.ts`:

```typescript
import type { ChinaSourceProvider, ChinaSearchQuery } from './index.ts';
import type { ChinaProduct } from '../types.ts';

export class RapidApi1688Provider implements ChinaSourceProvider {
  readonly name = 'rapidapi_1688';

  async search(query: ChinaSearchQuery): Promise<ChinaProduct[]> {
    const url = `https://${Deno.env.get('RAPIDAPI_HOST_1688')}/search`;
    const res = await fetch(`${url}?keyword=${encodeURIComponent(query.query)}&page=1`, {
      headers: {
        'x-rapidapi-key': Deno.env.get('RAPIDAPI_KEY')!,
        'x-rapidapi-host': Deno.env.get('RAPIDAPI_HOST_1688')!,
      },
    });

    if (!res.ok) {
      throw new Error(`1688 API error: ${res.status}`);
    }

    const data = await res.json();
    return this.normalize(data);
  }

  async getProduct(externalId: string): Promise<ChinaProduct | null> {
    // implementar conforme endpoint de detalhe
    return null;
  }

  private normalize(raw: any): ChinaProduct[] {
    // adaptar conforme schema real do RapidAPI wrapper escolhido
    return (raw.items ?? []).map((item: any) => ({
      source: '1688' as const,
      externalId: String(item.id),
      titleZh: item.title,
      mainImageUrl: item.image,
      images: item.images ?? [item.image].filter(Boolean),
      priceCny: parseFloat(item.price),
      priceTiers: item.price_tiers,
      moq: item.moq,
      vendorName: item.seller_name,
      vendorVerified: item.verified,
      productUrl: item.detail_url,
      specs: item.attrs ?? {},
    }));
  }
}
```

### 4.4 — Edge Function: `arbitra-search/index.ts` (orquestrador principal)

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getChinaProvider } from '../_shared/china-providers/index.ts';
import { searchMercadoLivre } from '../_shared/ml-client.ts';
import { matchProducts } from '../_shared/matcher.ts';
import { calculateLandedCost } from '../_shared/landed-cost.ts';
import { supabaseAdmin } from '../_shared/supabase-client.ts';
import { checkAndIncrementUsage } from '../_shared/rate-limit.ts';
import { withCache } from '../_shared/cache.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });

  try {
    const { query, categorySlug, workspaceId, userId, filters } = await req.json();

    // 1. Validações e rate limit
    const usageCheck = await checkAndIncrementUsage(workspaceId, 'search');
    if (!usageCheck.allowed) {
      return json({ error: 'quota_exceeded', plan: usageCheck.plan }, 402);
    }

    // 2. Cria registro da busca
    const { data: search } = await supabaseAdmin
      .from('searches')
      .insert({ workspace_id: workspaceId, user_id: userId, query, category_slug: categorySlug, filters })
      .select()
      .single();

    // 3. Busca China e ML em paralelo (com cache)
    const [chinaProducts, mlProducts] = await Promise.all([
      withCache(`china:${query}:${categorySlug}`, 24 * 3600, async () => {
        const provider = await getChinaProvider();
        return provider.search({ query, limit: 20 });
      }),
      withCache(`ml:${query}:${categorySlug}`, 6 * 3600, async () => {
        return searchMercadoLivre({ query, categoryId: await resolveMlCategoryId(categorySlug), limit: 50 });
      }),
    ]);

    // 4. Persiste produtos no cache do banco
    await persistChinaProducts(chinaProducts);
    await persistMlProducts(mlProducts);

    // 5. Matching com Claude
    const matches = await matchProducts({
      chinaProducts,
      mlProducts,
      categorySlug,
    });

    // 6. Calcula landed cost pra cada match
    const { data: workspace } = await supabaseAdmin.from('workspaces').select('*').eq('id', workspaceId).single();
    const enrichedMatches = await Promise.all(
      matches.map(async (m) => {
        const landedCost = await calculateLandedCost({
          priceCny: m.chinaProduct.priceCny,
          ncm: m.ncmSuggested,
          regime: workspace.default_import_regime,
          state: workspace.default_entry_port,
          ttd409: workspace.default_ttd_409,
        });
        const marginPct = ((m.mlMedianPrice - landedCost.total_brl) / m.mlMedianPrice) * 100;
        const markupPct = ((m.mlMedianPrice - landedCost.total_brl) / landedCost.total_brl) * 100;
        const opportunityScore = calculateOpportunityScore({ marginPct, confidence: m.matchConfidence, volume: m.mlAvgSoldQuantity });
        return { ...m, landedCostBrl: landedCost.total_brl, landedCostBreakdown: landedCost, marginPct, markupPct, opportunityScore };
      })
    );

    // 7. Persiste matches
    await supabaseAdmin.from('product_matches').insert(
      enrichedMatches.map((m) => ({
        search_id: search.id,
        workspace_id: workspaceId,
        china_product_id: m.chinaProduct.externalId, // FK resolver
        ml_products: m.mlProducts,
        ml_median_price: m.mlMedianPrice,
        match_confidence: m.matchConfidence,
        match_reasoning: m.matchReasoning,
        ncm_suggested: m.ncmSuggested,
        landed_cost_brl: m.landedCostBrl,
        landed_cost_breakdown: m.landedCostBreakdown,
        margin_pct: m.marginPct,
        markup_pct: m.markupPct,
        opportunity_score: m.opportunityScore,
      }))
    );

    // 8. Retorna resultados ordenados por oportunidade
    return json({ searchId: search.id, matches: enrichedMatches.sort((a, b) => b.opportunityScore - a.opportunityScore) });
  } catch (err) {
    console.error('arbitra-search error:', err);
    return json({ error: 'internal_error' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

function calculateOpportunityScore({ marginPct, confidence, volume }: { marginPct: number; confidence: number; volume: number }): number {
  // Score 0-100 ponderado
  const marginScore = Math.min(marginPct / 100, 1) * 40;    // margem pesa 40%
  const confidenceScore = (confidence / 100) * 30;           // confiança de match pesa 30%
  const volumeScore = Math.min(Math.log10(volume + 1) / 3, 1) * 30; // volume pesa 30%
  return Math.round((marginScore + confidenceScore + volumeScore) * 100) / 100;
}
```

### 4.5 — Matcher com Anthropic (`_shared/matcher.ts`)

```typescript
import { anthropic, MODELS } from './anthropic-client.ts';
import type { ChinaProduct, MLProduct } from './types.ts';

export async function matchProducts(params: {
  chinaProducts: ChinaProduct[];
  mlProducts: MLProduct[];
  categorySlug?: string;
}) {
  const { chinaProducts, mlProducts, categorySlug } = params;

  const systemPrompt = buildMatchingSystemPrompt(categorySlug);

  const userMessage = `
Produtos da China (fornecedores):
${JSON.stringify(chinaProducts.map(p => ({
  id: p.externalId,
  title: p.titleZh,
  price_cny: p.priceCny,
  specs: p.specs,
  image: p.mainImageUrl,
})), null, 2)}

Produtos do Mercado Livre Brasil:
${JSON.stringify(mlProducts.map(p => ({
  id: p.mlId,
  title: p.title,
  price_brl: p.priceBrl,
  sold: p.soldQuantity,
  attributes: p.attributes,
})), null, 2)}

Pra cada produto da China, identifique:
1. Os 3-5 produtos mais similares no ML (por título, specs, função)
2. Grau de confiança do match (0-100)
3. Justificativa curta do match
4. NCM sugerido (8 dígitos) baseado no tipo de produto

Retorne APENAS um JSON array válido, sem markdown, sem explicação.
Formato:
[
  {
    "china_id": "...",
    "ml_matches": ["mlb123", "mlb456"],
    "confidence": 85,
    "reasoning": "Ambos são caixas de som bluetooth 20W com LED...",
    "ncm_suggested": "8518.22.00"
  }
]
`;

  const response = await anthropic.messages.create({
    model: MODELS.SMART,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text in response');

  const matches = JSON.parse(textBlock.text);

  // Enriquece com dados dos ML products
  return matches.map((m: any) => {
    const chinaProduct = chinaProducts.find(c => c.externalId === m.china_id)!;
    const matchedMl = mlProducts.filter(ml => m.ml_matches.includes(ml.mlId));
    const prices = matchedMl.map(p => p.priceBrl).sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)] ?? 0;
    const avgSold = matchedMl.reduce((sum, p) => sum + p.soldQuantity, 0) / (matchedMl.length || 1);

    return {
      chinaProduct,
      mlProducts: matchedMl,
      mlMedianPrice: median,
      mlAvgSoldQuantity: Math.round(avgSold),
      matchConfidence: m.confidence,
      matchReasoning: m.reasoning,
      ncmSuggested: m.ncm_suggested,
    };
  });
}

function buildMatchingSystemPrompt(categorySlug?: string): string {
  const base = `Você é um especialista em comércio exterior Brasil-China com profundo conhecimento de:
- Nomenclatura NCM brasileira (8 dígitos) e sua classificação correta
- Matching de produtos entre marketplaces (1688/Alibaba <-> Mercado Livre)
- Padrões de tradução de títulos de produtos chineses pro português brasileiro

Sua tarefa: comparar produtos de fornecedores chineses com anúncios do Mercado Livre Brasil e identificar quais são o MESMO produto (ou equivalente funcional).

Critérios de matching:
1. Função/uso do produto (prioridade máxima)
2. Especificações técnicas (potência, capacidade, dimensões, material)
3. Modelo ou código quando aplicável (OEM, part number)
4. Categoria comercial

Regras rígidas:
- Confidence 90-100: produto idêntico (mesma specs, mesma função)
- Confidence 70-89: equivalente funcional (specs ligeiramente diferentes, mesma função)
- Confidence 50-69: genérico da mesma categoria (mesma função, specs variadas)
- Confidence <50: não listar
- NUNCA invente um NCM. Se não souber, retorne null.`;

  const categoryPrompts: Record<string, string> = {
    auto_parts: `

ESPECIALIZAÇÃO AUTO PEÇAS:
- Preste atenção em código OEM, aplicação veicular (marca/modelo/ano), número de série
- NCMs comuns: 8708.xx.xx (peças de veículos), 8409.xx.xx (peças de motores), 8421.xx.xx (filtros)
- Atenção a peças paralelas vs originais — geralmente paralelas chinesas matcheiam com anúncios "similar" ou "compatível" no ML`,

    toys: `

ESPECIALIZAÇÃO BRINQUEDOS:
- NCM padrão: 9503.00.xx
- ATENÇÃO REGULATÓRIA: brinquedos no Brasil exigem certificação Inmetro. Ao fazer matching, verifique se o anúncio do ML menciona "certificado Inmetro" — produtos chineses sem certificação têm custo adicional.
- Classificar por faixa etária é importante: até 3 anos exige regulamentação diferenciada`,

    home_goods: `

ESPECIALIZAÇÃO UTILIDADES DOMÉSTICAS:
- NCMs comuns: 7323.xx (artigos de cozinha em ferro/aço), 3924.xx (plásticos), 8215.xx (talheres)
- Material é crítico pra NCM correto — distinguir aço inox, plástico, silicone, vidro`,
  };

  return base + (categoryPrompts[categorySlug ?? ''] ?? '');
}
```

### 4.6 — Calculadora de Landed Cost (`_shared/landed-cost.ts`)

```typescript
import { supabaseAdmin } from './supabase-client.ts';
import type { LandedCostBreakdown } from './types.ts';

export async function calculateLandedCost(params: {
  priceCny: number;
  ncm?: string;
  regime: 'remessa_conforme' | 'formal';
  state: string;
  ttd409?: boolean;
  freightUsd?: number;
  insuranceUsd?: number;
}): Promise<LandedCostBreakdown> {
  const { priceCny, ncm, regime, state, ttd409 = false, freightUsd = 0, insuranceUsd = 0 } = params;

  // 1. Câmbio
  const [cnyBrl, usdBrl] = await Promise.all([
    getExchangeRate('CNY'),
    getExchangeRate('USD'),
  ]);

  const fobBrl = priceCny * cnyBrl;
  const freightBrl = freightUsd * usdBrl;
  const insuranceBrl = insuranceUsd * usdBrl;
  const customsValue = fobBrl + freightBrl + insuranceBrl;

  if (regime === 'remessa_conforme') {
    // RC: aplica flat + ICMS estadual sobre (valor + II)
    const fobUsd = priceCny * (cnyBrl / usdBrl);
    const rcRate = fobUsd <= 50 ? 0.20 : 0.60;
    const iiBrl = customsValue * rcRate;

    const icmsRate = await getTaxRate('icms', 'remessa_conforme', state);
    const icmsBase = customsValue + iiBrl;
    const icmsBrl = icmsBase * icmsRate;

    const total = customsValue + iiBrl + icmsBrl;

    return {
      fob_brl: fobBrl,
      freight_brl: freightBrl,
      insurance_brl: insuranceBrl,
      ii_brl: iiBrl,
      ipi_brl: 0,
      pis_imp_brl: 0,
      cofins_imp_brl: 0,
      icms_brl: icmsBrl,
      customs_fees_brl: 0,
      total_brl: total,
      exchange_rate_used: cnyBrl,
      regime: 'remessa_conforme',
      notes: [`Regime Remessa Conforme (FOB USD ${fobUsd.toFixed(2)})`],
    };
  }

  // Formal
  const iiRate = ncm ? await getTaxRate('ii', 'formal', null, ncm) : await getTaxRate('ii', 'formal');
  const ipiRate = ncm ? await getTaxRate('ipi', 'formal', null, ncm) : 0;
  const pisRate = await getTaxRate('pis_imp', 'formal');
  const cofinsRate = await getTaxRate('cofins_imp', 'formal');
  const icmsRateBase = await getTaxRate('icms', 'formal', state);

  // TTD 409: reduz ICMS efetivo pra ~3-4% (usamos 4% conservador)
  const icmsRate = ttd409 && state === 'SC' ? 0.04 : icmsRateBase;

  const iiBrl = customsValue * iiRate;
  const ipiBase = customsValue + iiBrl;
  const ipiBrl = ipiBase * ipiRate;
  const pisBrl = customsValue * pisRate;
  const cofinsBrl = customsValue * cofinsRate;

  // ICMS "por dentro" — base é (valor + II + IPI + PIS + COFINS + ICMS), resolvendo:
  const icmsBase = (customsValue + iiBrl + ipiBrl + pisBrl + cofinsBrl) / (1 - icmsRate);
  const icmsBrl = icmsBase * icmsRate;

  const customsFees = 150; // Siscomex e pequenas despesas (placeholder, parametrizar)

  const total = customsValue + iiBrl + ipiBrl + pisBrl + cofinsBrl + icmsBrl + customsFees;

  return {
    fob_brl: fobBrl,
    freight_brl: freightBrl,
    insurance_brl: insuranceBrl,
    ii_brl: iiBrl,
    ipi_brl: ipiBrl,
    pis_imp_brl: pisBrl,
    cofins_imp_brl: cofinsBrl,
    icms_brl: icmsBrl,
    customs_fees_brl: customsFees,
    total_brl: total,
    exchange_rate_used: cnyBrl,
    regime: 'formal',
    notes: ttd409 ? ['TTD 409 aplicado (SC, alíquota efetiva 4%)'] : [],
  };
}

async function getExchangeRate(currency: 'USD' | 'CNY'): Promise<number> {
  const { data } = await supabaseAdmin
    .from('exchange_rates')
    .select('rate')
    .eq('currency_from', currency)
    .eq('currency_to', 'BRL')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .single();
  if (!data) throw new Error(`No exchange rate for ${currency}`);
  return Number(data.rate);
}

async function getTaxRate(
  taxType: string,
  regime: string,
  state?: string | null,
  ncm?: string
): Promise<number> {
  let query = supabaseAdmin.from('tax_rates')
    .select('rate, ncm_prefix')
    .eq('tax_type', taxType)
    .eq('regime', regime)
    .lte('valid_from', new Date().toISOString())
    .order('valid_from', { ascending: false });

  if (state) query = query.eq('state', state);

  const { data } = await query;
  if (!data || data.length === 0) return 0;

  // Prioriza match por NCM prefix mais longo
  if (ncm) {
    const ncmMatch = data
      .filter(r => r.ncm_prefix && ncm.startsWith(r.ncm_prefix))
      .sort((a, b) => (b.ncm_prefix?.length ?? 0) - (a.ncm_prefix?.length ?? 0))[0];
    if (ncmMatch) return Number(ncmMatch.rate);
  }

  // Fallback: primeiro sem ncm_prefix
  const generic = data.find(r => !r.ncm_prefix);
  return generic ? Number(generic.rate) : 0;
}
```

### 4.7 — Cron: câmbio do Banco Central (`arbitra-exchange-rate/index.ts`)

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { supabaseAdmin } from '../_shared/supabase-client.ts';

serve(async () => {
  // API pública BCB — PTAX
  const currencies = ['USD', 'CNY'];
  const results = [];

  for (const cur of currencies) {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='${cur}'&@dataCotacao='${today}'&$format=json`;
    const res = await fetch(url);
    const data = await res.json();
    const rate = data.value?.[0]?.cotacaoVenda;

    if (rate) {
      await supabaseAdmin.from('exchange_rates').insert({
        currency_from: cur,
        currency_to: 'BRL',
        rate,
        source: 'bcb',
      });
      results.push({ cur, rate });
    }
  }

  return new Response(JSON.stringify({ updated: results }), { headers: { 'Content-Type': 'application/json' } });
});
```

Agendar via `supabase/config.toml`:
```toml
[functions.arbitra-exchange-rate]
verify_jwt = false
schedule = "0 10 * * 1-5"  # 10h UTC, seg-sex (após fechamento PTAX)
```

---

## 5. Frontend — componentes principais

### 5.1 — Estrutura de rotas

```typescript
// apps/web/src/routes/index.ts
import { createBrowserRouter } from 'react-router-dom';

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/login', element: <Login /> },
  { path: '/signup', element: <Signup /> },
  {
    path: '/app',
    element: <AppLayout />,              // requer auth + workspace
    children: [
      { path: 'search', element: <SearchPage /> },
      { path: 'search/:id', element: <SearchResultsPage /> },
      { path: 'product/:id', element: <ProductDetailPage /> },
      { path: 'watchlist', element: <WatchlistPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'alerts', element: <AlertsPage /> },
      { path: 'simulator', element: <SimulatorPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'settings/*', element: <SettingsRoutes /> },
    ],
  },
]);
```

### 5.2 — Hook de busca (principal)

```typescript
// apps/web/src/hooks/use-search.ts
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/stores/workspace';

export function useSearch() {
  const workspace = useWorkspace();

  return useMutation({
    mutationFn: async (params: { query: string; categorySlug?: string; filters?: any }) => {
      const { data, error } = await supabase.functions.invoke('arbitra-search', {
        body: { ...params, workspaceId: workspace.id, userId: workspace.userId },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useSearchResults(searchId: string) {
  return useQuery({
    queryKey: ['search', searchId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_matches')
        .select('*')
        .eq('search_id', searchId)
        .order('opportunity_score', { ascending: false });
      return data;
    },
    enabled: !!searchId,
  });
}
```

---

## 6. Ordem de execução (roadmap dia-a-dia)

### Semana 1 — Fundação
**Dia 1:** Setup monorepo (pnpm workspaces), Vite, Tailwind, shadcn, Supabase local
**Dia 2:** Migration 1 (schema) + Migration 2 (RLS) + seed categorias/tax_rates
**Dia 3:** Auth (signup/login/onboarding), workspace creation trigger, layout base
**Dia 4:** Edge Function arbitra-exchange-rate (cron BCB) + primeiros testes

### Semana 2 — Busca core
**Dia 5:** Provider RapidAPI 1688 + testes unitários com mock
**Dia 6:** Client Mercado Livre + cache layer
**Dia 7:** Matcher com Anthropic (prompt genérico primeiro)
**Dia 8:** Calculadora de landed cost (regime RC + Formal)
**Dia 9:** Edge Function arbitra-search (orquestrador) + integração frontend

### Semana 3 — UX e refinamento
**Dia 10:** SearchPage + tabela comparativa
**Dia 11:** ProductDetailPage com breakdown de landed cost
**Dia 12:** Watchlist CRUD + página
**Dia 13:** Alertas (cron diário) + UI
**Dia 14:** History + Dashboard básico

### Semana 4 — Monetização e polish
**Dia 15:** Stripe integration (checkout + webhook)
**Dia 16:** Enforcement de limites por plano
**Dia 17:** Prompts especializados por categoria
**Dia 18:** Exportação Excel + simulador avançado
**Dia 19:** Testes E2E (Playwright) nos fluxos críticos
**Dia 20:** Landing page + docs + deploy produção

---

## 7. Testes obrigatórios (mínimo viável)

- Unit: `landed-cost.ts` com 20 casos (RC ≤50, RC >50, Formal SP, Formal SC com TTD, etc)
- Unit: `matcher.ts` com mock da Anthropic (validar parse de resposta)
- Integration: fluxo completo `arbitra-search` com providers mockados
- E2E (Playwright): signup → busca → ver resultado → adicionar watchlist
- Contract tests: RapidAPI e ML schemas (Zod)

---

## 8. Como usar este plano no Claude Code

1. **Clonar repo vazio** e adicionar os 3 arquivos (`CLAUDE.md`, `SPEC.md`, `IMPLEMENTATION_PLAN.md`) na raiz
2. **Abrir Claude Code** no diretório
3. **Primeiro prompt ao Claude Code:**
   > Leia CLAUDE.md, SPEC.md e IMPLEMENTATION_PLAN.md. Depois execute o Dia 1 do roadmap (seção 6 do IMPLEMENTATION_PLAN.md). Configure o monorepo pnpm, Vite+React+TS, Tailwind+shadcn e Supabase local. Ao final, rode os comandos de verificação e me diga qual o status.
4. **Prompts diários:** "Execute o Dia N do roadmap. Confirme pré-requisitos antes de começar."
5. **Ao adicionar feature fora do plano:** atualize SPEC.md primeiro, depois peça implementação referenciando a nova user story.
