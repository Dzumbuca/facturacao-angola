import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { preValidateExercise } from '@/lib/gl-exercise-precheck';
import { CloseExerciseButton } from './close-exercise-button';

export default async function ExerciciosPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) redirect('/onboarding');

  const sp = await searchParams;
  const yearFromParam = sp.year ? Number(sp.year) : new Date().getUTCFullYear();

  const exercise = await prisma.accountingExercise.upsert({
    where: { tenantId_year: { tenantId, year: yearFromParam } },
    create: { tenantId, year: yearFromParam, startDate: new Date(Date.UTC(yearFromParam, 0, 1)), endDate: new Date(Date.UTC(yearFromParam, 11, 31, 23, 59, 59)), state: 'OPEN', openedAt: new Date() },
    update: {},
    select: { id: true, year: true, state: true, openedAt: true, closedAt: true, closedBy: true },
  });

  const blockers = await preValidateExercise(tenantId, exercise.year);
  const blockerCount = blockers.filter((b: any) => b.severity === 'BLOCKER').length;
  const warningCount = blockers.filter((b: any) => b.severity === 'WARNING').length;
  const totalEntries = await prisma.journalEntry.count({ where: { tenantId, postedOnDate: { gte: new Date(Date.UTC(exercise.year, 0, 1)), lte: new Date(Date.UTC(exercise.year, 11, 31, 23, 59, 59)) } } });

  return (
    <div className="space-y-8 pb-10">
      <div>
        <p className="text-sm text-[#708195]">Contabilidade</p>
        <h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Encerramento de exercícios</h2>
        <p className="mt-2 text-sm text-[#708195]">Exercício {exercise.year} — estado <strong>{exercise.state}</strong>. Bloqueadores devem ser resolvidos antes do fecho.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Estado</p>
          <p className={`mt-1 text-xl font-extrabold ${exercise.state === 'OPEN' ? 'text-emerald-700' : 'text-red-700'}`}>{exercise.state}</p>
        </div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Lançamentos</p>
          <p className="mt-1 tabular-nums text-xl font-extrabold text-[#1c2d3f]">{totalEntries}</p>
        </div>
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-red-700">Bloqueadores</p>
          <p className="mt-1 tabular-nums text-xl font-extrabold text-red-700">{blockerCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-amber-700">Avisos</p>
          <p className="mt-1 tabular-nums text-xl font-extrabold text-amber-700">{warningCount}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e2e9f1] bg-white p-4">
        <h3 className="font-bold text-[#1c2d3f]">Divergências / bloqueadores</h3>
        {blockers.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-700">Nenhum bloqueador identificado — exercício pode ser encerrado.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[#edf1f5]">
            {blockers.map((b: any, i: number) => (
              <li key={i} className={`py-2 text-xs ${b.severity === 'BLOCKER' ? 'text-[#a83939]' : 'text-amber-800'}`}>
                <span className="font-mono">[{b.code}]</span> {b.message}
                {b.value != null && <span className="ml-2 tabular-nums">valor: {b.value}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <CloseExerciseButton exerciseId={exercise.id} year={exercise.year} disabled={blockerCount > 0} exerciseState={exercise.state} />
    </div>
  );
}
