import { RobloxStudioMCPServer, getAllTools } from './packages/core/dist/index.js';

const server = new RobloxStudioMCPServer({
  name: 'test-server',
  version: '1.0.0',
  tools: getAllTools(),
});

console.error('Starting server...');
server.run().then(() => {
  console.error('Server.run() resolved');
}).catch((err) => {
  console.error('Server.run() rejected:', err);
});

setTimeout(() => {
  console.error('Test timeout - server stayed alive for 5s');
  process.exit(0);
}, 5000);
