# Plano de Implementação — Redesign UX/UI Facturação Angola

> **Para execução:** usar `superpowers:executing-plans` e concluir cada tarefa pela ordem abaixo. Este plano implementa a proposta aprovada para redesenhar visualmente o fluxo existente, sem mudar lógica ou funcionalidades.

**Goal:** Aplicar às páginas existentes uma identidade de ERP financeiro coerente, responsiva e inspirada na referência Behance, preservando o comportamento atual da aplicação.

**Architecture:** Definir tokens globais e componentes visuais reutilizáveis; adicionar um shell autenticado com navegação apenas para rotas já existentes; atualizar os ecrãs de dashboard, clientes, produtos, emissão de fatura, login e registo em pequenos grupos coesos. Manter layouts de servidor/cliente e chamadas de dados atuais, alterando apenas apresentação e composição visual.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS existente e componentes locais em `src/components/ui`. Não adicionar dependências.

**Spec:** `docs/superpowers/specs/2026-10-19-facturacao-angola-ui-design.md`

**Global Constraints:**
- Preservar rotas, consultas, autenticação, validações, cálculos, estados, emissão de PDF e conteúdo funcional dos controlos.
- Não criar dados de exemplo, novas páginas, links para destinos inexistentes ou ações para botões atualmente sem comportamento.
- Manter os rótulos e textos em português e os valores monetários em AOA/Kz.
- Respeitar instruções locais em `AGENTS.md`, incluindo leitura da documentação local do Next antes de alterações específicas do framework.
- Não executar testes automatizados; esta tarefa não inclui pedido de testes. Fazer apenas inspeção visual da interface implementada.

**Review Focus:**
- Confirmar que o shell só envolve páginas autenticadas e que a navegação aponta para `/`, `/invoices/new`, `/customers` e `/produtos`.
- Comparar cuidadosamente o JSX antes/depois nos formulários para garantir que nomes, estado, handlers e cálculos permanecem ligados aos mesmos controlos.
- Verificar responsividade, navegação por teclado, foco visível, estados vazios e mensagens de erro existentes.
- Evitar extrapolar o dashboard com gráficos ou métricas sem dados.

## Tarefa 1: Criar a base visual e o shell autenticado

**Ficheiros:**
- Alterar `src/app/globals.css`
- Alterar `src/app/(dashboard)/layout.tsx`
- Criar `src/components/app-shell.tsx`
- Alterar `src/components/ui/button.tsx`
- Alterar `src/components/ui/card.tsx`
- Criar `src/components/ui/input.tsx` apenas se os controlos atuais beneficiarem de uma abstração comum sem mudar as suas props/handlers

**Passos:**
1. Introduzir variáveis CSS para azul-marinho `#102B46`, azul `#2878D0`, ciano `#38A7B8`, fundo `#F3F6FA`, texto `#1C2D3F`, auxiliar `#708195`, erro `#C44747` e sucesso `#26866A`; configurar tipografia local sem downloads.
2. Refinar os componentes Button e Card com variantes/props pequenas e compatíveis com usos atuais; acrescentar foco visível, estados disabled e tamanhos responsivos. Evitar migração desnecessária de todas as classes consumidoras.
3. Implementar shell com marca, navegação para as quatro rotas existentes e estado ativo baseado na rota. Em mobile, permitir que a navegação se recolha ou se transforme numa faixa compacta acessível.
4. Manter no layout de servidor a verificação de sessão/tenant existente. O shell não deve buscar dados de negócio nem introduzir redirecionamentos novos.
5. Inspecionar todos os usos atuais dos componentes partilhados e ajustar apenas incompatibilidades visuais.

**Verificação:** inspecionar a navegação em larguras desktop e mobile e confirmar no código que cada href corresponde a uma rota existente.

## Tarefa 2: Aplicar o sistema visual às páginas de gestão

**Ficheiros:**
- Alterar `src/app/(dashboard)/page.tsx`
- Alterar `src/app/(dashboard)/customers/page.tsx`
- Alterar `src/app/(dashboard)/produtos/page.tsx`

**Passos:**
1. Dashboard: apresentar o título/contexto e os três contadores existentes em cartões alinhados; preservar as consultas e não adicionar gráficos, séries ou valores calculados sem origem atual.
2. Clientes: aplicar cabeçalho, espaçamento e superfície/tabela consistentes. Preservar a ação “Novo Cliente” com o comportamento atual e o estado vazio existente.
3. Produtos: estilizar a tabela atual com cabeçalhos legíveis, alinhamento de valores, tratamento de ecrã estreito e estado vazio existente; manter as mesmas colunas e dados.
4. Usar os componentes de base somente quando simplificarem o estilo, sem alterar carregamento ou formato dos dados.

**Verificação:** rever as três telas com dados reais disponíveis e nos estados vazios; confirmar que os textos e colunas existentes continuam presentes.

## Tarefa 3: Redesenhar visualmente a emissão de fatura

**Ficheiro:**
- Alterar `src/app/(dashboard)/invoices/new/page.tsx`

**Passos:**
1. Ler integralmente o formulário e marcar os campos, estado React, handlers, validações, cálculo de totais, chamadas de API e tratamento de erro atuais.
2. Reorganizar visualmente dados do adquirente, linhas de artigos e resumo de valores em secções claras e responsivas.
3. Melhorar hierarquia de subtotal, IVA e total sem alterar fórmulas, precisão, moeda ou momento dos cálculos.
4. Manter os controlos de adicionar/remover linha, dados introdutórios, botão e resultado do PDF ligados aos mesmos handlers. Preservar mensagens de erro inline existentes.
5. Dar aos inputs largura suficiente em mobile e manter rótulos associados e foco visível.

**Verificação:** inspeção visual do formulário e comparação do diff para confirmar que todos os handlers, bindings e expressões de cálculo permanecem intactos.

## Tarefa 4: Unificar login e registo com o sistema visual

**Ficheiros:**
- Alterar `src/app/login/page.tsx`
- Alterar `src/app/register/page.tsx`

**Passos:**
1. Manter campos, validação, estado de envio, mensagens, providers e destinos de navegação atuais.
2. Aplicar a paleta, tipografia, cartões, botões e campos comuns.
3. Em desktop, dispor marca e formulário em duas áreas; em mobile, empilhar com o formulário em primeiro plano.
4. Garantir que autocomplete, labels, foco de teclado e mensagens existentes permanecem ligados corretamente aos inputs.

**Verificação:** rever a composição desktop/mobile e comparar props/handlers do formulário com a versão inicial.

## Tarefa 5: Revisão visual final

**Ficheiros:** os ficheiros tocados nas tarefas anteriores.

**Passos:**
1. Abrir as páginas existentes no navegador local em largura desktop e mobile.
2. Rever navegação, estados vazios, formulários, mensagens de erro visíveis e overflow horizontal.
3. Corrigir inconsistências de alinhamento, contraste, foco ou espaçamento sem ampliar o âmbito funcional.
4. Rever o diff completo para confirmar que as alterações são de apresentação/composição e que não surgiram novas rotas, dependências ou dados artificiais.

**Verificação:** relatório curto das páginas revistas e quaisquer limitações encontradas. Não correr testes automatizados.
