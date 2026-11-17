import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { PeriodActions } from './period-actions-client';

export default async function PeriodosPage() {
  const tenantId = await getSessionTenantId(await auth());
  if (!tenantId) redirect('/onboarding');

  const year = new Date().getUTCFullYear();

  // Auto-create current exercise + periods if missing (idempotent)
  const exercise = await prisma.accountingExercise.upsert({
    where: { tenantId_year: { tenantId, year } },
    create: { tenantId, year, startDate: new Date(Date.UTC(year, 0, 1)), endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59)), state: 'OPEN', openedAt: new Date() },
    update: {},
  });

  // Ensure all 12 periods exist
  for (let m = 0; m < 12; m++) {
    const code = `${year}-${String(m + 1).padStart(2, '0')}`;
    const exists = await prisma.accountingPeriod.findFirst({ where: { tenantId, exerciseId: exercise.id, code } });
    if (!exists) {
      await prisma.accountingPeriod.create({
        data: {
          tenantId,
          exerciseId: exercise.id,
          code,
          startDate: new Date(Date.UTC(year, m, 1)),
          endDate: new Date(Date.UTC(year, m + 1, 0, 23, 59, 59)),
          state: 'OPEN',
          openedAt: new Date(),
        },
      });
    }
  }

  const periods = await prisma.accountingPeriod.findMany({
    where: { tenantId, exerciseId: exercise.id },
    orderBy: { code: 'asc' },
  });

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#708195]">Contabilidade</p>
          <h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Exercícios e períodos</h2>
          <p className="mt-2 text-sm text-[#708195]">Abertura e fecho dos períodos contabilísticos. Períodos fechados não aceitam lançamentos sem reabertura explícita.</p>
        </div>
        <Link href="/contabilidade" className="rounded-xl border border-[#e2e9f1] bg-white px-4 py-2 text-xs font-semibold text-[#2878d0] hover:bg-[#f4f8ff]">← Voltar ao Diário</Link>
      </div>

      <section className="rounded-2xl border border-[#e2e9f1] bg-white p-4">
        <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Exercício {exercise.year}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-4">
          <strong className="text-2xl font-extrabold text-[#1c2d3f]">{exercise.startDate.toISOString().slice(0, 10)} → {exercise.endDate.toISOString().slice(0, 10)}</strong>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${exercise.state === 'OPEN' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-red-300 bg-red-50 text-red-700'}`}>{exercise.state}</span>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#e2e9f1] bg-white">
        <div className="border-b border-[#e7edf3] px-5 py-4">
          <h3 className="font-bold text-[#1c2d3f]">Períodos de {exercise.year}</h3>
        </div>
        <ul className="divide-y divide-[#edf1f5]">
          {periods.map((period: any) => (
            <li key={period.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="tabular-nums text-sm font-bold text-[#1c2d3f]">{period.code}</p>
                <p className="text-xs text-[#708195]">{period.startDate.toISOString().slice(0, 10)} → {period.endDate.toISOString().slice(0, 10)}</p>
                <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${period.state === 'OPEN' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-red-300 bg-red-50 text-red-700'}`}>{period.state}</span>
              </div>
              <PeriodActions periodId={period.id} state={period.state as 'OPEN' | 'CLOSED'} code={period.code} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
