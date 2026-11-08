import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const bundle = { contacts: [{ id: 'contact-portable', name: 'Contato importado', phone: 'test-recipient' }], templates: [], jobs: [], job_runs: [] };
const summary = { contacts: { created: 1, updated: 2, skipped: 3 }, templates: { created: 0, updated: 0, skipped: 0 }, jobs: { created: 0, updated: 0, skipped: 0 }, job_runs: { created: 0, updated: 0, skipped: 0 } };
const run = { id: 'history-run', job_id: 'history-job', ran_at: '2035-11-08T12:00:00Z', trigger: 'manual', status: 'success', status_code: 202, duration_ms: 12.5, error_message: null };

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('SCHEDULE_API_KEY', 'synthetic-test-key')); });
async function file(page: Page, value: unknown = bundle): Promise<void> {
  await upload(page, JSON.stringify(value));
}
async function upload(page: Page, text: string): Promise<void> {
  await page.locator('#input-import-file').evaluate((element, content) => {
    const input = element as HTMLInputElement; const data = new DataTransfer();
    data.items.add(new File([content], 'portable.json', { type: 'application/json' }));
    input.files = data.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  }, text);
}
async function imports(page: Page): Promise<unknown[]> {
  const calls: unknown[] = [];
  await page.route('**/backup/import', route => {
    calls.push(route.request().postDataJSON());
    expect(route.request().headers()['x-api-key']).toBe('synthetic-test-key');
    return route.fulfill({ json: { status: 'imported', mode: 'merge', summary, warnings: ['Rotina YAML ignorada'] } });
  });
  return calls;
}

test('History and Data support direct reload, links and browser history', async ({ page }) => {
  await page.goto('/history'); await expect(page.locator('#scr-history')).toBeVisible();
  await page.reload(); await expect(page.locator('#scr-history')).toBeVisible();
  await page.locator('#nav-scr-data').click(); await expect(page.locator('#scr-data')).toBeVisible();
  await page.reload(); await expect(page.locator('#scr-data')).toBeVisible();
  await page.goBack(); await expect(page.locator('#scr-history')).toBeVisible();
  await page.goForward(); await expect(page.locator('#scr-data')).toBeVisible();
});

test('history filters use applied status and bounded limit; CSV omits limit and draft filters', async ({ page }) => {
  const queries: string[] = [];
  await page.route('**/jobs/runs?*', route => { queries.push(new URL(route.request().url()).search); return route.fulfill({ json: { runs: [run] } }); });
  let csv = '';
  await page.route('**/jobs/runs/export.csv?*', route => { csv = new URL(route.request().url()).search; expect(route.request().headers()['x-api-key']).toBe('synthetic-test-key'); return route.fulfill({ contentType: 'text/csv', body: 'id\r\nhistory-run\r\n' }); });
  await page.goto('/history');
  await expect(page.locator('[data-run-id]')).toContainText('202 · 12.5 ms · Manual');
  await page.locator('#history-status').selectOption('error'); await page.locator('#history-limit').fill('7');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect.poll(() => queries.at(-1)).toBe('?limit=7&status=error');
  await page.locator('#history-status').selectOption('success');
  const download = page.waitForEvent('download'); await page.locator('#btn-export-runs-csv').click();
  expect((await download).suggestedFilename()).toBe('historico.csv'); expect(csv).toBe('?status=error');
});

test('history failure, retry, empty and missing inspected job stay distinct', async ({ page }) => {
  await page.route('**/jobs/runs?*', route => route.fulfill({ status: 401, json: { detail: 'Chave inválida' } }));
  await page.goto('/history'); await expect(page.getByRole('alert')).toContainText('Chave inválida');
  await expect(page.getByText('Nenhuma tentativa encontrada', { exact: false })).toHaveCount(0);
  await page.unroute('**/jobs/runs?*'); await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByRole('region', { name: 'Tentativas' })).toHaveAttribute('data-state', 'empty');
  await page.route('**/jobs/runs?*', route => route.fulfill({ json: { runs: [run] } }));
  await page.getByRole('button', { name: 'Atualizar histórico' }).click();
  await page.getByRole('button', { name: 'Inspecionar history-job' }).click();
  await expect(page.locator('#wdg-job-detail')).toContainText('não encontrado');
});

test('stale history response cannot replace a newer filter', async ({ page }) => {
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/jobs/runs?*', async route => {
    if (new URL(route.request().url()).searchParams.get('status') === 'error') { await held; return route.fulfill({ json: { runs: [{ ...run, id: 'stale' }] } }); }
    return route.fulfill({ json: { runs: [] } });
  });
  await page.goto('/history');
  await page.locator('#history-status').selectOption('error'); await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByRole('region', { name: 'Tentativas' })).toHaveAttribute('data-state', 'loading');
  await page.locator('#history-status').selectOption('success'); await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByRole('region', { name: 'Tentativas' })).toHaveAttribute('data-state', 'empty'); release();
  await expect(page.locator('[data-run-id="stale"]')).toHaveCount(0);
});

test('snapshot and optional-run JSON download use authenticated transport', async ({ page }) => {
  let include = '';
  await page.route('**/backup/database', route => { expect(route.request().headers()['x-api-key']).toBe('synthetic-test-key'); return route.fulfill({ contentType: 'application/x-sqlite3', body: 'synthetic-db' }); });
  await page.route('**/backup/export?*', route => { include = new URL(route.request().url()).searchParams.get('include_runs') ?? ''; expect(route.request().headers()['x-api-key']).toBe('synthetic-test-key'); return route.fulfill({ json: { ...bundle, metadata: { counts: {} } } }); });
  await page.goto('/data');
  let download = page.waitForEvent('download'); await page.locator('#btn-download-sqlite').click(); expect((await download).suggestedFilename()).toMatch(/\.sqlite3$/);
  await page.getByRole('checkbox').uncheck();
  download = page.waitForEvent('download'); await page.locator('#btn-export-json').click(); expect((await download).suggestedFilename()).toMatch(/\.json$/); expect(include).toBe('false');
  await page.getByRole('checkbox').check(); download = page.waitForEvent('download'); await page.locator('#btn-export-json').click(); await download; expect(include).toBe('true');
});

test('merge previews counts, sends exact payload and keeps counts and warnings visible', async ({ page }) => {
  const calls = await imports(page); await page.goto('/data'); await file(page);
  await expect(page.getByLabel('Resumo do arquivo')).toContainText('Contatos: 1');
  await page.locator('#btn-execute-import').click(); await expect(page.locator('#import-result')).toContainText('1 criados, 2 atualizados, 3 ignorados');
  await expect(page.locator('#import-result')).toContainText('Rotina YAML ignorada');
  expect(calls).toEqual([{ ...bundle, mode: 'merge' }]);
  await expect(page.locator('#btn-execute-import')).toHaveCount(0);
  await page.locator('#nav-scr-contacts').click(); await expect(page.getByText('Test Contact', { exact: true })).toBeVisible();
});

test('replace cancel and Escape send nothing; explicit confirmation sends replace', async ({ page }) => {
  const calls = await imports(page); await page.goto('/data'); await file(page);
  await page.getByRole('radio', { name: 'Substituir', exact: false }).check();
  await page.locator('#btn-execute-import').click(); await page.getByRole('button', { name: 'Cancelar substituição' }).click(); expect(calls).toHaveLength(0);
  await expect(page.locator('#btn-execute-import')).toBeFocused();
  await page.locator('#btn-execute-import').click(); await page.keyboard.press('Escape'); expect(calls).toHaveLength(0);
  await page.locator('#btn-execute-import').click(); await page.getByRole('button', { name: 'Confirmar substituição', exact: true }).click();
  await expect.poll(() => calls.length).toBe(1); expect(calls[0]).toEqual({ ...bundle, mode: 'replace' });
});

for (const value of [null, [], {}, { contacts: {} }, { contacts: [null] }, { jobs: [{ title: 'bad', kind: 'once', content: 42 }] }, { job_runs: [{ job_id: 'a', ran_at: 'not-a-date' }] }]) {
  test(`malformed import rejected without request: ${JSON.stringify(value)}`, async ({ page }) => {
    const calls = await imports(page); await page.goto('/data'); await file(page, value);
    await expect(page.getByRole('alert')).toContainText('Formato inválido'); expect(calls).toHaveLength(0); await expect(page.locator('#btn-execute-import')).toHaveCount(0);
  });
}

test('invalid JSON and server failure retain actionable feedback and draft for explicit retry', async ({ page }) => {
  await page.goto('/data');
  await upload(page, '{');
  await expect(page.getByRole('alert')).toContainText('JSON inválido');
  await page.route('**/backup/import', route => route.fulfill({ status: 422, json: { detail: 'Referência ausente' } }));
  await file(page); await page.locator('#btn-execute-import').click(); await expect(page.getByRole('alert')).toContainText('Referência ausente');
  await expect(page.getByLabel('Resumo do arquivo')).toContainText('Contatos: 1');
  await imports(page); await page.locator('#btn-execute-import').click(); await expect(page.locator('#import-result')).toContainText('concluída');
});

test('busy import prevents duplicate submissions and conflicting edits', async ({ page }) => {
  let release: () => void = () => {}; const held = new Promise<void>(resolve => { release = resolve; }); let calls = 0;
  await page.route('**/backup/import', async route => { calls++; await held; return route.fulfill({ json: { status: 'imported', mode: 'merge', summary, warnings: [] } }); });
  await page.goto('/data'); await file(page); await page.locator('#btn-execute-import').dblclick();
  await expect(page.locator('#btn-execute-import')).toBeDisabled(); await expect(page.locator('#input-import-file')).toBeDisabled();
  await expect(page.getByRole('radio').first()).toBeDisabled(); expect(calls).toBe(1); release(); await expect(page.locator('#import-result')).toBeVisible();
});

test('integrity shows details, FK violations, clears stale results on failure and recovers', async ({ page }) => {
  await page.route('**/backup/integrity', route => route.fulfill({ json: { integrity_ok: false, details: ['Página inconsistente'], foreign_keys_ok: false, fk_violations: [{ table: 'jobs', rowid: 5, parent: 'contacts', fkid: 0 }] } }));
  await page.goto('/data'); await page.locator('#btn-check-integrity').click();
  await expect(page.getByText('Página inconsistente')).toBeVisible(); await expect(page.getByText('jobs · registro 5 · referência contacts · chave 0')).toBeVisible();
  await page.route('**/backup/integrity', route => route.fulfill({ status: 502, json: { detail: 'Banco indisponível' } }));
  await page.locator('#btn-check-integrity').click(); await expect(page.getByRole('alert')).toContainText('Banco indisponível'); await expect(page.getByText('Página inconsistente')).toHaveCount(0);
  await page.unroute('**/backup/integrity'); await page.locator('#btn-check-integrity').click(); await expect(page.getByText('Banco SQLite: OK')).toBeVisible();
});

test('bad download media is visible and retryable', async ({ page }) => {
  await page.route('**/backup/database', route => route.fulfill({ contentType: 'text/html', body: 'Unexpected HTML' }));
  await page.goto('/data'); await page.locator('#btn-download-sqlite').click(); await expect(page.getByRole('alert')).toBeVisible(); await expect(page.locator('#btn-download-sqlite')).toBeEnabled();
});

for (const width of [320, 390, 768, 1440]) {
  for (const dark of [false, true]) {
    test(`History/Data fit at ${width}px, ${dark ? 'dark reduced-motion' : 'light'}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(value => localStorage.setItem('homelab_theme', value), dark ? 'dark' : 'light');
      if (dark) await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.route('**/jobs/runs?*', route => route.fulfill({ json: { runs: [run] } }));
      for (const route of ['history', 'data']) {
        await page.goto(`/${route}`); await expect(page.locator(`#scr-${route}`)).toBeVisible();
        if (route === 'history') await expect(page.locator('[data-run-id]')).toBeVisible();
        if (route === 'data') await file(page);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
        await page.screenshot({ path: `/tmp/homelab-${route}-${width}-${dark ? 'dark' : 'light'}.png`, fullPage: true });
      }
    });
  }
}

test('data replacement confirmation fits 200% zoom and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/data'); await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await file(page); await page.getByRole('radio', { name: 'Substituir', exact: false }).check(); await page.locator('#btn-execute-import').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: 'Cancelar substituição' }).click();
});

test('integrated app: disposable SQLite, catalogs, composer, inspector, CSV, JSON roundtrip and integrity', async ({ page }) => {
  // Forward only product API requests to the real app; browser traffic stays on Vite.
  await page.route(/\/(contacts|templates|jobs|backup)(?:\/|\?|$)/, async route => {
    if (route.request().resourceType() !== 'fetch') return route.fallback();
    const source = new URL(route.request().url());
    const response = await route.fetch({ url: `http://127.0.0.1:18004${source.pathname}${source.search}` });
    return route.fulfill({ response });
  });
  await page.goto('/contacts');
  const create = page.locator('#wdg-contact-create');
  await create.getByLabel('Nome', { exact: true }).fill('Integração local');
  await create.getByLabel('Telefone', { exact: true }).fill('test-recipient');
  await create.getByRole('button', { name: 'Adicionar contato', exact: true }).click();
  await expect(page.getByText('Integração local', { exact: true })).toBeVisible();
  await page.locator('#nav-scr-templates').click();
  await page.locator('#template-name-input').fill('Modelo local');
  await page.locator('#template-body-input').fill('Olá {{name}}');
  await page.getByRole('button', { name: 'Criar modelo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Editar Modelo local', exact: true })).toBeVisible();
  await page.locator('#nav-scr-jobs').click();
  await page.locator('#btn-open-create-modal').click();
  const composer = page.locator('#wdg-job-create');
  await composer.locator('#create-title').fill('Agendamento local');
  await composer.locator('#create-run-at').fill('2099-11-08T12:00');
  await composer.locator('#create-content').fill('Teste isolado');
  await composer.locator('#btn-create-job-submit').click();
  await expect(page.getByRole('button', { name: 'Agendamento local', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Agendamento local', exact: true }).click();
  await expect(page.locator('#detail-content')).toHaveText('Teste isolado');
  await page.locator('#btn-detail-run').click();
  await expect(page.locator('#toast-notify')).toContainText('Enfileirado');
  await expect(page.locator('#runs-list')).toContainText('202');
  await page.getByRole('button', { name: 'Fechar inspeção' }).click();
  const csv = page.waitForEvent('download'); await page.locator('#btn-export-jobs-csv').click(); await csv;
  await page.locator('#nav-scr-data').click();
  const exported = page.waitForResponse(response => response.url().includes('/backup/export?'));
  const download = page.waitForEvent('download'); await page.locator('#btn-export-json').click(); await download;
  const portable: unknown = await (await exported).json();
  await file(page, portable); await expect(page.getByLabel('Resumo do arquivo')).toContainText('Agendamentos: 1');
  await page.locator('#btn-execute-import').click(); await expect(page.locator('#import-result')).toContainText('Importação concluída');
  await page.locator('#btn-check-integrity').click(); await expect(page.getByText('Banco SQLite: OK')).toBeVisible();
  const snapshot = page.waitForEvent('download'); await page.locator('#btn-download-sqlite').click(); await snapshot;
  await page.locator('#nav-scr-history').click(); await expect(page.getByRole('region', { name: 'Tentativas' })).toHaveAttribute('data-state', 'ready');
  await page.getByRole('button', { name: /^Inspecionar / }).click();
  await expect(page.locator('#detail-title')).toHaveText('Agendamento local');
  await page.keyboard.press('Escape');
  await expect(page.locator('#wdg-job-detail')).toHaveCount(0);
});
