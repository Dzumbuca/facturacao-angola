# Fase 0 — Pacotes, entitlements e limites do WMS

**Estado:** Fase 0 concluída. O **MVP de gate de módulo** foi implementado (ver secção 16); o restante documento continua como plano para limites/pacotes (Fases 1+).
**Objectivo:** fechar decisões comerciais/técnicas e deixar a implementação sem ambiguidades.

---

## 1. Inventário verificado (estado real do código)

| Peça | Onde | Estado |
|---|---|---|
| Plano legado | `Tenant.plan` + `Tenant.planExpiry` | **Activo** — usado pelo layout, ferramentas e quota de facturas |
| Cálculo de plano efectivo | `src/lib/plan.ts` (`computeEffectivePlan`, `nextPlanExpiry`) | **Activo** |
| Pagamentos manuais | `PlanPayment` + aprovação em `src/lib/admin-actions.ts` | **Activo** (comprovativo, meses, aprovação) |
| Modelos de subscrição | `SubscriptionPlan`, `TenantSubscription`, `PlanApplication` | **Existem no schema, não usados pela app** |
| Módulos por tenant | `TenantApplication` + `src/lib/platform-apps.ts` | **Activo** |
| Quota de facturas | `src/lib/invoice-quota.ts` (`FREE_INVOICE_LIMIT = 20`) | **Activo**, limite vitalício e *check-then-act* |
| Gate de armazém/stock | — | **Não existe** |
| UI de gestão de pacotes | — | **Não existe** (só admin de empresas/pagamentos) |

**Conclusão:** há três construções sobrepostas (`Tenant.plan`, `TenantSubscription`, `TenantApplication`). O gate não pode ser construído antes de definir uma fonte de verdade.

---

## 2. Decisões bloqueantes

Cada decisão tem uma **recomendação**; a coluna “impacto se diferente” indica o que muda.

| # | Decisão | Recomendação | Impacto |
|---|---|---|---|
| D1 | Stock básico incluído no plano Base? | **Sim, com limite pequeno** (ex.: 1 armazém, N SKUs — números a definir) | Maximiza adopção; upgrade pela escala |
| D2 | Catálogo de capacidades | **Fixo em código** (enum), valores em BD | Evita erros silenciosos e código morto |
| D3 | Fonte de verdade | **`TenantSubscription`**; `Tenant.plan/planExpiry` como cache transitório | Migração na Fase 1 |
| D4 | Limites | **Hard block na criação + aviso a 80%/100%** | Previsível para o cliente |
| D5 | Expiração | **Read-only do WMS**, dados sempre visíveis, exportação sempre | Confiança; evita suporte |
| D6 | Tolerância | **5 dias** de graça após `endsAt` | Margem para pagamentos manuais |
| D7 | Upgrade | **Imediato, sem pró-rata** na v1 | Simples e explicável |
| D8 | Downgrade | **Só no fim do ciclo**; excesso fica read-only | Sem reembolsos nem surpresas |
| D9 | Grandfathering | **Subscrições activas mantêm condições** até renovação | Evita disputas |
| D10 | Factura da subscrição | **Emitir FT com IVA + recibo** no fluxo de aprovação | Receita e conformidade |

**Nota crítica sobre D1:** é a decisão com maior impacto comercial. A recomendação é deliberadamente conservadora — testar com dados de conversão antes de tornar o stock exclusivo de planos pagos.

---

## 3. Modelo alvo (proposta, não aplicada)

Entidades novas (ou reutilizadas):

- **`PlanCapability(planId, capability, enabled)`** — liga/desliga por plano.
- **`PlanLimit(planId, metric, value)`** — limite numérico por plano/métrica.
- **`UsageCounter(tenantId, metric, periodStart, used)`** — consumo atómico por período.
- **`SubscriptionEvent(id, tenantId, subscriptionId, type, actorId, payload, createdAt)`** — auditoria.
- **`PlanChangeLog(id, planId, actorId, before, after, effectiveAt)`** — auditoria de configuração.

Reutilizar:

- `SubscriptionPlan` (preço, ciclo, `isActive`).
- `TenantSubscription` (`status`, `startsAt`, `endsAt`, `autoRenew`).
- `PlanApplication` para módulos (ex.: `wms`), sem duplicar o conceito.
- `PlanPayment` para comprovativos/aprovação.

**Regra:** `Tenant.plan/planExpiry` continuam como *cache derivado* apenas durante a transição; a verdade é `TenantSubscription`.

---

## 4. Catálogo de capacidades (proposta)

```
wms.warehouses            (capacidade)  + max_warehouses (limite)
wms.stock_tracking        (capacidade)  + max_stock_products (limite)
wms.movements             (capacidade)
wms.transfers             (capacidade)
wms.lots                  (capacidade)
wms.purchase_orders       (capacidade)
wms.reservations          (capacidade)
reports.advanced          (capacidade)
```

Métricas que **não** devem ser vendidas: “capacidade de stock” em unidades, histórico, auditoria, exportação.

---

## 5. Contratos de erro (API)

Respostas tipadas, para a UI não adivinhar:

```json
{ "code": "UPGRADE_REQUIRED", "capability": "wms.warehouses", "plan": "BASE", "requiredPlans": ["PRO"], "upgradeUrl": "/planos" }
{ "code": "LIMIT_REACHED", "metric": "max_warehouses", "used": 1, "limit": 1, "upgradeUrl": "/planos" }
{ "code": "READ_ONLY_PLAN", "reason": "EXPIRED", "graceEndedAt": "..." }
```

Regras:
- Erros de limite usam **403** (não 500, não 400 genérico).
- Nunca expor detalhes internos; expor consumo e CTA.
- Leituras nunca falham por limite (apenas escritas).

---

## 6. Enforcement — matriz rota → capacidade

| Rota | Verificação |
|---|---|
| `POST /api/stock/warehouses` | `wms.warehouses` + `max_warehouses` (atómico) |
| `POST /api/stock/products` (com `trackStock`) | `wms.stock_tracking` + `max_stock_products` |
| `POST /api/stock/movements` | `wms.movements` |
| `POST /api/stock/transfers` | `wms.transfers` |
| `POST /api/stock/lots` | `wms.lots` |
| `POST /api/stock/purchase/orders` | `wms.purchase_orders` |
| `POST /api/stock/reservations` | `wms.reservations` |
| Relatórios avançados | `reports.advanced` |
| GET/leituras/exports | **sem gate** |

**Ponto único:** todas as rotas chamam `assertCapability(tx, tenantId, capability)` e/ou `consumeQuota(tx, tenantId, metric, 1)` — nunca verificações ad-hoc.

---

## 7. Consistência e concorrência

- Contadores com operação atómica:
  `INSERT ... ON CONFLICT ... DO UPDATE SET used = used + 1 WHERE used < limit RETURNING used`
- Para métricas que são contagens (`max_warehouses`, `max_stock_products`): verificação + criação na **mesma transacção** com `SELECT ... FOR UPDATE` na linha do tenant ou advisory lock por `tenantId+metric`.
- `UsageCounter.periodStart`: mensal para métricas periódicas; `NULL`/fixo para métricas absolutas (armazéns/SKUs).
- Teste obrigatório: dois pedidos simultâneos no limite → um sucesso, um `LIMIT_REACHED`.

---

## 8. Ciclo de vida da subscrição

Estados: `PENDING_PAYMENT → ACTIVE → GRACE → EXPIRED`, mais `CANCELLED`.

Transições relevantes:
- **Aprovação de pagamento**: transacção única (marcar `APROVADO` com idempotência + criar/estender período + evento).
- **Renovação**: `endsAt = max(agora, endsAt) + meses`.
- **Upgrade**: novo plano imediato; `endsAt` mantém-se ou recalcula-se (D7).
- **Downgrade**: agendado para `endsAt`; over-limit → read-only.
- **Expiração**: cron diário muda `ACTIVE/GRACE → EXPIRED`; leitura calcula estado efectivo mesmo se o cron falhar.
- **Cancelamento**: mantém até `endsAt`.

Idempotência: `PlanPayment.idempotencyKey` único + `SubscriptionEvent(paymentId)` único — aprovar duas vezes não duplica meses.

---

## 9. Pagamentos e facturação

- Manter **comprovativo + aprovação manual** (realidade angolana: transferência, Multicaixa, depósito).
- Acrescentar: estados de pagamento explícitos, motivo de rejeição, auditoria do revisor.
- **Factura da subscrição**: série própria, IVA 14%, recibo; ligada ao pagamento aprovado.
- Reconciliação: lista de pagamentos pendentes com idade; alerta ao admin.
- Preços em AOA; histórico de preços por versão do plano (não reescrever facturas antigas).

---

## 10. Expiração, downgrade e dados

Regras inegociáveis:
1. Nunca apagar produtos, armazéns, quantidades, movimentos ou histórico.
2. Expiração → **read-only** do WMS; dados visíveis; exportação disponível.
3. Downgrade com excesso → bloqueia criação; permite arquivar/eliminar **por acção do utilizador**; nunca escolhe automaticamente.
4. Reactivação restaura tudo.
5. Documentos fiscais emitidos permanecem acessíveis.

---

## 11. Administração e configuração

- CRUD de planos (nome, preço, ciclo, activo) — `SubscriptionPlan`.
- Capacidades/limites por plano com validação contra o catálogo em código.
- Alterações com **auditoria** e `effectiveAt`; grandfathering para subscrições activas (D9).
- Dashboard: clientes por plano, consumo, em graça, expirados, pagamentos pendentes.
- Alteração manual de plano com motivo e actor (auditado).

---

## 12. Segurança e testes

Testes obrigatórios antes de activar o gate:
- **Bypass**: chamada directa à API com plano inferior → 403 `UPGRADE_REQUIRED`.
- **Isolamento**: tenant A não vê/afecta B (RLS + filtros).
- **Concorrência**: limite com dois pedidos simultâneos.
- **Expiração**: acesso read-only, dados presentes.
- **Downgrade**: over-limit bloqueia criação e preserva dados.
- **Pagamento**: aprovação dupla não duplica período.
- **Regressão**: facturação, documentos e login continuam a funcionar.

---

## 13. Faseamento

| Fase | Entrega | Critério de saída |
|---|---|---|
| 0 | Este documento + decisões D1–D10 | Aprovação tua |
| 1 | Unificação da subscrição (migração + compatibilidade) | Nenhuma regressão; dados migrados |
| 2 | `entitlements.ts` + contadores + testes | Cobertura de concorrência e bypass |
| 3 | Enforcement WMS (rotas + UI + CTAs) | Testes E2E verdes; flag desligada por omissão |
| 4 | Pagamentos idempotentes + ciclo de vida + cron | Aprovação dupla segura; expiração testada |
| 5 | Admin de pacotes + auditoria + dashboards | Configuração sem alterar código |
| 6 | Rollout com grandfathering e monitorização | Sem bloqueios inesperados |

**Estimativa grosseira:** Fase 0 (1 dia), 1 (2–4 dias), 2 (3–5), 3 (3–5), 4 (3–5), 5 (2–4), 6 (2–3) — condicionada às decisões.

---

## 14. Checklist de aprovação

- [ ] D1: stock básico incluído no Base? (recomendo sim)
- [ ] D1: números de limite (armazéns/SKUs/utilizadores)
- [ ] D3: `TenantSubscription` como fonte de verdade
- [ ] D4: hard limits + avisos 80/100%
- [ ] D5/D6: read-only na expiração + 5 dias de graça
- [ ] D7/D8: upgrade sem pró-rata; downgrade no fim do ciclo
- [ ] D9: grandfathering
- [ ] D10: factura da subscrição com IVA
- [ ] Meios de pagamento aceites e política de rejeição
- [ ] Quem aprova alterações de plano (roles)

---

## 15. O que NÃO fazer

- Não criar um segundo sistema de subscrições.
- Não gatear histórico, auditoria, exportação ou acesso aos dados.
- Não repetir o padrão de limite vitalício da quota de facturas.
- Não fazer planos bespoke por cliente.
- Não confiar no gate da UI.
- Não activar limites antes da migração da fonte de verdade.

---

## 16. MVP implementado (2026-11-07) — gate de módulo

Antes do motor de entitlements, foi implementado o gate binário do WMS com a infra-estrutura já existente (`PlatformApplication` + `TenantApplication`):

- **Seed idempotente**: `npm run db:seed-wms` (`scripts/seed-wms-application.cjs`) regista a aplicação `wms` e activa-a para todos os tenants existentes (grandfathering). Executado staging (4/4), E2E (2/2) e produção (16/16).
- **Enforcement servidor**: `src/proxy.ts` (Next 16, Node runtime) lê a sessão NextAuth e bloqueia `/stock/*` (redirect para `/apps?wms=bloqueado`) e `/api/stock/*` (403 `APP_NOT_ENABLED`) quando o módulo não está activo. Defesa em profundidade: `src/app/(dashboard)/stock/layout.tsx`.
- **Admin**: acção `setTenantWmsEnabled` (permissão `companies.update`, transacção Serializable, auditoria em `AdminAuditLog`) + formulário no detalhe da empresa.
- **UI**: aviso em `/apps` e paywall na área de stock; dados sempre visíveis quando o módulo é desactivado.
- **Testes**: 3 E2E novos (403, reactivação, redirect da página) — 30/30 E2E e 10/10 UI verdes.
- **Comportamento actual**: tenants existentes mantêm acesso; tenants novos ficam sem WMS por omissão, até o admin activar. Limites e pacotes continuam por implementar (Fases 1+).

---

## 17. Fases 1–2 implementadas (2026-11-07) — catálogo vs stock + limites de armazéns

**Sem deploy e sem migrations em produção.** Migration criada e aplicada apenas na BD descartável de E2E.

### Fase 1 — catálogo gratuito separado do stock
- `Product.trackStock` (boolean; backfill `stock > 0`): distingue catálogo de SKU gerido pelo WMS.
- `/api/produtos` (POST/PATCH): `stock`/`minStock` sem módulo WMS → **403 `STOCK_REQUIRES_WMS`**; criação normal continua gratuita.
- UI de produtos: campos/coluna de stock escondidos sem WMS, com nota e link para pacotes.
- Facturação: baixa de stock só quando o tenant tem WMS **e** o produto tem `trackStock`; o catálogo gratuito factura normalmente, sem exigir armazém padrão.
- Bug corrigido: `DELETE /api/produtos/[id]` usava `invoiceItem.tenantId` (campo inexistente) → 500; passou a filtrar por `invoice.tenantId`.

### Fase 2 — estrutura de limites por pacote
- `PlanLimit(planId, metric, value)` com `value NULL = ilimitado/personalizado`.
- Planos semeados (E2E): Grátis (0 armazéns), Básico (1), Profissional (3), Empresarial (sem limite). **Preços e limites de SKUs não definidos** (SKUs sem enforcement).
- `src/lib/entitlements.ts`: plano efectivo a partir de `TenantSubscription`; sem subscrição, tenants com WMS activo ficam **grandfathered sem limites** (preserva os 16 clientes); restantes → Grátis.
- Limite de armazéns aplicado no servidor em `POST /api/stock/warehouses`, com advisory lock por tenant (evita ultrapassar em concorrência) → **403 `LIMIT_REACHED`** com `used`/`limit`.
- Admin: `setTenantPackage` (auditado em `AdminAuditLog`) atribui pacote e sincroniza o gate (`Grátis` desactiva WMS; restantes activam; `none` = legado grandfathered).

### Testes
- 313 unitários (5 novos de entitlements) + 33 E2E (3 novos de pacotes) + 10 UI + tsc + lint + build de produção.

### Pendente de autorização
- Aplicar a migration em produção e fazer deploy.
- Preços dos planos, limites de SKUs e integração com pagamentos (Fases 3–4).

---

## 18. Preços de lançamento e limites (2026-11-08)

**Configuração inicial em BD** (alterável sem deploy):

| Plano | Mensal | Anual | Produtos | Clientes | Facturas | Armazéns | Transferências |
|---|---:|---:|---:|---:|---|---:|---|
| Grátis | 0 | — | 30 | 30 | 15/mês | 0 | Não |
| Básico | 5.000 Kz | 51.000 Kz | 100 | 100 | 100/mês | 1 | Não |
| Profissional | 12.500 Kz | 127.500 Kz | 500 | 500 | Ilimitadas | 3 | Sim |
| Empresarial | 25.000 Kz | 255.000 Kz | Ilimitados | Ilimitados | Ilimitadas | 10 | Sim |

- **Desbloqueio por anúncio removido**: quota do Grátis passa a 15 facturas/mês (mês civil em Africa/Luanda).
- **Limites no servidor** com advisory lock por tenant: produtos, clientes, armazéns e facturas/mês; acima → `403 LIMIT_REACHED` / `402 INVOICE_QUOTA_EXCEEDED`; dados existentes intactos.
- **Transferências**: nova `PlanCapability.transfers` (Básico off; Profissional/Empresarial on).
- **Grandfathering**: tenants legados com WMS e sem subscrição continuam sem limites; ao atribuir pacote no admin, aplicam-se.
- **Preços**: `priceKz` + novo `priceYearly`; ecrã de pagamento actualizado. Cobrança automática/anual fora do âmbito.
- **SKUs** sem valor (não aplicados). **RH e relatórios por nível** não vendidos até existirem.

### Testes
- **316 unitários** · **35 E2E** · **10/10 UI** · tsc 0 · lint 0 · build OK.
- Migration `20261108010500_plan_capabilities_yearly` aplicada **apenas** na BD descartável.

### Pendente de autorização
- Aplicar migration em produção, `npm run db:seed-plans` e deploy.
- Limites de SKUs, cobrança anual automática e pagamentos.
