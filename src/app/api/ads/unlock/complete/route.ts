import { NextResponse } from 'next/server';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';
import { completeAdWatch, AdUnlockError } from '@/lib/ad-unlock-service';

// Conclui a visualização: o servidor valida o tempo mínimo decorrido desde o
// begin (relógio do servidor) e marca o desbloqueio como disponível (GRANTED).
// Um desbloqueio autoriza exactamente UMA emissão — o consumo é atómico na
// transacção de emissão.
export async function POST() {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  try {
    const result = await completeAdWatch(access.access.tenantId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AdUnlockError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Erro ao concluir visualização de anúncio:', error);
    return NextResponse.json({ error: 'Não foi possível validar a visualização. Tente novamente.' }, { status: 500 });
  }
}
