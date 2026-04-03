import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { RobloxStudioTools } from './tools/index.js';
import { BridgeService } from './bridge-service.js';
import { TOOL_DEFINITIONS } from './tools/definitions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ToolHandler = (tools: RobloxStudioTools, body: any) => Promise<any>;

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  get_file_tree: (tools, body) => tools.getFileTree(body.path),
  search_files: (tools, body) => tools.searchFiles(body.query, body.searchType),
  get_place_info: (tools) => tools.getPlaceInfo(),
  get_services: (tools, body) => tools.getServices(body.serviceName),
  search_objects: (tools, body) => tools.searchObjects(body.query, body.searchType, body.propertyName),
  get_instance_properties: (tools, body) => tools.getInstanceProperties(body.instancePath, body.excludeSource),
  get_instance_children: (tools, body) => tools.getInstanceChildren(body.instancePath),
  search_by_property: (tools, body) => tools.searchByProperty(body.propertyName, body.propertyValue),
  get_class_info: (tools, body) => tools.getClassInfo(body.className),
  get_project_structure: (tools, body) => tools.getProjectStructure(body.path, body.maxDepth, body.scriptsOnly),
  set_property: (tools, body) => tools.setProperty(body.instancePath, body.propertyName, body.propertyValue),
  mass_set_property: (tools, body) => tools.massSetProperty(body.paths, body.propertyName, body.propertyValue),
  mass_get_property: (tools, body) => tools.massGetProperty(body.paths, body.propertyName),
  create_object: (tools, body) => tools.createObject(body.className, body.parent, body.name, body.properties),
  create_object_with_properties: (tools, body) => tools.createObject(body.className, body.parent, body.name, body.properties),
  mass_create_objects: (tools, body) => tools.massCreateObjects(body.objects),
  mass_create_objects_with_properties: (tools, body) => tools.massCreateObjects(body.objects),
  delete_object: (tools, body) => tools.deleteObject(body.instancePath),
  smart_duplicate: (tools, body) => tools.smartDuplicate(body.instancePath, body.count, body.options),
  mass_duplicate: (tools, body) => tools.massDuplicate(body.duplications),
  set_calculated_property: (tools, body) => tools.setCalculatedProperty(body.paths, body.propertyName, body.formula, body.variables),
  set_relative_property: (tools, body) => tools.setRelativeProperty(body.paths, body.propertyName, body.operation, body.value, body.component),
  grep_scripts: (tools, body) => tools.grepScripts(body.pattern, {
    caseSensitive: body.caseSensitive,
    usePattern: body.usePattern,
    contextLines: body.contextLines,
    maxResults: body.maxResults,
    maxResultsPerScript: body.maxResultsPerScript,
    filesOnly: body.filesOnly,
    path: body.path,
    classFilter: body.classFilter,
  }),
  get_script_source: (tools, body) => tools.getScriptSource(body.instancePath, body.startLine, body.endLine),
  set_script_source: (tools, body) => tools.setScriptSource(body.instancePath, body.source),
  edit_script_lines: (tools, body) => tools.editScriptLines(body.instancePath, body.startLine, body.endLine, body.newContent),
  insert_script_lines: (tools, body) => tools.insertScriptLines(body.instancePath, body.afterLine, body.newContent),
  delete_script_lines: (tools, body) => tools.deleteScriptLines(body.instancePath, body.startLine, body.endLine),
  get_attribute: (tools, body) => tools.getAttribute(body.instancePath, body.attributeName),
  set_attribute: (tools, body) => tools.setAttribute(body.instancePath, body.attributeName, body.attributeValue, body.valueType),
  get_attributes: (tools, body) => tools.getAttributes(body.instancePath),
  delete_attribute: (tools, body) => tools.deleteAttribute(body.instancePath, body.attributeName),
  get_tags: (tools, body) => tools.getTags(body.instancePath),
  add_tag: (tools, body) => tools.addTag(body.instancePath, body.tagName),
  remove_tag: (tools, body) => tools.removeTag(body.instancePath, body.tagName),
  get_tagged: (tools, body) => tools.getTagged(body.tagName),
  get_selection: (tools) => tools.getSelection(),
  execute_luau: (tools, body) => tools.executeLuau(body.code),
  start_playtest: (tools, body) => tools.startPlaytest(body.mode),
  stop_playtest: (tools) => tools.stopPlaytest(),
  get_playtest_output: (tools) => tools.getPlaytestOutput(),
  export_build: (tools, body) => tools.exportBuild(body.instancePath, body.outputId, body.style),
  create_build: (tools, body) => tools.createBuild(body.id, body.style, body.palette, body.parts, body.bounds),
  generate_build: (tools, body) => tools.generateBuild(body.id, body.style, body.palette, body.code, body.seed),
  import_build: (tools, body) => tools.importBuild(body.buildData, body.targetPath, body.position),
  list_library: (tools, body) => tools.listLibrary(body.style),
  search_materials: (tools, body) => tools.searchMaterials(body.query, body.maxResults),
  get_build: (tools, body) => tools.getBuild(body.id),
  import_scene: (tools, body) => tools.importScene(body.sceneData, body.targetPath),
  undo: (tools) => tools.undo(),
  redo: (tools) => tools.redo(),
  search_assets: (tools, body) => tools.searchAssets(body.assetType, body.query, body.maxResults, body.sortBy, body.verifiedCreatorsOnly),
  get_asset_details: (tools, body) => tools.getAssetDetails(body.assetId),
  get_asset_thumbnail: (tools, body) => tools.getAssetThumbnail(body.assetId, body.size),
  insert_asset: (tools, body) => tools.insertAssetV2 ? tools.insertAssetV2(body) : tools.insertAsset(body.assetId, body.parentPath, body.position),
  preview_asset: (tools, body) => tools.previewAsset(body.assetId, body.includeProperties, body.maxDepth),
  capture_screenshot: (tools) => tools.captureScreenshot(),
  capture_viewport: (tools, body) => tools.captureViewport(body.action, body.highlight_path, body.resolution),
  history_control: (tools, body) => tools.historyControl(body.action, body.waypoint_name),
  control_selection: (tools, body) => tools.controlSelection(body.action, body.paths, body.properties),
  validate_pathfinding: (tools, body) => tools.validatePathfinding(body.action, body.start, body.goal, body.agent_params),
  analyze_performance: (tools, body) => tools.analyzePerformance(body.action, body.target_path, body.iterations),
  check_collisions: (tools, body) => tools.checkCollisions(body),
  manage_datastore: (tools, body) => tools.manageDatastore(body),
  build_library: (tools, body) => tools.buildLibrary(body),
  run_tests: (tools, body) => tools.runTests(body),
  generate_terrain: (tools, body) => tools.generateTerrain(body),
  control_lighting: (tools, body) => tools.controlLighting(body),
  sync_project: (tools, body) => tools.syncProject(body),
  control_audio_animation: (tools, body) => tools.controlAudioAnimation(body),
  manage_places: (tools, body) => tools.managePlaces(body),
  monitor_remotes: (tools, body) => tools.monitorRemotes(body),
  map_dependencies: (tools, body) => tools.mapDependencies(body),
  find_variable_leaks: (tools, body) => tools.findVariableLeaks(body),
  scan_anticheat: (tools, body) => tools.scanAnticheat(body),
  auto_place: (tools, body) => tools.autoPlace(body),
  mirror_instances: (tools, body) => tools.mirrorInstances(body),
  snap_to_grid: (tools, body) => tools.snapToGrid(body),
  paint_surfaces: (tools, body) => tools.paintSurfaces(body),
  track_changes: (tools, body) => tools.trackChanges(body),
  manage_backups: (tools, body) => tools.manageBackups(body),
  insert_comments: (tools, body) => tools.insertComments(body),
  fix_naming: (tools, body) => tools.fixNaming(body),
  build_cutscene: (tools, body) => tools.buildCutscene(body),
  generate_lod: (tools, body) => tools.generateLod(body),
  simulate_physics: (tools, body) => tools.simulatePhysics(body),
};

export function createHttpServer(tools: RobloxStudioTools, bridge: BridgeService, allowedTools?: Set<string>) {
  const app = express();
  let pluginConnected = false;
  let mcpServerActive = false;
  let mcpServerStartTime = 0;

  const activityLogsByPlace = new Map<number, Array<{time: string, type: string, message: string, details: string}>>();
  (app as any).addActivityLog = (type: string, message: string, details: string = '') => {
    const placeId = (app as any).currentPlaceId || 0;
    if (!activityLogsByPlace.has(placeId)) {
      activityLogsByPlace.set(placeId, []);
    }
    const log = activityLogsByPlace.get(placeId)!;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    log.unshift({ time, type, message, details });
    if (log.length > 50) log.pop();
  };
  const proxyInstances = new Set<string>();

  const setMCPServerActive = (active: boolean) => {
    mcpServerActive = active;
    if (active) {
      mcpServerStartTime = Date.now();
    } else {
      mcpServerStartTime = 0;
    }
  };

  const isMCPServerActive = () => {
    return mcpServerActive;
  };

  const isPluginConnected = () => {
    return pluginConnected;
  };

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.get('/dashboard', (req, res) => {
    // Try multiple candidate paths for the dashboard
    const candidates = [
      path.resolve(__dirname, '../../../roblox-mcp-dashboard.html'), // source path
      path.resolve(__dirname, '../../roblox-mcp-dashboard.html'),   // alternate source path
      path.resolve(process.cwd(), 'roblox-mcp-dashboard.html'),      // CWD path
      path.resolve(__dirname, './roblox-mcp-dashboard.html'),       // same-dir path
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        res.sendFile(candidate);
        return;
      }
    }

    res.status(404).send(`Dashboard file not found. Checked: ${candidates.join(', ')}. Please ensure roblox-mcp-dashboard.html exists in the project root.`);
  });

  app.get('/tools', (req, res) => {
    const availableTools = allowedTools 
      ? TOOL_DEFINITIONS.filter(t => allowedTools.has(t.name))
      : TOOL_DEFINITIONS;
    res.json({ tools: availableTools });
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'BoshyXd Roblox Plugin Remake',
      pluginConnected,
      mcpServerActive: isMCPServerActive(),
      uptime: mcpServerActive ? Date.now() - mcpServerStartTime : 0,
      proxyInstanceCount: proxyInstances.size
    });
  });


  app.post('/ready', (req, res) => {
    pluginConnected = true;
    res.json({ success: true });
  });


  app.post('/disconnect', (req, res) => {
    pluginConnected = false;
    bridge.clearAllPendingRequests();
    res.json({ success: true });
  });

  app.get('/poll', (req, res) => {
    if (!pluginConnected) {
      pluginConnected = true;
    }

    if (!isMCPServerActive()) {
      res.status(503).json({
        error: 'MCP server not connected',
        pluginConnected: true,
        mcpConnected: false,
        request: null
      });
      return;
    }

    const pendingRequest = bridge.getPendingRequest();
    if (pendingRequest) {
      res.json({
        request: pendingRequest.request,
        requestId: pendingRequest.requestId,
        mcpConnected: true,
        pluginConnected: true,
        proxyInstanceCount: proxyInstances.size
      });
    } else {
      res.json({
        request: null,
        mcpConnected: true,
        pluginConnected: true,
        proxyInstanceCount: proxyInstances.size
      });
    }
  });

  app.post('/response', (req, res) => {
    const { requestId, response, error } = req.body;

    if (error) {
      bridge.rejectRequest(requestId, error);
    } else {
      bridge.resolveRequest(requestId, response);
    }

    res.json({ success: true });
  });

  app.post('/proxy', async (req, res) => {
    const { endpoint, data, proxyInstanceId } = req.body;

    if (!endpoint) {
      res.status(400).json({ error: 'endpoint is required' });
      return;
    }

    if (proxyInstanceId) {
      proxyInstances.add(proxyInstanceId);
    }

    try {
      const response = await bridge.sendRequest(endpoint, data);
      res.json({ response });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Proxy request failed' });
    }
  });

  app.get('/status', (req, res) => {
    res.json({
      pluginConnected: isPluginConnected(),
      mcpServerActive: isMCPServerActive(),
      isSyncing: (app as any).isSyncing || false,
      uptime: mcpServerActive ? Date.now() - mcpServerStartTime : 0,
      lastAgent: (app as any).lastAgent || 'None',
      activityLog: activityLogsByPlace.get((app as any).currentPlaceId || 0) || [],
      config: {
        projectName: process.env.ROBLOX_PROJECT_NAME || 'BoshyXd Roblox Plugin Remake',
        projectPath: process.cwd()
      },
      placeId: (app as any).currentPlaceId || 0
    });
  });

  app.post('/mcp/:toolName', async (req, res) => {
    const { toolName } = req.params;
    
    const agent = req.body.agent || req.headers['x-agent-id'] || 'Dashboard User';
    (app as any).lastAgent = agent;

    if ((app as any).addActivityLog) {
      let logType = 'activity';
      if (toolName.includes('script')) logType = 'script';
      else if (toolName.includes('property') || toolName.includes('object')) logType = 'prop';
      
      const agentPrefix = agent === 'Dashboard User' ? 'User' : 'AI';
      let logMsg = `${agentPrefix}: ${toolName.replace(/_/g, ' ')}`;
      
      if (toolName === 'create_object') {
        const n = req.body.name || req.body.className;
        const p = req.body.parent;
        logMsg = `${agentPrefix}: Add Object ${p}.${n}`;
      } else if (toolName === 'set_script_source') {
        logMsg = `${agentPrefix}: Update Script ${req.body.instancePath}`;
      } else if (toolName === 'sync_project') {
        logType = 'script';
        const syncAction = req.body.action || 'sync';
        logMsg = `${agentPrefix}: Project ${syncAction.replace(/_/g, ' ')}`;
        if (req.body.instance_path) logMsg += ` on ${req.body.instance_path}`;
      } else if (req.body && req.body.instancePath) {
        logMsg += ` on ${req.body.instancePath}`;
      } else if (req.body && req.body.query) {
        logMsg += ` for ${req.body.query}`;
      }
      
      (app as any).addActivityLog(logType, logMsg, JSON.stringify(req.body));
    }

    const handler = TOOL_HANDLERS[toolName];
    if (!handler) {
      res.status(404).json({ error: `Tool handler for '${toolName}' not found.` });
      return;
    }

    try {
      const result = await handler(tools, req.body);
      // If it was get_place_info, update the status
      if (toolName === 'get_place_info' && result.placeId) {
        (app as any).currentPlaceId = result.placeId;
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });


  (app as any).isPluginConnected = isPluginConnected;
  (app as any).setMCPServerActive = setMCPServerActive;
  (app as any).isMCPServerActive = isMCPServerActive;

  return app;
}

/**
 * Attempt to bind an Express app to a port, using an explicit http.Server
 * so that EADDRINUSE errors are properly caught.
 */
export function listenWithRetry(
  app: express.Express,
  host: string,
  startPort: number,
  maxAttempts: number = 5
): Promise<{ server: http.Server; port: number }> {
  return new Promise(async (resolve, reject) => {
    for (let i = 0; i < maxAttempts; i++) {
      const port = startPort + i;
      try {
        const server = await bindPort(app, host, port);
        resolve({ server, port });
        return;
      } catch (err: any) {
        if (err.code === 'EADDRINUSE') {
          console.error(`Port ${port} in use, trying next...`);
          continue;
        }
        reject(err);
        return;
      }
    }
    reject(new Error(`All ports ${startPort}-${startPort + maxAttempts - 1} are in use. Stop some MCP server instances and retry.`));
  });
}

function bindPort(app: express.Express, host: string, port: number): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    const onError = (err: NodeJS.ErrnoException) => {
      server.removeListener('error', onError);
      reject(err);
    };
    server.once('error', onError);
    server.listen(port, host, () => {
      server.removeListener('error', onError);
      resolve(server);
    });
  });
}
