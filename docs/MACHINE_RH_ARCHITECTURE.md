# Machine RH — Arquitectura e plano de implementação

> Estado: **Fase 1 (auditoria) e Fase 2 (arquitectura) concluídas; Fase 3 (núcleo RH) implementada**.
> Assiduidade, documentos, payroll, pagamentos e IA estão **desenhados**, não implementados.

## 1. Auditoria da plataforma existente

| Área | Como funciona hoje | Impacto no RH |
| --- | --- | --- |
| Auth | NextAuth v5, sessão com `tenantId`, `tenantRole`, `platformRole` | RH reutiliza a sessão; sem segunda conta |
| Multi-tenant | `tenantId` em todas as tabelas + helpers `runWithTenant`/`runWithRlsContext` | RH segue o mesmo padrão e RLS |
| Módulos | `PlatformApplication` + `TenantApplication` (ex.: `wms`), gate no `proxy.ts` | RH é uma aplicação `rh` com o mesmo mecanismo |
| Planos | `SubscriptionPlan`/`PlanLimit`/`PlanCapability`, sem preços de RH | RH não inventa preços; activação por tenant/app |
| PWA | `public/manifest.json` scope `/`, `public/sw.js` scope `/` | RH tem manifest próprio scope `/rh/` e SW próprio scope `/rh/` (não colide) |
| UI | Tailwind + componentes `ui/*`, `AppShell`, tabelas responsivas | RH tem shell próprio, reutilizando tokens e `ResponsiveTables` |
| RLS | `runWithTenant`/`runWithRlsContext` com role NOBYPASSRLS | Nunca desactivar RLS; queries sempre por tenant |

## 2. Decisões de arquitectura

- **Aplicação independente na experiência**, integrada na técnica: rotas `/rh/*`, manifest e SW próprios, autenticação e base de dados partilhadas.
- **Gate server-side**: `TenantApplication(slug='rh')` activo + role autorizado. O `proxy` bloqueia `/rh` e `/api/rh`; as páginas e APIs repetem a validação.
- **RBAC actual**: `COMPANY_ADMIN` e `platformRole ADMIN/SUPERADMIN` têm acesso total ao núcleo. `USER`, `BILLING`, `VIEWER` ficam sem acesso nesta fase (matriz fina de RH é fase seguinte).
- **Dados sensíveis**: salário e dados bancários só são devolvidos a roles autorizados; ficam na mesma tabela, protegidos por API/gate (não por ocultação de UI).
- **Auditoria**: `RhAuditLog` regista criação/alteração de funcionário, contrato, departamento e cargo.
- **Sem duplicar entidades**: `Tenant` e `User` são os existentes; `RhEmployee` referencia `tenantId` e pode ser associado a um `userId` no futuro.
- **Sem migração de produção** nesta entrega; migration aditiva criada para staging/descarte.

## 3. Modelo de dados (Fase 3)

```
RhDepartment 1─* RhPosition
RhDepartment 1─* RhEmployee
RhPosition   1─* RhEmployee
RhEmployee   1─* RhContract
RhEmployee   1─* RhAuditLog (via entityId)
```

- `RhDepartment`: nome único por empresa, código, hierarquia (`parentId`), responsável.
- `RhPosition`: título, código, departamento, nível.
- `RhEmployee`: nº mecanográfico único por empresa, dados pessoais, BI/NIF, contactos, morada, foto (URL), departamento/cargo, admissão, tipo de contrato, salário-base, estado, dados bancários restritos.
- `RhContract`: tipo, estado, datas, salário, documento, notas; histórico de renovações/adendas em fase seguinte.
- `RhAuditLog`: actor, acção, entidade, payload resumido.

## 4. Rotas

Implementadas: `/rh`, `/rh/dashboard`, `/rh/funcionarios`, `/rh/departamentos`, `/rh/cargos`, `/rh/contratos`, `/rh/assiduidade`, `/rh/horarios`, `/rh/ferias`, `/rh/ponto`, `/rh/dispositivos`, `/rh/documentos`, `/rh/modelos`, `/rh/processamento-salarial`, `/rh/equipa`, `/rh/pagamentos`, `/rh/configuracoes`; self-service em `/meu-rh`.

Desenhadas (badge “Brevemente”): `/rh/ferias`, `/rh/processamento-salarial`, `/rh/documentos`, `/rh/modelos`, `/rh/payroll`, `/rh/dispositivos`.

## 5. PWA independente

- `public/rh-manifest.json`: `id/scope=/rh/`, `start_url=/rh/dashboard`, nome **Machine RH**, cores da marca.
- `public/rh-sw.js`: cache do shell `/rh`, estratégia network-first para dados e fallback offline `/rh/offline`.
- Registo apenas em `/rh` (`RhPwa`), scope `/rh/`; a PWA principal (scope `/`) não é alterada.
- Ícone próprio `public/icons/rh-icon.svg` (monograma RH). PNGs 192/512 para lojas ficam como pendência de design.
- Android/iOS: manifest + display standalone; empacotamento (TWA/Capacitor) preparado por rotas e manifest, não implementado.

## 6. Fases seguintes (desenho)

### Machine Point (assiduidade)
`RhShift`, `RhSchedule`, `RhTimeEntry`, `RhDevice`, `RhDeviceEvent`. Identificação por QR dinâmico + PIN; WebAuthn no dispositivo pessoal; GPS opcional com consentimento; terminal partilhado em modo quiosque; conector ZKTeco por adapter (push/pull), sem armazenar biometria. Eventos idempotentes (`deviceId+externalId`).

### Documentos
`RhDocumentTemplate` (versão, variáveis, validade jurídica), `RhDocument` (estado, hash, versão). Motor de variáveis `{{...}}`; PDF/DOCX via renderer no servidor; validação humana obrigatória para documentos jurídicos.

### Payroll
`RhPayrollRuleSet` versionado por vigência, `RhPayrollRun`, `RhPayslip`, `RhPayrollLine`. Taxas INSS/IRT vêm de regras configuradas (nunca hardcoded), com validação e vigência. Estados: RASCUNHO → CALCULADO → EM_REVISAO → APROVADO → PENDENTE_PAGAMENTO → PAGO/FALHADO/CANCELADO. Chave única `(tenantId, period, runNumber)` e lock transaccional impedem duplicação; aprovação congela valores.

### Payroll Connect
`RhPaymentBatch`, `RhPaymentInstruction`, `RhPaymentAttempt`, `RhPaymentReconciliation`. Adapter por parceiro (`MockAdapter`, `EmisAdapter` futuro). Idempotência por `batchId+employeeId`; nenhum pagamento é marcado como concluído sem confirmação do parceiro; modo demonstração enquanto não houver contrato/credenciais.

### Intelligence
Assistente apenas com leitura e geração de rascunhos; nunca aprova pagamentos, altera salários ou emite documentos sem confirmação humana. Ferramentas limitadas por permissões e tenant.

## 7. Segurança

- Gate no proxy + página + API (defesa em profundidade).
- `runWithTenant` em todas as queries; sem SQL multi-tenant.
- Validação de entrada e limites; erros genéricos ao cliente.
- Auditoria de mutações; dados bancários apenas em respostas autorizadas.
- Sem RLS desactivada, sem dados fictícios em produção, sem migração de produção nesta fase.

## 8. Classificação da entrega

| Item | Estado |
| --- | --- |
| Auditoria + arquitectura | **Concluído** |
| Funcionários, departamentos, cargos, contratos (schema, API, UI) | **Implementado e testado** |
| Gate comercial por aplicação + RBAC básico | **Implementado e testado** |
| PWA RH (manifest, SW, shell, ícone) | **Implementado** (ícones PNG para lojas pendentes) |
| Machine Point: registo de ponto por PIN (entrada/saídas), hoje e histórico | **Implementado e testado** |
| Horários/turnos, tolerância e cálculo de atraso | **Implementado e testado** |
| QR assinado (5 min) + terminal quiosque `/rh/ponto` | **Implementado e testado** |
| Registo de dispositivos/terminais e marcação vinculada ao dispositivo | **Implementado e testado** |
| WebAuthn, biometria e fila offline | **Desenhado, não implementado** |
| Férias/licenças: pedido, aprovação/rejeição, sobreposição e saldo configurável | **Implementado e testado** |
| Mapa anual/calendário visual de férias | **Parcial** (lista anual; sem calendário gráfico) |
| Documentos: modelos por empresa, variáveis, rascunho, PDF e emissão | **Implementado e testado** |
| DOCX + versionamento imutável de modelos (histórico e versão usada no documento) | **Implementado e testado** |
| Biblioteca de modelos jurídicos pré-validados | **Pendente** |
| Payroll: regras configuráveis/versionadas, cálculo, estados e recibos | **Implementado e testado** |
| Payroll Connect: lotes, estados, idempotência (sem transferência real) | **Implementado e testado** |
| Self-service do funcionário (`/meu-rh`): recibos, ponto, férias e documentos próprios | **Implementado e testado** |
| Assistente IA de rascunhos (Groq free/OpenRouter free, revisão humana) | **Implementado** (requer chave) |
| Privacidade de dados bancários (mascaramento + acesso restrito) | **Implementado e testado** |
| Ciclo de vida: histórico salarial e desligamento estruturado | **Implementado e testado** |
| Justificações de faltas e notificações internas | **Implementado e testado** |
| Recibos de vencimento em PDF e exportações CSV | **Implementado e testado** |
| Transferências bancárias reais (EMIS) | **Pendente** |
| Matriz RBAC fina (RH_ADMIN, FINANCE, MANAGER, EMPLOYEE) | **Pendente** |
| Migração de produção | **Não executada** (requer aprovação) |
| Validação jurídica de modelos | **Pendente** (parceiro jurídico) |


## Assistente IA (free)

- **Groq** (recomendado): API compatível com OpenAI, 30 RPM e 1.000 pedidos/dia no nível gratuito, sem cartão. Criar chave em https://console.groq.com/keys e definir `GROQ_API_KEY`.
- **OpenRouter** (fallback): modelos `:free` (ex. `meta-llama/llama-3.3-70b-instruct:free`), 20 RPM e 50 pedidos/dia. Definir `OPENROUTER_API_KEY`.
- Opcionais: `RH_AI_MODEL` e `RH_AI_BASE_URL`; limite local de 10 pedidos/minuto por utilizador.
- Sem chave, `/api/rh/ai/draft` devolve 503 `AI_NOT_CONFIGURED` e `/rh/ia` explica como configurar.
- O assistente só produz **rascunhos**; a emissão continua a exigir revisão humana em `/rh/documentos`.
