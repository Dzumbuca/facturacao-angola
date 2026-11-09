// e2e/responsive.spec.ts
// Auditoria responsiva global: overflow horizontal, bottom navigation e safe areas.
import { test, expect, type Page } from '@playwright/test';

const EMAIL = 'e2e-test@machinefacturas.test';
const PASSWORD = 'TestPass123!';
const WIDTHS = [360, 375, 390, 430, 768, 1024, 1366, 1440, 1920];

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

async function overflowX(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test.describe('Responsividade global', () => {
  test('sem overflow horizontal em todas as resoluções', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', 'viewport controlado manualmente');
    await login(page);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['/', '/invoices']) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(250);
        expect(await overflowX(page), `${route} @ ${width}px`).toBeLessThanOrEqual(1);
      }
    }
  });

  test('bottom navigation: visível em mobile, oculta em desktop e sem sobrepor conteúdo', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', 'viewport controlado manualmente');
    await login(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const nav = page.getByRole('navigation', { name: 'Navegação móvel' });
    await expect(nav).toBeVisible();
    const box = await nav.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBeLessThanOrEqual(845);

    const paddingBottom = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('main') as HTMLElement).paddingBottom));
    expect(paddingBottom, 'main deve reservar espaço para a bottom nav').toBeGreaterThan(60);

    await page.getByRole('button', { name: 'Mais opções' }).click();
    const sheet = page.getByRole('dialog', { name: 'Mais opções' });
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('navigation', { name: 'Navegação móvel' })).toBeHidden();
  });

  test('páginas principais em 390px sem overflow', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', 'viewport controlado manualmente');
    await login(page);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ['/customers', '/produtos', '/stock', '/reports', '/warehouses', '/invoices/new']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(250);
      expect(await overflowX(page), `${route} @ 390px`).toBeLessThanOrEqual(1);
    }
  });
});
