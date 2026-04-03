const ChangeHistoryService = game.GetService("ChangeHistoryService");

type RecordingId = string | undefined;

interface LogEntry {
	time: number;
	tool: string;
	success: boolean;
}

interface RecordingState {
	changeLog: LogEntry[];
	isTracking: boolean;
}

const globalState = _G as unknown as { MCP_RECORDING_STATE: RecordingState };
if (globalState.MCP_RECORDING_STATE === undefined) {
	globalState.MCP_RECORDING_STATE = {
		changeLog: [],
		isTracking: false,
	};
}

const state = globalState.MCP_RECORDING_STATE;

function beginRecording(actionName: string): RecordingId {
	const [success, result] = pcall(() => ChangeHistoryService.TryBeginRecording(`MCP: ${actionName}`));
	if (success) {
		return result as RecordingId;
	}
	return undefined;
}

function finishRecording(recordingId: RecordingId, shouldCommit: boolean, toolName?: string) {
	if (recordingId === undefined) return;

	const operation = shouldCommit
		? Enum.FinishRecordingOperation.Commit
		: Enum.FinishRecordingOperation.Cancel;

	pcall(() => {
		ChangeHistoryService.FinishRecording(recordingId, operation);
	});

	print(`MCP Recording: finishRecording called for ${toolName || "unknown"}. isTracking=${state.isTracking}`);

	if (state.isTracking) {
		state.changeLog.push({
			time: tick(),
			tool: toolName || "Unknown Tool",
			success: shouldCommit,
		});
		print(`MCP Recording: Added log entry. Total entries: ${state.changeLog.size()}`);
	}
}

function setTracking(enabled: boolean) {
	state.isTracking = enabled;
	print(`MCP Recording: isTracking set to ${enabled}`);
}

function getLog() {
	return state.changeLog;
}

function clearLog() {
	const len = state.changeLog.size();
	for (let i = 0; i < len; i++) {
		state.changeLog.pop();
	}
}

export = {
	beginRecording,
	finishRecording,
	setTracking,
	getLog,
	clearLog,
};
