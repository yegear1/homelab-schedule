import { expect, test } from './fixtures';

test('contact read failure shows an error without example records and can retry', async ({ page }) => {
  let fail = true;
  await page.route('**/contacts', async (route) => {
    if (route.request().isNavigationRequest()) return route.fallback();
    if (fail) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"detail":"Unauthorized"}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"contacts":[{"id":"real-1","name":"Real Contact","phone":"123"}]}' });
  });
  await page.goto('/contacts');
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar contatos');
  await expect(page.getByText('Real Contact')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByText('Real Contact').first()).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('failed refresh labels previously loaded contacts as stale', async ({ page }) => {
  let fail = false;
  await page.route('**/contacts', async (route) => {
    if (route.request().isNavigationRequest()) return route.fallback();
    if (fail) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"Unavailable"}' });
    return route.fulfill({ contentType: 'application/json', body: '{"contacts":[{"id":"real-1","name":"Real Contact","phone":"123"}]}' });
  });
  await page.goto('/contacts');
  await expect(page.getByText('Real Contact').first()).toBeVisible();
  fail = true;
  await page.evaluate(() => { history.pushState({}, '', '/templates'); dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.getByText('Message Templates').first()).toBeVisible();
  await page.evaluate(() => { history.pushState({}, '', '/contacts'); dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.getByRole('alert')).toContainText('podem estar desatualizados');
  await expect(page.getByText('Real Contact').first()).toBeVisible();
});

test('older contact response cannot overwrite a newer read', async ({ page }) => {
  let count = 0;
  let release: (() => void) | undefined;
  const firstHeld = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/contacts', async (route) => {
    if (route.request().isNavigationRequest()) return route.fallback();
    count += 1;
    const current = count;
    if (current === 1) await firstHeld;
    const name = current === 1 ? 'Older Contact' : 'Newer Contact';
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ contacts: [{ id: 'one', name, phone: '123' }] }) });
  });
  await page.goto('/contacts');
  await expect.poll(() => count).toBe(1);
  await page.evaluate(() => { history.pushState({}, '', '/templates'); dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.getByText('Message Templates').first()).toBeVisible();
  await page.evaluate(() => { history.pushState({}, '', '/contacts'); dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.getByText('Newer Contact').first()).toBeVisible();
  const olderResponse = page.waitForResponse((response) => response.url().endsWith('/contacts') && response.request().method() === 'GET');
  release?.();
  await olderResponse;
  await expect(page.getByText('Older Contact')).toHaveCount(0);
  await expect(page.getByText('Newer Contact').first()).toBeVisible();
});

for (const [path, label] of [['/jobs', 'agendamentos'], ['/templates', 'modelos']] as const) {
  test(`${path} reports failed initial read rather than fixture data`, async ({ page }) => {
    await page.route(`**${path}*`, async (route) => {
      if (route.request().isNavigationRequest() || new URL(route.request().url()).pathname !== path) return route.fallback();
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"Unavailable"}' });
    });
    await page.goto(path);
    await expect(page.getByRole('alert').filter({ hasText: `Não foi possível carregar ${label}` })).toBeVisible();
    await expect(page.getByText('Daily Morning Greeting')).toHaveCount(0);
  });
}
