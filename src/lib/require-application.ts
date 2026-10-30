import { isApplicationEnabled } from './platform-apps';

export class ApplicationNotEnabledError extends Error {
  constructor(public slug: string) {
    super(`Application not enabled: ${slug}`);
    this.name = 'ApplicationNotEnabledError';
  }
}

export async function requireApplication(tenantId: string, slug: string): Promise<void> {
  const enabled = await isApplicationEnabled(tenantId, slug);
  if (!enabled) throw new ApplicationNotEnabledError(slug);
}
