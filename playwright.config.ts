import { defineConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

function readE2eEnv(): Record<string, string> {
  try {
    const file = path.join(__dirname, '.env.e2e.local');
    const text = fs.readFileSync(file, 'utf8');
    const env: Record<string, string> = {};
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) env[match[1]] = match[2].trim().replace(/^"|"$/g, '');
    }
    return env;
  } catch {
    return {};
  }
}

const APP_URL = process.env.APP_URL || 'http://localhost:3002';

export default defineConfig({
  testDir: './e2e',
  timeout: 180000,
  expect: { timeout: 20000 },
  // Dev server (next dev) compila rotas on-demand; correr em série evita
  // que duas compilações concorrentes esgotem o timeout de cada teste.
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: APP_URL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } },
    { name: 'mobile-chromium', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'npx next dev --webpack -p 3002',
    url: `${APP_URL}/api/auth/csrf`,
    reuseExistingServer: true,
    timeout: 180000,
    env: { ...readE2eEnv(), NEXTAUTH_URL: APP_URL },
  },
});
