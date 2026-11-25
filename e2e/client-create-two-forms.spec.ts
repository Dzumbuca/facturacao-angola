// Regression tests: criação de cliente através de formulários reais no browser
// Cobre: (1) Directório da empresa → Novo cliente, (2) Facturas → Cadastro rápido → Novo cliente
import { test, expect, type Page } from '@playwright/test';

const EMAIL = 'e2e-test@machinefacturas.test';
const PASSWORD = 'TestPass123!';

async function loginViaApi(page: Page) {
  // Authenticate via NextAuth credentials API to obtain session cookie
  const res = await page.request.post('http://localhost:3002/api/auth/signin/credentials', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    form: {
      email: EMAIL,
      password: PASSWORD,
      callbackUrl: '/',
    },
  });
  expect(res.status()).toBe(200);
  // Extract session cookie from response and set it on the browser context
  const setCookie = res.headers()['set-cookie'];
  if (setCookie) {
    const cookieString = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
    const match = cookieString.match(/authjs\.session-token=([^;]+)/);
    if (match) {
      await page.context().addCookies([{
        name: 'authjs.session-token',
        value: match[1],
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      }]);
    }
  }
}

function captureNetwork(page: Page) {
  const events: Array<{
    url: string;
    method: string;
    status?: number;
    requestPayload?: any;
    responseBody?: any;
  }> = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/customers')) {
      events.push({
        url: req.url(),
        method: req.method(),
        requestPayload: req.postDataJSON?.() ?? null,
      });
    }
  });
  page.on('response', async (res) => {
    if (res.url().includes('/api/customers')) {
      const event = events.find((e) => e.url === res.url() && e.method === res.request().method());
      if (event) {
        event.status = res.status();
        try {
          event.responseBody = await res.json();
        } catch {
          event.responseBody = await res.text();
        }
      }
    }
  });
  return events;
}

function captureConsole(page: Page) {
  const errors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  return { errors, pageErrors };
}

test('criação de cliente via Directório da empresa (formulário real)', async ({ page }) => {
  const { errors, pageErrors } = captureConsole(page);
  const networkEvents = captureNetwork(page);

  await loginViaApi(page);
  await page.goto('/customers', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Verify we're authenticated (not redirected to login)
  expect(page.url()).not.toContain('/login');

  const novoCliente = page.getByRole('button', { name: 'Novo Cliente' });
  await expect(novoCliente).toBeEnabled();
  await novoCliente.click();

  const dialog = page.getByRole('dialog', { name: /Novo cliente/ });
  await expect(dialog).toBeVisible();

  const timestamp = Date.now();
  await page.fill('#customer-name', `Cliente Diretório ${timestamp}`);
  await page.fill('#customer-nif', `500${timestamp % 1000000}`);
  await page.fill('#customer-email', `cliente${timestamp}@browser.ao`);
  await page.fill('#customer-address', 'Rua de Teste, Luanda');

  const guardar = page.getByRole('button', { name: 'Guardar cliente' });
  await expect(guardar).toBeEnabled();
  await guardar.click();

  await page.waitForTimeout(3000);

  const notice = page.getByRole('status');
  const error = page.getByRole('alert');
  const success = await notice.isVisible() ? await notice.textContent() : null;
  const errMsg = await error.isVisible() ? await error.textContent() : null;

  console.log('=== DIRETÓRIO DA EMPRESA ===');
  console.log('Sucesso:', success);
  console.log('Erro:', errMsg);
  console.log('Erros de consola:', errors);
  console.log('Erros de página:', pageErrors);
  console.log('Eventos de rede:', JSON.stringify(networkEvents, null, 2));

  expect(errors.filter(e => !e.includes('Decimal') && !e.includes('Only plain objects')).length).toBe(0);
  expect(pageErrors.length).toBe(0);
  expect(success).toContain('criado');
  expect(errMsg === null || errMsg === undefined || errMsg === '').toBe(true);

  const postReq = networkEvents.find((e) => e.method === 'POST');
  expect(postReq).toBeDefined();
  expect(postReq!.status).toBe(200);
  expect(postReq!.responseBody).toBeDefined();
  expect(postReq!.responseBody).toHaveProperty('id');
  expect(postReq!.responseBody.name).toBe(`Cliente Diretório ${timestamp}`);
});

test('criação de cliente via Factura → Cadastro rápido (formulário real)', async ({ page }) => {
  const { errors, pageErrors } = captureConsole(page);
  const networkEvents = captureNetwork(page);

  await loginViaApi(page);
  await page.goto('/invoices/new', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Verify we're authenticated
  expect(page.url()).not.toContain('/login');

  await page.fill('#customerName', `Cliente Factura ${Date.now()}`);
  await page.waitForTimeout(500);

  const criarNovo = page.getByRole('button', { name: /Criar novo cliente/ });
  await expect(criarNovo).toBeVisible();
  await criarNovo.click();

  const dialog = page.getByRole('dialog', { name: /Novo cliente/ });
  await expect(dialog).toBeVisible();

  const timestamp = Date.now();
  await page.fill('#invoice-new-customer-name', `Cliente Factura ${timestamp}`);
  await page.fill('#invoice-new-customer-nif', `501${timestamp % 1000000}`);
  await page.fill('#invoice-new-customer-email', `cliente${timestamp}@factura.ao`);
  await page.fill('#invoice-new-customer-address', 'Rua da Factura, Luanda');

  const guardar = page.getByRole('button', { name: 'Guardar e seleccionar' });
  await expect(guardar).toBeEnabled();
  await guardar.click();

  await page.waitForTimeout(3000);

  const error = page.getByRole('alert');
  const errMsg = await error.isVisible() ? await error.textContent() : null;

  const customerNameInput = page.locator('#customerName');
  const selectedName = await customerNameInput.inputValue();

  console.log('=== FACTURA → CADASTRO RÁPIDO ===');
  console.log('Erro:', errMsg);
  console.log('Cliente selecionado:', selectedName);
  console.log('Erros de consola:', errors);
  console.log('Erros de página:', pageErrors);
  console.log('Eventos de rede:', JSON.stringify(networkEvents, null, 2));

  expect(errors.filter(e => !e.includes('Decimal') && !e.includes('Only plain objects')).length).toBe(0);
  expect(pageErrors.length).toBe(0);
  expect(errMsg === null || errMsg === undefined || errMsg === '').toBe(true);
  expect(selectedName).toContain(`Cliente Factura ${timestamp}`);

  const postReq = networkEvents.find((e) => e.method === 'POST');
  expect(postReq).toBeDefined();
  expect(postReq!.status).toBe(200);
  expect(postReq!.responseBody).toBeDefined();
  expect(postReq!.responseBody).toHaveProperty('id');
});
