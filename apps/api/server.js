import { createServer } from 'node:http';
import { json, route } from './app.js';
import { dataRoute } from './data-route.js';

const host = process.env.BIND_HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? '3000');
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error('PORT must be an integer from 1024 to 65535.');
  process.exit(1);
}

const store = process.env.DB_HOST
  ? (await import('./store.js')).createStore(process.env)
  : null;

async function ready() {
  try {
    if (!store) return json(503, { status: 'unavailable' });
    await store.ready();
    return json(200, { status: 'ready' });
  } catch {
    return json(503, { status: 'unavailable' });
  }
}

const server = createServer({ requestTimeout: 10000, headersTimeout: 5000 }, async (request, response) => {
  let result;
  try {
    const path = request.url.split('?', 1)[0];
    if (path.startsWith('/api/')) result = await dataRoute(request, store);
    else if (path === '/ready' && request.method === 'GET') result = await ready();
    else result = route(request.method, request.url);
  } catch {
    result = json(500, { error: 'Request failed' });
  }
  response.writeHead(result.status, result.headers);
  response.end(result.body);
});

server.on('error', (error) => {
  console.error('Could not start the server on ' + host + ':' + port + ': ' + error.message);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log('Listening at http://' + host + ':' + port);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => store?.close()));
}
