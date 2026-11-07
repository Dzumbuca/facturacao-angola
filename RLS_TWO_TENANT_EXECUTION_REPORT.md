# RLS Two-Tenant Execution Report (real PostgreSQL + RLS + role sem BYPASSRLS)

- DB: postgresql://postgres:testpass@127.0.0.1:5437/mf_rls_staging (local 5437, independente; não Supabase produção; wms_staging 5436 não modificado)
- Role: mf_app_nobypass (NOBYPASSRLS, NOSUPERUSER)
- Resultado: **19 passed / 0 failed**

## Casos
| Caso | Resultado | Detalhe |
|---|---:|---|
| A reads own customers | PASS | count=1 |
| A cannot read B customers | PASS | count=0 |
| A cannot modify B customer | PASS | Cliente B |
| A cannot delete B customer | PASS | remaining=1 |
| A cannot insert row with tenantId B (WITH CHECK) | PASS | new row violates row-level security policy for table "Customer" |
| A cannot change tenantId of own row to B | PASS | new row violates row-level security policy for table "Customer" |
| B cannot read A products | PASS | ok |
| No tenant context returns no business rows | PASS | rows filtered |
| No tenant context sees zero customers | PASS | count=0 |
| Normal user cannot read AdminAuditLog | PASS | count=0 |
| Missing context: zero invoices | PASS | ok |
| A cannot read B invoices | PASS | ok |
| A cannot read B payments | PASS | ok |
| A cannot read B stock movements | PASS | ok |
| A cannot read B warehouses | PASS | ok |
| A cannot read B business documents | PASS | ok |
| A cannot read B invoice items (via Invoice) | PASS | ok |
| A can read own invoice items (via Invoice) | PASS | ok |
| Admin context can read AdminAuditLog table | PASS | ok |

## Cobertura
- Leitura própria/bloqueio cruzado A<->B (Customer,Product,Invoice,Payment,StockMovement,Warehouse,BusinessDocument).
- InvoiceItem isolado via Invoice (B bloqueado, A ok).
- Modificação/eliminação cruzada bloqueadas (estado verificado via sessão postgres seed).
- INSERT com tenantId alheio: WITH CHECK bloqueado. UPDATE de tenantId: bloqueado.
- Sem contexto: contagens zero. Utilizador normal sem acesso AdminAuditLog; admin context ok.

## Não coberto
- HTTP/NextAuth/UI/OAuth/reset/verify/onboarding via app.
- API/E2E (emit invoice, transfers complexos, relatórios/export/SAFT endpoints, admin UI, cron HTTP).
- Dataset RLS ampliado (Supplier, bank accounts, PWS/lots/adjustments/transfers, PlanPayment etc.).
