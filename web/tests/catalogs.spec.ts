import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { Contact, MessageTemplate } from '../src/lib/types';

const contact: Contact = { id: 'contact-test', name: 'Test Contact', phone: 'test-recipient' };
const template: MessageTemplate = { id: 'template-test', name: 'Lembrete', body: 'Olá {{name}}, pagar a conta.' };
const tags = ['name', 'greeting', 'greeting_lower', 'saudacao', 'saudacao_lower', 'period', 'date', 'date_iso', 'time', 'weekday', 'day_name', 'month_name', 'year', 'day', 'month', 'hour', 'minute'];

test.use({ timezoneId: 'America/Sao_Paulo' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('SCHEDULE_API_KEY', 'synthetic-test-key'));
  await page.clock.setFixedTime(new Date('2035-11-08T15:00:00Z'));
});
async function _contacts(page: Page, contacts: Contact[] = [{ ...contact }]): Promise<Contact[]> {
  await page.route('**/contacts', route => route.request().isNavigationRequest() || route.request().method() !== 'GET' ? route.fallback() : route.fulfill({ json: { contacts } }));
  await page.route(/\/contacts\/(contact-test|second-contact)$/, route => {
    if (route.request().method() !== 'GET' || route.request().isNavigationRequest()) return route.fallback();
    const selected = contacts.find(item => route.request().url().endsWith(`/${item.id}`));
    return route.fulfill({ status: selected ? 200 : 404, json: selected ?? { detail: 'Contato não encontrado' } });
  });
  return contacts;
}
async function _templates(page: Page, templates: MessageTemplate[] = [{ ...template }]): Promise<MessageTemplate[]> {
  await page.route('**/templates', route => route.request().isNavigationRequest() || route.request().method() !== 'GET' ? route.fallback() : route.fulfill({ json: { templates } }));
  return templates;
}
async function _fillContact(page: Page): Promise<void> { await page.locator('#contact-name').fill('Novo contato'); await page.locator('#contact-phone').fill('synthetic-new-recipient'); }
async function _fillTemplate(page: Page): Promise<void> { await page.locator('#template-name-input').fill('Novo modelo'); await page.locator('#template-body-input').fill('Uma mensagem'); }

test('contact directory searches name, phone and ID locally and distinguishes no match', async ({ page }) => {
  await _contacts(page, [contact, { id: 'second-contact', name: 'Financeiro', phone: 'finance-recipient' }]);
  await page.goto('/contacts');
  await expect(page.locator('#contact-count-badge')).toHaveText('2 de 2');
  for (const query of ['FINANCEIRO', 'finance-recipient', 'second-contact']) {
    await page.locator('#search-input').fill(query);
    await expect(page.locator('#contact-rows-container a')).toHaveCount(1);
    await expect(page.locator('#contact-rows-container')).toContainText('Financeiro');
  }
  await page.locator('#search-input').fill('missing');
  await expect(page.locator('#no-contacts-found')).toContainText('corresponde à busca');
});

test('contact creation sends exact payload, prevents duplicates and refreshes catalog', async ({ page }) => {
  const contacts = await _contacts(page);
  const bodies: unknown[] = [];
  await page.route('**/contacts', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    bodies.push(route.request().postDataJSON() as unknown);
    await new Promise(resolve => setTimeout(resolve, 150));
    const created = { id: 'new-contact', name: 'Novo contato', phone: 'synthetic-new-recipient' };
    contacts.push(created);
    await route.fulfill({ status: 201, json: created });
  });
  await page.goto('/contacts');
  await _fillContact(page);
  await page.locator('#btn-submit-contact').dblclick();
  await expect(page.locator('#contact-name')).toHaveValue('');
  await expect(page.locator('#contact-rows-container')).toContainText('Novo contato');
  expect(bodies).toEqual([{ name: 'Novo contato', phone: 'synthetic-new-recipient' }]);
});

for (const status of [401, 409, 422]) {
  test(`contact creation HTTP ${status} retains draft for explicit retry`, async ({ page }) => {
    await _contacts(page);
    let calls = 0;
    await page.route('**/contacts', route => {
      if (route.request().method() !== 'POST') return route.fallback();
      calls++; return route.fulfill({ status, json: { detail: `Falha sintética ${status}` } });
    });
    await page.goto('/contacts');
    await _fillContact(page);
    await page.locator('#btn-submit-contact').click();
    await expect(page.locator('#api-feedback')).toBeVisible();
    await expect(page.locator('#contact-name')).toHaveValue('Novo contato');
    await expect(page.locator('#contact-phone')).toHaveValue('synthetic-new-recipient');
    expect(calls).toBe(1);
  });
}

test('contact edits send only changed fields, unchanged save is local, phone change reloads scoped jobs', async ({ page }) => {
  const contacts = await _contacts(page);
  const patches: unknown[] = [];
  const phones: string[] = [];
  await page.route('**/contacts/contact-test', route => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    const payload: { name?: string; phone?: string } = route.request().postDataJSON() as { name?: string; phone?: string };
    patches.push(payload); contacts[0] = { ...contacts[0], ...payload };
    return route.fulfill({ json: contacts[0] });
  });
  await page.route('**/jobs?*', route => { phones.push(new URL(route.request().url()).searchParams.get('phone') ?? ''); return route.fulfill({ json: { jobs: [] } }); });
  await page.goto('/contacts/contact-test');
  await page.locator('#btn-save-contact').click();
  await expect(page.locator('#toast-notify')).toContainText('Nenhuma alteração');
  expect(patches).toEqual([]);
  await page.locator('#input-edit-name').fill('Novo nome');
  await page.locator('#btn-save-contact').click();
  await expect(page.locator('#wdg-contact-header')).toContainText('Novo nome');
  expect(patches).toEqual([{ name: 'Novo nome' }]);
  await page.locator('#input-edit-phone').fill('changed-recipient');
  await page.locator('#btn-save-contact').click();
  await expect.poll(() => phones.at(-1)).toBe('changed-recipient');
  await expect(page.locator('#create-created-by')).toHaveValue('changed-recipient');
  expect(patches[1]).toEqual({ phone: 'changed-recipient' });
});

test('contact discard restores identity and status filter preserves union phone query', async ({ page }) => {
  await _contacts(page);
  const queries: string[] = [];
  await page.route('**/jobs?*', route => { queries.push(new URL(route.request().url()).search); return route.fulfill({ json: { jobs: [] } }); });
  await page.goto('/contacts/contact-test');
  await page.locator('#input-edit-name').fill('Rascunho');
  await page.getByRole('button', { name: 'Descartar', exact: true }).click();
  await expect(page.locator('#input-edit-name')).toHaveValue(contact.name);
  await page.locator('#contact-jobs-status').selectOption('all');
  await expect.poll(() => new URLSearchParams(queries.at(-1)).get('status')).toBe('all');
  expect(new URLSearchParams(queries.at(-1)).get('phone')).toBe(contact.phone);
  expect(new URLSearchParams(queries.at(-1)).has('to')).toBeFalsy();
});

test('contact deletion cancels without request, retains conflict, then accepts 204 and navigates', async ({ page }) => {
  await _contacts(page);
  let calls = 0;
  await page.route('**/contacts/contact-test', route => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    calls++; return calls === 1 ? route.fulfill({ status: 409, json: { detail: 'Conflict' } }) : route.fulfill({ status: 204 });
  });
  await page.goto('/contacts/contact-test');
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#btn-delete-contact').click();
  expect(calls).toBe(0);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#btn-delete-contact').click();
  await expect(page.locator('#scr-contact').getByRole('alert')).toContainText('agendamentos ativos');
  await expect(page.locator('#wdg-contact-header')).toContainText(contact.name);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#btn-delete-contact').click();
  await expect(page).toHaveURL('/contacts');
  expect(calls).toBe(2);
});

test('contact missing state and scoped-job failure remain visible and independently retryable', async ({ page }) => {
  await _contacts(page, []);
  await page.goto('/contacts/contact-test');
  await expect(page.locator('#scr-contact').getByRole('alert')).toContainText('Contato não encontrado');
  await page.unroute(/\/contacts\/(contact-test|second-contact)$/);
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.locator('#wdg-contact-header')).toContainText('Test Contact');
  await page.route('**/jobs?*', route => route.fulfill({ status: 502, json: { detail: 'Falha nos recados' } }));
  await page.getByRole('button', { name: 'Atualizar recados', exact: true }).click();
  await expect(page.locator('#wdg-job-list')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#wdg-contact-header')).toBeVisible();
  await page.unroute('**/jobs?*');
  await page.getByRole('button', { name: 'Tentar carregar recados', exact: true }).click();
  await expect(page.locator('#wdg-job-list')).toHaveAttribute('data-state', 'empty');
});

test('catalog navigation keeps direct routes and back/forward behavior', async ({ page }) => {
  await _contacts(page);
  await page.goto('/');
  await page.locator('#contact-rows-container a').click();
  await expect(page).toHaveURL('/contacts/contact-test');
  await page.reload();
  await expect(page.locator('#input-edit-name')).toHaveValue(contact.name);
  await page.getByRole('link', { name: 'Voltar para Contatos', exact: true }).click();
  await page.goBack();
  await expect(page.locator('#wdg-contact-header')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#wdg-contact-list')).toBeVisible();
});

test('template catalog searches name, ID and body, then loads and resets editor with counters', async ({ page }) => {
  await _templates(page, [template, { id: 'second-template', name: 'Financeiro', body: 'Saldo da conta' }]);
  await page.goto('/templates');
  for (const query of ['FINANCEIRO', 'second-template', 'saldo']) {
    await page.locator('#filter-template-input').fill(query);
    await expect(page.locator('#template-card-container li')).toHaveCount(1);
  }
  await page.getByRole('button', { name: 'Editar Financeiro', exact: true }).click();
  await expect(page.locator('#template-name-input')).toHaveValue('Financeiro');
  await expect(page.locator('#name-counter')).toHaveText('10/80');
  await expect(page.locator('#body-counter')).toHaveText('14 caracteres');
  await page.locator('#btn-reset-form').click();
  await expect(page.locator('#template-name-input')).toHaveValue('');
  await expect(page.locator('#template-body-input')).toHaveValue('');
  await expect(page.locator('#form-title')).toHaveText('Novo modelo');
});

test('template create and edit use exact payloads and refresh list', async ({ page }) => {
  const templates = await _templates(page);
  const requests: { method: string; body: unknown }[] = [];
  await page.route(/\/templates(?:\/template-test)?$/, route => {
    const method = route.request().method();
    if (!['POST', 'PATCH'].includes(method)) return route.fallback();
    const body: unknown = route.request().postDataJSON();
    requests.push({ method, body });
    if (method === 'POST') templates.push({ id: 'created-template', name: 'Novo modelo', body: 'Uma mensagem' });
    else templates[0] = { ...template, body: 'Mensagem alterada' };
    return route.fulfill({ status: method === 'POST' ? 201 : 200, json: templates[0] });
  });
  await page.goto('/templates');
  await _fillTemplate(page);
  await page.locator('#btn-submit-template').click();
  await expect(page.locator('#template-card-container')).toContainText('Novo modelo');
  await page.getByRole('button', { name: 'Editar Lembrete', exact: true }).click();
  await page.locator('#template-body-input').fill('Mensagem alterada');
  await page.locator('#btn-submit-template').click();
  await expect(page.locator('#template-card-container')).toContainText('Mensagem alterada');
  expect(requests).toEqual([{ method: 'POST', body: { name: 'Novo modelo', body: 'Uma mensagem' } }, { method: 'PATCH', body: { name: template.name, body: 'Mensagem alterada' } }]);
});

for (const status of [409, 422]) {
  test(`template save HTTP ${status} preserves draft and only explicit retry resubmits`, async ({ page }) => {
    await _templates(page);
    let calls = 0;
    await page.route('**/templates', route => { if (route.request().method() !== 'POST') return route.fallback(); calls++; return route.fulfill({ status, json: { detail: 'Falha no modelo' } }); });
    await page.goto('/templates');
    await _fillTemplate(page);
    await page.locator('#btn-submit-template').click();
    await expect(page.locator('#template-editor-form').getByRole('alert')).toBeVisible();
    await expect(page.locator('#template-body-input')).toHaveValue('Uma mensagem');
    expect(calls).toBe(1);
    await page.locator('#btn-submit-template').click();
    await expect.poll(() => calls).toBe(2);
  });
}

test('template deletion honors confirmation, retains referenced record on 409 and resets deleted selection', async ({ page }) => {
  const templates = await _templates(page);
  let calls = 0;
  await page.route('**/templates/template-test', route => {
    calls++;
    if (calls === 1) return route.fulfill({ status: 409, json: { detail: 'Referenced' } });
    templates.splice(0); return route.fulfill({ status: 204 });
  });
  await page.goto('/templates');
  await page.getByRole('button', { name: 'Editar Lembrete', exact: true }).click();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Excluir Lembrete', exact: true }).click();
  expect(calls).toBe(0);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Excluir Lembrete', exact: true }).click();
  await expect(page.locator('#delete-conflict-alert')).toContainText('agendamentos ativos');
  await expect(page.locator('#template-name-input')).toHaveValue(template.name);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Excluir Lembrete', exact: true }).click();
  await expect(page.locator('#template-name-input')).toHaveValue('');
  await expect(page.locator('#wdg-template-list')).toHaveAttribute('data-state', 'empty');
});

test('all 17 placeholder buttons insert at cursor and replacement restores textarea focus', async ({ page }) => {
  await _templates(page);
  await page.goto('/templates');
  const body = page.locator('#template-body-input');
  for (const tag of tags) {
    await body.fill('abXXcd');
    await body.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(2, 4));
    await page.getByRole('button', { name: `Inserir {{${tag}}}`, exact: true }).click();
    await expect(body).toHaveValue(`ab{{${tag}}}cd`);
    await expect(body).toBeFocused();
    expect(await body.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(2 + tag.length + 4);
  }
});

test('preview is illustrative, resolves contextual/date values and keeps custom unknown tags literal', async ({ page }) => {
  await _templates(page);
  await page.goto('/templates');
  await page.locator('#template-body-input').fill('{{greeting}} {{greeting_lower}} {{saudacao}} {{saudacao_lower}} {{period}} {{name}} {{date_iso}} {{day_name}} {{month_name}} {{ticket}}');
  await expect(page.locator('#live-preview-box')).toHaveText('Boa tarde boa tarde Boa tarde boa tarde tarde Carlos Silva 2035-11-08 quinta-feira novembro {{ticket}}');
  await expect(page.locator('#unknown-tags-warning')).toContainText('{{ticket}}');
  await expect(page.getByText('Prévia ilustrativa', { exact: true })).toBeVisible();
  await page.clock.setFixedTime(new Date('2035-11-09T01:30:00Z'));
  await page.locator('#template-body-input').fill('{{date_iso}} {{hour}}:{{minute}} {{unknown}}');
  await expect(page.locator('#live-preview-box')).toHaveText('2035-11-08 22:30 {{unknown}}');
});

for (const path of ['/contacts', '/templates']) {
  test(`catalog ${path} exposes failed read separately from empty and supports retry`, async ({ page }) => {
    await page.route(`**${path}`, route => route.request().isNavigationRequest() ? route.fallback() : route.fulfill({ status: 502, json: { detail: 'Falha no catálogo' } }));
    await page.goto(path);
    await expect(page.locator(path === '/contacts' ? '#wdg-contact-list' : '#wdg-template-list')).toHaveAttribute('data-state', 'error');
    await page.unroute(`**${path}`);
    await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
    await expect(page.locator(path === '/contacts' ? '#wdg-contact-list' : '#wdg-template-list')).toHaveAttribute('data-state', path === '/contacts' ? 'ready' : 'empty');
  });
}

for (const width of [320, 390, 768, 1440]) {
  test(`catalog workspaces fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await _contacts(page);
    await _templates(page);
    for (const path of ['/contacts', '/contacts/contact-test', '/templates']) {
      await page.goto(path);
      await expect(page.locator(path === '/contacts' ? '#contact-name' : path.includes('contact-test') ? '#input-edit-name' : '#template-name-input')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    }
    if (width === 390 || width === 1440) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: `/tmp/homelab-models-${width}.png`, fullPage: true });
    }
  });
}

test('template in-flight save disables editor selection, reset and deletion and sends once', async ({ page }) => {
  await _templates(page);
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  await page.route('**/templates', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    calls++; await held; await route.fulfill({ status: 201, json: template });
  });
  await page.goto('/templates');
  await _fillTemplate(page);
  await page.locator('#btn-submit-template').click();
  await expect.poll(() => calls).toBe(1);
  await expect(page.locator('#template-name-input')).toBeDisabled();
  await expect(page.locator('#btn-reset-form')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Editar Lembrete', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Excluir Lembrete', exact: true })).toBeDisabled();
  await page.locator('#template-editor-form').dispatchEvent('submit');
  expect(calls).toBe(1);
  release();
  await expect(page.locator('#btn-submit-template')).toBeEnabled();
  await expect(page.locator('#template-name-input')).toHaveValue('');
});

test('successful contact creation followed by failed refresh clears draft instead of inviting duplicate creation', async ({ page }) => {
  let created = false;
  let calls = 0;
  await page.route('**/contacts', route => {
    if (route.request().isNavigationRequest()) return route.fallback();
    if (route.request().method() === 'POST') { calls++; created = true; return route.fulfill({ status: 201, json: contact }); }
    return created ? route.fulfill({ status: 502, json: { detail: 'Falha ao atualizar catálogo' } }) : route.fulfill({ json: { contacts: [] } });
  });
  await page.goto('/contacts');
  await _fillContact(page);
  await page.locator('#btn-submit-contact').click();
  await expect(page.locator('#wdg-contact-list')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#contact-name')).toHaveValue('');
  await expect(page.locator('#toast-notify')).toContainText('Contato adicionado');
  expect(calls).toBe(1);
});

test('invalid contact and template drafts make no mutation requests', async ({ page }) => {
  await _contacts(page);
  await _templates(page);
  const requests: string[] = [];
  page.on('request', request => { if (['POST', 'PATCH', 'DELETE'].includes(request.method())) requests.push(request.url()); });
  await page.goto('/contacts');
  await page.locator('#contact-name').fill('   ');
  await page.locator('#contact-phone').fill('valid');
  await page.locator('#btn-submit-contact').click();
  await expect(page.locator('#api-feedback')).toBeVisible();
  await page.goto('/templates');
  await page.locator('#template-name-input').fill('   ');
  await page.locator('#template-body-input').fill('message');
  await page.locator('#btn-submit-template').click();
  await expect(page.locator('#template-editor-form').getByRole('alert')).toBeVisible();
  expect(requests).toEqual([]);
});

test('contact save conflict preserves the edit draft and identity', async ({ page }) => {
  await _contacts(page);
  await page.route('**/contacts/contact-test', route => route.request().method() === 'PATCH' ? route.fulfill({ status: 409, json: { detail: 'Duplicate name' } }) : route.fallback());
  await page.goto('/contacts/contact-test');
  await page.locator('#input-edit-name').fill('Duplicate name');
  await page.locator('#btn-save-contact').click();
  await expect(page.locator('#contact-edit-feedback')).toContainText('já está cadastrado');
  await expect(page.locator('#input-edit-name')).toHaveValue('Duplicate name');
  await expect(page.locator('#wdg-contact-header')).toContainText(contact.name);
});

test('dark reduced-motion catalogs retain reachable controls at 200% zoom', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('homelab_theme', 'dark'));
  await _contacts(page);
  await _templates(page);
  for (const path of ['/contacts', '/contacts/contact-test', '/templates']) {
    await page.goto(path);
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    const field = page.locator(path === '/contacts' ? '#contact-name' : path.includes('contact-test') ? '#input-edit-name' : '#template-name-input');
    await field.scrollIntoViewIfNeeded();
    await expect(field).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.evaluate(() => { document.documentElement.style.zoom = '1'; window.scrollTo({ top: 0, behavior: 'instant' }); });
    await page.screenshot({ path: `/tmp/homelab-catalog-dark-${path.replaceAll('/', '-')}.png`, fullPage: true });
  }
});
