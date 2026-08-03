/**
 * THROWAWAY PROTOTYPE — validates transparent native Pi handoff through tmux.
 * This is evidence for a wayfinding decision, not production Agent Console code.
 */

import { appendFileSync, chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
	CustomEditor,
	type ExtensionAPI,
	type ExtensionContext,
	type KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import {
	getCapabilities,
	hyperlink,
	Image,
	isKittyProtocolActive,
	Key,
	matchesKey,
	parseKey,
	truncateToWidth,
	type Component,
	type EditorTheme,
	type TUI,
} from "@earendil-works/pi-tui";
import { Type } from "typebox";

const ROOT = process.env.PI_AGENT_CONSOLE_PROTOTYPE_ROOT;
const STATE_DIR = process.env.PI_AGENT_CONSOLE_PROTOTYPE_STATE_DIR;
const SOCKET = process.env.PI_AGENT_CONSOLE_PROTOTYPE_SOCKET;
const SESSION_NAME = process.env.PI_AGENT_CONSOLE_PROTOTYPE_SESSION;

if (!ROOT || !STATE_DIR || !SOCKET || !SESSION_NAME) {
	throw new Error("transparent-tmux prototype extension must be launched by run-agent");
}

const CONTROLLER = join(ROOT, "prototype");
const AGENT_STATE_DIR = join(STATE_DIR, "agents");
const EVENT_LOG = join(STATE_DIR, "events.jsonl");
const SAMPLE_PNG =
	"iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAPUlEQVR42u3OMQEAIAgAMOIYwhDGIZ0hLIQhOHh27F/UPtVyoyUEBAQEBAQExgPrZbVktQgICAgICAiMBz7fj1WXt1qqHQAAAABJRU5ErkJggg==";

type PrototypeStatus = "Starting" | "Working" | "Needs input" | "Completed" | "Failed" | "Stopped";

type AgentRow = {
	name: string;
	attached: number;
	dead: boolean;
	pid: number | null;
	command: string;
	status: PrototypeStatus | "Unknown";
	detail?: string;
	updatedAt?: string;
};

type Diagnostics = {
	capabilities: ReturnType<typeof getCapabilities>;
	kittyKeyboardActive: boolean;
	term: string;
	innerTermProgram: string;
	outerTerm: string;
	outerTermProgram: string;
	colorTerm: string;
	tmuxVersion: string;
	clientName: string;
	clientTermName: string;
	clientTermFeatures: string;
	clientSize: string;
	paneTitle: string;
	extendedKeys: string;
	extendedKeysFormat: string;
	defaultTerminal: string;
};

type ConsoleResult =
	| { kind: "close" }
	| { kind: "new" }
	| { kind: "switch"; session: string };

type ConsoleTheme = ExtensionContext["ui"]["theme"];

let currentStatus: PrototypeStatus = "Starting";
let currentDetail = "extension startup";
let consoleOpen = false;
let disposed = false;

function ensureRuntimeDirectories(): void {
	mkdirSync(AGENT_STATE_DIR, { recursive: true, mode: 0o700 });
	chmodSync(AGENT_STATE_DIR, 0o700);
}

function appendEvent(event: string, details: Record<string, unknown> = {}): void {
	ensureRuntimeDirectories();
	appendFileSync(
		EVENT_LOG,
		`${JSON.stringify({
			timestamp: new Date().toISOString(),
			event,
			session: SESSION_NAME,
			pid: process.pid,
			...details,
		})}\n`,
		{ mode: 0o600 },
	);
}

function writeAgentState(status: PrototypeStatus, detail: string): void {
	currentStatus = status;
	currentDetail = detail;
	ensureRuntimeDirectories();
	const target = join(AGENT_STATE_DIR, `${SESSION_NAME}.json`);
	const temporary = `${target}.${process.pid}.tmp`;
	writeFileSync(
		temporary,
		`${JSON.stringify(
			{
				name: SESSION_NAME,
				status,
				detail,
				pid: process.pid,
				cwd: process.cwd(),
				updatedAt: new Date().toISOString(),
			},
			null,
			2,
		)}\n`,
		{ mode: 0o600 },
	);
	renameSync(temporary, target);
	appendEvent("status", { status, detail });
}

function readAgentState(name: string): Pick<AgentRow, "status" | "detail" | "updatedAt"> {
	try {
		const parsed = JSON.parse(readFileSync(join(AGENT_STATE_DIR, `${name}.json`), "utf8")) as {
			status?: PrototypeStatus;
			detail?: string;
			updatedAt?: string;
		};
		return {
			status: parsed.status ?? "Unknown",
			detail: parsed.detail,
			updatedAt: parsed.updatedAt,
		};
	} catch {
		return { status: "Unknown" };
	}
}

async function listAgents(pi: ExtensionAPI): Promise<AgentRow[]> {
	const format = "#{session_name}|#{session_attached}|#{pane_dead}|#{pane_pid}|#{pane_current_command}";
	const result = await pi.exec("tmux", ["-S", SOCKET, "list-sessions", "-F", format], { timeout: 2000 });
	if (result.code !== 0) return [];

	return result.stdout
		.trim()
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			const [name = "", attached = "0", dead = "0", pid = "", command = ""] = line.split("|");
			const state = readAgentState(name);
			return {
				name,
				attached: Number(attached),
				dead: dead === "1",
				pid: /^\d+$/.test(pid) ? Number(pid) : null,
				command,
				...state,
			};
		})
		.sort((left, right) => left.name.localeCompare(right.name));
}

async function tmuxOutput(pi: ExtensionAPI, args: string[]): Promise<string> {
	const result = await pi.exec("tmux", ["-S", SOCKET, ...args], { timeout: 2000 });
	return result.code === 0 ? result.stdout.trim() : `<error: ${result.stderr.trim() || result.code}>`;
}

async function collectDiagnostics(pi: ExtensionAPI): Promise<Diagnostics> {
	const client = await tmuxOutput(pi, [
		"display-message",
		"-p",
		"#{client_name}|#{client_termname}|#{client_termfeatures}|#{client_width}x#{client_height}|#{pane_title}",
	]);
	const clientFields = client.split("|");
	const clientName = clientFields[0] ?? "";
	const clientTermName = clientFields[1] ?? "";
	const clientTermFeatures = clientFields[2] ?? "";
	const clientSize = clientFields[3] ?? "";
	const paneTitle = clientFields.slice(4).join("|");

	return {
		capabilities: getCapabilities(),
		kittyKeyboardActive: isKittyProtocolActive(),
		term: process.env.TERM ?? "",
		innerTermProgram: process.env.TERM_PROGRAM ?? "",
		outerTerm: process.env.PI_AGENT_CONSOLE_PROTOTYPE_OUTER_TERM ?? "",
		outerTermProgram: process.env.PI_AGENT_CONSOLE_PROTOTYPE_OUTER_TERM_PROGRAM ?? "",
		colorTerm: process.env.COLORTERM ?? "",
		tmuxVersion: await tmuxOutput(pi, ["-V"]),
		clientName,
		clientTermName,
		clientTermFeatures,
		clientSize,
		paneTitle,
		extendedKeys: await tmuxOutput(pi, ["show-options", "-s", "-v", "extended-keys"]),
		extendedKeysFormat: await tmuxOutput(pi, ["show-options", "-s", "-v", "extended-keys-format"]),
		defaultTerminal: await tmuxOutput(pi, ["show-options", "-g", "-v", "default-terminal"]),
	};
}

function rawPreview(data: string): string {
	const preview = JSON.stringify(data);
	return preview.length > 88 ? `${preview.slice(0, 85)}...` : preview;
}

function sendOsc52Clipboard(text: string): void {
	const payload = Buffer.from(text, "utf8").toString("base64");
	const osc52 = `\x1b]52;c;${payload}\x07`;
	if (process.env.TMUX) {
		// set-clipboard=off disables tmux's unreliable automatic clipboard path.
		// Send the probe through tmux's visible-pane DCS passthrough instead, while
		// keeping application content out of tmux paste buffers.
		process.stdout.write(`\x1bPtmux;${osc52.replaceAll("\x1b", "\x1b\x1b")}\x1b\\`);
	} else {
		process.stdout.write(osc52);
	}
	appendEvent("clipboard_probe", { text, transport: process.env.TMUX ? "tmux-dcs" : "direct" });
}

class EmptyLeftEditor extends CustomEditor {
	constructor(
		tui: TUI,
		theme: EditorTheme,
		keybindings: KeybindingsManager,
		private readonly onEmptyLeft: () => void,
	) {
		super(tui, theme, keybindings);
	}

	override handleInput(data: string): void {
		if (matchesKey(data, Key.left) && this.getExpandedText().length === 0) {
			this.onEmptyLeft();
			return;
		}
		super.handleInput(data);
	}
}

class AgentConsoleComponent implements Component {
	private selected = 0;
	private view: "agents" | "diagnostics" = "agents";
	private keyEvents: Array<{ parsed: string; raw: string; paste: boolean }> = [];
	private clipboardResult = "not attempted";
	private readonly image: Image;

	constructor(
		private readonly tui: TUI,
		private readonly theme: ConsoleTheme,
		private readonly agents: AgentRow[],
		private readonly diagnostics: Diagnostics,
		private readonly done: (result: ConsoleResult) => void,
	) {
		this.selected = Math.max(
			0,
			this.agents.findIndex((agent) => agent.name === SESSION_NAME),
		);
		this.image = new Image(
			SAMPLE_PNG,
			"image/png",
			{ fallbackColor: (text: string) => this.theme.fg("warning", text) },
			{ maxWidthCells: 8, maxHeightCells: 2 },
		);
	}

	private rememberKey(data: string): void {
		this.keyEvents.unshift({
			parsed: parseKey(data) ?? "unparsed",
			raw: rawPreview(data),
			paste: data.includes("\x1b[200~") || data.includes("\x1b[201~") || data.length > 16,
		});
		this.keyEvents = this.keyEvents.slice(0, 5);
	}

	handleInput(data: string): void {
		if (this.view === "diagnostics") {
			this.rememberKey(data);
			if (matchesKey(data, Key.escape) || matchesKey(data, "q")) {
				this.view = "agents";
			} else if (matchesKey(data, "c")) {
				const text = `Agent Console OSC 52 probe ${new Date().toISOString()}`;
				sendOsc52Clipboard(text);
				this.clipboardResult = `sent: ${text}`;
			}
			this.tui.requestRender();
			return;
		}

		if (matchesKey(data, Key.escape) || matchesKey(data, "q")) {
			this.done({ kind: "close" });
			return;
		}
		if (matchesKey(data, Key.up) && this.selected > 0) {
			this.selected--;
		} else if (matchesKey(data, Key.down) && this.selected < this.agents.length - 1) {
			this.selected++;
		} else if (matchesKey(data, "n")) {
			this.done({ kind: "new" });
			return;
		} else if (matchesKey(data, "d")) {
			this.view = "diagnostics";
		} else if (matchesKey(data, Key.enter) && this.agents[this.selected]) {
			this.done({ kind: "switch", session: this.agents[this.selected]!.name });
			return;
		}
		this.tui.requestRender();
	}

	private fit(line: string, width: number): string {
		return truncateToWidth(line, Math.max(1, width), "");
	}

	private border(width: number): string {
		return this.theme.fg("borderAccent", "─".repeat(Math.max(1, Math.min(width, 120))));
	}

	private renderAgents(width: number): string[] {
		const lines: string[] = [
			this.border(width),
			this.fit(this.theme.fg("accent", this.theme.bold("AGENT CONSOLE · transparent-tmux prototype")), width),
			this.fit(
				this.theme.fg(
					"dim",
					`Rendered inside ${SESSION_NAME} by ctx.ui.custom(); tmux status/prefix are disabled.`,
				),
				width,
			),
			"",
		];

		if (this.agents.length === 0) {
			lines.push(this.fit(this.theme.fg("warning", "No tmux Agent sessions were discovered."), width));
		} else {
			for (let index = 0; index < this.agents.length; index++) {
				const agent = this.agents[index]!;
				const selected = index === this.selected;
				const pointer = selected ? "›" : " ";
				const current = agent.name === SESSION_NAME ? " current" : "";
				const attached = agent.attached > 0 ? ` · ${agent.attached} client` : " · detached";
				const dead = agent.dead ? " · pane exited" : "";
				const text = `${pointer} ${agent.name.padEnd(10)} ${agent.status.padEnd(11)}${current}${attached}${dead}`;
				lines.push(
					this.fit(
						selected ? this.theme.fg("accent", this.theme.bold(text)) : this.theme.fg("text", text),
						width,
					),
				);
				if (selected && agent.detail) {
					lines.push(this.fit(this.theme.fg("dim", `    ${agent.detail} · pid ${agent.pid ?? "?"}`), width));
				}
			}
		}

		lines.push(
			"",
			this.fit(this.theme.fg("muted", "↑↓ select · enter attach · n new Agent · d diagnostics · esc return"), width),
			this.fit(this.theme.fg("dim", `Current Pi state: ${currentStatus} — ${currentDetail}`), width),
			this.border(width),
		);
		return lines;
	}

	private renderDiagnostics(width: number): string[] {
		const caps = this.diagnostics.capabilities;
		const trueColor = `${Array.from({ length: 25 }, (_, index) => {
			const [red, green, blue] =
				index <= 6
					? [255, Math.round((index / 6) * 255), 0]
					: index <= 12
						? [Math.round(((12 - index) / 6) * 255), 255, 0]
						: index <= 18
							? [0, 255, Math.round(((index - 12) / 6) * 255)]
							: [0, Math.round(((24 - index) / 6) * 255), 255];
			return `\x1b[48;2;${red};${green};${blue}m  `;
		}).join("")}\x1b[0m`;
		const link = caps.hyperlinks
			? hyperlink(this.theme.fg("accent", this.theme.underline("clickable OSC 8 probe")), "https://pi.dev")
			: this.theme.fg("warning", "OSC 8 unavailable according to Pi capability detection");
		const lines: string[] = [
			this.border(width),
			this.fit(this.theme.fg("accent", this.theme.bold("TRANSPORT DIAGNOSTICS")), width),
			this.fit(
				`outer TERM_PROGRAM=${this.diagnostics.outerTermProgram || "?"} TERM=${this.diagnostics.outerTerm || "?"}`,
				width,
			),
			this.fit(
				`inner TERM_PROGRAM=${this.diagnostics.innerTermProgram} TERM=${this.diagnostics.term}`,
				width,
			),
			this.fit(`COLORTERM=${this.diagnostics.colorTerm}  tmux=${this.diagnostics.tmuxVersion}`, width),
			this.fit(`client=${this.diagnostics.clientName || "?"} ${this.diagnostics.clientTermName} ${this.diagnostics.clientSize}`, width),
			this.fit(`client_termfeatures=${this.diagnostics.clientTermFeatures}`, width),
			this.fit(
				`inner TERM=${this.diagnostics.defaultTerminal} · extended-keys=${this.diagnostics.extendedKeys}/${this.diagnostics.extendedKeysFormat}`,
				width,
			),
			this.fit(
				`Pi capabilities: trueColor=${caps.trueColor} hyperlinks=${caps.hyperlinks} images=${caps.images ?? "none"}`,
				width,
			),
			this.fit(`Kitty keyboard protocol active in Pi: ${this.diagnostics.kittyKeyboardActive}`, width),
			this.fit(`render width=${width} · process stdout=${process.stdout.columns ?? "?"}x${process.stdout.rows ?? "?"}`, width),
			this.fit(`pane title=${this.diagnostics.paneTitle || "(empty)"}`, width),
			"",
			this.fit(`24-bit color probe: ${trueColor}`, width),
			this.fit(`Hyperlink probe: ${link}`, width),
			this.fit("Image probe (actual Pi Image component):", width),
		];
		lines.push(...this.image.render(width).map((line) => this.fit(`  ${line}`, width)));
		lines.push(
			this.fit(
				this.theme.fg("warning", "Pi 0.83.0 intentionally disables image protocols whenever TMUX is present."),
				width,
			),
			"",
			this.fit(this.theme.fg("muted", "Press modified keys or paste multiline text; the latest raw input chunks appear below."), width),
		);

		if (this.keyEvents.length === 0) {
			lines.push(this.fit(this.theme.fg("dim", "  no key/paste events captured yet"), width));
		} else {
			for (const event of this.keyEvents) {
				lines.push(this.fit(`  ${event.parsed.padEnd(18)} paste=${String(event.paste).padEnd(5)} raw=${event.raw}`, width));
			}
		}

		lines.push(
			"",
			this.fit(this.theme.fg("muted", "c send OSC 52 clipboard probe · esc/q back · resize this terminal freely"), width),
			this.fit(this.theme.fg("dim", `clipboard: ${this.clipboardResult}`), width),
			this.border(width),
		);
		return lines;
	}

	render(width: number): string[] {
		return this.view === "agents" ? this.renderAgents(width) : this.renderDiagnostics(width);
	}

	invalidate(): void {
		this.image.invalidate();
	}
}

async function switchClient(pi: ExtensionAPI, target: string): Promise<boolean> {
	const result = await pi.exec("tmux", ["-S", SOCKET, "switch-client", "-t", `=${target}`], { timeout: 2000 });
	if (result.code !== 0) {
		appendEvent("client_switch_failed", { target, stderr: result.stderr });
		return false;
	}
	appendEvent("client_switched", { target });
	return true;
}

async function openAgentConsole(pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
	if (consoleOpen || disposed || ctx.mode !== "tui") return;
	consoleOpen = true;
	appendEvent("console_opened", { idle: ctx.isIdle() });

	try {
		for (;;) {
			const [agents, diagnostics] = await Promise.all([listAgents(pi), collectDiagnostics(pi)]);
			const result = await ctx.ui.custom<ConsoleResult>((tui, theme, _keybindings, done) =>
				new AgentConsoleComponent(tui, theme, agents, diagnostics, done),
			);

			if (!result || result.kind === "close") {
				appendEvent("console_closed", { action: "return" });
				return;
			}
			if (result.kind === "new") {
				const created = await pi.exec(CONTROLLER, ["new", "--cwd", ctx.cwd], { timeout: 10000 });
				if (created.code !== 0) {
					ctx.ui.notify(`Could not create Agent: ${created.stderr.trim()}`, "error");
					appendEvent("agent_create_failed", { stderr: created.stderr });
					continue;
				}
				const name = created.stdout.trim().split("\n").pop() ?? "unknown";
				ctx.ui.notify(`Created ${name}`, "info");
				appendEvent("agent_created", { target: name });
				continue;
			}
			if (result.session === SESSION_NAME) {
				appendEvent("console_closed", { action: "current_agent" });
				return;
			}
			if (!(await switchClient(pi, result.session))) {
				ctx.ui.notify(`Could not attach to ${result.session}`, "error");
				continue;
			}
			return;
		}
	} catch (error) {
		appendEvent("console_error", { error: error instanceof Error ? error.message : String(error) });
		ctx.ui.notify(`Agent Console prototype failed: ${error instanceof Error ? error.message : String(error)}`, "error");
	} finally {
		consoleOpen = false;
	}
}

export default function transparentTmuxPrototype(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "prototype_wait",
		label: "Prototype active turn",
		description: "Wait visibly so native Agent switching can be tested while a real Pi turn remains active",
		parameters: Type.Object({
			seconds: Type.Integer({ minimum: 5, maximum: 300 }),
		}),
		async execute(_toolCallId, params, signal, onUpdate) {
			const startedAt = Date.now();
			for (let elapsed = 0; elapsed < params.seconds; elapsed++) {
				onUpdate?.({
					content: [{ type: "text", text: `Active-turn probe: ${elapsed + 1}/${params.seconds}s` }],
					details: { elapsed: elapsed + 1, seconds: params.seconds, startedAt },
				});
				await delay(1000, undefined, { signal });
			}
			return {
				content: [{ type: "text", text: `Active-turn probe completed after ${params.seconds}s.` }],
				details: { seconds: params.seconds, startedAt, finishedAt: Date.now() },
			};
		},
	});

	pi.registerTool({
		name: "prototype_media_probe",
		label: "Prototype image probe",
		description: "Return a tiny real PNG to exercise Pi's terminal image path under tmux",
		parameters: Type.Object({}),
		async execute() {
			return {
				content: [
					{ type: "text", text: "A real PNG follows. Under current Pi+tmux this should render as a fallback." },
					{ type: "image", data: SAMPLE_PNG, mimeType: "image/png" },
				],
				details: {},
			};
		},
	});

	pi.registerCommand("prototype-console", {
		description: "Open the throwaway Agent Console (fallback for empty-editor left arrow)",
		handler: async (_args, ctx) => openAgentConsole(pi, ctx),
	});

	pi.registerCommand("prototype-work", {
		description: "Start a deterministic active-turn transport probe (default 60 seconds)",
		handler: async (args, ctx) => {
			if (!ctx.isIdle()) {
				ctx.ui.notify("The Agent already has an active turn", "warning");
				return;
			}
			const requested = Number.parseInt(args.trim(), 10);
			const seconds = Number.isFinite(requested) ? Math.max(5, Math.min(300, requested)) : 60;
			pi.sendUserMessage(
				`Transport test: call prototype_wait exactly once with seconds=${seconds}. Do not call another tool. After it returns, say only \"active-turn probe complete\".`,
			);
		},
	});

	pi.registerCommand("prototype-media", {
		description: "Exercise a real image tool result through Pi and tmux",
		handler: async (_args, ctx) => {
			if (!ctx.isIdle()) {
				ctx.ui.notify("Wait until the current turn settles", "warning");
				return;
			}
			pi.sendUserMessage(
				'Transport test: call prototype_media_probe exactly once. After it returns, say only "media probe complete". Do not judge terminal rendering; the human will do that.',
			);
		},
	});

	pi.on("session_start", async (event, ctx) => {
		disposed = false;
		writeAgentState("Needs input", `native Pi ready (${event.reason})`);
		ctx.ui.setTitle(`Agent Console prototype · ${SESSION_NAME}`);
		ctx.ui.setStatus("agent-console-prototype", ctx.ui.theme.fg("dim", "← Agent Console"));

		if (ctx.ui.getEditorComponent()) {
			appendEvent("custom_editor_replaced", { limitation: "prototype does not compose competing custom editors" });
			ctx.ui.notify("Prototype replaced another custom editor; editor composition is not validated", "warning");
		}
		ctx.ui.setEditorComponent((tui, theme, keybindings) =>
			new EmptyLeftEditor(tui, theme, keybindings, () => {
				void openAgentConsole(pi, ctx);
			}),
		);
		appendEvent("session_started", { reason: event.reason, cwd: ctx.cwd, piSessionName: pi.getSessionName() });
	});

	pi.on("agent_start", async (_event, ctx) => {
		writeAgentState("Working", "authoritative Pi agent_start received");
		ctx.ui.setTitle(`● ${SESSION_NAME} · Working`);
	});

	pi.on("agent_end", async () => {
		appendEvent("agent_end");
	});

	pi.on("agent_settled", async (_event, ctx) => {
		writeAgentState("Completed", "authoritative Pi agent_settled received");
		ctx.ui.setTitle(`Agent Console prototype · ${SESSION_NAME} · Completed`);
	});

	pi.on("session_shutdown", async (event, ctx) => {
		disposed = true;
		writeAgentState("Stopped", `Pi session_shutdown (${event.reason})`);
		ctx.ui.setStatus("agent-console-prototype", undefined);
		appendEvent("session_shutdown", { reason: event.reason });
	});
}
