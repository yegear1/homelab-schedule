import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

test.use({ timezoneId: 'America/Sao_Paulo' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('SCHEDULE_API_KEY', 'synthetic-test-key'));
});

type Recorded = { path: string; body: unknown };
async function _capture(page: Page, status = 201): Promise<Recorded[]> {
  const records: Recorded[] = [];
  await page.route(/\/jobs(?:\/batch)?$/, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body: unknown = route.request().postDataJSON();
    records.push({ path: new URL(route.request().url()).pathname, body });
    await route.fulfill({ status, json: status === 201 ? {} : { detail: 'Falha sintética' } });
  });
  return records;
}

async function _open(page: Page): Promise<void> {
  await page.goto('/jobs');
  await page.locator('#btn-open-create-modal').click();
  await expect(page.locator('#form-job-create')).toBeVisible();
}

async function _fillOnce(page: Page): Promise<void> {
  await page.locator('#create-title').fill('Maintenance');
  await page.locator('#create-run-at').fill('2035-11-09T14:00');
  await page.locator('#create-content').fill('Hello');
}

const onceBody = { title: 'Maintenance', kind: 'once', run_at: '2035-11-09T17:00:00.000Z',
  cron_expr: null, content: 'Hello', template_id: null, created_by: null,
  until: null, max_runs: null, to: 'eu' };

test('single recipient uses the exact once payload and dismisses on success', async ({ page }) => {
  const records = await _capture(page);
  await _open(page);
  await _fillOnce(page);
  await page.locator('#btn-create-job-submit').click();
  await expect(page.locator('#form-job-create')).toHaveCount(0);
  expect(records).toEqual([{ path: '/jobs', body: onceBody }]);
});

test('pending recipients, creator picker, template, variables, tags and limits survive a batch', async ({ page }) => {
  await page.route('**/templates', (route) => route.fulfill({ json: { templates: [
    { id: 'tpl-test', name: 'Reminder', body: 'Hello {{code}}' },
  ] } }));
  await page.route('**/jobs/tags', (route) => route.fulfill({ json: { tags: ['ops', 'finance'] } }));
  const records = await _capture(page);
  await _open(page);
  await page.locator('#create-title').fill('Batch');
  await page.locator('#create-kind').selectOption('cron');
  await page.locator('#create-cron-expr').fill('0 9 * * 1-5');
  await page.locator('#input-add-recipient').fill('team;team, ops');
  await page.getByRole('button', { name: 'Selecionar criador', exact: true }).click();
  await page.locator('#picker-search-input').fill('Test');
  await page.getByRole('button', { name: /Test Contact/ }).click();
  await page.locator('#create-payload-mode').selectOption('template');
  await page.locator('#create-template-id').selectOption('tpl-test');
  await page.getByText('Opções avançadas', { exact: true }).click();
  await page.locator('#create-until').fill('2035-12-31T18:00');
  await page.locator('#create-max-runs').fill('3');
  for (const value of ['1', '2']) {
    await page.locator('#input-var-key').fill('{{code}}');
    await page.locator('#input-var-value').fill(value);
    await page.locator('#btn-add-var').click();
  }
  await page.locator('#input-var-key').fill('temporary');
  await page.locator('#input-var-value').fill('discard');
  await page.locator('#btn-add-var').click();
  await page.getByRole('button', { name: 'Remover variável temporary', exact: true }).click();
  await page.locator('#input-tag').fill('Ops;ops finance');
  await page.locator('#btn-add-tag').click();
  await page.getByRole('button', { name: 'Remover tag finance', exact: true }).click();
  await page.locator('#input-tag').fill('Finance');
  await page.locator('#btn-add-tag').click();
  await page.locator('#btn-create-job-submit').click();
  await expect(page.locator('#form-job-create')).toHaveCount(0);
  expect(records).toEqual([{ path: '/jobs/batch', body: {
    title: 'Batch', kind: 'cron', run_at: null, cron_expr: '0 9 * * 1-5',
    content: null, template_id: 'tpl-test', created_by: 'test-recipient',
    until: '2035-12-31T21:00:00.000Z', max_runs: 3,
    variables: { code: '2' }, tags: ['ops', 'finance'], recipients: ['eu', 'team', 'ops'],
  } }]);
});

test('contact page initializes recipient and creator and resets after success', async ({ page }) => {
  const records = await _capture(page);
  await page.goto('/contacts/contact-test');
  await expect(page.locator('#create-created-by')).toHaveValue('test-recipient');
  await expect(page.getByRole('button', { name: 'Remover destinatário test-recipient', exact: true })).toBeVisible();
  await _fillOnce(page);
  await page.locator('#btn-create-job-submit').click();
  await expect(page.locator('#create-title')).toHaveValue('');
  await expect(page.locator('#create-created-by')).toHaveValue('test-recipient');
  expect(records).toEqual([{ path: '/jobs', body: { ...onceBody, to: 'test-recipient', created_by: 'test-recipient' } }]);
});

test('template selection and clear restore direct-message mode', async ({ page }) => {
  await page.route('**/templates', (route) => route.fulfill({ json: { templates: [
    { id: 'tpl-test', name: 'Reminder', body: 'Template text' },
  ] } }));
  const records = await _capture(page);
  await _open(page);
  await page.locator('#create-payload-mode').selectOption('template');
  await page.locator('#create-template-id').selectOption('tpl-test');
  await expect(page.getByLabel('Texto do modelo')).toHaveText('Template text');
  await page.getByRole('button', { name: 'Remover modelo selecionado', exact: true }).click();
  await expect(page.locator('#create-content')).toHaveValue('');
  await _fillOnce(page);
  await page.locator('#btn-create-job-submit').click();
  await expect(page.locator('#form-job-create')).toHaveCount(0);
  expect(records[0].body).toEqual(onceBody);
});

test('recipient picker supports search, native keyboard selection and removal', async ({ page }) => {
  const records = await _capture(page);
  await _open(page);
  await _fillOnce(page);
  await page.getByRole('button', { name: 'Adicionar Contato', exact: true }).click();
  await page.locator('#picker-search-input').fill('no-match');
  await expect(page.locator('#picker-contacts-list')).toHaveAttribute('data-state', 'empty');
  await page.locator('#picker-search-input').fill('contact-test');
  const contact = page.getByRole('button', { name: /Test Contact/ });
  await contact.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#wdg-contact-pick')).toHaveCount(0);
  await page.getByRole('button', { name: 'Remover destinatário eu', exact: true }).click();
  await page.locator('#btn-create-job-submit').click();
  await expect(page.locator('#form-job-create')).toHaveCount(0);
  expect(records).toEqual([{ path: '/jobs', body: { ...onceBody, to: 'test-recipient' } }]);
});

test('malformed forms never send a scheduling request', async ({ page }) => {
  const records = await _capture(page);
  await _open(page);
  await page.locator('#btn-create-job-submit').click();
  expect(records).toHaveLength(0);
  await _fillOnce(page);
  await page.locator('#create-title').fill('   ');
  await page.locator('#btn-create-job-submit').click();
  await expect(page.getByRole('alert')).toContainText('título');
  await page.locator('#create-title').fill('Valid');
  await page.locator('#create-kind').selectOption('cron');
  await page.locator('#create-cron-expr').fill('0 9 *');
  await page.locator('#btn-create-job-submit').click();
  await expect(page.getByRole('alert')).toContainText('cinco campos');
  await page.locator('#create-cron-expr').fill('0 9 * * *');
  await page.getByRole('button', { name: 'Remover destinatário eu', exact: true }).click();
  await page.locator('#btn-create-job-submit').click();
  await expect(page.getByRole('alert')).toContainText('destinatário');
  expect(records).toHaveLength(0);
});

test('invalid lifecycle limits are rejected before sending', async ({ page }) => {
  const records = await _capture(page);
  await _open(page);
  await _fillOnce(page);
  await page.getByText('Opções avançadas', { exact: true }).click();
  await page.locator('#create-until').fill('2035-11-08T14:00');
  await page.locator('#btn-create-job-submit').click();
  await expect(page.getByRole('alert')).toContainText('data limite');
  await page.locator('#create-until').fill('');
  await page.locator('#create-max-runs').fill('0');
  await page.locator('#btn-create-job-submit').click();
  expect(await page.locator('#form-job-create').evaluate((form) => (form as HTMLFormElement).checkValidity())).toBe(false);
  expect(records).toHaveLength(0);
});

test('server failure retains form fields and only explicit retry submits again', async ({ page }) => {
  let failure = true;
  const records: unknown[] = [];
  await page.route('**/jobs', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body: unknown = route.request().postDataJSON();
    records.push(body);
    await route.fulfill({ status: failure ? 422 : 201, json: failure ? { detail: 'Falha sintética' } : {} });
  });
  await _open(page);
  await _fillOnce(page);
  await page.locator('#btn-create-job-submit').click();
  await expect(page.getByRole('alert')).toHaveText('Falha sintética');
  await expect(page.locator('#create-title')).toHaveValue('Maintenance');
  await expect(page.locator('#create-content')).toHaveValue('Hello');
  expect(records).toHaveLength(1);
  failure = false;
  await page.locator('#btn-create-job-submit').click();
  await expect(page.locator('#form-job-create')).toHaveCount(0);
  expect(records).toEqual([onceBody, onceBody]);
});

test('in-flight submission disables controls and ignores duplicate submit events', async ({ page }) => {
  let release = (): void => {};
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let count = 0;
  await page.route('**/jobs', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    count += 1;
    await pending;
    await route.fulfill({ status: 201, json: {} });
  });
  await _open(page);
  await _fillOnce(page);
  await page.locator('#btn-create-job-submit').click();
  await expect(page.locator('#create-title')).toBeDisabled();
  await expect(page.locator('#btn-create-job-submit')).toBeDisabled();
  await page.locator('#form-job-create').evaluate((form) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect.poll(() => count).toBe(1);
  release();
  await expect(page.locator('#form-job-create')).toHaveCount(0);
});

test('contact picker failure remains visible and supports retry', async ({ page }) => {
  await _open(page);
  let failure = true;
  await page.route('**/contacts', (route) => failure
    ? route.fulfill({ status: 500, json: { detail: 'Contatos indisponíveis' } }) : route.fallback());
  await page.getByRole('button', { name: 'Adicionar Contato', exact: true }).click();
  await expect(page.locator('#picker-contacts-list')).toHaveAttribute('data-state', 'error');
  await expect(page.getByRole('alert')).toHaveText('Contatos indisponíveis');
  failure = false;
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByRole('button', { name: /Test Contact/ })).toBeVisible();
});

test('Enter adds recipient, variable and tag without submitting the mobile form', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const records = await _capture(page);
  await _open(page);
  await _fillOnce(page);
  await page.getByRole('button', { name: 'Remover destinatário eu', exact: true }).click();
  await page.locator('#input-add-recipient').fill('team;ops');
  await page.locator('#input-add-recipient').press('Enter');
  await page.getByText('Opções avançadas', { exact: true }).click();
  await page.locator('#input-var-key').fill('code');
  await page.locator('#input-var-value').fill('1');
  await page.locator('#input-var-value').press('Enter');
  await page.locator('#input-var-key').fill('code');
  await page.locator('#input-var-value').fill('2');
  await page.locator('#input-var-key').press('Enter');
  await page.locator('#input-tag').fill('Ops ops');
  await page.locator('#input-tag').press('Enter');
  expect(records).toHaveLength(0);
  const box = await page.locator('#wdg-job-create').boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '/tmp/homelab-composer-mobile.png', animations: 'disabled' });
  await page.locator('#btn-create-job-submit').click();
  await expect(page.locator('#form-job-create')).toHaveCount(0);
  const { to: _recipient, ...common } = onceBody;
  expect(records).toEqual([{ path: '/jobs/batch', body: {
    ...common, recipients: ['team', 'ops'], variables: { code: '2' }, tags: ['ops'],
  } }]);
});
