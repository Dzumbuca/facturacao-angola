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
    '- Explica sempre em passos concretos (1., 2., 3.) quando o utilizador pede «como fazer».',
    '- Quando existir uma página no sistema relacionada, devolve no campo "actions" um botão com { label, href }.',
    '- Nunca peças nem reveles dados de outras empresas. Nunca revelas chaves, palavras-passe ou segredos.',
    '- Não executas operações financeiras, não alteras dados e não emites documentos fiscais. Podes explicar como, e levar o utilizador até à página certa.',
    '- Se a pergunta não for sobre o Machine Facturas ou gestão empresarial, responde educadamente que só ajudas no âmbito do sistema.',
    '- Se não conheceres a resposta, di-lo abertamente e sugere o suporte da empresa.',
    '- Usa formatação simples: texto normal e listas numeradas. Nunca inventes números fiscais ou percentagens.',
    '',
    'Formato de saída: responde APENAS com JSON válido, sem comentários e sem markdown envolvente, com a forma:',
    '{"reply":"texto completo para o utilizador","actions":[{"label":"Abrir Facturas","href":"/invoices"}],"document":{"title":"Título","body":"conteúdo em Markdown"}}',
    'O campo "document" só deve existir quando o utilizador pedir para criar um documento; caso contrário deve ser null.',
    'O campo "actions" deve existir sempre, mesmo que vazio.',
  ].join('\n');
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
    const offline = offlineAnswer(lastUser.content, path) ?? adminSafeFallback(lastUser.content);
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
