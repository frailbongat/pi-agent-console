# Pi native handoff capabilities

**Research question:** Which public Pi interfaces can support context-sensitive `←`, backgrounding an active turn into Agent Console in the same terminal, reattaching to a full native Pi session, and adopting saved sessions across projects?

**Evidence baseline:** `@earendil-works/pi-coding-agent` **v0.83.0**, whose package source is tag commit [`845d6ff1f6643aba440341cce877ce1c43ebbc39`](https://github.com/earendil-works/pi/tree/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent). The package manifest identifies that version and exports the SDK plus RPC entry point.[S1]

## Conclusion

Pi v0.83.0 provides enough documented surface for an **in-process, reduced-fidelity handoff**: a global extension can replace the editor, interpret `←` contextually, show Agent Console as a custom TUI component while the current turn keeps running, and dismiss that component to restore the current Agent's native Pi UI. Pi's SDK or RPC mode can concurrently run and observe other headless Agents, and `SessionManager.listAll()` can discover saved sessions across projects.[S2][S3][S4][S10]

Pi does **not** provide a public way to transfer a live ordinary interactive session to another process, detach its native `InteractiveMode` frontend while leaving that Agent running, or attach the full native TUI to an already-running SDK/RPC Agent. The built-in suspend stops the whole Pi process group, session switching first aborts the active Agent, RPC deliberately lacks TUI components, and Pi exits when RPC stdin ends or an interactive process receives `SIGHUP`.[S6][S7][S9][S11]

Therefore **no Pi version can be called compatible with the complete required native flow as of v0.83.0**. For a deliberately reduced-fidelity fallback, **v0.80.4 is the minimum identifiable baseline**: custom editors arrived in v0.38.0, all-project session discovery in v0.43.0, RPC session-tree inspection in v0.80.3, and the reliable `agent_settled` lifecycle event in v0.80.4.[S12] This is a compatibility floor for the fallback surfaces, not evidence that v0.80.4 implements native live handoff.

## Capability matrix

| Required step | Public Pi surface | Finding |
|---|---|---|
| `←` moves the cursor when text exists | `CustomEditor`, `ctx.ui.setEditorComponent()`, `matchesKey()` | **Supported.** A custom editor can test its text, delegate non-empty `←` to `super.handleInput()`, and invoke Agent Console only when empty. Pi's own modal-editor example demonstrates selectively handling keys and delegating the remainder.[S2] |
| Register bare `←` as an extension shortcut | `pi.registerShortcut()` | **Insufficient alone.** Extension shortcuts run before editor handling and consume matching input. Cursor-left is not among the reserved conflicts, but shortcut handlers cannot return “not handled”; a registered `left` would therefore steal cursor movement even when text exists.[S2][S5] |
| Show Agent Console in the same terminal | `ctx.ui.custom()` or an overlay | **Supported in-process.** The implementation swaps only the editor/focus for a component and restores the saved editor text when `done()` is called.[S3] |
| Let the current active turn continue while Agent Console is visible | Agent events plus `ctx.ui.custom()` | **Supported in-process.** The custom-component path neither aborts nor replaces the `AgentSession`; streaming subscriptions remain bound. This supports backgrounding the current UI, not transferring ownership to a Supervisor process.[S3][S4] |
| Return to the current Agent's full native Pi UI | Close the custom component | **Supported.** Dismissing the component restores Pi's original editor; the transcript and native interactive host were never replaced.[S3] |
| Detach with Pi's built-in suspend while work continues | `app.suspend` / `Ctrl+Z` | **Not supported.** Pi stops its TUI and sends `SIGTSTP` to process group 0. The Agent process is suspended too, so its active provider/tool turn cannot continue until `SIGCONT`; Windows has no native suspend binding.[S6] |
| Attach the full native Pi UI to another running Agent | SDK `InteractiveMode`, RPC | **Unsupported.** `InteractiveMode` is exported as a host for one `AgentSessionRuntime`, but there is no public attach/detach/rebind operation. RPC exposes messages, state, events, prompts, abort, and session replacement—not a transition into interactive mode—and TUI-specific extension methods are no-ops or unavailable in RPC mode.[S8][S9] |
| Switch the current native Pi process to another saved session while preserving its active turn | `ctx.switchSession()`, runtime `switchSession()` | **Unsupported.** Runtime replacement calls `session.abort()`, emits shutdown, disposes the old session, then creates the replacement. It is resume/replacement, not concurrent attachment.[S7] |
| Run concurrent supervised Agents | SDK `AgentSession` / subprocess RPC | **Supported headlessly.** Both expose prompts, queueing, abort, events, state, and persisted sessions. RPC emits `agent_settled` only after retry, compaction retry, and queued continuation have finished.[S8][S9] |
| Deliberately adopt saved sessions across projects | `SessionManager.listAll()`, `SessionManager.open()`, RPC/SDK session selection | **Supported for saved sessions.** Pi's own resume picker lists all project directories, reads the saved session cwd, handles missing cwd, and rebuilds cwd-bound services and project trust on switch.[S7][S10] |
| Adopt an ordinary **live** interactive Pi process into the Supervisor | None | **Unsupported.** Session files describe persisted conversation state, not a transferable in-flight process, network stream, terminal, or extension heap. No extension, SDK, RPC, or session API transfers those resources between processes.[S7][S13] |
| Keep ordinary Pi alive after shell/console closure | None | **Unsupported natively.** Interactive Pi handles `SIGHUP` by graceful shutdown; RPC shuts down when stdin ends. A long-lived Supervisor must own process lifetime outside these interfaces.[S11] |

## Supported facts

### 1. The left-arrow interaction is implementable, but only through a custom editor

`CustomEditor.handleInput()` checks extension shortcuts before app keybindings and base editor movement. Pi wires custom editors with the ordinary app handlers and extension shortcut handler, and the official example shows overriding `handleInput()` while calling `super.handleInput()` for keys the extension does not consume.[S2]

A conforming extension can therefore implement this behavioral split without Pi internals:

- editor text non-empty: pass `←` to the base editor;
- editor empty: consume `←` and open Agent Console;
- compatibility shortcut: register a non-conflicting configurable shortcut or handle it in the same custom editor.

A plain `registerShortcut("left", ...)` cannot preserve native cursor movement because registration has no pass-through result.[S5]

### 2. Pi can host Agent Console without ending the current turn

`ctx.ui.custom()` is a documented extension UI primitive. In interactive mode, Pi stores the editor text, replaces the editor component or opens an overlay, gives the custom component focus, and restores the editor on close. That code path does not call `abort()`, `shutdown()`, session replacement, or `dispose()`.[S3]

Meanwhile `AgentSession` exposes streaming and settled lifecycle events, and both extension and RPC consumers can observe message/tool/turn progress. `agent_settled` is the trustworthy completion boundary; `agent_end` may still be followed by automatic retry, compaction-and-retry, or queued continuation.[S4][S9]

This is sufficient to show an Agent Console view while **the current process's** Agent continues. It does not make that Agent owned by an external Supervisor or resilient to the process exiting.

### 3. Pi has strong headless supervision building blocks

The SDK exposes `AgentSession`, `AgentSessionRuntime`, and session subscriptions. RPC exposes asynchronous prompt acceptance, steering/follow-up queues, abort, state/messages, session stats, entries/tree cursors, session naming, and session replacement.[S8][S9]

These interfaces are suitable for a Supervisor to start and monitor independent headless Agents. They are not equivalent to a native interactive frontend:

- built-in TUI commands are not RPC commands;
- `ctx.ui.custom()` returns `undefined` in RPC mode;
- custom editor, header, footer, working indicator, and direct terminal input are unavailable or no-ops;
- an RPC process exits when its controlling stdin closes.[S9][S11]

### 4. Saved cross-project sessions are discoverable and resumable

`SessionManager.listAll()` scans the user session directory across encoded project directories and returns each session's cwd. `SessionManager.open()` derives cwd from the session header. Pi's own all-sessions picker uses these APIs, and runtime switching recreates cwd-bound services plus project-trust context for the selected cwd.[S7][S10]

This supports deliberate adoption of an **idle/stopped saved session** by selecting its file and starting a single new owner. It does not support attaching a second writer to a still-running session.

## Constraints and lifecycle hazards

1. **Single-writer ownership is necessary.** `SessionManager` persists by direct file rewrite or append and the observed write path has no inter-process lock. Opening the same JSONL session in two active Pi processes risks interleaved appends, stale in-memory trees, or destructive rewrite races.[S13]
2. **Session replacement is destructive to active execution.** `AgentSessionRuntime.teardownCurrent()` explicitly aborts and waits for idle before shutdown/dispose. Neither `switchSession()` nor `/resume` is an attach mechanism.[S7]
3. **Suspend is not background execution.** `app.suspend` uses job-control suspension on the whole process group. It preserves memory for `fg`, but no JS, model stream, tool, or timer progresses while stopped.[S6]
4. **Extension contexts become stale on replacement/reload.** Post-switch work must use the fresh `withSession` context; captured session managers and old `pi`/`ctx` objects are invalid.[S14]
5. **Cross-project adoption re-evaluates cwd-bound resources and trust.** A missing saved cwd requires an explicit replacement cwd; project-local extensions/settings must not be assumed available until trust is resolved.[S7][S10]
6. **RPC process ownership is strict.** Closing the Supervisor's stdin pipe asks Pi to shut down. Supervisor restart/reconnection is not supplied by Pi and would need an external persistence/process protocol.[S11]
7. **Custom editor composition can conflict.** Agent Console must wrap the previously configured editor factory where possible and avoid a bare `left` shortcut; otherwise it may replace another package's editor behavior or steal navigation.[S2][S5]
8. **“Native attach” cannot be recreated from session JSONL alone.** Session entries persist messages, model/thinking changes, compactions, labels, names, and extension entries; they do not persist terminal state, pending queues, provider streams, running tools, timers, or arbitrary extension memory.[S13]

## Unsupported steps

The following steps have no documented public Pi implementation in v0.83.0:

- transfer a running ordinary interactive Pi process or its active `AgentSession` into a separate Supervisor process;
- relinquish Pi's terminal to another process while allowing the original active turn to continue;
- connect native `InteractiveMode` to an already-running RPC/SDK session;
- change a live process between `rpc` and `tui` modes;
- have two processes safely share write ownership of one session file;
- daemonize/reconnect Pi independently of the lifetime of its stdin/terminal.

## Candidate implications for the later specification

These are options for later architecture work, not decisions made by this research.

### Candidate A — documented reduced-fidelity fallback

Use a global extension with a composable `CustomEditor` for empty-editor `←`, render Agent Console through `ctx.ui.custom()`, keep the current Agent in-process, and supervise other Agents through RPC or SDK. Returning from the custom component restores the current Agent's native UI. Other Agents can be monitored, prompted, aborted, and resumed, but attachment to them must be a custom transcript/control view rather than their full native Pi interface.[S2][S3][S8][S9]

This is the smallest path that uses only documented Pi interfaces. It fails the full-native-attach requirement for non-current Agents and cannot make an already-running ordinary Pi process survive terminal loss.

### Candidate B — supervised PTYs from Agent birth

Start each future interactive Agent under a Supervisor-owned pseudo-terminal, keep that child alive while detached, and bridge the user's terminal to that PTY when attached. This could preserve the actual child Pi interface, but PTY lifecycle, screen emulation, detach-key interception, resize/signals, and monitoring are operating-system integration—not Pi extension/SDK/RPC guarantees. An ordinary Agent not launched this way could only be adopted after stopping it and resuming its saved session under a new single owner.

This candidate requires separate prototyping on macOS and Linux and must not be described as a Pi-native handoff unless Pi adopts a public contract for it.

### Candidate C — smallest upstream interface request

Ask Pi for a public **attachable interactive frontend lifecycle** around an existing `AgentSessionRuntime`:

1. detach/stop terminal rendering and input **without** aborting, disposing, or suspending the Agent;
2. later attach the full native interactive frontend to that same running runtime;
3. make terminal ownership, resize, signals, extension UI, queued input, and frontend re-subscription explicit;
4. provide a transport form if the running Agent is in another process.

The extension already has adequate APIs for context-sensitive `←`, custom Agent Console rendering, lifecycle observation, and saved-session discovery, so those do not require upstream changes.[S2][S3][S4][S10] If Pi only exposes an in-process attach/detach API, a separate-process Supervisor still cannot adopt a live ordinary Agent; cross-process transport or launch-under-supervision would remain necessary.

## Important unknowns

- Whether Pi maintainers would consider an attachable/transported `InteractiveMode` a supported extension point or intentionally keep terminal ownership process-local.
- Whether a PTY-proxied child is acceptable as “full native Pi interface” for product semantics; Pi itself provides no such designation.
- Whether a reliable Supervisor status protocol should come from RPC events, a global reporting extension inside interactive PTY children, or both.
- Exact macOS/Linux behavior for PTY reattachment, terminal feature negotiation, suspend/resume, and machine sleep.
- How a Supervisor upgrade/restart would reconnect to live child processes; Pi's RPC client and session storage do not define reconnection to an existing process.
- Whether older sessions or custom session directories need migration/import rules beyond `SessionManager.open/listAll()`.

## Sources

- **[S1]** Pi v0.83.0 package manifest and exports: [`package.json` lines 1–21](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/package.json#L1-L21).
- **[S2]** Custom editor input precedence: [`custom-editor.ts` lines 17–68](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/modes/interactive/components/custom-editor.ts#L17-L68); custom-editor wiring: [`interactive-mode.ts` lines 2384–2451](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/modes/interactive/interactive-mode.ts#L2384-L2451); official modal editor: [`modal-editor.ts` lines 1–83](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/examples/extensions/modal-editor.ts#L1-L83).
- **[S3]** Extension UI binding and custom-component lifecycle: [`interactive-mode.ts` lines 2156–2198](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/modes/interactive/interactive-mode.ts#L2156-L2198), [`interactive-mode.ts` lines 2463–2532](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/modes/interactive/interactive-mode.ts#L2463-L2532).
- **[S4]** Extension lifecycle semantics: [`extensions.md` lines 397–456](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/extensions.md#L397-L456); `AgentSession` streaming/idle state: [`agent-session.ts` lines 837–883](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/core/agent-session.ts#L837-L883).
- **[S5]** Shortcut conflict rules and dispatch: [`runner.ts` lines 68–112](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/core/extensions/runner.ts#L68-L112), [`runner.ts` lines 496–535](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/core/extensions/runner.ts#L496-L535), [`interactive-mode.ts` lines 1791–1849](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/modes/interactive/interactive-mode.ts#L1791-L1849).
- **[S6]** Built-in suspend implementation and test: [`interactive-mode.ts` lines 3696–3733](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/modes/interactive/interactive-mode.ts#L3696-L3733), [`interactive-mode-suspend.test.ts` lines 50–105](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/test/interactive-mode-suspend.test.ts#L50-L105), and [keybinding docs lines 83–90](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/keybindings.md#L83-L90).
- **[S7]** Runtime replacement abort/dispose and cwd recreation: [`agent-session-runtime.ts` lines 167–229](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/core/agent-session-runtime.ts#L167-L229).
- **[S8]** SDK session/runtime and exported run modes: [`sdk.md` lines 38–166](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/sdk.md#L38-L166), [`sdk.md` lines 995–1111](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/sdk.md#L995-L1111).
- **[S9]** RPC state/session/events and UI limitations: [`rpc.md` lines 162–211](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/rpc.md#L162-L211), [`rpc.md` lines 597–749](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/rpc.md#L597-L749), [`rpc.md` lines 882–893](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/rpc.md#L882-L893), [`rpc.md` lines 1143–1165](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/rpc.md#L1143-L1165).
- **[S10]** All-project session listing and resume flow: [`session-manager.ts` lines 1651–1709](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/core/session-manager.ts#L1651-L1709), [`interactive-mode.ts` lines 4777–4859](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/modes/interactive/interactive-mode.ts#L4777-L4859).
- **[S11]** Interactive `SIGHUP` shutdown: [`interactive-mode.ts` lines 3561–3599](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/modes/interactive/interactive-mode.ts#L3561-L3599), [`interactive-mode.ts` lines 3649–3673](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/modes/interactive/interactive-mode.ts#L3649-L3673); RPC stdin-end shutdown: [`rpc-mode.ts` lines 718–808](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/modes/rpc/rpc-mode.ts#L718-L808).
- **[S12]** Feature release floors in the official changelog: [v0.38.0 custom editors](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/CHANGELOG.md#L3476-L3507), [v0.43.0 all-project sessions](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/CHANGELOG.md#L3337-L3364), [v0.80.3 RPC tree access](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/CHANGELOG.md#L377-L393), [v0.80.4 `agent_settled`](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/CHANGELOG.md#L312-L329).
- **[S13]** Session format and direct persistence writes: [`session-format.md` lines 19–42](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/session-format.md#L19-L42), [`session-format.md` lines 122–255](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/session-format.md#L122-L255), [`session-manager.ts` lines 979–1054](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/core/session-manager.ts#L979-L1054).
- **[S14]** Replacement-session stale-context rules: [`extensions.md` lines 1232–1285](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/extensions.md#L1232-L1285).
