/*
 * THROWAWAY PROTOTYPE — compares Agent Console interaction models.
 * All Supervisor, Agent, lifecycle, queue, lease, and workspace data is simulated in memory.
 * This is wayfinding evidence, not production Agent Console code.
 */

import {
	CustomEditor,
	type ExtensionAPI,
	type ExtensionContext,
	type KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import {
	Editor,
	Key,
	matchesKey,
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
	type Component,
	type EditorTheme,
	type Focusable,
	type TUI,
} from "@earendil-works/pi-tui";

type AgentStatus = "Starting" | "Working" | "Needs input" | "Completed" | "Failed" | "Stopped";
type RuntimeCondition = "none" | "starting" | "live" | "unreachable" | "stopping";
type StartingPhase = "Queued" | "Provisioning" | "Launching" | "Connecting" | "Dispatching" | "Recovering";
type Variant = "A" | "B" | "C";
type ScenarioId = "mixed" | "interactions" | "handoff" | "queue" | "recovery" | "cleanup";
type Theme = ExtensionContext["ui"]["theme"];

interface Interaction {
	id: string;
	prompt: string;
}

interface WorkspaceState {
	kind: "Original Checkout" | "Managed Worktree";
	path: string;
	claimed: boolean;
	dirty: boolean;
	unpushed: boolean;
	conflict: boolean;
	publicationProof: boolean;
	preserved: boolean;
	removed: boolean;
}

interface AgentState {
	id: string;
	name: string;
	project: string;
	status: AgentStatus;
	statusReason: string;
	phase?: StartingPhase;
	runtime: RuntimeCondition;
	holdsSlot: boolean;
	conversation: string;
	summary: string;
	interactions: Interaction[];
	pinned: boolean;
	archived: boolean;
	workspace: WorkspaceState;
}

interface QueueEntry {
	agentId: string;
	kind: "Work Request" | "answered Interaction";
	label: string;
}

interface InputLeaseState {
	agentId: string;
	holder: "this Terminal Client" | "another Terminal Client" | "uncertain";
	generation: number;
}

interface PendingHandoff {
	sourceAgentId: string;
	targetAgentId: string;
}

interface PendingConfirmation {
	kind: "Takeover" | "Destructive Workspace Cleanup" | "Permanent delete";
	agentId: string;
	prompt: string;
}

interface ComposeMode {
	kind: "Dispatch" | "Interaction reply" | "submit work";
	agentId?: string;
	interactionId?: string;
}

interface PrototypeState {
	scenario: ScenarioId;
	agents: AgentState[];
	queue: QueueEntry[];
	concurrencyLimit: number;
	dispatchTarget: string;
	currentAgentId: string;
	lease: InputLeaseState;
	pendingHandoff?: PendingHandoff;
	pendingConfirmation?: PendingConfirmation;
	lastAnsweredInteraction?: { agentId: string; interactionId: string };
	feedback: string[];
	serial: number;
	organizationStep: number;
	viewState: string;
}

interface AttentionItem {
	kind: "Interaction" | "Failure" | "Recovery" | "Queue" | "Agent";
	label: string;
	agentId: string;
	interactionId?: string;
	queueIndex?: number;
}

type ConsoleResult = { kind: "return" } | { kind: "attach"; agentName: string };

const SCENARIOS: Array<{ id: ScenarioId; name: string; description: string }> = [
	{ id: "mixed", name: "Mixed lifecycle", description: "All six Agent Statuses with independent Runtime Conditions." },
	{ id: "interactions", name: "Explicit Interactions", description: "Multiple blocking Interactions, replies, and stale reply rejection." },
	{ id: "handoff", name: "Handoff + Input Lease", description: "Pending Handoff, disabled input, contention, uncertainty, and Takeover." },
	{ id: "queue", name: "Global Work Queue", description: "Four-slot capacity, authoritative order, cancellation, and fixed Dispatch Target." },
	{ id: "recovery", name: "Recovery uncertainty", description: "Recovering truth, unreachable Runtimes, and prior status as history only." },
	{ id: "cleanup", name: "Workspace safety", description: "Dirty/unpushed work, Workspace Conflict, preservation, and destructive gates." },
];

const COMMAND_ACTIONS = ["New", "Dispatch", "Attach", "Reply", "Submit work", "Organize", "Cleanup"] as const;
type CommandAction = (typeof COMMAND_ACTIONS)[number];

function workspace(
	kind: WorkspaceState["kind"],
	path: string,
	overrides: Partial<WorkspaceState> = {},
): WorkspaceState {
	return {
		kind,
		path,
		claimed: true,
		dirty: false,
		unpushed: false,
		conflict: false,
		publicationProof: true,
		preserved: false,
		removed: false,
		...overrides,
	};
}

function agent(
	id: string,
	name: string,
	status: AgentStatus,
	runtime: RuntimeCondition,
	overrides: Partial<AgentState> = {},
): AgentState {
	return {
		id,
		name,
		project: "pi-agent-console",
		status,
		statusReason: status === "Needs input" ? "ready_for_prompt" : status.toLowerCase().replaceAll(" ", "_"),
		runtime,
		holdsSlot: status === "Working",
		conversation: `conversation-${id}`,
		summary: "Deterministic activity summary.",
		interactions: [],
		pinned: false,
		archived: false,
		workspace: workspace("Managed Worktree", `/worktrees/${name}`),
		...overrides,
	};
}

function baseAgents(): AgentState[] {
	return [
		agent("a1", "console-spec", "Working", "live", {
			pinned: true,
			workspace: workspace("Original Checkout", "/repo/pi-agent-console"),
			summary: "Working through the interaction model ticket.",
		}),
		agent("a2", "pi-docs", "Needs input", "live", {
			statusReason: "interaction_required",
			interactions: [{ id: "int-17", prompt: "Choose which public Pi API constraint to preserve." }],
			summary: "One explicit Interaction blocks continuation.",
		}),
		agent("a3", "queue-audit", "Starting", "starting", {
			phase: "Queued",
			statusReason: "queued_for_slot",
			summary: "Accepted Work Request is waiting for a Concurrency Slot.",
		}),
		agent("a4", "handoff-probe", "Completed", "live", {
			statusReason: "work_cycle_settled",
			summary: "Completed is latched while the Agent Runtime remains live.",
		}),
		agent("a5", "provider-fault", "Failed", "live", {
			statusReason: "provider_auth_failed",
			summary: "Failed after an unrecovered operational fault; Runtime still live.",
		}),
		agent("a6", "stopped-task", "Stopped", "none", {
			statusReason: "user_stop_confirmed",
			summary: "Deliberately stopped; Conversation remains durable.",
		}),
	];
}

function makeState(scenario: ScenarioId): PrototypeState {
	const agents = baseAgents();
	const state: PrototypeState = {
		scenario,
		agents,
		queue: [{ agentId: "a3", kind: "Work Request", label: "Audit queue invariants" }],
		concurrencyLimit: 4,
		dispatchTarget: "frail/pi-agent-console · cwd .",
		currentAgentId: "a1",
		lease: { agentId: "a1", holder: "this Terminal Client", generation: 12 },
		feedback: ["Scenario loaded. Every row and operation below is simulated in memory."],
		serial: 20,
		organizationStep: 0,
		viewState: "project=current · statuses=all · archived=hidden · grouping=none",
	};

	if (scenario === "interactions") {
		const target = agents[1]!;
		target.interactions = [
			{ id: "int-17", prompt: "Approve the queue reorder?" },
			{ id: "int-18", prompt: "Choose safe cleanup or preserve the checkout." },
		];
		target.summary = "Two explicit Interactions; prose alone never creates one.";
		state.feedback = ["Reply targets a stable Interaction ID; replying twice demonstrates stale rejection."];
	}

	if (scenario === "handoff") {
		state.lease = { agentId: "a4", holder: "another Terminal Client", generation: 31 };
		state.pendingConfirmation = {
			kind: "Takeover",
			agentId: "a4",
			prompt: "handoff-probe Input Lease is held by another Terminal Client. Confirm fenced Takeover?",
		};
		state.feedback = ["Input Lease contention requires Takeover; confirmation then enters a fenced pending Handoff."];
	}

	if (scenario === "queue") {
		agents.push(
			agent("a7", "slot-keeper", "Working", "live", {
				statusReason: "work_active",
				summary: "Fourth explicit Concurrency Slot holder; status alone does not imply slot ownership.",
			}),
		);
		for (const index of [0, 1, 3]) {
			agents[index]!.status = "Working";
			agents[index]!.phase = undefined;
			agents[index]!.runtime = "live";
			agents[index]!.holdsSlot = true;
			agents[index]!.statusReason = "work_active";
			agents[index]!.interactions = [];
		}
		state.queue = [
			{ agentId: "a3", kind: "answered Interaction", label: "Resume queue-audit after answer" },
			{ agentId: "a6", kind: "Work Request", label: "Re-run stopped acceptance scenario" },
			{ agentId: "a5", kind: "Work Request", label: "Retry provider configuration" },
		];
		agents[5]!.status = "Starting";
		agents[5]!.phase = "Queued";
		agents[5]!.statusReason = "queued_for_slot";
		state.feedback = ["Displayed Work Queue order is scheduling order; answered Interactions visibly lead."];
	}

	if (scenario === "recovery") {
		agents[0]!.status = "Starting";
		agents[0]!.phase = "Recovering";
		agents[0]!.runtime = "unreachable";
		agents[0]!.statusReason = "authority_uncertain";
		agents[0]!.summary = "Prior Working is historical only while authority is uncertain.";
		agents[4]!.runtime = "unreachable";
		state.lease = { agentId: "a1", holder: "uncertain", generation: 12 };
		state.feedback = ["Uncertain authority projects Starting (Recovering); no optimistic stale status is shown."];
	}

	if (scenario === "cleanup") {
		agents[1]!.workspace = workspace("Managed Worktree", "/worktrees/pi-docs", {
			dirty: true,
			publicationProof: false,
		});
		agents[3]!.runtime = "none";
		agents[3]!.workspace = workspace("Managed Worktree", "/worktrees/handoff-probe", {
			unpushed: true,
			publicationProof: false,
		});
		agents[4]!.runtime = "none";
		agents[4]!.workspace = workspace("Managed Worktree", "/worktrees/provider-fault", {
			conflict: true,
			publicationProof: false,
		});
		agents[5]!.workspace = workspace("Managed Worktree", "/worktrees/stopped-task", {
			claimed: false,
		});
		state.feedback = ["Stop, Archive, Workspace Release, cleanup, and Permanent delete remain distinct."];
	}

	return state;
}

function scenarioInfo(id: ScenarioId) {
	return SCENARIOS.find((scenario) => scenario.id === id)!;
}

function fit(text: string, width: number, ellipsis = ""): string {
	return truncateToWidth(text, Math.max(1, width), ellipsis);
}

function pad(text: string, width: number): string {
	const clipped = fit(text, width, "…");
	return `${clipped}${" ".repeat(Math.max(0, width - visibleWidth(clipped)))}`;
}

function beside(left: string[], right: string[], width: number, leftWidth: number): string[] {
	const gap = width >= 3 ? 2 : 0;
	const safeLeft = Math.max(1, Math.min(leftWidth, width - gap - 1));
	const rightWidth = Math.max(1, width - safeLeft - gap);
	const rows = Math.max(left.length, right.length);
	const lines: string[] = [];
	for (let index = 0; index < rows; index++) {
		lines.push(fit(`${pad(left[index] ?? "", safeLeft)}${" ".repeat(gap)}${fit(right[index] ?? "", rightWidth, "…")}`, width));
	}
	return lines;
}

function statusColor(status: AgentStatus): "accent" | "success" | "warning" | "error" | "muted" {
	if (status === "Working") return "accent";
	if (status === "Completed") return "success";
	if (status === "Failed") return "error";
	if (status === "Needs input" || status === "Starting") return "warning";
	return "muted";
}

class EmptyLeftEditor extends CustomEditor {
	private readonly onEmptyLeft: () => void;

	constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager, onEmptyLeft: () => void) {
		super(tui, theme, keybindings);
		this.onEmptyLeft = onEmptyLeft;
	}

	override handleInput(data: string): void {
		if (matchesKey(data, Key.left) && this.getExpandedText().length === 0) {
			this.onEmptyLeft();
			return;
		}
		super.handleInput(data);
	}
}

class AgentConsolePrototype implements Component, Focusable {
	private variant: Variant = "A";
	private selected = 0;
	private commandSelected = 0;
	private targetSelected = 0;
	private narrowPane: "list" | "detail" = "list";
	private compose?: ComposeMode;
	private disposed = false;
	private _focused = true;
	private readonly editor: Editor;
	private readonly tui: TUI;
	private readonly theme: Theme;
	private state: PrototypeState;
	private readonly replaceState: (state: PrototypeState) => void;
	private readonly done: (result: ConsoleResult) => void;

	constructor(
		tui: TUI,
		theme: Theme,
		state: PrototypeState,
		replaceState: (state: PrototypeState) => void,
		done: (result: ConsoleResult) => void,
	) {
		this.tui = tui;
		this.theme = theme;
		this.state = state;
		this.replaceState = replaceState;
		this.done = done;
		const editorTheme: EditorTheme = {
			borderColor: (text) => theme.fg("accent", text),
			selectList: {
				selectedPrefix: (text) => theme.fg("accent", text),
				selectedText: (text) => theme.fg("accent", text),
				description: (text) => theme.fg("muted", text),
				scrollInfo: (text) => theme.fg("dim", text),
				noMatch: (text) => theme.fg("warning", text),
			},
		};
		this.editor = new Editor(tui, editorTheme);
		this.editor.onSubmit = (text) => this.submitComposer(text);
	}

	get focused(): boolean {
		return this._focused;
	}

	set focused(value: boolean) {
		this._focused = value;
		this.editor.focused = value && this.compose !== undefined;
	}

	private feedback(message: string): void {
		this.state.feedback.unshift(message);
		this.state.feedback = this.state.feedback.slice(0, 4);
	}

	private selectedAgent(): AgentState | undefined {
		if (this.state.agents.length === 0) return undefined;
		this.selected = Math.max(0, Math.min(this.selected, this.state.agents.length - 1));
		return this.state.agents[this.selected];
	}

	private targetAgent(): AgentState | undefined {
		if (this.state.agents.length === 0) return undefined;
		this.targetSelected = Math.max(0, Math.min(this.targetSelected, this.state.agents.length - 1));
		return this.state.agents[this.targetSelected];
	}

	private operationTarget(): AgentState | undefined {
		if (this.variant === "C") return this.targetAgent();
		if (this.variant === "B") {
			const attention = this.attentionItems()[this.selected];
			return this.state.agents.find((item) => item.id === attention?.agentId);
		}
		return this.selectedAgent();
	}

	private activeAgent(): AgentState | undefined {
		return this.state.agents.find((item) => item.id === this.state.currentAgentId);
	}

	private beginCompose(mode: ComposeMode): void {
		this.compose = mode;
		this.editor.setText("");
		this.editor.focused = this.focused;
		this.feedback(`${mode.kind}: type a simulated payload, then Enter. Esc cancels.`);
	}

	private submitComposer(text: string): void {
		const mode = this.compose;
		if (!mode) return;
		const payload = text.trim();
		this.compose = undefined;
		this.editor.focused = false;
		this.editor.setText("");

		if (payload.length === 0 || /invalid|missing attachment/i.test(payload)) {
			this.feedback("Preflight rejected: invalid/empty Work Request; no Agent or command record was created.");
			this.tui.requestRender();
			return;
		}

		if (mode.kind === "Dispatch") this.dispatch(payload);
		if (mode.kind === "Interaction reply") this.reply(mode.agentId, mode.interactionId, payload);
		if (mode.kind === "submit work") this.submitWork(mode.agentId, payload);
		this.tui.requestRender();
	}

	private newAgent(): void {
		const id = `a${++this.state.serial}`;
		const name = `new-agent-${this.state.serial}`;
		const created = agent(id, name, "Needs input", "live", {
			statusReason: "ready_for_prompt",
			summary: "Promptless New created a fresh attached native Pi session.",
		});
		this.state.agents.push(created);
		this.state.currentAgentId = id;
		this.state.lease = { agentId: id, holder: "this Terminal Client", generation: this.state.lease.generation + 1 };
		this.feedback(`New created ${name} with no Work Request or Concurrency Slot; Attach simulated.`);
		this.done({ kind: "attach", agentName: name });
	}

	private dispatch(payload: string): void {
		const id = `a${++this.state.serial}`;
		const name = `dispatch-${this.state.serial}`;
		const occupiedSlots = this.state.agents.filter((item) => item.holdsSlot).length;
		const queued = occupiedSlots >= this.state.concurrencyLimit;
		const created = agent(id, name, queued ? "Starting" : "Working", queued ? "none" : "live", {
			phase: queued ? "Queued" : undefined,
			holdsSlot: !queued,
			statusReason: queued ? "queued_for_slot" : "work_accepted",
			summary: `Immutable Work Request: ${payload}`,
		});
		this.state.agents.push(created);
		if (queued) this.state.queue.push({ agentId: id, kind: "Work Request", label: payload });
		this.feedback(
			`Dispatch created exactly one Agent for ${this.state.dispatchTarget}; highlighted Agent did not change the Dispatch Target.`,
		);
	}

	private reply(agentId?: string, interactionId?: string, payload = "Approved in prototype"): void {
		const target = this.state.agents.find((item) => item.id === agentId) ?? this.selectedAgent();
		if (!target) return;
		const interaction = interactionId
			? target.interactions.find((item) => item.id === interactionId)
			: target.interactions[0];
		if (!interaction) {
			this.feedback(`Stale Interaction reply rejected for ${target.name}; it was not sent to the editor or a newer request.`);
			return;
		}
		this.state.lastAnsweredInteraction = { agentId: target.id, interactionId: interaction.id };
		target.interactions = target.interactions.filter((item) => item.id !== interaction.id);
		if (target.interactions.length === 0) {
			target.status = "Working";
			target.holdsSlot = false;
			target.statusReason = "interaction_answered";
			this.state.queue.unshift({ agentId: target.id, kind: "answered Interaction", label: payload });
		}
		this.feedback(`Answered Interaction ${interaction.id}; stable ID preserved and answer order is visible in Work Queue.`);
	}

	private retryLastInteractionReply(): void {
		const last = this.state.lastAnsweredInteraction;
		if (!last) {
			this.feedback("No answered Interaction is available for the stale-ID retry probe.");
			return;
		}
		this.reply(last.agentId, last.interactionId, "replayed stale answer");
	}

	private submitWork(agentId?: string, payload = "Follow-up Work Request"): void {
		const target = this.state.agents.find((item) => item.id === agentId) ?? this.selectedAgent();
		if (!target) return;
		if (target.status === "Working" || target.interactions.length > 0 || this.state.queue.some((entry) => entry.agentId === target.id)) {
			this.feedback(`submit work rejected for ${target.name}: active Work Cycle, Interaction, or pending Work Request.`);
			return;
		}
		target.status = "Starting";
		target.phase = "Queued";
		target.holdsSlot = false;
		target.statusReason = "queued_for_slot";
		this.state.queue.push({ agentId: target.id, kind: "Work Request", label: payload });
		this.feedback(`Accepted one immutable Work Request for existing Agent ${target.name}.`);
	}

	private beginAttach(target?: AgentState): void {
		if (!target) return;
		if (target.runtime === "none") {
			this.feedback(`Attach unavailable for ${target.name}: no live Agent Runtime. Resume is a separate operation.`);
			return;
		}
		if (this.state.lease.agentId === target.id && this.state.lease.holder !== "this Terminal Client") {
			this.state.pendingConfirmation = {
				kind: "Takeover",
				agentId: target.id,
				prompt: `${target.name} Input Lease is held by ${this.state.lease.holder}. Confirm fenced Takeover?`,
			};
			this.feedback("Input Lease contention requires explicit Takeover; newest-client-wins is forbidden.");
			return;
		}
		if (target.id === this.state.currentAgentId) {
			this.feedback(`${target.name} is already attached; Agent Console stays open. Use q/Esc to return to native Pi.`);
			return;
		}
		this.state.pendingHandoff = { sourceAgentId: this.state.currentAgentId, targetAgentId: target.id };
		this.feedback("Handoff pending: ordinary input disabled; Enter commits atomically, Esc leaves source attachment unchanged.");
	}

	private completeHandoff(): void {
		const pending = this.state.pendingHandoff;
		if (!pending) return;
		const target = this.state.agents.find((item) => item.id === pending.targetAgentId);
		if (!target) {
			this.state.pendingHandoff = undefined;
			this.feedback("Handoff failed before commit; source attachment remains unchanged.");
			return;
		}
		this.state.currentAgentId = target.id;
		this.state.lease = {
			agentId: target.id,
			holder: "this Terminal Client",
			generation: this.state.lease.generation + 1,
		};
		this.state.pendingHandoff = undefined;
		this.feedback(`Handoff committed atomically to ${target.name}; no input was replayed.`);
		this.done({ kind: "attach", agentName: target.name });
	}

	private confirmPending(accepted: boolean): void {
		const pending = this.state.pendingConfirmation;
		this.state.pendingConfirmation = undefined;
		if (!pending) return;
		if (!accepted) {
			this.feedback(`${pending.kind} cancelled; state is unchanged.`);
			return;
		}
		const target = this.state.agents.find((item) => item.id === pending.agentId);
		if (!target) return;
		if (pending.kind === "Takeover") {
			this.state.lease = {
				agentId: target.id,
				holder: "this Terminal Client",
				generation: this.state.lease.generation + 1,
			};
			if (target.id === this.state.currentAgentId) {
				this.feedback("Prior holder fenced; Input Lease restored for the currently attached Agent.");
				this.done({ kind: "attach", agentName: target.name });
			} else {
				this.state.pendingHandoff = { sourceAgentId: this.state.currentAgentId, targetAgentId: target.id };
				this.feedback("Prior holder fenced. Handoff now pending; Enter commits, Esc keeps source attached.");
			}
		}
		if (pending.kind === "Destructive Workspace Cleanup") this.cleanup(target, true);
		if (pending.kind === "Permanent delete") this.permanentDelete(target, true);
	}

	private stop(target?: AgentState): void {
		if (!target) return;
		target.status = "Stopped";
		target.statusReason = "user_stop_confirmed";
		target.runtime = "none";
		target.holdsSlot = false;
		this.feedback(`Stopped ${target.name}; Archive, Workspace Claim, Conversation, and Agent identity remain.`);
	}

	private archive(target?: AgentState): void {
		if (!target) return;
		target.archived = !target.archived;
		this.feedback(`${target.archived ? "Archived" : "Unarchived"} ${target.name}; Agent Status remains ${target.status}.`);
	}

	private releaseWorkspace(target?: AgentState): void {
		if (!target) return;
		const workspaceState = target.workspace;
		if (target.runtime !== "none") {
			this.feedback(`Workspace Release blocked for ${target.name}: stop its live Agent Runtime first.`);
			return;
		}
		if (workspaceState.conflict) {
			this.feedback(`Workspace Release blocked by Workspace Conflict; explicit recovery is required.`);
			return;
		}
		workspaceState.claimed = false;
		if (workspaceState.kind === "Managed Worktree" && (workspaceState.dirty || workspaceState.unpushed)) {
			workspaceState.preserved = true;
			this.feedback(`Workspace Claim released; unsafe-to-remove checkout became a locked Preserved Checkout.`);
			return;
		}
		this.feedback(`Workspace Claim released without changing Agent Status or deleting the Agent.`);
	}

	private cleanup(target?: AgentState, destructive = false): void {
		if (!target) return;
		const item = target.workspace;
		if (item.kind === "Original Checkout") {
			this.feedback("Cleanup blocked: Agent Console never removes an Original Checkout; Workspace Release only unbinds it.");
			return;
		}
		if (target.runtime !== "none") {
			this.feedback("Cleanup blocked: a live Agent Runtime is a non-overridable safety gate.");
			return;
		}
		if (item.conflict) {
			this.feedback("Cleanup blocked: Destructive Workspace Cleanup cannot override Workspace Conflict.");
			return;
		}
		if (!destructive && (item.dirty || item.unpushed || !item.publicationProof)) {
			this.feedback("Blocked · l preserve · X destructive");
			return;
		}
		if (!destructive) {
			item.removed = true;
			item.claimed = false;
			this.feedback("Ordinary Managed Worktree removal passed all simulated safety proof.");
			return;
		}
		item.removed = true;
		item.claimed = false;
		item.preserved = false;
		this.feedback("Destructive Workspace Cleanup confirmed; continuation ref preserved (simulated). Agent remains.");
	}

	private requestDestructiveCleanup(target?: AgentState): void {
		if (!target) return;
		if (target.workspace.kind === "Original Checkout") {
			this.feedback("Destructive Workspace Cleanup is unavailable: Agent Console never removes an Original Checkout.");
			return;
		}
		this.state.pendingConfirmation = {
			kind: "Destructive Workspace Cleanup",
			agentId: target.id,
			prompt: `Discard ${target.name}'s reviewed changes and remove its Managed Worktree? Workspace Conflict and live Runtime gates still apply.`,
		};
	}

	private permanentDelete(target?: AgentState, confirmed = false): void {
		if (!target) return;
		if (!confirmed) {
			this.state.pendingConfirmation = {
				kind: "Permanent delete",
				agentId: target.id,
				prompt: `Permanently delete ${target.name} Agent identity and Conversation association?`,
			};
			return;
		}
		if (target.runtime !== "none" || target.workspace.conflict || target.workspace.claimed) {
			this.feedback("Permanent delete blocked: stop Runtime and resolve/release Workspace Claim first.");
			return;
		}
		this.state.agents = this.state.agents.filter((item) => item.id !== target.id);
		this.state.queue = this.state.queue.filter((item) => item.agentId !== target.id);
		this.selected = Math.max(0, this.selected - 1);
		this.feedback(`Permanent delete removed ${target.name} identity and Conversation association (simulated).`);
	}

	private reorderQueue(delta: -1 | 1): void {
		if (this.state.queue.length < 2) return;
		const agentId = this.operationTarget()?.id;
		let index = this.state.queue.findIndex((entry) => entry.agentId === agentId);
		if (index < 0) index = 0;
		const next = Math.max(0, Math.min(this.state.queue.length - 1, index + delta));
		if (next === index) return;
		const [entry] = this.state.queue.splice(index, 1);
		this.state.queue.splice(next, 0, entry!);
		this.feedback(`Work Queue reordered; displayed order remains authoritative scheduling order.`);
	}

	private cancelQueue(): void {
		if (this.state.queue.length === 0) return;
		const agentId = this.operationTarget()?.id ?? this.state.queue[0]!.agentId;
		let index = this.state.queue.findIndex((entry) => entry.agentId === agentId);
		if (index < 0) index = 0;
		const [entry] = this.state.queue.splice(index, 1);
		const target = this.state.agents.find((item) => item.id === entry?.agentId);
		if (target) {
			target.status = "Stopped";
			target.phase = undefined;
			target.statusReason = "queue_cancelled";
			target.runtime = "none";
			target.holdsSlot = false;
		}
		this.feedback(`Cancelled queued ${entry?.kind ?? "entry"}; accepted Agent remains with truthful Stopped outcome.`);
	}

	private attentionItems(): AttentionItem[] {
		const items: AttentionItem[] = [];
		for (const item of this.state.agents) {
			for (const interaction of item.interactions) {
				items.push({ kind: "Interaction", label: interaction.prompt, agentId: item.id, interactionId: interaction.id });
			}
			if (item.status === "Failed") items.push({ kind: "Failure", label: item.statusReason, agentId: item.id });
			if (item.phase === "Recovering" || item.runtime === "unreachable") {
				items.push({ kind: "Recovery", label: item.statusReason, agentId: item.id });
			}
		}
		this.state.queue.forEach((entry, queueIndex) => {
			items.push({ kind: "Queue", label: entry.label, agentId: entry.agentId, queueIndex });
		});
		for (const item of this.state.agents.filter(
			(agentState) => agentState.interactions.length === 0 && agentState.status !== "Failed" && agentState.runtime !== "unreachable",
		)) {
			items.push({ kind: "Agent", label: item.summary, agentId: item.id });
		}
		return items;
	}

	private togglePin(target?: AgentState): void {
		if (!target) return;
		target.pinned = !target.pinned;
		this.feedback(`${target.pinned ? "Pinned" : "Unpinned"} ${target.name}; scheduling, queue order, and Agent Status are unchanged.`);
	}

	private rename(target?: AgentState): void {
		if (!target) return;
		const prior = target.name;
		target.name = target.name.endsWith("-renamed") ? target.name.replace(/-renamed$/, "") : `${target.name}-renamed`;
		this.feedback(`Renamed ${prior} → ${target.name}; mutable display name is not durable Agent identity.`);
	}

	private cycleOrganization(): void {
		this.state.organizationStep = (this.state.organizationStep + 1) % 3;
		this.state.viewState = [
			"project=current · statuses=all · archived=hidden · grouping=none",
			"project=all · statuses=attention · archived=hidden · grouping=project",
			"project=all · statuses=all six · archived=visible · grouping=Agent Status",
		][this.state.organizationStep]!;
		this.feedback(`Console View State changed: ${this.state.viewState}. Dispatch Target and Work Queue are unchanged.`);
	}

	private executeCommand(action: CommandAction): void {
		const target = this.targetAgent();
		if (action === "New") this.newAgent();
		if (action === "Dispatch") this.beginCompose({ kind: "Dispatch" });
		if (action === "Attach") this.beginAttach(target);
		if (action === "Reply") {
			const interaction = target?.interactions[0];
			this.beginCompose({ kind: "Interaction reply", agentId: target?.id, interactionId: interaction?.id });
		}
		if (action === "Submit work") this.beginCompose({ kind: "submit work", agentId: target?.id });
		if (action === "Organize") this.cycleOrganization();
		if (action === "Cleanup") this.cleanup(target);
	}

	private cycleScenario(): void {
		const current = SCENARIOS.findIndex((scenario) => scenario.id === this.state.scenario);
		this.state = makeState(SCENARIOS[(current + 1) % SCENARIOS.length]!.id);
		this.replaceState(this.state);
		this.selected = 0;
		this.targetSelected = 0;
		this.commandSelected = 0;
		this.compose = undefined;
		this.editor.setText("");
	}

	handleInput(data: string): void {
		if (this.disposed) return;

		if (this.compose) {
			if (matchesKey(data, Key.escape)) {
				this.compose = undefined;
				this.editor.focused = false;
				this.editor.setText("");
				this.feedback("Composer cancelled; no command was accepted.");
			} else {
				this.editor.handleInput(data);
			}
			this.tui.requestRender();
			return;
		}

		if (this.state.pendingConfirmation) {
			if (matchesKey(data, "y") || matchesKey(data, Key.enter)) this.confirmPending(true);
			else if (matchesKey(data, "n") || matchesKey(data, Key.escape)) this.confirmPending(false);
			else this.feedback("Confirmation pending: unrelated input is ignored, not buffered.");
			this.tui.requestRender();
			return;
		}

		if (this.state.pendingHandoff) {
			if (matchesKey(data, Key.enter)) this.completeHandoff();
			else if (matchesKey(data, Key.escape)) {
				this.state.pendingHandoff = undefined;
				this.feedback("Handoff cancelled before commit; source attachment remains unchanged.");
			} else this.feedback("Handoff pending: ordinary input is disabled and was not buffered.");
			this.tui.requestRender();
			return;
		}

		if (matchesKey(data, "f2")) this.variant = "A";
		else if (matchesKey(data, "f3")) this.variant = "B";
		else if (matchesKey(data, "f4")) this.variant = "C";
		else if (matchesKey(data, "f6")) this.cycleScenario();
		else if (matchesKey(data, Key.escape) || matchesKey(data, "q")) this.done({ kind: "return" });
		else if (matchesKey(data, "r")) {
			this.state = makeState(this.state.scenario);
			this.replaceState(this.state);
			this.feedback("Scenario reset to deterministic fixture state.");
		} else if (this.variant === "C") {
			if (matchesKey(data, Key.up)) this.commandSelected = Math.max(0, this.commandSelected - 1);
			else if (matchesKey(data, Key.down)) this.commandSelected = Math.min(COMMAND_ACTIONS.length - 1, this.commandSelected + 1);
			else if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
				this.targetSelected = (this.targetSelected + 1) % Math.max(1, this.state.agents.length);
			} else if (matchesKey(data, Key.left)) {
				this.targetSelected = (this.targetSelected - 1 + Math.max(1, this.state.agents.length)) % Math.max(1, this.state.agents.length);
			} else if (matchesKey(data, Key.enter)) this.executeCommand(COMMAND_ACTIONS[this.commandSelected]!);
		} else if (this.variant === "B") {
			const items = this.attentionItems();
			if (matchesKey(data, Key.up)) this.selected = Math.max(0, this.selected - 1);
			else if (matchesKey(data, Key.down)) this.selected = Math.min(Math.max(0, items.length - 1), this.selected + 1);
			else if (matchesKey(data, Key.enter)) {
				const item = items[this.selected];
				if (item?.kind === "Interaction") this.beginCompose({ kind: "Interaction reply", agentId: item.agentId, interactionId: item.interactionId });
				else if (item) this.feedback(`Peeked ${item.kind} for ${this.state.agents.find((agentState) => agentState.id === item.agentId)?.name}.`);
			}
		} else {
			if (matchesKey(data, Key.up)) this.selected = Math.max(0, this.selected - 1);
			else if (matchesKey(data, Key.down)) this.selected = Math.min(Math.max(0, this.state.agents.length - 1), this.selected + 1);
			else if (matchesKey(data, Key.tab)) this.narrowPane = this.narrowPane === "list" ? "detail" : "list";
			else if (matchesKey(data, Key.enter)) this.beginAttach(this.selectedAgent());
		}

		if (matchesKey(data, "n")) this.newAgent();
		else if (matchesKey(data, "d")) this.beginCompose({ kind: "Dispatch" });
		else if (matchesKey(data, "i")) this.beginCompose({ kind: "Dispatch" });
		else if (matchesKey(data, "e")) {
			const target = this.operationTarget();
			this.beginCompose({ kind: "Interaction reply", agentId: target?.id, interactionId: target?.interactions[0]?.id });
		} else if (matchesKey(data, "u")) this.retryLastInteractionReply();
		else if (matchesKey(data, "w")) {
			const target = this.operationTarget();
			this.beginCompose({ kind: "submit work", agentId: target?.id });
		} else if (matchesKey(data, "a")) this.beginAttach(this.operationTarget());
		else if (matchesKey(data, "s")) this.stop(this.operationTarget());
		else if (matchesKey(data, "z")) this.archive(this.operationTarget());
		else if (matchesKey(data, "l")) this.releaseWorkspace(this.operationTarget());
		else if (matchesKey(data, "x")) this.cleanup(this.operationTarget());
		else if (matchesKey(data, "shift+x")) this.requestDestructiveCleanup(this.operationTarget());
		else if (matchesKey(data, Key.delete)) this.permanentDelete(this.operationTarget());
		else if (matchesKey(data, "p")) this.togglePin(this.operationTarget());
		else if (matchesKey(data, "m")) this.rename(this.operationTarget());
		else if (matchesKey(data, "o")) this.cycleOrganization();
		else if (matchesKey(data, "v")) {
			this.narrowPane = "detail";
			this.feedback(`Peeked ${this.operationTarget()?.name ?? "selected Agent"}; Attach remains a separate operation.`);
		} else if (matchesKey(data, "[")) this.reorderQueue(-1);
		else if (matchesKey(data, "]")) this.reorderQueue(1);
		else if (matchesKey(data, "backspace")) this.cancelQueue();

		this.tui.requestRender();
	}

	private header(width: number): string[] {
		const scenario = scenarioInfo(this.state.scenario);
		if (width < 60) {
			const variantName = this.variant === "A" ? "Roster" : this.variant === "B" ? "Attention" : "Commands";
			return [
				fit(this.theme.fg("warning", this.theme.bold("THROWAWAY · SIMULATED · NO REAL MUTATIONS")), width),
				fit(this.theme.fg("dim", `${this.variant} ${variantName} · F2/F3/F4 · F6 ${scenario.name}`), width, "…"),
				this.theme.fg("border", "─".repeat(Math.max(1, width))),
			];
		}
		const tab = (key: Variant, label: string) => {
			const text = ` ${key} ${label} `;
			return this.variant === key ? this.theme.bg("selectedBg", this.theme.fg("text", text)) : this.theme.fg("muted", text);
		};
		return [
			fit(this.theme.fg("warning", this.theme.bold("THROWAWAY · SIMULATED IN MEMORY · NO REAL MUTATIONS")), width),
			fit(`${tab("A", "Roster + Inspector")} ${tab("B", "Attention Queue")} ${tab("C", "Command Canvas")}`, width, "…"),
			fit(this.theme.fg("dim", `F2/F3/F4 variants · F6 scenario · ${scenario.name}: ${scenario.description}`), width, "…"),
			this.theme.fg("border", "─".repeat(Math.max(1, width))),
		];
	}

	private agentRow(item: AgentState, selected: boolean, width: number): string {
		const marker = selected ? "›" : " ";
		const current = item.id === this.state.currentAgentId ? " attached" : "";
		const archive = item.archived ? " archived" : "";
		const pin = item.pinned ? "◆" : " ";
		const phase = item.phase ? `/${item.phase}` : "";
		const slot = item.holdsSlot ? " · Slot held" : "";
		const row = `${marker}${pin} ${item.name} · ${item.status}${phase} · Runtime ${item.runtime}${slot}${current}${archive}`;
		return fit(selected ? this.theme.fg("accent", this.theme.bold(row)) : this.theme.fg(statusColor(item.status), row), width, "…");
	}

	private inspector(item: AgentState | undefined, width: number): string[] {
		if (!item) return [this.theme.fg("dim", "No Agent selected.")];
		const workspaceState = item.workspace;
		const interactions = item.interactions.length === 0
			? "none"
			: item.interactions.map((interaction) => `${interaction.id}: ${interaction.prompt}`).join(" | ");
		const lines = [
			this.theme.fg("accent", this.theme.bold(item.name)),
			`Agent ${item.id} · Conversation ${item.conversation}`,
			`Agent Status: ${item.status}${item.phase ? ` (${item.phase})` : ""}`,
			`Status Reason: ${item.statusReason}`,
			`Runtime Condition: ${item.runtime} (independent)`,
			`Concurrency Slot: ${item.holdsSlot ? "held" : "released"} (independent)`,
			`Interactions: ${interactions}`,
			`Workspace Claim: ${workspaceState.claimed ? "held" : "released"} · ${workspaceState.kind}`,
			`Workspace: ${workspaceState.path}`,
			`Safety: dirty=${workspaceState.dirty} unpushed=${workspaceState.unpushed} conflict=${workspaceState.conflict}`,
			`Publication Proof=${workspaceState.publicationProof} preserved=${workspaceState.preserved} removed=${workspaceState.removed}`,
			`Pin=${item.pinned} Archive=${item.archived}`,
			item.summary,
		];
		return lines.map((line) => fit(line, width, "…"));
	}

	private renderRoster(width: number): string[] {
		const selected = this.selectedAgent();
		const limit = width < 60 ? 6 : width < 88 ? 9 : 12;
		const maxStart = Math.max(0, this.state.agents.length - limit);
		const start = Math.min(Math.max(0, this.selected - Math.floor(limit / 2)), maxStart);
		const visibleAgents = this.state.agents.slice(start, start + limit);
		const range = this.state.agents.length === 0 ? "empty" : `${start + 1}-${start + visibleAgents.length}/${this.state.agents.length}`;
		const roster = [
			this.theme.fg("accent", this.theme.bold(`AGENTS · ${range}`)),
			...visibleAgents.map((item, index) => this.agentRow(item, start + index === this.selected, Math.max(1, width))),
		];
		if (width >= 60) {
			roster.push(
				"",
				this.theme.fg("muted", `Dispatch Target (fixed): ${this.state.dispatchTarget}`),
				this.theme.fg("muted", `Console View State: ${this.state.viewState}`),
				this.theme.fg("muted", "Composer: i/d Dispatch · n New · w submit work"),
			);
		}
		if (width >= 88) {
			return beside(roster, [this.theme.fg("accent", this.theme.bold("INSPECTOR")), ...this.inspector(selected, width)], width, Math.floor(width * 0.46));
		}
		const detailLimit = width < 60 ? 7 : 11;
		const pane = this.narrowPane === "list"
			? roster
			: [this.theme.fg("accent", this.theme.bold("INSPECTOR · Tab returns to roster")), ...this.inspector(selected, width).slice(0, detailLimit)];
		return pane.map((line) => fit(line, width, "…"));
	}

	private renderAttention(width: number): string[] {
		const items = this.attentionItems();
		this.selected = Math.min(this.selected, Math.max(0, items.length - 1));
		const limit = width < 60 ? 6 : width < 88 ? 6 : 12;
		const maxStart = Math.max(0, items.length - limit);
		const start = Math.min(Math.max(0, this.selected - Math.floor(limit / 2)), maxStart);
		const visibleItems = items.slice(start, start + limit);
		const range = items.length === 0 ? "empty" : `${start + 1}-${start + visibleItems.length}/${items.length}`;
		const lines: string[] = [this.theme.fg("accent", this.theme.bold(`ATTENTION QUEUE · ${range}`))];
		if (width >= 60) lines.push(this.theme.fg("dim", "Interactions → failures/recovery → Work Queue → ambient Agents"));
		visibleItems.forEach((item, offset) => {
			const index = start + offset;
			const target = this.state.agents.find((agentState) => agentState.id === item.agentId);
			const marker = index === this.selected ? "›" : " ";
			const color = item.kind === "Interaction" ? "warning" : item.kind === "Failure" ? "error" : item.kind === "Recovery" ? "warning" : "text";
			const text = `${marker} ${item.kind.padEnd(11)} ${target?.name ?? item.agentId} · ${item.label}`;
			lines.push(fit(index === this.selected ? this.theme.fg("accent", this.theme.bold(text)) : this.theme.fg(color, text), width, "…"));
		});
		const occupiedSlots = this.state.agents.filter((item) => item.holdsSlot).length;
		if (width < 60) {
			lines.push(this.theme.fg("dim", `Slots ${occupiedSlots}/${this.state.concurrencyLimit} · queue ${this.state.queue.length} · [/] move · ⌫ cancel`));
			return lines.map((line) => fit(line, width, "…"));
		}
		const queueLimit = width < 88 ? 2 : 4;
		lines.push("", this.theme.fg("accent", this.theme.bold(`AUTHORITATIVE WORK QUEUE · ${this.state.queue.length}`)));
		if (this.state.queue.length === 0) lines.push(this.theme.fg("dim", "  empty"));
		this.state.queue.slice(0, queueLimit).forEach((entry, index) => {
			const target = this.state.agents.find((item) => item.id === entry.agentId);
			lines.push(fit(`  ${index + 1}. ${entry.kind} · ${target?.name ?? entry.agentId} · ${entry.label}`, width, "…"));
		});
		lines.push(this.theme.fg("dim", `Concurrency Slots ${occupiedSlots}/${this.state.concurrencyLimit} · [ ] reorder · Backspace cancel`));
		return lines.map((line) => fit(line, width, "…"));
	}

	private renderCommand(width: number): string[] {
		const target = this.targetAgent();
		const commandRows = COMMAND_ACTIONS.map((action, index) => {
			const row = `${index === this.commandSelected ? "›" : " "} ${action}`;
			return index === this.commandSelected ? this.theme.fg("accent", this.theme.bold(row)) : row;
		});
		if (width < 60) {
			return [
				this.theme.fg("accent", this.theme.bold(`INTENT · TARGET ${target?.name ?? "none"} · ${target?.status ?? "none"}`)),
				...commandRows,
				this.theme.fg("muted", "↑↓ intent · ←→ target · Enter run"),
			].map((line) => fit(line, width, "…"));
		}
		const commands = [
			this.theme.fg("accent", this.theme.bold("INTENT")),
			...commandRows,
			this.theme.fg("muted", "↑↓ intent · ←→/Tab target · Enter run"),
		];
		if (width < 88) {
			return [
				...commands,
				this.theme.fg("border", "─".repeat(Math.max(1, width))),
				this.theme.fg("accent", this.theme.bold(`TARGET · ${target?.name ?? "none"}`)),
				`Agent Status ${target?.status ?? "none"} · Runtime ${target?.runtime ?? "none"} · Slot ${target?.holdsSlot ? "held" : "released"}`,
				`Interactions ${target?.interactions.length ?? 0} · Dispatch Target stays ${this.state.dispatchTarget}`,
			].map((line) => fit(line, width, "…"));
		}
		const context = [
			this.theme.fg("accent", this.theme.bold(`TARGET · ${target?.name ?? "none"}`)),
			`Dispatch Target: ${this.state.dispatchTarget}`,
			this.theme.fg("dim", "List target and Dispatch Target are deliberately independent."),
			...this.inspector(target, Math.max(1, width)),
		];
		return beside([...commands, ""], context, width, 30);
	}

	private composer(width: number): string[] {
		if (!this.compose) return [];
		const label = this.compose.kind === "Dispatch"
			? `Dispatch → ${this.state.dispatchTarget}`
			: `${this.compose.kind} → ${this.state.agents.find((item) => item.id === this.compose?.agentId)?.name ?? "selected Agent"}`;
		const maxEditorLines = width < 60 ? 3 : width < 88 ? 5 : 8;
		const editorLines = this.editor
			.render(Math.max(1, width - 2))
			.slice(0, maxEditorLines)
			.map((line) => fit(` ${line}`, width, "…"));
		return [
			this.theme.fg("border", "─".repeat(Math.max(1, width))),
			fit(this.theme.fg("accent", this.theme.bold(label)), width),
			...editorLines,
			fit(this.theme.fg("dim", "Enter accepts · Esc rejects · type ‘invalid’ to exercise preflight rejection"), width, "…"),
		];
	}

	private composeContext(width: number): string[] {
		if (this.variant === "A") {
			const target = this.selectedAgent();
			return [
				this.theme.fg("accent", this.theme.bold(`ROSTER CONTEXT · ${this.selected + 1}/${this.state.agents.length}`)),
				`${target?.name ?? "none"} · ${target?.status ?? "none"} · Runtime ${target?.runtime ?? "none"} · Slot ${target?.holdsSlot ? "held" : "released"}`,
			].map((line) => fit(line, width, "…"));
		}
		if (this.variant === "B") {
			const items = this.attentionItems();
			const item = items[this.selected];
			const target = this.state.agents.find((agentState) => agentState.id === item?.agentId);
			return [
				this.theme.fg("accent", this.theme.bold(`ATTENTION CONTEXT · ${Math.min(this.selected + 1, items.length)}/${items.length}`)),
				`${item?.kind ?? "none"} · ${target?.name ?? "none"} · ${item?.label ?? "No item selected"}`,
			].map((line) => fit(line, width, "…"));
		}
		const target = this.targetAgent();
		return [
			this.theme.fg("accent", this.theme.bold(`COMMAND CONTEXT · ${COMMAND_ACTIONS[this.commandSelected]}`)),
			`Target ${target?.name ?? "none"} · ${target?.status ?? "none"} · Dispatch Target unchanged`,
		].map((line) => fit(line, width, "…"));
	}

	private footer(width: number): string[] {
		const active = this.activeAgent();
		const leaseAgent = this.state.agents.find((item) => item.id === this.state.lease.agentId);
		const border = this.theme.fg("border", "─".repeat(Math.max(1, width)));
		const host = `Host ${active?.name ?? "none"} · Lease ${leaseAgent?.name ?? this.state.lease.agentId}/${this.state.lease.holder}/g${this.state.lease.generation}`;
		const confirmation = this.state.pendingConfirmation;
		const handoff = this.state.pendingHandoff;

		if (width < 88 && confirmation) {
			const promptLines = wrapTextWithAnsi(confirmation.prompt, Math.max(1, width)).map((line) => this.theme.fg("warning", line));
			return [
				border,
				fit(host, width, "…"),
				fit(this.theme.bg("selectedBg", this.theme.fg("warning", `CONFIRM ${confirmation.kind}`)), width, "…"),
				...promptLines,
				fit(this.theme.fg("muted", "y/Enter confirm · n/Esc cancel · other input ignored"), width, "…"),
			];
		}
		if (width < 88 && handoff) {
			const source = this.state.agents.find((item) => item.id === handoff.sourceAgentId);
			const target = this.state.agents.find((item) => item.id === handoff.targetAgentId);
			return [
				border,
				fit(host, width, "…"),
				fit(this.theme.bg("selectedBg", this.theme.fg("warning", `HANDOFF PENDING · ${source?.name} → ${target?.name}`)), width, "…"),
				fit(this.theme.fg("warning", "Ordinary input is ignored and not buffered or replayed."), width, "…"),
				fit(this.theme.fg("muted", "Enter commit · Esc cancel"), width, "…"),
			];
		}
		const feedback = this.theme.fg("warning", `FEEDBACK: ${this.state.feedback[0] ?? "No operation yet."}`);
		if (width < 60) {
			return [
				border,
				fit(host, width, "…"),
				fit(feedback, width, "…"),
				fit(this.theme.fg("muted", "a Attach · v Peek · e Reply · u stale · Esc"), width, "…"),
				fit(this.theme.fg("muted", "n New · d Dispatch · w Work · s Stop · z Archive"), width, "…"),
				fit(this.theme.fg("muted", "l Release · x cleanup · X destructive · Del perm"), width, "…"),
			];
		}
		if (width < 88) {
			return [
				border,
				fit(this.theme.fg("muted", "a Attach · v Peek · e Reply · u stale retry · s Stop · z Archive · l Release"), width, "…"),
				fit(this.theme.fg("muted", "n New · i/d Dispatch · w work · x/X Cleanup · Del delete · [/] queue · Esc"), width, "…"),
				fit(host, width, "…"),
				fit(feedback, width, "…"),
			];
		}
		const lines = [
			border,
			this.theme.fg("muted", "COMMON · a Attach · v Peek · e Reply · u stale retry · s Stop · z Archive · l Release · x/X Cleanup · Del Permanent delete"),
			this.theme.fg("muted", "n New · i/d Dispatch · w work · p Pin · m Rename · o filter/group · [/] reorder · Backspace cancel · Esc return"),
			host,
			`Console View State: ${this.state.viewState}`,
			...this.state.feedback.slice(0, 3).map((message, index) => this.theme.fg(index === 0 ? "warning" : "dim", `${index === 0 ? "FEEDBACK" : "history"}: ${message}`)),
		];
		if (handoff) {
			const source = this.state.agents.find((item) => item.id === handoff.sourceAgentId);
			const target = this.state.agents.find((item) => item.id === handoff.targetAgentId);
			lines.push(
				this.theme.bg("selectedBg", this.theme.fg("warning", `HANDOFF PENDING · ${source?.name} → ${target?.name} · input ignored/not buffered · Enter commit · Esc cancel`)),
			);
		}
		if (confirmation) {
			lines.push(
				this.theme.bg("selectedBg", this.theme.fg("warning", `CONFIRM ${confirmation.kind} · y/Enter yes · n/Esc no`)),
				...wrapTextWithAnsi(confirmation.prompt, Math.max(1, width)).map((line) => this.theme.fg("warning", line)),
			);
		}
		return lines.map((line) => fit(line, width, "…"));
	}

	render(width: number): string[] {
		const safeWidth = Math.max(1, width);
		const content = safeWidth < 88 && (this.compose || this.state.pendingConfirmation)
			? this.composeContext(safeWidth)
			: this.variant === "A"
				? this.renderRoster(safeWidth)
				: this.variant === "B"
					? this.renderAttention(safeWidth)
					: this.renderCommand(safeWidth);
		const lines = [...this.header(safeWidth), ...content, ...this.composer(safeWidth), ...this.footer(safeWidth)];
		return lines.map((line) => fit(line, safeWidth, ""));
	}

	invalidate(): void {
		this.editor.invalidate();
	}

	dispose(): void {
		this.disposed = true;
		this.editor.focused = false;
	}
}

export function prototypeFixtureAudit(): string[] {
	const problems: string[] = [];
	const mixed = makeState("mixed");
	const statuses = new Set(mixed.agents.map((item) => item.status));
	for (const status of ["Starting", "Working", "Needs input", "Completed", "Failed", "Stopped"] satisfies AgentStatus[]) {
		if (!statuses.has(status)) problems.push(`missing Agent Status: ${status}`);
	}
	for (const scenario of SCENARIOS) {
		const state = makeState(scenario.id);
		if (state.concurrencyLimit !== 4) problems.push(`${scenario.id}: concurrency limit is not four`);
		if (!state.dispatchTarget) problems.push(`${scenario.id}: Dispatch Target missing`);
		if (!state.agents.every((item) => item.conversation && item.workspace.path)) problems.push(`${scenario.id}: incomplete Agent fixture`);
		if (state.agents.filter((item) => item.holdsSlot).length > state.concurrencyLimit) {
			problems.push(`${scenario.id}: Concurrency Slot holders exceed limit`);
		}
		for (const entry of state.queue) {
			if (state.agents.find((item) => item.id === entry.agentId)?.holdsSlot) {
				problems.push(`${scenario.id}: queued Agent ${entry.agentId} also holds a Concurrency Slot`);
			}
		}
		if (state.agents.some((item) => item.workspace.kind === "Original Checkout" && item.workspace.removed)) {
			problems.push(`${scenario.id}: Original Checkout marked removed`);
		}
	}
	return problems;
}

let state = makeState("mixed");
let consoleOpen = false;
let disposed = false;

async function openPrototype(ctx: ExtensionContext): Promise<void> {
	if (consoleOpen || disposed || ctx.mode !== "tui") return;
	consoleOpen = true;
	try {
		const result = await ctx.ui.custom<ConsoleResult>((tui, theme, _keybindings, done) =>
			new AgentConsolePrototype(
				tui,
				theme,
				state,
				(next) => {
					state = next;
				},
				done,
			),
		);
		if (result?.kind === "attach") ctx.ui.notify(`SIMULATED Attach → ${result.agentName}; native Pi interface is unchanged`, "info");
		else ctx.ui.notify("Returned to the current Agent's native Pi interface; work continues", "info");
	} finally {
		consoleOpen = false;
	}
}

export default function agentConsoleInteractionPrototype(pi: ExtensionAPI): void {
	pi.registerCommand("agent-console-prototype", {
		description: "Open the throwaway Agent Console interaction-model prototype",
		handler: async (_args, ctx) => openPrototype(ctx),
	});

	pi.registerCommand("agent-console-prototype-reset", {
		description: "Reset the throwaway prototype to its deterministic mixed-lifecycle fixture",
		handler: async (_args, ctx) => {
			state = makeState("mixed");
			ctx.ui.notify("Agent Console prototype fixture reset", "info");
			await openPrototype(ctx);
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		disposed = false;
		const problems = prototypeFixtureAudit();
		if (problems.length > 0) {
			ctx.ui.notify(`Prototype fixture invalid: ${problems.join("; ")}`, "error");
			return;
		}
		if (ctx.ui.getEditorComponent()) {
			ctx.ui.notify("Prototype replaces another custom editor; launch with --no-extensions for isolated evaluation", "warning");
		}
		ctx.ui.setEditorComponent((tui, theme, keybindings) =>
			new EmptyLeftEditor(tui, theme, keybindings, () => {
				void openPrototype(ctx);
			}),
		);
		ctx.ui.setStatus("agent-console-interaction-prototype", ctx.ui.theme.fg("warning", "SIMULATED · empty ← opens Agent Console"));
		await openPrototype(ctx);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		disposed = true;
		ctx.ui.setStatus("agent-console-interaction-prototype", undefined);
	});
}
