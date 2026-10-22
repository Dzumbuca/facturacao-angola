// Limitador simples por IP em memória (por instância de função).
// Objectivo: travar força-bruta e abusos nas rotas de autenticação.
// Nota: em serverless cada instância tem o seu próprio contador — é uma
// primeira barreira, não um controlo global exacto.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export const rateLimit = (
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSeconds: number } => {
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) {
    for (const [existingKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(existingKey);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSeconds: 0 };
};

export const clientIp = (request: Request): string => {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') ?? 'desconhecido';
};

export const tooManyRequestsResponse = (
  retryAfterSeconds: number,
  message = 'Demasiadas tentativas. Aguarde um instante e tente novamente.',
): Response =>
  new Response(JSON.stringify({ success: false, error: message }), {
    status: 429,
    headers: { 'content-type': 'application/json', 'retry-after': String(retryAfterSeconds) },
  });
