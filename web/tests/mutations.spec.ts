import type { Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';

const JOB = {
  id: 'job-1', title: 'Alpha reminder', to: '5511999990000', target_number: '5511999990000', kind: 'once',
  run_at: '2030-01-01T10:00:00Z', cron_expr: null, enabled: true, source: 'sqlite', status: 'scheduled',
  next_run_at: '2030-01-01T10:00:00Z', last_run_at: null, last_status: null, created_by: 'tester',
  template_id: null, group_id: null, tags: [], run_count: 0,
};
const GROUPED = [
  { ...JOB, id: 'job-g1', title: 'Batch member one', group_id: 'grp-1' },
  { ...JOB, id: 'job-g2', title: 'Batch member two', group_id: 'grp-1' },
];

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

interface Harness { reads: () => number; failReads: (value: boolean) => void }

async function mockAgenda(page: Page, jobs: unknown[]): Promise<Harness> {
  await page.addInitScript(() => localStorage.setItem('SCHEDULE_API_KEY', 'synthetic-key'));
  let reads = 0;
  let failReads = false;
  await page.route('**/jobs?*', async (route) => {
    reads += 1;
    if (failReads) return json(route, 503, { detail: 'Unavailable' });
    return json(route, 200, { jobs });
  });
  await page.route('**/jobs/tags', (route) => json(route, 200, { tags: [] }));
  return { reads: () => reads, failReads: (value) => { failReads = value; } };
}

type Failure = { label: string; status?: number; detail?: string };
const FAILURES: Failure[] = [
  { label: '401', status: 401, detail: 'Unauthorized' },
  { label: '409', status: 409, detail: 'State conflict' },
  { label: '422', status: 422, detail: 'Invalid payload' },
  { label: 'network' },
];

async function fail(route: Route, failure: Failure) {
  if (failure.status === undefined) return route.abort('failed');
  return json(route, failure.status, { detail: failure.detail });
}

const ACTIONS = [
  { name: 'pause', path: '**/jobs/job-1/pause', title: 'Pause' },
  { name: 'snooze', path: '**/jobs/job-1/snooze', title: 'Quick Snooze (+1h)' },
  { name: 'run', path: '**/jobs/job-1/run', title: 'Run Now (POST /jobs/{id}/run)' },
] as const;

for (const action of ACTIONS) {
  for (const failure of FAILURES) {
    test(`${action.name} rejected by ${failure.label} reports failure and changes nothing`, async ({ page }) => {
      const agenda = await mockAgenda(page, [JOB]);
      let posts = 0;
      await page.route(action.path, (route) => { posts += 1; return fail(route, failure); });
      await page.goto('/jobs');
      await expect(page.getByText('Alpha reminder').first()).toBeVisible();
      const readsBefore = agenda.reads();
      await page.getByTitle(action.title).first().click();
      await expect(page.getByText(/failed|Could not/i).first()).toBeVisible();
      await expect(page.getByText(/^(Queued |Paused schedule|Resumed schedule|Snoozed )/)).toHaveCount(0);
      await expect(page.getByTitle('Pause').first()).toBeVisible();
      expect(posts).toBe(1);
      expect(agenda.reads()).toBe(readsBefore);
    });
  }
}

test('run-now 202 is announced as queued, never as delivered or sent', async ({ page }) => {
  await mockAgenda(page, [JOB]);
  await page.route('**/jobs/job-1/run', (route) => json(route, 202, { status: 'queued', job_id: 'job-1' }));
  await page.goto('/jobs');
  await page.getByTitle('Run Now (POST /jobs/{id}/run)').first().click();
  await expect(page.getByText('Queued Alpha reminder')).toBeVisible();
  await expect(page.getByText(/delivery is not confirmed/)).toBeVisible();
  await expect(page.getByText(/Sent to|Dispatched Alpha/)).toHaveCount(0);
});

test('accepted write with failed refresh warns once and never replays the write', async ({ page }) => {
  const agenda = await mockAgenda(page, [JOB]);
  let posts = 0;
  await page.route('**/jobs/job-1/pause', (route) => {
    posts += 1;
    agenda.failReads(true);
    return json(route, 200, { ...JOB, status: 'paused' });
  });
  await page.goto('/jobs');
  await page.getByTitle('Pause').first().click();
  await expect(page.getByText(/could not be reloaded/)).toBeVisible();
  await expect(page.getByText('Paused schedule: Alpha reminder')).toBeVisible();
  await page.waitForTimeout(500);
  expect(posts).toBe(1);
});

test('a second click while a write is in flight sends no second request', async ({ page }) => {
  await mockAgenda(page, [JOB]);
  let posts = 0;
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/jobs/job-1/run', async (route) => {
    posts += 1;
    await held;
    return json(route, 202, { status: 'queued', job_id: 'job-1' });
  });
  await page.goto('/jobs');
  const button = page.getByTitle('Run Now (POST /jobs/{id}/run)').first();
  await button.click();
  await expect(button).toBeDisabled();
  await button.dispatchEvent('click');
  release?.();
  await expect(page.getByText('Queued Alpha reminder')).toBeVisible();
  expect(posts).toBe(1);
});

for (const failure of FAILURES) {
  test(`group pause rejected by ${failure.label} leaves members untouched`, async ({ page }) => {
    await mockAgenda(page, GROUPED);
    await page.route('**/jobs/group/grp-1/pause', (route) => fail(route, failure));
    await page.goto('/jobs');
    await page.locator('#btn-group-pause-all').click();
    await expect(page.getByText(/failed for group grp-1/)).toBeVisible();
    await expect(page.getByText(/^Paused: group/)).toHaveCount(0);
    await expect(page.locator('#btn-group-pause-all')).toBeEnabled();
  });
}

test('composer keeps its draft and stays open when creation is rejected', async ({ page }) => {
  await mockAgenda(page, []);
  await page.route('**/contacts', (route) => json(route, 200, { contacts: [] }));
  await page.route('**/templates', (route) => json(route, 200, { templates: [] }));
  let posts = 0;
  await page.route('**/jobs', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    posts += 1;
    return json(route, 422, { detail: 'Invalid payload' });
  });
  await page.goto('/jobs');
  await page.getByRole('button', { name: 'New Job' }).first().click();
  await page.getByPlaceholder('e.g. Daily Temperature Alert').fill('Draft that must survive');
  await page.getByPlaceholder(/Enter notification text/).fill('Draft body');
  await page.getByRole('button', { name: 'Schedule Dispatch' }).click();
  await expect(page.getByText(/Scheduling failed/)).toBeVisible();
  await expect(page.getByPlaceholder('e.g. Daily Temperature Alert')).toHaveValue('Draft that must survive');
  await expect(page.getByPlaceholder(/Enter notification text/)).toHaveValue('Draft body');
  await expect(page.getByText('Alpha reminder')).toHaveCount(0);
  expect(posts).toBe(1);
});
