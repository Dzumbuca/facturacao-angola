# Evolução do Sistema BlackMachine — Plano de Implementação

> **Para agentes executores:** seguir `superpowers:executing-plans` no fluxo nativo escolhido pelo utilizador. Os passos usam caixas de verificação para acompanhar o trabalho.

**Objectivo:** Evoluir a aplicação existente para suportar uma dashboard financeira, perfil empresarial ampliado, ciclo de vida de facturas, pagamentos manuais auditáveis e relatórios reais/exportáveis.

**Arquitectura:** Estender o schema Prisma de forma aditiva; centralizar datas, estado financeiro calculado e consultas agregadas; usar as mesmas regras nos detalhes, dashboard e relatórios. Manter autenticação e isolamento por tenant e usar Next.js App Router, Prisma/PostgreSQL, PDFKit e Tailwind existentes.

**Stack:** Next.js 16, React 19, TypeScript 7, Prisma 5.22, PostgreSQL, Vitest, PDFKit. XLSX poderá exigir uma dependência directa de workbook; não implementar um botão sem gerar um ficheiro válido.

**Especificação:** `docs/superpowers/specs/2026-10-19-blackmachine-evolucao-design.md`

## Restrições globais

- Preservar Next.js, Prisma, PostgreSQL, autenticação, emissão assinada, SAFT e módulos existentes.
- Migrações aditivas; sem actualização retroactiva de snapshots ou vencimentos.
- AOA é a única moeda suportada enquanto não existir fonte/taxa autorizada de conversão.
- Recebimentos pendentes não contam como dinheiro recebido; Multicaixa é manual sem integração.
- Facturas assinadas mantêm estado fiscal; estado de pagamento é derivado dos recebimentos confirmados.
- Toda leitura/escrita financeira é limitada ao tenant da sessão.
- Não impor novas regras fiscais ou de identificação sem fonte oficial actual.
- Datas e limites de períodos usam `Africa/Luanda`.
- Os testes pedidos pelo utilizador devem ser executados; falhas de infra-estrutura devem ficar separadas de falhas de código.

## Focos de revisão

1. **Repetição/concor­rência no registo de pagamento:** uma re-tentativa ou dois pedidos simultâneos não podem duplicar valor nem ultrapassar o saldo; testar idempotência, unicidade e conflito transaccional.
2. **Tenant errado:** IDs de factura/pagamento de outra empresa retornam não encontrado/sem autorização e não alteram registos; testar cada endpoint financeiro.
3. **Estado ambíguo:** parcial vencida mantém vencido; pendente não abate saldo recebido; estorno restaura saldo; testar helper de estado e totais.
4. **Limites de data:** filtros locais de Luanda cobrem exactamente a meia-noite e não confundem emissão com recebimento; testar intervalos e agregações.
5. **Histórico e cancelamento:** rascunho não ganha assinatura/número fiscal, factura anulada/NC não duplicam facturação e perfil/conta antigos não substituem snapshots; testar serviço e PDF.

---

### Tarefa 1: Modelo financeiro e migração

**Ficheiros:** `prisma/schema.prisma`; criar `prisma/migrations/<timestamp>_financial_workflows/migration.sql`; actualizar declarações auxiliares se necessário.

**Interfaces:** `Invoice.dueAt DateTime?`, `Invoice.currency String @default("AOA")`, `Invoice.sourceDraftId String? @unique`; `InvoiceDraft` armazena payload sem cliente real/número/hash e mantém estado `DRAFT`/`ISSUED`, com relação um-para-um à factura emitida; `Payment` com `tenantId`, `invoiceId`, `amount Decimal(12,2)`, `currency`, `method`, `status`, `paymentDate`, `reference?`, `notes?`, `idempotencyKey`, `createdByUserId?`; `PaymentEvent` append-only com actor, evento, estado anterior/novo, snapshot e data. `CompanyBankAccount` para conta/rótulo/moeda/activo/principal. Campos novos do tenant para denominação legal, município, província, país, cor, rodapé, mensagem e preferências. Índices/FKs tenant-scoped; índice único da chave idempotente e referência não vazia por factura/método. Backfill legado de banco/titular/IBAN numa conta principal.

- [ ] Passo 1: Expandir schema de modo aditivo e manter os campos legados enquanto APIs antigas os consomem.
- [ ] Passo 2: Criar migração SQL que adiciona campos/tabelas/índices/FKs e copia contas legadas sem preencher due date ou snapshot retroactivo.
- [x] Passo 3: Executar `node node_modules/prisma/build/index.js validate` e validar migração contra schema.
- [ ] Passo 4: Parar processos que bloqueiem o query engine, executar `node node_modules/prisma/build/index.js generate`, confirmar no runtime DMMF `Tenant.website`, `Payment` e `CompanyBankAccount`.
- [ ] Passo 5: Quando PostgreSQL local estiver disponível, executar `node node_modules/prisma/build/index.js migrate deploy`; confirmar tabelas e linhas migradas sem editar dados de produção directamente.

### Tarefa 2: Serviço de factura, rascunhos, lista e detalhe

**Ficheiros:** `src/lib/invoice-service.ts`; `src/lib/invoice-validation.ts`; criar `src/lib/invoice-state.ts` e respectivos `.test.ts`; criar páginas `/invoices`, `/invoices/[id]`, `/invoices/[id]/edit`; criar rotas tenant-scoped de listagem/detalhe/rascunho/PDF; modificar formulário e navegação.

**Interfaces:** `getInvoiceState(invoice, confirmedAmount, now): InvoiceDisplayState`; `createInvoiceDraft(input, tenantId): Promise<InvoiceDraft>`; `updateInvoiceDraft(id, input, tenantId): Promise<InvoiceDraft>`; `issueInvoiceDraft(id, tenantId): Promise<Invoice>`; `getInvoiceWithPayments(invoiceId, tenantId)`; API payments futura usa a mesma factura.

- [ ] Passo 1: Testar estados: DRAFT, ANULADA, ISSUED, PAID, PARTIALLY_PAID, OVERDUE; parcial com dueAt passado retorna OVERDUE e sem dueAt nunca é considerado vencido.
- [ ] Passo 2: Implementar estado de apresentação sem escrever `Invoice.status` derivado nem alterar documento assinado.
- [ ] Passo 3: Acrescentar guardar/reabrir/editar `InvoiceDraft` sem criar cliente nem número/hash/assinatura final; ao emitir, criar exactamente um FT pelo pipeline actual e marcar o rascunho como `ISSUED` na mesma transacção, preservando o vínculo e bloqueando duplicados.
- [ ] Passo 4: Adicionar due date padrão do tenant às facturas novas; pedido/documento antigo sem data permanece sem vencimento.
- [ ] Passo 5: Implementar `/invoices` com filtros por estado/período, ordenação e link; `/invoices/[id]` mostra linhas, totais, dados snapshot, pagamentos e descarrega PDF sem persistir/assinar novamente.
- [ ] Passo 6: Testar isolamento por tenant, rascunho repetido, emissão repetida e PDF antigo sem snapshot mantendo conteúdo histórico.

### Tarefa 3: Pagamentos manuais, transições e auditoria

**Ficheiros:** criar `src/lib/payment-service.ts`, `src/lib/payment-validation.ts` e testes; criar `src/app/api/invoices/[id]/payments/route.ts`, `src/app/api/payments/[id]/status/route.ts`; adicionar área de pagamentos ao detalhe da factura.

**Interfaces:** `recordPayment(input, tenantId, actorId): Promise<Payment>`; `transitionPayment(paymentId, nextStatus, tenantId, actorId): Promise<Payment>`; `getInvoicePaymentTotals(invoiceId, tenantId): Promise<{confirmed: Decimal; pending: Decimal; outstanding: Decimal}>`. Métodos `BANK_TRANSFER`, `MULTICAIXA_EXPRESS`, `MULTICAIXA_REFERENCE`, `CASH`, `OTHER`; estados `PENDING`, `CONFIRMED`, `CANCELLED`, `REVERSED`.

- [ ] Passo 1: Testar valores positivos, moeda AOA, método/estado permitido, referência duplicada, chave idempotente e limite saldo com pendentes activos.
- [ ] Passo 2: Implementar registo em transacção serializable com retry de conflito, verificação do invoice + tenant + tipo/status e criação do evento inicial.
- [ ] Passo 3: Implementar transições permitidas: pendente→confirmado/cancelado e confirmado→estornado; guardar evento antes/depois/actor; impedir edição/apagamento financeiro.
- [ ] Passo 4: No detalhe, permitir registo manual pendente e confirmar/estornar com confirmação acessível. Mostrar aviso de que Multicaixa não é verificado automaticamente.
- [ ] Passo 5: Testar pagamentos parciais/múltiplos, concorrência/idempotência, pagamento em factura anulada, isolamento tenant e restauração de saldo ao cancelar/estornar.

### Tarefa 4: Perfil empresarial ampliado

**Ficheiros:** `src/app/api/company-profile/route.ts`; `src/lib/company-profile-validation.ts`; `src/app/(dashboard)/empresa/page.tsx`; `src/app/(dashboard)/empresa/company-profile-form.tsx`; `src/lib/invoice-service.ts`; `src/lib/pdf-generator.ts`; criar testes.

**Interfaces:** API GET/PUT do perfil retorna identificação, preferências e contas bancárias (sem bytes de logos sem necessidade); rotas tenant-scoped CRUD de `/api/company-profile/bank-accounts`; snapshot serializado mantém os dados de empresa e conta seleccionada exactos na emissão.

- [ ] Passo 1: Testar validação e preservação dos campos existentes e upload real PNG/JPEG inválido/tamanho >1 MB.
- [ ] Passo 2: Expandir formulário com identificação legal/localização, contas bancárias múltiplas, preferências, logótipo, cor/rodapé/mensagem e aviso de alterações não guardadas; permitir adicionar/editar/activar/desactivar/remover contas respeitando referência histórica.
- [ ] Passo 3: Permitir escolher conta/prazo/observação por factura; snapshot e PDF incluem apenas dados escolhidos e mantêm histórico.
- [ ] Passo 4: Criar pré-visualização que usa renderer PDF sem gravar factura, pagamento ou assinatura.
- [ ] Passo 5: Testar isolamento, backfill, conta principal única, snapshot estável, perfil vazio e mudança não guardada.

### Tarefa 5: Períodos e consultas financeiras comuns

**Ficheiros:** criar `src/lib/report-period.ts`, `src/lib/financial-metrics.ts` e testes.

**Interfaces:** `parseReportPeriod(query, now): ReportPeriod` produz intervalo `[start, endExclusive)` no fuso `Africa/Luanda`; `getTenantPeriodMetrics(tenantId, period, filters): Promise<FinancialMetrics>`; `getInvoiceChartSeries(metrics, granularity, metric): ChartPoint[]`; `buildReportDataset(tenantId, period, filters): Promise<ReportDataset>`. Tipos comuns importados por dashboard, página de relatórios e exports.

- [ ] Passo 1: Testar os oito filtros com início/fim Luanda (inclusive custom dates, datas inválidas e limites de dia/mês/ano) e buckets diário/semanal/mensal.
- [ ] Passo 2: Implementar consultas em lote tenant-scoped; facturação por `issuedAt`, recebimentos confirmados por `paymentDate`, saldo actual por facturas emitidas no período, ageing por due date, categorias no prazo/1–30/31–60/61–90/>90 dias e período anterior equivalente para comparação; excluir rascunhos/anuladas/NC onde indicado.
- [ ] Passo 3: Agrupar por moeda no resultado e impedir soma cruzada; limitar a AOA enquanto essa for a única moeda de emissão.
- [ ] Passo 4: Testar FT/NC/ANULADA/DRAFT, emissão e recebimento em períodos diferentes, estado parcial vencido, pagamentos pendentes/estornados e dataset sem dados.

### Tarefa 6: Dashboard empresarial

**Ficheiros:** modificar `src/app/(dashboard)/page.tsx`; criar `src/app/(dashboard)/dashboard-controls.tsx`, `src/components/financial-chart.tsx` se necessário; modificar `src/components/app-shell.tsx` apenas para navegação de facturas/relatórios.

**Interfaces:** dashboard server page chama `getTenantPeriodMetrics`; controlos usam URL GET; gráfico consome `ChartPoint[]` com modo facturação/recebimentos.

- [ ] Passo 1: Integrar filtros de período e testar a tradução dos query params em `ReportPeriod`.
- [ ] Passo 2: Implementar cartões facturado/recebido/em aberto/vencido, tendências sem comparações falsas, contagem estados, gráfico real e actividade recente navegável.
- [ ] Passo 3: Implementar alertas vencidos, vencimento nos próximos 7 dias de Luanda, rascunhos e perfil incompleto apenas quando aplicáveis; atalhos para emitir/criar cliente/criar artigo.
- [ ] Passo 4: Implementar resumo operacional secundário e estados vazios/loading/error; validar contraste, teclado e layout mobile.
- [ ] Passo 5: Teste de página com fixtures tenant-scoped confirma todos os indicadores vindos dos helpers reais, sem constantes financeiras.

### Tarefa 7: Relatórios e exportações

**Ficheiros:** criar `src/app/(dashboard)/reports/page.tsx`, componentes de filtro/tabela e `src/app/api/reports/export/route.ts`; criar `src/lib/report-export.ts` e testes; actualizar menu e títulos.

**Interfaces:** `exportReport(dataset, format): Promise<{contentType: string; filename: string; body: Buffer|string}>`; formatos `pdf`, `xlsx`, `csv` geram exactamente o dataset filtrado da página.

- [ ] Passo 1: Testar agregações por factura, recebimento/método/estado, envelhecimento (no prazo/1–30/31–60/61–90/>90 dias), cliente e produto; cliente/estado/período aplicam-se a UI e export.
- [ ] Passo 2: Implementar relatórios de facturação, recebimentos, dívida/ageing, clientes e catálogo facturado sem margem/lucro.
- [ ] Passo 3: Implementar CSV com encoding/escaping, PDF multipágina e XLSX válido com nome/NIF da empresa, título, período, data de geração, filtros, cabeçalhos, formatos numéricos e totais. Usar dependência directa ExcelJS se nenhuma biblioteca de workbook fiável estiver instalada; incluir lockfile.
- [ ] Passo 4: Testar que cada export abre/contém totais, filtros e período iguais ao dataset; export sem dados retorna cabeçalho/estado vazio explícito, nunca ficheiro truncado.
- [ ] Passo 5: Verificar download autenticado, tenant scope, conteúdo sensível mínimo, mobile e menu principal.

### Tarefa 8: Integração e verificação final

**Ficheiros:** rotas/componentes alterados e testes existentes relevantes.

- [ ] Passo 1: Parar processos Next que prendam o query engine; executar `node node_modules/prisma/build/index.js generate` e confirmar os tipos do schema actual.
- [ ] Passo 2: Aplicar migrações com PostgreSQL local disponível e conferir dados legados/backfill; se o banco estiver indisponível, registar precisamente o impedimento e não afirmar que foi aplicado.
- [ ] Passo 3: Executar `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/eslint/bin/eslint.js src` e `node node_modules/vitest/vitest.mjs run`; corrigir todas as falhas de implementação.
- [ ] Passo 4: Com browser e base disponível, validar dashboard, filtros, fluxo draft→emitir, PDF, pagamentos, relatórios/exports, permissões tenant e vistas desktop/mobile sem emitir transacções de produção.
- [ ] Passo 5: Fazer revisão final de acessibilidade, nenhuma acção sem comportamento, totais coerentes e documentação de execução/limitações.
