import { expect, test } from './fixtures';
import type { Route } from '@playwright/test';
const json = (route: Route, status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem("SCHEDULE_API_KEY", "synthetic-key")); });

test('contact create conflict preserves draft', async ({ page }) => {
  await page.route('**/contacts', (route) => route.request().resourceType() === 'document' ? route.continue() : route.request().method() === 'POST' ? json(route, 409, { detail: 'Contact conflict' }) : json(route, 200, { contacts: [] }));
  await page.goto('/contacts');
  await page.getByRole('button', { name: 'Add Contact' }).click();
  await page.getByPlaceholder('e.g. Carlos Homelab').fill('Draft Person');
  await page.getByPlaceholder('+5511999990000').fill('123456');
  await page.getByRole('button', { name: 'Save Contact' }).click();
  await expect(page.getByText('Contact conflict')).toBeVisible();
  await expect(page.getByPlaceholder('e.g. Carlos Homelab')).toHaveValue('Draft Person');
  await expect(page.getByText('Contact saved')).toHaveCount(0);
});

test('contact delete conflict retains record', async ({ page }) => {
  await page.route('**/contacts', (route) => route.request().resourceType() === 'document' ? route.continue() : json(route, 200, { contacts: [{ id: 'c1', name: 'Alice', phone: '123456' }] }));
  await page.route('**/contacts/c1', (route) => json(route, 409, { detail: 'Contact in use' }));
  await page.goto('/contacts');
  await page.getByText('Alice').first().click();
  await page.getByTitle('Delete Contact').click();
  await page.getByRole('button', { name: 'Confirm Delete' }).click();
  await expect(page.getByText('Contact in use')).toBeVisible();
  await expect(page.getByText('Alice').first()).toBeVisible();
  await expect(page.getByText(/deleted/)).toHaveCount(0);
});

test('new template conflict preserves draft and unknown tokens', async ({ page }) => {
  await page.route('**/templates', (route) => route.request().resourceType() === 'document' ? route.continue() : route.request().method() === 'POST' ? json(route, 409, { detail: 'Template conflict' }) : json(route, 200, { templates: [{ id: 't1', name: 'Existing', body: 'Original' }] }));
  await page.goto('/templates');
  await page.getByRole('button', { name: 'New Template' }).click();
  await expect(page.getByText('New Template Draft')).toBeVisible();
  await page.getByPlaceholder('e.g. Daily Morning Greeting').fill('Draft');
  await page.locator('textarea').fill('Hello {{unknown}}');
  await expect(page.locator('#live-preview-box')).toContainText('{{unknown}}');
  await page.getByRole('button', { name: 'Save Template' }).click();
  await expect(page.getByText('Template conflict')).toBeVisible();
  await expect(page.locator('textarea')).toHaveValue('Hello {{unknown}}');
});

test('created template survives reload', async ({ page }) => {
  const templates: { id: string; name: string; body: string }[] = [];
  await page.route('**/templates', (route) => {
    if (route.request().resourceType() === 'document') return route.continue();
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON() as { name: string; body: string };
      const created = { id: 'server-id', ...input };
      templates.push(created);
      return json(route, 201, created);
    }
    return json(route, 200, { templates });
  });
  await page.goto('/templates');
  await page.getByPlaceholder('e.g. Daily Morning Greeting').fill('Persisted');
  await page.locator('textarea').fill('Hello {{unknown}}');
  await page.getByRole('button', { name: 'Save Template' }).click();
  await expect(page.getByText('Template saved successfully')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Persisted').first()).toBeVisible();
  expect(templates).toEqual([{ id: 'server-id', name: 'Persisted', body: 'Hello {{unknown}}' }]);
});
