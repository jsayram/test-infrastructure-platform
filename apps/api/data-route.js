import { json } from './app.js';

const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const namePattern = /^[a-zA-Z0-9][a-zA-Z0-9 _-]{0,39}$/;
const badInput = (message) => json(400, { error: message });
const missing = (entity) => json(404, { error: entity + ' not found' });
const conflict = () => json(409, { error: 'Demo name already exists' });
const allowed = (method) => ['POST', 'PATCH'].includes(method);
const demoName = (value) => typeof value === 'string' && namePattern.test(value.trim()) ? value.trim() : null;
const taskTitle = (value) => typeof value === 'string' && value.trim().length <= 100 ? value.trim() : null;

export async function dataRoute(request, store) {
  const url = new URL(request.url, 'http://localhost');
  const match = /^\/api\/users(?:\/([^/]+)(?:\/tasks(?:\/([^/]+))?)?)?$/.exec(url.pathname);
  if (!match) return missing('Route');

  const [, userId, taskId] = match;
  if ((userId && !uuid.test(userId)) || (taskId && !uuid.test(taskId))) return badInput('Invalid ID');

  const isTask = url.pathname.includes('/tasks');
  const methods = taskId || (userId && !isTask)
    ? 'GET, PATCH, DELETE'
    : 'GET, POST';
  const { method } = request;
  if (!methods.split(', ').includes(method)) {
    return json(405, { error: 'Method not allowed' }, { allow: methods });
  }
  if (!store) return json(503, { error: 'The task database is unavailable' });

  try {
    const body = allowed(method) ? await readJson(request) : null;
    if (allowed(method) && body === null) return badInput('Send a JSON object');

    if (!userId) {
      const name = demoName(method === 'GET' ? url.searchParams.get('name') : body.name);
      if (!name) return badInput('Use a demo name of 1 to 40 letters, numbers, spaces, underscores, or hyphens');
      if (method === 'POST') {
        const user = await store.createUser(name);
        return user ? json(201, user) : conflict();
      }
      const user = await store.findUser(name);
      return user ? json(200, user) : missing('User');
    }

    if (!isTask) return await userRoute(method, userId, body, store);
    return await taskRoute(method, userId, taskId, body, store);
  } catch (error) {
    if (error instanceof BodyTooLarge) return json(413, { error: 'Request body is too large' });
    if (error.code === '23505') return conflict();
    if (error.code === '23503') return missing('User');
    console.error('Task database request failed');
    return json(503, { error: 'The task database is unavailable' });
  }
}

async function userRoute(method, id, body, store) {
  if (method === 'DELETE') return await store.deleteUser(id) ? noContent() : missing('User');
  let user;
  if (method === 'PATCH') {
    const name = demoName(body.name);
    if (!name) return badInput('Send a valid demo name');
    user = await store.renameUser(id, name);
  } else {
    user = await store.getUser(id);
  }
  return user ? json(200, user) : missing('User');
}

async function taskRoute(method, userId, taskId, body, store) {
  if (!taskId) {
    if (method === 'GET') {
      const tasks = await store.listTasks(userId);
      return tasks ? json(200, tasks) : missing('User');
    }
    const title = taskTitle(body.title);
    if (!title) return badInput('Use a task title of 1 to 100 characters');
    const task = await store.createTask(userId, title);
    return task ? json(201, task) : missing('User');
  }

  if (method === 'DELETE') {
    return await store.deleteTask(userId, taskId) ? noContent() : missing('Task');
  }

  let task;
  if (method === 'PATCH') {
    const hasTitle = Object.hasOwn(body, 'title');
    const hasCompleted = Object.hasOwn(body, 'completed');
    const title = hasTitle ? taskTitle(body.title) : null;
    const completed = hasCompleted ? body.completed : null;
    if ((!hasTitle && !hasCompleted) || (hasTitle && !title) || (hasCompleted && typeof completed !== 'boolean')) {
      return badInput('Send a valid title, a completion boolean, or both');
    }
    task = await store.updateTask(userId, taskId, title, completed);
  } else {
    task = await store.getTask(userId, taskId);
  }
  return task ? json(200, task) : missing('Task');
}

function noContent() {
  return { status: 204, headers: { 'cache-control': 'no-store' }, body: '' };
}

class BodyTooLarge extends Error {}

async function readJson(request) {
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') return null;

  const chunks = [];
  let length = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    length += chunk.length;
    if (length > 16384) {
      request.resume();
      throw new BodyTooLarge();
    }
    chunks.push(chunk);
  }

  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
