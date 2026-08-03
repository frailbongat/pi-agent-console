# Transparent tmux prototype results

> **Live run complete.** Automation established the mechanism; the final acceptability verdict below came from the human using VS Code’s integrated terminal.

## Environment

- Pi: 0.83.0
- tmux: 3.7b
- VS Code: 1.131.0 (`TERM_PROGRAM=vscode`)
- Platform: macOS 26.3.1 arm64
- Prototype branch: `prototype/transparent-tmux-vscode`

## Source-established constraints

- Pi’s documented tmux configuration requires `extended-keys on` plus `extended-keys-format csi-u`; the latter requires tmux 3.5+.
- Pi 0.83.0’s capability detector returns `images: null` whenever `TMUX` is set or `TERM` begins with `tmux`, regardless of tmux passthrough configuration.
- The same detector identifies VS Code as true-color and OSC 8 capable but image-incapable.
- Under tmux, Pi enables hyperlinks only when `#{client_termfeatures}` positively contains `hyperlinks`.
- `CustomEditor.getExpandedText()` and `matchesKey(..., Key.left)` provide the needed context-sensitive empty-editor seam; `ctx.ui.custom()` is the documented in-process console seam.

## Automated checks

All checks used isolated private sockets and runtime directories and cleaned up their Pi/tmux processes afterward.

- Loaded the extension in a real detached Pi 0.83.0 process and observed `session_start` plus a `Needs input` state checkpoint.
- Verified text-present `←` stayed in Pi’s native editor, while empty-editor `←` opened the `ctx.ui.custom()` Agent Console.
- Created two real native Pi processes and switched one attached tmux client from `agent-001` to `agent-002` and back through the in-Agent console.
- Ran `/prototype-work 8`, opened Agent Console during `Working`, switched the client to `agent-002`, and observed `agent-001` complete the eight-second tool and reach authoritative `agent_settled` while not displayed.
- Closed a pseudo-terminal client, observed tmux detach, reattached from a fresh plain-shim invocation, and verified the Agent pane PID remained unchanged (`44547` in that isolated run).
- With an attached xterm-compatible pseudo-terminal, verified tmux advertised `RGB`, `hyperlinks`, `clipboard`, `extkeys`, and `focus`; Pi reported true color and hyperlinks; CSI-u `Shift+Enter` parsed distinctly; bracketed-paste framing reached Pi; resize propagated to 132 columns; the pane title reached the outer PTY; and OSC 52 reached it through visible-pane DCS passthrough.
- Reattached the final live private client with `-T sync` and confirmed `sync` appeared in `#{client_termfeatures}`. Synchronized-output negotiation did not eliminate the human-observed rendering choppiness.
- Verified the actual Pi `Image` component produced metadata fallback under tmux. The initial fixture’s invalid `IDAT` CRC was exposed by the live ordinary-tool path; its replacement is a generated 32×32 PNG with valid `IHDR`, `IDAT`, and `IEND` CRCs.
- Verified the temporary shim’s version/RPC/emergency-opt-out paths bypassed tmux and created no private server.
- Verified an actual foreign tmux server caused fail-closed nested-tmux rejection.
- Loaded the exact `tmux.conf` under tmux 3.7b and confirmed `extended-keys=on`, `extended-keys-format=csi-u`, `default-terminal=tmux-256color`, `status=off`, `mouse=on`, `set-clipboard=off`, the Kitty bridge, and explicit mouse-copy bindings.
- Ran seven offline PTY trials per path. Median time to Pi’s native `v0.83.0` header was 478.7 ms for ordinary cold Pi, 551.7 ms for a cold prototype Agent, and 50.1 ms for reconnecting to an existing Agent. The controlled cold-start median overhead was 73.0 ms; ordinary Pi itself ranged from 476.2 to 956.4 ms.
- Corrected an invalid four-swatch color probe found by the human run and verified that its replacement emits 25 distinct `48;2;r;g;b` steps through tmux.

These checks establish mechanism, not the live VS Code feel or human acceptability verdict.

## Live observations

| Probe | Observation | Result |
|---|---|---|
| Plain `pi` bootstrap | After correcting the prototype shim’s PATH precedence, bare `pi` entered the private socket with `TERM=tmux-256color`. | Pass |
| No tmux chrome | The user initially believed tmux was absent because no tmux UI was visible. Cold opening felt possibly slower; the measured 73 ms median overhead was accepted. | Pass |
| Rendering smoothness | The user found the tmux path “choppier” than direct Pi. The final reattach positively advertised VS Code’s `sync` feature, but synchronized output did not remove the visible difference. | Accepted limitation |
| Text-present `←` | With `abc` present, `←` moved the native Pi editor cursor and did not open Agent Console. | Pass |
| Empty-editor `←` | With the editor empty, `←` opened the in-Agent `ctx.ui.custom()` Agent Console. | Pass |
| Console during active turn | Agent Console opened from `agent-001` while Pi reported `idle=false`; after switching away, `/prototype-work 30` reached `agent_settled` without restart on the same PID. | Pass |
| Same-client Agent switch | Selecting `agent-002` switched the existing VS Code terminal directly to its native interface. | Pass |
| Two native Pi Agents | Agent Console created `agent-002` as a fresh, full native Pi interface alongside `agent-001`. | Pass |
| Close/detach/reconnect, unchanged PIDs | Killing only the VS Code prototype terminal and running bare `pi` in a new terminal restored the existing Agents and screen. Pane PIDs remained `48585` and `50011`. | Pass |
| True color | The initial four-swatch probe was invalid; after correction, a newly created Agent displayed substantially more colors across the 25-step RGB ramp. | Pass |
| Image attempt/fallback | The initial fixture was invalid and poisoned that Agent’s model context. In a clean Agent, the corrected valid PNG reached Codex without error, while both the custom component and ordinary tool-result renderer visibly showed `[Image: [image/png] 32x32]` metadata. The model’s claim that it rendered was ignored because it cannot observe the terminal. | Expected limitation |
| OSC 52 clipboard | Pressing `c` sent a unique OSC 52 payload through visible-pane DCS passthrough; ordinary `Cmd+V` then inserted that exact probe text in Pi’s native editor. | Pass |
| OSC 8 hyperlink | VS Code recognized the custom diagnostic’s OSC 8 link and opened `https://pi.dev` on Command-click. | Pass |
| Bracketed paste | Diagnostics received bracketed-paste framing (`paste=true`); after returning to Pi’s native editor, one multiline paste inserted both `alpha` and `beta` together. | Pass |
| Modified keys | Stock tmux negotiation initially collapsed `Shift+Enter` to `\r` even though direct Pi worked and the pane was `Ext 2`. After the package-owned `Eneks`/`Dseks` Kitty bridge and one reattach, VS Code delivered distinct `Shift+Enter`, `Ctrl+Enter`, `Option+Enter`, and `Shift+Left` events. | Pass |
| Resize | Dragging the VS Code terminal narrower and wider updated the diagnostic render width and layout without visible corruption or stranded UI. | Pass |
| Mouse wheel and selection | With `mouse=off`, VS Code converted wheel motion into arrows, changing Pi history/Agent selection. `mouse=on` restored history scrolling but captured native selection. Explicit drag copy through `/usr/bin/pbcopy` followed by `cancel` made repeated selection/paste work and return immediately to Pi. A plain click while viewing history still jumped visually to the live editor; tmux diagnostics showed copy mode remained active at scroll position 10. Focus-event changes, removing copy mode’s `-e`, and forced redraws did not fix it and were reverted. | Accepted limitation |
| Terminal title | tmux forwarded `Agent Console prototype · agent-003 · Completed`, but VS Code’s default `${process}` masked OSC `${sequence}` and showed `tmux`; it also ignored a changed `argv[0]`. A private copied client executable labeled `agent` made the default tab read `agent`, which the user accepted “for now.” Dynamic identity still requires `${sequence}`. | Pass with limitation |
| Sleep/wake | After a real Mac sleep/wake cycle, all four pane PIDs were unchanged; attached `agent-004` accepted input and redrew normally. | Pass |
| Nested-tmux detection | An actual foreign tmux server invoked the plain shim; the prototype identified the pre-existing fabric and failed closed with an explicit opt-out instruction. | Pass |
| Noninteractive/opt-out bypass | Version, RPC, and `PI_AGENT_CONSOLE=0` paths invoked real Pi directly and created no private tmux server in isolated checks. | Pass |

## Visible differences and unsupported behavior

Live-run differences and unsupported behavior, recorded rather than concealed:

- Controlled cold startup adds about 73 ms median before Pi’s native header on this machine. The human noticed that opening might be slightly slower but accepted the measured difference.
- Inline images are unavailable through current Pi under tmux and appear as metadata fallback.
- tmux necessarily changes inner `TERM` to `tmux-256color`, adds `TMUX`, and changes inner `TERM_PROGRAM` from `vscode` to `tmux`. The harness captures the original terminal identity in prototype-specific environment fields for diagnostics rather than pretending the environment is byte-for-byte unchanged.
- tmux 3.7b does not negotiate the Kitty keyboard protocol used by current VS Code; upstream Kitty support remains unmerged ([tmux/tmux#4912](https://github.com/tmux/tmux/pull/4912)). Pi correctly requested tmux extended-key mode 2, but modified Enter initially collapsed to `\r`. The private config bridges this without user keybindings by overriding tmux’s outer `Eneks`/`Dseks` lifecycle to idempotently set/reset Kitty disambiguation mode; tmux then translates the resulting simple CSI-u keys for Pi.
- VS Code’s documented default tab title is `${process}`, so it masks the correctly forwarded dynamic OSC `${sequence}`. It also resolves the executable image and ignores `argv[0]`. The harness therefore runs a private copy of the same tmux client binary named `agent`; the accepted default title is static `agent`, while dynamic identity requires users to opt into `${sequence}`.
- Mouse behavior has a real tmux tradeoff: without capture, wheel motion becomes arrow keys in VS Code’s alternate screen; with capture, outer-terminal native selection is unavailable. The accepted macOS prototype behavior uses tmux history scrolling and auto-copies drag selections through `pbcopy`; the selection highlight clears on release. Plain-clicking history visibly jumps to Pi’s live editor even while tmux still reports copy mode at a nonzero scroll position.
- Rendering remains noticeably choppier than direct Pi because Pi writes through an additional PTY, tmux screen parser, and tmux redraw stage before xterm.js. The final client advertised `sync`, so the difference remained after preserving synchronized frame boundaries rather than merely because that feature was missing.
- tmux’s automatic OSC 52 did not update VS Code reliably after mouse copies, so `set-clipboard=off`. Agent Console’s explicit clipboard action uses visible-pane DCS passthrough, while mouse copy uses `pbcopy` and leaves no application content in tmux-controlled system clipboard transport.
- The safe prototype shim simulates, but does not prove, the proposed upstream pre-interactive bootstrap event.

## Human verdict

**Accepted on 2026-08-03.** The human explicitly accepted the tmux-first path after being told that acceptance relaxes “transparent” from behavior indistinguishable from native Pi to one-command startup with no visible tmux chrome or setup, while retaining the documented terminal differences above.

Branch asset: [`prototype/transparent-tmux-vscode`](https://github.com/frailbongat/pi-agent-console/tree/prototype/transparent-tmux-vscode/prototypes/transparent-tmux-vscode)
