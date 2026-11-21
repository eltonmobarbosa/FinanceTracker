import { readFileSync } from 'node:fs';
import { CARD_CSV, CHECKING_OFX, PASSWORD, expect, test } from './fixtures';

test.describe('accounts and import', () => {
  test('create accounts, import, re-import, unsupported file, drag and drop, delete', async ({ loggedIn: page }) => {
    await page.goto('/contas');

    // Empty state button opens the dialog; Cancel closes it.
    await page.getByRole('button', { name: 'Criar primeira conta' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nova conta' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Criar conta' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();

    // Header button + card type (default).
    await page.getByRole('button', { name: 'Nova conta' }).click();
    await dialog.getByLabel('Nome').fill('Nubank cartão');
    await dialog.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Conta criada' })).toBeVisible();
    const card = page.getByRole('article', { name: 'Nubank cartão' });
    await expect(card).toContainText('Cartão de crédito · nenhum extrato importado');

    // Checking account through the radio option.
    await page.getByRole('button', { name: 'Nova conta' }).click();
    await dialog.getByLabel('Nome').fill('Conta corrente');
    await dialog.getByText('Conta corrente', { exact: true }).click();
    await dialog.getByRole('button', { name: 'Criar conta' }).click();
    const checking = page.getByRole('article', { name: 'Conta corrente' });
    await expect(checking).toContainText('Conta corrente · nenhum extrato importado');

    // Import CSV with the file picker.
    await card.getByLabel('Arquivo de extrato para Nubank cartão').setInputFiles(CARD_CSV);
    const result = card.getByRole('status');
    await expect(result).toContainText('Importação concluída');
    await expect(result.locator('dd')).toHaveText(['117', '117', '0', '112']);
    await expect(card).toContainText('117 transações · até 19 de nov. de 2026');

    // Same file again: everything is a duplicate.
    await card.getByLabel('Arquivo de extrato para Nubank cartão').setInputFiles(CARD_CSV);
    await expect(result.locator('dd')).toHaveText(['117', '0', '117', '0']);

    // Unsupported extension is rejected before uploading.
    await card.getByLabel('Arquivo de extrato para Nubank cartão')
      .setInputFiles({ name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') });
    await expect(page.getByRole('status').filter({ hasText: 'Formato não suportado' })).toBeVisible();

    // Drag and drop the OFX onto the checking account.
    const dataTransfer = await page.evaluateHandle((content) => {
      const dt = new DataTransfer();
      dt.items.add(new File([Uint8Array.from(atob(content), (c) => c.charCodeAt(0))], 'extrato.ofx'));
      return dt;
    }, readFileSync(CHECKING_OFX).toString('base64'));
    await checking.locator('label').filter({ hasText: 'arraste o arquivo' }).dispatchEvent('drop', { dataTransfer });
    await expect(checking.getByRole('status').locator('dd')).toHaveText(['58', '58', '0', '52']);

    // "Categorize the rest" link.
    await checking.getByRole('link', { name: 'Categorizar 6 restante(s)' }).click();
    await expect(page).toHaveURL(/uncategorized=true/);
    await page.goBack();

    // Delete: Cancel keeps the account, confirm removes it.
    await page.getByRole('button', { name: 'Excluir conta Conta corrente' }).click();
    const confirm = page.getByRole('dialog', { name: 'Excluir "Conta corrente"?' });
    await confirm.getByRole('button', { name: 'Cancelar' }).click();
    await expect(confirm).toBeHidden();
    await expect(checking).toBeVisible();

    await page.getByRole('button', { name: 'Excluir conta Conta corrente' }).click();
    await confirm.getByRole('button', { name: 'Excluir conta' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Conta excluída' })).toBeVisible();
    await expect(checking).toHaveCount(0);
  });

  test('several files at once, undo, and delete profile', async ({ loggedIn: page, user, request }) => {
    const headers = { Authorization: `Bearer ${user.token}` };
    await request.post('/api/accounts', { headers, data: { name: 'Cartão', type: 'CreditCard' } });
    await page.goto('/contas');
    const card = page.getByRole('article', { name: 'Cartão' });
    const csv = (name: string, title: string) => ({
      name, mimeType: 'text/csv', buffer: Buffer.from(`date,title,amount\n2026-10-01,${title},"10,00"`),
    });

    await card.getByLabel('Arquivo de extrato para Cartão').setInputFiles([csv('a.csv', 'Loja A'), csv('b.csv', 'Loja B')]);
    await expect(card.getByRole('status').locator('dd')).toHaveText(['2', '2', '0', '0']);
    await expect(card).toContainText('2 transações');

    await card.getByRole('button', { name: 'Desfazer importação' }).click();
    await page.getByRole('dialog', { name: 'Desfazer importação?' }).getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Importação desfeita' })).toBeVisible();
    await expect(card).toContainText('nenhum extrato importado');

    // Wrong password keeps the session; the right one deletes everything and logs out.
    await page.getByRole('button', { name: 'Excluir meu perfil' }).click();
    const dialog = page.getByRole('dialog', { name: 'Excluir meu perfil?' });
    await dialog.getByLabel('Confirme sua senha').fill('senha-errada-1');
    await dialog.getByRole('button', { name: 'Excluir definitivamente' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Senha incorreta' })).toBeVisible();
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Confirme sua senha').fill(PASSWORD);
    await dialog.getByRole('button', { name: 'Excluir definitivamente' }).click();
    await expect(page).toHaveURL(/\/login/);
    const login = await request.post('/api/auth/login', { data: { email: user.email, password: PASSWORD } });
    expect(login.status()).toBe(401);
  });
});
