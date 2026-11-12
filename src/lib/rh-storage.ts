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

/** Cria/verifica o bucket via API REST do Supabase Storage. */
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
    body: JSON.stringify({ name: config.bucket, public: true, file_size_limit: 10_485_760, allowed_mime_types: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'] }),
  });
  if (response.ok) return { ok: true };
  // 409: bucket já existe.
  if (response.status === 409) return { ok: true };
  const text = await response.text().catch(() => '');
  return { ok: false, error: `BUCKET_${response.status}:${text.slice(0, 300)}` };
}

export async function uploadToRhBucket(input: { tenantId: string; path: string; buffer: Buffer; contentType: string }): Promise<{ url: string; path: string } | { error: string }> {
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
  // Bucket público (padrão): URL pública; caso contrário, devolve path e usa signed URL.
  const publicUrl = `${config.supabaseUrl}/storage/v1/object/public/${config.bucket}/${input.path}`;
  return { url: publicUrl, path: input.path };
}
