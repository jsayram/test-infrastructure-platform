import { createHash } from 'node:crypto';
import { dirname, relative, sep } from 'node:path';

export const journeys = ['create', 'complete', 'delete'];
const observations = ['visible', 'open', 'completed', 'missing'];
export const observationFor = {
  create: ['visible', 'open'],
  complete: ['completed'],
  delete: ['missing'],
};

export const schema = {
  type: 'object',
  properties: {
    journey: { type: 'string', enum: journeys },
    observation: { type: 'string', enum: observations },
  },
  required: ['journey', 'observation'],
  additionalProperties: false,
};

export function validateRecipe(value) {
  if (!value || typeof value !== 'object' || Object.keys(value).length !== 2 ||
      !journeys.includes(value.journey) || !observations.includes(value.observation)) {
    throw new Error('Draft must contain one allowed journey and one allowed observation');
  }
  return { journey: value.journey, observation: value.observation };
}

export function digest(recipe) {
  return createHash('sha256').update(JSON.stringify(validateRecipe(recipe))).digest('hex');
}

const actions = {
  complete: "  await perform('PATCH', itemPattern, () => tasks.complete(title));\n",
  delete: "  await perform('DELETE', itemPattern, () => tasks.remove(title));\n",
};

const stateLocators = {
  open: ".getByText('Open', { exact: true })",
  completed: ".getByText('Completed', { exact: true })",
};

function relativeImport(output, target) {
  const path = relative(dirname(output), target).split(sep).join('/');
  return path.startsWith('.') ? path : './' + path;
}

export function render(recipe, output, root, { audit = false, regression } = {}) {
  const { journey, observation } = validateRecipe(recipe);
  const fixture = relativeImport(output, root + '/tests/playwright/fixtures.js');
  const pages = relativeImport(output, root + '/tests/playwright/pages.js');
  const subject = 'tasks.row(title)' + (stateLocators[observation] ?? '');
  const check = observation === 'missing' ? 'toHaveCount(0)' : 'toBeVisible()';
  const lines = [
    "import { expect, test } from " + JSON.stringify(fixture) + ";",
    "import { TasksPage, WorkspacePage } from " + JSON.stringify(pages) + ";",
    "",
    "test('AI draft " + journey + " task', async ({ page, workspace, baseURL }) => {",
    "  const origin = new URL(baseURL).origin;",
    "  await page.route('**/*', (route) => new URL(route.request().url()).origin === origin",
    "    ? route.continue() : route.abort());",
    "  await new WorkspacePage(page).open(workspace.name);",
    "  const tasks = new TasksPage(page);",
    "  await expect(tasks.heading).toBeVisible();",
    "  const title = 'AI eval calibration';",
  ];
  if (audit) lines.push(
    "  await test.info().attach('workspace-id', { body: workspace.id, contentType: 'text/plain' });",
  );
  if (journey !== 'create') lines.push("  const itemPattern = workspace.tasksURL + '/';");
  if (regression) {
    const method = { create: 'POST', complete: 'PATCH', delete: 'DELETE' }[regression];
    const pattern = regression === 'create' ? 'workspace.tasksURL' : "workspace.tasksURL + '/*'";
    lines.push(
      "  await page.route(origin + " + pattern + ", async (route) => {",
      "    if (route.request().method() !== '" + method + "') return route.fallback();",
      "    await test.info().attach('regression-applied', { body: '" + regression + "', contentType: 'text/plain' });",
    );
    if (regression === 'complete') lines.push(
      "    const response = await route.fetch({ maxRedirects: 0 });",
      "    const task = await response.json();",
      "    await route.fulfill({ response, json: { ...task, completed: false } });",
    );
    else lines.push("    await route.fulfill({ status: 503, json: { error: 'Controlled regression' } });");
    lines.push("  });");
  }
  lines.push(
    "  async function perform(method, path, action) {",
    "    await Promise.all([page.waitForResponse((response) => {",
    "      const url = new URL(response.url());",
    "      return url.origin === origin && url.pathname.startsWith(path) && response.request().method() === method;",
    "    }), action()]);",
    "  }",
    "  await perform('POST', workspace.tasksURL, () => tasks.add(title));",
  );
  if (journey !== 'create') lines.push("  await expect(tasks.row(title)).toBeVisible();", actions[journey].trimEnd());
  lines.push("  await expect(" + subject + ", 'intent:" + observation + "')." + check + ";", "});", "");
  return lines.join('\n');
}
