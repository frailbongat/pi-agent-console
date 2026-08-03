# Agent Console

Agent Console is an open-source Pi package for supervising concurrent full Pi sessions through a native, in-session terminal control plane.

## Language

**Agent Console**:
The package and native in-session terminal control plane through which a user supervises agents.
_Avoid_: Agent View, standalone dashboard

**Console View State**:
Client-local project, Agent Status, archive, and name filters plus an optional project-or-status grouping choice. It affects presentation only and never changes the Dispatch Target or global Work Queue.
_Avoid_: Saved group, scheduling filter, Dispatch Target

**Conversation**:
A durable Pi session identity and history linked to an Agent. It may be reserved while still empty, can exist without a live Agent Runtime, and provides continuity across stop and resume.
_Avoid_: Agent, runtime

**Agent**:
A durable supervised identity linked to exactly one Conversation, whether dispatched by Agent Console or deliberately adopted. It has at most one live Agent Runtime and persists across runtime replacement until permanently deleted.
_Avoid_: Subagent, worker, process

**Agent Name**:
The Supervisor-authoritative, mutable, non-unique display name of an Agent, mirrored to its Pi Conversation name when possible. It identifies an Agent for humans but is never its durable identity.
_Avoid_: Agent ID, Conversation ID

**Pin**:
Durable user intent to keep an Agent prominent and exempt from automatic retention cleanup. Pin affects ordering only after explicit filters and grouping; it never changes lifecycle, scheduling, or Runtime behavior.
_Avoid_: Priority, keep-alive, filter override

**Dispatch**:
An accepted Agent Console command that atomically reserves exactly one new Agent and Conversation with exactly one initial Work Request. A Dispatch never targets an existing Agent.
_Avoid_: Broadcast, reply, background prompt

**Dispatch Target**:
The explicit canonical project and requested relative working directory used by default for subsequent Dispatches from one Agent Console client. It remains fixed until deliberately changed, is independent of list selection and view filters, and may be replaced by a one-shot `cwd` override in one Dispatch without prescribing the Agent's eventual workspace path.
_Avoid_: Selected Agent, current list group, Agent workspace

**Original Checkout**:
The existing user-owned checkout in which a foreground Pi session first becomes supervised as an Agent. Its Agent may release ownership, but Agent Console never cleans, resets, switches, or automatically reallocates the checkout.
_Avoid_: Managed worktree, default branch, disposable checkout

**Agent Workspace**:
The canonical checkout directory durably and exclusively assigned to one Agent for its file context. It is either the Original Checkout or a Managed Worktree and remains assigned across Agent Status changes and Agent Runtime replacement until explicitly released or permanent deletion passes its safety checks.
_Avoid_: Dispatch Target, requested working directory, temporary Runtime directory

**Managed Worktree**:
A linked Git worktree provisioned by the Supervisor as one isolated Agent Workspace. New and Dispatch use one, while existing user-owned checkouts, directory copies, temporary clones, and purportedly read-only shared directories are never Managed Worktrees.
_Avoid_: Original Checkout, clone, shared workspace, user-created worktree

**Workspace Base**:
The exact commit frozen when New or Dispatch is accepted and used to create its Managed Worktree's initial branch. It defaults to the `HEAD` commit of the checkout that resolved the effective Dispatch Target, may be explicitly overridden by another local commit, and never includes uncommitted filesystem state.
_Avoid_: Default branch, launch-time `HEAD`, remote guess, Dispatch Target

**Workspace Claim**:
The Supervisor-authoritative durable and exclusive assignment of one canonical Agent Workspace to one Agent. It survives Agent Runtime replacement and prevents assignment to another Agent until released; a Git worktree lock protects metadata but is not the Workspace Claim.
_Avoid_: Git worktree lock, process lock, Runtime lease

**Workspace Conflict**:
An unresolved mismatch between a Workspace Claim and observed Agent Runtime, filesystem, or Git worktree identity. It prevents launch, resume, reassignment, and cleanup until reconciliation or explicit recovery resolves it; it is not itself an Agent Status.
_Avoid_: Failed, missing-file inference, disposable worktree

**Workspace Release**:
An explicit operation that ends an Agent's Workspace Claim without deleting the Agent or Conversation. Releasing an Original Checkout only unbinds it; releasing a Managed Worktree preserves enough committed branch identity for a later resume even when its linked checkout is safely removed.
_Avoid_: Stop, Archive, Permanent delete, automatic retention cleanup

**Preserved Checkout**:
A former Managed Worktree durably recorded as a locked, user-owned artifact when its Workspace Claim is released without removing its files or Git registration. Its record and lock survive deletion of the originating Agent until the user explicitly unlocks and forgets it; Agent Console never automatically reallocates or cleans it.
_Avoid_: Agent Workspace, Managed Worktree, failed cleanup, disposable worktree

**Workspace Publication Proof**:
Evidence permitting ordinary Managed Worktree removal: either its managed branch has no commits beyond the Workspace Base, or its configured remote push ref currently points to the exact local tip. Missing, stale, offline, remote-ahead, or otherwise ambiguous evidence is unknown and blocks ordinary removal.
_Avoid_: Clean working tree, local tracking-ref inference, presumed push

**Destructive Workspace Cleanup**:
An explicitly confirmed Managed Worktree removal that may discard reviewed filesystem changes or proceed without Workspace Publication Proof. It can never override liveness, identity, path-boundary, inventory, or Workspace Conflict checks, and it preserves committed continuation refs and branches.
_Avoid_: Workspace Release, Permanent delete, force-through-conflict cleanup

**Agent Start Configuration**:
The effective target, resolved project-trust mode, model, and thinking level frozen when a promptless New or Dispatch is accepted. A one-shot `cwd` may replace the client's Dispatch Target, and other explicit one-shot overrides take precedence over the configuration a fresh Pi invocation would resolve there; unresolved or invalid values prevent acceptance, and transient settings from another Conversation are never inherited.
_Avoid_: Agent profile, copied session settings, fallback model

**Launch Environment**:
The sanitized, volatile process environment captured from the client that accepted an Agent start. It supplies ordinary credentials and toolchain configuration without persisting secret values, and it is never substituted with the detached Supervisor's environment when unavailable.
_Avoid_: Supervisor environment, persisted environment snapshot

**Agent Runtime**:
One live execution epoch of an Agent. Stopping and resuming replaces the Agent Runtime while preserving the Agent and its Conversation.
_Avoid_: Agent, conversation

**Runtime Condition**:
The condition of an Agent's current Agent Runtime—none, starting, live, unreachable, or stopping—tracked independently from Agent Status.
_Avoid_: Agent Status, work outcome

**Agent Status**:
The authoritative public lifecycle state of an Agent: Starting, Working, Needs input, Completed, Failed, or Stopped.
_Avoid_: Agent Runtime status, inferred status

**Status Reason**:
A machine-defined explanation attached to an Agent Status transition. Diagnostic prose may supplement it but never determines behavior.
_Avoid_: Free-form status, transcript explanation

**Starting**:
An Agent Status used while startup or authoritative recovery is incomplete. Its phase is Queued, Provisioning, Launching, Connecting, Dispatching, or Recovering; new, resume, and adopt are start reasons rather than phases.
_Avoid_: Queued status, Recovering status

**Recovering**:
A Starting phase used while the Supervisor cannot yet establish an Agent's current authoritative state. Any prior Agent Status is historical until reconciliation succeeds.
_Avoid_: Stale Working, stale Needs input

**Work Cycle**:
One identifiable span of work after an Agent Runtime accepts a Work Request, including automatic retries, compaction, steering, and queued continuations. It pauses for Interactions and ends with a Completed, Failed, or Stopped outcome.
_Avoid_: Queued request, low-level run, turn, tool call

**Work Request**:
One immutable Pi user-message payload accepted by the Supervisor to begin an Agent's next Work Cycle when it has no active Work Cycle, open Interaction, or pending Work Request. Its text and supported attachments are validated and materialized relative to the effective target in its Agent Start Configuration before acceptance. It may wait in the Work Queue, and the Work Cycle does not begin until its Agent Runtime accepts it.
_Avoid_: Work Cycle, Interaction reply, queued prompt mutation, background shell job

**Concurrency Slot**:
One unit of the configured global capacity for autonomous work. Once claimed by the scheduler, a Work Request holds a slot during startup and dispatch until its Work Cycle begins; that Work Cycle then holds it while autonomous continuation is pending or active, releases it while blocked on an Interaction, and receives priority when that Interaction is answered. A claim is retained while authority is uncertain and released only by authoritative lifecycle evidence; Agent Runtimes without autonomous work do not consume slots.
_Avoid_: Agent limit, Runtime limit

**Work Queue**:
The single global, durable, and user-ordered sequence of entries waiting for Concurrency Slots. An entry is either a Work Request waiting to begin a Work Cycle or an answered Interaction waiting to resume one, with at most one entry per Agent. Ordinary Work Requests enter in acceptance order; answered Interactions visibly enter ahead of them, preserving answer order. The displayed order is the scheduling order and has no hidden project or attachment priority.
_Avoid_: Agent queue, queued Work Cycle, hidden priority queue

**Working**:
An Agent Status used while a Work Cycle has autonomous continuation pending or active.
_Avoid_: Terminal activity, dispatched but unaccepted work

**Needs input**:
An Agent Status used when a newly started, resumed, or adopted Agent awaits a prompt, or while one or more explicitly signalled Interactions block continued work. It temporarily overrides underlying work; only the Interaction form demands attention.
_Avoid_: Idle, inferred question

**Interaction**:
An explicitly signalled request for a user response that blocks an Agent from continuing. Assistant prose and terminal output never create an Interaction.
_Avoid_: Question-like text, inferred prompt

**Completed**:
An Agent Status recording that Pi settled the latest Work Cycle without an unrecovered operational error, cancellation, or outstanding Interaction. It does not judge whether the response achieved the user's goal and remains latched while awaiting optional follow-up work.
_Avoid_: Idle, semantic success, awaiting input

**Stopped**:
A latched Agent Status recording that a Work Request, Work Cycle, or Agent Runtime was deliberately halted and the halt was authoritatively confirmed. It does not by itself say whether an Agent Runtime remains live.
_Avoid_: Failed, stopping, archived

**Failed**:
A latched Agent Status recording that an unrecovered, unintended operational fault prevented trustworthy supervised continuation of a Work Cycle or Agent Runtime. Semantic task failure and recoverable tool errors are not Failed.
_Avoid_: Stopped, unsuccessful answer

**Archive**:
A retention and visibility marker that leaves Agent Status unchanged.
_Avoid_: Stop, permanent delete

**Permanent delete**:
Removal of an Agent identity and its Conversation association after applicable safety checks. It is not an Agent Status.
_Avoid_: Stop, archive

**Supervisor**:
The durable per-user logical owner of Agent identity, commands, and Agent Status projection, realized by at most one active background process instance independently of any Agent Console interface. Its ownership survives process restart and is distinct from Agent Runtime lifetime and Conversation write ownership.
_Avoid_: Agent Console, agent, process parent
