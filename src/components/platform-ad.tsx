import { prisma } from '@/lib/prisma';
import { AdHtml } from '@/components/ad-html';

// Public Adsterra creative comes from the existing platform configuration.
// It is intentionally server-fetched and never replaced by an invented ID.
export async function PlatformAd({ className = '' }: { className?: string }) {
  let html: string | null = null;
  try {
    const config = await prisma.platformConfig.findUnique({ where: { id: 'global' }, select: { adHtml: true } });
    html = config?.adHtml ?? null;
  } catch {
    return null;
  }
  if (!html) return null;
  return (
    <aside aria-label="Publicidade" className={`mx-auto max-w-4xl px-4 py-5 md:px-6 ${className}`}>
      <div className="overflow-hidden rounded-xl border border-[#e2e9f1] bg-white p-2">
        <AdHtml html={html} />
      </div>
    </aside>
  );
}
