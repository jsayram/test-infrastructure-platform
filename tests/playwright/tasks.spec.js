import { expect, test } from './fixtures.js';
import { TasksPage, WorkspacePage } from './pages.js';

async function seedTask(request, workspace, title) {
  const response = await request.post(workspace.tasksURL, { data: { title }, maxRedirects: 0 });
  expect(response.status()).toBe(201);
}

test('creates a task', async ({ tasks }) => {
  await tasks.add('Calibrate instrument');
  await expect(tasks.row('Calibrate instrument').getByText('Open', { exact: true })).toBeVisible();
});

test('completes a task', async ({ request, workspace, page }) => {
  const title = 'Verify specimen';
  await seedTask(request, workspace, title);
  await new WorkspacePage(page).open(workspace.name);
  const tasks = new TasksPage(page);
  await tasks.complete(title);
  await expect(tasks.row(title).getByText('Completed', { exact: true })).toBeVisible();
});

test('deletes a task', async ({ request, workspace, page }) => {
  const title = 'Discard test fixture';
  await seedTask(request, workspace, title);
  await new WorkspacePage(page).open(workspace.name);
  const tasks = new TasksPage(page);
  await expect(tasks.row(title)).toBeVisible();
  await tasks.remove(title);
  await expect(tasks.row(title)).toHaveCount(0);
});

test('keeps the form usable after an API error', async ({ page, tasks }) => {
  const route = '**/api/users/*/tasks';
  const intercept = async (request) => {
    if (request.request().method() !== 'POST') return request.fallback();
    await request.fulfill({ status: 503, json: { error: 'Test-only outage' } });
  };
  await page.route(route, intercept);
  await tasks.add('Retry calibration');
  await expect(tasks.error).toHaveText('Could not add the task. Try again.');
  await expect(tasks.title).toHaveValue('Retry calibration');
  await expect(tasks.row('Retry calibration')).toHaveCount(0);
  await page.unroute(route, intercept);
  await tasks.addButton.click();
  await expect(tasks.row('Retry calibration')).toBeVisible();
  await expect(tasks.error).toBeHidden();
});
