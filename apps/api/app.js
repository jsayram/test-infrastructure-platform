import { readFileSync } from 'node:fs';

export const json = (status, body, headers) => ({
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  body: JSON.stringify(body),
});

const webRoutes = new Map([
  ['/', ['index.html', 'text/html']],
  ['/app.js', ['app.js', 'text/javascript']],
]);

export function route(method, target) {
  const path = target.split('?', 1)[0];
  const asset = webRoutes.get(path);
  if (path !== '/health' && !asset) {
    return json(404, { error: 'Not found' });
  }
  if (method !== 'GET') {
    return json(405, { error: 'Method not allowed' }, { allow: 'GET' });
  }
  if (path === '/health') {
    return json(200, { status: 'ok' });
  }

  const [file, mimeType] = asset;
  return {
    status: 200,
    headers: { 'content-type': `${mimeType}; charset=utf-8` },
    body: readFileSync(new URL(`../web/${file}`, import.meta.url)),
  };
}
