const healthButton = document.querySelector('#check-health');
const healthStatus = document.querySelector('#api-status');
const signIn = document.querySelector('#sign-in');
const signInForm = document.querySelector('#sign-in-form');
const taskSection = document.querySelector('#tasks');
const taskForm = document.querySelector('#task-form');
const taskList = document.querySelector('#task-list');
const emptyList = document.querySelector('#empty-list');
const errorMessage = document.querySelector('#task-error');
let activeUser;
let tasks = [];
let busy = false;

async function checkHealth() {
  healthButton.disabled = true;
  healthStatus.textContent = 'Checking API health...';
  try {
    const response = await fetch('/health', { signal: AbortSignal.timeout(5000) });
    if (!response.ok || (await response.json()).status !== 'ok') throw new Error('Unexpected response');
    healthStatus.textContent = 'API is healthy.';
  } catch {
    healthStatus.textContent = 'API health check failed. Try again.';
  } finally {
    healthButton.disabled = false;
  }
}

async function api(path, method = 'GET', body) {
  const options = { method, signal: AbortSignal.timeout(5000) };
  if (body) {
    options.headers = { 'content-type': 'application/json' };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(path, options);
  if (response.status === 204) return null;
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function openUser(name) {
  const lookup = '/api/users?name=' + encodeURIComponent(name);
  try {
    return await api(lookup);
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  try {
    return await api('/api/users', 'POST', { name });
  } catch (error) {
    if (error.status !== 409) throw error;
    return api(lookup);
  }
}

async function runAction(message, action) {
  if (busy) return;
  busy = true;
  errorMessage.hidden = true;
  const controls = [...document.querySelectorAll('#sign-in button, #tasks button')];
  controls.forEach((control) => { control.disabled = true; });
  try {
    await action();
  } catch {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
  } finally {
    controls.forEach((control) => { control.disabled = false; });
    busy = false;
  }
}

function taskPath(id = '') {
  return '/api/users/' + activeUser.id + '/tasks' + (id ? '/' + id : '');
}

function taskButton(label, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', handler);
  return button;
}

function renderTasks() {
  emptyList.hidden = tasks.length > 0;
  taskList.replaceChildren();
  for (const task of tasks) {
    const row = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = task.title;
    const state = document.createElement('span');
    state.textContent = task.completed ? 'Completed' : 'Open';
    const complete = taskButton(task.completed ? 'Reopen' : 'Complete', () => {
      runAction('Could not update the task. Try again.', async () => {
        const updated = await api(taskPath(task.id), 'PATCH', { completed: !task.completed });
        tasks = tasks.map((item) => item.id === task.id ? updated : item);
        renderTasks();
      });
    });
    const remove = taskButton('Delete', () => {
      runAction('Could not delete the task. Try again.', async () => {
        await api(taskPath(task.id), 'DELETE');
        tasks = tasks.filter((item) => item.id !== task.id);
        renderTasks();
      });
    });
    row.append(title, ' ', state, complete, remove);
    taskList.append(row);
  }
}

signInForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = new FormData(signInForm).get('name').trim();
  runAction('Could not open the workspace. Check the demo name and try again.', async () => {
    const user = await openUser(name);
    const userTasks = await api('/api/users/' + user.id + '/tasks');
    activeUser = user;
    tasks = userTasks;
    document.querySelector('#active-user').textContent = 'Workspace: ' + user.name;
    signIn.hidden = true;
    taskSection.hidden = false;
    renderTasks();
    document.querySelector('#task-title').focus();
  });
});

taskForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = new FormData(taskForm).get('title').trim();
  runAction('Could not add the task. Try again.', async () => {
    const task = await api(taskPath(), 'POST', { title });
    tasks.push(task);
    taskForm.reset();
    renderTasks();
    document.querySelector('#task-title').focus();
  });
});

document.querySelector('#sign-out').addEventListener('click', () => {
  activeUser = undefined;
  tasks = [];
  taskForm.reset();
  errorMessage.hidden = true;
  taskSection.hidden = true;
  signIn.hidden = false;
  document.querySelector('#demo-name').focus();
});

healthButton.addEventListener('click', checkHealth);
checkHealth();
