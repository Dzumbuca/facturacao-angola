import 'server-only';
import { contextBriefForPath, offlineAnswer, platformKnowledgeBrief } from './assistant-knowledge';
export { offlineAnswer, moduleForPath, suggestionsForPath, contextBriefForPath, ASSISTANT_NAME, ASSISTANT_TAGLINE } from './assistant-knowledge';

/**
 * Machine IA — assistente global da plataforma.
 * Reutiliza o mesmo provedor que o Machine RH (GROQ/OpenRouter), sem criar
 * integrações paralelas. Quando o provedor não está configurado (ou falha),
 * cai automaticamente para a base determinística de conhecimento da plataforma:
 * o utilizador recebe sempre uma resposta útil e honesta, sem invenções.
 */

type Provider = { name: 'groq' | 'openrouter'; baseUrl: string; model: string; apiKey: string };
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function providers(): Provider[] {
  const list: Provider[] = [];
  if (process.env.GROQ_API_KEY) {
    list.push({ name: 'groq', baseUrl: process.env.MACHINE_AI_BASE_URL || process.env.RH_AI_BASE_URL || GROQ_URL, model: process.env.MACHINE_AI_MODEL || process.env.RH_AI_MODEL || 'openai/gpt-oss-120b', apiKey: process.env.GROQ_API_KEY });
  }
  if (process.env.OPENROUTER_API_KEY) {
    list.push({ name: 'openrouter', baseUrl: process.env.MACHINE_AI_BASE_URL || process.env.RH_AI_BASE_URL || OPENROUTER_URL, model: process.env.MACHINE_AI_MODEL || process.env.RH_AI_MODEL || 'meta-llama/llama-3.3-70b-instruct:free', apiKey: process.env.OPENROUTER_API_KEY });
  }
  return list;
}

export function assistantConfigured(): boolean {
  return providers().length > 0;
}
export function assistantProviderName(): 'groq' | 'openrouter' | null {
  return providers()[0]?.name ?? null;
}

const buckets = new Map<string, { count: number; resetAt: number }>();
export function assistantRateLimited(key: string, limit = 15, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (bucket.count >= limit) return true;
  bucket.count += 1;
  return false;
}

export type AssistantInputMessage = { role: 'user' | 'assistant'; content: string };
export type AssistantAction = { label: string; href: string };
export type AssistantDocument = { title: string; body: string };
export type AssistantReply = {
  text: string;
  actions: AssistantAction[];
  document: AssistantDocument | null;
  offline: boolean;
  provider: string | null;
};

const DOC_HINTS = ['carta', 'relatório', 'relatorio', 'proposta', 'contrato', 'memorando', 'documento', 'comunicado', 'ofício', 'oficio'];
const DOC_VERBS = ['cria', 'criar', 'crie', 'elabora', 'elaborar', 'elabore', 'prepara', 'preparar', 'prepare', 'faz', 'fazer', 'faz-me', 'escreve', 'escreva', 'escreva-me', 'redige', 'gere', 'gerar', 'gero', 'quero', 'preciso', 'gostaria', 'precisava', 'pode fazer', 'podes fazer'];
export function detectDocumentIntent(query: string): boolean {
  const q = query.toLowerCase();
  return DOC_VERBS.some((v) => q.includes(v)) && DOC_HINTS.some((d) => q.includes(d));
}

function sanitizeMessages(messages: unknown): AssistantInputMessage[] {
  if (!Array.isArray(messages)) return [];
  const clean: AssistantInputMessage[] = [];
  for (const raw of messages) {
    const role = raw?.role === 'assistant' ? 'assistant' : raw?.role === 'user' ? 'user' : null;
    const content = typeof raw?.content === 'string' ? raw.content.trim() : '';
    if (!role || !content) continue;
    if (content.length > 1500) continue;
    clean.push({ role, content });
  }
  return clean.slice(-12);
}

export function adminSafeFallback(query: string): { answer: string; href?: string } {
  const online = offlineAnswer(query, '/');
  if (online) return { answer: online.answer, href: online.href };
  return { answer: 'Posso ajudar com navegação e procedimentos do Machine Facturas. Pergunte, por exemplo: «Como emitir uma factura?» ou «Como cadastrar um funcionário?».' };
}

export function buildSystemPrompt(path: string): string {
  return [
    'És o Machine IA, o assistente empresarial do Machine Facturas para Angola.',
    'Respondes em português de Angola, tom simples, profissional e directo.',
    'Conheces APENAS as funcionalidades realmente implementadas no Machine Facturas; não inventes menus, módulos ou opções.',
    '',
    'MÓDULOS DA PLATAFORMA:',
    platformKnowledgeBrief(),
    '',
    contextBriefForPath(path),
    '',
    'REGRAS DE RESPOSTA:',
    '- Explica sempre em passos concretos (1., 2., 3.) quando o utilizador pede como fazer.',
    '- Quando existir uma página no sistema relacionada, devolve no campo actions um botão com label e href.',
    '- Nunca peças dados desnecessários. Só pede o que falta para a tarefa concreta.',
    '- Não executas operações financeiras, não alteras dados e não emites documentos fiscais.',
    '- Nunca revelas chaves, palavras-passe ou segredos. Nunca expões dados de outras empresas.',
    '- Se não conheceres a resposta, di-lo claramente e sugere o suporte da empresa.',
    '- Usa formatação simples: texto normal e listas numeradas.',
    '',
    'REGRAS PARA DOCUMENTOS (obrigatório):',
    '- NUNCA devolvas um documento inteiro com apenas traços «________» se o utilizador te forneceu dados. Preenche TUDO.',
    '- Se faltarem factos essenciais (nomes, cargos, datas, valores, NIF, moradas, salários), NÃO devolvas documento. Faz UMA mensagem curta com a lista do que falta e termina com «Responde com esses dados que eu genero já o documento».',
    '- Estrutura real por tipo: declaração de trabalho = cabeçalho institucional, identificação, corpo numerado (nome, NIF, cargo, datas, jornada, remuneração), fecho, assinatura + carimbo. Carta comercial = destinatário, exposição, proposta, conclusão, assinatura. Proposta = escopo, metodologia, valores, prazos, assinatura.',
    '- Documentos completos e accionáveis: usa titulos markdown (#), secções, listas numeradas, tabelas com «|» e bloco de assinatura no fim.',
    '- Usa campos [A PREENCHER: x] apenas para dados que o utilizador NÃO forneceu. Nunca inventes nomes, NIFs, datas ou valores.',
    '- O conteúdo do documento fica em Markdown simples (títulos com #, listas com -, tabelas com |).',
    '',
    'Formato de saída: responde APENAS com JSON válido, sem comentários nem markdown, com a forma:',
    '{"reply":"texto completo","actions":[{"label":"Abrir Facturas","href":"/invoices"}],"document":{"title":"Título","body":"conteúdo em Markdown"}}',
    'Se falta informação para o documento: document = null e reply = pedido curto dos dados em falta.',
    'O campo actions deve existir sempre, mesmo que vazio.',
  ].join('\n');
}

function inferDocumentType(query: string): { title: string; href: string } {
  const q = query.toLowerCase();
  if (/declara[cç][aã]o/.test(q)) return { title: 'Declaração de Trabalho', href: '/rh/documentos' };
  if (/carta/.test(q)) return { title: 'Carta', href: '/documentos' };
  if (/proposta/.test(q)) return { title: 'Proposta Comercial', href: '/documentos' };
  if (/contrato/.test(q)) return { title: 'Contrato', href: '/rh/contratos' };
  if (/memorando|comunicado|oficio/.test(q)) return { title: 'Memorando', href: '/documentos' };
  return { title: 'Documento', href: '/documentos' };
}

function offlineDocumentTemplate(query: string): { href: string; document: AssistantDocument } {
  const type = inferDocumentType(query);
  const body = [
    '# ' + type.title,
    '',
    'Exmo. Senhor,',
    '',
    'Vimos por este meio apresentar o documento abaixo, para os devidos fins.',
    '',
    '## Identificação',
    '',
    'Eu, [A PREENCHER: nome completo], bilhete de identidade n.º [A PREENCHER: BI], na qualidade de [A PREENCHER: cargo/função] da empresa [A PREENCHER: empresa], com sede em [A PREENCHER: morada], declaro que:',
    '',
    '1. **Nome do Trabalhador:** [A PREENCHER: nome];',
    '2. **NIF:** [A PREENCHER: NIF];',
    '3. **Cargo/Função:** [A PREENCHER: cargo];',
    '4. **Data de Admissão:** [A PREENCHER: data];',
    '5. **Jornada de trabalho:** [A PREENCHER: horas] horas por semana.',
    '',
    '## Declaração',
    '',
    'A presente declaração é emitida a pedido do interessado, para os devidos fins, estando a empresa à disposição para os esclarecimentos que se justifiquem.',
    '',
    '## Fecho',
    '',
    '________________________________  ',
    'Assinatura do Responsável  ',
    'Nome: ________________________________  ',
    'Cargo: ________________________________  ',
    'Data: ________________________________',
  ].join('\n');
  return { href: type.href, document: { title: type.title, body } };
}

type ModelReply = { reply?: unknown; actions?: unknown; document?: unknown };

export function parseModelReply(raw: string): { text: string; actions: AssistantAction[]; document: AssistantDocument | null } {
  const text = raw.trim();
  // Remover cercas de código acidentais
  const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  let parsed: ModelReply | null = null;
  try {
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    if (start >= 0 && end > start) parsed = JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed.reply !== 'string') {
    // O modelo desobedeceu ao formato: devolve o texto como resposta simples.
    const actions: AssistantAction[] = [];
    const hrefMatch = text.match(/\/[a-z0-9\-\/]+/gi);
    if (hrefMatch) {
      const known = new Set(['/invoices', '/customers', '/produtos', '/warehouses', '/stock', '/reports', '/empresa', '/rh/funcionarios', '/rh/documentos', '/rh/processamento-salarial', '/ferramentas']);
      for (const href of hrefMatch) {
        if (known.has(href.toLowerCase()) && actions.length < 2 && !actions.some((a) => a.href === href.toLowerCase())) {
          actions.push({ label: 'Abrir', href: href.toLowerCase() });
        }
      }
    }
    return { text, actions, document: null };
  }
  const reply = parsed.reply.trim();
  const actions: AssistantAction[] = [];
  if (Array.isArray(parsed.actions)) {
    for (const a of parsed.actions.slice(0, 4)) {
      const label = typeof a?.label === 'string' ? a.label.trim().slice(0, 80) : '';
      const href = typeof a?.href === 'string' ? a.href.trim() : '';
      if (label && href.startsWith('/') && href.length < 120) actions.push({ label, href });
    }
  }
  let document: AssistantDocument | null = null;
  const d = parsed.document as any;
  if (d && typeof d === 'object' && typeof d.title === 'string' && typeof d.body === 'string') {
    document = { title: d.title.trim().slice(0, 160), body: d.body.trim().slice(0, 20000) };
  }
  return { text: reply, actions, document };
}

export async function chatAssistant(input: { path: string; messages: unknown }): Promise<AssistantReply> {
  const path = typeof input.path === 'string' ? input.path.slice(0, 200) : '/';
  const messages = sanitizeMessages(input.messages);
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) {
    return { text: 'Olá! Sou o Machine IA. Posso ajudar com navegação, procedimentos e documentos. O que precisa?', actions: [], document: null, offline: true, provider: null };
  }
  const available = providers();
  if (available.length === 0) {
    const wantsDoc = detectDocumentIntent(lastUser.content);
    const offline = offlineAnswer(lastUser.content, path) ?? adminSafeFallback(lastUser.content);
    if (wantsDoc) {
      const template = offlineDocumentTemplate(lastUser.content);
      return {
        text: offline.answer + '\n\nNo modo offline, não gero documentos completos por omissão. Abaixo está a estrutura do documento com campos para preencheres manualmente; para dados reais, configura a IA (GROQ_API_KEY) e faze o pedido novamente com os dados.',
        actions: template.href ? [{ label: 'Abrir documentos', href: template.href }] : [],
        document: template.document,
        offline: true,
        provider: null,
      };
    }
    return { text: offline.answer, actions: offline.href ? [{ label: 'Abrir', href: offline.href }] : [], document: null, offline: true, provider: null };
  }
  const system = buildSystemPrompt(path);
  for (const provider of available) {
    try {
      const controller = new AbortController();
      const wantsDocument = detectDocumentIntent(lastUser.content);
      const timeout = setTimeout(() => controller.abort(), 25_000);
      const response = await fetch(provider.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
          ...(provider.name === 'openrouter' ? { 'HTTP-Referer': 'https://machinefaturas.shop', 'X-Title': 'Machine IA' } : {}),
        },
        body: JSON.stringify({
          model: provider.model,
          temperature: 0.3,
          max_tokens: wantsDocument ? 1600 : 900,
          messages: [{ role: 'system', content: system }, ...messages],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) continue;
      const data = await response.json();
      const raw = data?.choices?.[0]?.message?.content;
      if (typeof raw !== 'string' || !raw.trim()) continue;
      const parsed = parseModelReply(raw);
      return { ...parsed, offline: false, provider: provider.name };
    } catch {
      continue;
    }
  }
  const offline = offlineAnswer(lastUser.content, path) ?? adminSafeFallback(lastUser.content);
  return { text: offline.answer, actions: offline.href ? [{ label: 'Abrir', href: offline.href }] : [], document: null, offline: true, provider: null };
}
