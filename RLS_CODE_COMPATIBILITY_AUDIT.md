# Auditoria de compatibilidade RLS (código, preparação)

**Escopo:** mapeamento e correções seguras de contexto tenant/GUC no código da aplicação. **Sem** alterações em Supabase produção, sem roles/GRANT/REVOKE/RLS/BYPASSRLS/migrations em produção, sem `--apply` de reconciliação.

## Cobertura aplicada (ETAPA 1, parcial/segura)
| Área | Estado | Detalhe |
|---|---|---|
| `api/stock/reports` | CORRIGIDO | Leitura em `runWithTenant` com `userId`. |
| `api/desktop/offline-bootstrap` | CORRIGIDO | Snapshot tenant em `runWithTenant`; role VIEWER/ACTIVE verificada; cauda duplicada removida. |
| `api/company-profile` + `bank-accounts*` | CORRIGIDO | GET/PUT/POST em `runWithTenant` (substitui `$transaction` direto sem GUC). |
| `api/customers*` | CORRIGIDO | CRUD em `runWithTenant`; `update/delete` por `id` apenas após verificação tenant na tx. |
| `api/produtos*` | CORRIGIDO | CRUD em `runWithTenant`; verificação tenant antes de mutação por `id`. |
| `invoice-drafts` rotas + `lib/invoice-draft-service.ts` | CORRIGIDO | Serviço usa `runWithTenant`; rotas passam `userId`. Emissão delega a `issueInvoice` (já usa `runWithTenant`). |
| `lib/invoice-quota.ts` | CORRIGIDO | Leitura quota/tenant em `runWithTenant`; claim ad-unlock usa executor `tx`. |
| `lib/ad-unlock-service.ts` | PREP | Define `app.tenant_id/user_id/is_admin` em tx quando executor global; compatível com executor tx existente. |

## Cobertura existente (já com tenant ctx, confirmar)
Rotas WMS/stock principais (`api/stock/*` exceto gaps), `lib/invoice-service.ts`, `lib/stock-service.ts`, `lib/tenant-db.ts`.

## Gaps/RISCOS remanescentes (não alterados automaticamente)
- **NextAuth/Prisma Adapter** (`lib/auth.ts`, `User/Account/Session/VerificationToken`): ver `RLS_NEXTAUTH_COMPATIBILITY.md` — não alterar sem prova.
- **Auth lifecycle**: `api/auth/*` (register, forgot/reset/verify, change-unverified-email), onboarding, session refresh — desenho especial sob RLS.
- **Admin/global**: operações `plan/payment/proof/[id]` (admin) e outras áreas admin — requerem `app.is_admin`/políticas explícitas, sem acesso empresarial indiscriminado. Não assumir `tenantId` de payload.
- **`lib/business-document-repository.ts`**: usa `client.$transaction`/raw SQL com filtros `tenantId`, mas não chama `runWithTenant`/`set_config`. Callers devem executar sob ctx tenant; revisar integração.
- **Email/auth tokens**: `email-actions.ts` e afins — classificar tabelas globais vs tenant.
- **InvoiceItem sem tenantId**: isolamento depende de `Invoice` + políticas/joins; validar sob RLS real.
- **AdUnlock tabela**: sem RLS em staging; política tenant necessária em ambiente preparado.

## Nota de comportamento
- `runWithTenant` abre transação Prisma e define GUC `LOCAL` (`true`) na transação — necessário para RLS por request quando executor é dedicado. Validar pooling/Supabase (PgBouncer transaction mode) antes de ativar RLS real.
- Correções preservam filtros `tenantId` na aplicação (defesa em profundidade) e adicionam ctx GUC onde seguro.
