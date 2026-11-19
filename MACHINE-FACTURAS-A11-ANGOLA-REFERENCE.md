# MACHINE FACTURAS — Referencial contabilístico angolano (proposta)
## Estrutura de classificação e correspondência com o plano actual

**Aviso crítico (leia antes de utilizar):**
Esta estrutura é uma **proposta técnica** e não constitui o Plano Geral de Contabilidade (PGC) legal de Angola. A classificação foi aceite da seguinte forma:

1. Não foi encontrada, neste ambiente, uma fonte oficial em texto fácil de ingerir que desembrulhe o PGC em todas as suas classes e conteúdos; por isso, os códigos exactos **não podem ser declarados como oficiais**.
2. A correspondência aqui exibida está **sujeita a validação por contabilista habilitado em Angola**.
3. O utilizador da aplicação deve configurar o seu próprio plano de contas com o seu contabilista; nada neste documento substitui essa validação.

**Fontes consultadas (públicas, sem validação documental em folha legal):**
- `https://ucm.minfin.gov.ao/cs/groups/public/documents/document/aw4z/mjkw/~edisp/minfin3290112.pdf` — material de referência (Angola/MinFin referenciado em pesquisas).
- `https://bibdigital.uportu.pt/bitstream/handle/123456789/1307/RelatorioFinalEstagio_FilipeRibeirinha.pdf` — menciona que o PGC foi aprovado pelo Decreto nº 82/01, de 16 de novembro de 2001 e entrou em vigor em 2000.
- `https://cooperativas.gov.ao/wp-content/uploads/2021/03/Apresentacao-Contabilidade-para-as-Cooperativas.pdf` — apresentação de contabilidade (cooperativas).
- `https://repositorio.ipvc.pt/bitstream/20.500.11960/1487/1/Marcia_Fancony.pdf` — comparação PGCA vs SNC/EC.

**Estado das fontes:** Em ambiente de desenvolvimento offline, nenhum PDF oficial foi lido com sucesso que contenha o texto integral das classes do PGC. O conteúdo exposto na internet limita-se a índices e resumos de apresentações, que não são autorizados a substituir o manual oficial.

**Estrutura proposta (não oficial) — PGC classes como referência organizacional:**

| Classe | Designação proposta | Natureza | Relação com Machine Facturas `kind` |
|---|---|---|---|
| 1 | Meios financeiros líquidos | Debitoral (Activo) | ASSET |
| 2 | Terceiros (devedores e credores correntes) | Mista | ASSET / LIABILITY |
| 3 | Existências | Debitoral (Activo) | ASSET |
| 4 | Activos não correntes (imobilizado) | Debitoral (Activo) | ASSET |
| 5 | Capital e resultados transitados | Credora (Capital Próprio) | EQUITY |
| 6 | Proveitos / Rendimentos | Credora | REVENUE |
| 7 | Custos / Gastos | Debitoral | EXPENSE |
| 8 | Resultados (apuramento) | Mista | EQUITY/REVENUE/EXPENSE |
| 9 | Contabilidade analítica / Centros | N/A | (sem representação actual) |

**Correspondência com as contas semente do Machine Facturas (proposta, sujeita a validação):**

| Código | Designação | kind actual | Classe PGC proposta | Natureza | Movimentação |
|---|---|---|---|---|---|
| 1000 | Caixa | ASSET | 1 (Meios financeiros líquidos) | Debitoral | Debitida por entrada, creditada por saída |
| 1100 | Banco | ASSET | 1 (Meios financeiros líquidos) | Debitoral | Debitida por entrada, creditada por saída |
| 1200 | Contas a receber de clientes | ASSET | 2 (Terceiros) | Debitoral | Debitida por vendas a crédito, creditada por pagamento |
| 1300 | Estoque | ASSET | 3 (Existências) | Debitoral | Debitida por entrada, creditada por saída |
| 1400 | Adiantamentos a fornecedores | ASSET | 3 (ou 2) | Debitoral | Debitida por pagamento antecipado |
| 2000 | Contas a pagar a fornecedores | LIABILITY | 2 (Terceiros) | Credora | Creditada por compra, debitida por pagamento |
| 2100 | IVA a recolher | LIABILITY | 2 (Terceiros) | Credora | Creditada por venda com IVA |
| 2200 | Adiantamentos de clientes | LIABILITY | 2 (Terceiros) | Credora | Creditada por recebimento antecipado |
| 3000 | Capital social | EQUITY | 5 (Capital) | Credora | Creditada por capitalização |
| 3100 | Resultados acumulados | EQUITY | 5/8 (Capital / Resultados) | Credora | Creditada por apuramento da positiva |
| 4000 | Vendas | REVENUE | 6 (Proveitos) | Credora | Creditada por vendas |
| 4100 | Descontos e devoluções em vendas | REVENUE | 6 (Proveitos, redução) | Credora/Debitoral | Debitida por devoluções |
| 5000 | CMV | EXPENSE | 7 (Custos) | Debitoral | Debitida por custo de mercadorias vendidas |
| 5100 | Despesas operacionais | EXPENSE | 7 (Custos) | Debitoral | Debitida por despesas |
| 5200 | Serviços contratados | EXPENSE | 7 (Custos) | Debitoral | Debitida por serviços |

**Critérios de aceitação para uma classificação oficial:**

1. Recebimento da versão actual do PGC em formato legível.
2. Validação pelo contabilista ou ROC (Revisor Oficial de Contas) em Angola.
3. Classificação das contas sintéticas vs analíticas, de acordo com o manual.
4. Definição do mapa de movimentação débito/crédito oficial.
5. Definição das regras de apuramento e transição de resultados entre exercícios.

**O que o Machine Facturas entrega neste estado:**

- Um modelo contabilístico **parametrizável**, com `kind` compatível com as classes acima.
- Uma correspondência proposta entre códigos da aplicação e classes PGC, para orientar o contabilista.
- Relatórios não certificados, claramente rotulados como estimativas.

**O que o Machine Facturas NÃO entrega neste estado:**

- Conformidade legal com o PGC.
- Validação profissional.
- Certificação AGT.
- Preenchimento oficial do plano de contas com notas de lançamento oficiais.

**Aviso final:** o utilizador deve confirmar o seu plano de contas com um contabilista antes de utilizar esta aplicação para finalidade fiscal ou de comunicação oficial. Nada neste documento permite dispensa de validação profissional.
