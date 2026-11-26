import { describe, expect, it } from 'vitest';
import { getPreviewAuthOrigin, resolveAuthRedirect } from './auth-deployment-url';

describe('Preview Auth.js origin', () => {
  it('uses only the active Vercel Preview deployment URL', () => {
    expect(getPreviewAuthOrigin('preview', 'facturacao-angola-ir9qxab2w-dzumbucas-projects.vercel.app'))
      .toBe('https://facturacao-angola-ir9qxab2w-dzumbucas-projects.vercel.app');
  });

  it('does not override Production, Staging, local, or malformed origins', () => {
    expect(getPreviewAuthOrigin('production', 'facturacao-angola.vercel.app')).toBeNull();
    expect(getPreviewAuthOrigin('preview', undefined)).toBeNull();
    expect(getPreviewAuthOrigin('preview', 'https://attacker.example')).toBeNull();
    expect(getPreviewAuthOrigin('preview', 'bad host.vercel.app')).toBeNull();
  });
});

describe('Auth.js redirect callback', () => {
  const currentDeployment = 'https://facturacao-angola-ir9qxab2w-dzumbucas-projects.vercel.app';

  it('resolves a relative dashboard callback on the current deployment', () => {
    expect(resolveAuthRedirect('/', currentDeployment)).toBe(`${currentDeployment}/`);
    expect(resolveAuthRedirect('/customers', currentDeployment)).toBe(`${currentDeployment}/customers`);
  });

  it('rejects old preview hosts and external open redirects', () => {
    expect(resolveAuthRedirect('https://facturacao-angola-dmudiak0m-dzumbucas-projects.vercel.app/', currentDeployment))
      .toBe(currentDeployment);
    expect(resolveAuthRedirect('https://attacker.example/path', currentDeployment)).toBe(currentDeployment);
    expect(resolveAuthRedirect('//attacker.example/path', currentDeployment)).toBe(currentDeployment);
  });

  it('allows a same-origin absolute redirect', () => {
    expect(resolveAuthRedirect(`${currentDeployment}/onboarding`, currentDeployment))
      .toBe(`${currentDeployment}/onboarding`);
  });
});
