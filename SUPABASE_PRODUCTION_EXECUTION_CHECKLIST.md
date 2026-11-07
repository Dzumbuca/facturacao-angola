# Supabase Production Execution Checklist — Machine Facturas

**Uso:** autorização operacional **separada** da preparação. Não avançar sem todos os itens aplicáveis marcados e aprovados pelo responsável.

## 0. Autorização
- [ ] Autorização explícita: **“autoriza produção”** (já recebida como intenção; **não suficiente** para execução).
- [ ] **Projeto/alvo confirmado:** project ref / host / DB (sem expor segredos no chat).
- [ ] **Janela aprovada:** data, hora, timezone.
- [ ] **Responsável pela execução:** nome/função/contacto.
- [ ] **Responsável por validação pós-deploy:** pode ser o mesmo ou diferente.
- [ ] **Plano/SQL aprovado** após adaptação ao alvo real (SUPABASE_PRODUCTION_MIGRATION.sql revisto).

## 1. Pré-requisitos técnicos
- [ ] **Backup/snapshot recente** criado e retenção confirmada.
- [ ] **Recuperação verificada** (procedimento conhecido; teste de restore conforme política).
- [ ] **Acesso administrativo** ao projeto Supabase/DB validado (sem partilhar credenciais).
- [ ] **Role Prisma/app real em produção identificada** (current_user, superuser, BYPASSRLS, owner).
- [ ] **Estado real em produção confirmado:** RLS/FORCE/policies/grants/default privileges/owners/views/functions (queries read-only).
- [ ] **Divergências vs staging documentadas** (advisor reportava 26 tabelas sem RLS etc.).

## 2. Staging representativo
- [ ] RLS/policies/FORCE/role app testados em staging alinhado com produção.
- [ ] Regressão aprovada: login/logout, Google (se usado), onboarding, clientes, faturação, produtos/serviços, fornecedores/compras, stock/armazéns, pagamentos, relatórios, documentos, admin.
- [ ] Isolamento multi-tenant validado (2+ tenants, leitura/escrita, cross-tenant negativo).
- [ ] NextAuth adapter (Account/Session/VerificationToken/User) validado sob modelo final.
- [ ] Transações/raw SQL (AdUnlock, relatórios, admin, cron) validados.

## 3. Execução (quando autorizado)
- [ ] Comunicar início da janela.
- [ ] Executar apenas SQL revisto, em etapas pequenas, com checkpoints.
- [ ] Não remover BYPASSRLS da role app antes de FORCE+políticas+grants+testes.
- [ ] Registar evidência (outputs/IDs de mudança) sem segredos.

## 4. Validação pós-execução
- [ ] Smoke tests críticos passam.
- [ ] Isolamento cross-tenant confirmado.
- [ ] non/authenticated sem acesso indevido confirmado.
- [ ] Logs/erros monitorizados.

## 5. Rollback / paragem
- [ ] Critérios de paragem acordados (auth quebrada, faturação crítica, leak, lockout).
- [ ] SUPABASE_ROLLBACK_PLAN.sql revisto; **restauro de snapshot** pronto como caminho principal.
- [ ] Contactos de escalonamento disponíveis.

## 6. Fecho
- [ ] Documentar resultado real, desvios, e tarefas remanescentes.
- [ ] Atualizar SUPABASE_SECURITY_VALIDATION_REPORT.md com evidência de produção **após** execução autorizada.
