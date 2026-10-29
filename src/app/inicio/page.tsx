import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { AdSenseSlot } from '@/components/adsense-slot';
import { AdHtml } from '@/components/ad-html';
import { prisma } from '@/lib/prisma';
import { CheckIcon, featureIcons, SparkIcon, WhatsappIcon } from '@/components/icons';

export const metadata: Metadata = {
  metadataBase: new URL('https://machinefaturas.shop'),
  title: 'Machine Facturas — Facturação online para empresas em Angola',
  description: 'Crie e emita facturas com assinatura digital (padrão AGT), exportação SAFT-AO, relatórios e gestão de clientes. Grátis para começar, do telemóvel ou computador.',
  keywords: ['facturação Angola', 'software de facturas Angola', 'facturas online', 'SAFT Angola', 'AGT', 'Multicaixa Express', 'facturação electronica', 'emissão de facturas Luanda'],
  openGraph: {
    title: 'Machine Facturas — Facturação online para empresas em Angola',
    description: 'Facturas com assinatura digital, SAFT-AO e relatórios. Grátis para começar.',
    url: 'https://machinefaturas.shop',
    siteName: 'Machine Facturas',
    locale: 'pt_AO',
    type: 'website',
    images: [{ url: '/logo.png', width: 800, height: 600 }],
  },
  twitter: { card: 'summary', title: 'Machine Facturas', description: 'Facturação online para empresas angolanas — grátis para começar.' },
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

const comparison: { label: string; free: string; basico: string; pro: string }[] = [
  { label: 'Facturas por mês', free: '20', basico: 'Ilimitadas', pro: 'Ilimitadas' },
  { label: 'Utilizadores', free: '1', basico: '3', pro: 'Ilimitados' },
  { label: 'Assinatura digital padrão AGT', free: '✓', basico: '✓', pro: '✓' },
  { label: 'Clientes e produtos', free: 'Ilimitados', basico: 'Ilimitados', pro: 'Ilimitados' },
  { label: 'Envio de facturas por email', free: '—', basico: '✓', pro: '✓' },
  { label: 'Exportação SAFT-AO', free: '—', basico: '—', pro: '✓' },
  { label: 'Relatórios', free: 'Básicos', basico: 'Básicos', pro: 'Avançados' },
  { label: 'Campanhas de email', free: '—', basico: '—', pro: '✓' },
  { label: 'Anúncios no painel', free: 'Sim', basico: 'Não', pro: 'Não' },
];

const faq: { q: string; a: string }[] = [
  { q: 'Como pago um plano pago?', a: 'Por Multicaixa Express, para o número 937 555 618. Depois de transferir, envie o comprovativo na página Pagamento dentro da plataforma — a equipa confirma e o plano fica activo na hora.' },
  { q: 'O que acontece quando atingo as 20 facturas do plano Grátis?', a: 'A emissão fica disponível novamente no mês seguinte, ou imediatamente se subir de plano. Os rascunhos continuam sempre disponíveis.' },
  { q: 'Preciso de instalar alguma coisa?', a: 'Não. A plataforma funciona no navegador — telemóvel, tablet ou computador — e as facturas ficam guardadas com segurança na sua conta.' },
  { q: 'Como funciona a renovação?', a: 'Cada pagamento tem a duração que escolher (1, 3, 6 ou 12 meses). Renovações feitas antes do prazo somam aos dias restantes — não perde nada.' },
  { q: 'Os meus dados estão seguros?', a: 'Cada empresa só acede aos seus próprios dados, as facturas levam assinatura digital e a plataforma mantém cópias de segurança diárias.' },
];

export default async function LandingPage() {
  // Anúncio de plataforma (HTML configurado em /admin/configuracoes — ex.: banner
  // Adsterra), igual ao topo das páginas de ferramentas/guias. Falha de base de
  // dados nunca quebra a página: fica simplesmente sem anúncio.
  let adHtml: string | null = null;
  try {
    const config = await prisma.platformConfig.findUnique({ where: { id: 'global' }, select: { adHtml: true } });
    adHtml = config?.adHtml ?? null;
  } catch { adHtml = null; }
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Machine Facturas',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'Facturação online para empresas em Angola com assinatura digital, SAFT-AO e relatórios.',
    url: 'https://machinefaturas.shop',
    offers: [
      { '@type': 'Offer', name: 'Grátis', price: '0', priceCurrency: 'AOA' },
      { '@type': 'Offer', name: 'Básico', price: '9900', priceCurrency: 'AOA' },
      { '@type': 'Offer', name: 'Pro', price: '19900', priceCurrency: 'AOA' },
    ],
  };
  return <main className="landing-page min-h-screen bg-[#f3f6fa] text-[#1c2d3f]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <SiteHeader />
    {adHtml && <div className="mx-auto max-w-4xl px-4 pt-5 md:px-6"><div className="overflow-hidden rounded-xl border border-[#e2e9f1] bg-white p-2"><AdHtml html={adHtml} /></div></div>}

    <section className="landing-hero relative overflow-hidden border-b border-[#e2e9f1] bg-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(40,120,208,.10),transparent_70%)]" />
      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 text-center md:px-6 md:pt-20">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#d8e6f5] bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-[.12em] text-[#2878d0]">
          <SparkIcon className="h-3.5 w-3.5" /> Assinatura digital · padrão AGT · SAFT-AO
        </p>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black leading-[1.08] tracking-tight md:text-6xl">A facturação do seu negócio, organizada em minutos.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#4a5f76] md:text-lg">Crie, emita e acompanhe facturas com assinatura digital, SAFT-AO e relatórios — do telemóvel ou do computador. Feito para empresas angolanas.</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/register" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#2878d0] px-7 text-base font-semibold text-white shadow-[0_10px_30px_rgba(40,120,208,.35)] transition hover:bg-[#216bbd] sm:w-auto">Criar conta grátis</Link>
          <Link href="#precos" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-[#cdddeb] bg-white px-7 text-base font-semibold text-[#1c2d3f] transition hover:bg-[#f6f9fc] sm:w-auto">Ver planos e preços</Link>
        </div>
        <p className="mt-4 text-sm text-[#708195]">Grátis para começar · Sem cartão de crédito · Os seus dados, a sua empresa</p>
      </div>
    </section>

    <section id="funcionalidades" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-[#2878d0]">Funcionalidades</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Tudo o que a sua empresa precisa para facturar</h2>
        <p className="mt-3 leading-7 text-[#4a5f76]">Do primeiro orçamento ao ficheiro SAFT — sem instalar nada.</p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => {
          const Icon = featureIcons[index % featureIcons.length];
          return <div key={feature.title} className="landing-feature rounded-2xl border border-[#e2e9f1] bg-white p-6 shadow-[0_3px_14px_rgba(25,52,80,.035)] transition hover:border-[#c9def2] hover:shadow-[0_8px_28px_rgba(25,52,80,.07)]">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef6ff] text-[#2878d0]"><Icon /></span>
            <h3 className="mt-4 font-bold text-[#1c2d3f]">{feature.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#5b6f85]">{feature.body}</p>
          </div>;
        })}
      </div>
    </section>

    {/* Espaço publicitário (visitantes) — só renderiza com um ID de bloco
        oficial em NEXT_PUBLIC_ADSENSE_SLOT_INICIO_MID (ver docs/adsense.md);
        clientes autenticados nunca o veem. */}
    <AdSenseSlot placement="inicio-mid" minHeight={110} />

    <section id="precos" className="border-y border-[#e2e9f1] bg-white px-4 py-20 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#2878d0]">Preços</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Preços simples, em Kwanzas</h2>
          <p className="mt-3 leading-7 text-[#4a5f76]">Comece grátis e cresça quando quiser. Sem contratos de fidelização — paga por Multicaixa Express, mês a mês ou com desconto de duração.</p>
        </div>
        <div className="mt-12 grid items-start gap-5 lg:grid-cols-3">
          {plans.map((plan) => <div key={plan.name} className={`relative flex flex-col rounded-3xl border bg-white p-7 shadow-[0_3px_14px_rgba(25,52,80,.035)] ${plan.highlight ? 'border-[#2878d0] shadow-[0_18px_50px_rgba(40,120,208,.18)] lg:-mt-3 lg:pb-9' : 'border-[#e2e9f1]'}`}>
            {plan.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#2878d0] px-4 py-1 text-xs font-bold text-white">Mais popular</span>}
            <p className="text-sm font-bold uppercase tracking-[.14em] text-[#2878d0]">{plan.name}</p>
            <p className="mt-3 text-4xl font-black tracking-tight">{plan.price}<span className="ml-1 text-sm font-medium text-[#708195]">/ {plan.period}</span></p>
            <p className="mt-1 text-sm text-[#708195]">{plan.tagline}</p>
            <ul className="mt-6 flex-1 space-y-3 text-sm text-[#3d5169]">
              {plan.items.map((item) => <li key={item} className="flex items-start gap-2.5"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#26a06b]" /><span>{item}</span></li>)}
            </ul>
            <Link href="/register" className={`mt-7 inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2878d0] ${plan.highlight ? 'bg-[#2878d0] text-white hover:bg-[#216bbd]' : 'border border-[#cdddeb] text-[#1c2d3f] hover:bg-[#f6f9fc]'}`}>{plan.cta}</Link>
          </div>)}
        </div>

        <div className="mt-14">
          <h3 className="text-center text-xl font-bold tracking-tight">Compare os planos em detalhe</h3>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-[#e2e9f1]">
            <table className="data-table min-w-[640px] bg-white">
              <thead><tr><th>Recurso</th><th>Grátis</th><th>Básico</th><th>Pro</th></tr></thead>
              <tbody>
                {comparison.map((row) => <tr key={row.label}>
                  <td className="font-medium text-[#263c52]">{row.label}</td>
                  <td>{row.free}</td>
                  <td className={row.basico !== '—' ? 'font-semibold text-[#1c2d3f]' : 'text-[#a9b6c4]'}>{row.basico}</td>
                  <td className={row.pro !== '—' ? 'font-semibold text-[#1c2d3f]' : 'text-[#a9b6c4]'}>{row.pro}</td>
                </tr>)}
                <tr>
                  <td className="font-medium text-[#263c52]">Preço</td>
                  <td className="font-bold">0 Kz</td>
                  <td className="font-bold">9.900 Kz/mês</td>
                  <td className="font-bold">19.900 Kz/mês</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-center text-xs leading-5 text-[#708195]">
            Pagamento por <strong>Multicaixa Express (937 555 618)</strong> · envia o comprovativo na plataforma e a activação é feita pela equipa.
            Duração à escolha: 1, 3, 6 ou 12 meses — renovações somam ao prazo restante.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl">
          <h3 className="text-center text-xl font-bold tracking-tight">Perguntas frequentes</h3>
          <div className="mt-6 rounded-2xl border border-[#e2e9f1] bg-white px-6 py-2">
            {faq.map((item) => <details key={item.q} className="group border-b border-[#e2e9f1] last:border-0">
              <summary className="flex items-center justify-between gap-3 py-4 text-sm font-bold text-[#1c2d3f] transition group-open:text-[#2878d0]">
                {item.q}
                <span aria-hidden="true" className="text-lg text-[#708195] transition group-open:rotate-45">+</span>
              </summary>
              <p className="pb-4 text-sm leading-6 text-[#4a5f76]">{item.a}</p>
            </details>)}
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-[#d8e6f5] bg-[#eef6ff] p-6 text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-bold text-[#1c2d3f]"><SparkIcon className="h-4 w-4 text-[#2878d0]" /> Plano Fundador — só para as primeiras 30 empresas</p>
          <p className="mt-1.5 text-sm text-[#4a5f76]">6 meses do plano Pro grátis em troca do seu feedback. As suas sugestões moldam o produto.</p>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <div className="rounded-3xl bg-[#102b46] px-6 py-14 text-center text-white md:px-12">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Comece a facturar hoje.</h2>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-blue-100">Registo em 1 minuto com a sua conta Google, sem instalação e sem cartão. A sua primeira factura pode estar emitida antes do seu próximo café.</p>
        <Link href="/register" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2878d0] px-8 text-base font-bold text-white transition hover:bg-[#216bbd]">Criar conta grátis</Link>
      </div>
    </section>

    <section aria-label="Divulgar" className="mx-auto max-w-6xl px-4 pb-14 md:px-6">
      <div className="flex flex-col items-center gap-8 rounded-3xl border border-[#e2e9f1] bg-white p-8 md:flex-row md:justify-between md:p-10">
        <div className="max-w-md text-center md:text-left">
          <h2 className="text-2xl font-bold tracking-tight text-[#1c2d3f]">Conheces uma empresa que precisa?</h2>
          <p className="mt-3 leading-7 text-[#4a5f76]">Partilha o Machine Facturas no WhatsApp — facturação com assinatura digital, grátis para começar.</p>
          <a href={"https://wa.me/?text=" + encodeURIComponent('Conhece o Machine Facturas — facturação online para empresas em Angola, com assinatura digital e SAFT. Grátis para começar: https://machinefaturas.shop')} target="_blank" rel="noopener" className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#25d366] px-7 text-base font-bold text-white transition hover:bg-[#1fb855]"><WhatsappIcon className="h-5 w-5" /> Partilhar no WhatsApp</a>
        </div>
        <div className="text-center">
          <img src="/qr-machinefaturas.png" alt="QR code para machinefaturas.shop" className="h-44 w-44 rounded-xl border border-[#e2e9f1] shadow-sm" />
          <p className="mt-2 text-xs text-[#708195]">Aponta a câmara do telemóvel</p>
        </div>
      </div>
    </section>

    <SiteFooter />
  </main>;
}
