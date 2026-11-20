import { readFileSync } from 'node:fs';
import { CARD_CSV, CHECKING_OFX, expect, test } from './fixtures';

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
});
