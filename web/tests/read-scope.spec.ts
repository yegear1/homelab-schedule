import { expect, test } from './fixtures';

test('agenda reads and exports the same authenticated server scope; failed CSV creates no download', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('SCHEDULE_API_KEY', 'synthetic-key'));
  const reads: string[] = [];
  let exported = '';
  await page.route('**/jobs?*', async (route) => {
    reads.push(route.request().url());
    expect(route.request().headers()['x-api-key']).toBe('synthetic-key');
    await route.fulfill({ contentType: 'application/json', body: '{"jobs":[]}' });
  });
  await page.route('**/jobs/export.csv?*', async (route) => {
    exported = route.request().url();
    expect(route.request().headers()['x-api-key']).toBe('synthetic-key');
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"unavailable"}' });
  });
  await page.goto('/jobs');
  await page.getByPlaceholder('Buscar título ou conteúdo...').fill('alpha');
  await expect.poll(() => reads.some((url) => new URL(url).searchParams.get('query') === 'alpha')).toBe(true);
  await expect(page.getByTitle('Export CSV (authenticated GET /jobs/export.csv)')).toBeEnabled();
  let downloads = 0;
  page.on('download', () => { downloads += 1; });
  await page.getByTitle('Export CSV (authenticated GET /jobs/export.csv)').click();
  await expect(page.getByText(/Falha ao exportar CSV/)).toBeVisible();
  expect(new URL(exported).searchParams.get('query')).toBe('alpha');
  expect(new URL(exported).searchParams.has('limit')).toBe(false);
  expect(downloads).toBe(0);
});

test('status tab sends the documented server filter and bounded limit', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('SCHEDULE_API_KEY', 'synthetic-key'));
  const reads: URL[] = [];
  await page.route('**/jobs?*', async (route) => {
    reads.push(new URL(route.request().url()));
    await route.fulfill({ contentType: 'application/json', body: '{"jobs":[]}' });
  });
  await page.goto('/jobs');
  await page.getByRole('button', { name: /^Upcoming/ }).click();
  await expect.poll(() => reads.some((url) => url.searchParams.get('status') === 'upcoming')).toBe(true);
  expect(reads.every((url) => url.searchParams.get('limit') === '50')).toBe(true);
  await expect(page.getByText(/até 50/)).toBeVisible();
});
