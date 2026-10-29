import { NextResponse } from 'next/server';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';
import { beginAdWatch, AdUnlockError } from '@/lib/ad-unlock-service';

// Inicia (ou retoma) a sessão de visualização do anúncio de desbloqueio.
// O timestamp autoritativo é o do servidor — o cliente não pode manipular a contagem.
export async function POST() {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  try {
    const result = await beginAdWatch(access.access.tenantId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AdUnlockError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Erro ao iniciar visualização de anúncio:', error);
    return NextResponse.json({ error: 'Não foi possível iniciar o desbloqueio. Tente novamente.' }, { status: 500 });
  }
}
