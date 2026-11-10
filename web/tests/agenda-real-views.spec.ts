import { expect, test } from './fixtures';

const job = (id: string, title: string, next: string) => ({
  id, title, to: '123', target_number: '123', kind: 'once', run_at: next, cron_expr: null,
  enabled: true, source: 'sqlite', status: 'scheduled', next_run_at: next, last_run_at: null,
  last_status: null, created_by: null, template_id: null, group_id: null, tags: [], run_count: 0,
});
const runs = [{ id: 'r1', job_id: 'j1', ran_at: '2024-02-29T12:00:00Z', trigger: 'schedule', status: 'error', status_code: 500, duration_ms: 42, error_message: 'failed' }];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('SCHEDULE_API_KEY', 'synthetic-key'));
  await page.clock.install({ time: new Date('2024-02-15T12:00:00Z') });
  await page.route('**/jobs?*', (route) => route.fulfill({ json: { jobs: [job('j2', 'Later', '2024-02-29T15:00:00Z'), job('j1', 'Earlier', '2024-02-29T13:00:00Z')] } }));
});

test('calendar uses real dates, leap days, attempts, and month controls', async ({ page }) => {
  await page.route('**/jobs/runs?*', (route) => route.fulfill({ json: { runs } }));
  await page.goto('/jobs');
  await page.locator('#tab-view-calendar').click();
  await expect(page.locator('#calendar-current-month')).toContainText('2024');
  const leapDay = page.getByRole('button', { name: '29/02/2024' });
  await expect(leapDay).toContainText('2 ag. · 1 tent.');
  await leapDay.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#calendar-day-detail')).toContainText('Earlier');
  await expect(page.locator('#calendar-day-detail')).toContainText('HTTP 500');
  await expect(page.locator('#calendar-day-detail button')).toHaveText([/Earlier/, /Later/]);
  await page.locator('#btn-calendar-next').click();
  await expect(page.locator('#calendar-current-month')).toContainText('março');
  await page.locator('#btn-calendar-prev').click();
  await expect(page.getByRole('button', { name: '29/02/2024' })).toBeVisible();
  await page.locator('#btn-calendar-today').click();
  await expect(page.getByRole('button', { name: '15/02/2024' })).toHaveAttribute('aria-pressed', 'true');
});

test('timeline all, filters, refresh and history errors reflect API', async ({ page }) => {
  let reads = 0;
  await page.route('**/jobs/runs?*', (route) => {
    reads++;
    return reads === 1 ? route.fulfill({ json: { runs } }) : route.fulfill({ status: 503, json: { detail: 'offline' } });
  });
  await page.goto('/jobs');
  await page.locator('#tab-view-timeline').click();
  await expect(page.locator('#timeline-future-section')).toBeVisible();
  await expect(page.locator('#timeline-history-section')).toContainText('HTTP 500');
  await expect(page.locator('#timeline-future-section article button:first-child')).toHaveText(['Earlier', 'Later']);
  await page.locator('#timeline-filter-history').click();
  await expect(page.locator('#timeline-future-section')).toHaveCount(0);
  await page.locator('#btn-timeline-refresh-runs').click();
  await expect(page.getByRole('alert').filter({ hasText: 'offline' })).toBeVisible();
  await expect(page.getByText(/desatualizados/)).toBeVisible();
  expect(reads).toBe(2);
});

test('empty history is shown only after a successful response', async ({ page }) => {
  await page.route('**/jobs/runs?*', (route) => route.fulfill({ json: { runs: [] } }));
  await page.goto('/jobs');
  await page.locator('#tab-view-timeline').click();
  await expect(page.getByText('Nenhuma tentativa carregada.')).toBeVisible();
});
