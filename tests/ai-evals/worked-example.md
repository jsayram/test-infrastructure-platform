# Worked AI test review

This personal-project example used Ollama 0.40.11 and the pinned local Llama 3.2 model. The saved review ID was `401bf78d-8949-406e-a36c-427fca131a64`. The AI generated the initial recipe. The agent made the worked revision below. Human approval remains pending, and both versions remain outside the main suite.

## Change and acceptance criterion

Complete a task using the Complete button. The existing check confirms the title stays visible after the action. The acceptance criterion also requires the task row to switch to Completed.

## Actual model draft

The model returned `{"journey":"complete","observation":"visible"}`. The trusted renderer produced this candidate. Import paths here are rendered for the proposed destination in the main Playwright directory.

```js
import { expect, test } from "./fixtures.js";
import { TasksPage, WorkspacePage } from "./pages.js";

test('AI draft complete task', async ({ page, workspace, baseURL }) => {
  const origin = new URL(baseURL).origin;
  await page.route('**/*', (route) => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort());
  await new WorkspacePage(page).open(workspace.name);
  const tasks = new TasksPage(page);
  await expect(tasks.heading).toBeVisible();
  const title = 'AI eval calibration';
  const itemPattern = workspace.tasksURL + '/';
  async function perform(method, path, action) {
    await Promise.all([page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.origin === origin && url.pathname.startsWith(path) && response.request().method() === method;
    }), action()]);
  }
  await perform('POST', workspace.tasksURL, () => tasks.add(title));
  await expect(tasks.row(title)).toBeVisible();
  await perform('PATCH', itemPattern, () => tasks.complete(title));
  await expect(tasks.row(title), 'intent:visible').toBeVisible();
});
```

## Observed scores

| Version | Runs | Intended behavior | Stable selectors | Cleanup | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Model draft | 1 | 0 | 1 | 1 | 3/4 |
| Worked revision | 1 | 1 | 1 | 1 | 4/4 |

Both versions passed against the healthy app. The eval then changed the completion PATCH response to return completed false. That mutation reached the browser. The draft still passed because the title remained visible. The revision failed at the intent:completed assertion. Both baseline and regression workspaces were deleted for each version.

The saved score entries were recorded at 2026-11-05T02:17:57.054Z and 2026-11-05T02:18:01.429Z. Reproduce fresh scores with the commands in [the eval runbook](README.md). Local JSON evidence stays in the ignored review and run folders.

## Worked revision candidate

Changing observation from visible to completed produces the candidate below. This file is documentation of the candidate. The promotion preview was checked. A person must still review the selectors, data isolation, flake risk, and coverage before approving its exact evaluated digest.

```js
import { expect, test } from "./fixtures.js";
import { TasksPage, WorkspacePage } from "./pages.js";

test('AI draft complete task', async ({ page, workspace, baseURL }) => {
  const origin = new URL(baseURL).origin;
  await page.route('**/*', (route) => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort());
  await new WorkspacePage(page).open(workspace.name);
  const tasks = new TasksPage(page);
  await expect(tasks.heading).toBeVisible();
  const title = 'AI eval calibration';
  const itemPattern = workspace.tasksURL + '/';
  async function perform(method, path, action) {
    await Promise.all([page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.origin === origin && url.pathname.startsWith(path) && response.request().method() === method;
    }), action()]);
  }
  await perform('POST', workspace.tasksURL, () => tasks.add(title));
  await expect(tasks.row(title)).toBeVisible();
  await perform('PATCH', itemPattern, () => tasks.complete(title));
  await expect(tasks.row(title).getByText('Completed', { exact: true }), 'intent:completed').toBeVisible();
});
```

AI drafts, humans verify, metrics decide. The controlled regression supplies evidence for this completion assertion. Promotion requires interactive confirmation and a matching 4/4 recipe digest.
