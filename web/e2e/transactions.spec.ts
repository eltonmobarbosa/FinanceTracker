import { expect, seed, test } from './fixtures';

test.describe('transactions', () => {
  test.beforeEach(async ({ loggedIn: page, user, request }) => {
    await seed(user, request);
    await page.goto('/transacoes');
    await expect(page.getByText('Mostrando 1–25 de 175')).toBeVisible();
  });

  test('search, filters, tabs, clear and pagination', async ({ loggedIn: page }) => {
    const summary = page.getByText(/^Mostrando/);

    await page.getByRole('searchbox', { name: 'Buscar' }).fill('netflix');
    await expect(summary).toHaveText('Mostrando 1–6 de 6'); // debounced, then 6 months of Netflix
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(summary).toHaveText('Mostrando 1–25 de 175');
    await expect(page.getByRole('searchbox', { name: 'Buscar' })).toHaveValue('');

    await page.getByRole('combobox', { name: 'Conta' }).selectOption({ label: 'Conta corrente' });
    await expect(summary).toHaveText('Mostrando 1–25 de 58');
    await page.getByRole('combobox', { name: 'Categoria', exact: true }).selectOption({ label: 'Salário' });
    await expect(summary).toHaveText('Mostrando 1–6 de 6');
    await page.getByRole('combobox', { name: 'Período' }).selectOption({ label: '3 meses' });
    await expect(summary).toHaveText('Mostrando 1–3 de 3');
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(summary).toHaveText('Mostrando 1–25 de 175');

    const tabs = page.getByRole('group', { name: 'Mostrar' });
    await tabs.getByRole('button', { name: /Sem categoria/ }).click();
    await expect(summary).toHaveText('Mostrando 1–11 de 11');
    await tabs.getByRole('button', { name: 'Todas' }).click();
    await expect(summary).toHaveText('Mostrando 1–25 de 175');

    await page.getByRole('button', { name: 'Próxima página' }).click();
    await expect(summary).toHaveText('Mostrando 26–50 de 175');
    await page.getByRole('button', { name: 'Página anterior' }).click();
    await expect(summary).toHaveText('Mostrando 1–25 de 175');
    await expect(page.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
  });

  test('categorize with a new rule also categorizes the similar ones', async ({ loggedIn: page }) => {
    // Samples go up to Nov 19 and this Pix happens on the 20th: Jun..Oct = 5.
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('pix no');
    await expect(page.getByText('Mostrando 1–5 de 5')).toBeVisible();

    await page.getByRole('combobox', { name: /Categoria de Pix no Crédito/ }).first().selectOption({ label: 'Compras' });
    const dialog = page.getByRole('dialog', { name: 'Categorizar transação' });
    await expect(dialog).toBeVisible();
    // A rule is opt-in: fixing one line must not change future imports by accident.
    await expect(dialog.getByRole('checkbox', { name: /Criar regra automática/ })).not.toBeChecked();
    await dialog.getByRole('checkbox', { name: /Criar regra automática/ }).check();
    await expect(dialog.getByLabel('Quando a descrição contiver')).toHaveValue('Pix no Crédito - Joao Exemplo');
    await expect(dialog.getByText(/Cerca de 4 outra/)).toBeVisible(); // live preview

    await dialog.getByRole('button', { name: 'Salvar e criar regra' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Regra criada em Compras' })).toContainText('Mais 4');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('combobox', { name: /Categoria de Pix no Crédito/ }).first()).toHaveValue(/\d/);

    // The rule now shows on the categories page.
    await page.goto('/categorias');
    await expect(page.getByRole('article', { name: 'Categoria Compras' })).toContainText('Pix no Crédito - Joao Exemplo');
  });

  test('categorize only one, cancel, Esc and remove category', async ({ loggedIn: page }) => {
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('pix recebido');
    await expect(page.getByText('Mostrando 1–6 de 6')).toBeVisible();
    const firstSelect = page.getByRole('combobox', { name: /Categoria de PIX RECEBIDO/ }).first();
    const dialog = page.getByRole('dialog', { name: 'Categorizar transação' });

    // Cancel button: nothing saved, the select goes back to "Sem categoria".
    await firstSelect.selectOption({ label: 'Salário' });
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
    await expect(firstSelect.locator('option:checked')).toHaveText('Sem categoria');

    // Esc also cancels.
    await firstSelect.selectOption({ label: 'Salário' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(firstSelect.locator('option:checked')).toHaveText('Sem categoria');

    // "Only this one": uncheck the rule.
    await firstSelect.selectOption({ label: 'Salário' });
    await expect(dialog.getByLabel('Quando a descrição contiver')).toBeHidden();
    await dialog.getByRole('combobox', { name: 'Categoria' }).selectOption({ label: 'Compras' });
    await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Movida para Compras' })).toBeVisible();
    await expect(firstSelect.locator('option:checked')).toHaveText('Compras');
    await expect(page.getByRole('combobox', { name: /Categoria de PIX RECEBIDO/ }).nth(1).locator('option:checked')).toHaveText('Sem categoria');

    // Back to "Sem categoria" directly from the row.
    await firstSelect.selectOption({ label: 'Sem categoria' });
    await expect(page.getByRole('status').filter({ hasText: 'Categoria removida' })).toBeVisible();
  });
});

test('categorizing the only row of the last page goes back to the previous page', async ({ loggedIn: page, user, request }) => {
  const headers = { Authorization: `Bearer ${user.token}` };
  const account = await (await request.post('/api/accounts', { headers, data: { name: 'Cartão', type: 'CreditCard' } })).json();
  const lines = Array.from({ length: 26 }, (_, i) => `2026-10-01,Zzz ${String.fromCharCode(97 + i)},"1,00"`);
  const upload = await request.post(`/api/accounts/${account.id}/imports`, {
    headers,
    multipart: { file: { name: 'f.csv', mimeType: 'text/csv', buffer: Buffer.from(`date,title,amount\n${lines.join('\n')}`) } },
  });
  expect(upload.ok()).toBeTruthy();

  await page.goto('/transacoes?uncategorized=true');
  await page.getByRole('button', { name: 'Próxima página' }).click();
  const summary = page.getByText(/^Mostrando/);
  await expect(summary).toHaveText('Mostrando 26–26 de 26');

  await page.getByRole('combobox', { name: /Categoria de Zzz/ }).selectOption({ label: 'Compras' });
  await page.getByRole('dialog', { name: 'Categorizar transação' }).getByRole('button', { name: 'Salvar', exact: true }).click();

  await expect(summary).toHaveText('Mostrando 1–25 de 25');
});
