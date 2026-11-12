import { NextResponse } from 'next/server';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhStorageConfigured, ensureBucket, uploadToRhBucket } from '@/lib/rh-storage';

const MIME_OK = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024;

/** Upload real de ficheiros para o Supabase Storage (bucket RH). */
export async function POST(req: Request) {
  try {
    const access = await requireRhAccess('employees:write');
    if (!rhStorageConfigured()) {
      return NextResponse.json({ code: 'STORAGE_NOT_CONFIGURED', error: 'Storage não configurado. Defina NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_STORAGE_BUCKET_RH. Ver docs/ops/SUPABASE-STORAGE-SETUP.md.' }, { status: 503 });
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Envie o ficheiro no campo "file".' }, { status: 400 });
    if (!MIME_OK.has(file.type)) return NextResponse.json({ error: 'Tipo não permitido. Use PDF, PNG, JPEG ou WebP.' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Máximo 10 MB.' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const safeName = `${crypto.randomUUID()}.${ext}`;
    const path = `${access.tenantId}/${safeName}`;

    const bucket = await ensureBucket();
    if (!bucket.ok) return NextResponse.json({ code: 'BUCKET_ERROR', detail: bucket.error }, { status: 502 });

    const uploaded = await uploadToRhBucket({ tenantId: access.tenantId, path, buffer, contentType: file.type });
    if ('error' in uploaded) return NextResponse.json({ code: 'UPLOAD_ERROR', detail: uploaded.error }, { status: 502 });
    return NextResponse.json({ path: uploaded.path }, { status: 201 });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}