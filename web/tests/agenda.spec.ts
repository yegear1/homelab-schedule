import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { Job, JobRun } from '../src/lib/types';

const base: Job = { id: 'agenda-a', title: 'Manutenção', content: 'Texto de teste', to: 'team', target_number: 'test-recipient', kind: 'cron', run_at: null, cron_expr: '0 9 * * *', enabled: true, source: 'sqlite', status: 'scheduled', next_run_at: '2035-11-09T12:00:00Z', last_run_at: null, last_status: null, last_error: null, retry_count: 0, created_by: 'operator', template_id: null, variables: { ticket: '42' }, tags: ['ops'] };
const attempts: JobRun[] = [
  { id: 'run-old', job_id: 'outside-list', ran_at: '2035-11-08T11:00:00Z', trigger: 'schedule', status: 'error', status_code: 502, duration_ms: 10.5, error_message: 'Falha sintética no gateway' },
  { id: 'run-new', job_id: 'agenda-a', ran_at: '2035-11-08T12:00:00Z', trigger: 'manual', status: 'success', status_code: 202, duration_ms: 12.5, error_message: null },
];
const grouped: Job[] = [
  { ...base, id: 'group-a', title: 'Aviso da equipe', group_id: 'team-batch' },
  { ...base, id: 'group-b', title: 'Segundo membro', group_id: 'team-batch', to: 'ops', target_number: 'ops-recipient', status: 'error', last_error: 'Gateway indisponível' },
  { ...base, id: 'group-c', title: 'Outra equipe', group_id: 'other-batch', status: 'paused' },
  base,
];

test.use({ timezoneId: 'America/Sao_Paulo' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('SCHEDULE_API_KEY', 'synthetic-test-key'));
  await page.clock.setFixedTime(new Date('2035-11-08T15:00:00Z'));
});
async function setup(page: Page, jobs: Job[] = [base], runs: JobRun[] = attempts): Promise<string[]> {
  const queries: string[] = [];
  await page.route(/\/jobs(?:\?.*)?$/, route => {
    if (route.request().isNavigationRequest()) return route.fallback();
    const url = new URL(route.request().url());
    queries.push(url.search);
    const groupId = url.searchParams.get('group_id');
    return route.fulfill({ json: { jobs: groupId ? jobs.filter(job => job.group_id === groupId) : jobs } });
  });
  await page.route(/\/jobs\/runs(?:\?.*)?$/, route => route.fulfill({ json: { runs } }));
  await page.route('**/jobs/tags', route => route.fulfill({ json: { tags: ['ops', 'finance'] } }));
  await page.route(/\/jobs\/(agenda-a|outside-list|group-[abc])$/, route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1);
    return route.fulfill({ json: jobs.find(job => job.id === id) ?? { ...base, id, title: 'Registro fora da lista' } });
  });
  await page.route(/\/jobs\/(agenda-a|outside-list|group-[abc])\/(runs|upcoming)\?/, route => route.fulfill({ json: { runs: [] } }));
  return queries;
}
async function open(page: Page): Promise<void> { await page.goto('/jobs'); await expect(page.locator('#scr-jobs')).toHaveAttribute('data-state', 'ready'); }

function _params(params: URLSearchParams): Record<string, string> {
  const values: Record<string, string> = {};
  params.forEach((value, key) => { values[key] = value; });
  return values;
}

async function fillFilters(page: Page): Promise<void> {
  await page.locator('#filter-status').selectOption('all');
  await page.locator('#filter-query').fill(' maintenance ');
  await page.locator('#filter-phone').fill(' team ');
  await page.locator('#filter-tag').fill(' ops ');
  await page.locator('#filter-from').fill('2035-11-01T09:00');
  await page.locator('#filter-to').fill('2035-11-30T18:00');
  await page.locator('#filter-limit').fill('7');
}
const expectedFilters = { status: 'all', query: 'maintenance', phone: 'team', tag: 'ops', from: '2035-11-01T12:00:00.000Z', to: '2035-11-30T21:00:00.000Z', limit: '7' };

test('submitted filters and CSV agree, dates use local instants, export omits list limit', async ({ page }) => {
  const queries = await setup(page);
  let exported: Record<string, string> = {};
  let key = '';
  await page.route('**/jobs/export.csv?*', route => {
    exported = _params(new URL(route.request().url()).searchParams);
    key = route.request().headers()['x-api-key'] ?? '';
    return route.fulfill({ contentType: 'text/csv', body: 'id,title\r\na,hello\r\n' });
  });
  await open(page);
  await fillFilters(page);
  expect(queries).toHaveLength(1);
  await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
  await expect.poll(() => _params(new URLSearchParams(queries.at(-1)))).toEqual(expectedFilters);
  await page.locator('#filter-phone').fill('unapplied-draft');
  const download = page.waitForEvent('download');
  await page.locator('#btn-export-jobs-csv').click();
  expect((await download).suggestedFilename()).toBe('agendamentos.csv');
  const { limit, ...csv } = expectedFilters;
  expect(exported).toEqual(csv);
  expect(key).toBe('synthetic-test-key');
});

test('views preserve filter draft and reset applies defaults immediately', async ({ page }) => {
  const queries = await setup(page);
  await open(page);
  await fillFilters(page);
  for (const view of ['timeline', 'calendar', 'table']) await page.locator(`#tab-view-${view}`).click();
  await expect(page.locator('#filter-query')).toHaveValue(' maintenance ');
  expect(queries).toHaveLength(1);
  await page.locator('#btn-reset-filters').click();
  await expect(page.locator('#filter-query')).toHaveValue('');
  await expect(page.locator('#filter-status')).toHaveValue('upcoming');
  await expect.poll(() => _params(new URLSearchParams(queries.at(-1)))).toEqual({ status: 'upcoming', limit: '50' });
});

test('invalid date range never sends a new request', async ({ page }) => {
  const queries = await setup(page);
  await open(page);
  await page.locator('#filter-from').fill('2035-11-20T09:00');
  await page.locator('#filter-to').fill('2035-11-01T09:00');
  await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
  await expect(page.locator('#wdg-job-filters').getByRole('alert')).toContainText('anterior');
  expect(queries).toHaveLength(1);
});

test('group summaries preserve mixed states, collapse and expand individual/all groups', async ({ page }) => {
  await setup(page, grouped);
  await open(page);
  await expect(page.locator('#list-count-badge')).toHaveText('4');
  await expect(page.locator('[data-job-id="group-b"]')).toHaveCount(0);
  const group = page.locator('tr[data-group-id="team-batch"]').first();
  await expect(group).toContainText('2 membro(s) carregado(s)');
  await expect(group).toContainText('1 erro');
  await group.getByRole('button', { name: 'Expandir grupo team-batch', exact: true }).click();
  await expect(page.locator('[data-job-id="group-b"]')).toBeVisible();
  await expect(page.locator('[data-job-id="group-c"]')).toHaveCount(0);
  await page.locator('#btn-toggle-all-groups').click();
  await expect(page.locator('[data-job-id="group-c"]')).toBeVisible();
  await page.locator('#btn-toggle-all-groups').click();
  await expect(page.locator('[data-job-id="group-b"]')).toHaveCount(0);
  await expect(page.locator('[data-job-id="group-c"]')).toHaveCount(0);
});

test('table group actions use group endpoints and have no duplicate inspector IDs', async ({ page }) => {
  await setup(page, grouped);
  const calls: string[] = [];
  await page.route('**/jobs/group/team-batch/run', route => { calls.push(route.request().url()); return route.fulfill({ status: 202, json: { group_id: 'team-batch', affected: 2, status: 'queued' } }); });
  await open(page);
  const group = page.locator('tr[data-group-id="team-batch"]').first();
  await group.locator('summary').click();
  await group.getByRole('button', { name: 'Disparar agora · grupo', exact: true }).click();
  await expect.poll(() => calls.length).toBe(1);
  await expect(page.locator('#toast-notify')).toContainText('Enfileirado');
  await page.getByRole('button', { name: 'Aviso da equipe', exact: true }).click();
  await expect(page.locator('#btn-group-run-all')).toHaveCount(1);
});

test('error shortcut requests error jobs and count is labelled as loaded subset', async ({ page }) => {
  const queries = await setup(page, grouped);
  await open(page);
  await expect(page.locator('#metric-error-count')).toHaveText('1');
  await page.locator('#card-metric-errors').click();
  await expect.poll(() => new URLSearchParams(queries.at(-1)).get('status')).toBe('error');
  await expect(page.locator('#filter-status')).toHaveValue('error');
});

test('timeline sorts schedules and attempts, supports scopes and inspects jobs outside the list', async ({ page }) => {
  await setup(page, [{ ...base, id: 'later', title: 'Mais tarde', next_run_at: '2035-11-10T12:00:00Z' }, base]);
  await open(page);
  await page.locator('#tab-view-timeline').click();
  await expect(page.locator('#timeline-future-section article').first()).toContainText('Manutenção');
  await expect(page.locator('#timeline-history-section [id^="timeline-run-"]').first()).toHaveAttribute('id', 'timeline-run-run-new');
  await expect(page.locator('#timeline-run-run-new')).toContainText('202 · 12.5 ms · Manual');
  await page.locator('#timeline-filter-history').click();
  await expect(page.locator('#timeline-future-section')).toHaveCount(0);
  await page.getByRole('button', { name: 'Inspecionar outside-list', exact: true }).click();
  await expect(page.locator('#detail-title')).toHaveText('Registro fora da lista');
  await page.getByRole('button', { name: 'Fechar inspeção', exact: true }).click();
  await page.locator('#timeline-filter-future').click();
  await expect(page.locator('#timeline-history-section')).toHaveCount(0);
  await page.locator('#timeline-filter-all').click();
  await expect(page.locator('#timeline-history-section')).toBeVisible();
});

test('failed history is separate from schedules and explicit refresh recovers it', async ({ page }) => {
  await setup(page);
  await page.route('**/jobs/runs?*', route => route.fulfill({ status: 502, json: { detail: 'Falha nas tentativas' } }));
  await open(page);
  await page.locator('#tab-view-timeline').click();
  await expect(page.locator('#timeline-future-section')).toContainText('Manutenção');
  await expect(page.locator('#timeline-history-section')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#timeline-history-section')).not.toContainText('Nenhuma tentativa');
  await page.unroute('**/jobs/runs?*');
  await page.locator('#btn-timeline-refresh-runs').click();
  await expect(page.locator('#timeline-run-run-new')).toBeVisible();
});

test('stale agenda responses cannot replace newer submitted filters', async ({ page }) => {
  await setup(page);
  await open(page);
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/jobs?*', async route => {
    const query = new URL(route.request().url()).searchParams.get('query');
    if (query === 'old') { await held; return route.fulfill({ json: { jobs: [{ ...base, title: 'Resposta antiga' }] } }); }
    return route.fulfill({ json: { jobs: [{ ...base, title: 'Resposta atual' }] } });
  });
  await page.locator('#filter-query').fill('old');
  await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
  await expect(page.locator('#scr-jobs')).toHaveAttribute('data-state', 'loading');
  await page.locator('#filter-query').fill('new');
  await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resposta atual', exact: true })).toBeVisible();
  release();
  await expect(page.getByRole('button', { name: 'Resposta antiga', exact: true })).toHaveCount(0);
});

test('calendar exposes seven weekdays, date counts/errors and bounded next occurrences', async ({ page }) => {
  await setup(page);
  await open(page);
  await page.locator('#tab-view-calendar').click();
  await expect(page.locator('#calendar-current-month')).toContainText('novembro de 2035');
  const grid = page.locator('#calendar-grid');
  expect((await grid.locator('button').count()) % 7).toBe(0);
  await expect(page.locator('#calendar-day-2035-11-08')).toHaveAccessibleName('08/11/2035: 0 agendamentos, 2 tentativas, com erro');
  await page.locator('#calendar-day-2035-11-09').click();
  await expect(page.locator('#calendar-day-detail')).toContainText('Manutenção');
  await expect(page.locator('#calendar-day-2035-11-10')).toHaveAccessibleName('10/11/2035: 0 agendamentos, 0 tentativas');
  await expect(page.locator('#job-calendar-view')).toContainText('não expande todas as ocorrências cron');
  await page.getByRole('button', { name: 'Manutenção', exact: true }).click();
  await expect(page.locator('#detail-content')).toHaveText(base.content);
});

test('calendar keyboard traverses dates and navigation handles year boundaries and today', async ({ page }) => {
  await setup(page);
  await open(page);
  await page.locator('#tab-view-calendar').click();
  await page.locator('#calendar-day-2035-11-09').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#calendar-day-2035-11-10')).toBeFocused();
  await expect(page.locator('#calendar-day-2035-11-10')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#btn-calendar-next').click();
  await page.locator('#btn-calendar-next').click();
  await expect(page.locator('#calendar-current-month')).toContainText('janeiro de 2036');
  await page.locator('#btn-calendar-prev').click();
  await expect(page.locator('#calendar-current-month')).toContainText('dezembro de 2035');
  await page.locator('#btn-calendar-today').click();
  await expect(page.locator('#calendar-day-2035-11-08')).toHaveAttribute('aria-pressed', 'true');
});

for (const view of ['table', 'timeline', 'calendar']) {
  test(`composer remains available from ${view}`, async ({ page }) => {
    await setup(page);
    await open(page);
    await page.locator(`#tab-view-${view}`).click();
    await page.locator('#btn-open-create-modal').click();
    await expect(page.locator('#form-job-create')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator(`#tab-view-${view}`)).toHaveAttribute('aria-pressed', 'true');
  });
}

for (const width of [320, 390, 768, 1440]) {
  test(`agenda and calendar fit at ${width}px without page overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, grouped);
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.locator('#tab-view-calendar').click();
    await expect(page.locator('#calendar-grid')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.evaluate(() => window.scrollTo(0, 0));
    if (width === 390) await page.screenshot({ path: '/tmp/homelab-agenda-mobile.png', fullPage: true });
    if (width === 1440) await page.screenshot({ path: '/tmp/homelab-agenda-desktop.png', fullPage: true });
  });
}

test('list failure remains distinct from empty and retry recovers without losing filters', async ({ page }) => {
  await setup(page);
  await page.route('**/jobs?*', route => route.fulfill({ status: 502, json: { detail: 'Falha na agenda' } }));
  await page.goto('/jobs');
  await expect(page.locator('#wdg-job-list')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#wdg-job-list')).not.toContainText('Nenhum agendamento encontrado');
  await page.unroute('**/jobs?*');
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Manutenção', exact: true })).toBeVisible();
});

test('empty list and empty history are explicit while calendar remains usable', async ({ page }) => {
  await setup(page, [], []);
  await page.goto('/jobs');
  await expect(page.locator('#wdg-job-list')).toHaveAttribute('data-state', 'empty');
  await expect(page.locator('#wdg-job-list')).toContainText('Nenhum agendamento encontrado');
  await page.locator('#tab-view-timeline').click();
  await expect(page.locator('#timeline-future-section')).toHaveAttribute('data-state', 'empty');
  await expect(page.locator('#timeline-history-section')).toHaveAttribute('data-state', 'empty');
  await page.locator('#tab-view-calendar').click();
  await expect(page.locator('#calendar-day-detail')).toContainText('Nenhum registro carregado');
});

test('calendar reports unavailable history rather than claiming zero attempts', async ({ page }) => {
  await setup(page);
  await page.route('**/jobs/runs?*', route => route.fulfill({ status: 502, json: { detail: 'Histórico indisponível' } }));
  await open(page);
  await page.locator('#tab-view-calendar').click();
  await expect(page.locator('#job-calendar-view').getByRole('alert')).toContainText('Tentativas indisponíveis');
  await expect(page.locator('#calendar-day-2035-11-09')).toHaveAccessibleName('09/11/2035: 1 agendamentos, tentativas indisponíveis');
});

test('global history CSV excludes agenda filters, has no limit, and displays export failures', async ({ page }) => {
  await setup(page);
  let url = '';
  await page.route('**/jobs/runs/export.csv*', route => { url = route.request().url(); return route.fulfill({ contentType: 'text/html', body: 'Unexpected HTML' }); });
  await open(page);
  await fillFilters(page);
  await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
  await page.locator('#btn-export-runs-csv').click();
  await expect(page.locator('#scr-jobs').getByRole('alert')).toBeVisible();
  expect(new URL(url).search).toBe('');
  await expect(page.locator('#btn-export-runs-csv')).toBeEnabled();
});

test('table row YAML actions forbid mutation and keep run-now explicit', async ({ page }) => {
  await setup(page, [{ ...base, source: 'yaml' }]);
  await open(page);
  const row = page.locator('[data-job-id="agenda-a"]');
  await row.locator('summary').click();
  await expect(row.getByRole('button', { name: 'Disparar agora', exact: true })).toBeVisible();
  for (const action of ['Pausar', 'Retomar', 'Re-enfileirar', 'Reagendar', 'Adiar', 'Cancelar recado']) await expect(row.getByRole('button', { name: action, exact: true })).toHaveCount(0);
});

test('dark reduced-motion agenda remains usable at 200% zoom', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('homelab_theme', 'dark'));
  await setup(page, grouped);
  await open(page);
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await page.locator('#tab-view-calendar').click();
  await expect(page.locator('#calendar-day-2035-11-09')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.evaluate(() => { document.documentElement.style.zoom = '1'; window.scrollTo(0, 0); });
  await page.screenshot({ path: '/tmp/homelab-agenda-dark.png', fullPage: true });
});
