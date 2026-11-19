# MACHINE FACTURAS — FASE A13
## Auditoria Integral, Aprovação de Operações Críticas e Resiliência Distribuída

**Branch:** `feat/machine-facturas-a13-audit-distributed-hardening`
**Origem:** `feat/machine-facturas-a12-financial-audit-distributed-security` (HEAD `3632978`)
**Data:** 2026-11-18
**Ambiente:** PostgreSQL 18.6 descartável em `127.0.0.1:55432` (`a13_check`).
**Staging / produção / Supabase / Vercel:** nunca tocados.

---

## 1. Resultado final

**A13 PARTIALLY COMPLETE.**

Entregues (5 commits):
1. **Approval workflow** — `ApprovalRequest`/`ApprovalDecision`; segregation-of-functions enforced; idempotent execution; integração audit; usuário não pode aprovar o próprio pedido (errors thrown in testes).
2. **Audit chain verifier** — `audit-verifier.ts` read-only com `VALID`/`INVALID`/`INCOMPLETE`; integration tests detect tampering with hash-anchored events.
3. **Audit coverage estendida** — FT (issueInvoice), NC (issueCreditNote), CSV/Excel exports now log events; PDF/Excel abrintos ligados.
4. **UI for audit** — `/contabilidade/auditoria` com tabela hash-chained + endpoint `/api/contabilidade/auditoria/verify`.
5. **Leasea-based distributed semaphore** — `EmissionLease` + `emission-lease.ts` (acquire/release, reaping of expired leases, PG-native timestamp for expiry); FT issuance path kept on the **proven A11 in-process semaphore** because of a known deadlock under high concurrency that the lease approach produced (33/50 in earlier tests). The lease implementation is committed for cross-process usage but **not enabled in the FT hot path**.

Lacunas (PARTIALLY):
- Reabertura de exercícios via approval workflow — `reopenExercise` não wired (apenas aprovação genérica)
- Testes multi-processo com 2-3 processos independentes: NÃO demonstrado
- Crash recovery com processo crash-in-flight durante FT emissão: NÃO demonstrado
- Auditoria live filtrada por tenant na UI: search-by-correlationId parcialmente implementado; sem procura por actor/data avançada
- PDF/Excel auditados mas não testados com dados reais
- Hash chain só por tenant; sem assinatura criptográfica entre tenants
- Notas de crédito auditadas quanto à emissão; reversões adicionais não verificadas

## 2. Commits criados em A13

```
37cd077 feat(A13): audit log UI with hashChain action + dedicated /api/.../auditoria/verify endpoint
83474ec feat(A13): lease-based distributed emission capacity + verifier/integration tests
1d084be feat(A13): audit log for PDF and Excel exports
cc236f3 feat(A13): audit chain verifier — read-only, detects tamper, returns INVALID/VALID/INCOMPLETE
4975546 feat(A13): approval workflow — segregation of functions + idempotent execution
```

Total: 5 commits.

## 3. Migrations criadas

```
20261128000000_a13_approval_workflow/migration.sql
```

Inclui:
- `ApprovalRequest` (tenant-scoped table for approval workflow) + índices
- `EmissionLease` (tenant-scoped table for distributed leases) + índices

**65 migrations** total validadas em PG fresh `a13_check`.

## 4. Testes

| Suite | Resultado |
|---|---|
| Full suite | **557 passed / 8 skipped** |
| A13 approval workflow integration | ✅ 2/2 |
| A13 audit verifier integration | ✅ VALID + INVALID detected correctly |
| A13 FT+NC audit emission test | ✅ eventos atômicos com transação |
| A11 concurrency | ✅ 20/50/100/200 passing (semaphore in-process used) |
| `npx vitest run` fresh PG | ✅ 557/557 |
| Build (`node tools/scripts/build.mjs`) | exit 0 |
| TypeScript | exit 0 |
| Migration deploy fresh PG | 65/65 OK |

## 5. Bug descoberto e corrigido durante A13

**Timezone drift Node→PG** — originalmente o `processId` e `expiresAt` eram calculados com `Date.now()` no cliente e passados para PG (que estava 1 hora atrás), produzindo leases já expirados no momento da criação. Fix: usar `NOW() + INTERVAL '60 seconds'` diretamente em SQL PG.

**Unique index in EmissionLease** — piloto `state='ACTIVE'` bloqueava 2 leases simultâneos para a mesma (tenant, operation). Fix: criada non-unique index; reaping agora corretivo.

## 6. Limitações

| Limitação | Porque |
|---|---|
| Cross-process test (3 independent Node processes) não demonstrado | Apenas 1 processo usado neste ambiente |
| FT emission lockado em A11 in-process semaphore (max=2) | Lease approach produziu deadlocks (P2010) em >50 concurrent FTs — incorrectly created unique partial index contention; reverted to known-good A11 semaphore |
| Approval workflow não ligado a específico operations (e.g. reabrir período) | Genérico, não wired ainda; tarefa exigia mais sessões |
| Sem hash chain cross-tenant, apenas por tenant | Outra implantação seria necessário |
| UI de auditoria mínima | Apenas list+filter; sem export browser-friendly para PDF/Excel |

## 7. Staging/Production/Supabase — não tocados

- Apenas PG descartável `a13_check` utilizado.
- Nenhuma migration fora do PG descartável.
- Nenhuma alteração em `.env`.

## 8. Verdicto

**A13 PARTIALLY COMPLETE.**

O que entreguei:
- 1 migration (2 tabelas novas)
- Approval workflow genérico com seg-of-functions + integração audit
- Audit chain verifier funcional (read-only)
- Audit trail em FT, NC, exports PDF/Excel/CSV
- UI de auditoria com tabela
- Build verde

O que NÃO foi testado / não consegui comprovar:
- Cross-process 3-process FT concurrency com leases
- Crash recovery
- Approval workflow aplicado a operações reais de reabertura
- AGT / ROC compliance

**Não declaro A13 COMPLETE.**
