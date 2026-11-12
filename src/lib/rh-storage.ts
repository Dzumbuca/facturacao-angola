import 'server-only';

type StorageConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  bucket: string;
};

function readConfig(): StorageConfig | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_RH?.trim() ?? 'rh-uploads';
  if (!supabaseUrl || !serviceRoleKey) return null;
  return { supabaseUrl, serviceRoleKey, bucket };
}

export function rhStorageConfigured(): boolean {
  return readConfig() !== null;
}

/** Cria/verifica o bucket (PRIVADO) via API REST do Supabase Storage. */
export async function ensureBucket(): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = readConfig();
  if (!config) return { ok: false, error: 'STORAGE_NOT_CONFIGURED' };

  const url = `${config.supabaseUrl}/storage/v1/bucket/${config.bucket}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      'Content-Type': 'application/json',
      apikey: config.serviceRoleKey,
    },
    body: JSON.stringify({ name: config.bucket, public: false, file_size_limit: 10_485_760, allowed_mime_types: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'] }),
  });
  if (response.ok) return { ok: true };
  // 409: bucket já existe.
  if (response.status === 409) return { ok: true };
  const text = await response.text().catch(() => '');
  return { ok: false, error: `BUCKET_${response.status}:${text.slice(0, 300)}` };
}

export async function uploadToRhBucket(input: { tenantId: string; path: string; buffer: Buffer; contentType: string }): Promise<{ path: string } | { error: string }> {
  const config = readConfig();
  if (!config) return { error: 'STORAGE_NOT_CONFIGURED' };

  const url = `${config.supabaseUrl}/storage/v1/object/${config.bucket}/${input.path}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.serviceRoleKey,
      'Content-Type': input.contentType,
      'x-upsert': 'true',
    },
    body: new Uint8Array(input.buffer),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return { error: `UPLOAD_${response.status}:${text.slice(0, 300)}` };
  }
  return { path: input.path };
}


const PUBLIC_PATH_PREFIX = (supabaseUrl: string, bucket: string) => `${supabaseUrl}/storage/v1/object/public/${bucket}/`;

/** Normaliza qualquer formato (URL pública legada ou path) para path interno. */
export function toStoredPath(stored: string | null | undefined, supabaseUrl: string, bucket: string): string | null {
  if (!stored) return null;
  const prefix = PUBLIC_PATH_PREFIX(supabaseUrl, bucket);
  if (stored.startsWith(prefix)) return stored.slice(prefix.length);
  if (stored.startsWith('http://') || stored.startsWith('https://')) return null;
  return stored.replace(/^\/+/, '');
}

/** Gera um signed URL de leitura (1h) para um path no bucket. */
export async function signReadUrl(path: string, ttlSeconds = 3600): Promise<string | null> {
  const config = readConfig();
  if (!config) return null;
  const normalized = toStoredPath(path, config.supabaseUrl, config.bucket);
  if (!normalized) return null;

  const url = `${config.supabaseUrl}/storage/v1/object/sign/${config.bucket}/${normalized}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: ttlSeconds }),
  });
  if (!response.ok) return null;
  const data = (await response.json().catch(() => ({}))) as { signedURL?: string };
  if (!data?.signedURL) return null;
  const suffix = data.signedURL.startsWith('/storage/v1') ? data.signedURL : `/storage/v1${data.signedURL.startsWith('/') ? '' : '/'}${data.signedURL}`;
  return `${config.supabaseUrl}${suffix}`;
}

export type StoredObject = { path: string };
