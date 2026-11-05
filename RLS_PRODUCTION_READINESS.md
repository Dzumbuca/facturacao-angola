# RLS_PRODUCTION_READINESS.md
## Estado
**NÃO PRONTO PARA PRODUÇÃO.** Isolamento multi-tenant demonstrado **apenas** em DB PostgreSQL local independente (`mf_rls_staging`, 5437) com role `mf_app_nobypass` (`NOSUPERUSER`, `NOBYPASSRLS`) e subconjunto de tabelas/casos. Produção Supabase **não foi alterada**.

## Evidência positiva
- RLS ativo e políticas com `USING` + `WITH CHECK` aplicadas em tabelas empresariais/admin selecionadas (local staging). `InvoiceItem` via parent `Invoice`; `AdUnlock` por `tenant_id`.
- Roles de teste criadas/verificadas sem SUPERUSER/BYPASSRLS (local).
- 19/19 testes SQL executados passaram com role sem BYPASSRLS (cross-read/write/delete bloqueados, insert/tenantId spoof bloqueados, sem contexto = zero, admin table protegida).
- Código (commits `dc230c0`, `ec866b7`, `5e38f63`): `runWithTenant`/GUC propagados em áreas prioritárias (stock reports, offline-bootstrap, company/customers/produtos, invoice drafts+quota/ad-unlock prep, business-documents repo, payment/report/saft/receipt, leituras invoice, stock purchase ctx). `tsc --noEmit` OK, `npm run build` OK, 15 unit tests relevantes OK.

## Bloqueios para produção
1. **Auth/NextAuth/Prisma Adapter não validado sob RLS** (regressão provável). Tabelas auth sensíveis excluídas do protótipo RLS.
2. **Admin/cron cross-tenant** requer executor `app.is_admin`/role explícita + auditoria; código admin atual usa Prisma/tx global.
3. **Cobertura incompleta:** nem todas tabelas tenant (`Supplier`, stock lots/adjustments/transfers/PWS/receptions, `CompanyBankAccount/Logo`, `PlanPayment` etc.) exercitadas por testes; rotas/API/E2E não exercitadas contra DB RLS.
4. **WMS staging 5436** tem políticas antigas/incompletas (sem WITH CHECK em vários casos) — inspecionado, **não modificado**. Divergência de schemas entre ambientes requer plano de migração específico.
5. **Pooling/PgBouncer:** GUC `LOCAL` ok por transação; validar em Supabase pooler dedicado.
6. **`FORCE ROW LEVEL SECURITY`** não aplicado globalmente (avaliar por tabela/owner). Policies para PUBLIC; refinar para roles específicas em produção.

## Critérios de aceitação (FASE 9)
| Critério | Estado |
|---|---|
| RLS ativo nas tabelas abrangidas | **Parcial** (local staging; subset completo definido em SQL) |
| Role app sem BYPASSRLS | **Parcial** (local `mf_app_nobypass`; produção não) |
| Testes isolamento com PostgreSQL real | **Parcial** (19 casos SQL; sem API/E2E/auth) |
| Sem acesso cruzado entre tenants | **Passou no subset testado** |
| INSERT/UPDATE respeitam WITH CHECK | **Passou no subset testado** |
| Operações admin controladas | **Desenho apenas**; não comprovado em runtime |
| Sem regressões funcionais | **Parcial** (build/TS/unit subset ok; regressão E2E pendente) |

## Autorização necessária antes de produção
Aprovação explícita + alvo (project ref/host/DB) + janela + responsável + plano/SQL aprovado + backup/snapshot + validação pós-mudança. Sem isso: **nenhuma alteração em produção**.
