import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const PRICES: Record<string, number> = { BASICO: 9900, PRO: 19900 };
const ALLOWED_MONTHS = [1, 3, 6, 12];
const MAX_PROOF_BYTES = 3 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

// Envia comprovativo de pagamento do plano (Multicaixa Express) para revisão admin
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const sessionUser = session?.user as any;
    const tenantId = typeof sessionUser?.tenantId === 'string' ? sessionUser.tenantId : null;
    const userId = typeof sessionUser?.id === 'string' ? sessionUser.id : null;
    if (!tenantId || !userId) return NextResponse.json({ error: 'Sessão inválida ou empresa não configurada.' }, { status: 401 });

    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });

    const plan = String(form.get('plan') ?? '');
    if (!['BASICO', 'PRO'].includes(plan)) return NextResponse.json({ error: 'Escolhe o plano (Básico ou Pro).' }, { status: 400 });
    const months = Number(form.get('months'));
    if (!ALLOWED_MONTHS.includes(months)) return NextResponse.json({ error: 'Escolhe a duração (1, 3, 6 ou 12 meses).' }, { status: 400 });

    const payerName = String(form.get('payerName') ?? '').trim().slice(0, 120);
    const payerPhone = String(form.get('payerPhone') ?? '').trim().slice(0, 24);
    if (payerName.length < 2 || payerPhone.length < 9) {
      return NextResponse.json({ error: 'Preenche o teu nome e o número do telefone que fez o pagamento.' }, { status: 400 });
    }

    const proof = form.get('proof') as File | null;
    if (!proof || typeof proof === 'string') return NextResponse.json({ error: 'Anexa o comprovativo (imagem ou PDF).' }, { status: 400 });
    if (proof.size > MAX_PROOF_BYTES) return NextResponse.json({ error: 'O comprovativo deve ter no máximo 3 MB.' }, { status: 400 });
    if (!ALLOWED_PROOF_TYPES.includes(proof.type)) {
      return NextResponse.json({ error: 'O comprovativo deve ser uma imagem (JPG, PNG, WebP) ou PDF.' }, { status: 400 });
    }

    const amountKz = PRICES[plan] * months;
    const buffer = Buffer.from(await proof.arrayBuffer());
    const proofData = `data:${proof.type};base64,${buffer.toString('base64')}`;

    const payment = await prisma.planPayment.create({
      data: { tenantId, payerName, payerPhone, amountKz, months, proofName: proof.name.slice(0, 160), proofData, status: 'PENDENTE' },
      select: { id: true, status: true, createdAt: true },
    });

    return NextResponse.json({ success: true, payment });
  } catch (error) {
    return NextResponse.json({ error: 'Não foi possível enviar o comprovativo. Tente novamente.' }, { status: 500 });
  }
}

// Lista os envios desta empresa
export async function GET() {
  try {
    const session = await auth();
    const sessionUser = session?.user as any;
    const tenantId = typeof sessionUser?.tenantId === 'string' ? sessionUser.tenantId : null;
    if (!tenantId) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
    const payments = await prisma.planPayment.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, amountKz: true, months: true, status: true, adminNote: true, createdAt: true },
    });
    return NextResponse.json({ payments });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao carregar os pagamentos.' }, { status: 500 });
  }
}
