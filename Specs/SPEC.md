# Arbitra — Especificação Funcional

> User stories, telas, fluxos e critérios de aceite. Este documento descreve **o quê** construir. O "como" está em `IMPLEMENTATION_PLAN.md`.

---

## 1. Personas

### P1 — Revendedor Iniciante ("João, 32 anos")
- Quer começar a importar da China, não sabe quais produtos vendem bem
- Tem até R$ 5.000 pra investir no primeiro lote
- Usa só o celular e o desktop, nada avançado
- Precisa de **simplicidade**: abrir, digitar produto, ver se vale a pena

### P2 — Profissional de E-commerce ("Marina, 38 anos")
- Já vende no ML, quer expandir mix de produtos
- Opera com RADAR (importação formal)
- Quer **dados precisos**: landed cost com TTD 409, margem exata, histórico
- Usa Excel, gosta de exportar dados

### P3 — Escritório Contábil ("Simply Contabilidade")
- Gerencia múltiplos clientes importadores
- Precisa de **multi-workspace** pra separar dados de cada cliente
- Cobra mensalidade dos clientes e quer incluir Arbitra como valor agregado

---

## 2. Jornada principal (happy path)

```
1. Cadastro → cria workspace (trial 7 dias Pro)
2. Onboarding → escolhe categorias de interesse (opcional)
3. Nova busca → digita "caixa de som bluetooth 20W"
4. Sistema busca em paralelo: China + ML
5. Claude faz matching entre os dois lados
6. Calcula landed cost de cada produto China
7. Exibe tabela: produto China | landed cost | melhor preço ML | margem%
8. Usuário salva produtos promissores na watchlist
9. Sistema monitora preços diariamente
10. Alerta quando margem ultrapassa threshold configurado
```

---

## 3. User stories agrupadas por épico

### Épico 1 — Autenticação e Workspace

**US-1.1 — Cadastro**
- Como visitante, quero criar uma conta com e-mail/senha ou Google, pra começar a usar
- **Aceite:**
  - Cadastro cria `user` + `workspace` (trial Pro 7 dias) + `workspace_member` com role `owner`
  - E-mail de confirmação enviado
  - Redirect pra onboarding

**US-1.2 — Onboarding**
- Como novo usuário, quero escolher categorias de interesse, pra receber sugestões relevantes
- **Aceite:**
  - 4 cards: Auto Peças, Utilidades Domésticas, Brinquedos, Outros
  - Seleção múltipla, opcional (pode pular)
  - Salvo em `workspace_preferences.active_categories`

**US-1.3 — Convite de usuário (Pro+ apenas)**
- Como owner, quero convidar outros usuários pro meu workspace
- **Aceite:**
  - Campo e-mail + dropdown role (admin, member)
  - Respeita limite do plano (Pro: 1, Business: 5)
  - E-mail com link mágico válido por 72h

**US-1.4 — Multi-workspace (para escritórios contábeis)**
- Como usuário de um escritório, quero alternar entre workspaces de diferentes clientes
- **Aceite:**
  - Dropdown no header lista todos workspaces que o user tem acesso
  - Trocar workspace recarrega contexto (RLS atualiza)

---

### Épico 2 — Busca e Descoberta

**US-2.1 — Busca simples**
- Como usuário, quero digitar o nome de um produto e ver oportunidades
- **Aceite:**
  - Campo de busca no topo (autocomplete opcional no futuro)
  - Dropdown opcional de categoria
  - Botão "Buscar" dispara pipeline: China search + ML search + matching
  - Loading state com mensagens progressivas ("Buscando fornecedores na China...", "Comparando com Mercado Livre...", "Calculando impostos...")

**US-2.2 — Resultado da busca (tabela comparativa)**
- Como usuário, quero ver resultados ranqueados por oportunidade
- **Aceite:**
  - Tabela com colunas: Imagem | Produto China | Landed Cost | Preço ML (mediana top 10) | Margem% | Volume ML | Score | Ações
  - Ordenação padrão: Score de oportunidade desc
  - Filtros: margem mínima, MOQ máximo, fornecedor verificado
  - Paginação: 20 itens por página
  - Cada linha clicável → abre detalhe

**US-2.3 — Detalhe do produto**
- Como usuário, quero ver análise completa de um produto
- **Aceite:**
  - Esquerda: dados China (imagens, specs, vendor, MOQ, preço por volume)
  - Direita: dados ML (top 10 anúncios similares, histogram de preços, volume total)
  - Topo: breakdown completo do landed cost (tabela expansível)
  - Ações: "Salvar em watchlist", "Exportar PDF", "Compartilhar link"

**US-2.4 — Histórico de buscas**
- Como usuário, quero ver minhas buscas anteriores pra reabrir rapidamente
- **Aceite:**
  - Sidebar lista últimas 20 buscas do workspace
  - Cada item: query + data + número de resultados
  - Clique reabre resultados (do cache se dentro da janela, senão re-executa)

---

### Épico 3 — Landed Cost e Simulação

**US-3.1 — Cálculo automático de landed cost**
- Como usuário, quero ver o custo final de cada produto sem fazer conta
- **Aceite:**
  - Sistema identifica NCM sugerido (via Claude, baseado em categoria + nome)
  - Aplica alíquotas da tabela `tax_rates`
  - Considera câmbio atual (API Banco Central ou similar)
  - Considera regime padrão do workspace (configurável: Remessa Conforme vs Importação Formal)
  - Breakdown visível: Preço FOB → Frete → II → PIS/COFINS-Imp → IPI → ICMS → Despesas → **Landed Cost**

**US-3.2 — Simulador configurável**
- Como usuário Pro+, quero simular cenários (diferentes portos, TTD, regimes)
- **Aceite:**
  - Modal "Simular cenário"
  - Campos editáveis: porto de entrada (SC/SP/PR), regime (RC/Formal), TTD 409 (on/off), margem alvo, volume
  - Recalcula em tempo real
  - Salvar cenário como preset do workspace

**US-3.3 — Ajuste manual de NCM**
- Como usuário avançado, quero corrigir o NCM se o sistema sugerir errado
- **Aceite:**
  - Input com busca na tabela NCM
  - Exibe descrição oficial do NCM selecionado
  - Recalcula landed cost ao salvar

---

### Épico 4 — Watchlist e Alertas

**US-4.1 — Adicionar à watchlist**
- Como usuário, quero monitorar produtos promissores
- **Aceite:**
  - Botão "Adicionar à watchlist" na tabela e no detalhe
  - Modal: escolher threshold de alerta (ex: "avisar se margem > 80%")
  - Respeita limite do plano (Free: 3, Pro: 50, Business: ilimitado)

**US-4.2 — Página de watchlist**
- Como usuário, quero ver todos produtos monitorados num lugar
- **Aceite:**
  - Tabela similar à busca, mas com coluna extra "Variação 7d" e "Último alerta"
  - Filtros: categoria, status (ativo/pausado)
  - Ação em massa: pausar, remover, exportar

**US-4.3 — Alertas de variação**
- Como usuário, quero ser notificado quando algo muda
- **Aceite:**
  - Cron job diário atualiza preços de produtos em watchlist
  - Gera `alert` se: margem cruza threshold, preço China cai >10%, preço ML sobe >10%
  - Notificação: in-app badge + e-mail (+ Telegram/WhatsApp no futuro)
  - Usuário pode configurar canais em Settings

---

### Épico 5 — Histórico e Analytics

**US-5.1 — Histórico de preços**
- Como usuário Pro+, quero ver gráfico de evolução dos preços
- **Aceite:**
  - Gráfico linha dupla: preço China vs preço ML (mediana)
  - Janela: 7d, 30d, 90d, 6m
  - Anotações de eventos (ex: "variação cambial +5%")

**US-5.2 — Dashboard de workspace**
- Como owner, quero ver estatísticas do uso
- **Aceite:**
  - Cards: buscas realizadas este mês, produtos em watchlist, alertas gerados, uso do plano%
  - Gráfico: top categorias pesquisadas
  - Link pra upgrade se próximo do limite

**US-5.3 — Exportação**
- Como usuário, quero exportar dados pra Excel
- **Aceite:**
  - Botão "Exportar" em qualquer tabela
  - Formatos: XLSX, CSV
  - Respeitar categorias/filtros ativos

---

### Épico 6 — Billing e Planos

**US-6.1 — Página de planos**
- Como usuário, quero comparar planos e fazer upgrade
- **Aceite:**
  - Tabela comparativa com 4 planos
  - Destaque visual do plano atual
  - Botão "Fazer upgrade" → checkout Stripe
  - FAQ sobre cobrança, cancelamento, trial

**US-6.2 — Gestão de assinatura**
- Como owner, quero gerenciar meu plano
- **Aceite:**
  - Ver fatura atual, próxima cobrança
  - Cancelar assinatura (mantém acesso até fim do ciclo)
  - Trocar método de pagamento (portal Stripe)
  - Baixar faturas anteriores

**US-6.3 — Enforcement de limites**
- Como sistema, preciso bloquear uso quando exceder plano
- **Aceite:**
  - Middleware checa `usage_events` antes de executar busca
  - Se excedeu: retorna erro 402 com mensagem clara + CTA de upgrade
  - Soft cap: avisa aos 80%, bloqueia aos 100%

---

### Épico 7 — Administração (interno Arbitra)

**US-7.1 — Painel admin**
- Como staff Arbitra, preciso gerenciar categorias, alíquotas, usuários
- **Aceite:**
  - Rota `/admin` (só users com flag `is_staff`)
  - CRUD de `categories`, `tax_rates`, `api_credentials`
  - Visualizar workspaces, uso, MRR

**US-7.2 — Configuração de providers de China**
- Como staff, preciso alternar entre RapidAPI e Onebound
- **Aceite:**
  - Feature flag por workspace ou global
  - Fallback automático se provider primário falhar
  - Métricas de custo por provider

---

## 4. Telas principais (sitemap)

```
/ (landing pública)
/login
/signup
/onboarding
/app
  /app/search               — busca principal
  /app/search/:id           — resultado salvo
  /app/product/:id          — detalhe do produto
  /app/watchlist            — lista de monitoramento
  /app/history              — histórico de buscas
  /app/alerts               — alertas recebidos
  /app/simulator            — simulador de landed cost standalone
  /app/dashboard            — analytics do workspace
  /app/settings
    /app/settings/profile
    /app/settings/workspace
    /app/settings/members
    /app/settings/billing
    /app/settings/integrations     — OAuth Alibaba etc
    /app/settings/notifications
/admin                      — staff only
```

---

## 5. Planos detalhados

| Recurso | Free | Pro (R$ 97/mês) | Business (R$ 297/mês) | Enterprise |
|---|---|---|---|---|
| Buscas/mês | 20 | 500 | 2.000 | Custom |
| Watchlist | 3 | 50 | Ilimitado | Ilimitado |
| Usuários | 1 | 1 | 5 | Custom |
| Histórico de preços | 7 dias | 90 dias | 2 anos | 2 anos |
| Simulador avançado | ❌ | ✅ | ✅ | ✅ |
| Alertas por e-mail | ✅ | ✅ | ✅ | ✅ |
| Alertas WhatsApp/Telegram | ❌ | ❌ | ✅ | ✅ |
| Exportação Excel | ❌ | ✅ | ✅ | ✅ |
| API access | ❌ | ❌ | ✅ | ✅ |
| Multi-workspace (escritório) | ❌ | ❌ | 3 workspaces | Ilimitado |
| Suporte | Comunidade | E-mail | Priorizado | Dedicado |
| Cache de buscas | 7 dias | 24h | 24h | Custom |

**Trial:** 7 dias de Pro pra todo novo cadastro (sem cartão).

---

## 6. Critérios de qualidade (não-funcionais)

- **Performance:** busca completa (China + ML + matching) em até **15 segundos** (P95)
- **Disponibilidade:** 99,5% uptime
- **Precisão de matching:** `match_confidence >= 70%` em pelo menos 60% dos casos
- **Precisão de landed cost:** erro máximo de 5% vs cálculo manual (validado em 50 produtos-teste)
- **Acessibilidade:** WCAG AA (labels, contraste, keyboard nav)
- **i18n:** pt-BR prioritário, estrutura pronta pra en-US futuro
- **Mobile:** responsivo a partir de 375px

---

## 7. Fora de escopo (MVP)

- App mobile nativo (PWA é suficiente)
- Integração com ERPs dos clientes (roadmap pós-PMF)
- Compra direta via Arbitra (ficamos como ferramenta de análise, não marketplace)
- Cálculo tributário pra outros mercados (Amazon, Shopee) — só ML no MVP
- Automação de publicação no ML — apenas análise

---

## 8. Métricas de sucesso do MVP

- 50 signups no primeiro mês
- 10 conversões free→pro nos primeiros 60 dias
- NPS > 40 em pesquisa com usuários ativos
- Custo médio de API por usuário pago < 20% do MRR
