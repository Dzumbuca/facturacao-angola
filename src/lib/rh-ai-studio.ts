/**
 * Estúdio IA — catálogo de tipos de documento e construtores de instrução.
 */
export type DocumentCategory =
  | 'DECLARACOES' | 'CONTRATOS' | 'RECURSOS_HUMANOS' | 'CARTAS_FORMAIS'
  | 'OFICIOS_REQUERIMENTOS' | 'RELATORIOS' | 'PROPOSTAS_COMERCIAIS'
  | 'MEMORANDOS' | 'ACTAS' | 'COMUNICADOS' | 'ADMINISTRATIVOS' | 'OUTROS';

export type DocumentField = {
  key: string;
  label: string;
  placeholder: string;
  kind?: 'text' | 'textarea' | 'number' | 'date' | 'select';
  options?: { value: string; label: string }[];
  optional?: boolean;
};

export type DocumentType = {
  id: string;
  label: string;
  description: string;
  example: string;
  category: DocumentCategory;
  fields: DocumentField[];
};

export const CATEGORIES: { value: DocumentCategory; label: string; description: string }[] = [
  { value: 'DECLARACOES', label: 'Declarações', description: 'Trabalho, actividade, idoneidade' },
  { value: 'CONTRATOS', label: 'Contratos', description: 'Trabalho e prestação de serviços' },
  { value: 'RECURSOS_HUMANOS', label: 'Recursos humanos', description: 'Anúncios e avisos internos' },
  { value: 'CARTAS_FORMAIS', label: 'Cartas formais', description: 'Apresentação, resposta, reclamação' },
  { value: 'OFICIOS_REQUERIMENTOS', label: 'Ofícios e requerimentos', description: 'Pedidos institucionais' },
  { value: 'RELATORIOS', label: 'Relatórios', description: 'Técnico, administrativo, auditoria' },
  { value: 'PROPOSTAS_COMERCIAIS', label: 'Propostas comerciais', description: 'Orçamento ou oferta de serviços' },
  { value: 'MEMORANDOS', label: 'Memorandos', description: 'Internos e executivos' },
  { value: 'ACTAS', label: 'Actas de reuniões', description: 'Deliberações e presenças' },
  { value: 'COMUNICADOS', label: 'Comunicados', description: 'Internos e externos' },
  { value: 'ADMINISTRATIVOS', label: 'Documentos administrativos', description: 'Minutas e requerimentos' },
  { value: 'OUTROS', label: 'Outros', description: 'Documento de texto livre' },
];

const COMPANY: DocumentField[] = [
  { key: 'empresa', label: 'Nome da empresa', placeholder: 'Ex.: Marstore, Lda' },
  { key: 'nifEmpresa', label: 'NIF da empresa', placeholder: 'Ex.: 500000001' },
  { key: 'endereco', label: 'Endereço', placeholder: 'Ex.: Luanda, Ingombota' },
];

const SIGNATORY: DocumentField[] = [
  { key: 'responsavelNome', label: 'Nome do responsável', placeholder: 'Ex.: Joaquim Zumbuca' },
  { key: 'responsavelCargo', label: 'Cargo do responsável', placeholder: 'Ex.: Administrador' },
];
export const DOCUMENT_TYPES: DocumentType[] = [
  {
    id: 'DECLARACAO_TRABALHO',
    label: 'Declaração de trabalho',
    description: 'Confirmar vínculo laboral, função, admissão e salário.',
    example: 'Declaração para empréstimo bancário.',
    category: 'DECLARACOES',
    fields: [
      { key: 'funcionarioNome', label: 'Nome do funcionário', placeholder: 'Ex.: João Kaluana' },
      { key: 'funcionarioBi', label: 'BI (Bilhete de Identidade)', placeholder: 'Ex.: 000123456LA036' },
      { key: 'funcionarioNif', label: 'NIF', placeholder: 'Preenchido automaticamente com o BI, se vazio' },
      { key: 'cargo', label: 'Cargo', placeholder: 'Ex.: Técnico Contabilidade' },
      { key: 'departamento', label: 'Departamento', placeholder: 'Ex.: Contabilidade', optional: true },
      { key: 'dataAdmissao', label: 'Data de admissão', placeholder: 'DD/MM/AAAA', kind: 'date' },
      { key: 'dataTermino', label: 'Data de término', placeholder: 'DD/MM/AAAA (se aplicável)', kind: 'date', optional: true },
      { key: 'jornada', label: 'Jornada semanal', placeholder: 'Ex.: 40 horas' },
      { key: 'salario', label: 'Salário mensal bruto (Kz)', placeholder: 'Ex.: 150.000,00' },
      { key: 'finalidade', label: 'Finalidade', placeholder: 'Ex.: empréstimo bancário' },
      ...COMPANY,
      ...SIGNATORY,
    ],
  },
  {
    id: 'DECLARACAO_ACTIVIDADE',
    label: 'Declaração de actividade',
    description: 'Comprovar actividade económica regular.',
    example: 'Declaração para licença municipal.',
    category: 'DECLARACOES',
    fields: [
      { key: 'actividade', label: 'Actividade exercida', placeholder: 'Ex.: Comércio geral' },
      { key: 'dataInicio', label: 'Início da actividade', placeholder: 'DD/MM/AAAA', kind: 'date' },
      { key: 'finalidade', label: 'Finalidade', placeholder: 'Ex.: licença municipal' },
      ...COMPANY,
      ...SIGNATORY,
    ],
  },
  {
    id: 'DECLARACAO_IDONEIDADE',
    label: 'Declaração de idoneidade',
    description: 'Idoneidade moral e profissional.',
    example: 'Idoneidade para candidatura.',
    category: 'DECLARACOES',
    fields: [
      { key: 'pessoaNome', label: 'Nome da pessoa', placeholder: 'Ex.: Maria António' },
      { key: 'finalidade', label: 'Finalidade', placeholder: 'Ex.: candidatura' },
      ...COMPANY,
      ...SIGNATORY,
    ],
  },
  {
    id: 'CARTA_FORMAL',
    label: 'Carta formal',
    description: 'Carta comercial ou institucional.',
    example: 'Carta de apresentação de proposta.',
    category: 'CARTAS_FORMAIS',
    fields: [
      { key: 'destinatario', label: 'Destinatário', placeholder: 'Ex.: Exmo. Senhor Presidente do Conselho de Administração' },
      { key: 'assunto', label: 'Assunto', placeholder: 'Ex.: Apresentação da empresa' },
      { key: 'objectivo', label: 'Objectivo do pedido', placeholder: 'Ex.: solicitar reunião de apresentação', kind: 'textarea' },
      ...COMPANY,
      ...SIGNATORY,
    ],
  },
  {
    id: 'CARTA_RESPOSTA',
    label: 'Carta de resposta',
    description: 'Resposta formal a carta recebida.',
    example: 'Resposta à reclamação do cliente.',
    category: 'CARTAS_FORMAIS',
    fields: [
      { key: 'referencia', label: 'Referência da carta recebida', placeholder: 'Ex.: Carta n.º 45/2026' },
      { key: 'resposta', label: 'Resposta pretendida', placeholder: 'Ex.: aceite e pedido de desculpas', kind: 'textarea' },
      ...COMPANY,
      ...SIGNATORY,
    ],
  },
  {
    id: 'CARTA_RECLAMACAO',
    label: 'Reclamação',
    description: 'Reclamação formal de um serviço ou produto.',
    example: 'Reclamação de entrega atrasada.',
    category: 'CARTAS_FORMAIS',
    fields: [
      { key: 'empresaDestinataria', label: 'Destinatário', placeholder: 'Ex.: Logística KP, S.A.' },
      { key: 'objecto', label: 'Objecto da reclamação', placeholder: 'Ex.: serviço de transporte não prestado', kind: 'textarea' },
      { key: 'prazoExigido', label: 'Prazo pretendido para resposta', placeholder: 'Ex.: 5 dias úteis', optional: true },
      ...COMPANY,
      ...SIGNATORY,
    ],
  },
  {
    id: 'CONTRATO_TRABALHO',
    label: 'Contrato de trabalho',
    description: 'Contrato entre empresa e trabalhador.',
    example: 'Contrato a prazo de 12 meses.',
    category: 'CONTRATOS',
    fields: [
      { key: 'funcionarioNome', label: 'Nome do funcionário', placeholder: 'Ex.: João Kaluana' },
      { key: 'funcionarioBi', label: 'BI (Bilhete de Identidade)', placeholder: 'Ex.: 000123456LA036' },
      { key: 'funcionarioNif', label: 'NIF', placeholder: 'Preenchido automaticamente com o BI, se vazio' },
      { key: 'cargo', label: 'Cargo', placeholder: 'Ex.: Técnico Contabilidade' },
      { key: 'salario', label: 'Salário mensal bruto (Kz)', placeholder: 'Ex.: 150.000,00' },
      { key: 'dataInicio', label: 'Início', placeholder: 'DD/MM/AAAA', kind: 'date' },
      { key: 'dataTermino', label: 'Término (se a prazo)', placeholder: 'DD/MM/AAAA', kind: 'date', optional: true },
      { key: 'periodoProbatorio', label: 'Período experimental', placeholder: 'Ex.: 30 dias', optional: true },
      ...COMPANY,
      ...SIGNATORY,
    ],
  },
  {
    id: 'CONTRATO_PRESTACAO',
    label: 'Contrato de prestação de serviços',
    description: 'Contrato de serviços externos.',
    example: 'Contrato de manutenção.',
    category: 'CONTRATOS',
    fields: [
      { key: 'prestadorNome', label: 'Prestador do serviço', placeholder: 'Ex.: Manutenção KP, Lda' },
      { key: 'prestadorNif', label: 'NIF do prestador', placeholder: 'Ex.: 512345678' },
      { key: 'escopo', label: 'Escopo dos serviços', placeholder: 'Ex.: manutenção mensal dos equipamentos', kind: 'textarea' },
      { key: 'valor', label: 'Valor do contrato (Kz)', placeholder: 'Ex.: 250.000,00' },
      { key: 'prazo', label: 'Prazo de execução', placeholder: 'Ex.: 12 meses' },
      ...COMPANY,
      ...SIGNATORY,
    ],
  },
  {
    id: 'RELATORIO_TECNICO',
    label: 'Relatório técnico',
    description: 'Relatório de actividade ou auditoria.',
    example: 'Relatório de auditoria interna.',
    category: 'RELATORIOS',
    fields: [
      { key: 'tema', label: 'Tema do relatório', placeholder: 'Ex.: Auditoria interna Q3' },
      { key: 'objectivo', label: 'Objectivo', placeholder: 'Ex.: identificar não conformidades', kind: 'textarea' },
      { key: 'metodologia', label: 'Metodologia', placeholder: 'Ex.: entrevistas e análise documental', kind: 'textarea' },
      { key: 'periodo', label: 'Período analisado', placeholder: 'Ex.: Julho a Setembro de 2026' },
      ...COMPANY,
      ...SIGNATORY,
    ],
  },
  {
    id: 'RELATORIO_ADMINISTRATIVO',
    label: 'Relatório administrativo',
    description: 'Relatório de gestão.',
    example: 'Relatório de gestão semestral.',
    category: 'RELATORIOS',
    fields: [
      { key: 'tema', label: 'Tema do relatório', placeholder: 'Ex.: Gestão comercial 1.º semestre' },
      { key: 'escopo', label: 'Escopo', placeholder: 'Ex.: vendas e cobranças', kind: 'textarea' },
      { key: 'periodo', label: 'Período', placeholder: 'Ex.: Jan–Jun 2026' },
      ...COMPANY,
      ...SIGNATORY,
    ],
  },
  {
    id: 'PROPOSTA_COMERCIAL',
    label: 'Proposta comercial',
    description: 'Oferta de produtos ou serviços.',
    example: 'Proposta para fornecedor.',
    category: 'PROPOSTAS_COMERCIAIS',
    fields: [
      { key: 'cliente', label: 'Cliente', placeholder: 'Ex.: Hospital Central de Luanda' },
      { key: 'escopo', label: 'Escopo do que se propõe', placeholder: 'Ex.: fornecimento de 20 computadores', kind: 'textarea' },
      { key: 'valor', label: 'Valor total (Kz)', placeholder: 'Ex.: 12.500.000,00' },
      { key: 'prazo', label: 'Prazo de entrega', placeholder: 'Ex.: 60 dias' },
      ...COMPANY,
      ...SIGNATORY,
    ],
  },
  {
    id: 'MEMORANDO_INTERNO',
    label: 'Memorando interno',
    description: 'Comunicação interna oficial.',
    example: 'Memorando sobre nova política de férias.',
    category: 'MEMORANDOS',
    fields: [
      { key: 'destinatarios', label: 'Destinatários', placeholder: 'Ex.: Todos os funcionários' },
      { key: 'assunto', label: 'Assunto', placeholder: 'Ex.: Nova política de férias' },
      { key: 'conteudo', label: 'Conteúdo', placeholder: 'Ex.: comunicar as novas regras', kind: 'textarea' },
      ...COMPANY,
      ...SIGNATORY,
    ],
  },
  {
    id: 'ACTA_REUNIAO',
    label: 'Acta de reunião',
    description: 'Registo de deliberações.',
    example: 'Acta do conselho de administração.',
    category: 'ACTAS',
    fields: [
      { key: 'data', label: 'Data da reunião', placeholder: 'DD/MM/AAAA', kind: 'date' },
      { key: 'local', label: 'Local', placeholder: 'Ex.: Sala de reuniões A' },
      { key: 'participantes', label: 'Participantes', placeholder: 'Ex.: Joaquim, Ana, Pedro', kind: 'textarea' },
      { key: 'deliberacoes', label: 'Deliberações', placeholder: 'Ex.: aprovar o orçamento de 2027', kind: 'textarea' },
      ...COMPANY,
      ...SIGNATORY,
    ],
  },
  {
    id: 'COMUNICADO',
    label: 'Comunicado',
    description: 'Aviso para toda a equipa.',
    example: 'Comunicado sobre horário de trabalho.',
    category: 'COMUNICADOS',
    fields: [
      { key: 'assunto', label: 'Assunto', placeholder: 'Ex.: Alteração do horário de trabalho' },
      { key: 'conteudo', label: 'Conteúdo do comunicado', placeholder: 'Ex.: a partir de 01/01/2027', kind: 'textarea' },
      ...COMPANY,
      ...SIGNATORY,
    ],
  },
  {
    id: 'OFICIO',
    label: 'Ofício',
    description: 'Ofício a outro órgão ou empresa.',
    example: 'Ofício à Câmara Municipal.',
    category: 'OFICIOS_REQUERIMENTOS',
    fields: [
      { key: 'destinatarioOrgao', label: 'Destinatário', placeholder: 'Ex.: Exmo. Presidente da Câmara Municipal' },
      { key: 'assunto', label: 'Assunto', placeholder: 'Ex.: Pedido de licença de obras' },
      { key: 'pedido', label: 'O que se pede', placeholder: 'Ex.: emissão de licença de construção', kind: 'textarea' },
      ...COMPANY,
      ...SIGNATORY,
    ],
  },
  {
    id: 'ANUNCIO_VAGA',
    label: 'Anúncio de vaga',
    description: 'Recrutamento.',
    example: 'Anúncio para vaga de contabilista.',
    category: 'RECURSOS_HUMANOS',
    fields: [
      { key: 'cargo', label: 'Cargo a recrutar', placeholder: 'Ex.: Contabilista Sénior' },
      { key: 'departamento', label: 'Departamento', placeholder: 'Ex.: Contabilidade', optional: true },
      { key: 'requisitos', label: 'Requisitos', placeholder: 'Ex.: licenciatura, 3 anos experiência', kind: 'textarea' },
      { key: 'beneficios', label: 'Salário e benefícios', placeholder: 'Ex.: 250.000 Kz + subsídio de alimentação', kind: 'textarea', optional: true },
      ...COMPANY,
      ...SIGNATORY,
    ],
  },
  {
    id: 'OUTRO',
    label: 'Documento livre',
    description: 'Qualquer documento empresarial.',
    example: 'Qualquer documento empresarial.',
    category: 'OUTROS',
    fields: [
      { key: 'descricao', label: 'O que deve conter', placeholder: 'Ex.: declaração de idoneidade moral', kind: 'textarea' },
      ...COMPANY,
      ...SIGNATORY,
    ],
  },
];

export function documentTypeById(id: string): DocumentType | undefined {
  return DOCUMENT_TYPES.find((type) => type.id === id);
}

export function buildInstruction(type: DocumentType, values: Record<string, string>): string {
  const lines: string[] = [];
  const answer = (key: string) => (values[key] ?? '').trim();
  lines.push(`Redige o seguinte ${type.label.toLowerCase()}, estruturado em secções, linguagem formal e profissional.`);
  lines.push('Segue rigorosamente os factos fornecidos; não inventes nomes, NIF, datas ou valores.');
  lines.push('Se algum dado não foi fornecido, escreve [A PREENCHER: descrição] no lugar correspondente; nunca inventes.');
  lines.push('Usa Markdown simples: # títulos, ## subtítulos, listas com -, tabelas com |.');
  lines.push('Para cidadãos angolanos, o NIF pode coincidir com o BI. Se o NIF não for fornecido mas o BI for, usa o BI no campo NIF.');
  for (const field of type.fields) {
    const value = answer(field.key);
    if (value) lines.push(`${field.label}: ${value}`);
  }
  for (const field of [...COMPANY, ...SIGNATORY]) {
    const value = answer(field.key);
    if (value) lines.push(`${field.label}: ${value}`);
  }
  return lines.join('\n');
}

