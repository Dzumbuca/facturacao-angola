import type { FerramentaResumo } from '@/lib/business-tools';

// Catálogo do Centro de Ferramentas. Ferramentas ainda não implementadas
// ficam com href: null e estado 'em-breve' — nunca são apresentadas como
// funcionais. Partilhado pela página do centro e pelas ligações relacionadas.
export const FERRAMENTAS: FerramentaResumo[] = [
  // A. Fiscalidade
  { id: 'iva', nome: 'Calculadora de IVA', descricao: 'Acrescente ou retire o IVA de 14%, 7% ou 2% em kwanzas.', categoria: 'Fiscalidade', href: '/ferramentas/iva', estado: 'ativa', icone: 'percent' },
  { id: 'conversor-iva', nome: 'Conversor de IVA', descricao: 'Converta valores com IVA incluído ou excluído, em qualquer taxa legal.', categoria: 'Fiscalidade', href: '/ferramentas/conversor-iva', estado: 'ativa', icone: 'exchange' },
  { id: 'salario', nome: 'Salário líquido e IRT', descricao: 'Calcule o salário líquido com INSS e IRT por escalões.', categoria: 'Fiscalidade', href: '/ferramentas/salario', estado: 'ativa', icone: 'wallet' },
  { id: 'nif', nome: 'Validador de NIF', descricao: 'Confirme a estrutura do NIF de clientes e fornecedores.', categoria: 'Fiscalidade', href: '/ferramentas/nif', estado: 'ativa', icone: 'id-card' },
  // B. Gestão Financeira
  { id: 'lucro', nome: 'Lucro e margem', descricao: 'Descubra o lucro, a margem e o markup de cada produto vendido.', categoria: 'Gestão Financeira', href: '/ferramentas/lucro', estado: 'ativa', icone: 'trending-up' },
  { id: 'preco-venda', nome: 'Preço de venda', descricao: 'Defina o preço certo a partir dos custos e da margem pretendida.', categoria: 'Gestão Financeira', href: '/ferramentas/preco-venda', estado: 'ativa', icone: 'tag' },
  { id: 'descontos', nome: 'Calculadora de descontos', descricao: 'Aplique descontos em percentagem ou valor e veja o impacto.', categoria: 'Gestão Financeira', href: null, estado: 'em-breve', icone: 'discount' },
  { id: 'ponto-equilibrio', nome: 'Ponto de equilíbrio', descricao: 'Saiba quantas unidades precisa de vender para cobrir os custos.', categoria: 'Gestão Financeira', href: null, estado: 'em-breve', icone: 'scale' },
  // C. Documentos Empresariais
  { id: 'orcamento-pdf', nome: 'Gerador de orçamentos PDF', descricao: 'Crie orçamentos profissionais em PDF prontos a enviar.', categoria: 'Documentos Empresariais', href: null, estado: 'em-breve', icone: 'file-text' },
  { id: 'factura-proforma', nome: 'Factura proforma', descricao: 'Prepare facturas proforma em segundos.', categoria: 'Documentos Empresariais', href: null, estado: 'em-breve', icone: 'file-check' },
  { id: 'recibos', nome: 'Gerador de recibos', descricao: 'Emita recibos de pagamento com número e data.', categoria: 'Documentos Empresariais', href: null, estado: 'em-breve', icone: 'receipt' },
  { id: 'mapa-despesas', nome: 'Mapa de despesas', descricao: 'Organize e resuma as despesas do seu negócio.', categoria: 'Documentos Empresariais', href: null, estado: 'em-breve', icone: 'table' },
];
