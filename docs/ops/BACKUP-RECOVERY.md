# Backup e Recuperação — Machine Facturas / Machine RH

> Procedimento de referência. Não substitui a política oficial do Supabase; alinha-se com a arquitectura actual (Supabase PostgreSQL + Prisma migrations + Vercel).

## 1. Fontes de verdade

| Item | Fonte | Nota |
|---|---|---|
| Schema | `prisma/schema.prisma` | Único schema válido |
| Migrations | `prisma/migrations/` | Ordem cronológica; produção via `prisma migrate deploy` |
| RLS | `prisma/rls-machine-platform.sql` | Idempotente; aplicar após restore |
| Backups de dados | Supabase (PITR + dumps) | Autoridade sobre dados |

## 2. Backups históricos obsoletos (NÃO restaurar)

Verificados a 2026-11-11:

| Ficheiro | Tamanho | Data | Estado |
|---|---|---|---|
| `prisma/schema.prisma.backup` | ~4 KB | 2026-10-19 | **Obsoleto/truncado** — anterior a 10 migrations (RH core, Machine Point, Payroll, Documents, Payments, Members). NÃO reflete o schema actual (~66 KB). |
| `prisma/schema.prisma.baseline` | ~3.9 KB | 2026-10-19 | Snapshot inicial da plataforma. Igualmente obsoleto para uso actual. |

**Regra:** nunca restaurar estes ficheiros por cima do schema. A recuperação de schema faz-se sempre por `git checkout <commit> -- prisma/schema.prisma` + `prisma migrate deploy` contra a base de dados. Preservados por decisão de auditoria (não apagar sem necessidade comprovada); recomenda-se mover para `prisma/archive/` numa futura limpeza autorizada.

## 3. Backup lógico (procedimento recomendado)

1. **Supabase PITR**: confirmar retenção activa no projecto (Dashboard → Database → Backups). PITR é a primeira linha de recuperação.
2. **Dump lógico semanal (opcional, defesa em profundidade)**:
   ```bash
   pg_dump "$DATABASE_URL" --schema=public --no-owner --format=custom -f backups/db-$(date +%F).dump
   ```
   Guardar fora da máquina de desenvolvimento; nunca em repositório git.
3. **Dump só de schema** (para revisão humana):
   ```bash
   pg_dump "$DATABASE_URL" --schema-only > backups/schema-$(date +%F).sql
   ```

## 4. Recuperação (drill)

1. Criar base de dados descartável (como nos testes E2E locais: PostgreSQL 18 na porta 5441, `wms_e2e_disposable`).
2. `pg_restore` do dump mais recente.
3. Aplicar RLS idempotente: `psql -f prisma/rls-machine-platform.sql`.
4. `npx prisma migrate status` → deve reportar "Database schema is up to date".
5. Smoke test: login, criar funcionário de teste, apagar funcionário de teste, `prisma.rhAuditLog.count()` regressa ao valor original.
6. **Nunca** executar o drill contra a base de produção.

## 5. Rotação de segredos

- Credenciais em `.env*` são locais e gitignored (`git check-ignore .env.local` deve corresponder).
- Se um segredo foi exposto (ex.: colado em chat/issue): revogar no fornecedor, criar novo, actualizar Vercel (Production/Preview) e `.env.local`. Exemplo real registado: chave Groq exposta em conversa (2026-11-10) → rotação recomendada.
- Nunca imprimir valores de `.env` em relatórios, logs ou issues.

## 6. Sincronização offline (PWA)

- O service worker RH (`/rh-sw.js`) faz **cache do shell apenas**. Não existe fila de mutações offline; não há conflitos de escrita a tratar.
- Limitação documentada: marcações de ponto exigem rede. Qualquer futura fila offline terá de implementar resolução de conflitos server-side (dedupe por `employeeId+type+janela temporal`) antes de ser activada.
