import { expect, PASSWORD, test } from './fixtures';

test.describe('authentication', () => {
  test('logged-out visitor is sent to the login page', async ({ page }) => {
    await page.goto('/transacoes');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible();
  });

  test('tabs switch between login and sign-up, and the eye button shows the password', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Criar conta' }).first().click();
    await expect(page.getByRole('heading', { name: 'Crie sua conta' })).toBeVisible();
    await page.getByRole('group').getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible();

    const password = page.getByLabel('Senha', { exact: true });
    await password.fill('segredo123');
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Mostrar senha' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Ocultar senha' }).click();
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('submitting an empty form shows field errors', async ({ page }) => {
    await page.goto('/login');
    await page.locator('form button[type=submit]').click();
    await expect(page.getByText('Informe um e-mail válido.')).toBeVisible();
    await expect(page.getByText('Mínimo de 8 caracteres.')).toBeVisible();
  });

  test('sign up, log out, wrong password, log in', async ({ page }) => {
    const email = `ui-${Date.now()}@test.local`;
    await page.goto('/login');
    await page.getByRole('group').getByRole('button', { name: 'Criar conta' }).click();
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
    await page.locator('form button[type=submit]').click();

    // New users land on the accounts page, with the empty state.
    await expect(page).toHaveURL(/\/contas$/);
    await expect(page.getByText('Nenhuma conta ainda')).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Menu principal' })).toContainText(email);

    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha', { exact: true }).fill('senha-errada-1');
    await page.locator('form button[type=submit]').click();
    await expect(page.getByRole('status').filter({ hasText: 'E-mail ou senha inválidos.' })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar notificação' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'E-mail ou senha inválidos.' })).toHaveCount(0);

    await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
    await page.locator('form button[type=submit]').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
  });

  test('theme toggle switches to dark, survives a reload, and switches back', async ({ loggedIn: page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('financetracker.theme', 'light'));
    await page.reload();
    await page.getByRole('button', { name: 'Usar tema escuro' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.reload(); // the choice is remembered
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.getByRole('button', { name: 'Usar tema claro' }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('sidebar links navigate to every page', async ({ loggedIn: page }) => {
    await page.goto('/');
    const nav = page.getByRole('complementary', { name: 'Menu principal' });
    for (const [link, heading, url] of [
      ['Transações', 'Transações', /\/transacoes$/],
      ['Contas e importação', 'Contas e importação', /\/contas$/],
      ['Categorias e regras', 'Categorias e regras', /\/categorias$/],
      ['Visão geral', 'Visão geral', /\/$/],
    ] as const) {
      await nav.getByRole('link', { name: link }).click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(nav.getByRole('link', { name: link })).toHaveAttribute('aria-current', 'page');
    }
  });
});
