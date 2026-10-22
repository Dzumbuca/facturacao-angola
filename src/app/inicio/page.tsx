import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Machine Facturas — Facturação online para empresas em Angola',
  description: 'Crie e emita facturas com assinatura digital (padrão AGT), exportação SAFT-AO, relatórios e gestão de clientes. Grátis para começar, do telemóvel ou computador.',
};

const features: { title: string; body: string }[] = [
  { title: 'Facturas em segundos', body: 'Emita documentos com cliente, produtos e IVA a partir de qualquer dispositivo — telemóvel, tablet ou computador.' },
  { title: 'Assinatura digital · padrão AGT', body: 'Cada factura leva assinatura RSA e código de controlo de 4 caracteres, conforme as exigências da Administração Geral Tributária.' },
  { title: 'Exportação SAFT-AO', body: 'Gere o ficheiro SAFT para o seu contabilista ou para a AGT com um clique.' },
  { title: 'Rascunhos e pagamentos', body: 'Guarde rascunhos, emita quando quiser e registe pagamentos parciais ou totais com histórico.' },
  { title: 'Equipa e permissões', body: 'Convide a sua equipa com papéis definidos: facturação, gestão de utilizadores ou apenas consulta.' },
  { title: 'Relatórios e exportação', body: 'Vendas, recebimentos e desempenho por período, prontos a exportar para Excel.' },
];

const plans: {
  name: string;
  price: string;
  period: string;
  tagline: string;
  items: string[];
  highlight?: boolean;
  cta: string;
}[] = [
  {
    name: 'Grátis',
    price: '0 Kz',
    period: 'para sempre',
    tagline: 'Para começar hoje',
    items: ['20 facturas por mês', '1 utilizador', 'Clientes e produtos ilimitados', 'Login com Google', 'App para telemóvel e computador'],
    cta: 'Criar conta grátis',
  },
  {
    name: 'Básico',
    price: '9.900 Kz',
    period: 'por mês',
    tagline: 'Para o dia-a-dia do negócio',
    items: ['Facturas ilimitadas', '3 utilizadores', 'Envio de facturas por email', 'Contas bancárias nos documentos', 'Suporte prioritário por WhatsApp'],
    highlight: true,
    cta: 'Começar no Básico',
  },
  {
    name: 'Pro',
    price: '19.900 Kz',
    period: 'por mês',
    tagline: 'Para quem quer tudo',
    items: ['Tudo do Básico', 'Exportação SAFT-AO', 'Utilizadores ilimitados', 'Relatórios avançados', 'Campanhas de email'],
    cta: 'Começar no Pro',
  },
];

export default function LandingPage() {
  return <main className="min-h-screen bg-[#f3f6fa] text-[#1c2d3f]">
    <header className="sticky top-0 z-40 border-b border-[#e2e9f1] bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
        <Link href="/inicio" className="flex items-center gap-2">
          <img src="/logo.png" alt="Facturas" className="h-9 w-auto rounded-lg bg-white object-contain px-1.5 py-1" />
          <span className="text-sm font-extrabold tracking-[.08em] text-[#102b46]">MACHINE FACTURAS</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <a href="#funcionalidades" className="hidden text-sm font-semibold text-[#48627a] hover:text-[#2878d0] sm:inline">Funcionalidades</a>
          <a href="#precos" className="hidden text-sm font-semibold text-[#48627a] hover:text-[#2878d0] sm:inline">Preços</a>
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#2878d0] hover:bg-[#f0f6fc]">Entrar</Link>
          <Link href="/register" className="rounded-lg bg-[#2878d0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#216bbd]">Criar conta grátis</Link>
        </nav>
      </div>
    </header>

    <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 text-center md:px-6 md:pt-20">
      <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#d8e6f5] bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-[.12em] text-[#2878d0]">Assinatura digital · padrão AGT · SAFT-AO</p>
      <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight md:text-6xl">A facturação do seu negócio, organizada em minutos.</h1>
      <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#4a5f76] md:text-lg">Crie, emita e acompanhe facturas com assinatura digital, SAFT-AO e relatórios — do telemóvel ou do computador. Feito para empresas angolanas.</p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link href="/register" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#2878d0] px-7 text-base font-semibold text-white shadow-[0_10px_30px_rgba(40,120,208,.35)] transition hover:bg-[#216bbd] sm:w-auto">Criar conta grátis</Link>
        <Link href="/login" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-[#cdddeb] bg-white px-7 text-base font-semibold text-[#1c2d3f] transition hover:bg-[#f6f9fc] sm:w-auto">Já tenho conta</Link>
      </div>
      <p className="mt-4 text-sm text-[#708195]">Grátis para começar · Sem cartão de crédito · Os seus dados, a sua empresa</p>
    </section>

    <section id="funcionalidades" className="mx-auto max-w-6xl px-4 pb-20 md:px-6">
      <h2 className="text-center text-3xl font-bold tracking-tight">Tudo o que a sua empresa precisa para facturar</h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-[#4a5f76]">Do primeiro orçamento ao ficheiro SAFT — sem instalar nada.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => <div key={feature.title} className="rounded-2xl border border-[#e2e9f1] bg-white p-6 shadow-[0_3px_14px_rgba(25,52,80,.035)]">
          <h3 className="font-bold text-[#1c2d3f]">{feature.title}</h3>
          <p className="mt-2 text-sm leading-6 text-[#5b6f85]">{feature.body}</p>
        </div>)}
      </div>
    </section>

    <section id="precos" className="mx-auto max-w-6xl px-4 pb-20 md:px-6">
      <h2 className="text-center text-3xl font-bold tracking-tight">Preços simples, em Kwanzas</h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-[#4a5f76]">Comece grátis e cresça quando quiser. Sem contratos de fidelização.</p>
      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => <div key={plan.name} className={`relative flex flex-col rounded-3xl border bg-white p-7 shadow-[0_3px_14px_rgba(25,52,80,.035)] ${plan.highlight ? 'border-[#2878d0] shadow-[0_18px_50px_rgba(40,120,208,.18)]' : 'border-[#e2e9f1]'}`}>
          {plan.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2878d0] px-4 py-1 text-xs font-bold text-white">Mais popular</span>}
          <p className="text-sm font-bold uppercase tracking-[.14em] text-[#2878d0]">{plan.name}</p>
          <p className="mt-3 text-3xl font-black tracking-tight">{plan.price}<span className="ml-1 text-sm font-medium text-[#708195]">/ {plan.period}</span></p>
          <p className="mt-1 text-sm text-[#708195]">{plan.tagline}</p>
          <ul className="mt-5 flex-1 space-y-2.5 text-sm text-[#3d5169]">
            {plan.items.map((item) => <li key={item} className="flex gap-2"><span className="text-[#26a06b]">✓</span>{item}</li>)}
          </ul>
          <Link href="/register" className={`mt-6 inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition ${plan.highlight ? 'bg-[#2878d0] text-white hover:bg-[#216bbd]' : 'border border-[#cdddeb] text-[#1c2d3f] hover:bg-[#f6f9fc]'}`}>{plan.cta}</Link>
        </div>)}
      </div>
      <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-[#d8e6f5] bg-[#eef6ff] p-5 text-center">
        <p className="text-sm font-bold text-[#1c2d3f]">Plano Fundador — só para as primeiras 30 empresas</p>
        <p className="mt-1 text-sm text-[#4a5f76]">6 meses do plano Pro grátis em troca do seu feedback. As suas sugestões moldam o produto.</p>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-4 pb-20 md:px-6">
      <div className="rounded-3xl bg-[#102b46] px-6 py-14 text-center text-white md:px-12">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Comece a facturar hoje. A sério, hoje.</h2>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-blue-100/80">Registo em 1 minuto com a sua conta Google, sem instalação e sem cartão. A sua primeira factura pode estar emitida antes do seu próximo café.</p>
        <Link href="/register" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#38a7b8] px-8 text-base font-bold text-[#102b46] transition hover:bg-[#4fbccb]">Criar conta grátis</Link>
      </div>
    </section>

    <footer className="border-t border-[#e2e9f1] bg-white px-4 py-8 md:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Facturas" className="h-8 w-auto rounded-lg bg-white object-contain px-1.5 py-1" />
          <span className="text-xs font-semibold text-[#708195]">© 2026 Machine Facturas · Angola</span>
        </div>
        <div className="flex items-center gap-5 text-sm font-medium text-[#48627a]">
          <Link href="/privacidade" className="hover:text-[#2878d0]">Privacidade</Link>
          <Link href="/termos" className="hover:text-[#2878d0]">Termos</Link>
          <a href="mailto:machinefacturas@gmail.com" className="hover:text-[#2878d0]">Contacto</a>
          <a href="https://beta.publishers.adsterra.com/referral/L8Y8skqCEG" rel="nofollow" className="text-xs text-[#8ba0b5] hover:text-[#2878d0]">Programa de afiliados</a>
        </div>
      </div>
    </footer>
  </main>;
}
