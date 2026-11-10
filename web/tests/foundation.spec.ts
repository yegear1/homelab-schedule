import { test, expect } from './fixtures';

test('absent credentials show an auth error without sending a fallback', async ({ page }) => {
  const request = page.waitForRequest((r) => r.url().endsWith('/contacts') && !r.isNavigationRequest());
  await page.goto('/contacts');
  expect((await request).headers()['x-api-key']).toBeUndefined();
  await expect(page.locator('#scr-contacts')).toHaveAttribute('data-state', 'error');
  await expect(page.getByText('Configuração pendente')).toBeVisible();
});

test('saved access settings survive reload and authorize the local API', async ({ page }) => {
  await page.goto('/contacts');
  await page.getByTitle('Configurações da API', { exact: true }).click();
  await page.locator('#input-api-key').fill('synthetic-test-key');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  const request = page.waitForRequest((r) => r.url().endsWith('/contacts') && !r.isNavigationRequest());
  await page.reload();
  expect((await request).headers()['x-api-key']).toBe('synthetic-test-key');
  await expect(page.locator('#contact-rows-container')).toContainText('Test Contact');
  await page.getByTitle('Configurações da API', { exact: true }).click();
  await expect(page.locator('#input-api-key')).toHaveValue('synthetic-test-key');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByTitle('Configurações da API', { exact: true }).click();
  await page.locator('#input-api-key').fill('');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Configuração pendente')).toBeVisible();
});

test('successful HTML fallback is shown as a JSON error', async ({ page }) => {
  await page.route('**/contacts', (route) => route.request().isNavigationRequest()
    ? route.fallback()
    : route.fulfill({ contentType: 'text/html', body: '<html>unexpected</html>' }));
  await page.goto('/contacts');
  await expect(page.locator('#scr-contacts')).toHaveAttribute('data-state', 'error');
  await expect(page.getByText(/Resposta JSON inválida/)).toBeVisible();
});

test('all API prefixes reach the configured local backend', async ({ request }) => {
  for (const path of ['/contacts', '/jobs', '/templates', '/health', '/backup/integrity']) {
    const response = await request.get(path, { headers: { 'x-api-key': 'synthetic-test-key' } });
    expect(response.ok(), path).toBeTruthy();
    expect(response.headers()['content-type']).toContain('application/json');
  }
  for (const path of ['/routines/reload', '/housekeeping/purge']) {
    expect((await request.post(path, { headers: { 'x-api-key': 'synthetic-test-key' } })).ok()).toBeTruthy();
  }
});

for (const path of ['/contacts', '/contacts/contact-test', '/templates', '/jobs']) {
  test(`existing screen renders on direct navigation: ${path}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('SCHEDULE_API_KEY', 'synthetic-test-key'));
    await page.goto(path);
    const root = path.includes('contact-test') ? '#scr-contact' : `#scr-${path.slice(1)}`;
    await expect(page.locator(root)).toHaveAttribute('data-state', 'ready');
    await expect(page.locator('main')).toBeVisible();
  });
}

for (const theme of ['light', 'dark']) {
  test(`theme color and alpha utilities resolve: ${theme}`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('homelab_theme', value), theme);
    await page.goto('/contacts');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const colors = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.className = 'bg-primary/10 text-foreground p-3 rounded-xl';
      document.body.appendChild(probe);
      const style = getComputedStyle(probe);
      const result = { background: style.backgroundColor, text: style.color,
        padding: style.paddingTop, radius: style.borderTopLeftRadius };
      probe.remove();
      return result;
    });
    expect(colors.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(colors.background).toMatch(/0\.1\)|10%\)/);
    const expectedRgb = theme === 'light' ? 'rgb(29, 29, 31)' : 'rgb(245, 245, 247)';
    const expectedOklch = theme === 'light' ? 'oklch(0.145 0.015 240)' : 'oklch(0.96 0.005 240)';
    expect([expectedRgb, expectedOklch]).toContain(colors.text);
    expect(colors.padding).toBe('12px');
    expect(colors.radius).toBe('12px');
  });
}
