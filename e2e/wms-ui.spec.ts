// e2e/wms-ui.spec.ts
// Validação visual real (Chromium) das páginas do WMS v2 contra a app isolada.
import { test, expect, type Page } from '@playwright/test';

const EMAIL = 'e2e-test@machinefacturas.test';
const PASSWORD = 'TestPass123!';

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  // Dev server compila a página no primeiro acesso: esperar hidratação do formulário
  // antes de clicar, senão o submit pode ser nativo (recarrega /login).
  await page.waitForLoadState('networkidle');
  const entrar = page.getByRole('button', { name: 'Entrar' });
  await expect(entrar).toBeEnabled({ timeout: 30000 });
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await entrar.click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 45000 });
}

test.describe('WMS v2 - UI', () => {
  test('login real e página de stock renderizam', async ({ page }) => {
    await login(page);
    await page.goto('/stock');
    await expect(page.getByRole('heading', { name: 'Armazém e stock', exact: true })).toBeVisible();
    await expect(page.getByText('Produtos', { exact: true }).first()).toBeVisible();
  });

  test('devoluções: formulário e listagem dedicada visíveis', async ({ page }) => {
    await login(page);
    await page.goto('/stock/devolucoes');
    await expect(page.getByRole('heading', { name: 'Devoluções', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Registar devolução física', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Devoluções registadas', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Confirmar devolução/i })).toBeVisible();
  });

  test('consultas e ajustes carregam dados da API', async ({ page }) => {
    await login(page);
    await page.goto('/stock/consultas');
    await expect(page.getByRole('heading', { name: 'Movimentos e saldos', exact: true })).toBeVisible();
    await expect(page.getByText(/Saldos por produto/)).toBeVisible();

    await page.goto('/stock/ajustes');
    await expect(page.getByRole('heading', { name: 'Ajustes de inventário', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Registar ajuste/i })).toBeVisible();
  });

  test('compras, recepções, lotes e reservas carregam', async ({ page }) => {
    await login(page);

    await page.goto('/stock/compras');
    await expect(page.getByRole('heading', { name: 'Compras e recepções', exact: true })).toBeVisible();

    await page.goto('/stock/recepcoes');
    await expect(page.getByRole('heading', { name: 'Receções de mercadorias', exact: true })).toBeVisible();

    await page.goto('/stock/lotes');
    await expect(page.getByRole('heading', { name: 'Lotes e validades', exact: true })).toBeVisible();

    await page.goto('/stock/reservas');
    await expect(page.getByRole('heading', { name: 'Reservas de stock', exact: true })).toBeVisible();
  });

  test('raiz do dashboard continua acessível após login', async ({ page }) => {
    await login(page);
    await page.goto('/');
    await expect(page).not.toHaveURL(/\/login/);
  });
});
