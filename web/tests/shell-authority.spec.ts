import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('SCHEDULE_API_KEY', 'synthetic-test-key');
  });
});

test('public /health proves only daemon liveness, not gateway delivery or valid credentials', async ({ page }) => {
  // Public health returns 200 OK
  await page.route('**/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  // Protected endpoint returns 401 Unauthorized for bad key
  await page.route('**/jobs/tags', (route) => route.fulfill({ status: 401, json: { detail: 'Chave x-api-key ausente ou inválida' } }));

  await page.goto('/contacts');

  // Trigger API configuration dialog
  await page.getByTitle('Configurações da API').first().click();
  await expect(page.getByRole('dialog', { name: 'Acesso à API' })).toBeVisible();

  // Test connection with bad key
  await page.locator('#input-api-key').fill('invalid-operator-key');
  await page.getByRole('button', { name: 'Testar Conexão' }).click();

  // Dialog must report daemon liveness but reject the invalid API key
  await expect(page.locator('#api-key-modal')).toContainText('HTTP 401');
  await expect(page.locator('#api-key-modal')).not.toContainText('202 Ready');
  await expect(page.locator('#api-key-modal')).not.toContainText('Gateway Connected');
  await expect(page.locator('#api-key-modal')).not.toContainText('Gateway connection verified');

  // Close dialog
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('#api-key-modal')).toHaveCount(0);
});

test('valid operator credentials confirm authentication without false gateway claims', async ({ page }) => {
  await page.route('**/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route('**/jobs/tags', (route) => route.fulfill({ json: { tags: ['alert', 'ops'] } }));

  await page.goto('/contacts');
  await page.getByTitle('Configurações da API').first().click();

  await page.locator('#input-api-key').fill('valid-test-key');
  await page.getByRole('button', { name: 'Testar Conexão' }).click();

  await expect(page.locator('#api-key-modal')).toContainText('autenticada com sucesso');
  await expect(page.locator('#api-key-modal')).not.toContainText('202 Ready');

  // Save credentials and verify announcement and persistence
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.locator('#api-key-modal')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Configurações salvas localmente no navegador.');
});

test('navigation and screen roots work cleanly across all views', async ({ page }) => {
  await page.route('**/health', (route) => route.request().resourceType() === 'fetch' ? route.fulfill({ json: { status: 'ok' } }) : route.continue());
  await page.route('**/contacts', (route) => route.request().resourceType() === 'fetch' ? route.fulfill({ json: { contacts: [] } }) : route.continue());
  await page.route('**/jobs*', (route) => route.request().resourceType() === 'fetch' ? route.fulfill({ json: { jobs: [] } }) : route.continue());
  await page.route('**/templates', (route) => route.request().resourceType() === 'fetch' ? route.fulfill({ json: { templates: [] } }) : route.continue());
  await page.route('**/jobs/runs*', (route) => route.request().resourceType() === 'fetch' ? route.fulfill({ json: { runs: [] } }) : route.continue());

  await page.goto('/');
  await expect(page.locator('#scr-contacts')).toBeVisible();
  await expect(page.locator('#nav-scr-contacts')).toHaveAttribute('aria-current', 'page');

  // Navigate to Jobs
  await page.locator('#nav-scr-jobs').click();
  await expect(page.locator('#scr-jobs')).toBeVisible();
  await expect(page).toHaveURL('/jobs');
  await expect(page.locator('#nav-scr-jobs')).toHaveAttribute('aria-current', 'page');

  // Navigate to Templates
  await page.locator('#nav-scr-templates').click();
  await expect(page.locator('#scr-templates')).toBeVisible();
  await expect(page).toHaveURL('/templates');
  await expect(page.locator('#nav-scr-templates')).toHaveAttribute('aria-current', 'page');

  // Navigate to History
  await page.locator('#nav-scr-history').click();
  await expect(page.locator('#scr-history')).toBeVisible();
  await expect(page).toHaveURL('/history');
  await expect(page.locator('#nav-scr-history')).toHaveAttribute('aria-current', 'page');

  // Navigate to Data
  await page.locator('#btn-open-backup-modal-sidebar').click();
  await expect(page.locator('#scr-data')).toBeVisible();
  await expect(page).toHaveURL('/data');

  // Back navigation restores previous route
  await page.goBack();
  await expect(page.locator('#scr-history')).toBeVisible();

  // Skip link moves focus to main content
  await page.locator('.shell-skip').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('theme controls update data-theme and persist state', async ({ page }) => {
  await page.route('**/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.goto('/contacts');

  await page.locator('#theme-btn-dark').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#theme-btn-dark')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#theme-btn-light').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('#theme-btn-light')).toHaveAttribute('aria-pressed', 'true');
});
