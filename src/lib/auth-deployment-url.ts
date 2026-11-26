/**
 * Auth.js uses AUTH_URL/NEXTAUTH_URL to replace the incoming request origin.
 * Vercel Preview deployments have a deployment-specific VERCEL_URL, so use it
 * as the authoritative origin there instead of inheriting a stale preview URL.
 */
export function getPreviewAuthOrigin(
  vercelEnv: string | undefined,
  vercelUrl: string | undefined,
): string | null {
  if (vercelEnv !== 'preview' || !vercelUrl) return null;

  const host = vercelUrl.trim().toLowerCase();
  if (!host || host.includes('://') || /[/?#@]/.test(host)) return null;

  try {
    const url = new URL(`https://${host}`);
    if (url.hostname !== host || !url.hostname.endsWith('.vercel.app')) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Keep Auth.js redirects on the current deployment's origin. */
export function resolveAuthRedirect(url: string, baseUrl: string): string {
  try {
    const base = new URL(baseUrl);
    const target = new URL(url, base);
    if ((target.protocol === 'https:' || target.protocol === 'http:') && target.origin === base.origin) {
      return target.toString();
    }
    return base.origin;
  } catch {
    try {
      return new URL(baseUrl).origin;
    } catch {
      return '/';
    }
  }
}
