import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    // No external fonts, telemetry or production endpoints may leave the browser.
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      return url.origin === 'http://127.0.0.1:15173' ? route.continue() : route.abort();
    });
    await use(page);
  },
});

export { expect };
