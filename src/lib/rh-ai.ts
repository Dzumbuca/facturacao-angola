import 'server-only';

type Provider = {
  name: 'groq' | 'openrouter';
  baseUrl: string;
  model: string;
  apiKey: string;
};

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function providers(): Provider[] {
  const list: Provider[] = [];
  if (process.env.GROQ_API_KEY) {
    list.push({
      name: 'groq',
      baseUrl: process.env.RH_AI_BASE_URL || GROQ_URL,
      model: process.env.RH_AI_MODEL || 'openai/gpt-oss-120b',
      apiKey: process.env.GROQ_API_KEY,
    });
  }
  if (process.env.OPENROUTER_API_KEY) {
    list.push({
      name: 'openrouter',
      baseUrl: process.env.RH_AI_BASE_URL || OPENROUTER_URL,
      model: process.env.RH_AI_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }
  return list;
}

export function aiConfigured(): boolean {
  return providers().length > 0;
}

export function aiProviderName(): string | null {
  return providers()[0]?.name ?? null;
}

// Limite simples por processo para proteger a quota gratuita.
const buckets = new Map<string, { count: number; resetAt: number }>();
export function aiRateLimited(key: string, limit = 10, windowMs = 60_000): boolean {
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

export function buildHrPrompt(input: { instruction: string; context?: string; type?: string }): { system: string; user: string } {
  return {
    system: [
      'És um assistente de Recursos Humanos em Angola.',
      'Escreves em português de Angola, com tom formal e claro.',
      'Usa apenas os factos fornecidos no contexto; não inventes nomes, valores, datas, leis, taxas ou números.',
      'Quando faltar informação, escreve um marcador como [A PREENCHER] em vez de inventar.',
      'Devolve apenas o texto final do documento, sem comentários sobre o pedido.',
    ].join(' '),
    user: [
      input.type ? `Tipo de documento: ${input.type}` : '',
      input.context ? `Contexto factual:\n${input.context}` : '',
      `Pedido:\n${input.instruction}`,
    ].filter(Boolean).join('\n\n'),
  };
}

export async function draftHrText(input: { instruction: string; context?: string; type?: string }): Promise<{ text: string; provider: string }> {
  const available = providers();
  if (available.length === 0) {
    const error = new Error('AI_NOT_CONFIGURED');
    (error as any).code = 'AI_NOT_CONFIGURED';
    throw error;
  }
  const { system, user } = buildHrPrompt(input);
  let lastError: unknown = null;

  for (const provider of available) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);
      const response = await fetch(provider.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
          ...(provider.name === 'openrouter' ? { 'HTTP-Referer': 'https://machinefacturas.app', 'X-Title': 'Machine RH' } : {}),
        },
        body: JSON.stringify({
          model: provider.model,
          temperature: 0.3,
          max_tokens: 900,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) {
        lastError = new Error(`AI_HTTP_${response.status}`);
        continue;
      }
      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) {
        lastError = new Error('AI_EMPTY_RESPONSE');
        continue;
      }
      return { text: text.trim(), provider: provider.name };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('AI_FAILED');
}
