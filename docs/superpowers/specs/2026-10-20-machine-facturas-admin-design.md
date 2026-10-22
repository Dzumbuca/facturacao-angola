# Machine Facturas — desenho do painel administrativo

**Data:** 2026-10-20  
**Estado:** para aprovação do utilizador  
**Âmbito:** painel global de administração para a aplicação existente

## Intenção

Adicionar uma área administrativa real para a equipa que opera o Machine Facturas, sem confundir a facturação das empresas com a operação ou eventual receita da plataforma. O painel deve permitir acompanhar empresas, utilizadores e documentos, executar operações de estado reversíveis com motivo e auditoria, e verificar serviços com resultados reais.

## Descoberta da arquitectura actual

- Next.js 16 App Router, React 19, TypeScript, Tailwind 4, NextAuth 5 beta com estratégia JWT e Prisma Adapter.
- O login é por credenciais e bcrypt. A sessão expõe `tenantId`; o callback `authorized` e os layouts usam esse valor para proteger a aplicação normal.
- `User` possui `tenantId` obrigatório e `password`, mas não tem papel, estado ou última actividade. Não existe administrador global explícito.
- `Tenant` representa empresas e não tem estado de activação/suspensão.
- Existem `Invoice`, `Payment`, `InvoiceDraft`, `PaymentEvent` e `CompanyLogo`. Os documentos e pagamentos já têm dados operacionais; não há planos ou receita da plataforma.
- As rotas de API existentes estão organizadas por funcionalidade. A segurança tenant-scoped deve continuar a ser aplicada nelas; a área administrativa terá guardas próprias.
- Não foi encontrado armazenamento separado de ficheiros nem mecanismo geral de recolha de erros/performance. A página de sistema só pode reportar o que for efectivamente verificável.
- O esquema tem migrações Prisma existentes. A mudança deve ser aditiva e compatível com registos actuais.

## Objectivos

1. Criar `/admin` e páginas administrativas próprias, com autorização consultada no servidor em páginas, APIs e mutações.
2. Distinguir administrador da plataforma de papéis internos da empresa; não promover contas existentes durante a migração.
3. Implementar exploração paginada de empresas, utilizadores e documentos com consultas limitadas e dados mínimos.
4. Suspender/reactivar contas sem apagar documentos nem alterar o histórico fiscal.
5. Registar mutações administrativas num histórico só de acréscimo, com actor, recurso, acção, motivo e data.
6. Mostrar métricas reais e estados técnicos verificáveis, sem inventar actividade, receitas da plataforma ou sinais de saúde.
7. Preservar as rotas de facturação existentes e os seus limites por empresa.

## Fora do âmbito

- Planos, subscrições, cobrança ou receita própria da plataforma, pois não existem no produto actual.
- Impersonação de utilizadores, leitura de palavras-passe/sessões, alteração de documentos emitidos, exclusão de facturas e botões fictícios de manutenção.
- Um construtor genérico de permissões configuráveis, uma plataforma de logs/observabilidade externa ou armazenamento de ficheiros que não existe hoje.
- Recuperação de acesso administrativo; manter o fluxo de autenticação existente e documentar lacunas, sem criar redefinição insegura.

## Modelo de autorização proposto

Adicionar papéis separados no `User`: um papel de plataforma (`NONE`/`ADMIN`) e um papel de empresa (`OWNER`/`ADMIN`/`BILLING`/`VIEWER`, ajustado às operações realmente existentes). Tornar `tenantId` opcional para permitir uma conta de plataforma sem empresa artificial; os utilizadores actuais mantêm o mesmo `tenantId` e recebem o papel de empresa mais restrito compatível com o funcionamento actual, sem acesso global. O registo normal continua a criar uma empresa e utilizador em transacção com papel de proprietário.

A sessão JWT transporta o identificador do utilizador, mas cada operação administrativa consulta novamente o utilizador e o papel actual na base de dados para permitir revogação imediata e impedir confiança num papel antigo do token. Uma função server-only `requirePlatformAdmin()` centraliza a verificação e devolve apenas identidade mínima. Cada API/mutação chama-a explicitamente; o layout administrativo também a chama. O middleware/proxy pode melhorar o redireccionamento, mas nunca é a barreira de autorização.

Criar um comando de bootstrap manual, executado por operador com acesso ao projecto/base de dados, que recebe o ID exacto de uma conta existente, exige confirmação interactiva explícita, verifica a conta e promove-a numa transacção registando evento de bootstrap sem actor de aplicação. Não escolher conta por e-mail/nome nem executar promoção automaticamente. O bootstrap preserva a associação e o papel da empresa da conta indicada; se o operador desejar uma conta exclusivamente de plataforma, cria primeiro uma conta pelo fluxo controlado normal e promove o ID explicitamente. Depois do primeiro administrador, promoções/revogações usam a operação administrativa auditada. Impedir que o último administrador perca acesso por qualquer via: revogação do papel global, suspensão ou outra alteração de estado.

## Suspensão e integridade

Adicionar estado e metadados de suspensão a `Tenant` e `User`. Suspender empresa bloqueia autenticação normal e novas mutações da empresa (criar/editar clientes, produtos, rascunhos, emitir/anular facturas, registar pagamentos e alterar perfil); permite autenticação em modo de consulta e exportação/leitura de documentos existentes. A regra aplica-se no servidor às rotas de escrita tenant-scoped. Reactivar restaura a escrita normal. Não apagar nem alterar documentos existentes.

Suspender utilizador bloqueia novos logins e, para sessões JWT já emitidas, toda a operação normal e administrativa verifica o estado actual em base de dados; a leitura de documentos para exportação fica igualmente sujeita ao estado da empresa e da conta. O administrador não altera valores fiscais históricos nem estados de documentos através do painel.

## Navegação e páginas

- `/admin`: dashboard agregada com empresas activas/suspensas, utilizadores, facturas emitidas e volume facturado; separar volume facturado, pagamentos confirmados e saldo em dívida. Gráficos por dia/mês para empresas, utilizadores e facturas, com intervalo limitado (7/30/90 dias e datas personalizadas). Sem métricas de receita da plataforma.
- `/admin/empresas`: pesquisa, estado, ordenação, paginação no servidor e detalhe com contagens; suspender/reactivar com motivo obrigatório e histórico.
- `/admin/utilizadores`: pesquisa, papel, estado, empresa e data; alterar apenas papéis definidos e estados permitidos, proteger o último administrador contra revogação de papel e suspensão, e registar motivo. Nunca devolver hash de senha, tokens ou credenciais.
- `/admin/documentos`: pesquisa/paginação e leitura de número, tipo, empresa, emissão, estado, total e moeda; nenhuma mutação fiscal.
- `/admin/sistema`: verificação real de consulta à base de dados; versão se disponível e uptime do processo actual, claramente identificados; não afirmar estado de armazenamento/serviços externos inexistentes nem apresentar stack traces. Erros recentes só serão mostrados se houver fonte de recolha segura; caso contrário indicar que ainda não existe monitorização de erros.
- `/admin/auditoria`: pesquisa e paginação dos eventos administrativos, sem editar/apagar.
- `/admin/configuracoes`: apenas identidade/contactos e preferências globais não secretas, caso se justifique uma entidade de configuração persistente; sem valores fiscais retroactivos ou segredos. Se só existir configuração fixa de marca, mantê-la no código e não criar formulário sem efeito.

Todas as páginas partilham uma shell administrativa com sidebar de scroll independente, cabeçalho contextual, identificação do operador, estados vazios/erro/carregamento, foco acessível e layout adaptável. Reutilizar estilos e componentes existentes quando apropriado.

## Dados e auditoria

Adicionar um modelo `AdminAuditLog` append-only, com actor opcional (bootstrap), tipo de actor, acção, tipo/ID do recurso, motivo, resultado, metadados permitidos e timestamp; índices para data, actor e recurso. Não gravar credenciais, hashes, tokens, IBAN completo ou payloads pessoais desnecessários. Registar suspensão/activação, alteração de papéis/estado e bootstrap. A gravação de estado e evento usa transacção. O código de aplicação não expõe operações de update/delete sobre auditoria.

Consultas administrativas usam `select` explícito, validação de query e paginação com limite máximo. Documentos mantêm filtros de empresa e não carregam linhas fiscais completas para tabelas. Métricas da dashboard usam estados definitivos existentes e agregações no PostgreSQL; pagamentos pendentes não contam como recebidos.

## Segurança e experiência

- Guardas server-only em todas as páginas e cada endpoint; validação server-side de parâmetros, IDs, estados e motivos.
- Mutações com autenticação de origem/CSRF conforme o padrão de formulários/NextAuth usado pelo projecto, sem endpoints mutáveis acessíveis por GET.
- Não permitir auto-elevação nem aceitar papel global arbitrário de payload sem actor global autorizado.
- Revalidar estado/papel em cada mutação e executar verificações do último administrador dentro de transacção.
- Respostas de erro genéricas para utilizadores; detalhes ficam no servidor sem segredos ou stack traces na UI.
- Datas em `pt-AO`, fuso `Africa/Luanda`; AOA/Kz quando aplicável.
- Auditoria para falhas de acesso administrativo apenas se puder ser gravada sem expor dados e sem permitir abuso de escrita; o requisito principal são as operações críticas.

## Migrações e preservação

Criar uma migração aditiva: colunas de papel/estado, `tenantId` nullable mantendo as relações antigas, metadados de suspensão e tabela de auditoria. Aplicar defaults que não promovam ninguém. Garantir que o registo existente e as facturas/drafts/pagamentos continuam intactos. Não executar reset nem seed destrutivo.

## Verificação e critérios de aceitação

Adicionar testes para guardas e isolamento: anónimo, utilizador normal, administrador de empresa e administrador de plataforma; papel revogado com JWT antigo; não auto-elevação; último administrador; filtros tenant-scoped; suspensão bloqueia escrita mas preserva leitura/exportação; auditoria atómica; documentos e totais imutáveis. Executar testes existentes relevantes e build de produção, registando exactamente comandos e resultados. Testar interface em larguras desktop/tablet/telemóvel apenas se houver ambiente de browser disponível; não declarar sucesso sem executar.

## Decisões que ficam ao implementador

- Nomes exactos dos enums e interfaces TypeScript, localização dos helpers e componentes e formato de paginação.
- Quais rotas existentes de consulta permanecem disponíveis durante suspensão, desde que a regra acima (consulta/exportação sim, mutação não) seja mantida.
- Como representar falta de logs/telemetria e versão no ecrã do sistema, sem inventar dados.
- Se a secção de configurações globais terá armazenamento persistente: só criá-lo quando existir ao menos uma configuração real e não secreta com efeito observável.

## Resultado esperado

Painel administrativo integrado ao produto actual, com rotas reais e dados reais; autorização e auditoria no servidor; operações reversíveis de estado; migração compatível; documentação clara do que ainda depende de telemetria ou recuperação de acesso. Nenhuma alegação de certificação fiscal ou receita própria da plataforma.

