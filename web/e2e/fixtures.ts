import { test as base, expect, Page } from '@playwright/test';
import { resolve } from 'node:path';

export const SAMPLES = resolve(__dirname, '../../samples');
export const CARD_CSV = resolve(SAMPLES, 'nubank-fatura-exemplo.csv');
export const CHECKING_OFX = resolve(SAMPLES, 'conta-corrente-exemplo.ofx');
export const PASSWORD = 'Senha-forte-123';

export interface TestUser {
  email: string;
  token: string;
}

/**
 * Each test gets a brand-new user (registered through the API, already logged in in the browser),
 * so tests never share data and can run in parallel.
 */
export const test = base.extend<{ user: TestUser; loggedIn: Page }>({
  user: async ({ request }, use) => {
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
    const response = await request.post('/api/auth/register', { data: { email, password: PASSWORD } });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    await use({ email, token: body.accessToken });
  },

  loggedIn: async ({ page, request, user }, use) => {
    const session = await (await request.post('/api/auth/login', { data: { email: user.email, password: PASSWORD } })).json();
    await page.addInitScript((s) => localStorage.setItem('financetracker.session', s), JSON.stringify(session));
    await use(page);
  },
});

/** Creates an account and imports a file through the API (fast setup for tests that are not about importing). */
export async function seed(user: TestUser, request: import('@playwright/test').APIRequestContext) {
  const headers = { Authorization: `Bearer ${user.token}` };
  const create = async (name: string, type: string) =>
    (await (await request.post('/api/accounts', { headers, data: { name, type } })).json()).id as number;
  const upload = async (accountId: number, file: string, name: string, mimeType: string) => {
    const { readFileSync } = await import('node:fs');
    const r = await request.post(`/api/accounts/${accountId}/imports`, {
      headers, multipart: { file: { name, mimeType, buffer: readFileSync(file) } },
    });
    expect(r.ok()).toBeTruthy();
  };

  const card = await create('Nubank cartão', 'CreditCard');
  const checking = await create('Conta corrente', 'Checking');
  await upload(card, CARD_CSV, 'nubank.csv', 'text/csv');
  await upload(checking, CHECKING_OFX, 'extrato.ofx', 'application/x-ofx');
  return { card, checking };
}

export { expect };
