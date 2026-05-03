import { test, expect } from '@playwright/test';

test('intercept supabase tasks request', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('response', async response => {
    if (response.url().includes('/rest/v1/tasks') && response.status() >= 400) {
      const text = await response.text();
      console.log('SUPABASE ERROR RESPONSE:', response.status(), text);
    }
  });

  await page.goto('http://localhost:3000');
  await page.waitForTimeout(5000);

  const html = await page.content();
  console.log("HTML:", html.substring(0, 500));
});
