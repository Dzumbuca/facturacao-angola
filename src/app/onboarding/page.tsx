import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import OnboardingForm from './onboarding-form';

export default async function OnboardingPage() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) redirect('/login');
  if (user?.tenantId) redirect('/');

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f6fa] text-[#1c2d3f] p-6">
      <div className="w-full max-w-md rounded-3xl border border-[#e2e9f1] bg-white p-8 shadow-[0_20px_60px_rgba(25,52,80,.09)] sm:p-10">
        <img src="/logo.png" width="800" height="600" alt="Facturas" className="h-10 w-auto rounded-xl bg-white object-contain" />
        <p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-[#2878d0]">Último passo</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Criar o espaço da sua empresa</h1>
        <p className="mt-2 text-sm leading-6 text-[#708195]">
          Olá{user?.name ? `, ${user.name}` : ''}! A sua conta foi criada.
          Falta apenas indicar o nome da empresa para começar a emitir facturas.
        </p>
        <OnboardingForm userName={user?.name ?? null} userEmail={user?.email ?? null} />
      </div>
    </main>
  );
}
