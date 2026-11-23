// POST /api/invoices/{id}/credit-note
//
// Emissão HTTP autenticada de uma Nota de Crédito (NC) contra uma Factura/No de referência.
//
// Autenticação: requerer sessão autenticada; o tenantId é sempre derivado do contexto
// autenticado, nunca de parâmetros fornecidos pelo cliente. As verificações de
// autorização (`getTenantWriteAccess`) seguem o padrão das restantes rotas financeiras.
//
// Payload:
//   { "reason": "string" }  — justificação/motivo da NC (obrigatório)
//
// Cabeçalho:
//   Idempotency-Key: <chave opcional> — evita duplicação silenciosa para pedidos repetidos
//
// Resposta: igual ao FT, application/pdf com Content-Disposition attachment.
//
// Códigos:
//   200 — NC emitida
//   400 — reason ausente / inválido
//   401 — não autenticado
//   404 — factura não encontrada / de outro tenant
//   409 — factura já anulada por outra NC ou idempotência com payload diferente
//  500 — erro interno
//  503 — capacidade partilhada FT+NC esgotada (EMISSION_BUSY)

import { NextRequest, NextResponse } from 'next/server';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';
import { issueCreditNote } from '@/lib/invoice-service';
import { generateInvoicePDF } from '@/lib/pdf-generator';

type Context = { params: Promise<{ id: string }> };

const MAX_REASON = 2_000;

export async function POST(request: NextRequest, { params }: Context) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId, userId: _userId } = access.access as any;

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  }

  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (!reason || reason.length > MAX_REASON) {
    return NextResponse.json({ error: 'Indique uma justificação (reason) para a Nota de Crédito.' }, { status: 400 });
  }

  const invoiceId = (await params).id;
  if (typeof invoiceId !== 'string' || invoiceId.length > 128) {
    return NextResponse.json({ error: 'Identificador de factura inválido.' }, { status: 400 });
  }

  const idempotencyKey = request.headers.get('Idempotency-Key')?.trim() || undefined;

  try {
    const nc = await issueCreditNote({ invoiceId, reason, tenantId, idempotencyKey });
    // Direct reuse of the same PDF generator used by FTs. The result returned by
    // issueCreditNote carries the persisted NC; render it.
    const pdf = await generateInvoicePDF(nc as any);
    return new NextResponse(pdf as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${String((nc as any)?.number ?? 'NC').replace(/[^A-Za-z0-9._-]/g, '_')}.pdf"`,
      },
    });
  } catch (error: any) {
    const msg = String(error?.message ?? error ?? '');
    const code = String(error?.code ?? '');
    if (msg.includes('Fatura de referência não encontrada') || msg.includes('Fatura de referência n')) {
      return NextResponse.json({ error: 'Factura não encontrada.' }, { status: 404 });
    }
    if (msg.includes('já foi anulada')) {
      return NextResponse.json({ error: 'Esta factura já foi anulada por outra Nota de Crédito.', reason: 'INVOICE_ALREADY_CANCELLED' }, { status: 409 });
    }
    if (code === 'IDEMPOTENCY_CONFLICT' || msg.includes('IdempotencyConflict')) {
      return NextResponse.json({ error: 'Pedido duplicado com payload diferente.', reason: 'IDEMPOTENCY_CONFLICT' }, { status: 409 });
    }
    if (msg.includes('EMISSION_BUSY')) {
      // Capacity shared with FT+NC exhausted.
      return NextResponse.json({ error: 'Demasiadas emissões concorrentes. Retente mais tarde.', reason: 'EMISSION_BUSY' }, { status: 503 });
    }
    console.error('Erro ao emitir NC:', error);
    return NextResponse.json({ error: 'Não foi possível emitir a Nota de Crédito.' }, { status: 500 });
  }
}
