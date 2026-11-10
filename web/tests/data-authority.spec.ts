import { expect, test } from './fixtures';

const validBundle = {
  contacts: [{ id: 'c-1', name: 'Real Contact', phone: '+5511999999999' }],
  templates: [],
  jobs: [],
  job_runs: [],
};

const summary = {
  contacts: { created: 1, updated: 0, skipped: 0 },
  templates: { created: 0, updated: 0, skipped: 0 },
  jobs: { created: 0, updated: 0, skipped: 0 },
  job_runs: { created: 0, updated: 0, skipped: 0 },
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('SCHEDULE_API_KEY', 'synthetic-key'));
});

test('failed SQLite or JSON downloads create no file and report error', async ({ page }) => {
  await page.route('**/backup/database', (route) =>
    route.fulfill({ status: 500, contentType: 'text/html', body: 'Error generating snapshot' })
  );
  await page.route('**/backup/export?*', (route) =>
    route.fulfill({ status: 500, json: { detail: 'export failed' } })
  );

  await page.goto('/data');
  await expect(page.locator('#scr-data')).toBeVisible();

  let downloads = 0;
  page.on('download', () => {
    downloads++;
  });

  // Failed SQLite binary download
  await page.locator('#btn-download-sqlite').click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(downloads).toBe(0);
  await expect(page.locator('#btn-download-sqlite')).toBeEnabled();

  // Failed JSON data bundle export
  await page.locator('#btn-export-json').click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(downloads).toBe(0);
  await expect(page.locator('#btn-export-json')).toBeEnabled();
});

test('integrity diagnostics start unverified, report real details and clear stale results on error', async ({ page }) => {
  let mode: 'anomalies' | 'error' | 'ok' = 'anomalies';

  await page.route('**/backup/integrity', (route) => {
    if (mode === 'anomalies') {
      return route.fulfill({
        json: {
          integrity_ok: false,
          details: ['Página inconsistente'],
          foreign_keys_ok: false,
          fk_violations: [{ table: 'jobs', rowid: 5, parent: 'contacts', fkid: 0 }],
        },
      });
    }
    if (mode === 'error') {
      return route.fulfill({ status: 502, json: { detail: 'Banco indisponível' } });
    }
    return route.fulfill({
      json: {
        integrity_ok: true,
        details: ['ok'],
        foreign_keys_ok: true,
        fk_violations: [],
      },
    });
  });

  await page.goto('/data');
  // Initial state: not verified yet, never claims OK
  await expect(page.getByText('Banco SQLite: OK')).toHaveCount(0);
  await expect(page.getByText('All Invariants Verified')).toHaveCount(0);

  // 1. Run diagnostics with anomalies
  await page.locator('#btn-check-integrity').click();
  await expect(page.getByText('Página inconsistente')).toBeVisible();
  await expect(page.getByText('jobs · registro 5 · referência contacts · chave 0')).toBeVisible();
  await expect(page.getByText('Banco SQLite: OK')).toHaveCount(0);

  // 2. Run diagnostics returning 502 error - stale results must clear
  mode = 'error';
  await page.locator('#btn-check-integrity').click();
  await expect(page.getByRole('alert')).toContainText('Banco indisponível');
  await expect(page.getByText('Página inconsistente')).toHaveCount(0);
  await expect(page.getByText('jobs · registro 5 · referência contacts · chave 0')).toHaveCount(0);
  await expect(page.getByText('Banco SQLite: OK')).toHaveCount(0);

  // 3. Run diagnostics returning clean OK
  mode = 'ok';
  await page.locator('#btn-check-integrity').click();
  await expect(page.getByText('Banco SQLite: OK')).toBeVisible();
});

test('import validates bundle structure, preserves drafts on failure and guards replace mode', async ({ page }) => {
  await page.goto('/data');

  // Helper to trigger file upload
  const uploadJson = async (content: string) => {
    await page.locator('#input-import-file').evaluate((element, text) => {
      const input = element as HTMLInputElement;
      const dt = new DataTransfer();
      dt.items.add(new File([text], 'bundle.json', { type: 'application/json' }));
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, content);
  };

  // 1. Syntax error
  await uploadJson('{ bad json');
  await expect(page.getByRole('alert')).toContainText('JSON inválido');
  await expect(page.locator('#btn-execute-import')).toHaveCount(0);

  // 2. Malformed bundle schema
  await uploadJson(JSON.stringify({ contacts: 'not an array' }));
  await expect(page.getByRole('alert')).toContainText('Formato inválido');
  await expect(page.locator('#btn-execute-import')).toHaveCount(0);

  // 3. Valid bundle staging
  await uploadJson(JSON.stringify(validBundle));
  await expect(page.getByLabel('Resumo do arquivo')).toContainText('Contatos: 1');
  await expect(page.locator('#btn-execute-import')).toBeVisible();

  // 4. Server error preserves draft
  await page.route('**/backup/import', (route) =>
    route.fulfill({ status: 422, json: { detail: 'Referência ausente' } })
  );
  await page.locator('#btn-execute-import').click();
  await expect(page.getByRole('alert')).toContainText('Referência ausente');
  // Staged draft retained
  await expect(page.getByLabel('Resumo do arquivo')).toContainText('Contatos: 1');
  await expect(page.locator('#btn-execute-import')).toBeVisible();

  // 5. Replace mode double confirmation cancellation
  await page.getByRole('radio', { name: 'Substituir', exact: false }).check();
  await page.locator('#btn-execute-import').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar substituição' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#btn-execute-import')).toBeFocused();

  // 6. Successful import
  let importCalls = 0;
  await page.route('**/backup/import', (route) => {
    importCalls++;
    return route.fulfill({
      json: {
        status: 'imported',
        mode: 'merge',
        summary,
        warnings: ['Rotina YAML ignorada'],
      },
    });
  });
  await page.getByRole('radio', { name: 'Mesclar', exact: false }).check();
  await page.locator('#btn-execute-import').click();

  await expect(page.locator('#import-result')).toContainText('Importação concluída');
  await expect(page.locator('#import-result')).toContainText('1 criados, 0 atualizados, 0 ignorados');
  await expect(page.locator('#import-result')).toContainText('Rotina YAML ignorada');
  expect(importCalls).toBe(1);
  await expect(page.locator('#btn-execute-import')).toHaveCount(0);
});
