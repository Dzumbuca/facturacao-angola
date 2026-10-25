import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export const metadata = {
  title: 'Termos de Serviço · Machine Facturas',
  description: 'Condições de utilização da plataforma Machine Facturas.',
};

const sections: { title: string; body: string[] }[] = [
  {
    title: '1. Aceitação dos termos',
    body: [
      'Ao criar uma conta e utilizar a plataforma Machine Facturas, aceita estes Termos de Serviço. Se não concordar com alguma parte, não utilize o serviço.',
    ],
  },
  {
    title: '2. O serviço',
    body: [
      'A Machine Facturas fornece ferramentas de facturação e gestão empresarial: emissão de facturas, gestão de clientes, produtos, pagamentos e relatórios, destinadas a empresas que operam em Angola.',
      'A plataforma é disponibilizada no estado em que se encontra e evolui continuamente. Podemos adicionar, alterar ou remover funcionalidades.',
    ],
  },
  {
    title: '3. A sua conta',
    body: [
      'É responsável por manter a confidencialidade das suas credenciais e por toda a actividade realizada na sua conta.',
      'Deve fornecer informações verdadeiras e actualizadas da sua empresa, incluindo o NIF quando aplicável.',
      'A criação de contas falsas, o acesso não autorizado a contas de terceiros ou a utilização do serviço para actividades ilícitas implicam a suspensão imediata da conta.',
    ],
  },
  {
    title: '4. Facturação e obrigações fiscais',
    body: [
      'Os documentos emitidos na plataforma são suportados pelas informações que introduz. A responsabilidade pela exactidão, legalidade e conformidade fiscal das facturas — incluindo as exigências da Administração Geral Tributária (AGT) de Angola — é do utilizador e da sua empresa.',
      'A plataforma auxilia a gestão, mas não substitui aconsultoria contabilística ou fiscal.',
    ],
  },
  {
    title: '5. Propriedade dos dados',
    body: [
      'Os dados que introduz (clientes, produtos, facturas, pagamentos) pertencem à sua empresa. Concedemo-nos apenas a licença necessária para os armazenar e processar para lhe prestar o serviço.',
    ],
  },
  {
    title: '6. Disponibilidade e limitação de responsabilidade',
    body: [
      'Procuramos manter o serviço disponível e seguro, mas não garantimos funcionamento ininterrupto ou isento de erros.',
      'Na medida permitida pela lei aplicável, a Machine Facturas não é responsável por lucros cessantes, perda de dados introduzidos incorrectamente pelo utilizador ou danos indirectos resultantes da utilização do serviço.',
    ],
  },
  {
    title: '7. Suspensão e cessação',
    body: [
      'Pode encerrar a sua conta a qualquer momento, contactando-nos. Podemos suspender contas que violem estes termos ou que comprometam a segurança da plataforma e dos seus utilizadores.',
    ],
  },
  {
    title: '8. Alterações',
    body: [
      'Podemos actualizar estes termos. A versão publicada nesta página é sempre a vigente e a utilização continuada do serviço implica a aceitação da versão actualizada.',
    ],
  },
  {
    title: '9. Contacto',
    body: [
      'Para qualquer questão sobre estes termos: machinefacturas@gmail.com.',
    ],
  },
];

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-[#f3f6fa] text-[#1c2d3f]">
    <SiteHeader />
    <div className="prose-machine mx-auto max-w-3xl px-4 py-12 md:px-6">
      <article className="mx-auto w-full max-w-3xl rounded-3xl border border-[#e2e9f1] bg-white p-8 shadow-[0_20px_60px_rgba(25,52,80,.09)] sm:p-12">
        <img src="/logo.png" alt="Facturas" className="h-10 w-auto rounded-xl bg-white object-contain" />
        <p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-[#2878d0]">Machine Facturas</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Termos de Serviço</h1>
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
          Consulte também a <Link href="/privacidade" className="font-semibold text-[#2878d0] hover:underline">Política de Privacidade</Link>.
        </p>
      </article>
        </div>
    <SiteFooter />
  </main>
  );
}
