# Agent Console interaction-model prototype design

## Decision question

Which native TUI interaction model should Agent Console use for the loop of context-sensitive entry, scanning, New/Dispatch, peek/reply, Attach/Detach/Handoff, organization, queue control, and safe cleanup?

This artifact raised the fidelity of that discussion; the live decision is recorded below.

## Live decision

Use **A — Roster + Inspector** as the primary Agent Console hierarchy because the evaluator found it cleaner and reported no confusing part. Borrow B's attention cues for explicit Interactions and failures, and C's explicit action and confirmation labels, without adopting either alternative as the primary hierarchy.

- **Entry and navigation:** empty-editor `←` opens Agent Console; `↑`/`↓` select an Agent; `Enter` attaches the selected Agent; `v` Peeks without Attach; narrow layouts use `Tab` between Roster and Inspector.
- **Product shortcuts:** `n` New, `d` Dispatch, `e` Reply, `a` Attach/Handoff, `s` Stop, `z` Archive, `l` Workspace Release, `x`/`X` ordinary/destructive cleanup, and `Delete` Permanent delete. Prototype F-keys are excluded.
- **Feedback:** keep a persistent inline feedback region that states rejected operations and their non-effects.
- **Safety:** ordinary cleanup blocks and points to preservation or explicit destructive cleanup; destructive confirmation names its target and consequence and remains cancellable.

The evaluator accepted the 48×18 Roster/Inspector composition. Detailed evidence is in [`RESULTS.md`](../../prototypes/agent-console-interaction-model/RESULTS.md).

## Approved approach

Build one throwaway Pi-native extension using `ctx.ui.custom()` and a context-sensitive `CustomEditor`. Keep all domain state in memory and visibly simulated. Do not reimplement the Supervisor, tmux fabric, process control, persistence, Git/worktree operations, or model calls; transport has separate prototype evidence.

The same state and semantic operations appear through three structurally different hierarchies:

1. **Roster + Inspector** — Agent-first, split-pane at wide widths and single-pane at narrow widths.
2. **Attention Queue** — urgency-first, led by explicit Interactions, failures, recovery, and queued work.
3. **Command Canvas** — intent-first, led by New, Dispatch, Attach, Reply, Organize, and Cleanup.

Prototype-only controls switch variant and scenario. They are visually segregated from the candidate product controls.

## State and data flow

Deterministic scenario factories create Agents, Conversations, Agent Statuses, Runtime Conditions, Interactions, Work Queue entries, Input Lease facts, and workspace safety facts. UI commands mutate only this in-memory state and immediately render explicit feedback. Every Dispatch retains one fixed client-local Dispatch Target regardless of selected Agent.

A simulated Attach or committed Handoff closes the custom TUI back to the same real Pi interface. Empty-editor `←` reopens Agent Console; text-present `←` delegates to Pi's editor.

## Edge-state coverage

Guided scenarios cover all six Agent Statuses, independent Runtime Conditions and Concurrency Slot ownership, multiple and stale Interactions, Handoff fencing, Input Lease contention and uncertainty, the global four-slot Work Queue, preflight rejection, recovery uncertainty, narrow terminals, and safety distinctions among Stop, Archive, Workspace Release, ordinary/destructive cleanup, and Permanent delete. At widths below 60 columns, each hierarchy uses a compact composition; at the 48-column target, primary context, fully wrapped safety prompts, and controls fit within 48×18.

## Safety and errors

All mutations are labelled simulated. Preflight rejection creates nothing. Pending Handoff and confirmation states ignore unrelated input rather than buffering it. Agent Console never removes an Original Checkout. Workspace Conflict and live Runtime gates remain non-overridable even for Destructive Workspace Cleanup. Unsafe ordinary cleanup points to Workspace Release and preservation or explicit destructive confirmation rather than silent removal.

## Validation

Use Pi's public extension/TUI APIs and width helpers. Statically load the extension without model calls, audit deterministic fixtures, and manually evaluate at wide, 80-column, and 48-column widths. Capture the live human verdict in the prototype's `RESULTS.md`; no production implementation is folded from this throwaway code.
