# RobloxStudio MCP Remake

[![npm version](https://img.shields.io/npm/v/robloxstudio-mcp-remake.svg)](https://www.npmjs.com/package/robloxstudio-mcp-remake)
[![license](https://img.shields.io/npm/l/robloxstudio-mcp-remake.svg)](https://github.com/qqww2w2K/robloxstudio-mcp-remake/blob/main/LICENSE)

Enhanced Roblox Studio MCP server with 92+ tools for AI-powered game development. Built on top of [boshyxd/robloxstudio-mcp](https://github.com/boshyxd/robloxstudio-mcp).

## Features

- **Terrain Generation**: Fill regions with materials, flatten, and procedural generation.
- **Lighting Control**: Presets (sunset, midnight, etc.) and fine-grained atmosphere management.
- **Bidirectional Sync**: Real-time script and property synchronization between Studio and Local.
- **Audio & Animation**: Insert, play, and manage sounds and animations directly.
- **Multi-place Support**: Isolated environments for up to 3 places.
- **Performance Analyzer**: Benchmark scripts, find heavy operations, and optimize meshes.
- **Anti-cheat Scanner**: Identify suspicious patterns and exploit vulnerabilities.
- **Physics Simulator**: Preview falls, check stability, and calculate mass.
- **Cutscene Builder**: Create, preview, and export camera keyframes and tweens.
- **LOD Generator**: Automatic Level of Detail variants for meshes.
- **And much more**: DataStore management, pathfinding validation, instance diffing, etc.

## Installation

### Claude Code
```bash
claude mcp add robloxstudio -- npx -y robloxstudio-mcp-remake@latest
```

### Gemini CLI
```bash
gemini mcp add robloxstudio npx --trust -- -y robloxstudio-mcp-remake@latest
```

### JSON Configuration
```json
{
  "mcpServers": {
    "robloxstudio": {
      "command": "npx",
      "args": ["-y", "robloxstudio-mcp-remake@latest"]
    }
  }
}
```

## Credits
Based on the original work by [boshyxd/robloxstudio-mcp](https://github.com/boshyxd/robloxstudio-mcp).
Remake by **ItsQuentar**.
