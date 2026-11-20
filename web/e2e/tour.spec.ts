import { expect, seed, test } from './fixtures';

/** Screenshots of every screen (light and dark) — used for visual review and the README. */
test.describe('visual tour', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`all pages in ${theme} theme`, async ({ loggedIn: page, user, request }) => {
      await seed(user, request);
      await page.addInitScript((t) => localStorage.setItem('financetracker.theme', t), theme);
      const shot = (name: string) => page.screenshot({ path: `e2e/screenshots/${theme}-${name}.png`, fullPage: true });

      await page.goto('/');
      await expect(page.getByText('Fluxo mensal')).toBeVisible();
      await page.waitForTimeout(800); // chart animation
      await shot('dashboard');

      await page.goto('/transacoes');
      await expect(page.getByText(/Mostrando/)).toBeVisible();
      await shot('transactions');

      await page.getByRole('searchbox', { name: 'Buscar' }).fill('pix no');
      await expect(page.getByText(/Mostrando 1–\d+ de \d+/)).toBeVisible();
      await expect(page.getByRole('combobox', { name: /Categoria de Pix no Crédito/ }).first()).toBeVisible();
      await page.getByRole('combobox', { name: /Categoria de Pix no Crédito/ }).first().selectOption({ label: 'Compras' });
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `e2e/screenshots/${theme}-categorize-dialog.png` });
      await page.keyboard.press('Escape');

      await page.goto('/contas');
      await expect(page.getByRole('article').first()).toBeVisible();
      await shot('accounts');

      await page.goto('/categorias');
      await expect(page.getByRole('article').first()).toBeVisible();
      await shot('categories');

      await page.evaluate(() => localStorage.removeItem('financetracker.session'));
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible();
      await shot('login');
    });
  }
});
