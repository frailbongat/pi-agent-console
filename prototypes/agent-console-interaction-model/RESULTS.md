# Live evaluation results

> Record the human verdict here. Do not treat unchecked items or placeholder text as a decision.

## Environment

- Date: 2026-08-06
- Pi version: 0.84.0
- Terminal: zsh; terminal application not recorded
- Wide size: not recorded
- Narrow sizes: approximately 48×18

## Evaluation setup observation

- The evaluator initially saw only native Pi after launch. A repeatable trigger was an extra `Enter`: Variant A treated it as Attach on the already attached Agent and immediately returned to chat.
- The prototype now keeps Agent Console open and reports “already attached”; `q`/`Esc` remain the explicit return controls.

## Evaluation checklist

### Shared loop

- [ ] Text-present `←` remains native cursor movement.
- [x] Empty-editor `←` opens Agent Console.
- [ ] Active work is understood to continue across Detach.
- [ ] New and Dispatch feel distinct.
- [x] Preflight rejection clearly states that no Agent was created or queued.
- [ ] List selection never appears to change the Dispatch Target.
- [ ] Peek/reply and Attach are distinguishable.
- [ ] Handoff pending feedback makes disabled/non-buffered input clear.
- [ ] Input Lease contention and Takeover are understandable.
- [ ] Six Agent Statuses remain distinct from Runtime Condition and Concurrency Slot ownership.
- [ ] Retrying the last answered Interaction with `u` is rejected by stable ID.
- [ ] Global Work Queue order and cancellation are understandable.
- [ ] Stop, Archive, Workspace Release, cleanup, and Permanent delete stay distinct.
- [ ] Dirty/unpushed/conflicted cleanup gates are trustworthy.
- [x] Ordinary and Destructive Workspace Cleanup are clearly distinct and destructive confirmation is cancellable.
- [ ] Destructive confirmations show the exact target and consequence, including at 48×18.

### Widths

| Variant | Wide | 80×24 | 48×18 | Critical information lost? |
| --- | --- | --- | --- | --- |
| A — Roster + Inspector |  |  | Acceptable | No |
| B — Attention Queue |  |  |  |  |
| C — Command Canvas |  |  |  |  |

## Reaction by variant

### A — Roster + Inspector

- What worked: Cleaner than the other variants and easiest to scan.
- What was confusing: None reported.
- Best shortcut/feedback idea: Empty-editor `←` opens Agent Console; `Enter` attaches the selected Agent while `v` Peeks without Attach.
- Narrow-terminal verdict: Acceptable; `Tab` preserves access to Roster and Inspector, and selected state, feedback, and controls remain understandable.

### B — Attention Queue

- What worked: Attention cues for explicit Interactions and failures are worth retaining.
- What was confusing: The urgency-first hierarchy was not as clean as A for the primary surface.
- Best shortcut/feedback idea: Surface attention cues inside A's roster rather than making the queue the whole hierarchy.
- Narrow-terminal verdict: Not selected as the primary hierarchy.

### C — Command Canvas

- What worked: Explicit action and confirmation labels are worth retaining.
- What was confusing: The intent-first hierarchy was not as clean as A for the primary surface.
- Best shortcut/feedback idea: Use explicit labels inside A's Inspector and safety gates rather than making commands the whole hierarchy.
- Narrow-terminal verdict: Not selected as the primary hierarchy.

## Verdict

- Winning information hierarchy: A — Roster + Inspector, because it feels cleaner.
- Elements borrowed from other variants: B's attention cues for explicit Interactions/failures and C's explicit action/confirmation labels.
- Navigation model: Use ↑/↓ to select an Agent; Enter attaches the selected Agent.
- Product shortcuts (prototype F-keys excluded): Empty-editor `←` opens Agent Console; `↑`/`↓` select; `Enter` attaches; `n` New; `d` Dispatch; `v` Peek; `e` Reply; `a` Attach/Handoff; `s` Stop; `z` Archive; `l` Workspace Release; `x`/`X` ordinary/destructive cleanup; `Delete` Permanent delete.
- Feedback model: Persistent inline `FEEDBACK` communicates rejected operations and their non-effects; the evaluator found it clear.
- Safety interaction model: Ordinary cleanup blocks on unsafe state and points to preservation or an explicit destructive path; destructive cleanup names its target and consequence and can be cancelled. The evaluator found the distinction clear.
- Rejected alternatives and why: B and C are rejected as primary hierarchies because A feels cleaner; their selected cues and labels remain supporting elements inside A.
- Remaining decisions: None for this wayfinding ticket. Production implementation and verification scenarios remain follow-up work, including [Define verification and acceptance scenarios](https://github.com/frailbongat/pi-agent-console/issues/15).
