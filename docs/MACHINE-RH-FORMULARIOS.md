# Machine RH — Descrição escrita de todos os formulários

Versão referenciada ao commit `8346f8d…2f485f8` (main, 2026-11-12). Descreve cada formulário do módulo RH em produção, os seus campos, regras, endpoint e efeito quando submetido.

> Convenções
> - **Página** — rota onde o formulário vive (`/rh/…`)
> - **Endpoint** — API invocada no submit
> - **Obrigatório** — campos com `*`
> - **Permissão** — papel mínimo que acede e submete
> - **Efeito** — o que o submit faz na base de dados + side effects (auditoria, notificação, `router.refresh()`)
>
> Todos os formulários auditam a ação (`RH_<ACTION>` via `rhAudit`) e actualizam a página (`router.refresh()`). Multi-tenant isolado por `tenantId`; RLS aplicado no Supabase.

---

## Índice de formulários

**Cadastros / estrutura**
1. [Funcionários](#1-funcionários-novorouseditar) · `/rh/funcionarios`
2. [Departamentos](#2-departamentos) · `/rh/departamentos`
3. [Cargos](#3-cargos) · `/rh/cargos`
4. [Horários / Turnos](#4-horários--turnos) · `/rh/horarios`
5. [Membros da equipa RH](#5-membros-da-equipa-rh) · `/rh/equipa`

**Pessoas**
6. [Contratos](#6-contratos) · `/rh/contratos`
7. [Férias / licenças](#7-férias--licenças) · `/rh/ferias`
8. [Dispositivos de ponto](#8-dispositivos-de-ponto) · `/rh/dispositivos`

**Justificações**
9. [Justificações (admin)](#9-justificações-admin) · `/rh/justificacoes`
10. [Justificações (auto, Meu RH)](#10-justificações-auto-meu-rh) · `/meu-rh`

**Documentos**
11. [Modelos de documento](#11-modelos-de-documento) · `/rh/modelos`
12. [Emissão / geração de documento](#12-emissão--geração-de-documento) · `/rh/documentos`

**Folha de salário**
13. [Regras de payroll (rulesets)](#13-regras-de-payroll-rulesets) · `/rh/processamento-salarial` (tab «Regras»)
14. [Processamento de uma folha (run)](#14-processamento-de-uma-folha-run) · `/rh/processamento-salarial` (tab «Processamento»)
15. [Descontos recorrentes](#15-descontos-recorrentes) · `/rh/funcionarios/[id]`

**Pagamentos**
16. [Lote de pagamentos](#16-lote-de-pagamentos) · `/rh/pagamentos`

**Desenvolvimento humano**
17. [Avaliação de desempenho (ciclo)](#17-avaliação-de-desempenho-ciclo) · `/rh/desempenho`
18. [Formação — novo curso](#18-formação--novo-curso) · `/rh/formacao`
19. [Formação — inscrever funcionário](#19-formação--inscrever-funcionário) · `/rh/formacao`
20. [Autoavaliação (Meu RH)](#20-autoavaliação-meu-rh) · `/meu-rh`

**Recrutamento**
21. [Nova vaga](#21-nova-vaga) · `/rh/recrutamento`
22. [Novo candidato](#22-novo-candidato) · `/rh/recrutamento`

**Comunicados & IA**
23. [Comunicados internos](#23-comunicados-internos) · `/rh/comunicados`
24. [IA assistente (rascunho de texto)](#24-ia-assistente-rascunho-de-texto) · `/rh/ia`

**Configurações**
25. [Configurações do módulo](#25-configurações-do-módulo) · `/rh/configuracoes`

**Desligamento**
26. [Desligamento de funcionário](#26-desligamento-de-funcionário) · `/rh/funcionarios/[id]`

---

## 1. Funcionários (novo/rouseditar) · `/rh/funcionarios`
**Componente:** `src/components/rh/employees-manager.tsx` · **Submit:** `POST /api/rh/employees` (criar) · `PATCH /api/rh/employees/[id]` (editar) · **Permissão:** `employees:write` · **Botão:** «Novo funcionário» / «Guardar alterações»

Formulário principal de cadastro de pessoas. Agrupa em campos (naming dos `name=` tal como estão no JSX):

| Campo (name) | Tipo / obrigatório | Notas |
|---|---|---|
| firstName | text · * | Nome |
| lastName | text · * | Apelido |
| bi | text · opcional | Bilhete de identidade |
| nif | text · opcional | NIF |
| birthDate | date · opcional | Data de nascimento |
| gender | select · opcional | Masculino / Feminino / Outro |
| email | email · opcional | Usado para login e vínculo portal |
| phone | text · opcional | Telefone |
| address | text · opcional | Morada |
| photoUrl | file (ou text) · opcional | Upload via `POST /api/rh/uploads` → guarda `path` |
| departmentId | select · opcional | Departamento do funcionário |
| positionId | select · opcional | Cargo |
| shiftId | select · opcional | Horário / turno |
| hireDate | date · * | Data de admissão |
| contractType | select · opcional | INDEFINIDO · TEMPO_PARCIAL · etc. |
| baseSalary | number · * | Salário-base (Kz, decimal 14,2) |
| status | select · opcional | ACTIVO · SUSPENSO · FÉRIAS · CESSÃO · INACTIVO |
| pin | password · opcional | PIN do ponto; vazio = não altera |
| bankName | text · opcional | Banco |
| bankAccount | text · opcional | Conta |
| bankIban | text · opcional | IBAN |

**Efeito:** gera `employeeNumber` automático; aplica `maskAccount` nos campos bancários (visíveis completos só com `employees:write`); regista salary change se `baseSalary` mudou; auditoria `RH_EMPLOYEE_CREATED`/`RH_EMPLOYEE_UPDATED`.

**Notas:** Fotografia sobe por upload de ficheiro (máx. 10 MB, MIME PDF/PNG/JPEG/WebP). Ao editar não se chama DELETE; activos com `ACTIVO` só podem ser desligados via formulário de desligamento (ver §26).

---

## 2. Departamentos · `/rh/departamentos`
**Componente:** `departments-manager.tsx` · **Submit:** `POST /api/rh/departments` · **Permissão:** `employees:write`

| Campo (name) | Tipo / obrigatório | Notas |
|---|---|---|
| name | text · * | Nome do departamento |
| code | text · opcional | Código curto |
| managerName | text · opcional | Responsável |
| parentId | select · opcional | Departamento pai (hierarquia) |
| description | text · opcional | Descrição |

**Efeito:** cria departamento; se `parentId` inexistente → 400. Audit `RH_DEPARTMENT_CREATED`.

---

## 3. Cargos · `/rh/cargos`
**Componente:** `positions-manager.tsx` · **Submit:** `POST /api/rh/positions` · **Permissão:** `employees:write`

| Campo (name) | Tipo / obrigatório | Notas |
|---|---|---|
| title | text · * | Título do cargo |
| code | text · opcional | Código |
| departmentId | select · opcional | Departamento |
| level | select · opcional | Nível (JUNIOR/PLENO/SENIOR etc.) |
| description | text · opcional | Descrição |

**Efeito:** cria cargo; audit `RH_POSITION_CREATED`.

---

## 4. Horários / Turnos · `/rh/horarios`
**Componente:** `shifts-manager.tsx` · **Submit:** `POST /api/rh/shifts` · **Permissão:** `employees:write`

| Campo (name) | Tipo / obrigatório | Notas |
|---|---|---|
| name | text · * | Nome do horário |
| startTime | time · * | Entrada (HH:MM) |
| endTime | time · * | Saída (HH:MM) |
| toleranceMinutes | number · opcional | 0–120 |
| isNight | checkbox · opcional | Turno nocturno (inclui horas 22h–06h) |
| nightPremiumPercent | number · opcional | 0–100 — prémio noturno aplicado no payroll como `nightAllowance` |

**Efeito:** cria turno; audit `RH_SHIFT_CREATED`. Turnos nocturnos somam `nightAllowance = baseSalary × nightPremiumPercent/100` na folha.

---

## 5. Membros da equipa RH · `/rh/equipa`
**Componente:** `members-manager.tsx` · **Submit:** `POST /api/rh/members` · **Permissão:** `members:write`

| Campo (name) | Tipo / obrigatório | Notas |
|---|---|---|
| email | email · * | Email do utilizador existente na plataforma |
| role | select · opcional | MANAGER · ADMIN · FINANCE · APPROVER (ver matriz em `src/lib/rh-policy.ts`) |

**Efeito:** adiciona utilizador como membro RH; audit `RH_MEMBER_ADDED`. Só utilizadores com acesso à empresa podem ser convidados (validado no backend).

---

## 6. Contratos · `/rh/contratos`
**Componente:** `contracts-manager.tsx` · **Submit:** `POST /api/rh/contracts` · **Permissão:** `employees:write`

| Campo (name) | Tipo / obrigatório | Notas |
|---|---|---|
| employeeId | select · * | Funcionário |
| type | select · * | INDEFINIDO · TEMPO_PARCIAL · EXPERIENCIA · etc. |
| status | select · opcional | ACTIVO · SUSPENSO · CESSADO |
| startDate | date · * | Início |
| endDate | date · opcional | Fim (se aplicável) |
| salary | number · * | Salário do contrato (Kz) |
| notes | text · opcional | Notas |

**Efeito:** cria contrato; audit `RH_CONTRACT_CREATED`. Não altera salário-base directamente — usar formulário de alteração salarial ou editar funcionário.

---

## 7. Férias / licenças · `/rh/ferias`
**Componente:** `leaves-manager.tsx` · **Submit:** `POST /api/rh/leaves` · **Permissão:** `leaves:write`

| Campo (name) | Tipo / obrigatório | Notas |
|---|---|---|
| employeeId | select · * | Funcionário |
| type | select · opcional | FERIAS · LICENCA_MEDICA · OUTRO |
| startDate | date · * | Início |
| endDate | date · * | Fim |
| reason | text · opcional | Motivo |

**Efeito:** regista pedido de férias/licença; RH aprova/rejeita fora deste formulário (aprovação por acção inline na tabela); audit `RH_LEAVE_CREATED`.

---

## 8. Dispositivos de ponto · `/rh/dispositivos`
**Componente:** `devices-manager.tsx` · **Submit:** `POST /api/rh/devices` · **Permissão:** `attendance:write` (chamada também protegida por `resources:write`? validar em `src/app/api/rh/devices/route.ts`)

| Campo (name) | Tipo / obrigatório | Notas |
|---|---|---|
| name | text · opcional | Nome do terminal |

**Efeito:** regista terminal de ponto; gera `deviceId` usado por PIN/QR/offline para validar entradas; audit `RH_DEVICE_CREATED`.

---

## 9. Justificações (admin) · `/rh/justificacoes`
**Componente:** `src/components/rh/justifications-manager.tsx` (não listado acima — verificar o ficheiro) · **Submit:** `POST /api/rh/justifications` · **Permissão:** `attendance:write`

Aprovação/registo administrativo de justificações de faltas e atrasos (atestado, licença, etc.). Campos típicos: Funcionário · Data · Tipo (FALTA/ATRASO) · Motivo/documento · Decisão (APROVAR/REJEITAR).

---

## 10. Justificações (auto, Meu RH) · `/meu-rh`
**Componente:** `my-justifications.tsx` · **Submit:** `POST /api/meu-rh/justifications` · **Permissão:** sessão RH activa (`Meu RH`)

| Campo (name) | Tipo / obrigatório | Notas |
|---|---|---|
| date | date · * | Data da falta/atraso |
| type | select · * | FALTA · ATRASO |
| reason | text · * | Motivo |

**Efeito:** cria `RhAbsenceJustification` com estado `PENDENTE`; RH vê em `/rh/justificacoes` e aprova/rejeita; audit `RH_JUSTIFICATION_CREATED`.

---

## 11. Modelos de documento · `/rh/modelos`
**Componente:** `templates-manager.tsx` · **Submit (criar/editar):** `POST /api/rh/document-templates` · **Permissão:** `documents:write`

| Campo (name) | Tipo / obrigatório | Notas |
|---|---|---|
| name | text · * | Nome do modelo |
| type | select · opcional | CONTRATO · DECLARACAO_TRABALHO · DECLARACAO_RENDIMENTOS · OUTRO |
| body | textarea · * | Corpo com placeholders `{{employeeName}}`, `{{employeeNumber}}`, etc. |

Também nesta página: botão **Validar** (permissão `settings:write`) que abre prompt pedindo **URL da evidência documental** e **quem valida** → `POST /api/rh/document-templates/legal-validate` → marca `legalStatus='VALIDADO'` com `legalDocumentUrl`, `legalValidatedBy`, `legalValidatedAt`; audit `RH_DOCUMENT_TEMPLATE_LEGAL_VALIDATED`. Sem evidência, o modelo fica `PENDENTE`.

---

## 12. Emissão / geração de documento · `/rh/documentos`
**Componente:** `documents-manager.tsx` · **Submit:** `POST /api/rh/documents` · **Permissão:** `documents:write`

| Campo (name) | Tipo / obrigatório | Notas |
|---|---|---|
| templateId | select · * | Modelo |
| employeeId | select · opcional | Funcionário (obrigatório em declarações/contrato) |
| title | text · opcional | Título do documento resultante |

**Efeito:** gera documento PDF com placeholders substituídos; regista `RhDocument`; serve download a partir da lista em `/rh/documentos/[id]`; audit `RH_DOCUMENT_ISSUED`.

---

## 13. Regras de payroll (rulesets) · `/rh/processamento-salarial` — tab «Regras»
**Componente:** `payroll-manager.tsx` (formulário ruleset) · **Submit:** `POST /api/rh/payroll/rulesets` · **Permissão:** `payroll:write`

| Campo | Tipo / obrigatório | Notas |
|---|---|---|
| name | text · * | Nome da regra (ex.: «Angola 2026») |
| effectiveFrom | date · * | Vigência |
| inssEmployeeRate | number · opcional | % INSS do trabalhador (legal: 3%) |
| inssEmployerRate | number · opcional | % INSS da entidade (legal: 8%) |
| foodAllowance | number · opcional | Subsídio alimentação (Kz) |
| transportAllowance | number · opcional | Subsídio transporte (Kz) |
| irtBrackets | textarea JSON · * | Escalões IRT `[{"upTo":…,"rate":…,"deduction":…}]` |

**Efeito:** cria `RhPayrollRuleSet` `status=ACTIVE`, `legalStatus=PENDENTE`; usada pelo cálculo automático. **Não altera produção** — só cria regras novas.
Também nesta tab: botão **Validar** (permissão `settings:write`) → `POST /api/rh/payroll/legal-validate` com `{ rulesetId, documentUrl, validatedByName }` → marca `VALIDADO`; sem evidência, mantém `PENDENTE`.

---

## 14. Processamento de uma folha (run) · `/rh/processamento-salarial` — tab «Processamento»
**Componente:** `payroll-manager.tsx` (formulário run) · **Submit:** `POST /api/rh/payroll/runs` · **Permissão:** `payroll:write`

| Campo | Tipo / obrigatório | Notas |
|---|---|---|
| period | text · * | `AAAA-MM`, ex.: `2026-05` |
| rulesetId | select · * | Regras a aplicar |

**Efeito:** calcula folha para **todos** os funcionários `ACTIVO` do período; cria `RhPayrollRun` (`CALCULADO`) e recibos por funcionário; horas extra/faltas vêm do ponto do período (`overtimeRatePercent`, `absenceRatePercent` e `monthlyHours` do ruleset; `0%` por omissão = sem efeito, nada inventado); turnos nocturnos aplicam `nightPremiumPercent` (ver §4); descontos recorrentes amortizam-se (prestações); audit `RH_PAYROLL_CALCULATED`. Duplicado → 409.

---

## 15. Descontos recorrentes · `/rh/funcionarios/[id]`
**Componente:** `deductions-manager.tsx` · **Submit:** `POST /api/rh/deductions` · **Permissão:** `payroll:write`

| Campo (name) | Tipo / obrigatório | Notas |
|---|---|---|
| description | text · * | Descrição |
| amount | number · * | Valor (Kz) |
| type | select · opcional | ADIANTAMENTO · EMPRESTIMO · OUTRO |
| installments | number · opcional | Nº prestações (vazio = indefinido) |

**Efeito:** cria `RhEmployeeDeduction` activo; cada processamento de payroll desconta a prestação (`remainingInstallments--`) e desactiva ao esgotar; audit `RH_DEDUCTION_CREATED`.

---

## 16. Lote de pagamentos · `/rh/pagamentos`
**Componente:** `payments-manager.tsx` · **Submit:** `POST /api/rh/payments/batches` · **Permissão:** `payroll:write`

| Campo (name) | Tipo / obrigatório | Notas |
|---|---|---|
| runId | select · * | Processamento aprovado |
| channel | select · opcional | BANK_TRANSFER · EMIS · CASH |

**Efeito:** cria lote `Draft→Sent→Confirmed/Failed`; não executa EMIS real (fora de âmbito); audit `RH_PAYMENT_BATCH_CREATED`.

---

## 17. Avaliação de desempenho (ciclo) · `/rh/desempenho`
**Componente:** `performance-manager.tsx` · **Submit:** `POST /api/rh/performance/cycles` · **Permissão:** `employees:write`

| Campo (name) | Tipo / obrigatório | Notas |
|---|---|---|
| name | text · * | Nome do ciclo |
| startsAt | date · * | Início |
| endsAt | date · opcional | Fim |
| criteria | textarea · * | `nome|peso` por linha, ex.: `Produtividade|2` |

**Efeito:** cria ciclo; botão **Gerar para todos** cria avaliações PENDENTE para todos os `ACTIVO`; acções por linha (Entregar/Validar) em `POST/PATCH /api/rh/performance/reviews/[id]`; audit de ciclo e de cada review.

---

## 18. Formação — novo curso · `/rh/formacao`
**Componente:** `training-manager.tsx` (form curso) · **Submit:** `POST /api/rh/training/courses` · **Permissão:** `employees:write`

| Campo (name) | Tipo / obrigatório | Notas |
|---|---|---|
| title | text · * | Título |
| trainerName | text · opcional | Formador |
| startDate | date · * | Início |
| endDate | date · opcional | Fim |
| cargaHoras | number · opcional | Horas (default 8) |
| location | text · opcional | Local / formato |
| requiredForPositionId | select · opcional | Cargo exigido |

**Efeito:** cria curso; audit `RH_TRAINING_CREATED`.

---

## 19. Formação — inscrever funcionário · `/rh/formacao`
**Componente:** `training-manager.tsx` (form inscrição) · **Submit:** `POST /api/rh/training/enrollments` · **Permissão:** `employees:write`

| Campo | Tipo / obrigatório | Notas |
|---|---|---|
| courseId | select · * | Curso |
| employeeId | select · * | Funcionário |

**Efeito:** cria `RhTrainingEnrollment` (unicidade por curso/funcionário); audit `RH_TRAINING_ENROLLED`.

---

## 20. Autoavaliação (Meu RH) · `/meu-rh`
**Componente:** `self-assessment-section.tsx` · **Submit:** `POST /api/meu-rh/self-assessment` · **Permissão:** sessão RH (Meu RH)

| Campo | Tipo / obrigatório | Notas |
|---|---|---|
| cycleId | select · * | Ciclo aberto |
| selfScore | number · opcional | 0–100 |
| comments | textarea · opcional | Comentário |

**Efeito:** faz `upsert` do `RhPerformanceReviewSelfAssessment` para o funcionário correspondente ao email da sessão; só ciclos `ABERTO`; audit `RH_SELF_ASSESSMENT_SUBMITTED`.

---

## 21. Nova vaga · `/rh/recrutamento`
**Componente:** `recruitment-manager.tsx` (form vaga) · **Submit:** `POST /api/rh/recruitment/openings` · **Permissão:** `documents:write`? Não — `employees:write`

| Campo (name) | Tipo / obrigatório | Notas |
|---|---|---|
| title | text · * | Título da vaga |
| departmentId | select · opcional | Departamento |
| positionId | select · opcional | Cargo |
| openings | number · opcional | Nº vagas (default 1) |
| closesAt | date · opcional | Fecha a |
| requirements | textarea · opcional | Requisitos |

**Efeito:** cria `RhJobOpening` `ABERTA`; audit `RH_JOB_OPENING_CREATED`.

---

## 22. Novo candidato · `/rh/recrutamento`
**Componente:** `recruitment-manager.tsx` (form candidato) · **Submit:** `POST /api/rh/recruitment/candidates` · **Permissão:** `employees:write`

| Campo (name) | Tipo / obrigatório | Notas |
|---|---|---|
| jobOpeningId (Vaga) | select · * | Vaga |
| firstName | text · * | Nome |
| lastName | text · * | Apelido |
| email | email · * | Email |
| phone | text · opcional | Telefone |
| cvUrl | file/url · opcional | Upload via `POST /api/rh/uploads` → guarda `path` |
| notes | text · opcional | Notas |

**Efeito:** cria `RhCandidate` `RECEBIDA`; cada mudança de fase (`RECEBIDA→TRIAGEM→ENTREVISTA→AVALIACAO→APROVADO→REJEITADO/ADMITIDO`) cria `RhCandidateEvent` com quem e nota; botão **Admitir** chama `POST …/candidates/[id]/admit` → cria `RhEmployee` (`employeeNumber` automático) e marca `ADMITIDO`; dup. email → 409; audit em cada passo.

---

## 23. Comunicados internos · `/rh/comunicados`
**Componente:** `announcements-manager.tsx` · **Submit:** `POST /api/rh/announcements` · **Permissão:** `documents:write`? Não — `employees:write`

| Campo (name) | Tipo / obrigatório | Notas |
|---|---|---|
| title | text · * | Título |
| body | textarea · * | Conteúdo |
| priority | select · opcional | BAIXA · NORMAL · ALTA |
| expiresAt | date · opcional | Validade |

**Efeito:** cria `RhAnnouncement`; visível em `/meu-rh` para todos os funcionários do tenant enquanto válido; audit `RH_ANNOUNCEMENT_CREATED`.

---

## 24. IA assistente (rascunho de texto) · `/rh/ia`
**Componente:** `ai-manager.tsx` · **Submit:** `POST /api/rh/ai/draft` · **Permissão:** `employees:write`

| Campo (label) | Tipo / obrigatório | Notas |
|---|---|---|
| Tipo | select · opcional | Contrato · Declaração · Outro |
| Contexto factual | textarea · opcional | Dados para o modelo gerar texto |
| O que deve ser escrito * | textarea · * | Instrução principal |

**Efeito:** chama Groq (`openai/gpt-oss-120b`) com contexto RH + dry-run; devolve texto (não grava nada; o utilizador revê/copia manualmente). Sem chave → 503 `AI_NOT_CONFIGURED`. Audit `RH_AI_DRAFT`.

---

## 25. Configurações do módulo · `/rh/configuracoes`
**Componente:** `settings-form.tsx` · **Submit:** `PATCH /api/rh/settings` · **Permissão:** `settings:write`

| Campo (label) | Tipo / obrigatório | Notas |
|---|---|---|
| Direito anual de férias (dias) | number · opcional | Ajusta saldo de férias padrão |

**Efeito:** atualiza `RhSettings` do tenant; audit `RH_SETTINGS_UPDATED`.

---

## 26. Desligamento de funcionário · `/rh/funcionarios/[id]`
**Componente:** `offboard-dialog.tsx` · **Submit:** `POST /api/rh/employees/[id]/offboard` · **Permissão:** `employees:write`

| Campo (name) | Tipo / obrigatório | Notas |
|---|---|---|
| reason | text · * | Motivo |
| lastDay | date · * | Data efectiva |
| notes | textarea · opcional | Notas |
| revokeAccess | checkbox · opcional | Revoga acesso do portal se houver utilizador com o mesmo email |

**Efeito:** cria `RhOffboarding`; marca funcionário `INACTIVO`; se `revokeAccess` e houver `User` com o mesmo email → `status=INACTIVE`; não pode ser desfeito por UI (caso extremo: `prisma` direto). Audit `RH_EMPLOYEE_OFFBOARDED`.

---

## Regras transversais

- **Todos os formulários exigem sessão autenticada e papel RH** (`requireRhAccess`) + permissão específica (`employees:write`, `payroll:write`, `documents:write`, `attendance:write`, `settings:write`, `members:write`).
- **Multi-tenant:** `tenantId` aplicado em todas as queries; RLS no Postgres como segunda linha de defesa.
- **Auditoria:** cada submit regista em `RhAuditLog` com `tenantId`, `actorUserId`, `action`, `entity`, `entityId`, `metadata`.
- **Upload de ficheiro:** bucket privado `rh-uploads`; URLs assinadas via `GET /api/rh/signed-url?path=...` (1h); apenas PDF/PNG/JPEG/WebP; máx. 10 MB.
- **Validação jurídica:** nenhum ruleset ou modelo fica `VALIDADO` sem evidência documental e aprovador identificado; tudo nasce `PENDENTE`.
- **Regra de ouro:** nada é marcado como tecnicamente completo se faltar validação legal de quem detém a autoridade.

---

## Limitações conhecidas do inventário

- Formulários dentro de diálogo (desligamento) aparecem como modal, mas constam como formulário porque têm `<form>` e submit.
- Alguns fluxos não têm `<form>` explícito: ex.: **mover fases do candidato** (select inline), **fechar vaga**, **validar revisão**, **aprovar/rejeitar férias/justificação**, **marcar lote pago**, **revogar device** — são acções inline (onClick + fetch), não formulários.
- Filtros (pesquisa dinâmica, paginação) não são considerados formulários.
