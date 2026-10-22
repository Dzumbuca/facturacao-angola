# Evolução do sistema de facturação BlackMachine

## Intenção

Transformar o projecto actual num espaço de gestão financeira e operacional, mantendo Next.js App Router, React, TypeScript, Prisma, PostgreSQL e os módulos de clientes, produtos, emissão fiscal e SAFT já existentes. O utilizador deve conseguir perceber a actividade financeira, acompanhar facturas, registar recebimentos e consultar relatórios com os mesmos cálculos em todo o sistema.

## Descoberta da arquitectura existente

- Next.js 16 App Router, React 19, TypeScript, Prisma 5.22 e PostgreSQL.
- Autenticação NextAuth e associação de cada sessão a um `Tenant`; as páginas do grupo `(dashboard)` verificam sessão e tenant.
- Existem modelos `Tenant`, `Customer`, `Product`, `Invoice`, `InvoiceItem` e modelos de sessão NextAuth. Não existe entidade de serviço, pagamento, conta bancária múltipla, vencimento, relatório ou rascunho.
- `Invoice` guarda `status` e `type` como texto, `issuedAt`, totais, assinatura/hash, linhas e snapshot opcional do perfil. A emissão actual cria FT assinada imediatamente e a nota de crédito marca a factura original `ANULADA`.
- Não há página de listagem/detalhe de facturas; a página inicial conta facturas/clientes/produtos e apresenta um atalho de emissão.
- Existe cálculo central de IVA/desconto em `src/lib/tax.ts`, validação e emissão em `src/lib/invoice-validation.ts` e `src/lib/invoice-service.ts`, PDFKit e exportação SAFT com AOA. Existem testes Vitest unitários para cálculos, validações, sessão, rotas, criptografia e SAFT.
- O perfil da empresa e o snapshot da factura já estão em desenvolvimento; a migração `20261019221000_company_invoice_profile` existe. O cliente Prisma localizado no disco contém os campos novos, mas a regeneração falhou porque o Windows não conseguiu substituir a DLL bloqueada. O projecto não tem metadados Git.

## Objectivos

1. Dashboard com métricas financeiras reais, filtros de período e gráficos/listas coerentes.
2. Perfil empresarial central, extensível e reutilizado em documentos novos sem alterar documentos históricos.
3. Fluxo de rascunhos, lista/detalhe de facturas e registo auditável de pagamentos parciais e múltiplos.
4. Métodos de pagamento adequados ao mercado angolano, sem fingir integrações ou confirmação automática.
5. Página de relatórios com filtros e exportações úteis.
6. Isolamento por tenant, cálculos financeiros comuns e interface responsiva com estados vazios/erro/carregamento.

## Fora de âmbito / restrições

- Não substituir Next.js, Prisma, PostgreSQL, autenticação ou a geração fiscal existente.
- Não alterar assinatura, hash, regras de IVA/SAFT ou o conteúdo histórico de documentos já emitidos sem fundamento validado.
- Não criar integração Multicaixa Express, pagamento por referência, banco, gateway ou API fictícia. O projecto não tem credenciais nem contrato de prestador.
- Não importar previsões nem dados artificiais para indicadores.
- Não converter moedas sem taxas e fonte explícita. O sistema actual só cria documentos em AOA e o SAFT fixa AOA. Manter a emissão em AOA nesta etapa e nunca somar moedas incompatíveis; registar essa limitação na interface/relatório até existir desenho e taxa de conversão autorizada.
- Não impor validações fiscais novas sem fonte oficial actual e aplicabilidade confirmada. Manter as regras fiscais actualmente implementadas e a advertência existente de que validação interna não certifica o programa.
- Não implementar cadastros de serviços como entidade separada, porque não existem no schema. Artigos continuam a usar o catálogo `Product` com categoria; relatórios agrupam pelas linhas guardadas.
- Não expor dados bancários em endpoints de relatório ou listagens que não necessitem deles.

## Comportamento e chamadas do construtor

### Dashboard e período

- A página inicial exibe o nome da empresa do perfil, boas-vindas, período seleccionado, botão Emitir factura e atalhos para cliente e produto.
- Filtros: hoje, últimos 7 dias, últimos 30 dias, este mês, mês anterior, trimestre actual, ano actual e intervalo personalizado. Usar `Africa/Luanda` para limites locais e apresentação de datas.
- Total facturado é baseado na data de emissão de FT elegíveis; documentos anulados/rascunhos/NC não são somados como facturação activa. Contar documentos elegíveis e não repetir a mesma factura.
- Total recebido usa apenas pagamentos confirmados, pela data do pagamento. Pagamentos pendentes/cancelados/estornados não são dinheiro recebido.
- Por receber e vencido são saldos actuais de facturas emitidas no período seleccionado; saldo = total da factura menos pagamentos confirmados válidos. Vencida requer saldo > 0 e vencimento antes da data local actual. Uma parcialmente paga pode ficar vencida.
- Como não existem pagamentos nem vencimentos históricos, estes campos novos são opcionais para documentos antigos. Documentos antigos sem vencimento não são considerados vencidos e não recebem vencimento fictício retroactivo.
- Actividade recente, gráfico e resumo de estados obedecem ao filtro. Gráfico alterna Facturação/Recebimentos e agrega por dia/semana/mês conforme o intervalo; vazio se não houver dados.
- Estado mostrado é calculado de um único helper: Rascunho, Anulada, Paga, Parcialmente paga, Vencida ou Emitida. O estado base do documento continua imutável durante o cálculo de pagamento; não alterar `status` fiscalmente assinado por cada recebimento.
- Alertas são apenas accionáveis e baseados em factos: saldo vencido, vencimento próximo, rascunho por concluir ou perfil incompleto. Não criar alertas sem os campos/entidades correspondentes.
- Para esta primeira versão, “próximo do vencimento” significa vencimento nos próximos 7 dias de calendário de Luanda, inclusive; o dashboard usa a mesma definição em todas as vistas.
- Resumo operacional mostra clientes, artigos e documentos emitidos; sem cartão para serviços até haver entidade correspondente.

### Perfil empresarial

- Preservar `Tenant.name` como nome apresentado actualmente e acrescentar denominação legal, nome comercial separado apenas se a arquitectura distinguir o campo; manter compatibilidade para tenants existentes.
- Acrescentar morada estruturada (município, província, país) sem tornar campos opcionais obrigatórios por inferência fiscal.
- Continuar a validar logótipo PNG/JPEG até 1 MB pelo conteúdo completo do parser; preservar as versões usadas por facturas.
- Acrescentar várias contas bancárias com banco, titular, IBAN, moeda, rótulo, activo/inactivo e principal. Migração aditiva copia os campos legados banco/titular/IBAN para uma conta quando qualquer campo estiver preenchido. Manter campos legados para compatibilidade até migração ser confirmada. No documento, o utilizador escolhe conta por factura; snapshot congela só a conta escolhida.
- Acrescentar campos opcionais de identidade visual e preferências: cor principal (só se aplicada ao PDF), texto de rodapé, mensagem padrão, moeda padrão AOA, idioma, prazo padrão e método preferido. Defaults preenchem formulários e podem ser alterados por documento; não alteram documentos emitidos.
- Formulário apresenta estado de gravação, sucesso/erro e aviso de alterações não guardadas. A pré-visualização usa renderer partilhado ou uma representação fiel sem escrever uma factura.

### Facturas, vencimentos e rascunhos

- Acrescentar vencimento opcional às facturas novas; calcular o default a partir do prazo do perfil, mas permitir alteração antes da emissão. Nunca preencher o vencimento retroactivo dos documentos legados.
- Acrescentar modelo `InvoiceDraft` separado, com dados editáveis sem assinatura/hash fiscal, cliente real obrigatório ou número fiscal temporário; permitir reabrir/editar e emitir, reservando cliente/número/hash definitivo somente na emissão. Rascunhos não entram em métricas financeiras.
- Criar lista `/invoices` com filtros por estado/período e detalhe `/invoices/[id]`; preservar tenant-scoping e dados/snapshot históricos.
- Emissão final mantém o serviço actual de assinatura, snapshot empresarial, IVA, desconto, PDF e SAFT. Cada nova opção fiscal que componha o documento deve integrar a sua cadeia/hash de acordo com a regra existente.

### Pagamentos

- Adicionar tabela `Payment` ligada simultaneamente ao tenant e à factura e uma tabela append-only `PaymentEvent` para auditoria. Campos: montante Decimal, AOA, método, data, referência, estado, observações, chave de idempotência, utilizador e carimbos temporais.
- Métodos: transferência bancária, Multicaixa Express, referência Multicaixa, numerário e outro. Todos são registos manuais no estado inicial do produto.
- Novo registo começa PENDENTE, com aviso explícito; utilizador autorizado pode marcar como CONFIRMADO após verificação fora do sistema. PENDENTE → CONFIRMADO/CANCELADO; CONFIRMADO → ESTORNADO. Não editar um registo financeiro confirmado: corrigir por estorno auditado e novo registo.
- Não aceitar mais que o saldo restante quando somados recebimentos confirmados e pendentes activos. Usar transacção serializable/retry de conflito, chave idempotente única e restrição para referências duplicadas quando não vazias.
- Impedir novos pagamentos em documentos anulados/NC/rascunho. Não apagar histórico. Permitir pagamentos parciais/múltiplos. Confirmação só acontece por acção explícita; não há verificação automática.
- Associar ao utilizador da sessão quando ID fiável estiver disponível; nunca aceitar actor de formulário.
- O modelo actual não define papéis de utilizador; nesta etapa qualquer utilizador autenticado associado ao tenant pode registar, confirmar e estornar pagamentos. Endpoints verificam sempre sessão e tenant.
- PDF refeito para factura antiga usa apenas snapshot existente. Se não houver snapshot, não injectar o perfil actual retrospectivamente.

### Relatórios e exportação

- Criar `/reports` e entrada de menu. Relatórios de facturação, recebimentos, dívida/antiguidade de saldos, clientes e artigos facturados. Todos usam helpers comuns e filtros/períodos em `Africa/Luanda`.
- Filtros de cliente e estado aplicam-se à consulta e ao ficheiro exportado. Recebimentos agrupam por método e separam PENDENTE de CONFIRMADO. Dívida calcula ageing contra vencimento e saldo actual.
- Ageing de dívida agrupa saldo vencido em 1–30, 31–60, 61–90 e mais de 90 dias; saldo ainda no prazo fica numa categoria separada.
- PDF usa PDFKit existente; CSV usa geração local com UTF-8/BOM e escaping correcto de aspas/separadores; XLSX usa biblioteca mantida e instalada se disponível, ou uma implementação validada sem criar um botão vazio. Todos os exports incluem empresa, NIF se disponível, título, período, data de geração, filtros e totais coerentes.
- Não calcular lucro/margem, previsão ou conversão FX porque o modelo não tem custo, previsão ou taxa fiável.

### Segurança e responsividade

- Todas as páginas e endpoints financeiros autenticam a sessão e filtram pelo `tenantId` da sessão. Validar invoiceId/Payment id dentro do tenant antes de leitura/escrita.
- Pedidos financeiros passam por schemas server-side; erros não devolvem mensagens internas ou dados de outros tenants.
- PDFs/listas só devolvem dados bancários quando o documento os inclui. Eventos de pagamento registam actor de sessão, estado anterior/novo e data.
- Seguir Tailwind e componentes existentes; suportar teclado, labels, focus, mobile e table overflow.

## Fontes e integração externa

- A aplicação não dispõe de chaves, conta de comerciante ou documentação de integração. A [página oficial de parceiros EMIS](https://emis.ao/pt/parceiros/) descreve prestadores/soluções de pagamentos e é uma porta para contratação, não credencia esta aplicação. Portanto, Multicaixa Express e pagamento por referência ficam manuais, claramente rotulados, até a empresa fornecer integração autorizada.
- Preservar a nota do README: o validador da app não certifica o programa nem prova conformidade fiscal. Não impor nova regra fiscal baseado numa guia pública de 2017; requisitos devem ser validados numa etapa de certificação com fonte oficial actual.

## Critérios de aceitação

- Dashboard calcula e filtra métricas reais com data de emissão separada da data de pagamento, inclui somente recebimentos confirmados, não soma moedas incompatíveis e trata parcialmente pagas vencidas.
- Facturas FT anuladas e NC não duplicam facturação; rascunhos não entram nos totais.
- Perfil permite editar dados, várias contas, preferências, logótipo e pré-visualização; mudanças futuras não alteram snapshots emitidos.
- Lista/detalhe de facturas e operações de pagamento são tenant-scoped, acessíveis e responsivas; pagamentos são idempotentes, auditáveis e limitados ao saldo.
- Multicaixa Express/referência aparecem como registo manual e não fabricam confirmação automática.
- Relatórios filtram os mesmos dados apresentados e cada export disponível abre e contém os mesmos totais.
- Suite de testes relevante e build passam; migração é aditiva, validada no schema e aplicada em banco local disponível, ou fica explicitamente marcada pendente com causa.

## Decisões pendentes de desenho

- Fonte/taxas para moedas estrangeiras e moeda de apresentação: não definida; manter apenas AOA e exibir essa limitação.
- Conta/permissões de comerciante Multicaixa Express ou pagamento por referência: não fornecida; sem integração automática.
- Regras de certificação e fiscais actuais para estados, prazo, recibo e campos obrigatórios: manter comportamento existente até validação oficial.
- Serviço como entidade separada: inexistente; catálogo `Product` continuará a suportar artigos/serviços sem relatório separado.
