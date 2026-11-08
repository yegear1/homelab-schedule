import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { Job } from '../src/lib/types';

const job: Job = { id: 'job-a', title: 'Rotina de manutenção', content: 'Mensagem completa', to: 'team', target_number: 'synthetic-recipient',
  kind: 'cron', run_at: null, cron_expr: '0 9 * * *', enabled: true, source: 'sqlite', status: 'scheduled',
  next_run_at: '2035-11-09T12:00:00Z', last_run_at: null, last_status: null, last_error: null, retry_count: 0,
  created_by: 'operator', template_id: 'template-a', variables: { ticket: '42' }, tags: ['ops'], until: '2035-12-31T12:00:00Z', max_runs: 10, run_count: 2 };

test.use({ timezoneId: 'America/Sao_Paulo' });
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('SCHEDULE_API_KEY', 'synthetic-test-key')); });

async function setup(page: Page, overrides: Partial<Job> = {}): Promise<Job> {
  const selected = { ...job, ...overrides };
  await page.route(/\/jobs(?:\?.*)?$/, route => route.request().isNavigationRequest() ? route.fallback() : route.fulfill({ json: { jobs: [selected, { ...job, id: 'job-b', title: 'Outra rotina' }] } }));
  await page.route(/\/jobs\/job-[ab]$/, route => route.fulfill({ json: route.request().url().endsWith('job-b') ? { ...job, id: 'job-b', title: 'Outra rotina', content: 'Mensagem B' } : selected }));
  await page.route(/\/jobs\/job-[ab]\/runs\?/, route => route.fulfill({ json: { runs: [] } }));
  await page.route(/\/jobs\/job-[ab]\/upcoming\?/, route => route.fulfill({ json: { runs: [] } }));
  return selected;
}
async function open(page: Page, path = '/jobs'): Promise<void> {
  await page.goto(path);
  await page.getByRole('button', { name: job.title, exact: true }).click();
  await expect(page.locator('#detail-content')).toHaveText(job.content);
}

test('shared inspector exposes full metadata, bounded reads and independent empty states', async ({ page }) => {
  await setup(page);
  const urls: string[] = [];
  page.on('request', request => urls.push(request.url()));
  await open(page);
  await expect(page.locator('#detail-variables-card')).toContainText('42');
  await expect(page.locator('#detail-tags-card')).toContainText('ops');
  await expect(page.locator('#detail-runs')).toHaveText('2 / 10');
  await expect(page.locator('#runs-empty')).toBeVisible();
  await expect(page.locator('#upcoming-empty')).toBeVisible();
  expect(urls.some(url => url.endsWith('/job-a/runs?limit=20'))).toBeTruthy();
  expect(urls.some(url => url.endsWith('/job-a/upcoming?limit=5'))).toBeTruthy();
});

for (const path of ['/jobs', '/contacts/contact-test']) {
  test(`inspector and run-now semantics work at ${path}`, async ({ page }) => {
    await setup(page);
    let calls = 0;
    await page.route('**/jobs/job-a/run', async route => { calls++; await new Promise(resolve => setTimeout(resolve, 150)); await route.fulfill({ status: 202, json: { status: 'queued', job_id: 'job-a' } }); });
    await open(page, path);
    await page.locator('#btn-detail-run').dblclick();
    await expect(page.locator('#toast-notify')).toContainText('Enfileirado');
    expect(calls).toBe(1);
    await expect(page.locator('#detail-schedule')).toHaveText('0 9 * * *');
  });
}

for (const [state, action] of [['scheduled', 'pause'], ['paused', 'resume'], ['error', 'retry']] as const) {
  test(`${action} uses its lifecycle route and never run-now`, async ({ page }) => {
    await setup(page, { status: state, last_error: state === 'error' ? 'Gateway indisponível' : null, retry_count: 3 });
    const calls: string[] = [];
    await page.route(/\/jobs\/job-a\/(pause|resume|retry|run)$/, async route => { calls.push(new URL(route.request().url()).pathname); await route.fulfill({ json: job }); });
    await open(page);
    if (state === 'error') await expect(page.locator('#detail-dead-letter-box')).toContainText('Gateway indisponível');
    await page.locator(action === 'retry' ? '#btn-dead-letter-retry' : `#btn-detail-${action}`).click();
    await expect.poll(() => calls).toEqual([`/jobs/job-a/${action}`]);
  });
}

test('YAML restrictions hide all forbidden mutations while allowing run-now', async ({ page }) => {
  await setup(page, { source: 'yaml', status: 'error' });
  await open(page);
  await expect(page.locator('#detail-yaml-warning')).toContainText('routines.yaml');
  await expect(page.locator('#btn-dead-letter-run-now')).toBeVisible();
  for (const action of ['pause', 'resume', 'snooze', 'reschedule', 'cancel', 'retry']) await expect(page.locator(`#btn-detail-${action}`)).toHaveCount(0);
  await expect(page.locator('#btn-dead-letter-retry')).toHaveCount(0);
});

test('read errors remain independent, retryable and distinct from empty results', async ({ page }) => {
  await setup(page);
  await page.route('**/jobs/job-a/runs?*', route => route.fulfill({ status: 502, json: { detail: 'Falha no histórico' } }));
  await open(page);
  await expect(page.locator('#detail-runs-section')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#runs-empty')).toHaveCount(0);
  await expect(page.locator('#upcoming-empty')).toBeVisible();
  await page.unroute('**/jobs/job-a/runs?*');
  await page.locator('#btn-refresh-runs').click();
  await expect(page.locator('#runs-empty')).toBeVisible();
});

test('late detail and section responses cannot replace a newer selection', async ({ page }) => {
  await setup(page);
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/jobs/job-a', async route => { await held; await route.fulfill({ json: job }); });
  await page.goto('/jobs');
  await page.getByRole('button', { name: job.title, exact: true }).click();
  await expect(page.locator('#wdg-job-detail')).toContainText('Carregando detalhes');
  await page.getByRole('button', { name: 'Outra rotina', exact: true }).click();
  await expect(page.locator('#detail-content')).toHaveText('Mensagem B');
  release();
  await expect(page.locator('#detail-job-id')).toHaveText('job-b');
  await expect(page.locator('#detail-content')).toHaveText('Mensagem B');
});

test('snooze and reschedule preserve distinct payloads and failed drafts', async ({ page }) => {
  await setup(page);
  const requests: { path: string; body: unknown }[] = [];
  await page.route(/\/jobs\/job-a\/(snooze|reschedule)$/, async route => { requests.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() as unknown }); await route.fulfill({ status: 422, json: { detail: 'Validação sintética' } }); });
  await open(page);
  await page.locator('#btn-detail-snooze').click();
  await page.getByRole('button', { name: '+3 horas', exact: true }).click();
  await page.locator('#modal-snooze-until').fill('2035-11-09T14:00');
  await page.getByRole('button', { name: 'Confirmar adiamento', exact: true }).click();
  await expect(page.locator('#modal-snooze')).toContainText('Validação sintética');
  await expect(page.locator('#modal-snooze-until')).toHaveValue('2035-11-09T14:00');
  expect(requests[0]).toEqual({ path: '/jobs/job-a/snooze', body: { until: '2035-11-09T17:00:00.000Z' } });
  await page.keyboard.press('Escape');
  await page.locator('#btn-detail-reschedule').click();
  await page.locator('#modal-reschedule-cron').fill('0 10 * * *');
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.locator('#modal-reschedule')).toContainText('Validação sintética');
  expect(requests[1]).toEqual({ path: '/jobs/job-a/reschedule', body: { run_at: null, cron_expr: '0 10 * * *' } });
});

test('group actions use group routes, disclose member bounds and never offer group reschedule', async ({ page }) => {
  await setup(page, { group_id: 'group-test' });
  const calls: string[] = [];
  await page.route('**/jobs/group/group-test/*', async route => { calls.push(new URL(route.request().url()).pathname); await route.fulfill({ status: route.request().url().endsWith('/run') ? 202 : 200, json: { group_id: 'group-test', affected: 2, status: 'queued' } }); });
  await page.goto('/jobs');
  await page.getByRole('button', { name: 'Outra rotina', exact: true }).click();
  await page.getByRole('button', { name: job.title, exact: true }).first().click();
  await expect(page.locator('#detail-group-section')).toContainText('Até 100 membros');
  for (const action of ['pause', 'resume', 'retry', 'run']) {
    await page.locator(`#btn-group-${action}-all`).click();
    await expect.poll(() => calls.includes(`/jobs/group/group-test/${action}`)).toBeTruthy();
    await expect(page.locator(`#btn-group-${action}-all`)).toBeEnabled();
  }
  await page.locator('#btn-group-snooze-all').click();
  await page.locator('#modal-snooze-until').fill('2035-11-09T14:00');
  await page.getByRole('button', { name: 'Confirmar adiamento', exact: true }).click();
  await expect.poll(() => calls.includes('/jobs/group/group-test/snooze')).toBeTruthy();
  expect(calls.every(path => !path.endsWith('/reschedule'))).toBeTruthy();
});

test('selected history CSV uses authentication and job filter', async ({ page }) => {
  await setup(page);
  let key = '';
  await page.route('**/jobs/runs/export.csv?job_id=job-a', route => { key = route.request().headers()['x-api-key'] ?? ''; return route.fulfill({ contentType: 'text/csv', body: 'id,job_id\r\nrun-a,job-a\r\n' }); });
  await open(page);
  const download = page.waitForEvent('download');
  await page.locator('#btn-export-job-runs-csv').click();
  expect((await download).suggestedFilename()).toBe('historico.csv');
  expect(key).toBe('synthetic-test-key');
});

test('mobile sheet traps focus, nests lifecycle dialog, and restores inspection trigger', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await open(page);
  await expect(page.locator('#wdg-job-detail')).toHaveAttribute('aria-modal', 'true');
  await page.locator('#btn-detail-snooze').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#modal-snooze')).toHaveCount(0);
  await expect(page.locator('#btn-detail-snooze')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#wdg-job-detail')).toHaveCount(0);
  await expect(page.getByRole('button', { name: job.title, exact: true })).toBeFocused();
});

for (const status of [401, 404, 409, 422, 502]) {
  test(`mutation HTTP ${status} stays visible without automatic replay`, async ({ page }) => {
    await setup(page);
    let calls = 0;
    await page.route('**/jobs/job-a/run', route => { calls++; return route.fulfill({ status, json: { detail: `Falha sintética ${status}` } }); });
    await open(page);
    await page.locator('#btn-detail-run').click();
    await expect(page.locator('#wdg-job-detail').getByRole('alert')).toContainText(`Falha sintética ${status}`);
    await expect(page.locator('#btn-detail-run')).toBeEnabled();
    expect(calls).toBe(1);
  });
}

test('missing detail can be retried independently of its list entry', async ({ page }) => {
  await setup(page);
  await page.route('**/jobs/job-a', route => route.fulfill({ status: 404, json: { detail: 'Missing' } }));
  await page.goto('/jobs');
  await page.getByRole('button', { name: job.title, exact: true }).click();
  await expect(page.locator('#wdg-job-detail')).toContainText('Agendamento não encontrado');
  await page.unroute('**/jobs/job-a');
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.locator('#detail-content')).toHaveText(job.content);
});

test('late history and projection results are ignored after selecting another job', async ({ page }) => {
  await setup(page);
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  const heldRequests: string[] = [];
  await page.route(/\/jobs\/job-a\/(runs|upcoming)\?/, async route => {
    heldRequests.push(route.request().url());
    await held;
    await route.fulfill({ status: 502, json: { detail: 'Erro atrasado A' } });
  });
  await open(page);
  await expect.poll(() => heldRequests.length).toBe(2);
  await page.getByRole('button', { name: 'Outra rotina', exact: true }).click();
  await expect(page.locator('#detail-content')).toHaveText('Mensagem B');
  release();
  await expect(page.locator('#runs-empty')).toBeVisible();
  await expect(page.locator('#upcoming-empty')).toBeVisible();
  await expect(page.locator('#wdg-job-detail')).not.toContainText('Erro atrasado A');
});

test('cancel confirmation prevents mutation and confirmed cancellation accepts 204', async ({ page }) => {
  await setup(page);
  let calls = 0;
  await page.route('**/jobs/job-a/cancel', route => { calls++; return route.fulfill({ status: 204 }); });
  await open(page);
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#btn-detail-cancel').click();
  expect(calls).toBe(0);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#btn-detail-cancel').click();
  await expect.poll(() => calls).toBe(1);
});

test('invalid snooze/cron send no mutation and CSV failure is visible', async ({ page }) => {
  await setup(page);
  const mutations: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') mutations.push(request.url()); });
  await page.route('**/jobs/runs/export.csv?*', route => route.fulfill({ contentType: 'text/html', body: '<p>Unexpected HTML</p>' }));
  await open(page);
  await page.locator('#btn-detail-snooze').click();
  await page.locator('#modal-snooze-until').fill('2000-01-01T12:00');
  await page.getByRole('button', { name: 'Confirmar adiamento', exact: true }).click();
  await expect(page.locator('#modal-snooze')).toContainText('deve ser no futuro');
  await page.keyboard.press('Escape');
  await page.locator('#btn-detail-reschedule').click();
  await page.locator('#modal-reschedule-cron').fill('0 9');
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.locator('#modal-reschedule')).toContainText('exatamente 5 campos');
  await page.keyboard.press('Escape');
  expect(mutations).toEqual([]);
  await page.locator('#btn-export-job-runs-csv').click();
  await expect(page.locator('#detail-runs-section').getByRole('alert')).toBeVisible();
});

for (const width of [320, 768, 1440]) {
  test(`inspector controls remain reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await open(page);
    const inspector = page.locator('#wdg-job-detail');
    await expect(inspector).toBeVisible();
    const bounds = await inspector.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    await page.locator('#btn-export-job-runs-csv').scrollIntoViewIfNeeded();
    await expect(page.locator('#btn-export-job-runs-csv')).toBeInViewport();
    if (width === 320) await page.screenshot({ path: '/tmp/homelab-inspector-mobile.png' });
    if (width === 1440) await page.screenshot({ path: '/tmp/homelab-inspector-desktop.png', fullPage: true });
  });
}

test('history and upcoming ready states render accepted attempts and local projection', async ({ page }) => {
  await setup(page);
  await page.route('**/jobs/job-a/runs?*', route => route.fulfill({ json: { runs: [{ id: 'run-test', job_id: 'job-a', ran_at: '2035-11-08T12:00:00Z', trigger: 'manual', status: 'success', status_code: 202, duration_ms: 12.5, error_message: null }] } }));
  await page.route('**/jobs/job-a/upcoming?*', route => route.fulfill({ json: { runs: [{ run_at: '2035-11-09T12:00:00Z', run_at_local: '2035-11-09 09:00:00 -03:00', time_local: '09:00', formatted_date: '09/11/2035 09:00' }] } }));
  await open(page);
  await expect(page.locator('#runs-list')).toContainText('Enfileirado · 202 · Manual · 12.5 ms');
  await expect(page.locator('#upcoming-list')).toContainText('09/11/2035 09:00');
});

test('successful lifecycle dialog ignores duplicate submission and refreshes details', async ({ page }) => {
  await setup(page);
  let calls = 0;
  await page.route('**/jobs/job-a/snooze', async route => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 150));
    await route.fulfill({ json: { ...job, next_run_at: '2035-11-09T17:00:00Z' } });
  });
  await open(page);
  await page.locator('#btn-detail-snooze').click();
  await page.locator('#modal-snooze-until').fill('2035-11-09T14:00');
  await page.getByRole('button', { name: 'Confirmar adiamento', exact: true }).dblclick();
  await expect(page.locator('#modal-snooze')).toHaveCount(0);
  expect(calls).toBe(1);
  await expect(page.locator('#detail-schedule')).toHaveText('0 9 * * *');
});

test('group cancellation requires confirmation and reports affected count', async ({ page }) => {
  await setup(page, { group_id: 'group-test' });
  let calls = 0;
  await page.route('**/jobs/group/group-test/cancel', route => { calls++; return route.fulfill({ json: { group_id: 'group-test', affected: 2, status: 'cancelled' } }); });
  await page.goto('/jobs');
  await page.getByRole('button', { name: job.title, exact: true }).click();
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#btn-group-cancel-all').click();
  expect(calls).toBe(0);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#btn-group-cancel-all').click();
  await expect(page.locator('#toast-notify')).toContainText('2 recado(s)');
  expect(calls).toBe(1);
});

test('inspector remains usable at 200% CSS zoom and restores desktop focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page);
  await open(page);
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await page.locator('#btn-detail-snooze').click();
  await expect(page.locator('#modal-snooze-until')).toBeInViewport();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Fechar inspeção', exact: true }).click();
  await expect(page.getByRole('button', { name: job.title, exact: true })).toBeFocused();
});
