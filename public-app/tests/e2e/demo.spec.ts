import { test, expect } from '@playwright/test';
test('landing page, inbox, sample processing, editing and approval', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Less inbox/ })).toBeVisible();
  await page.getByRole('link', { name: 'Meet your calmer inbox' }).click();
  await expect(page.getByRole('heading', { name: 'A little room to breathe.' })).toBeVisible();
  await page.goto('/demo?view=Inbox');
  await page.getByRole('button', { name: 'Use sample response', exact: true }).click();
  await expect(page.getByText('Illustrative sample', { exact: true })).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Edit suggested reply' })
    .fill('Hi Jamie, thanks for your request. A person will review your fictional quote.');
  await page.getByRole('button', { name: 'Approve in demo', exact: true }).click();
  await expect(page.getByText('Approved in demo', { exact: true })).toBeVisible();
  await page.goto('/demo?view=Approvals');
  await expect(
    page.getByText('Hi Jamie, thanks for your request. A person will review your fictional quote.'),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('new tasks persist only in this browser session and reset works', async ({
  page,
  context,
  browser,
}) => {
  await page.goto('/demo?view=Tasks');
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await page.getByLabel('Task title').fill('Prepare a fictional launch checklist');
  await page.getByRole('button', { name: 'Create demo task', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Prepare a fictional launch checklist' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Prepare a fictional launch checklist' }),
  ).toBeVisible();
  const other = await browser.newContext();
  const second = await other.newPage();
  await second.goto('/demo?view=Tasks');
  await expect(
    second.getByRole('heading', { name: 'Prepare a fictional launch checklist' }),
  ).toHaveCount(0);
  await other.close();
  await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset demo', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Prepare a fictional launch checklist' }),
  ).toHaveCount(0);
});
test('navigation, fictional sources, settings and responsive overflow', async ({ page }) => {
  for (const view of [
    'Overview',
    'Inbox',
    'AI studio',
    'Tasks',
    'Approvals',
    'Estimates',
    'Knowledge',
    'Automations',
    'Activity',
    'Integrations',
    'Team',
    'Settings',
  ]) {
    await page.goto(`/demo?view=${encodeURIComponent(view)}`);
    await expect(page.locator('main h1')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.goto('/demo?view=Knowledge');
  await page.getByRole('button', { name: /Product catalog Fictional Northstar catalog/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Fictional Northstar catalog');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.goto('/demo?view=Settings');
  await page.getByLabel('Demo workspace name').fill('Fictional Test Workspace');
  await page.getByLabel('AI response style').selectOption('Formal');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await page.reload();
  await expect(page.getByLabel('Demo workspace name')).toHaveValue('Fictional Test Workspace');
});
test('backend rejects arbitrary text, side effects and cross-origin requests', async ({
  request,
  baseURL,
}) => {
  const endpoint = '/api/demo/process';
  for (const data of [
    { emailId: 'private', tone: 'Formal', mode: 'live' },
    { emailId: 'email-quote', tone: 'Formal', mode: 'live', action: 'send_email' },
    { emailId: 'email-quote', tone: 'Formal', mode: 'live', text: 'private message' },
  ]) {
    const response = await request.post(endpoint, { headers: { origin: baseURL! }, data });
    expect(response.status()).toBe(400);
  }
  const cross = await request.post(endpoint, {
    headers: { origin: 'https://attacker.example.com' },
    data: { emailId: 'email-quote', tone: 'Formal', mode: 'sample' },
  });
  expect(cross.status()).toBe(403);
  for (const endpoint of [
    '/api/zoho/compose',
    '/api/zoho/webhook',
    '/api/assistant/chat',
    '/api/auth/session',
  ])
    expect((await request.post(endpoint)).status()).toBe(404);
  expect((await request.get('/api/cleanup')).status()).toBe(401);
});
