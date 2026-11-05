import { randomUUID } from 'node:crypto';
import { expect, test as base } from '@playwright/test';
import { TasksPage, WorkspacePage } from './pages.js';

export { expect };

export const test = base.extend({
  workspace: async ({ request }, use) => {
    const created = await request.post('/api/users', {
      data: { name: 'pw-' + randomUUID() },
      maxRedirects: 0,
    });
    expect(created.status()).toBe(201);
    const user = await created.json();
    const url = '/api/users/' + user.id;
    try {
      await use({ ...user, tasksURL: url + '/tasks' });
    } finally {
      const removed = await request.delete(url, { maxRedirects: 0 });
      expect(removed.status()).toBe(204);
    }
  },
  tasks: async ({ page, workspace }, use) => {
    await new WorkspacePage(page).open(workspace.name);
    const tasks = new TasksPage(page);
    await expect(tasks.heading).toBeVisible();
    await use(tasks);
  },
});
