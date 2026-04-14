# Arbitra — Contexto do Projeto

> Arquivo lido automaticamente pelo Claude Code a cada sessão. Contém convenções, glossário e regras de negócio que **nunca** devem ser violadas.

---

## 1. O que é o Arbitra

**Arbitra** é um SaaS de **arbitragem de preços internacional** que ajuda importadores e revendedores brasileiros a descobrirem oportunidades comparando produtos de fornecedores chineses (1688, Alibaba, Taobao) com preços de venda no Mercado Livre Brasil.

**Diferenciais:**
- Matching semântico com IA (Anthropic Claude) entre produto origem e destino
- Cálculo automático de **landed cost** (preço final no BR com todos os impostos)
- **Score de oportunidade** por margem potencial
- Sistema de **watchlist** com alertas de mudança de preço
- Histórico de preços pra identificar sazonalidade

**Público-alvo:** revendedores iniciantes e profissionais de e-commerce, clientes de escritórios de contabilidade que operam com importação (público do Simply Contabilidade).

**Modelo de negócio:** SaaS multi-tenant com planos Free, Pro, Business e Enterprise.

---

## 2. Stack técnica — não desvie sem motivo forte

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | TailwindCSS + shadcn/ui |
| State | TanStack Query (React Query) + Zustand pra estado local |
| Forms | React Hook Form + Zod |
| Backend | Supabase (PostgreSQL + Edge Functions Deno/TypeScript) |
| Auth | Supabase Auth (email/password + OAuth Google) |
| IA | Anthropic API (`claude-sonnet-4-6` via `@anthropic-ai/sdk`) |
| Data source China | RapidAPI wrappers (MVP) → Onebound.cn (produção) |
| Data source BR | API oficial Mercado Livre (`api.mercadolibre.com`) |
| Deploy frontend | Vercel |
| Deploy backend | Supabase Edge Functions |
| Billing | Stripe (BR via Stripe Brasil) |

### Padrão de abstração obrigatório: providers plugáveis

Toda integração com fontes de dados deve ser feita através de **interfaces TypeScript** com múltiplas implementações:

```typescript
interface ChinaSourceProvider {
  search(query: ChinaSearchQuery): Promise<ChinaProduct[]>;
  getProduct(id: string): Promise<ChinaProduct>;
  getProviderName(): string;
}

// Implementações: RapidAPI1688Provider, OneboundProvider, MockProvider
```

Isso permite trocar provider sem reescrever regra de negócio.

---

## 3. Convenções de código

### TypeScript
- **Strict mode sempre.** Nunca `any`. Use `unknown` e valide.
- Tipos compartilhados entre frontend/backend em `shared/types/`
- Schemas de validação em Zod, tipos derivados com `z.infer<>`

### Nomeação
- **Arquivos:** `kebab-case.ts` (ex: `china-source-provider.ts`)
- **Componentes React:** `PascalCase.tsx`
- **Hooks:** `useCamelCase.ts`
- **Tabelas Supabase:** `snake_case` plural (ex: `products_china`, `alibaba_tokens`)
- **Edge Functions:** prefixo `arbitra-` + `kebab-case` (ex: `arbitra-search-china`)

### Git
- Commits em português, imperativo: "adiciona matcher de produtos", "corrige cálculo de II"
- Branches: `feat/nome-feature`, `fix/nome-bug`, `chore/nome-tarefa`
- Nunca commitar: `.env`, `node_modules`, chaves de API

### Comentários
- Código em **português** pra regras de negócio fiscal/comercial (landed cost, NCM, etc)
- Código em **inglês** pra infraestrutura (auth, cache, rate limiting)
- Prompts da Anthropic API em **português** (o público-alvo é BR)

---

## 4. Arquitetura multi-tenant

### Hierarquia

```
Office (escritório, ex: Simply Contabilidade)
  └─ Workspace (conta do cliente Arbitra — pode ser vinculada a um office ou independente)
      └─ Users (usuários do workspace, com roles)
```

**Decisões arquiteturais:**
- `workspace_id` é a chave de tenancy principal. **Toda** tabela com dados do cliente tem `workspace_id uuid NOT NULL`.
- RLS (Row Level Security) **obrigatório** em todas as tabelas com dados de workspace.
- Policy padrão: `workspace_id = current_setting('app.current_workspace_id')::uuid`
- Offices (escritórios contábeis) podem gerenciar múltiplos workspaces (clientes).

### Roles dentro do workspace
- `owner` — dono, gerencia billing e usuários
- `admin` — gerencia buscas, watchlists, configurações
- `member` — opera o sistema sem acesso a billing

---

## 5. Glossário fiscal e comercial BR — crítico pro landed cost

Estes termos aparecem em código e prompts. **Não invente valores** — todos os cálculos precisam vir de tabelas configuráveis no banco.

| Termo | Significado |
|---|---|
| **NCM** | Nomenclatura Comum do Mercosul — código de 8 dígitos que classifica a mercadoria e determina alíquotas. Ex: `8708.99.90` (peças de veículos), `9503.00.99` (brinquedos). |
| **II** | Imposto de Importação. Alíquota varia por NCM, geralmente 0–35%. |
| **IPI** | Imposto sobre Produtos Industrializados. Varia por NCM. |
| **PIS/COFINS-Importação** | PIS 2,1% + COFINS 10,65% sobre valor aduaneiro (regra geral). |
| **ICMS-Importação** | Estadual. 18% em SP, 17% em SC (com possibilidade de **TTD 409** reduzindo base). |
| **TTD 409** | Tratamento Tributário Diferenciado de SC. Reduz ICMS efetivo pra 3–4% em certas operações de importação via portos catarinenses. |
| **Remessa Conforme** | Regime simplificado pra remessas postais até USD 3.000. Tributação: 20% II até USD 50, 60% acima + ICMS estadual (17% SP padrão). |
| **Landed Cost** | Custo final do produto no Brasil: `preço FOB + frete internacional + seguro + II + IPI + PIS/COFINS-Imp + ICMS + despesas aduaneiras`. |
| **FOB** | Free On Board — preço do produto posto no porto de origem, sem frete. |
| **CIF** | Cost, Insurance, Freight — preço do produto + frete + seguro até o porto de destino. |
| **Markup** | Margem sobre custo: `(preço venda - custo) / custo`. |
| **Margem** | Margem sobre venda: `(preço venda - custo) / preço venda`. |

**Regra crítica:** toda alíquota (II, IPI, PIS, COFINS, ICMS) vem da tabela `tax_rates` no banco, versionada por data de vigência. **Nunca hardcode alíquotas no código.**

---

## 6. Categorias (nichos) — implementação aberta com otimização por nicho

Arbitra não trava o usuário em um nicho, mas oferece **otimização** quando o usuário escolhe uma categoria.

### Categorias first-class no MVP

| Slug | Nome | NCM prefixo | Alertas regulatórios |
|---|---|---|---|
| `auto_parts` | Auto Peças | 8708, 8409, 8421 | — |
| `home_goods` | Utilidades Domésticas | 7323, 3924, 8215 | — |
| `toys` | Brinquedos | 9503 | **Inmetro obrigatório** |
| `generic` | Outros (Genérico) | — | — |

### Comportamento
- Se usuário escolhe categoria → prompt especializado + NCM sugerido + benchmarks de margem
- Se não escolhe → prompt genérico, Claude tenta inferir categoria e sugere "Identifiquei que é auto peça, quer ativar matching especializado?"
- Categorias são linhas na tabela `categories` — adicionar novo nicho é inserir row, **zero deploy**.

---

## 7. Segurança e privacidade — inegociáveis

- **Nunca logar** tokens, secrets ou PII (CPF, CNPJ, e-mail) em console/Sentry
- **Nunca versionar** `.env` — usar `.env.example` com placeholders
- Tokens do Alibaba/RapidAPI armazenados em `alibaba_tokens` e `api_credentials` com RLS estrito (só service role acessa)
- Anthropic API key **só no backend** (Edge Functions) — nunca expor ao cliente
- Dados de billing (Stripe) **nunca trafegam pelo banco** — sempre referência por `stripe_customer_id`
- LGPD: tabela `users` tem `consent_given_at`, `data_export_requests`, `data_deletion_requests`

---

## 8. Custos e rate limiting

APIs externas custam dinheiro. Regras obrigatórias:

1. **Cache de respostas** da API China por **24h** (usuários pagos) ou **7 dias** (Free tier)
2. **Cache de respostas** do ML por **6h**
3. **Rate limit por workspace** — contar em `usage_events` e bloquear quando exceder plano
4. **Anthropic API**: usar `claude-haiku-4-5` pra matching simples, `claude-sonnet-4-6` só pra análises complexas
5. **Nunca** chamar APIs externas em loops sem controle de concorrência (`p-limit` com max 5)

---

## 9. Nomes de referência e decisões travadas

- **Nome do produto:** Arbitra
- **Domínio canônico:** `arbitra.app` (considerar `arbitra.com.br` pra landing BR)
- **URL de callback OAuth Alibaba:** `https://<supabase-ref>.supabase.co/functions/v1/arbitra-oauth-alibaba`
- **Fundador / owner:** Simply (Simply Contabilidade)
- **Localização:** Brasil, pt-BR como idioma principal
- **Moeda:** BRL com exibição paralela em USD/CNY nas telas de comparação

---

## 10. O que NÃO fazer

- ❌ Scraping direto de Alibaba/1688/Taobao — viola ToS e quebra facilmente. Sempre via API de terceiro.
- ❌ Hardcode de alíquotas, câmbio, ou preços — tudo vem do banco.
- ❌ Chamar Anthropic API do frontend — sempre backend.
- ❌ Criar tabela sem RLS.
- ❌ Usar `any` em TypeScript.
- ❌ Fazer deploy sem rodar `npm run typecheck && npm run test`.
- ❌ Exibir preços da China sem landed cost calculado — usuário leigo se confunde.
- ❌ Prometer matching 100% acurado na UI — sempre mostrar `match_confidence` (0–100%).

---

## 11. Referências externas

- API Mercado Livre: https://developers.mercadolivre.com.br/
- Tabela NCM oficial: https://www.gov.br/receitafederal/pt-br
- Remessa Conforme: https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/remessa-conforme
- Anthropic API: https://docs.claude.com/
- Stripe Brasil: https://stripe.com/br
