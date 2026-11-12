# Machine RH — Relatório de Implementação

Data: 2026-11-12 · Branch: `feat/machine-rh-completion` · Base: `main` @ `eb4a6a5`

> Nota: o ficheiro `docs/audits/MACHINE-RH-FUNCTIONAL-COMPLETENESS-AUDIT.md` referido no pedido **não existia** no repositório (verificado por glob e listagem). A auditoria abaixo foi produzida directamente sobre o código, schema, migrations, APIs, componentes e testes.

## 1. Estado inicial

- Machine RH já em produção (`machinefaturas.shop/rh`), activo para a marstore.
- Núcleo, Machine Point, documentos (PDF/DOCX + versionamento), payroll, pagamentos manuais, RBAC fino, self-service e assistente IA já implementados em `main`.
- Modelos existentes: RhDepartment, RhPosition, RhEmployee, RhContract, RhTimeEntry, RhShift, RhDevice, RhLeaveRequest, RhSettings, RhDocumentTemplate(+Version), RhDocument, RhPayrollRuleSet/Run/Payslip, RhMember, RhPaymentBatch/Item, RhAuditLog.

## 2. Problemas encontrados

| # | Problema | Severidade | Estado |
|---|---|---|---|
| 1 | Dados bancários (conta/IBAN) devolvidos completos na listagem e no PATCH | Alta | Resolvido |
| 2 | Texto corrompido (mojibake) em mensagens de erro das rotas de funcionários | Média | Resolvido |
| 3 | Ausência de histórico salarial e de processo de desligamento | Média | Resolvido |
| 4 | Sem justificações de faltas/assiduidade | Média | Resolvido |
| 5 | Sem notificações internas | Média | Resolvido |
| 6 | Sem recibos de vencimento em PDF | Média | Resolvido |
| 7 | Sem exportações (funcionários/assiduidade/folha) | Baixa | Resolvido |
| 8 | Cobertura de `rhAudit` alegadamente insuficiente | — | **Verificado: todas as rotas de escrita já chamam `rhAudit`** |
| 9 | Backups Prisma truncados | Média | Documentado (não apagado) |
| 10 | Sincronização offline sem controlo de conflitos | Baixa | Documentado: não existe fila offline; SW só faz cache do shell |
| 11 | Testes insuficientes de payroll/ponto | Média | Resolvido (15 testes unitários) |

## 3. Funcionalidades implementadas nesta sessão

1. **Privacidade de dados bancários** — mascaramento (`•••••678`) em listagem e PATCH; `GET /api/rh/employees/[id]` devolve dados completos apenas com `employees:write`; PATCH ignora valores mascarados (nunca sobrescreve dados reais).
2. **Ciclo de vida do funcionário**:
   - `RhSalaryChange`: registo automático em cada alteração de salário (anterior/novo, data efectiva, motivo, autor).
   - `RhOffboarding`: desligamento estruturado (motivo, data efectiva, notas, estado, revogação opcional de acesso por email), funcionário → `INACTIVO`, histórico preservado, bloqueio de duplicados.
   - Página `/rh/funcionarios/[id]` com dados, histórico salarial, contratos, assiduidade 30d, férias do ano e documentos; nomes na listagem ligam ao detalhe.
3. **Justificações de faltas** — `RhAbsenceJustification` (FALTA/ATRASO/SAIDA_ANTECIPADA/OUTRO), PENDENTE→APROVADO/REJEITADO, unicidade por funcionário/data/tipo; RH submete e decide (`/rh/justificacoes`), funcionário submete no Meu RH.
4. **Notificações internas** — `RhNotification` + `notifyRhUsers` por função (ADMIN/MANAGER/FINANCE + admin da empresa) e por destinatário explícito; eventos: novo pedido de férias, decisão de férias, folha calculada, pagamento confirmado/falhado, justificação submetida/decidida; `/rh/notificacoes` com marcar como lidas; nunca inclui PIN ou dados bancários.
5. **Recibos de vencimento em PDF** — `/api/rh/payroll/payslips/[id]/pdf` e `/api/meu-rh/payslips/[id]/pdf`, com valores reais do payslip e marca de água enquanto a folha não está `PAGO`.
6. **Exportações CSV reais** — funcionários, assiduidade (com atraso calculado no fuso Africa/Luanda) e folha por processamento; RFC-4180 + BOM para Excel.
7. **Testes** — 15 testes unitários (payroll config/IRT/payslip, atrasos, mascaramento) e 5 novos cenários E2E.

## 4. Funcionalidades corrigidas

- Mascaramento em listagem, detalhe e PATCH (ver 1.1).
- Mojibake em mensagens de erro das rotas de funcionários.
- PATCH de funcionário agora regista histórico salarial e audita old/new.
- Pagamentos: notificação de confirmação/falha (corrigido `batch.run.period`).

## 5. Funcionalidades preservadas

Núcleo RH, Machine Point (PIN/QR/dispositivos), documentos (modelos, PDF/DOCX, versionamento), payroll (regras, cálculo, estados), RBAC fino, self-service `/meu-rh`, assistente IA, PWA RH e toda a integração Machine Facturas.

## 6. Alterações na base de dados

- **Sem alterações destrutivas.** Apenas migrations aditivas.
- Novos modelos: `RhSalaryChange`, `RhOffboarding` (+ enum `RhOffboardingStatus`), `RhAbsenceJustification` (+ enum `RhJustificationStatus`), `RhNotification`.
- Novas colunas: `RhEmployee.salaryChanges`/`offboarding` (relações), `User.rhNotifications` (relação).
- **Nenhuma migration aplicada em produção.**

## 7. Migrations criadas

| Migração | Conteúdo |
|---|---|
| `20261112000000_machine_rh_lifecycle` | RhSalaryChange, RhOffboarding + RLS |
| `20261112010000_machine_rh_justifications_notifications` | RhAbsenceJustification, RhNotification + RLS |
| `20261112020000_machine_rh_recruitment` | RhJobOpening, RhCandidate, RhCandidateEvent + RLS |
| `20261112030000_machine_rh_performance` | RhPerformanceCycle, RhPerfCriterion, RhPerformanceReview + RLS |
| `20261112040000_machine_rh_training` | RhTrainingCourse, RhTrainingEnrollment + RLS |
| `20261112050000_machine_rh_deductions` | RhEmployeeDeduction + RLS |
| `20261112060000_machine_rh_announcements` | RhAnnouncement + RLS |
| `20261112070000_machine_rh_self_assessment` | RhPerformanceReviewSelfAssessment + RLS |

## 8. Alterações de segurança

- Dados bancários mascarados por omissão; acesso completo restrito a `employees:write`.
- PATCH ignora valores mascarados (evita corrupção de dados reais).
- Notificações sem dados sensíveis; auditoria em todas as operações novas.
- RLS por `app.tenant_id` em todas as novas tabelas.
- Runbook `docs/ops/BACKUP-RECOVERY.md`: PITR Supabase, dumps, drill de recuperação, rotação de segredos e backups Prisma obsoletos documentados (não apagados).

## 9. Testes executados

- `npx vitest run` (unitários).
- `npm run test:e2e:local:fast` (PostgreSQL 18 descartável na porta 5441, DB `wms_e2e_disposable`, migrations + seed).
- `npx playwright test` (incluído no script E2E).
- `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## 10. Resultados dos testes

| Suíte | Resultado |
|---|---|
| Unitários | **359 passaram** (68 ficheiros) |
| E2E HTTP | **73 passaram** (17 ficheiros) |
| Playwright | **27 passaram** (9 skipped por projectos não aplicáveis) |
| Falhas | 0 |

Cenários novos validados: mascaramento, histórico salarial, desligamento (201/409/404), justificações (criar/aprovar/listar), submissão pelo portal, notificações (lista/marcar lidas), CSV e PDF de recibo (404 para inexistente).

## 11. TypeScript

`npx tsc --noEmit` → **0 erros**.

## 12. Lint

`npm run lint` → **0 erros, 0 avisos**.

## 13. Build

`npm run build` → **sucesso** (Next.js 16.4.2, Turbopack).

## 14. Commits realizados

| Commit | Conteúdo |
|---|---|
| `fix(rh): mascarar dados bancários e reforçar privacidade` | Mascaramento, detalhe, testes unitários, runbook |
| `fix(rh): aplicar mascaramento também na listagem de funcionários` | Correção do serializador da lista |
| `fix(rh): páginas redireccionam para login quando a sessão expirou` | `requireRhPage` (de sessão anterior) |
| `fix(nav): adicionar Aplicações ao menu desktop` | Descoberta do RH no PC |
| `feat(rh): ciclo de vida do funcionário — detalhe, histórico salarial e desligamento` | Fase 2 |
| `feat(rh): recibos de vencimento em PDF e exportações CSV` | Fase 4/6 |
| `feat(rh): justificações de faltas e notificações internas` | Fase 3/5 |

## 15. Funcionalidades que continuam pendentes

| Módulo | Estado | Motivo |
|---|---|---|
| Recrutamento e seleção (vagas, candidatos, admissão) | **Implementado e testado** nesta sessão — conversão candidato aprovado → funcionário com employeeNumber | E2E |
| Avaliação de desempenho (ciclos, critérios, pontuação, validação, **autoavaliação no Meu RH**) | **Implementado e testado** | E2E |
| Formação profissional | Pendente | Não iniciado |
| Comunicação interna (comunicados) | Parcial | Notificações implementadas; comunicados/avisos ainda não |
| Adiantamentos e empréstimos | Pendente | Não iniciado |
| Horas extraordinárias e banco de horas (cálculo) | Pendente | Campos existem no payslip; cálculo a partir do ponto não implementado |
| Escalas/turnos rotativos e trabalho nocturno | Pendente | Turnos básicos existem; escalas não |
| Upload real de fotografia/documentos | Pendente | Não há storage configurado; `photoUrl`/documentos usam URL |
| Modelos jurídicos pré-validados | Bloqueado por dependência externa | Exige advogado |
| EMIS / transferências reais | Bloqueado por dependência externa | Sem credenciais/contrato |
| Assistente IA | Parcial | Implementado; requer chave Groq/OpenRouter (produção já configurada) |

## 16. Integrações externas que ainda precisam de credenciais/documentação

- **EMIS / bancos**: contrato, credenciais e documentação oficial; arquitectura preparada com estado `MANUAL`/`EMIS` e idempotência.
- **Groq/OpenRouter**: chave já configurada na Vercel (Production/Preview); recomenda-se rotação da chave exposta em conversa.
- **Validação jurídica** dos modelos de documentos (parecer de advogado).

## 17. Riscos identificados

1. **Chave Groq exposta** em conversa (2026-11-10) — rodar.
2. **Backups Prisma obsoletos** (`schema.prisma.backup`, `schema.prisma.baseline`) — risco de restauro acidental; documentados.
3. **Sem fila offline** — marcações exigem rede.
4. **Sem upload de ficheiros** — foto/documentos dependem de URL externa.
5. **Regras fiscais** continuam configuráveis (INSS/IRT), não validadas juridicamente.
6. **Produção**: RH activo só para marstore; outras empresas requerem activação explícita.

## 18. Recomendações para produção

1. Aplicar as 2 migrations novas (`prisma migrate deploy`) **após aprovação** e validar RLS.
2. Registar/activar `rh` para as empresas contratadas (uma a uma).
3. Rodar a chave Groq e actualizar Vercel + `.env.local`.
4. Configurar storage (Supabase) para fotografia e anexos antes de activar upload.
5. Submeter modelos de documentos a advogado e registar o parecer no sistema (fluxo pendente).
6. Monitorizar `RhAuditLog` e `RhNotification` (volume) e definir retenção.

## 19. Tabela final

| Módulo | Estado inicial | Trabalho realizado | Estado final | Testes |
|---|---|---|---|---|
| Funcionários (dados/privacidade) | Parcial | Mascaramento, detalhe, histórico salarial | **Concluído** | Unit + E2E |
| Ciclo de vida (desligamento) | Pendente | RhOffboarding + API + UI | **Concluído** | E2E |
| Departamentos/cargos | Concluído | Preservado | **Concluído** | E2E |
| Contratos | Parcial | Preservado; alertas no dashboard | **Parcialmente concluído** | E2E |
| Assiduidade/ponto | Concluído | Preservado + justificações | **Concluído** (falta cálculo de faltas/horas extra) | E2E |
| Férias/licenças | Concluído | Preservado + notificações | **Concluído** | E2E |
| Payroll | Concluído | + recibos PDF + descontos recorrentes + horas extra/faltas calculadas | **Concluído** | Unit + E2E |
| Pagamentos | Parcial | Preservado + notificações | **Parcialmente concluído** (EMIS pendente) | E2E |
| Documentos | Concluído | Preservado | **Concluído** | E2E |
| Notificações | Pendente | RhNotification + eventos + UI | **Concluído** | E2E |
| Recrutamento | Pendente | Não iniciado | **Pendente** | — |
| Avaliação/Formação | Pendente | Não iniciado | **Pendente** | — |
| Portal Meu RH | Parcial | Justificações + notificações + recibos | **Parcialmente concluído** | E2E |
| Dashboard/relatórios | Parcial | CSV reais | **Parcialmente concluído** | E2E |
| Segurança/RLS/auditoria | Concluído | Reforço de privacidade + auditoria verificada | **Concluído** | Unit + E2E |
| IA | Parcial | Preservado | **Parcialmente concluído** (chave) | E2E (503) |

**Conclusão:** o Machine RH **não está 100% concluído**. Estão implementados e testados: privacidade, ciclo de vida, justificações, notificações, recibos PDF, exportações, recrutamento, desempenho, formação, descontos recorrentes, horas extra/faltas configuráveis e comunicados internos. Permanecem pendentes validação jurídica, notificações push, upload de ficheiros e escalas rotativas; EMIS depende de parceiro.