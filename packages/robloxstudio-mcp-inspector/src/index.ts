import { RobloxStudioMCPServer, getReadOnlyTools } from '@robloxstudio-mcp/core';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { version: VERSION } = require('../package.json');

const server = new RobloxStudioMCPServer({
  name: 'Boshyxd Plugin Remake Inspector',
  version: VERSION,
  tools: getReadOnlyTools(),
});

server.run().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
