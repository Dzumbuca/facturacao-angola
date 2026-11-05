# RLS — Auditoria Business Documents (ETAPA 1)

## Escopo
- `src/lib/business-document-repository.ts` (Prisma)
- `src/lib/business-document-service.ts` (lógica/validação tenant)
- Rotas: `api/business-documents/route.ts`, `[id]/route.ts`, `[id]/status/route.ts`, `[id]/convert-to-invoice/route.ts`, `[id]/pdf/route.ts`
- Teste: `src/lib/business-document-service.test.ts` (**6 passed**)

## Achados antes da correção
- Repositório usava `client.$transaction`/`tx.$queryRaw` com filtros `tenantId`, mas **não** definia `app.tenant_id/app.user_id/app.is_admin` (GUC). Incompatível com RLS sem BYPASSRLS/força de políticas.
- Rotas usavam `getTenantReadAccess`/`getTenantWriteAccess` (fonte sessão/servidor) — OK. PDF lia `CompanyLogo` com Prisma global fora do ctx.

## Correções aplicadas
- **Repositório:** todas as operações DB executam via `runWithTenant(tenantId, tx=>..., {userId})` (findCompany/Customer/Products/create/find/updateDraft/transition/convert/list). Transações de negócio ficam dentro do ctx tenant (uma transação por operação; preserva semântica).
- **Serviço:** sem alteração de contrato; continua a exigir `tenantId` do contexto de acesso e a validar customer/products pertencentes ao tenant.
- **Rotas:** normalizadas; PDF lê logo em `runWithTenant`. Acesso sempre por `access.access` (sessão).

## Validação
- `npx vitest run src/lib/business-document-service.test.ts` — **6/6 passed** (mocks de repositório; sem regressão de contrato).
- `npx tsc --noEmit` — OK.

## Riscos remanescentes
- `convertToInvoiceDraft` cria `InvoiceDraft` no repositório (ctx tenant OK). Emissão posterior usa serviços/rotas já auditados; validar fluxo completo em 2-tenant/RLS.
- `createPrismaBusinessDocumentRepository(client)` aceita client custom; default usa `runWithTenant`+`prisma` global internamente — compatível com testes que injetam repo mock.
