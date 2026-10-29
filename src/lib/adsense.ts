// Google AdSense — valores oficiais da conta Machine Facturas.
// NÃO substituir por valores fictícios: o client ID abaixo é o mesmo já usado
// no site (public/ads.txt e loader do rodapé) e os slots de bloco só podem
// provir das variáveis de ambiente documentadas em docs/adsense.md e
// .env.example — nunca são inventados aqui.

export const ADSENSE_CLIENT_ID = "ca-pub-9283668518139905";

// Colocações disponíveis → variável de ambiente com o ID oficial do bloco de
// anúncios criado na conta Google AdSense. Sem a variável definida, a
// colocação simplesmente não é renderizada (zero impacto no layout).
const SLOT_ENV: Record<string, string> = {
  // Página inicial (/inicio): entre as secções de funcionalidades e preços.
  "inicio-mid": "NEXT_PUBLIC_ADSENSE_SLOT_INICIO_MID",
  // Acima do rodapé em todas as páginas públicas com SiteFooter.
  "inpage-footer": "NEXT_PUBLIC_ADSENSE_SLOT_INPAGE",
};

// Devolve o ID do bloco de anúncios configurado na conta, ou null quando a
// colocação não está activa. IDs de bloco AdSense são numéricos (9–12 dígitos).
export function getAdSenseSlotId(placement: string): string | null {
  const envName = SLOT_ENV[placement];
  if (!envName) return null;
  const value = process.env[envName];
  if (!value) return null;
  return /^\d{9,12}$/.test(value.trim()) ? value.trim() : null;
}
