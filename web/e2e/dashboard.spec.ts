import { expect, seed, test } from './fixtures';

test.describe('dashboard', () => {
  test('new user sees the onboarding empty state', async ({ loggedIn: page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Comece importando seu extrato' })).toBeVisible();
    await page.getByRole('link', { name: 'Importar extrato' }).click();
    await expect(page).toHaveURL(/\/contas$/);
  });

  test('period buttons, account filter and links', async ({ loggedIn: page, user, request }) => {
    await seed(user, request);
    await page.goto('/');

    const kpi = (label: string) => page.locator('.card', { hasText: label }).first().locator('p.tabular');
    await expect(kpi('Entradas')).toContainText('R$');
    const sixMonths = await kpi('Gastos').textContent();

    // Every period preset is clickable and becomes the pressed one.
    const periods = page.getByRole('group', { name: 'Período' });
    for (const label of ['Este mês', '3 meses', '12 meses', 'Todo período', '6 meses']) {
      await periods.getByRole('button', { name: label }).click();
      await expect(periods.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
    }
    await periods.getByRole('button', { name: 'Este mês' }).click();
    await expect(page.getByText('Entradas e gastos de este mês.')).toBeVisible();
    await expect(kpi('Gastos')).not.toHaveText(sixMonths!);
    await periods.getByRole('button', { name: '6 meses' }).click();
    await expect(kpi('Gastos')).toHaveText(sixMonths!);

    // Account filter: only the checking account.
    await page.getByRole('combobox', { name: 'Conta' }).selectOption({ label: 'Conta corrente' });
    await expect(kpi('Gastos')).not.toHaveText(sixMonths!);
    await page.getByRole('combobox', { name: 'Conta' }).selectOption({ label: 'Todas as contas' });
    await expect(kpi('Gastos')).toHaveText(sixMonths!);

    // Transfers (card bill payment) are excluded: 6 months of sample data spend R$ 26.265,21.
    await expect(kpi('Gastos')).toHaveText('R$ 26.265,21');

    // 9 categories: the 6 biggest plus one line with the rest, so the legend adds up to the total.
    await expect(page.getByRole('link', { name: /Outras \(3\)/ })).toBeVisible();

    // Category legend link opens the transactions filtered by that category.
    await page.getByRole('link', { name: /Moradia/ }).click();
    await expect(page).toHaveURL(/categoryId=\d+/);
    await expect(page.getByRole('combobox', { name: 'Categoria', exact: true })).toHaveValue(/\d+/);
    await expect(page.getByRole('cell', { name: /ALUGUEL/ }).first()).toBeVisible();

    await page.goBack();
    await page.getByRole('link', { name: 'Ver todas' }).click();
    await expect(page).toHaveURL(/\/transacoes$/);

    await page.goBack();
    await page.getByRole('link', { name: /sem categoria/ }).click();
    await expect(page).toHaveURL(/uncategorized=true/);
    await expect(page.getByRole('group', { name: 'Mostrar' }).getByRole('button', { name: /Sem categoria/ }))
      .toHaveAttribute('aria-pressed', 'true');
  });
});
