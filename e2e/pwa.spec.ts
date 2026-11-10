// e2e/pwa.spec.ts
// Auditoria PWA: manifest, ícones oficiais, Service Worker e instalação guiada.
import { test, expect, type Page } from '@playwright/test';

const EMAIL = 'e2e-test@machinefacturas.test';
const PASSWORD = 'TestPass123!';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  const entrar = page.getByRole('button', { name: 'Entrar' });
  await expect(entrar).toBeEnabled({ timeout: 30000 });
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await entrar.click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 45000 });
}

test.describe('PWA', () => {
  test('manifest e ícones oficiais respondem corretamente', async ({ request }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', 'verificação única');

    const response = await request.get('/manifest.json');
    expect(response.status()).toBe(200);
    const manifest = await response.json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.theme_color).toBe('#021f87');
    expect(manifest.background_color).toBe('#ffffff');

    const icons = manifest.icons.map((icon: { sizes: string; purpose: string }) => `${icon.sizes} ${icon.purpose}`);
    expect(icons).toContain('192x192 any');
    expect(icons).toContain('512x512 any');
    expect(icons).toContain('192x192 maskable');
    expect(icons).toContain('512x512 maskable');

    for (const icon of manifest.icons) {
      const asset = await request.get(icon.src);
      expect(asset.status(), icon.src).toBe(200);
      expect(asset.headers()['content-type']).toContain('image/png');
    }
    const apple = await request.get('/icons/apple-touch-icon.png');
    expect(apple.status()).toBe(200);
  });

  test('Service Worker regista e ativa', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', 'verificação única');
    await login(page);
    const active = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
      ]);
      return Boolean(registration && registration.active);
    });
    expect(active).toBe(true);
  });

  test('desktop não mostra o botão de instalação', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', 'verificação única');
    await page.setViewportSize({ width: 1366, height: 900 });
    await login(page);
    await expect(page.getByRole('button', { name: 'Instalar app' })).toHaveCount(0);
  });

  test('iPhone/Safari mostra instruções de instalação', async ({ browser }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', 'verificação única');
    const context = await browser.newContext({
      userAgent: IPHONE_UA,
      viewport: { width: 390, height: 844 },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'vendor', { get: () => 'Apple Computer, Inc.' });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
    });
    const page = await context.newPage();
    await login(page);

    const install = page.getByRole('button', { name: 'Instalar app' });
    await expect(install).toBeVisible();
    await install.click();

    const dialog = page.getByRole('dialog', { name: 'Instalar no iPhone' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Adicionar ao ecrã principal')).toBeVisible();
    await dialog.getByRole('button', { name: 'Entendi' }).click();
    await expect(dialog).toBeHidden();
    await context.close();
  });

  test('Android: prompt nativo e botão desaparece após aceitar', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', 'verificação única');
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);

    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
      event.prompt = async () => {};
      event.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(event);
    });

    const install = page.getByRole('button', { name: 'Instalar app' });
    await expect(install).toBeVisible();
    await install.click();
    await expect(install).toHaveCount(0);
  });
});
