# JWT_REVOCATION_PHASE_1C_STRATEGY_DECISION

**Date:** 2026-11-05  
**Project:** `C:\Users\Administrador\Desktop\facturacao-angola`  
**Branch:** `wms-v2-e2e-staging`  
**Phase:** 1C — decisão e planeamento **apenas**. **NENHUMA operação executada na base de dados.**  
**Ambiente alvo (análise):** PostgreSQL 17, `127.0.0.1:5437`, DB `mf_rls_staging`. **Sem 5436, sem Supabase, sem produção.**

## 1. Resumo executivo
- **Conclusão:** **NOT PROVEN** que exista escrita segura imediata sem inventário completo adicional autorizado e backup externo verificado. Para o objectivo estrito (aplicação controlada futura da migration JWT), **C (aplicação isolada apenas do SQL JWT, com registo operacional fora do Prisma migrate normal)** é a **menos arriscada para dados** *se e só se* pré-condições forem cumpridas; mantém **ALTO** risco de histórico Prisma e exige autorização explícita. **A/B não recomendadas agora** por divergências e prova insuficiente. **Execução imediata: BLOCKED/condicional.**
- **Não escolhida por ter menos comandos.** Prioridade: integridade de dados > segurança > rastreabilidade > compatibilidade futura.

## 2. Diagnóstico herdado da Fase 1B (evidência read-only reconstruída)
`JWT_REVOCATION_PHASE_1B_RECONCILIATION_ANALYSIS.md` **não encontrado** no worktree actual (**NOT PROVEN**). Diagnóstico reconstruído por consultas read-only em 5437, inspecção de migrations/SQL e `tmp/recon-*`.

| Item | Estado | Classificação |
|---|---|---|
| `public._prisma_migrations` | Ausente | PASS (observado) |
| Prisma histórico | 24 migrations reportadas não aplicadas (contexto) | PASS (contexto) |
| Tabelas públicas | 51 | PASS |
| RLS | 47 ON; 4 OFF: `Account,Session,VerificationToken,EmailActionToken`; `User` ON | PASS (observado) |
| Roles | `mf_app_* mf_admin_* mf_auth_* mf_migration` NOBYPASSRLS (contexto) | PASS (contexto) |
| Policies | 47, `app.is_admin`/`app.tenant_id`/GUCs | PASS |
| Grants/ACL | anon/auth sem uso schema público; ACLs `mf_*` explícitas | PASS (parcial) |
| Migrations CREATE TABLE | Tabelas-alvo presentes | LIKELY REFLECTED (tabelas) — NOT PROVEN equivalência completa |
| Migrations ALTER-heavy | Divergências colunas/nomes | DRIFTED / PARTIALLY REFLECTED / NOT PROVEN |
| FK stock | `StockMovement(tenantId,productId)->Product(tenantId,id)` RESTRICT; unique composta | PASS |
| `20261027180000_public_api_security` | 4 adapter tables sem RLS; grants/policies custom | DRIFTED / NOT PROVEN |
| `20261105233000_auth_jwt_revocation_phase1` | Aditiva, tabela inexistente | NOT APPLIED (SQL PASS estático; aplicação NOT EXECUTED) |

## 3. Comparação das três estratégias
### A. Baseline controlado do schema actual
| Aspecto | Avaliação |
|---|---|
| Funcionamento | Novo ponto inicial fiel ao estado real; gestão de histórico/metadados — **PROIBIDO nesta fase**. |
| Pré-requisitos | Inventário completo (colunas/tipos/defaults/índices/constraints/FKs/policies/grants/roles/funções/extensões), decisão Prisma vs SQL operacional, backup externo, ensaio. |
| Operações necessárias | Baseline/reconciliação histórico — **PROIBIDO**. |
| Inconsistência | ALTO se infiel. |
| Perda/corrupção dados | BAIXO directo (só metadados) / ALTO indirecto se erro/reset. |
| Futuras migrations | Melhora se fiel; piora se omitir RLS/roles/grants/drift. |
| RLS/roles custom | ALTO risco omissão. |
| Compatibilidade actual | MÉDIA só com baseline fiel validado. |
| Auditoria | MÉDIA/ALTA com documentação. |
| Recuperação | Backup externo + reversão metadados. |

### B. Reconciliação formal das migrations reflectidas
| Aspecto | Avaliação |
|---|---|
| Funcionamento | Classificar cada migration e registar formalmente apenas as plenamente reflectidas — **PROIBIDO nesta fase**. |
| Pré-requisitos | Matriz FULLY/PARTIALLY/DRIFTED/NOT REFLECTED/NOT PROVEN com evidência completa; decisões para parciais/drift; backup. |
| Operações necessárias | Inventário + possível `prisma migrate resolve`/metadados — **PROIBIDO**. |
| Inconsistência | ALTO (falso aplicado). |
| Perda/corrupção dados | BAIXO directo / ALTO operacional. |
| Futuras migrations | Boa com prova completa; perigosa sem prova. |
| RLS/roles custom | MÉDIO; ALTO se futuras assumirem estado errado. |
| Compatibilidade actual | BAIXO/MÉDIO sem prova. |
| Auditoria | ALTA se rigorosa. |
| Recuperação | Rollback metadados planeado + backup. |

### C. Aplicação isolada e controlada apenas da migration JWT
| Aspecto | Avaliação |
|---|---|
| Funcionamento | Aplicar só `prisma/migrations/20261105233000_auth_jwt_revocation_phase1/migration.sql` em 5437; histórico Prisma permanece divergente; rastreabilidade operacional separada. |
| Pré-requisitos | Autorização explícita; backup externo verificado; tabela ausente; roles `mf_app_nobypass/mf_admin_executor/mf_migration` presentes; FK→`User(id)` válida; revisão; janela. |
| Operações necessárias | Execução SQL aditivo — **PROIBIDO nesta fase**. |
| Inconsistência | MÉDIO (histórico diverge mais). |
| Perda/corrupção dados | BAIXO se aditivo validado; MÉDIO por erro operacional. |
| Futuras migrations | ALTO impacto negativo no fluxo Prisma normal. |
| RLS/roles custom | MÉDIO (policies/GUCs `app.user_id/app.is_admin`; grants roles existentes). |
| Compatibilidade actual | ALTA para adição isolada. |
| Auditoria | MÉDIA. |
| Recuperação | ALTA (reversão aditiva autorizada). |

## 4. Matriz comparativa
| Critério | A Baseline | B Reconciliação | C Isolada JWT |
|---|---:|---:|---:|
| Risco inconsistência histórico | ALTO | ALTO | ALTO (persiste) |
| Risco directo perda/corrupção dados | BAIXO* | BAIXO* | BAIXO* |
| Risco operacional | ALTO | ALTO | MÉDIO |
| Impacto negativo futuras migrations Prisma | MÉDIO | MÉDIO/ALTO | ALTO |
| Impacto RLS/roles custom | ALTO | MÉDIO | MÉDIO |
| Compatibilidade schema actual | MÉDIO | BAIXO/MÉDIO | ALTO (adição) |
| Facilidade auditoria | MÉDIA | MÉDIA/ALTA | MÉDIO |
| Recuperação | MÉDIA | MÉDIA | ALTA |
| Adequação objectivo estrito (JWT) | BAIXA | BAIXA | MÉDIA/ALTA (condicional) |

*Baixo apenas com disciplina estrita, sem reset/rebuild, com backup externo verificado.

## 5. Análise especial do baseline (A)
- Representação integral por migration inicial: **NOT PROVEN**. `prisma db pull` não preserva adequadamente RLS/policies, roles/grants, GUCs, nem drift semântico (**FAIL** como pressuposto).
- Preservar RLS específico: requer SQL operacional versionado. **NOT PROVEN**.
- Roles/grants personalizados (`mf_*`): **ALTO** risco omissão.
- 4 tabelas auth sem RLS: excepção actual; deve ser representada explicitamente. **NOT PROVEN**.
- Divergências colunas vs migrations antigas: **FAIL** para baseline rápido. Exemplos observados: `Invoice.companyNif` ausente; `Tenant.planExpiry` vs `planExpiresAt`; `Product.quantity/stockManaged` ausentes; `InvoiceDraft.convertedInvoiceId` ausente; `PlatformConfig.allowAds/allowExternalPlatformAdmin` ausentes; naming reminders/share expiry divergente.
- Impedir recriação futura: **NOT PROVEN** sem histórico coerente e shadow.

## 6. Análise especial da reconciliação (B)
Evidência **insuficiente** para marcação em massa. Não considerar reflectida por tabelas existirem.

| Migration | Classificação | Nota |
|---|---|---|
| 20261019000100_baseline | NOT PROVEN / DRIFT context | Equivalência total não provada. |
| 20261019200000_invoice_discount_and_observations | PARTIALLY REFLECTED / NOT PROVEN | Detalhes não provados. |
| 20261019221000_company_invoice_profile | DRIFTED | `Invoice.companyNif` ausente; outros campos presentes. |
| 20261019230000_financial_workflows | LIKELY PARTIALLY REFLECTED | NOT PROVEN total. |
| 20261019231000_invoice_drafts | LIKELY REFLECTED (tabela) | NOT PROVEN. |
| 20261019232000_invoice_draft_conversion | DRIFTED | `InvoiceDraft.convertedInvoiceId` ausente na amostra. |
| 20261020120000_platform_admin | PARTIALLY REFLECTED | NOT PROVEN total. |
| 20261020153000_platform_rbac | DRIFTED / PARTIAL | `PlatformConfig.allowExternalPlatformAdmin` ausente. |
| 20261020170000_email_foundation | LIKELY PARTIALLY REFLECTED | NOT PROVEN total. |
| 20261020180000_email_campaign_recipients | LIKELY REFLECTED (tabela) | NOT PROVEN. |
| 20261021235900_add_user_image | PARTIALLY REFLECTED | `User.image` presente; `Payment.paidAt/updatedAt` ausentes na amostra. |
| 20261022110000_plan_and_ads | DRIFTED / PARTIAL | `PlatformConfig.allowAds` ausente. |
| 20261023120000_plan_payments | LIKELY REFLECTED (tabela) | NOT PROVEN. |
| 20261025010000_plan_expiry | DRIFTED (naming) | `Tenant.planExpiry` vs `planExpiresAt`. |
| 20261025120000_invoice_share | PARTIALLY REFLECTED | Naming share/reminder expiry divergente. |
| 20261025200000_invoice_reminders | DRIFTED / PARTIAL | `lastReminderAt`/campos esperados divergentes. |
| 20261025210000_payment_receipts | LIKELY REFLECTED (tabela) | NOT PROVEN. |
| 20261027160000_business_documents | LIKELY REFLECTED (tabelas) | NOT PROVEN. |
| 20261027180000_public_api_security | DRIFTED | 4 adapter tables sem RLS; não equivale à expectativa total. |
| 20261029000000_ad_unlock | LIKELY REFLECTED (tabela) | NOT PROVEN. |
| 20261030000000_add_machine_platform_foundation | LIKELY REFLECTED (tabelas) | NOT PROVEN. |
| 20261031000000_add_machine_stock_foundation | PARTIALLY REFLECTED / DRIFTED | `Product.quantity/stockManaged` ausentes. |
| 20261101000000_stock_movement_restrict | LIKELY REFLECTED | RESTRICT observado. |
| 20261102000000_stock_composite_tenant_fk | LIKELY REFLECTED | UNIQUE+FK composta presentes. |

**Conclusão B:** **FAIL** como acção segura imediata.

## 7. Análise da aplicação isolada (C) — migration JWT
- Independência/aditividade: **PASS** (nova tabela/índices/policies/grants; sem ALTER/DROP em tabelas existentes).
- Dependências: FK→`"User"(id)` compatível; roles alvo presentes no contexto 5437 — **PASS condicionado** a re-verificação pré-execução.
- Índices/FKs: PK, UNIQUE `jtiHash`, índices lookup/cleanup/usuário, FKs CASCADE/SET NULL — **PASS**.
- Policies/GUCs: alinhadas com `app.is_admin`/`app.user_id`. `ajr_self_insert` depende de owner binding no serviço futuro — **NOT PROVEN** segurança completa sem integração (MÉDIO).
- Grants: mínimos nomeados + REVOKE PUBLIC — **PASS**.
- Impacto histórico Prisma: **ALTO** negativo (objecto não rastreado).
- Rastreabilidade: registo operacional externo formal — **NOT EXECUTED**.
- Compatibilidade futura: **temporária aceitável** com dívida documentada; não ideal definitiva.
- **Veredicto:** Condicionalmente aceitável (temporária) com autorização, backup externo, verificações pré/pós e reconciliação posterior.

## 8. Recomendação final
**Escolhida (condicional): C — aplicação isolada controlada apenas do SQL JWT em futura Fase 1D autorizada.**  
**Justificação:** menor risco directo para dados face ao drift e prova insuficiente para A/B; objecto aditivo independente. Não resolve histórico Prisma (dívida explícita).

**Alternativa:** B somente após inventário completo e classificação provada por migration (colunas/tipos/defaults/índices/FKs/RLS/roles/grants), em ensaio com backup.  
**Rejeitadas agora:** A (baseline rápido/`db pull` implícito) — **FAIL**; B imediata/marcação em massa — **FAIL**.

**Condições que alteram decisão:** dependências inesperadas; roles/grants incompatíveis; descarte/reconstrução de 5437; inventário completo concluído.

**Pré-requisitos 1D (não executar):** autorização escrita 5437; backup externo verificado/restaurável; pré-checks (identidade DB, tabela ausente, roles, FK alvo, SQL final); revisão responsável; janela.  
**Ordem futura (não executar):** 1) pré-checks + backup; 2) aplicar SQL JWT controladamente; 3) verificar estrutura/RLS/policies/grants/ACLs e ausência de efeitos colaterais; 4) testes A/B isolamento/integridade; 5) registar rastreabilidade; 6) planear reconciliação B/A.  
**Rollback:** transacção quando possível; reversão aditiva autorizada dos objectos JWT; nunca reset. Backup obrigatório.  
**Critérios de sucesso 1D:** estrutura/RLS/policies/grants correctos; sem alterações colaterais; testes PASS; relatório evidenciado.

**BLOCKED se:** não houver backup externo verificado, inventário insuficiente para alterar decisão, ou evidência de dependência/role incompatível.

## 9. Plano de recuperação
1. Backup externo prévio. 2. Checksums/contagens críticas antes/depois. 3. Reverter só objectos aditivos JWT se degradação (autorizado). 4. Suspender novas migrations Prisma até reconciliação.

## 10. Critérios de aceitação (1C)
- Comparação A/B/C + matriz + recomendação + plano/rollback + autorizações: **PASS**.  
- Nenhuma escrita executada: **PASS**.  
- Worktree preservado: **PASS**.

## 11. Riscos residuais
- Evidência histórica parcial; drift maior possível — **NOT PROVEN**.  
- 5437 possivelmente construída por `db push`/scripts manuais — **NOT PROVEN**.  
- C sem reconciliação prejudica fluxo Prisma — **ALTO**.  
- `ajr_self_insert` depende de owner binding futuro — **MÉDIO**.  
- Stale-JWT gap permanece — **ALTO**.

## 12. Decisões que exigem autorização do utilizador
1. Autorizar Fase 1D (apenas SQL JWT em 5437) com backup externo prévio.  
2. Autorizar inventário completo para viabilizar B/A.  
3. Autorizar qualquer `prisma migrate resolve`/baseline/metadados (proibido).  
4. Autorizar reconstrução da staging (não recomendada sem necessidade).

**Resultado:** recomendação fundamentada entregue. **Estratégia NÃO executada. Migration NÃO aplicada. Staging NÃO alterada. Aguardar autorização explícita para Fase 1D (127.0.0.1:5437/mf_rls_staging). Produção fora do âmbito.**