import { auth } from '@/lib/auth';
import { getAdSenseSlotId } from '@/lib/adsense';
import { AdSenseUnit } from '@/components/adsense-unit';

type AdSenseSlotProps = {
  // Identificador da colocação (ver src/lib/adsense.ts) — sem a variável de
  // ambiente correspondente definida, nada é renderizado.
  placement: string;
  // Quando o chamador já consultou a sessão (ex.: SiteFooter), evita uma
  // segunda chamada a auth(); se omitido, a sessão é consultada aqui.
  authenticated?: boolean;
  wrapperClassName?: string;
  minHeight?: number;
};

// Espaço publicitário Google AdSense para páginas PÚBLICAS.
// Regras garantidas aqui:
// - Nunca renderiza para utilizadores autenticados (área de clientes limpa);
// - Nunca renderiza sem um ID de bloco oficial definido em .env (nada é
//   inventado) — a página fica exactamente como hoje;
// - Reserva a altura apenas quando activo (evita salto de layout/CLS);
// - Rótulo «Publicidade» discreto para separação clara do conteúdo,
//   conforme as políticas do Google AdSense.
export async function AdSenseSlot({ placement, authenticated, wrapperClassName = '', minHeight = 120 }: AdSenseSlotProps) {
  if (authenticated === undefined) {
    const session = await auth();
    authenticated = Boolean(session?.user?.id);
  }
  if (authenticated) return null;

  const slot = getAdSenseSlotId(placement);
  if (!slot) return null;

  return (
    <aside
      aria-label="Publicidade"
      className={`mx-auto max-w-6xl px-4 py-6 text-center md:px-6 ${wrapperClassName}`}
    >
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.16em] text-[#8fa3b8]">Publicidade</p>
      <AdSenseUnit slot={slot} minHeight={minHeight} />
    </aside>
  );
}
