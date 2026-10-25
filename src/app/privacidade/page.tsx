import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export const metadata = {
  title: 'Política de Privacidade · Machine Facturas',
  description: 'Como a Machine Facturas recolhe, usa e protege os seus dados.',
};

const sections: { title: string; body: string[] }[] = [
  {
    title: '1. Quem somos',
    body: [
      'A Machine Facturas é uma plataforma de facturação e gestão empresarial para empresas em Angola. Esta política explica que dados recolhemos, como os usamos e quais são os seus direitos.',
      'Para questões de privacidade ou protecção de dados, contacte-nos através de machinefacturas@gmail.com.',
    ],
  },
  {
    title: '2. Dados que recolhemos',
    body: [
      'Dados de conta: nome, endereço de email e, se entrar com o Google, a sua fotografia de perfil associada à conta Google.',
      'Dados da empresa: nome da empresa, NIF e dados de clientes, produtos e facturas que introduz na plataforma.',
      'Dados técnicos: registos de acesso necessários para o funcionamento e a segurança do serviço.',
    ],
  },
  {
    title: '3. Como usamos os seus dados',
    body: [
      'Para criar e gerir a sua conta e o espaço da sua empresa;',
      'Para emitir, guardar e organizar facturas, clientes e produtos;',
      'Para enviar emails transaccionais (confirmação de conta, recuperação de palavra-passe), quando configurados;',
      'Para comunicações comerciais, apenas com o seu consentimento expresso, que pode retirar a qualquer momento.',
    ],
  },
  {
    title: '4. Dados da conta Google',
    body: [
      'Se escolher "Continuar com o Google", recebemos do Google o seu nome, endereço de email e fotografia de perfil. Utilizamos estes dados exclusivamente para identificar a sua conta na plataforma.',
      'Não acedemos a outros dados da sua conta Google nem partilhamos os seus dados com o Google para fins publicitários.',
    ],
  },
  {
    title: '5. Onde os dados são guardados',
    body: [
      'Os dados são armazenados em bases de dados geridas pela Supabase (infra-estrutura em data centers na União Europeia) e a aplicação é servida pela Vercel. Ambos os prestadores aplicam medidas de segurança padrão da indústria.',
    ],
  },
  {
    title: '6. Partilha com terceiros',
    body: [
      'Não vendemos os seus dados. Partilhamos apenas o necessário com prestadores de serviço (hospedagem da aplicação, base de dados e envio de email) e quando obrigados por lei.',
    ],
  },
  {
    title: '7. Os seus direitos',
    body: [
      'Pode solicitar a qualquer momento o acesso, a correcção ou a eliminação dos seus dados e da sua conta, contactando machinefacturas@gmail.com. A eliminação da conta implica a eliminação dos dados associados, salvo obrigação legal de conservação.',
    ],
  },
  {
    title: '8. Alterações a esta política',
    body: [
      'Podemos actualizar esta política. A versão publicada nesta página é sempre a vigente, com a data da última actualização indicada no topo.',
    ],
  },
];

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-[#f3f6fa] text-[#1c2d3f]">
    <SiteHeader />
    <div className="prose-machine mx-auto max-w-3xl px-4 py-12 md:px-6">
      <article className="mx-auto w-full max-w-3xl rounded-3xl border border-[#e2e9f1] bg-white p-8 shadow-[0_20px_60px_rgba(25,52,80,.09)] sm:p-12">
        <img src="/logo.png" width="800" height="600" alt="Facturas" className="h-10 w-auto rounded-xl bg-white object-contain" />
        <p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-[#2878d0]">Machine Facturas</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-[#708195]">Última actualização: Outubro de 2026</p>
        <div className="mt-8 space-y-8">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-lg font-bold">{s.title}</h2>
              <div className="mt-3 space-y-3">
                {s.body.map((p, i) => (
                  <p key={i} className="text-sm leading-7 text-[#3d5169]">{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <p className="mt-10 border-t border-[#e7edf3] pt-6 text-sm text-[#708195]">
          Consulte também os <Link href="/termos" className="font-semibold text-[#2878d0] hover:underline">Termos de Serviço</Link>.
        </p>
      </article>
        </div>
    <SiteFooter />
  </main>
  );
}
