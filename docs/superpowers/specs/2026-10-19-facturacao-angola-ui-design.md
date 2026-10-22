# Direção de UX/UI — Facturação Angola

## Intenção

Dar às telas existentes da aplicação uma aparência consistente de ERP financeiro profissional, inspirada no painel “Financial Records” da referência do Behance. A inspiração é a estrutura de navegação lateral azul-marinho, conteúdo claro, cartões financeiros, tabelas densas e acentos azuis. O resultado mantém a identidade e os dados próprios de Facturação Angola; não copia o enquadramento preto de portfólio nem o conteúdo jurídico da referência.

## Objetivo e limites

- Aplicar uma linguagem visual única ao dashboard, emissão de fatura, clientes, produtos, login e registo.
- Melhorar hierarquia, leitura de valores, estados vazios, formulários, foco de teclado e adaptação a ecrãs pequenos.
- Preservar rotas, campos, dados, cálculos, validações, autenticação e emissão de PDF.
- Não criar páginas nem funcionalidades que não existam hoje. Em especial, a interface não deve prometer uma listagem de faturas ou ações de criação que ainda não funcionem.

## Referência visual

A imagem aberta do projeto no Behance apresenta um painel de registos financeiros em fundo claro, com barra lateral azul-marinho, área central branca, métricas e gráficos, tabelas e ações azuis. Para este produto, a mesma hierarquia será aplicada a faturas, clientes, produtos e valores em AOA. O molde preto em volta do portátil pertence à apresentação do estudo e não será usado na aplicação.

Referência: [ERP System Law Office — SaaS Dashboard UI/UX Case Study](https://www.behance.net/gallery/251930235/ERP-System-Law-Office-SaaS-Dashboard-UIUX-Case-Study/modules/1462384175).

## Sistema visual proposto

### Cores

- Azul-marinho `#102B46`: navegação e blocos de maior contraste.
- Azul de ação `#2878D0`: botões primários, links e seleção ativa.
- Ciano `#38A7B8`: acento reservado para estados financeiros secundários e gráficos existentes.
- Fundo `#F3F6FA`: canvas principal, com superfícies brancas.
- Tinta `#1C2D3F` e cinza `#708195`: texto principal e informação auxiliar.
- Vermelho `#C44747` e verde `#26866A`: estados de erro e sucesso, usados apenas quando já representados pela aplicação.

### Tipografia

- Interface: pilha local `Inter, Segoe UI, Arial, sans-serif`, sem carregar fontes externas.
- Valores tabulares: algarismos tabulares e pilha mono local (`ui-monospace`) apenas onde a comparação de números importa, como números de documento e totais.
- Títulos com pesos e escalas bem separados dos rótulos e metadados; linguagem curta em português.

### Layout e assinatura

- Área autenticada com barra lateral fixa azul-marinho, marca “Facturação Angola” e ligações apenas para rotas existentes: Visão geral, Emitir fatura, Clientes e Produtos.
- Cabeçalho do conteúdo com título da página, contexto da empresa e ações existentes.
- Canvas claro com grelha responsiva, margens consistentes, superfícies brancas e linhas divisórias finas; sombras discretas.
- Assinatura visual: um filete ciano vertical ao lado do item ativo na barra lateral, associado a uma segunda escala compacta para valores e números de documento.
- Em ecrãs pequenos, a navegação passa para uma faixa compacta recolhível; tabelas e formulários continuam utilizáveis sem apertar os campos.

## Estrutura das telas

### Área autenticada

```text
┌ barra lateral ─────────────┬ cabeçalho: título · empresa · utilizador ┐
│ marca Facturação Angola   │                                         │
│ Visão geral               │ cartões: faturas · clientes · produtos │
│ Emitir fatura             │                                         │
│ Clientes                  │ conteúdo da página / formulários        │
│ Produtos                  │                                         │
└───────────────────────────┴─────────────────────────────────────────┘
```

- **Dashboard (`/`)**: título contextual da empresa e os três contadores existentes — faturas, clientes e produtos — apresentados como cartões informativos. Sem gráficos ou valores inventados que não sejam sustentados pelos dados atuais.
- **Emissão (`/invoices/new`)**: dados do adquirente num cartão; linhas de artigos numa tabela com campos alinhados; subtotal, IVA e total destacados numa coluna de resumo; botão de emissão associado ao resumo.
- **Clientes (`/customers`)**: cabeçalho, ação existente e tabela/lista com nome e NIF. A apresentação do estado vazio convida a usar a ação sem alterar o seu comportamento atual.
- **Produtos (`/produtos`)**: cabeçalho e tabela responsiva com código, nome, preço, stock e categoria; estado vazio claro.

### Acesso público

- **Login (`/login`)** e **registo (`/register`)** reutilizam cores, tipografia, campos, botões e mensagens de estado do sistema.
- Em desktop, painel curto de marca à esquerda e formulário focado à direita; em mobile, uma coluna com o formulário no topo.
- Campos mantêm rótulos explícitos, foco visível e mensagens associadas ao formulário.

## Fora do âmbito

- Alterar operações de autenticação, persistência, validação, cálculo de impostos ou geração de PDF.
- Criar novas rotas, dashboards de gráficos, histórico de faturação, pesquisa ou filtros funcionais.
- Inventar dados, clientes, faturas ou NIFs para preencher estados vazios.

## Decisões do agente

- Implementar diretamente nas páginas e estilos atuais em Next.js/Tailwind, sem introduzir uma dependência nova.
- Manter as palavras “fatura”, AOA/Kz e nomes dos campos reconhecíveis para o utilizador atual.
- Aplicar a direção ao fluxo completo de páginas existente, como solicitado, sem alterar o comportamento dos controlos.

## Critérios de aceitação visual

- Todas as páginas existentes partilham a mesma paleta, tipografia, campos, botões e espaçamento.
- A navegação autenticada torna as páginas existentes descobríveis e assinala a rota atual.
- As páginas continuam legíveis e utilizáveis em desktop e mobile, com foco de teclado visível.
- Nenhuma lógica de negócio ou comportamento de ação é alterado pelo trabalho de design.
