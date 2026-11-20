import { expect, test } from './fixtures';

test.describe('categories and rules', () => {
  test('search, create, duplicate name, edit, rules, delete', async ({ loggedIn: page }) => {
    await page.goto('/categorias');
    await expect(page.getByRole('article', { name: 'Categoria Alimentação' })).toBeVisible();

    // Search matches category names and rule patterns, ignoring accents.
    const search = page.getByRole('searchbox', { name: 'Buscar categoria' });
    await search.fill('saude');
    await expect(page.getByRole('article')).toHaveCount(1);
    await search.fill('netflix');
    await expect(page.getByRole('article')).toHaveText([/Assinaturas/]);
    await search.fill('');

    // Create.
    await page.getByRole('button', { name: 'Nova categoria' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nome').fill('Pets');
    await dialog.getByRole('button', { name: 'Criar categoria' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Categoria criada' })).toBeVisible();
    const pets = page.getByRole('article', { name: 'Categoria Pets' });
    await expect(pets).toContainText('Nenhuma regra');

    // Duplicate name -> 409 from the API, shown as a toast; dialog stays open.
    await page.getByRole('button', { name: 'Nova categoria' }).click();
    await dialog.getByLabel('Nome').fill('pets');
    await dialog.getByRole('button', { name: 'Criar categoria' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Já existe uma categoria chamada "pets"' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden(); // the page behind a modal is inert until it closes

    // Add and remove a rule.
    await pets.getByLabel('Nova regra para Pets').fill('petz');
    await pets.getByRole('button', { name: 'Adicionar regra em Pets' }).click();
    await expect(pets.getByText('petz')).toBeVisible();
    await pets.getByRole('button', { name: 'Remover regra petz' }).click();
    await expect(pets).toContainText('Nenhuma regra');

    // Edit: rename + mark as transfer.
    await page.getByRole('button', { name: 'Editar Pets' }).click();
    await expect(dialog.getByRole('heading', { name: 'Editar categoria' })).toBeVisible();
    await dialog.getByLabel('Nome').fill('Pet shop');
    await dialog.getByRole('checkbox', { name: /Transferência entre minhas contas/ }).check();
    await dialog.getByRole('button', { name: 'Salvar' }).click();
    const petShop = page.getByRole('article', { name: 'Categoria Pet shop' });
    await expect(petShop).toContainText('Transferência · fora dos totais');

    // Delete: cancel, then confirm.
    await page.getByRole('button', { name: 'Excluir Pet shop' }).click();
    await page.getByRole('dialog', { name: /Excluir "Pet shop"/ }).getByRole('button', { name: 'Cancelar' }).click();
    await expect(petShop).toBeVisible();
    await page.getByRole('button', { name: 'Excluir Pet shop' }).click();
    await page.getByRole('dialog', { name: /Excluir "Pet shop"/ }).getByRole('button', { name: 'Excluir categoria' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Categoria excluída' })).toBeVisible();
    await expect(petShop).toHaveCount(0);
  });
});
