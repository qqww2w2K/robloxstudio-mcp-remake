import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import http from 'http';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHttpServer, listenWithRetry } from './http-server.js';
import { RobloxStudioTools } from './tools/index.js';
import { BridgeService } from './bridge-service.js';
import { ProxyBridgeService } from './proxy-bridge-service.js';
import type { ToolDefinition } from './tools/definitions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServerConfig {
  name: string;
  version: string;
  tools: ToolDefinition[];
}

export class RobloxStudioMCPServer {
  private server: Server;
  private tools: RobloxStudioTools;
  private bridge: BridgeService;
  private allowedToolNames: Set<string>;
  private config: ServerConfig;
  private sharedApp: any | undefined;

  constructor(config: ServerConfig) {
    this.config = config;
    this.allowedToolNames = new Set(config.tools.map(t => t.name));

    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.bridge = new BridgeService();
    this.tools = new RobloxStudioTools(this.bridge);
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.config.tools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Update last active agent for dashboard
      if (this.sharedApp) {
        this.sharedApp.lastAgent = 'Gemini CLI (AI)';
      }

      if (!this.allowedToolNames.has(name)) {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
      }

      try {
        if (this.sharedApp && this.sharedApp.addActivityLog) {
          let logType = 'activity';
          if (name.includes('script')) logType = 'script';
          else if (name.includes('property') || name.includes('object')) logType = 'prop';
          
          let logMsg = `AI: ${name.replace(/_/g, ' ')}`;
          
          if (name === 'create_object') {
            const n = (args as any).name || (args as any).className;
            const p = (args as any).parent;
            logMsg = `AI: Add Object ${p}.${n}`;
          } else if (name === 'set_script_source') {
            logMsg = `AI: Update Script ${(args as any).instancePath}`;
          } else if (args && (args as any).instancePath) {
            logMsg += ` on ${(args as any).instancePath}`;
          } else if (args && (args as any).query) {
            logMsg += ` for ${(args as any).query}`;
          }
          
          this.sharedApp.addActivityLog(logType, logMsg, JSON.stringify(args));
        }

        switch (name) {
          case 'get_file_tree':
            return await this.tools.getFileTree((args as any)?.path || '');
          case 'search_files':
            return await this.tools.searchFiles((args as any)?.query as string, (args as any)?.searchType || 'name');

          case 'get_place_info':
            return await this.tools.getPlaceInfo();
          case 'get_services':
            return await this.tools.getServices((args as any)?.serviceName);
          case 'search_objects':
            return await this.tools.searchObjects((args as any)?.query as string, (args as any)?.searchType || 'name', (args as any)?.propertyName);

          case 'get_instance_properties':
            return await this.tools.getInstanceProperties((args as any)?.instancePath as string, (args as any)?.excludeSource);
          case 'get_instance_children':
            return await this.tools.getInstanceChildren((args as any)?.instancePath as string);
          case 'search_by_property':
            return await this.tools.searchByProperty((args as any)?.propertyName as string, (args as any)?.propertyValue as string);
          case 'get_class_info':
            return await this.tools.getClassInfo((args as any)?.className as string);
          case 'get_project_structure':
            return await this.tools.getProjectStructure((args as any)?.path, (args as any)?.maxDepth, (args as any)?.scriptsOnly);

          case 'set_property':
            return await this.tools.setProperty((args as any)?.instancePath as string, (args as any)?.propertyName as string, (args as any)?.propertyValue);
          case 'mass_set_property':
            return await this.tools.massSetProperty((args as any)?.paths as string[], (args as any)?.propertyName as string, (args as any)?.propertyValue);
          case 'mass_get_property':
            return await this.tools.massGetProperty((args as any)?.paths as string[], (args as any)?.propertyName as string);
          case 'set_calculated_property':
            return await this.tools.setCalculatedProperty((args as any)?.paths as string[], (args as any)?.propertyName as string, (args as any)?.formula as string, (args as any)?.variables);
          case 'set_relative_property':
            return await this.tools.setRelativeProperty((args as any)?.paths as string[], (args as any)?.propertyName as string, (args as any)?.operation as any, (args as any)?.value, (args as any)?.component);

          case 'create_object':
            return await this.tools.createObject((args as any)?.className as string, (args as any)?.parent as string, (args as any)?.name, (args as any)?.properties);
          case 'mass_create_objects':
            return await this.tools.massCreateObjects((args as any)?.objects as any[]);
          case 'delete_object':
            return await this.tools.deleteObject((args as any)?.instancePath as string);
          case 'smart_duplicate':
            return await this.tools.smartDuplicate((args as any)?.instancePath as string, (args as any)?.count as number, (args as any)?.options);
          case 'mass_duplicate':
            return await this.tools.massDuplicate((args as any)?.duplications as any[]);

          case 'get_script_source':
            return await this.tools.getScriptSource((args as any)?.instancePath as string, (args as any)?.startLine, (args as any)?.endLine);
          case 'set_script_source':
            return await this.tools.setScriptSource((args as any)?.instancePath as string, (args as any)?.source as string);
          case 'edit_script_lines':
            return await this.tools.editScriptLines((args as any)?.instancePath as string, (args as any)?.startLine as number, (args as any)?.endLine as number, (args as any)?.newContent as string);
          case 'insert_script_lines':
            return await this.tools.insertScriptLines((args as any)?.instancePath as string, (args as any)?.afterLine as number, (args as any)?.newContent as string);
          case 'delete_script_lines':
            return await this.tools.deleteScriptLines((args as any)?.instancePath as string, (args as any)?.startLine as number, (args as any)?.endLine as number);

          case 'get_attribute':
            return await this.tools.getAttribute((args as any)?.instancePath as string, (args as any)?.attributeName as string);
          case 'set_attribute':
            return await this.tools.setAttribute((args as any)?.instancePath as string, (args as any)?.attributeName as string, (args as any)?.attributeValue, (args as any)?.valueType);
          case 'get_attributes':
            return await this.tools.getAttributes((args as any)?.instancePath as string);
          case 'delete_attribute':
            return await this.tools.deleteAttribute((args as any)?.instancePath as string, (args as any)?.attributeName as string);

          case 'get_tags':
            return await this.tools.getTags((args as any)?.instancePath as string);
          case 'add_tag':
            return await this.tools.addTag((args as any)?.instancePath as string, (args as any)?.tagName as string);
          case 'remove_tag':
            return await this.tools.removeTag((args as any)?.instancePath as string, (args as any)?.tagName as string);
          case 'get_tagged':
            return await this.tools.getTagged((args as any)?.tagName as string);

          case 'get_selection':
            return await this.tools.getSelection();
          case 'execute_luau':
            return await this.tools.executeLuau((args as any)?.code as string);
          case 'grep_scripts':
            return await this.tools.grepScripts(args as any);

          case 'start_playtest':
            return await this.tools.startPlaytest((args as any)?.mode as any);
          case 'stop_playtest':
            return await this.tools.stopPlaytest();
          case 'get_playtest_output':
            return await this.tools.getPlaytestOutput();

          case 'undo':
            return await this.tools.undo();
          case 'redo':
            return await this.tools.redo();
          case 'history_control':
            return await this.tools.historyControl((args as any)?.action as any, (args as any)?.waypoint_name);

          case 'export_build':
            return await this.tools.exportBuild((args as any)?.instancePath as string, (args as any)?.style, (args as any)?.outputId);
          case 'create_build':
            return await this.tools.createBuild(
              (args as any)?.id,
              (args as any)?.style,
              (args as any)?.palette,
              (args as any)?.parts,
              (args as any)?.bounds
            );
          case 'generate_build':
            return await this.tools.generateBuild(
              (args as any)?.id,
              (args as any)?.style,
              (args as any)?.palette,
              (args as any)?.code,
              (args as any)?.seed
            );
          case 'import_build':
            return await this.tools.importBuild((args as any)?.buildData, (args as any)?.targetPath as string, (args as any)?.position);
          case 'list_library':
            return await this.tools.listLibrary((args as any)?.style);
          case 'get_build':
            return await this.tools.getBuild((args as any)?.id as string);
          case 'import_scene':
            return await this.tools.importScene((args as any)?.sceneData, (args as any)?.targetPath);

          case 'search_materials':
            return await this.tools.searchMaterials((args as any)?.query, (args as any)?.maxResults);

          case 'search_assets':
            return await this.tools.searchAssets((args as any)?.assetType as any, (args as any)?.query as string, (args as any)?.sortBy as any, (args as any)?.verifiedCreatorsOnly);
          case 'get_asset_details':
            return await this.tools.getAssetDetails((args as any)?.assetId as number);
          case 'get_asset_thumbnail':
            return await this.tools.getAssetThumbnail((args as any)?.assetId as number, (args as any)?.size as any);
          case 'insert_asset':
            return await this.tools.insertAsset(args as any);
          case 'preview_asset':
            return await this.tools.previewAsset((args as any)?.assetId as number, (args as any)?.maxDepth, (args as any)?.includeProperties);

          case 'capture_screenshot':
            return await this.tools.captureScreenshot();
          case 'capture_viewport':
            return await this.tools.captureViewport((args as any)?.action as any, (args as any)?.highlight_path, (args as any)?.resolution);

          case 'control_selection':
            return await this.tools.controlSelection((args as any)?.action as any, (args as any)?.paths, (args as any)?.properties);
          case 'validate_pathfinding':
            return await this.tools.validatePathfinding((args as any)?.action as any, (args as any)?.start, (args as any)?.goal, (args as any)?.agent_params);
          case 'analyze_performance':
            return await this.tools.analyzePerformance((args as any)?.action as any, (args as any)?.target_path, (args as any)?.iterations);
          case 'check_collisions':
            return await this.tools.checkCollisions(args as any);
          case 'manage_datastore':
            return await this.tools.manageDatastore(args as any);
          case 'build_library':
            return await this.tools.buildLibrary(args as any);
          case 'run_tests':
            return await this.tools.runTests(args as any);
          case 'generate_terrain':
            return await this.tools.generateTerrain(args as any);
          case 'control_lighting':
            return await this.tools.controlLighting(args as any);
          case 'sync_project':
            return await this.tools.syncProject(args as any);
          case 'control_audio_animation':
            return await this.tools.controlAudioAnimation(args as any);
          case 'manage_places':
            return await this.tools.managePlaces(args as any);

          case 'monitor_remotes':
            return await this.tools.monitorRemotes(args as any);
          case 'map_dependencies':
            return await this.tools.mapDependencies(args as any);
          case 'find_variable_leaks':
            return await this.tools.findVariableLeaks(args as any);
          case 'scan_anticheat':
            return await this.tools.scanAnticheat(args as any);
          case 'auto_place':
            return await this.tools.autoPlace(args as any);
          case 'mirror_instances':
            return await this.tools.mirrorInstances(args as any);
          case 'snap_to_grid':
            return await this.tools.snapToGrid(args as any);
          case 'paint_surfaces':
            return await this.tools.paintSurfaces(args as any);
          case 'track_changes':
            return await this.tools.trackChanges(args as any);
          case 'manage_backups':
            return await this.tools.manageBackups(args as any);
          case 'insert_comments':
            return await this.tools.insertComments(args as any);
          case 'fix_naming':
            return await this.tools.fixNaming(args as any);
          case 'build_cutscene':
            return await this.tools.buildCutscene(args as any);
          case 'generate_lod':
            return await this.tools.generateLod(args as any);
          case 'simulate_physics':
            return await this.tools.simulatePhysics(args as any);
          case 'generate_script':
            return await this.tools.generateScript(args as any);
          case 'diff_instances':
            return await this.tools.diffInstances(args as any);
          case 'build_context':
            return await this.tools.buildContext(args as any);

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) throw error;
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  async run() {
    const basePort = process.env.ROBLOX_STUDIO_PORT ? parseInt(process.env.ROBLOX_STUDIO_PORT) : 58741;
    const host = process.env.ROBLOX_STUDIO_HOST || '0.0.0.0';
    let bridgeMode: 'primary' | 'proxy' = 'primary';
    let httpHandle: http.Server | undefined;
    let boundPort = 0;
    let promotionInterval: ReturnType<typeof setInterval> | undefined;

    // Create shared app
    this.sharedApp = createHttpServer(this.tools, this.bridge, this.allowedToolNames);

    // Try to bind as primary
    try {
      const result = await listenWithRetry(this.sharedApp, host, basePort, 5);
      httpHandle = result.server;
      boundPort = result.port;
      console.error(`HTTP server listening on ${host}:${boundPort} for Studio plugin (primary mode)`);
      
      if (this.sharedApp && this.sharedApp.setMCPServerActive) {
        this.sharedApp.setMCPServerActive(true);
      }

      // Open dashboard automatically
      const dashboardUrl = `http://localhost:${boundPort}/dashboard`;
      const startCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
      exec(`${startCmd} "" "${dashboardUrl}"`, (err) => {
        if (err) console.error('Failed to auto-open dashboard:', err);
      });
    } catch {
      // All ports in use — fall back to proxy mode
      bridgeMode = 'proxy';
      const proxyBridge = new ProxyBridgeService(`http://localhost:${basePort}`);
      this.bridge = proxyBridge;
      this.tools = new RobloxStudioTools(this.bridge);
      console.error(`All ports ${basePort}-${basePort + 4} in use — entering proxy mode (forwarding to localhost:${basePort})`);

      // Periodically try to promote to primary if the port frees up
      const promotionIntervalMs = parseInt(process.env.ROBLOX_STUDIO_PROXY_PROMOTION_INTERVAL_MS || '5000');
      promotionInterval = setInterval(async () => {
        try {
          this.bridge = new BridgeService();
          this.tools = new RobloxStudioTools(this.bridge);
          // Update handlers to use new bridge/tools
          this.setupToolHandlers();

          const result = await listenWithRetry(this.sharedApp, host, basePort, 5);
          httpHandle = result.server;
          boundPort = result.port;
          bridgeMode = 'primary';
          this.sharedApp.setMCPServerActive(true);
          console.error(`Promoted from proxy to primary on port ${boundPort}`);
          if (promotionInterval) clearInterval(promotionInterval);
        } catch {
          // Still can't bind — stay in proxy mode, restore proxy bridge
          this.bridge = new ProxyBridgeService(`http://localhost:${basePort}`);
          this.tools = new RobloxStudioTools(this.bridge);
          this.setupToolHandlers();
        }
      }, promotionIntervalMs);
    }

    // Legacy port 3002 for old plugins
    const LEGACY_PORT = 3002;
    let legacyHandle: http.Server | undefined;
    if (boundPort !== LEGACY_PORT && bridgeMode === 'primary') {
      try {
        const result = await listenWithRetry(this.sharedApp, host, LEGACY_PORT, 1);
        legacyHandle = result.server;
        console.error(`Legacy HTTP server also listening on ${host}:${LEGACY_PORT} for old plugins`);
        this.sharedApp.setMCPServerActive(true);
      } catch {
        // Fallback or ignore
      }
    }

    // Start MCP server on stdio
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP server running on stdio');

    // Handle process termination
    process.on('SIGINT', () => {
      if (promotionInterval) clearInterval(promotionInterval);
      if (httpHandle) httpHandle.close();
      if (legacyHandle) legacyHandle.close();
      process.exit(0);
    });
  }
}
