# Relatório de correções de código (RLS multi-tenant, preparação)

Data: 2026-11-05 (sessão). Ambiente: `C:\Users\Administrador\Desktop\facturacao-angola`. **Nenhuma alteração em Supabase produção, roles/GRANT/REVOKE/RLS/BYPASSRLS, migrations de segurança em produção, nem reconciliação de stock (`--apply`).**

## Correções concluídas (código seguro, preservando comportamento)
1. **`api/stock/reports/route.ts`** — consultas em `runWithTenant(tenantId, tx, {userId})` (antes: Prisma global sem GUC).
2. **`api/desktop/offline-bootstrap/route.ts`** — snapshot (User/Tenant/Customer/Product/InvoiceDraft/CompanyBankAccount) em `runWithTenant`; removida duplicação de cauda.
3. **`api/company-profile/route.ts`** — GET/PUT em `runWithTenant`; transações de logo/perfil dentro do contexto tenant.
4. **`api/company-profile/bank-accounts/route.ts` e `[id]/route.ts`** — GET/POST/PUT em `runWithTenant`.
5. **`api/customers/route.ts` e `[id]/route.ts`** — CRUD em `runWithTenant`; mutações por `id` verificam pertença ao tenant na mesma tx antes de `update/delete`.
6. **`api/produtos/route.ts` e `[id]/route.ts`** — idem customers; verificação tenant antes de mutação por `id`; contagem InvoiceItem filtrada por tenant.
7. **`lib/invoice-draft-service.ts`** — `create/update/get/list/issueInvoiceDraft` executam operações DB em `runWithTenant`; `assertBankAccount` usa executor `tx`; assinatura passa `userId?` (compatível com chamadas existentes).
8. **`api/invoices/drafts/*`** — passam `userId` ao serviço; offline grant check usa `runWithTenant` para leitura de `User`.
9. **`lib/invoice-quota.ts`** — quota em `runWithTenant`; `hasAvailableUnlock` usa `tx` (mesmo contexto).
10. **`lib/ad-unlock-service.ts`** — `withTenantContext`: em executor global com `$transaction`, define `app.tenant_id/user_id/is_admin` (prep. RLS sem BYPASSRLS); sem transação extra quando executor transacional (ex.: emissão). **Nota:** requer validação sob políticas RLS reais (AdUnlock sem RLS em staging).

## Validação local
- `npx tsc --noEmit` (projeto `facturacao-angola`): **OK** após correções de tipagem/encoding/estrutura.
- Verificação estática: rotas alvo usam `runWithTenant`/ctx tenant conforme aplicável.

## Git
- Worktree contém alterações pré-existentes e novas (incl. WMS/reports). **Não** foi criado commit automático para não misturar trabalho alheio/não rastreado; preservar histórico exige commit seletivo/explicito. Recomendar: `git add` apenas ficheiros RLS-prep desta etapa + mensagem clara, ou stash/branch conforme fluxo do projeto.

## Não executado (conforme instruções)
- Supabase produção / roles/GRANT/REVOKE/RLS/BYPASSRLS / migrations segurança produção.
- Reconciliação de stock `--apply`.
- Alterações a NextAuth/Prisma Adapter/mecanismo de auth (apresentada solução técnica em `RLS_NEXTAUTH_COMPATIBILITY.md`).
