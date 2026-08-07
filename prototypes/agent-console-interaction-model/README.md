# Agent Console interaction-model prototype

> **THROWAWAY PROTOTYPE.** This compares interaction models for wayfinding ticket **Choose the Agent Console interaction model**. It is not production Agent Console code.

All Supervisor, Agent, lifecycle, queue, Input Lease, Handoff, and workspace data is simulated in memory. The extension performs no real process, tmux, filesystem, Git, model, or Supervisor mutations.

## Question

Which distinct native TUI interaction model best supports opening Agent Console with context-sensitive `←`, scanning Agents, creating or dispatching one, peeking and replying, attaching and detaching, organizing work, and performing safe cleanup?

The prototype compares three structurally different answers over the same state and operations:

- **A — Roster + Inspector:** Agent-first split view; below 88 columns it becomes one pane and `Tab` toggles roster/detail.
- **B — Attention Queue:** explicit Interactions, failures, recovery, and the authoritative Work Queue lead; healthy Agents recede. Its selection window follows the highlighted item.
- **C — Command Canvas:** user intent leads; a target Agent supplies context without changing the Dispatch Target.

Below 60 columns, every variant switches to a compact branch. At the 48-column target it is 18 lines or fewer, keeping primary state, feedback or a fully wrapped safety gate, and controls visible at 48×18. Composer mode retains a two-line hierarchy context instead of blanking the underlying model.

## Outcome

Live evaluation selected **A — Roster + Inspector** because it feels cleaner. The product model borrows B's attention cues for explicit Interactions/failures and C's explicit action/confirmation labels, but keeps A's Agent-first hierarchy. See [`RESULTS.md`](./RESULTS.md) for navigation, shortcuts, feedback, safety, and evaluation evidence.

## Run

From the repository root, use the short launcher so terminal wrapping cannot split the extension path:

```sh
./run-agent-console-prototype
```

The launcher starts isolated Pi with `--no-extensions` and `--no-session`; the prototype opens automatically. After returning to native Pi, reopen it with either:

- empty-editor `←` (the product entry path under evaluation), or
- `/agent-console-prototype` (the explicit prototype fallback).

Use `/agent-console-prototype-reset` for a deterministic reset.

`--no-session` keeps the evaluation out of Pi's durable Conversation history. No model call is needed; do not submit a Pi prompt while evaluating the prototype. On launch, `Enter` over the already attached Agent is deliberately guarded and keeps Agent Console open; use `q`/`Esc` to return to native Pi.

## Prototype-only controls

These controls exist only to compare alternatives; they are not product shortcut proposals.

| Key | Prototype action |
| --- | --- |
| `F2` / `F3` / `F4` | Switch variants A / B / C |
| `F6` | Cycle guided scenario |
| `r` | Reset the current scenario |
| `Esc` or `q` | Return to the current Agent's real native Pi interface |

## Common interaction probes

The surface prints its current shortcuts. Useful cross-variant probes:

| Key | Simulated semantic operation |
| --- | --- |
| `↑` / `↓` | Move through the variant's primary hierarchy |
| `Enter` | Attach, reply, inspect, or execute the selected intent depending on context |
| `n` | New promptless Agent, then simulated Attach |
| `i` or `d` | Compose a Dispatch for exactly one new Agent |
| `w` | Submit work to an eligible existing Agent |
| `a` | Begin Attach/Handoff |
| `v` | Peek without Attach |
| `e` | Answer the selected explicit Interaction |
| `u` | Retry the most recently answered stable Interaction ID to prove stale-ID rejection |
| `p` / `m` | Pin/unpin or deterministically rename the selected Agent |
| `o` | Cycle project/status filter and grouping presets in client-local Console View State |
| `s` | Stop (does not Archive, release, clean, or delete) |
| `z` | Toggle Archive (does not change Agent Status) |
| `l` | Workspace Release |
| `x` / `X` | Ordinary / destructive workspace cleanup |
| `Delete` | Permanent delete after confirmation and safety gates |
| `[` / `]` | Reorder the visible global Work Queue |
| `Backspace` | Cancel a queued entry |

While composing, type `invalid` or submit whitespace to exercise preflight rejection. No Agent is created by a rejected command.

## Guided scenarios

`F6` cycles:

1. **Mixed lifecycle** — all six Agent Statuses and independent Runtime Conditions.
2. **Explicit Interactions** — multiple stable Interaction IDs and stale reply rejection.
3. **Handoff + Input Lease** — starts at explicit Takeover confirmation, then enters a pending Handoff with disabled/non-buffered input. Recovery separately exercises uncertain ownership.
4. **Global Work Queue** — four explicit Concurrency Slot holders, answered-Interaction priority, reorder/cancel, and fixed Dispatch Target.
5. **Recovery uncertainty** — `Starting (Recovering)` replaces stale optimistic truth.
6. **Workspace safety** — dirty worktrees, unpushed commits, Workspace Conflict, Preserved Checkout, and destructive gates.

## Suggested live evaluation

1. Start at a wide terminal (roughly 120×35). Complete the loop in each variant: scan → peek/reply → Dispatch → Attach → empty-editor `←` → organize → cleanup.
2. Resize to roughly 80×24, then 48×18. Open a composer in every variant and confirm its two-line hierarchy context, feedback, and controls remain discoverable.
3. In **Handoff + Input Lease**, confirm the fenced Takeover, then press an unrelated key while Handoff is pending. Confirm it is ignored and was not buffered.
4. In **Explicit Interactions**, answer one Interaction, then press `u`. Confirm retrying that consumed stable ID is rejected rather than redirected.
5. In **Global Work Queue**, compare Agent Status with explicit Slot held/released state, then reorder and cancel entries. Confirm displayed order is scheduling order and cancellation leaves an Agent.
6. In **Workspace safety**, compare `s`, `z`, `l`, `x`, `X`, and `Delete`. Confirm the concepts never collapse into one destructive action and each confirmation shows its exact target and consequence.
7. Record the verdict and borrowed elements in [`RESULTS.md`](./RESULTS.md).

## Known fidelity boundary

- `ctx.ui.custom()`, keyboard routing, terminal width, the composer, and empty-editor `←` are real Pi behavior.
- Agent identities, Attach/Handoff outcomes, lifecycle events, queue scheduling, Input Leases, and workspace safety checks are simulations.
- A simulated Attach closes Agent Console back to the same real Pi interface and updates only in-memory fixture state.
- The accepted transparent-tmux prototype already evaluates terminal transport; this prototype intentionally does not repeat that plumbing.
