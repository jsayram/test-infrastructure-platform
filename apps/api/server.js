import { createServer } from 'node:http';
import { route } from './app.js';

const host = '127.0.0.1';
const port = Number(process.env.PORT ?? '3000');
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error('PORT must be an integer from 1024 to 65535.');
  process.exit(1);
}

const server = createServer((request, response) => {
  const result = route(request.method, request.url);
  response.writeHead(result.status, result.headers);
  response.end(result.body);
});

server.on('error', (error) => {
  console.error(`Could not start the server on ${host}:${port}: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`Listening at http://${host}:${port}`);
});
