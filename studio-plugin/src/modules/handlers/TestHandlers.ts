import { LogService } from "@rbxts/services";

const StudioTestService = game.GetService("StudioTestService");
const ServerScriptService = game.GetService("ServerScriptService");
const ScriptEditorService = game.GetService("ScriptEditorService");

const STOP_SIGNAL = "__MCP_STOP__";

interface OutputEntry {
	message: string;
	messageType: string;
	timestamp: number;
}

let testRunning = false;
let outputBuffer: OutputEntry[] = [];
let logConnection: RBXScriptConnection | undefined;
let testResult: unknown;
let testError: string | undefined;
let stopListenerScript: Script | undefined;

function buildStopListenerSource(): string {
	return `local LogService = game:GetService("LogService")
local StudioTestService = game:GetService("StudioTestService")
LogService.MessageOut:Connect(function(message)
	if message == "${STOP_SIGNAL}" then
		pcall(function() StudioTestService:EndTest("stopped_by_mcp") end)
	end
end)`;
}

function injectStopListener() {
	const listener = new Instance("Script");
	listener.Name = "__MCP_StopListener";
	listener.Parent = ServerScriptService;

	const source = buildStopListenerSource();
	const [seOk] = pcall(() => {
		ScriptEditorService.UpdateSourceAsync(listener, () => source);
	});
	if (!seOk) {
		(listener as unknown as { Source: string }).Source = source;
	}

	stopListenerScript = listener;
}

function cleanupStopListener() {
	if (stopListenerScript) {
		pcall(() => stopListenerScript!.Destroy());
		stopListenerScript = undefined;
	}
}

function startPlaytest(requestData: Record<string, unknown>) {
	const mode = requestData.mode as string | undefined;

	if (mode !== "play" && mode !== "run") {
		return { error: 'mode must be "play" or "run"' };
	}

	if (testRunning) {
		return { error: "A test is already running" };
	}

	testRunning = true;
	outputBuffer = [];
	testResult = undefined;
	testError = undefined;

	cleanupStopListener();

	logConnection = LogService.MessageOut.Connect((message, messageType) => {
		if (message === STOP_SIGNAL) return;
		outputBuffer.push({
			message,
			messageType: messageType.Name,
			timestamp: tick(),
		});
	});

	const [injected, injErr] = pcall(() => injectStopListener());
	if (!injected) {
		warn(`[MCP] Failed to inject stop listener: ${injErr}`);
	}

	task.spawn(() => {
		const [ok, result] = pcall(() => {
			if (mode === "play") {
				return StudioTestService.ExecutePlayModeAsync({});
			}
			return StudioTestService.ExecuteRunModeAsync({});
		});

		if (ok) {
			testResult = result;
		} else {
			testError = tostring(result);
		}

		if (logConnection) {
			logConnection.Disconnect();
			logConnection = undefined;
		}
		testRunning = false;

		cleanupStopListener();
	});

	return { success: true, message: `Playtest started in ${mode} mode` };
}

function stopPlaytest(_requestData: Record<string, unknown>) {
	if (!testRunning) {
		return { error: "No test is currently running" };
	}

	warn(STOP_SIGNAL);

	return {
		success: true,
		output: [...outputBuffer],
		outputCount: outputBuffer.size(),
		message: "Playtest stop signal sent.",
	};
}

function getPlaytestOutput(_requestData: Record<string, unknown>) {
	return {
		isRunning: testRunning,
		output: [...outputBuffer],
		outputCount: outputBuffer.size(),
		testResult: testResult !== undefined ? tostring(testResult) : undefined,
		testError,
	};
}

function runTests(data: Record<string, unknown>): unknown {
	const action = data.action as string;
	const Utils = require(script.Parent!.Parent!.WaitForChild("Utils") as ModuleScript) as unknown as {
		getInstanceByPath(path: string): Instance | undefined;
		readScriptSource(inst: Instance): string;
	};

	if (action === "run_script_test") {
		const path = data.script_path as string;
		const inst = Utils.getInstanceByPath(path);
		if (inst && inst.IsA("LuaSourceContainer")) {
			const source = Utils.readScriptSource(inst);
			const [fn, err] = loadstring(source);
			if (!fn) return { success: false, error: `Compile error: ${err}` };
			const [ok, res] = pcall(fn);
			return { success: ok, result: tostring(res) };
		}
		return { error: "Script not found or invalid type" };
	} else if (action === "assert_property") {
		const path = data.instance_path as string;
		const prop = data.property_name as string;
		const expected = data.expected_value;
		const inst = Utils.getInstanceByPath(path);
		if (inst) {
			const [ok, val] = pcall(() => (inst as unknown as Record<string, unknown>)[prop]);
			if (!ok) return { success: false, error: `Failed to get property: ${tostring(val)}` };
			const match = tostring(val) === tostring(expected);
			return { success: match, actual: tostring(val), expected: tostring(expected) };
		}
		return { error: "Instance not found" };
	}

	return { error: `Unknown action: ${action}` };
}

export = {
	startPlaytest,
	stopPlaytest,
	getPlaytestOutput,
	runTests,
};
