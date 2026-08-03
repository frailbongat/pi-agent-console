# Transparent tmux path — throwaway prototype

> **THROWAWAY PROTOTYPE.** This branch exists only to answer **“Does the chosen private-tmux architecture still feel transparent in VS Code’s integrated terminal?”** It is not an implementation foundation, package layout, or supported launcher.

This harness gives a normal shell a temporary `pi` shim in `~/.local/bin` (ahead of Homebrew in a fresh login shell on this machine). After that one-time installation, the user-facing invocation is literally:

```sh
pi
```

The shim stands in for the pre-interactive bootstrap hook that Pi does not yet expose. It starts the real unmodified Pi 0.83.0 inside one Agent session on a package-private tmux server, or reconnects to an existing Agent. Every Agent remains an ordinary native interactive Pi process and loads only the throwaway extension in [`extension.ts`](./extension.ts).

## Safety and boundaries

- Runtime state and logs live in `~/.cache/pi-agent-console-wayfinder-tmux` with mode `0700`.
- The temporary shim is `~/.local/bin/pi`; installation refuses to overwrite anything already there.
- Because VS Code’s default `${process}` title resolves the executable image and ignores `argv[0]`, the client is an isolated private copy of the installed tmux 3.7b binary named `agent`. The server and terminal semantics are unchanged; cleanup deletes the copy with the runtime directory.
- The real Homebrew Pi binary is never modified.
- The private tmux server uses an explicit socket; it never reads `~/.tmux.conf`.
- `PI_AGENT_CONSOLE=0 pi ...` bypasses the harness.
- Print, JSON, RPC, export, help/version, model listing, and Pi package-management invocations bypass tmux.
- Existing/nested tmux is detected and interactive startup fails closed.
- `uninstall` removes only the shim and deliberately leaves Agents alive.
- Stopping Agents requires the explicit destructive command `stop --force`.

## Install and inspect

```sh
./prototypes/transparent-tmux-vscode/prototype install
./prototypes/transparent-tmux-vscode/prototype doctor
./prototypes/transparent-tmux-vscode/prototype status
./prototypes/transparent-tmux-vscode/prototype nested-test
```

Then open a **normal VS Code integrated terminal** and run plain `pi`.

## What the prototype implements

- private per-user tmux server, one tmux session per Agent;
- no tmux status line, prefix, bell, or other tmux chrome; package-owned mouse capture is enabled for history scrolling;
- native Pi `CustomEditor` in which:
  - text-present `←` delegates to Pi’s editor unchanged;
  - empty-editor `←` opens Agent Console through `ctx.ui.custom()`;
- same-client switching between real native Pi processes with `tmux switch-client`;
- Agent creation from the in-Agent console (`n`);
- detached lifetime and reconnect after terminal closure;
- canonical lifecycle probes based on Pi’s `agent_start` and `agent_settled` events;
- diagnostics for color, image fallback, OSC 8 hyperlinks, OSC 52 clipboard, key sequences, paste, resize, tmux capabilities, and terminal title;
- `/prototype-work [seconds]` to keep a real Pi turn active through a visible custom tool;
- `/prototype-media` to return a real PNG through Pi’s ordinary tool-result renderer.

## Exact tmux configuration

The server is started with [`tmux.conf`](./tmux.conf), not the user’s tmux configuration. Its behaviorally important settings are:

```tmux
set -g status off
set -g prefix None
set -g prefix2 None
set -g mouse on
set -g exit-unattached off
set -g destroy-unattached off
set -g detach-on-destroy off
set -g remain-on-exit on
set -g extended-keys on
set -g extended-keys-format csi-u
set -s escape-time 10
set -g default-terminal "tmux-256color"
set -as terminal-features ',xterm*:256:RGB:clipboard:extkeys:focus:hyperlinks:title'
set -as terminal-overrides ',xterm*:Eneks=\E[=1u:Dseks=\E[=0u'
set -g focus-events on
set -g allow-passthrough on
set -s set-clipboard off
bind-key -T copy-mode MouseDragEnd1Pane "send-keys -X copy-pipe /usr/bin/pbcopy; send-keys -X cancel"
bind-key -T copy-mode-vi MouseDragEnd1Pane "send-keys -X copy-pipe /usr/bin/pbcopy; send-keys -X cancel"
set -g allow-set-title on
set -g set-titles on
set -g set-titles-string '#{pane_title}'
```

The `Eneks`/`Dseks` override is required because tmux 3.7b negotiates xterm `modifyOtherKeys`, while VS Code 1.109+ exposes modified keys through Kitty CSI-u. It idempotently sets Kitty disambiguation mode only for the outer private tmux client; tmux then translates those simple CSI-u keys into the pane’s requested format. No VS Code user keybinding is required. Native tmux Kitty negotiation is still unmerged upstream ([tmux/tmux#4912](https://github.com/tmux/tmux/pull/4912)).

The private client attaches with `-T sync`, advertising VS Code 1.108+ synchronized-output support so tmux preserves Pi’s DEC-2026 atomic frame boundaries. The live client exposed `sync` in `#{client_termfeatures}`, but the human still found it visibly choppier than direct Pi.

The outer tmux client owns VS Code’s alternate screen. With tmux mouse handling off, VS Code converted wheel motion into arrow keys; with it on, terminal-native selection is unavailable. This macOS prototype resolves the tradeoff by using tmux history for the wheel and auto-copying each drag selection through `/usr/bin/pbcopy`, then explicitly leaving copy mode. The selection highlight therefore clears on release. The complete source, including nonvisual safety settings, is the linked file.

## Live acceptance run

Record observations in [`RESULTS.md`](./RESULTS.md). Do not infer the human verdict from automation.

### 1. Plain startup and chrome

1. In a new VS Code integrated terminal, run `pi` with no wrapper-specific arguments.
2. Confirm that native Pi appears and no tmux status bar, prefix hint, flash, or intermediate shell UI appears.
3. Inspect the VS Code terminal tab title; with VS Code’s default `${process}` template it should read lowercase `agent` and never expose `tmux`.

### 2. Context-sensitive left arrow

1. Type `abc` without submitting.
2. Press `←`; the cursor must move from after `c` to before `c`, and Agent Console must not open.
3. Clear the editor.
4. Press `←`; Agent Console must replace only the editor region through `ctx.ui.custom()`.
5. Press `esc`; the same Agent’s full native interface must return.

### 3. Two real native Agents and active-turn backgrounding

1. In the first Agent, run `/prototype-work 90`.
2. Once the `prototype_wait` tool is visibly ticking, clear the editor and press `←`.
3. Press `n` to create a second Agent; select it and press `enter`.
4. Confirm the same terminal now displays a fresh, full native Pi interface.
5. Optionally run `/prototype-work 90` there too.
6. Open Agent Console, select the first Agent, and attach.
7. Confirm its original turn kept advancing or completed while it was not displayed.

No prompt or reply is transported with `tmux send-keys`; tmux carries only the interactive terminal client.

### 4. Transport diagnostics

Open Agent Console with empty-editor `←`, then press `d`.

- **True color:** a 25-step red→yellow→green→cyan→blue ramp should show gradual shades rather than collapse into flat swatches.
- **Hyperlink:** `clickable OSC 8 probe` should be clickable and target `https://pi.dev`.
- **Image:** the actual Pi `Image` component should visibly fall back to image metadata. Pi 0.83.0 intentionally sets `images: null` under every tmux session, and VS Code is also a no-image target in Pi’s current capability table. Run `/prototype-media` afterward to exercise the normal tool-result image path too.
- **Modified keys:** press `Shift+Enter`, `Ctrl+Enter`, `Alt+Enter`, `Ctrl+Shift+P`, and modified arrows where VS Code permits them. The diagnostics log should distinguish CSI-u sequences rather than collapse them to their unmodified keys.
- **Bracketed paste:** paste multiple lines. Diagnostics should report bracketed-paste framing (`paste=true`; terminal reads may be chunked), and no line should submit while diagnostics owns focus. Then return to Pi’s native editor and verify one paste inserts the complete multiline text.
- **Resize:** resize the terminal repeatedly. The rendered width, process dimensions, and layout should follow without corruption.
- **Mouse scroll and selection:** ordinary wheel motion should scroll pane history rather than become Pi arrow keys. Drag-release should auto-copy through macOS `pbcopy`, clear its transient highlight, and immediately return input to Pi so repeated `Cmd+V` works. Record that a plain click while viewing history makes VS Code visually jump to the live editor even though tmux remains in copy mode.
- **Clipboard:** press `c`, return to the native editor, and paste. It should insert the unique `Agent Console OSC 52 probe ...` string sent through tmux’s visible-pane DCS passthrough to VS Code. This explicit path is independent of tmux’s disabled automatic clipboard setting.
- **Title:** the default VS Code tab should read lowercase `agent`, never `tmux`. Diagnostics should still show the dynamic pane title; VS Code exposes that exact OSC title only when `terminal.integrated.tabs.title` uses `${sequence}` instead of its default `${process}`.

### 5. Terminal close and reconnect

1. Run `./prototypes/transparent-tmux-vscode/prototype status` in another terminal and note both pane PIDs.
2. Close the integrated-terminal instance attached to Agent Console—do not run `/quit`.
3. Open a new VS Code integrated terminal and invoke plain `pi`.
4. Confirm it reconnects directly to a native Agent.
5. Run `prototype status` again and confirm both pane PIDs are unchanged.

### 6. Sleep/wake where practical

With both Agents alive (and preferably one active), sleep and wake the Mac. Reconnect with plain `pi`, inspect both Agents, and record whether terminal state, active work, network recovery, title, input, and resize remain trustworthy.

### 7. Nested tmux and bypass

```sh
./prototypes/transparent-tmux-vscode/prototype nested-test
PI_AGENT_CONSOLE=0 pi --version
pi --mode rpc --no-session
```

The first command must show fail-closed nested-tmux detection. The version and RPC surfaces must remain ordinary Pi and not create another tmux Agent.

## Runtime evidence

- `prototype status` lists tmux sessions, pane PIDs, attachment counts, and commands.
- `~/.cache/pi-agent-console-wayfinder-tmux/events.jsonl` records Pi lifecycle events and client switches.
- `~/.cache/pi-agent-console-wayfinder-tmux/logs/*.ansi.log` captures Pi’s raw TUI writes.
- `~/.cache/pi-agent-console-wayfinder-tmux/agents/*.json` contains only prototype status projections and process metadata—no credentials or transcript content.

## Outcome

The human **accepted** the tmux-first path on 2026-08-03 after explicitly confirming the relaxed meaning of transparency: one-command startup and no visible tmux chrome or setup, not behavior indistinguishable from direct Pi. Acceptance includes the observed choppier rendering, history-click jump, tmux-owned selection behavior, image fallback, static tab label, and inner terminal-environment changes. See [`RESULTS.md`](./RESULTS.md) for the complete evidence.

## Cleanup

```sh
# Remove only the plain-pi shim; live prototype Agents continue.
./prototypes/transparent-tmux-vscode/prototype uninstall

# Explicitly stop all prototype Agents.
./prototypes/transparent-tmux-vscode/prototype stop --force

# Stop Agents, remove the shim, and delete runtime evidence.
./prototypes/transparent-tmux-vscode/prototype clean --force
```

## Known nonvalidated production concerns

This prototype deliberately does **not** validate the missing upstream pre-interactive hook, Supervisor durability/restart, IPC protocol, input leases, worktrees, packaging, version qualification, competing custom-editor composition, multi-client arbitration, or production security hardening. tmux also necessarily changes inner `TERM` to `tmux-256color`, adds `TMUX`, and changes inner `TERM_PROGRAM` to `tmux`; diagnostics retain the captured outer identity so this difference is explicit. The prototype validates only whether the selected native tmux transport can satisfy the ticket’s human-facing terminal contract well enough to remain the v1 architecture.
