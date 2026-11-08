import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('SCHEDULE_API_KEY', 'synthetic-test-key'));
});

for (const width of [320, 390, 768, 1440]) {
  test(`shell controls fit and remain labelled at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/contacts');
    const controls = page.locator('.shell-navigation a, .shell-header button');
    for (const control of await controls.all()) {
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
      await expect(control).not.toHaveText('');
    }
    await page.screenshot({ path: `/tmp/homelab-shell-${width}.png`, fullPage: true, animations: 'disabled' });
    await page.getByTitle('Configurações da API', { exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Acesso à API' })).toBeVisible();
    await expect(page.locator('#input-api-key')).toHaveCSS('font-size', '16px');
    const dialog = await page.locator('#api-key-modal').boundingBox();
    expect(dialog!.x).toBeGreaterThanOrEqual(0);
    expect(dialog!.x + dialog!.width).toBeLessThanOrEqual(width);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  });
}

for (const width of [640, 1440]) {
  test(`shell reflows at 200% zoom in a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/contacts');
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    for (const control of await page.locator('.shell-navigation a, .shell-header button').all()) {
      const box = await control.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    await page.getByTitle('Configurações da API', { exact: true }).click();
    await expect(page.locator('#input-api-key')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  });
}

test('original navigation, active state, browser history and skip link work', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#nav-scr-contacts')).toHaveAttribute('aria-current', 'page');
  await page.locator('#nav-scr-jobs').click();
  await expect(page.locator('#scr-jobs')).toBeVisible();
  await page.locator('#nav-scr-templates').click();
  await expect(page.locator('#scr-templates')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#nav-scr-jobs')).toHaveAttribute('aria-current', 'page');
  await page.goForward();
  await expect(page.locator('#nav-scr-templates')).toHaveAttribute('aria-current', 'page');
  await page.locator('.shell-skip').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('dialog traps Tab, blocks background and restores trigger focus', async ({ page }) => {
  await page.goto('/contacts');
  const trigger = page.getByTitle('Configurações da API', { exact: true });
  await trigger.click();
  const close = page.getByRole('button', { name: 'Fechar', exact: true });
  await expect(close).toBeFocused();
  await expect(page.locator('.app-shell')).toHaveAttribute('inert', '');
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#api-key-modal')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator('.app-shell')).not.toHaveAttribute('inert');
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('Escape closes only the top modal and returns focus to its parent', async ({ page }) => {
  await page.goto('/jobs');
  const trigger = page.locator('#btn-open-create-modal');
  await trigger.click();
  const addContact = page.getByRole('button', { name: /Adicionar Contato/ });
  await addContact.click();
  await expect(page.getByRole('dialog', { name: 'Selecionar Contato' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#wdg-contact-pick')).toHaveCount(0);
  await expect(page.locator('#wdg-job-create')).toBeVisible();
  await expect(addContact).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#wdg-job-create')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('both backup entry points remain usable', async ({ page }) => {
  await page.goto('/contacts');
  for (const id of ['btn-open-backup-modal-sidebar', 'btn-open-backup-modal-header']) {
    await page.locator(`#${id}`).click();
    await expect(page.getByRole('dialog', { name: 'Backup & Dados SQLite' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator(`#${id}`)).toBeFocused();
  }
});

for (const value of ['light', 'dark', 'system']) {
  test(`theme selection persists and follows the OS only in system mode: ${value}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/contacts');
    await page.locator(`#theme-btn-${value}`).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', value);
    await page.reload();
    await expect(page.locator(`#theme-btn-${value}`)).toHaveAttribute('aria-pressed', 'true');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveClass(value === 'light' ? '' : 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveClass(value === 'dark' ? 'dark' : '');
  });
}

for (const theme of ['light', 'dark', 'system']) {
  test(`theme is correct before application hydration: ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript((value) => localStorage.setItem('homelab_theme', value), theme);
    await page.route('**/src/main.ts', (route) => route.abort());
    await page.goto('/contacts');
    await expect(page.locator('#app')).toBeEmpty();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('html')).toHaveClass(theme === 'light' ? '' : 'dark');
  });
}

test('saved settings announce status through the shared live region', async ({ page }) => {
  await page.goto('/contacts');
  await page.getByTitle('Configurações da API', { exact: true }).click();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Configurações salvas localmente no navegador.');
  await expect(page.getByRole('status')).toHaveAttribute('aria-live', 'polite');
});

test('reduced motion removes dialog, toast and press movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/contacts');
  await page.getByTitle('Configurações da API', { exact: true }).click();
  await expect(page.locator('#api-key-modal')).toHaveCSS('animation-name', 'none');
  const save = page.getByRole('button', { name: 'Salvar', exact: true });
  await save.hover();
  await page.mouse.down();
  await expect(save).toHaveCSS('transform', 'none');
  await page.mouse.up();
  await expect(page.locator('#toast-notify')).toHaveCSS('transform', 'none');
  await expect(page.locator('#toast-notify')).toHaveCSS('transition-duration', '0s');
});

async function _contrast(page: Page, selector: string, foreground: 'color' | 'outlineColor' | 'borderTopColor'): Promise<number> {
  return page.locator(selector).evaluate((element, property) => {
    const style = getComputedStyle(element);
    const luminance = (color: string): number => {
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((n) => {
        const value = n / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const values = [luminance(style[property]), luminance(style.backgroundColor)].sort((a, b) => a - b);
    return (values[1] + 0.05) / (values[0] + 0.05);
  }, foreground);
}

for (const theme of ['light', 'dark']) {
  test(`shared text, field boundary and focus contrast meet targets: ${theme}`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('homelab_theme', value), theme);
    await page.goto('/contacts');
    await page.getByTitle('Configurações da API', { exact: true }).click();
    await page.locator('#input-api-key').focus();
    expect(await _contrast(page, '#input-api-key', 'color')).toBeGreaterThanOrEqual(4.5);
    expect(await _contrast(page, '#input-api-key', 'borderTopColor')).toBeGreaterThanOrEqual(3);
    expect(await _contrast(page, '#input-api-key', 'outlineColor')).toBeGreaterThanOrEqual(3);
    expect(await _contrast(page, '.ui-button[data-variant="primary"]', 'color')).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: `/tmp/homelab-access-${theme}.png`, fullPage: true, animations: 'disabled' });
  });
}


test('access dialog preserves optional relative base URL settings', async ({ page }) => {
  await page.goto('/contacts');
  const trigger = page.getByTitle('Configurações da API', { exact: true });
  await trigger.click();
  await page.locator('#input-base-url').fill('/synthetic-proxy/');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('#api-key-modal')).toHaveCount(0);
  await trigger.click();
  await expect(page.locator('#input-base-url')).toHaveValue('/synthetic-proxy/');
  await page.keyboard.press('Escape');
});
