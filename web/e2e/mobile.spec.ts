import { expect, seed, test } from './fixtures';

test.describe('mobile', () => {
  test('drawer menu opens, navigates, closes', async ({ loggedIn: page, user, request }) => {
    await seed(user, request);
    await page.goto('/');
    const menu = page.getByRole('complementary', { name: 'Menu principal' });

    await expect(menu).not.toBeInViewport();
    await page.getByRole('button', { name: 'Abrir menu' }).click();
    await expect(menu).toBeInViewport();
    await page.getByRole('button', { name: 'Fechar menu' }).click();
    await expect(menu).not.toBeInViewport();

    await page.getByRole('button', { name: 'Abrir menu' }).click();
    await menu.getByRole('link', { name: 'Transações' }).click();
    await expect(page).toHaveURL(/\/transacoes$/);
    await expect(menu).not.toBeInViewport(); // closes after navigating
    await expect(page.getByText(/Mostrando 1–25/)).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/mobile-transactions.png', fullPage: false });

    // No horizontal scroll on any page: the layout fits the phone width.
    for (const path of ['/', '/transacoes', '/contas', '/categorias']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }

    await page.goto('/');
    await expect(page.getByText('Fluxo mensal')).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'e2e/screenshots/mobile-dashboard.png', fullPage: true });
  });
});
