# Agent Console

Agent Console is an open-source Pi package for supervising concurrent full Pi sessions through a native, in-session terminal control plane.

## Language

**Agent Console**:
The package and native in-session terminal control plane through which a user supervises agents.
_Avoid_: Agent View, standalone dashboard

**Agent Console Data Root**:
The private durable per-user storage owned by Agent Console and bound to exactly one canonical Pi configuration root. It holds Agent Console configuration, registry state, recovery checkpoints, logs, and managed workspace artifacts, survives package update and removal, and is distinct from package code and reboot-volatile coordination files.
_Avoid_: Pi configuration root, package directory, runtime directory

**Work Payload Spool**:
The sole Agent Console-owned holding area for Work Request and Interaction-response content that Pi has not yet authoritatively accepted. Work Request content remains through accepted, queued, starting, and delivering phases; exact Interaction-response content remains while awaiting authoritative delivery; interrupted Runtime-unaccepted content may remain for explicit Retry work. Unbound bytes remain quarantined inside the spool for one 30-second reconciliation window. Other content is erased without becoming registry, diagnostic, notification, or backup content.
_Avoid_: Conversation, registry record, permanent prompt archive, external quarantine

**Console View State**:
Client-local project, Agent Status, archive, and name filters plus an optional project-or-status grouping choice. It affects presentation only and never changes the Dispatch Target or global Work Queue.
_Avoid_: Saved group, scheduling filter, Dispatch Target

**Peek**:
A read-only expansion of the selected Agent's Inspector using structured Supervisor facts. It never starts or attaches to an Agent Runtime, transfers input authority, reads transcript text, or resets inactivity.
_Avoid_: Attach, Resume, transcript preview

**Terminal Client**:
One connected terminal presentation that shows Agent Console or one Agent's native Pi interface and may hold at most one Input Lease.
_Avoid_: Agent Runtime, Supervisor client process, terminal emulator

**Console Host**:
The Agent Runtime whose Pi extension currently renders Agent Console for one Terminal Client. Hosting the view does not grant Supervisor authority or change the Agent's lifecycle.
_Avoid_: Supervisor, dedicated dashboard process

**Input Lease**:
The generation-fenced exclusive authority for one Terminal Client to deliver writable native input to one Agent. Heartbeat uncertainty blocks a new writable attachment but does not disable the confirmed existing holder; transition or competing-ownership uncertainty fences input. Uncertainty never transfers or expires the lease by inference.
_Avoid_: Process lock, Workspace Claim, terminal focus

**Attach**:
A same-terminal transition from Agent Console into one Agent's full native Pi interface without replacing its Agent Runtime or changing its Agent Status.
_Avoid_: Resume, Peek, new frontend

**Detach**:
A same-terminal transition from one Agent's native Pi interface into Agent Console without stopping work or releasing that hosting Agent's Input Lease.
_Avoid_: Stop, Handoff, terminal disconnection

**Handoff**:
An all-or-nothing same-terminal transition from one Agent's native interface to another that transfers the Input Lease without stopping either Agent or moving pending keystrokes.
_Avoid_: Detach, mirrored frontend, session replacement

**Takeover**:
An explicit transfer of an Agent's Input Lease to a second Terminal Client after the previous lease generation is revoked and fenced.
_Avoid_: Automatic lease expiry, duplicate attachment, process kill

**Conversation**:
A durable Pi session identity and history that may be linked to one Agent. It may be reserved while still empty, can be unowned before Adoption or after Permanent delete, can exist without a live Agent Runtime, and provides continuity across stop and Resume.
_Avoid_: Agent, runtime

**Agent**:
A durable supervised identity linked to exactly one Conversation, whether dispatched by Agent Console or deliberately adopted. It has at most one live Agent Runtime and persists across runtime replacement until permanently deleted.
_Avoid_: Subagent, worker, process

**Registration**:
The idempotent establishment or recovery of the authoritative association among a compatible persistent Pi Runtime, its Conversation, its Agent, and its Workspace Claim before writable supervision begins.
_Avoid_: Login, process discovery, record-only Adoption

**Adoption**:
An explicit operation that links one previously unowned Conversation to a new Agent only after exclusive Conversation-writing and a safe Workspace Claim are proven, then starts that Agent for use.
_Avoid_: Resume, process scan, record-only import

**Agent Name**:
The Supervisor-authoritative, mutable, non-unique display name of an Agent, mirrored to its Pi Conversation name when possible. It identifies an Agent for humans but is never its durable identity.
_Avoid_: Agent ID, Conversation ID

**Pin**:
Durable user intent to keep an Agent prominent and exempt from automatic archival. Pin affects ordering only after explicit filters and grouping; it never changes lifecycle, scheduling, Runtime behavior, or technical log, checkpoint, and backup retention.
_Avoid_: Priority, keep-alive, filter override, diagnostic retention

**New**:
An accepted promptless creation command that reserves exactly one new Agent and empty Conversation, starts a fresh Agent Runtime, and attaches its requesting Terminal Client without creating a Work Request.
_Avoid_: Dispatch, Resume, Conversation reset

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

**Workspace Abandonment**:
An explicitly confirmed resolution for a claimed Managed Worktree whose exact checkout path is proven absent and cannot be repaired. It ends the Workspace Claim while retaining committed continuation identity and the missing Git registration and lock as a preserved artifact.
_Avoid_: Automatic prune, cleanup, inferred deletion

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
The effective target, resolved project-trust mode, model, thinking level, optional Agent Name, and optional Workspace Base frozen when a promptless New or Dispatch is accepted. A one-shot `cwd` may replace the client's Dispatch Target; only explicit model, thinking, name, `cwd`, and Workspace Base overrides take precedence over a fresh Pi invocation's resolution. Invalid values prevent acceptance, and transient settings from another Conversation are never inherited.
_Avoid_: Agent profile, copied session settings, credential override, fallback model

**Launch Environment**:
The sanitized, volatile process environment captured from the client that accepted an Agent start. It supplies ordinary credentials and toolchain configuration without persisting secret values, and it is never substituted with the detached Supervisor's environment when unavailable.
_Avoid_: Supervisor environment, persisted environment snapshot

**Agent Runtime**:
One live execution epoch of an Agent. Stopping and resuming replaces the Agent Runtime while preserving the Agent and its Conversation.
_Avoid_: Agent, conversation

**Resume**:
An explicit operation that starts a fresh Agent Runtime epoch for the same Agent and Conversation without replaying a prior Work Request or Work Cycle.
_Avoid_: Retry work, automatic restart, Adoption

**Runtime Condition**:
The condition of an Agent's current Agent Runtime—none, starting, live, unreachable, or stopping—tracked independently from Agent Status.
_Avoid_: Agent Status, work outcome

**Quiescent**:
An operational condition in which an Agent has no Agent Runtime, queued or pending Work Request, active Work Cycle, open Interaction, unresolved operation, recovery, or Workspace Conflict. It is not an Agent Status.
_Avoid_: Completed, Stopped, idle

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

**Recovery Action**:
An explicit domain-specific operation offered to resolve one identified uncertainty without bypassing safety invariants. Agent Console has no generic force-recovery operation.
_Avoid_: Automatic guess, force reset, destructive override

**Work Cycle**:
One identifiable span of work after an Agent Runtime accepts a Work Request, including automatic retries, compaction, steering, and queued continuations. It pauses for Interactions and ends with a Completed, Failed, or Stopped outcome.
_Avoid_: Queued request, low-level run, turn, tool call

**Work Request**:
One immutable Pi user-message payload accepted by the Supervisor to begin an Agent's next Work Cycle when it has no active Work Cycle, open Interaction, or pending Work Request. Its text and supported attachments are validated and materialized before acceptance: New/Dispatch use the effective target in the frozen Agent Start Configuration, while Existing-Agent Submit work uses that Agent's exact current Agent Workspace under its Workspace Claim. It may wait in the Work Queue, and the Work Cycle does not begin until its Agent Runtime accepts it.
_Avoid_: Work Cycle, Interaction reply, queued prompt mutation, background shell job

**Retry work**:
An explicit operation that previews an interrupted, Supervisor-accepted but Runtime-unaccepted Work Request and creates a new immutable Work Request from it after current configuration and ownership are revalidated. It never replays work automatically or resumes the prior Work Cycle.
_Avoid_: Resume, automatic replay, Work Cycle continuation

**Discard retry data**:
An explicit irreversible operation that removes the Supervisor-owned payload retained for an interrupted, Supervisor-accepted but Runtime-unaccepted Work Request without changing its Agent, Conversation, Agent Status, or Workspace Claim.
_Avoid_: Queue cancellation, Archive, Permanent delete

**Concurrency Slot**:
One unit of the configured global capacity for autonomous work. Once claimed by the scheduler, a Work Request holds a slot during startup and dispatch until its Work Cycle begins; that Work Cycle then holds it while autonomous continuation is pending or active, releases it while blocked on one or more Interactions, and receives priority only when its final blocking Interaction is answered. A claim is retained while authority is uncertain and released only by authoritative lifecycle evidence; Agent Runtimes without autonomous work do not consume slots.
_Avoid_: Agent limit, Runtime limit

**Work Queue**:
The single global, durable, and user-ordered sequence of entries waiting for Concurrency Slots. An entry is either a Work Request waiting to begin a Work Cycle or a continuation whose final blocking Interaction was answered, with at most one entry per Agent. Ordinary Work Requests enter in acceptance order; answered continuations visibly enter ahead of them, preserving answer order. The displayed order is the scheduling order and has no hidden project or attachment priority.
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

**Emergency stop**:
An exact-target safety operation available when normal Supervisor mutation is unavailable. It durably records user intent before aborting a verified Work Cycle or Agent Runtime and grants no authority to dispatch, resume, change ownership, or clean up artifacts.
_Avoid_: Force recovery, ordinary Stop, unverified process signal

**Failed**:
A latched Agent Status recording that an unrecovered, unintended operational fault prevented trustworthy supervised continuation of a Work Cycle or Agent Runtime. Semantic task failure and recoverable tool errors are not Failed.
_Avoid_: Stopped, unsuccessful answer

**Archive**:
A retention and visibility marker that leaves Agent Status unchanged.
_Avoid_: Stop, permanent delete

**Permanent delete**:
Removal of an Agent identity, its Agent Console metadata, and its Conversation association after applicable safety checks. It does not erase Pi's Conversation file and is not an Agent Status.
_Avoid_: Stop, archive, Conversation deletion

**Supervisor**:
The durable per-user logical owner of Agent identity, commands, and Agent Status projection, realized by at most one active background process instance independently of any Agent Console interface. Its ownership survives process restart and is distinct from Agent Runtime lifetime and Conversation write ownership.
_Avoid_: Agent Console, agent, process parent

**Supervisor Mode**:
The authoritative global operating condition of the Supervisor: starting, ready, recovering, read-only, or preservation. It is independent of every Agent Status and of whether a particular client is connected.
_Avoid_: Agent Status, client connection state, inferred availability

**Pi**:
The host coding-agent application that owns Conversation content and native interactive behavior and exposes the documented public capabilities Agent Console qualifies.
_Avoid_: Agent Console, Supervisor

**Runtime bridge**:
The authenticated, versioned semantic channel between one Agent Runtime epoch and the Supervisor. It exchanges structured operations, facts, checkpoints, and acknowledgements without carrying terminal output or Conversation prose.
_Avoid_: terminal transport, public API, transcript parser

**Host Conformance Harness**:
The black-box qualification contract proving that a Pi minor supplies the required public bootstrap, mediated Interaction, project-trust, and Conversation-writer capabilities with the specified semantics.
_Avoid_: feature detection alone, private Pi import

**Roster**:
The Agent Console list projection used to select and compare Agents without changing the Dispatch Target or scheduling order.
_Avoid_: Work Queue, Dispatch Target

**Inspector**:
The structured detail and action projection for the selected Agent. It shows authoritative Supervisor facts and may be expanded by Peek.
_Avoid_: transcript viewer, native Pi interface

**Command Record**:
The durable idempotency and outcome record for one logical command ID and issuance epoch, including its immutable terminal result when reached.
_Avoid_: event acknowledgement, shell command history

**Operation Journal**:
The durable intent-before-effect record for one external operation, its exact target, ordered phases, observations, and outcome.
_Avoid_: debug log, optimistic UI state

**Configuration Generation**:
A never-reused durable generation that binds one exact `config.json` content digest to the agreeing Supervisor durable/global revision, configuration revision, and migration journal.
_Avoid_: package version, client preference revision

**Notification Intent**:
The single globally deduplicated, content-minimized record authorizing notification delivery for one eligible committed transition or Interaction.
_Avoid_: domain event, per-client duplicate

**LLM Summary**:
An explicit-action, non-authoritative ephemeral summary supplied by a compatible Agent Runtime after provider, cost, and sensitive-boundary disclosure.
_Avoid_: deterministic summary, recovery evidence, automatic inference
