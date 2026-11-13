/**
 * Machine IA — base de conhecimento da plataforma.
 * Conteúdo curado com base nas funcionalidades realmente implementadas.
 * Não incluir funcionalidades inexistentes; quando algo não está disponível,
 * dizer isso claramente.
 */

export const ASSISTANT_NAME = 'Machine IA';
export const ASSISTANT_TAGLINE = 'Assistente empresarial do Machine Facturas';

export type AssistantAction = { label: string; href: string };

export type AssistantSuggestion = { label: string; prompt?: string; href?: string };

type ModuleHowTo = {
  path: string;
  title: string;
  summary: string;
  howTo: string[];
  suggestions: AssistantSuggestion[];
};

/** Cada módulo de topo do Machine Facturas, com orientação real. */
export const MODULES: ModuleHowTo[] = [
  {
    path: '/',
    title: 'Dashboard',
    summary: 'Visão geral da sua empresa: valores, gráficos e indicadores.',
    howTo: ['Aceda ao Dashboard no menu lateral.', 'Verá receita, despesas, saldo e indicadores por período.', 'Filtre por mês e por ano nos controlos do topo.'],
    suggestions: [
      { label: 'Como registar uma factura?', prompt: 'Como registar uma factura?' },
      { label: 'Onde vejo os relatórios?', prompt: 'Onde encontro os relatórios?' },
      { label: 'O que é o Plano Grátis?', prompt: 'O que posso fazer no plano Grátis?' },
    ],
  },
  {
    path: '/apps',
    title: 'Aplicações',
    summary: 'O que está incluído no seu pacote: Machine Facturas, Stock e Machine RH.',
    howTo: ['Aceda a Aplicações no menu lateral.', 'Verá o estado de cada módulo do seu plano.', 'Os módulos sem pacote aparecem bloqueados com «não incluído».'],
    suggestions: [
      { label: 'O que inclui o meu plano?', prompt: 'O que inclui o meu plano?', href: '/apps' },
      { label: 'Como funciona o Machine RH?', prompt: 'Como funciona o Machine RH?', href: '/rh/dashboard' },
    ],
  },
  {
    path: '/invoices',
    title: 'Facturas',
    summary: 'Emitir facturas, proformas e recibos, registar pagamentos e imprimir PDFs.',
    howTo: ['Aceda a Facturas no menu lateral.', 'Clique em «Emitir factura» para criar uma nova.', 'Seleccione o cliente, adicione produtos/serviços, defina quantidades, preços e IVA.', 'Guarde. No detalhe, emita o PDF ou registe um pagamento.'],
    suggestions: [
      { label: 'Emitir factura passo a passo', prompt: 'Como emito uma factura passo a passo?' },
      { label: 'Como registar um pagamento?', prompt: 'Como registo o pagamento de uma factura?' },
      { label: 'Factura proforma', href: '/invoices/new' },
    ],
  },
  {
    path: '/customers',
    title: 'Clientes',
    summary: 'Cadastrar, editar e consultar clientes da sua empresa.',
    howTo: ['Aceda a Clientes no menu lateral.', 'Clique em «Novo cliente».', 'Preencha nome, NIF, contacto e morada.', 'Guarde. Os clientes ficam disponíveis na emissão de facturas.'],
    suggestions: [{ label: 'Como cadastrar um cliente?', prompt: 'Como cadastrar um cliente?', href: '/customers' }],
  },
  {
    path: '/produtos',
    title: 'Produtos e serviços',
    summary: 'Catálogo de produtos e serviços, com preços, stock e IVA.',
    howTo: ['Aceda a Produtos e serviços.', 'Clique em «Novo produto».', 'Preencha nome, preço, taxa de IVA e stock inicial (se usar stock).', 'Guarde. Os produtos ficam disponíveis para facturação.'],
    suggestions: [
      { label: 'Como cadastro um produto?', prompt: 'Como cadastro um produto?', href: '/produtos' },
      { label: 'Como funciona o controlo de stock?', prompt: 'Como funciona o stock dos produtos?' },
    ],
  },
  {
    path: '/warehouses',
    title: 'Armazéns',
    summary: 'Criar e gerir armazéns (necessário no plano com Stock).',
    howTo: ['Aceda a Armazéns.', 'Clique em «Novo armazém».', 'Defina o nome e o endereço do armazém.', 'Use o módulo Stock para entradas, saídas, ajustes e transferências.'],
    suggestions: [
      { label: 'Como criar um armazém?', prompt: 'Como crio um armazém?', href: '/warehouses' },
      { label: 'Como faço uma transferência de stock?', prompt: 'Como faço uma transferência entre armazéns?' },
    ],
  },
  {
    path: '/stock',
    title: 'Stock (Armazém e Stock)',
    summary: 'Entradas, saídas, lotes, reservas, ajustes, devoluções, consultas e fornecedores.',
    howTo: ['Aceda a Stock no menu lateral.', 'Escolha a operação: entradas, lotes, reservas, ajustes ou devoluções.', 'Os fornecedores são geridos em Stock → Fornecedores.', 'O limite de fornecedores depende do seu pacote.'],
    suggestions: [
      { label: 'Como registar uma entrada de stock?', prompt: 'Como registo uma entrada de stock?', href: '/stock' },
      { label: 'Como gerir fornecedores?', prompt: 'Como crio ou edito um fornecedor?', href: '/stock/fornecedores' },
    ],
  },
  {
    path: '/reports',
    title: 'Relatórios',
    summary: 'Relatórios de vendas, receitas e desempenho.',
    howTo: ['Aceda a Relatórios.', 'Escolha o tipo de relatório e o período.', 'Exporte em PDF ou imprima.'],
    suggestions: [
      { label: 'Relatórios com stock', href: '/stock/consultas' },
      { label: 'Exportar em PDF', prompt: 'Como exporto um relatório para PDF?' },
    ],
  },
  {
    path: '/empresa',
    title: 'Perfil da empresa',
    summary: 'Dados da sua empresa: nome, NIF, contactos e identidade fiscal.',
    howTo: ['Aceda a Perfil da empresa no menu lateral.', 'Actualize nome, NIF, morada, telefones e email.', 'Guarde — esses dados constam nos PDFs emitidos.'],
    suggestions: [{ label: 'Actualizar dados da empresa', prompt: 'Como actualizo os dados da minha empresa?', href: '/empresa' }],
  },
  {
    path: '/rh/dashboard',
    title: 'Machine RH',
    summary: 'Gestão de funcionários, assiduidade, férias, contratos, folha salarial e documentos.',
    howTo: ['Aceda ao Machine RH no menu lateral.', 'Cadastre departamentos, cargos e funcionários.', 'Gere contratos e documentos a partir de modelos.', 'A assiduidade pode ser registada manualmente ou por quiosque/dispositivos.'],
    suggestions: [
      { label: 'Como cadastrar um funcionário?', prompt: 'Como cadastro um funcionário no Machine RH?', href: '/rh/funcionarios' },
      { label: 'Como funciona o processamento salarial?', prompt: 'Como funciona o processamento salarial?', href: '/rh/processamento-salarial' },
      { label: 'Documentos e contratos', prompt: 'Como gero um contrato de trabalho?', href: '/rh/documentos' },
    ],
  },
  {
    path: '/documentos',
    title: 'Documentos Empresariais',
    summary: 'Área para documentos empresariais partilhados com a equipa.',
    howTo: ['Aceda a Documentos no menu lateral.', 'Organize e consulte documentos da empresa.'],
    suggestions: [{ label: 'Ir para Documentos', href: '/documentos' }],
  },
  {
    path: '/ferramentas',
    title: 'Centro de Ferramentas',
    summary: 'Calculadoras fiscais e financeiras grátis para empresas angolanas.',
    howTo: ['Aceda a Ferramentas no menu lateral.', 'Escolha uma calculadora: IVA, salário, IRT, lucro, preço de venda, validador de NIF.', 'Também encontra geradores de orçamento, factura proforma, recibo em PDF.'],
    suggestions: [
      { label: 'Calculadora de salário', href: '/ferramentas/salario' },
      { label: 'Validar NIF', href: '/ferramentas/nif' },
      { label: 'Reduzir o IVA a pagar', prompt: 'Como funciona o IVA em Angola?' },
    ],
  },
];

const MODULE_PREFIXES: Record<string, string[]> = {
  '/invoices': ['/invoices'],
  '/customers': ['/customers'],
  '/produtos': ['/produtos'],
  '/warehouses': ['/warehouses'],
  '/stock': ['/stock'],
  '/reports': ['/reports'],
  '/empresa': ['/empresa'],
  '/rh/dashboard': ['/rh', '/meu-rh'],
  '/documentos': ['/documentos'],
  '/ferramentas': ['/ferramentas'],
  '/apps': ['/apps'],
};

/** Respostas directas para perguntas frequentes (modo sem IA). */
const DIRECT_TOPICS: { keywords: string[]; answer: string; href?: string }[] = [
  {
    keywords: ['emitir factura', 'criar factura', 'nova factura', 'facturar', 'fatura'],
    answer: 'Como emitir uma factura:\n1. Aceda a Facturas → Emitir factura.\n2. Seleccione o cliente (ou cadastre um novo).\n3. Adicione os produtos/serviços com quantidades, preços e IVA.\n4. Reveja os totais e clique em Guardar.\n5. No detalhe da factura, clique em PDF para imprimir ou em «Registar pagamento» para dar entrada.',
    href: '/invoices/new',
  },
  {
    keywords: ['registar pagamento', 'dar entrada', 'receber pagamento', 'cobrir factura'],
    answer: 'Para registar um pagamento de uma factura:\n1. Abra a factura em Facturas.\n2. Clique em «Registar pagamento».\n3. Indique o valor, o método e a data.\n4. A factura passa a «Paga» (total) ou «Parcial» (valor parcial).',
    href: '/invoices',
  },
  {
    keywords: ['cadastrar cliente', 'criar cliente', 'novo cliente', 'adicionar cliente'],
    answer: 'Para cadastrar um cliente:\n1. Aceda a Clientes → Novo cliente.\n2. Preencha nome, NIF, contacto e morada.\n3. Guarde. O cliente fica disponível para facturas e relatórios.',
    href: '/customers',
  },
  {
    keywords: ['cadastrar produto', 'criar produto', 'novo produto', 'produto ou serviço'],
    answer: 'Para cadastrar um produto ou serviço:\n1. Aceda a Produtos e serviços → Novo produto.\n2. Preencha nome, preço, IVA e stock inicial (se aplicável).\n3. Guarde. O produto fica disponível na facturação.',
    href: '/produtos',
  },
  {
    keywords: ['cadastrar funcionário', 'criar funcionário', 'novo funcionário', 'funcionario'],
    answer: 'Para cadastrar um funcionário no Machine RH:\n1. Aceda a Machine RH → Funcionários → Novo funcionário.\n2. Preencha os dados de identificação (nome, BI/NIF, data de nascimento).\n3. Defina departamento e cargo.\n4. Preencha os dados profissionais (contrato, salário, data de admissão).\n5. Clique em Guardar.',
    href: '/rh/funcionarios',
  },
  {
    keywords: ['processamento salarial', 'processar salários', 'processar salarios', 'folha salarial', 'salários'],
    answer: 'Como funciona o processamento salarial:\n1. Aceda a Machine RH → Processamento salarial.\n2. Crie um processamento do período (mês/ano).\n3. As regras IRT/INSS são aplicadas como configurado pela empresa — confirme as percentagens com o Gestor RH/Legal da sua empresa antes de publicar.\n4. Reveja os valores, processe e publique os pagamentos.',
    href: '/rh/processamento-salarial',
  },
  {
    keywords: ['contrato de trabalho', 'gerar contrato', 'modelo de contrato', 'contrato'],
    answer: 'Como gerar um contrato de trabalho:\n1. Aceda a Machine RH → Documentos.\n2. Escolha o modelo de contrato.\n3. Seleccione o funcionário.\n4. O Machine IA preenche o documento com os dados existentes.\n5. Reveja e exporte em Word ou PDF.',
    href: '/rh/documentos',
  },
  {
    keywords: ['transferência entre armazéns', 'transferir stock', 'transferencia'],
    answer: 'Como fazer uma transferência de stock:\n1. Aceda a Stock → Transferências.\n2. Escolha o armazém de origem e o de destino.\n3. Seleccione os produtos e as quantidades.\n4. Confirme. Os movimentos ficam registados e auditados.',
    href: '/stock',
  },
  {
    keywords: ['criar armazém', 'novo armazém', 'armazem'],
    answer: 'Como criar um armazém:\n1. Aceda a Armazéns → Novo armazém.\n2. Indique o nome e o endereço do armazém.\n3. Guarde. Depois use o módulo Stock para entradas e saídas.',
    href: '/warehouses',
  },
  {
    keywords: ['plano grátis', 'grátis', 'gratis', 'o que posso fazer'],
    answer: 'No plano Grátis pode emitir facturas, gerir clientes e produtos, consultar relatórios básicos e usar as ferramentas do Centro de Ferramentas. O módulo Stock (armazéns, lotes, reservas) e o Machine RH são pagos e dependem do pacote contratado.',
    href: '/apps',
  },
  {
    keywords: ['nif', 'validar nif'],
    answer: 'O validador de NIF, no Centro de Ferramentas, verifica a estrutura do NIF angolano (9 dígitos) e indica se está formalmente válido. Consulte a AGT para confirmar a situação fiscal do contribuinte.',
    href: '/ferramentas/nif',
  },
];

export function moduleForPath(path: string): ModuleHowTo | null {
  if (!path) return null;
  const clean = path.split('?')[0].split('#')[0];
  for (const [prefix, list] of Object.entries(MODULE_PREFIXES)) {
    if (list.some((p) => clean === p || clean.startsWith(`${p}/`))) {
      return MODULES.find((m) => m.path === prefix) ?? null;
    }
  }
  const exact = MODULES.find((m) => m.path === clean);
  if (exact) return exact;
  return MODULES.find((m) => m.path === '/') ?? null;
}

export function suggestionsForPath(path: string): AssistantSuggestion[] {
  return moduleForPath(path)?.suggestions ?? [
    { label: 'Como emitir uma factura?', prompt: 'Como emito uma factura?' },
    { label: 'Como cadastrar um funcionário?', prompt: 'Como cadastro um funcionário?' },
    { label: 'O que posso fazer no plano Grátis?', prompt: 'O que posso fazer no plano Grátis?' },
  ];
}

const normalize = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'um', 'uma', 'uns', 'umas', 'para', 'por', 'com', 'sem', 'que', 'nao', 'se', 'ao', 'aos', 'no', 'na', 'nos', 'nas', 'os', 'as', 'o', 'a', 'e', 'vou', 'vai', 'como', 'posso', 'quero']);

const tokenize = (value: string): string[] =>
  normalize(value).split(/[^a-z0-9]+/).filter((word) => word.length >= 3 && !STOPWORDS.has(word));

export function offlineAnswer(query: string, path: string): { answer: string; href?: string } | null {
  const q = normalize(query);
  const queryTokens = new Set(tokenize(query));
  let best: { score: number; topic: (typeof DIRECT_TOPICS)[number] } | null = null;
  for (const topic of DIRECT_TOPICS) {
    let phraseBonus = 0;
    let matched = 0;
    for (const keyword of topic.keywords) {
      const k = normalize(keyword);
      if (q.includes(k)) {
        phraseBonus += 100;
        continue;
      }
      const kw = tokenize(keyword);
      if (kw.length === 0) continue;
      const hits = kw.filter((token) => queryTokens.has(token)).length;
      if (hits === kw.length) matched += hits * 10;
      else if (hits >= Math.ceil(kw.length * 0.6)) matched += hits * 5;
    }
    const score = phraseBonus + matched;
    if (score > 0 && (!best || score > best.score)) best = { score, topic };
  }
  if (best) return { answer: best.topic.answer, href: best.topic.href };
  const mod = moduleForPath(path);
  if (mod) {
    return {
      answer: `Estamos em ${mod.title}.\n${mod.summary}\n\nPassos:\n${mod.howTo.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
      href: mod.path === '/' ? undefined : mod.path,
    };
  }
  return null;
}

export function platformKnowledgeBrief(): string {
  return MODULES.map((m) => `- ${m.title} (${m.path}): ${m.summary}`).join('\n');
}

export function contextBriefForPath(path: string): string {
  const mod = moduleForPath(path);
  if (!mod) return '';
  return [
    `Página actual: ${mod.title} (${mod.path}).`,
    `O que a página faz: ${mod.summary}`,
    'Passos conhecidos para operações nesta página:',
    ...mod.howTo.map((s, i) => `${i + 1}. ${s}`),
  ].join('\n');
}
