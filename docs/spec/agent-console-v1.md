# Agent Console v1 Specification

- Status: **Approved normative v1 contract**
- Product: **Agent Console**
- Package: `pi-agent-console`
- License: MIT

## 1. Purpose and authority

This document is the self-contained normative implementation contract for Agent Console v1: a user-global Pi package that provides a native, in-session control plane for concurrent full Pi sessions on macOS and Linux.

The keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are interpreted as in RFC 2119. Every normative requirement has a stable `ACV1-*` identifier. Scenario identifiers beginning with `VC-*` are automated verification contracts; `HA-*` identifiers are human acceptance contracts.

The final human resolutions incorporated here govern behavior. `CONTEXT.md` is a synchronized concise glossary only; it is not required to interpret this specification and does not override it. The source decisions are linked in [Appendix D](#appendix-d-decision-provenance). Production implementation, release execution, npm publication, and gallery submission are outside this specification.

### 1.1 Normative domain glossary

- **ACV1-GLOSS-001** — Capitalized domain terms in this specification MUST have the meanings below. **Agent Console Data Root** may be shortened to **Data Root**, and **Runtime** means **Agent Runtime** where the context is unambiguous.

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

### 1.2 Destination


- **ACV1-GEN-001** — An implementation conforming to this document MUST let a user start with plain interactive `pi`, supervise that full Pi session as an Agent, open Agent Console in the same terminal, run multiple independent Agents, and move among their real native Pi interfaces without stopping autonomous work.
- **ACV1-GEN-002** — Agent Console MUST preserve trustworthy Agent Status, exclusive input and workspace ownership, durable scheduling, recovery evidence, and explicit destructive authority across client and Supervisor loss.
- **ACV1-GEN-003** — Agent Console MUST use documented public Pi interfaces only. It MUST NOT import private Pi paths, patch an installed Pi, scrape terminal output or Conversation prose for state, or present a reduced-fidelity RPC/transcript frontend as native.
- **ACV1-GEN-004** — A release MUST remain blocked until at least one real Pi minor line and the claimed OS matrix pass the Host Conformance Harness and release qualification contract.

### 1.3 Scope

- **ACV1-GEN-008** — V1 MUST include all capabilities in this closed scope list:

- one local, single-user Supervisor across all projects under one canonical Pi configuration root;
- full Pi Agent Runtimes in a private tmux fabric;
- New, Dispatch, work submission, Interaction Reply, Attach, Detach, Handoff, Takeover, Adoption, Resume, Retry work, Stop, Archive, Workspace Release, cleanup, preservation, Workspace Abandonment, and Permanent delete;
- a visible global Work Queue with a configurable global concurrency limit;
- exclusive Original Checkout and Managed Worktree ownership;
- preservation-first recovery, private local IPC, retained state, package migration, uninstall, reinstall, and purge safety;
- deterministic summaries by default and explicit opt-in LLM summaries;
- user-global npm/Pi distribution through a single package.

### 1.4 Out of scope

- **ACV1-GEN-005** — V1 MUST NOT provide native Windows support, remote or multi-user supervision, a TCP/network control API, or protection from arbitrary hostile code already executing as the same OS user.
- **ACV1-GEN-006** — V1 MUST NOT manage background shell jobs, scheduled loops, pull requests, arbitrary tags, saved custom groups, bulk Resume/Retry work, automatic restart after reboot, or automatic Permanent delete.
- **ACV1-GEN-007** — V1 MUST NOT expose a public JavaScript/TypeScript API, a public SQLite/checkpoint/socket protocol, a machine-readable CLI schema, or a second CLI automation plane for Agent lifecycle and queue mutation.

## 2. Canonical product journeys

### 2.1 Plain `pi` to supervision

- **ACV1-FLOW-030** — Plain-`pi` registration MUST follow this ordered journey:

1. A compatible user-global extension receives the guarded pre-interactive bootstrap event.
2. Noninteractive modes, `PI_AGENT_CONSOLE=0`, `--no-session`, invalid installation scope, nested tmux, and incompatible hosts bypass supervision as specified in [Host compatibility](#6-host-conformance-and-pi-boundary).
3. The bootstrap re-executes the unchanged interactive invocation inside the private tmux fabric before Pi opens a Conversation, starts a turn, constructs the terminal, or enables raw mode.
4. Registration binds the persistent Conversation, Agent, Agent Runtime epoch, Original Checkout, and Runtime bridge before writable input appears.
5. With editor text or other draft state present, `←` remains Pi input. With a completely empty editor, `←` Detaches to Agent Console while an active Work Cycle continues.

- **ACV1-FLOW-001** — Bootstrap MUST preserve original arguments, cwd, non-control environment, stdio, signals, and exit status. The supervised child MAY have the accepted tmux-specific `TERM`, `TERM_PROGRAM`, and `TMUX` differences.
- **ACV1-FLOW-002** — Registration MUST be idempotent and MUST complete identity, compatibility, Conversation-writer, and Workspace Claim preflight before writable input is exposed.
- **ACV1-FLOW-003** — A preflight failure MUST create no partial Agent. A failure after durable acceptance MUST leave one truthful Failed Agent rather than creating a replacement identity.

### 2.2 New and Dispatch

- **ACV1-FLOW-032** — New and Dispatch MUST implement these distinct creation contracts:

- **New:** with no prompt, reserve one new Agent and empty Conversation, reserve/provision its workspace, launch a promptless Runtime, and Attach when ready. New creates no Work Request and consumes no Concurrency Slot.
- **Dispatch:** with non-empty text and/or attachments, atomically reserve one new Agent, Conversation, immutable Work Request, frozen start configuration, workspace reservation, and queue/slot position. The user remains in Agent Console.

- **ACV1-FLOW-004** — One deliberate creation submission MUST create exactly one Agent. Selection MUST NOT turn Dispatch into Reply, and one input MUST NOT broadcast.
- **ACV1-FLOW-005** — New and Dispatch into supported Git MUST receive a Managed Worktree, including the first background Agent in another project. V1 MUST NOT classify prompts as coding or read-only.
- **ACV1-FLOW-006** — Preflight rejection MUST create nothing. An accepted command MUST be acknowledged only after one atomic durable commit and MUST return the same result when its command ID is retried.

### 2.3 Queue, Interaction, and Reply

- **ACV1-FLOW-031** — Queue and Interaction handling MUST follow this ordered journey:

1. Work waits in the single global visible Work Queue when no Concurrency Slot is available.
2. An explicit Interaction releases the Work Cycle's slot and projects Needs input.
3. Replies target a stable Interaction identity and schema through Pi's mediated Interaction interface; an inline scalar or finite-choice Reply is a Supervisor-mediated control-plane resolution, not native editor input.
4. Resolving the final blocking Interaction makes autonomous continuation eligible and queues it ahead of ordinary starts. Resolving an earlier Interaction leaves Needs input while another remains.
5. Cancelling a queued continuation settles its Work Cycle as Stopped.

- **ACV1-FLOW-007** — The displayed Work Queue order MUST be the scheduling order and MUST contain no hidden project, attachment, or fairness lane.
- **ACV1-FLOW-008** — A Reply MUST NOT be delivered directly to an editor, a different Interaction, or a stale Runtime/lease generation.
- **ACV1-FLOW-009** — Rich editor/custom Interactions MUST require Attach and the actual target Input Lease holder. Inline Reply MUST accept only scalar text or an explicitly finite-choice response schema and MUST be a Supervisor-mediated control-plane Interaction resolution, not native editor input or an Input Lease transfer. The calling Terminal Client need not hold the target Agent's Input Lease and MAY retain the Console Host's lease. Acceptance is allowed only when the target Agent is unleased or its lease is held by that same Terminal Client; a different holder MUST produce a lease conflict with Attach/Takeover offered and MUST NOT be bypassed or displaced. The initial command MUST be fenced by command ID and issuance epoch, calling Terminal Client identity/revision, target Agent identity/revision, Runtime epoch/revision, Work Cycle identity/revision, Interaction identity/revision, the client-created resolution identity with expected absence of any reserved resolution, exact response schema and Interaction schema revision, and current target Input Lease generation. Acceptance MUST atomically create `answer_pending`, reserve that resolution against both native and control-plane duplicates, allocate and return its initial Supervisor-owned resolution revision, and grant no writable native input. Idempotent retry uses the same command ID, issuance epoch, and resolution identity; only a later continuation may carry the returned resolution revision. Runtime delivery carries the allocated resolution identity/revision and remains exactly once through acknowledgement.

- **ACV1-FLOW-033** — Submit work to an existing Agent MUST use exactly one of these three paths, all converging on the same durable scheduler and exactly-once Runtime delivery:

  1. **Console-mediated control-plane Submit work to a live inactive Runtime.** This is not native editor input and MUST NOT acquire or transfer an Input Lease. The target MUST be live and either Needs input `ready_for_prompt` or Completed, with no active or unsettled Work Cycle, no outstanding or unresolved Interaction, no pending Work Request, and no unresolved operation. Settled/cancelled historical records are allowed. At acceptance the target MUST be unleased or leased to the calling Terminal Client; a different holder produces a non-mutating lease conflict with Attach/Takeover offered. The command is fenced by its command ID and issuance epoch; calling Terminal Client identity and revision; target Agent identity and revision, Conversation identity and binding revision, current Runtime epoch and revision, current Input Lease generation, exact Workspace Claim identity and revision, configuration revision, queue revision, and Work Request payload identity/integrity metadata. One transaction MUST accept exactly one newly allocated immutable Work Request identity and either waiting-queue membership or a slot claim, reserving it against duplicate native or control-plane submission. Relative attachment references MUST be resolved at preflight against that existing Agent's exact current Agent Workspace path under its Workspace Claim—not the calling Terminal Client's Dispatch Target, any native process working directory, or another Agent—and copied and revalidated before acceptance. The caller remains in Agent Console and its existing lease is unchanged.
  2. **Console-mediated Runtime-less submit-plus-resume.** The target MUST be Quiescent, resumable, unleased, own one exact ready conflict-free Workspace Claim, and have no current Runtime, no active or unsettled Work Cycle, no outstanding or unresolved Interaction, no pending Work Request, and no unresolved operation. Settled/cancelled historical records are allowed. The command need not carry a current Runtime epoch or hold an Input Lease; it MUST carry the last Runtime epoch and current Input Lease generation as stale unleased-state fences and otherwise carries the same command/caller/Agent/Conversation/claim/configuration/queue fences, expected absence of a pending Work Request, and Work Request payload identity/integrity metadata applicable to the Runtime-less state. One durable acceptance transaction MUST record the command, one newly allocated immutable Work Request, a frozen resume-start launch contract, a newly allocated external-operation identity and initial revision, and either queue membership or a slot claim. It MUST capture a fresh volatile Launch Environment reference from the accepting Console client without persisting secret values. The frozen contract MUST use the existing Agent's exact Conversation and Agent Workspace, revalidate project trust, and freeze the latest authoritative Conversation-scoped model/thinking values when available; if none exist, it MUST resolve them exactly as a fresh Pi invocation in that workspace. Relative attachment references MUST be resolved, copied, and revalidated against that exact Agent Workspace path under its Workspace Claim before acceptance, never against the calling Terminal Client's Dispatch Target, a process working directory, or another Agent. The path permits no one-shot `cwd`, Workspace Base, Agent Name, credential/environment, tool-set, or system-prompt override. At actual launch, current global/project Pi resources and credentials MUST be reread while frozen fields remain fixed. Startup passes through Starting `resume`; when ready, the already accepted request is delivered through the ordinary scheduler. The caller remains in Agent Console and this path MUST NOT Attach or grant a lease.
  3. **Attached native Submit work.** Submission from a native Pi interface MUST come from the actual Input Lease holder and carry the exact target Agent, Conversation, current Runtime epoch/revision and lease generation plus the applicable claim, configuration, queue, request, command, and Terminal Client fences. Relative attachment references MUST still be resolved, copied, and revalidated before acceptance against that Agent's exact current Agent Workspace path under its Workspace Claim, never the attached native process working directory, the calling Terminal Client's Dispatch Target, or another Agent. It then enters the same durable scheduler; native attachment MUST NOT bypass queueing or exactly-once reservation.

  After Runtime-less acceptance and before `runtime_accepted`, `launch_environment_lost`, invalid frozen configuration/trust, authoritative ownership conflict after bounded recovery, or stage failure MUST preserve the accepted Agent, Conversation, and Work Request truthfully, transition through the precise Failed/`interrupted` semantics, and offer explicit Retry work. Recovery MUST NOT substitute an environment or configuration, silently replay the accepted request, create another Work Request, or Attach.

### 2.4 Attach, Detach, Handoff, and Takeover

- **ACV1-FLOW-010** — Detach MUST enter Agent Console without stopping the Agent, changing status, changing slot ownership, or losing draft/editor state; the hosting Agent retains the Input Lease.
- **ACV1-FLOW-011** — Attach to the selected Agent MUST present its actual native Pi interface and MUST NOT replace its Runtime epoch.
- **ACV1-FLOW-012** — Handoff MUST disable ordinary input, reserve the transition, switch the same terminal, and atomically transfer the Input Lease. Failure before switching MUST restore the source UI, draft, cursor, and lease exactly.
- **ACV1-FLOW-013** — Keystrokes received during Handoff MUST NOT be buffered or replayed. Only cancellation is accepted.
- **ACV1-FLOW-014** — A second Terminal Client MUST NOT win a lease automatically. Takeover MUST explicitly revoke and fence the prior generation before granting a new one.
- **ACV1-FLOW-029** — If Handoff possibly switched the client, source and target input MUST remain fenced while exact tmux, Runtime, and lease evidence resolves completion to target or restoration to source. If neither is uniquely provable within the recovery bound, preserve both and project Failed `ownership_conflict`; never replay draft/input or guess.

- **ACV1-FLOW-026** — Before every planned Console Host termination, including Stop, Force stop, session quit, update handoff, Supervisor shutdown, uninstall, purge, or Permanent delete, the client MUST first Handoff to another live compatible Agent whose Input Lease can be acquired when one exists. Otherwise the operation MUST be durably acknowledged, the Console Host MUST exit cleanly, and the terminal MUST explain that plain `pi` re-enters supervision. Unexpected Console Host loss MUST reconnect through the bootstrap layer to an acquirable live Agent or return cleanly to the shell.

### 2.5 Adoption and Resume

- **ACV1-FLOW-015** — An Agent MUST remain linked to one immutable Conversation for its lifetime. A Runtime MUST NOT replace its Conversation in process.
- **ACV1-FLOW-016** — `/new`, `/fork`, and `/clone` MUST become Supervisor-mediated creation of another Agent and Conversation, followed by Attach; the source Agent and work continue.
- **ACV1-FLOW-017** — Selecting a Conversation already owned by an Agent MUST route to that Agent. Selecting an unowned saved Conversation MUST be the explicit Adopt and resume operation.
- **ACV1-FLOW-018** — Adoption MUST acquire Pi's Conversation-writer lease and a safe Workspace Claim before creating the Agent. Failure or uncertainty MUST refuse Adoption without scanning as proof, killing, or stealing from another process.
- **ACV1-FLOW-019** — Resume MUST create a new Runtime epoch for the same Agent and Conversation, without replaying prior work. An Agent released from a non-Git Original Checkout MUST remain non-resumable until the user selects another unclaimed existing directory.
- **ACV1-FLOW-027** — Unknown extension or built-in attempts to replace a live Agent's Conversation MUST be cancelled before mutation with an explanation rather than silently rebinding the Agent.
- **ACV1-FLOW-028** — A compatible bare `pi` invocation MUST route by Workspace Claim: reattach the live owner, offer explicit Resume for a Runtime-less owner, enter duplicate-terminal flow for a leased owner, or create a new Agent only when the workspace is unclaimed.

### 2.6 Stop, recovery, retention, and deletion

- **ACV1-FLOW-020** — Cancel queued work is confirmation-free and sets Stopped `queue_cancelled`; it MUST NOT delete the Agent.
- **ACV1-FLOW-021** — Stop active work or an idle Runtime requires ordinary confirmation and a semantic/graceful 10-second acknowledgement window. Status MUST remain current with pending-operation feedback until acknowledgement.
- **ACV1-FLOW-022** — Force stop MAY be offered or accepted only after graceful stop for the same Runtime epoch failed or timed out. It requires typed `stop <short-agent-id>`, immediate exact identity revalidation before each signal, `SIGTERM`, a 5-second wait, then `SIGKILL` only if the same Agent/Runtime epoch/process/tmux target remains. Ambiguity MUST abort escalation.
- **ACV1-FLOW-023** — Archive MUST be reversible, confirmation-free, and allowed only while Quiescent. It MUST NOT change Agent Status or release a Workspace Claim.
- **ACV1-FLOW-024** — Permanent delete requires Quiescence, prior safe Workspace Claim disposition, a complete retained/removed artifact preview, and typed `delete <short-agent-id>`.
- **ACV1-FLOW-025** — Permanent delete MUST NOT erase Pi's Conversation file, ordinary Git branches/continuation refs, or independent Preserved Checkouts.

## 3. Process topology and ownership

- **ACV1-ARCH-012** — Component authority MUST follow this ownership matrix:

| Component | Owns | Must not own |
|---|---|---|
| Pi | Conversation writes; native Pi behavior; public lifecycle and Interaction primitives | Agent Console registry, scheduler, status projection, workspace policy |
| private tmux fabric | Agent process/PTY lifetime, screen state, terminal transport and switching | semantic Agent Status, durable commands, Conversation writes |
| Supervisor | Agent identity, domain commands, durable registry, scheduling, status projection, Input Leases, Workspace Claims, recovery and migrations | terminal emulation, Pi Conversation writes |
| Pi extension adapter | bootstrap participation, custom editor, Roster/Inspector rendering, Runtime bridge, Pi message/Interaction adapter | duplicated Supervisor policy or durable registry mutation |
| SupervisorClient | socket discovery, authenticated handshake, command retry, snapshots, event resumption | domain policy or direct state-file access |
| CLI adapter | administrative parsing, diagnostics, recovery surfaces | Dispatch, Reply, queue mutation, normal lifecycle automation |

- **ACV1-ARCH-001** — There MUST be at most one logical per-user Supervisor bound to one canonical Pi configuration root and at most one active Supervisor process holding its singleton lease.
- **ACV1-ARCH-002** — There MUST be one private tmux server per OS user and one tmux session per live Agent. tmux MUST have no visible status bar, prefix, or management UI.
- **ACV1-ARCH-003** — Every live Agent MUST be an ordinary interactive Pi process; Pi is the sole Conversation writer and tmux owns its process lifetime.
- **ACV1-ARCH-004** — A Supervisor/client/shell crash MUST NOT stop an Agent Runtime. A reboot stops processes but preserves explicit-resume records.
- **ACV1-ARCH-005** — Terminal transport and semantic control MUST remain separate. `tmux send-keys` and ANSI/screen scraping MUST NOT dispatch work, answer Interactions, or project status.
- **ACV1-ARCH-006** — The Supervisor MUST be a deep module. Callers submit domain commands and receive authoritative state; process, database, scheduler, lease, workspace, and recovery mechanics remain hidden.
- **ACV1-ARCH-007** — Pi, tmux, Git, SQLite, filesystem, clock, boot identity, process signalling, project trust, notification delivery, and Host Conformance MUST sit behind focused internal interfaces. There MUST NOT be a catch-all public `shared` or generic OS-policy module.
- **ACV1-ARCH-008** — Only the extension adapter MAY import Pi host packages. Supervisor, protocol, persistence, and CLI core MUST NOT.
- **ACV1-ARCH-009** — `TmuxInteractiveFabric` MUST qualify an invisible `tmux-256color` path with synchronized-output advertisement, CSI-u extended keys, `mouse=on`, `set-clipboard=off`, explicit clipboard integration, resize/redraw, and nested-tmux refusal. Adapter details MAY vary only when the same terminal behavior and accepted differences pass qualification.
- **ACV1-ARCH-010** — The qualified tmux client path MUST use `-T sync`, a package-owned Kitty terminal-capability lifecycle bridge, OSC 52 passthrough, and explicit macOS `pbcopy` selection bindings; absence of required terminfo/capability evidence MUST fail native activation.
- **ACV1-ARCH-011** — The Console Host MUST render Roster + Inspector inside Pi through the documented public custom-UI surface; it MUST NOT substitute a separate dashboard process or tmux management UI.

## 4. Package and internal module boundaries

- **ACV1-MOD-004** — The implementation MUST preserve the following logical modules; exact filenames and class names are private.

| Module | Contract |
|---|---|
| Supervisor domain | validates commands; owns transactions, projections, queue, leases, claims, recovery, migrations |
| SupervisorClient | authenticated connection, handshake, command IDs, retry, snapshot, sequence-gap recovery |
| Pi extension adapter | Pi-only integration, bootstrap, editor routing, UI, bridge, message/Interaction mediation |
| InteractiveFabric | provision/switch/inspect/terminate native interactive sessions |
| TmuxInteractiveFabric | v1 production InteractiveFabric adapter |
| Registry/checkpoint store | durable transactions, operation journal, backups, checkpoint reconciliation |
| Workspace service | canonical identity, Git inventory, claims, provisioning, publication proof, cleanup |
| Host conformance adapter | public Pi capability/version/trust/Interaction/writer-lease boundary |
| Process/time adapter | process identity, signals, heartbeat clock, boot/suspension detection |
| Notification adapter | opt-in terminal/desktop delivery with privacy contract |
| Administrative CLI | stable human commands and recovery workflows |

- **ACV1-MOD-001** — Production and deterministic adapters implementing the same interface MUST pass the same reusable behavioral contract.
- **ACV1-MOD-002** — Test-only fault controls MUST NOT enlarge a production interface or appear in the exact npm tarball.
- **ACV1-MOD-003** — Status projection, scheduling, lease, ownership, recovery, and migration policy MUST exist only in the Supervisor domain, not be duplicated in clients or adapters.

## 5. Private Supervisor interface

### 5.1 Registration and Rejoin

- **ACV1-REG-001** — `RegisterOrRejoin` MUST be one logical Runtime-bridge request with a stable command ID and issuance epoch. It MUST carry Conversation identity and writer-lease evidence; process start identity and PID; private tmux server/session/pane identity; canonical workspace/repository identity and Workspace Claim evidence; package, private-protocol and bridge-schema versions; negotiated capabilities; authenticated canonical Pi-root identity; and, for Rejoin, Agent identity plus the previously allocated Runtime epoch, last Runtime checkpoint identity, and Runtime checkpoint acknowledgement watermark. Concrete wire field names remain private.
- **ACV1-REG-002** — The result MUST be exactly `registered_new`, `rejoined_existing`, or `refused`. A success returns the durable Agent/Conversation/Workspace Claim binding, a newly allocated never-reused Runtime epoch for new registration or the exact existing epoch for Rejoin, negotiated capabilities, Supervisor process epoch, Runtime checkpoint acknowledgement watermark, and initial Input Lease state; refusal returns a closed reason and creates no partial identity.
- **ACV1-REG-003** — The Supervisor MUST validate compatible versions/capabilities/root, exclusive Conversation writer, process/tmux/workspace identity, and absence of competing Agent/Claim/Runtime ownership. It MUST atomically commit the complete binding and Runtime epoch before acknowledging success or exposing writable input.
- **ACV1-REG-004** — Retry of the same command ID and issuance epoch with identical evidence MUST return the current durable result without allocating another Agent or Runtime epoch. Changed evidence, an expired/tombstoned ID, or a command ID reused under another issuance epoch MUST be refused. Rejoin MUST reconcile the existing binding and MUST NOT create a replacement Agent.

### 5.2 Transport and handshake

The wire encoding and private field names are implementation choices, but the following logical contract is normative.

- **ACV1-IPC-001** — IPC MUST use a pathname Unix socket in a user-owned `0700` reboot-volatile directory with a `0600` socket and no TCP listener.
- **ACV1-IPC-002** — Every connection MUST authenticate the current OS user, bound Pi-root identity, per-install credential, package version, private protocol version, client role, and requested capabilities before receiving data or authority.
- **ACV1-IPC-003** — Authentication MUST include a fresh server nonce and proof bound to the connection, and captured handshakes MUST NOT be replayable. Roles MUST be capability-restricted: console, Runtime bridge, CLI, and Supervisor handoff MUST receive only their required operations.
- **ACV1-IPC-004** — The peer UID MUST be established through kernel-enforced socket ownership/access and an OS peer-credential adapter; inability to establish it MUST fail closed. Arbitrary hostile code already executing as that UID remains outside the security claim.
- **ACV1-IPC-005** — Peers MUST negotiate optional fields and capabilities. Unknown optional fields/capabilities MUST be ignored or disabled as negotiated; unknown mandatory semantics, discriminants, reason codes, incompatible roots/roles, or unsupported mandatory schemas MUST fail closed with actionable diagnostics. Clients MUST NOT guess semantics.
- **ACV1-IPC-020** — Role grants MUST follow this closed matrix: console clients receive snapshots/events and user-facing domain commands subject to each command's exact Input Lease rules; Runtime bridges receive only operations scoped to their authenticated Agent/epoch for authoritative fact, bridge-snapshot, and checkpoint publication; explicitly authorized work delivery and Interaction resolution; lease-fenced native input submission; Agent Name synchronization in either authoritative direction; graceful Work Cycle stop/abort, Runtime stop, and session quit; and exact Runtime-issued Emergency stop intent. Runtime bridges MUST NOT receive arbitrary Supervisor policy authority or unrelated mutation capability. CLI clients receive read/administrative/recovery commands but no Dispatch, Reply, queue, or normal lifecycle mutation; Supervisor-handoff clients receive only quiesce/ownership-transfer/startup health operations.

### 5.3 Envelope, limits, and backpressure

Every frame logically carries protocol version, connection/session identity, role, message kind, and correlation identity. Commands additionally carry command ID, expected revisions/generations, and target identities.

- **ACV1-IPC-022** — The following normative cross-ticket synthesis limits MUST apply; a compatible private-protocol change MAY vary encoding only without changing these externally observable bounds:

- maximum decoded control frame: **1 MiB**;
- maximum per-client pending outbound backlog: **1,024 frames or 8 MiB**, whichever occurs first;
- resumable event window: **4,096 consecutive events within one Supervisor process epoch**.

- **ACV1-IPC-006** — Payload spool bytes MUST NOT be embedded in control frames; frames carry stable payload references and verified metadata.
- **ACV1-IPC-007** — Oversized, malformed, unauthenticated, or capability-forbidden frames MUST be rejected without domain mutation.
- **ACV1-IPC-008** — A slow client MUST never stall an Agent or Supervisor transaction. Backlog overflow MUST close that client's stream; reconnect MUST obtain a new snapshot rather than drop a semantically required event silently.
- **ACV1-IPC-009** — Events MUST be monotonically ordered by client stream sequence within a Supervisor process epoch. Resume is allowed only when every client stream sequence after the matching client event-stream acknowledgement watermark remains available; any gap, epoch change, or overflow requires a fresh snapshot.
- **ACV1-IPC-021** — A snapshot larger than one frame MUST be chunked under one snapshot identity and frozen revision/sequence. Each chunk carries a non-wrapping zero-based snapshot chunk ordinal scoped to that exact snapshot identity/revision/sequence tuple, allocated consecutively before each chunk emission, plus the tuple's total chunk count and end-to-end integrity value. A client MUST accept and install only the exact complete contiguous ordinal range `0..total-1` for one tuple after integrity verification; a duplicate, gap, out-of-range ordinal, tuple mismatch, disconnect, or integrity mismatch discards every chunk and retries a freshly frozen snapshot.

### 5.4 Command contract

- **ACV1-IPC-023** — Every mutating command MUST contain a stable command ID plus issuance epoch; authenticated caller role, client identity, and Pi-root identity; required target identities; expected revisions, Runtime epoch, and Input Lease generation as applicable; immutable payload metadata/arguments; and a volatile Launch Environment reference only where start/retry requires one. An initial command MUST NOT require an identity or revision for a Supervisor-owned entity that does not yet exist. It instead carries the applicable expected-absence fence and its command/effect idempotency authority; the Supervisor allocates the new identity and initial revision in the same durable acceptance/reservation transaction and returns them. Only an idempotent retry through the same command authority or a later continuation may refer to the returned identity/revision. Client-created identities, including an initial Interaction resolution identity, remain command inputs but carry expected absence of a conflicting Supervisor reservation until their initial Supervisor-owned revision is allocated. Existing entities always require their exact identity/revision fence. Concrete wire field names remain private.

- **ACV1-IPC-010** — A successful result means accepted intent and result are durable. A failed commit MUST NOT be acknowledged as success.
- **ACV1-IPC-011** — Retrying a known command ID and issuance epoch MUST return its current durable command record. An unresolved command MUST be retained until terminal and then for 30 days. After full outcome expiry, a compact content-free tombstone keyed by command ID and issuance epoch MUST make reuse detectable and rejected; IDs and issuance epochs MUST NOT wrap or be reused.
- **ACV1-IPC-012** — Stale revisions, epochs, generations, or inapplicable targets MUST be rejected with current authoritative state and no reinterpretation.
- **ACV1-IPC-013** — A command that causes an external side effect MUST durably record operation identity and intent before the effect and verified outcome afterward. Initial acceptance carries expected absence of a conflicting external operation plus command/effect idempotency authority; the Supervisor MUST allocate and return the external operation identity and initial operation revision in the same durable acceptance/reservation transaction before any effect. A retry uses the original command authority, and only a continuation may fence an already-returned operation identity/revision.

- **ACV1-IPC-024** — Logical commands MUST satisfy this matrix. “Durable accept/result” means atomic command record plus affected domain intent; “fact” means a committed event carrying the resulting after-image. Every row inherits the command ID/issuance epoch and creation-boundary convention in ACV1-IPC-023/013: “expected absence” applies to each newly created Supervisor-owned entity, while an already-returned identity/revision is required only for retry continuation or an existing entity. Payload cells name metadata only; Work Payload Spool content never enters control frames.

| Logical command | Authorized role | Required target and fences | Payload metadata | Durable acceptance / terminal result | Committed fact / after-image |
|---|---|---|---|---|---|
| Register/Rejoin | Runtime bridge | root, Conversation, process, tmux, workspace; expected absence of conflicting Agent/Runtime/binding for Register; exact prior Agent/Runtime checkpoint identity and Runtime checkpoint acknowledgement watermark for Rejoin | versions, capabilities, writer/claim evidence | new binding identities/revisions allocated and committed, or exact binding rejoined / registered, rejoined, refused | Runtime binding and projection |
| New | console | exact Terminal Client identity/revision and Dispatch Target revision; exact configuration revision; expected absence of conflicting Agent/Conversation/Workspace Claim/start operation | frozen start config, payload absent | Agent identity/revision, Conversation identity/binding revision, Workspace Claim identity/revision, and start-operation identity/revision allocated in one reservation / ready or failed | Agent, request-absent start after-image |
| Dispatch | console | exact Terminal Client identity/revision and Dispatch Target revision; exact configuration and queue revisions; expected absence of conflicting Agent/Conversation/Work Request/Workspace Claim/queue entry or slot/start operation | frozen config and Work Request integrity/size | Agent identity/revision, Conversation identity/binding revision, Work Request identity/revision, and Workspace Claim identity/revision plus queue entry or slot identity and start-operation identity/revision atomically allocated and accepted / started, interrupted, cancelled, failed | Agent/request/queue after-image |
| Submit work — live control plane | console; target unleased or leased to calling Terminal Client | command ID/issuance epoch; exact calling Terminal Client identity/revision, Agent identity/revision, Conversation identity/binding revision, current Runtime epoch/revision, Workspace Claim identity/revision, configuration revision, queue revision, and Input Lease generation; expected absence of conflicting pending request, queue entry or slot, and delivery operation | Work Payload identity/integrity/size | request identity/initial revision, queue entry or slot identity, and delivery-operation identity/initial revision allocated and atomically accepted / Runtime accepted, interrupted, cancelled, failed, or non-mutating lease conflict | request/cycle/queue after-image; no attachment or lease change |
| Submit work — Runtime-less submit-plus-resume | console; Quiescent resumable unleased target | command ID/issuance epoch; exact calling Terminal Client identity/revision, Agent identity/revision, Conversation identity/binding revision, Workspace Claim identity/revision, configuration revision, queue revision, last Runtime epoch, and current Input Lease generation as unleased-state fences; expected absence of a current Runtime and conflicting pending request, queue entry or slot, and start/delivery operation | Work Payload identity/integrity/size, frozen resume-start contract, volatile environment ref | request identity/initial revision, queue entry or slot identity, and start/delivery-operation identities/initial revisions atomically allocated and accepted / Runtime accepted, interrupted, cancelled, or stage-specific failed | Agent/request/Runtime/operation/queue after-image; no attachment or lease grant |
| Submit work — attached native | current Input Lease holder through Runtime bridge | command ID/issuance epoch; exact Terminal Client identity/revision, Agent identity/revision, Conversation identity/binding revision, current Runtime epoch/revision, Workspace Claim identity/revision, configuration revision, queue revision, and Input Lease generation; expected absence of conflicting pending request, queue entry or slot, and delivery operation | Work Payload identity/integrity/size | request identity/initial revision, queue entry or slot identity, and delivery-operation identity/initial revision allocated and atomically accepted / Runtime accepted, interrupted, cancelled, failed | request/cycle/queue after-image |
| Answer Interaction (inline scalar/choice) | console; target unleased or its lease held by the calling Terminal Client | command ID/issuance epoch; exact calling Terminal Client, target Agent, Runtime, Work Cycle and Interaction identities/revisions; client-created resolution identity with expected absence of any reserved resolution/reply operation; exact schema and Interaction schema revision; current Input Lease generation | scalar/choice integrity/size | `answer_pending` plus resolution/reply-operation reservation atomically accepted with initial Supervisor revisions allocated and returned / resolved, cancelled, same duplicate result, or lease conflict | Interaction/reply-operation after-image; no lease grant |
| Retry work | console | exact Agent identity/revision, interrupted Work Request identity/revision, configuration revision, and Workspace Claim identity/revision; expected absence of conflicting successor request, queue entry or slot, and start/delivery operation | retained-payload availability/integrity and fresh environment ref | successor request identity/initial revision, queue entry or slot identity, and operation identities/initial revisions allocated and accepted / Runtime accepted, interrupted, cancelled, failed | old/new request lineage and queue |
| Discard retry data | console | exact Agent and interrupted Work Request identities/revisions; expected absence of conflicting erase operation | Work Payload identity/hash/size | erase-operation identity/initial revision allocated and intent accepted / erased or conflict | content-free request after-image |
| Set concurrency limit | console | exact configuration revision; expected absence of conflicting configuration operation | integer limit | configuration-operation identity/initial revision allocated and config journal accepted / installed or failed | configuration and queue after-image |
| Set notification preferences | console | exact configuration revision and notification preference revision; expected absence of conflicting configuration operation | terminal/desktop opt-in booleans | configuration-operation identity/initial revision allocated and paired config/registry journal accepted / installed or failed | complete non-secret configuration and notification-preference after-image |
| Set Dispatch Target | console | exact Terminal Client identity/revision and current Dispatch Target revision | canonical existing directory and requested relative subdirectory | target mutation accepted / installed or rejected | complete Terminal Client and Dispatch Target after-image |
| Reorder queue entry | console | exact queue entry identity and queue revision | exact destination neighbor identity | queue mutation accepted / committed or race-lost | complete queue after-image |
| Cancel queue entry | console | exact queue entry identity, Work Request or Work Cycle identity/revision, and queue revision; expected absence of a conflicting stop operation if startup wins | closed cancellation reason and command/effect idempotency authority | cancellation accepted, allocating stop-operation identity/initial revision only if required / cancelled or startup race-lost | queue/request/cycle after-image |
| Rename | console | exact Agent identity/revision and configuration revision; expected absence of conflicting name-sync operation | validated name | mutation and any name-sync-operation identity/initial revision allocated and accepted / committed or bridge sync conflict | Agent/config/name-sync after-image |
| Pin / Unpin | console | exact Agent identity/revision | desired pin boolean | mutation accepted / committed | Agent after-image |
| Archive / Unarchive | console | exact Agent identity/revision and Quiescence for Archive | desired archive boolean | mutation accepted / committed | Agent after-image |
| Attach | console | exact Terminal Client, Agent and Runtime identities/revisions and Input Lease generation; expected absence of conflicting transition | transition intent and command/effect idempotency authority | transition identity/initial revision allocated and accepted / attached, fenced, failed | client/lease after-image |
| Detach | console | exact Terminal Client, Console Host Agent/Runtime identities/revisions and lease generation; expected absence of conflicting transition | transition intent and command/effect idempotency authority | transition identity/initial revision allocated and accepted / detached or failed | client presentation after-image |
| Handoff | console | exact source/target Agent, Terminal Client and both Runtime identities/revisions and lease generations; expected absence of conflicting transition | transition intent and command/effect idempotency authority | transition identity/initial revision allocated and intent committed / transferred, restored, conflict | client/lease after-image |
| Takeover | console | exact old/new Terminal Client, Agent/Runtime identities/revisions and lease generation; expected absence of conflicting transition | explicit transfer intent and command/effect idempotency authority | transition identity/initial revision allocated and revocation intent committed / transferred or conflict | client/lease after-image |
| Resume | console | exact Agent identity/revision, Conversation identity/binding revision, Workspace Claim identity/revision, configuration revision, and last Runtime epoch; expected absence of current Runtime and conflicting start operation | frozen target/config and environment ref | new Runtime epoch and start-operation identity/initial revision allocated with accepted intent / ready or failed | Agent/Runtime/claim projection |
| Adopt | console | exact unowned Conversation identity, writer-lease evidence, and configuration revision; expected absence of conflicting Agent, Workspace Claim, Runtime, and start operation | target/config and writer/claim evidence | Agent/claim/Runtime/start-operation identities and initial revisions atomically allocated and accepted / ready or failed | Agent/Conversation/Runtime/claim projection |
| Stop Work Cycle | console | exact Agent, Runtime and Work Cycle identities/revisions; expected absence of conflicting external operation; command/effect idempotency authority | graceful reason | external operation identity/initial revision allocated with intent before effect and returned / settled, race-lost, timeout | operation/Agent/Cycle after-image |
| Stop Runtime | console | exact Agent and Runtime identities/revisions and process/tmux identities; expected absence of conflicting external operation; command/effect idempotency authority | graceful reason | external operation identity/initial revision allocated with intent before effect and returned / stopped, race-lost, timeout | operation/Agent/Runtime after-image |
| Session quit | console | exact Console Host Agent, Runtime and Terminal Client identities/revisions; expected absence of conflicting external operation; command/effect idempotency authority | quit reason | external operation identity/initial revision allocated with planned-termination/Handoff intent before effect and returned / quit or refused | operation/client/Runtime after-image |
| Force stop | console after same-epoch graceful failure/timeout | exact Agent/Runtime identities/revisions, process/tmux identities, and already-returned graceful-operation identity/revision | typed confirmation and signal phase plus command/effect idempotency authority | exact continuation intent committed / stopped or refused | operation and Agent after-image |
| Emergency stop | CLI or Runtime bridge safety role | exact Agent identity/revision, Runtime epoch/revision, process/tmux identities, and durable safety evidence; expected absence of conflicting emergency operation; command/effect idempotency authority | checksummed intent | emergency-operation identity/initial revision allocated with exact intent durable before effect / stopped or refused | operation and Agent after-image |
| Reserve workspace | Supervisor internal | exact Agent identity/revision and canonical repo/path/base evidence; expected absence of a conflicting Workspace Claim | reservation evidence | Workspace Claim identity/initial revision allocated with reservation / reserved or conflict | claim after-image |
| Provision workspace | Supervisor internal | exact Agent and Workspace Claim identities/revisions and canonical repo/path/base; expected absence of conflicting external operation; command/effect idempotency authority | canonical identities and manifest hash | external operation identity/initial revision allocated with intent before effect / ready or conflict | claim/operation after-image |
| Repair workspace | console through Supervisor | exact Agent and conflicting Workspace Claim identities/revisions; expected absence of conflicting external operation; command/effect idempotency authority | candidate canonical identity/evidence | external operation identity/initial revision allocated with repair intent before effect / ready or conflict | claim/operation after-image |
| Workspace Release | console | exact Quiescent Agent and Workspace Claim identities/revisions; expected absence of conflicting external operation and any newly preserved artifact; command/effect idempotency authority | preview fingerprint and ordinary confirmation | operation and any artifact identities/initial revisions allocated with disposition intent before effect / released, preserved, conflict | claim/artifact/operation after-image |
| Ordinary cleanup | console | exact Quiescent Agent identity/revision and ready Workspace Claim identity/revision and all removal gates; expected absence of conflicting external operation and any newly preserved artifact; command/effect idempotency authority | preview fingerprint and ordinary confirmation | operation and any artifact identities/initial revisions allocated with removal intent before effect / removed, preserved, refused | claim/artifact/operation after-image |
| Destructive cleanup | console | exact Quiescent Agent and Workspace Claim identities/revisions and non-overridable gates; expected absence of conflicting external operation; command/effect idempotency authority | manifest fingerprint and typed confirmation | external operation identity/initial revision allocated with removal intent before effect / removed or conflict | claim/artifact/operation after-image |
| Preserve checkout | console | exact Quiescent Agent and Workspace Claim identities/revisions; expected absence of conflicting external operation and preserved artifact; command/effect idempotency authority | preserved-artifact manifest | operation and artifact identities/initial revisions allocated with disposition before effect / preserved or conflict | claim/artifact after-image |
| Workspace Abandonment | console | exact Agent and missing Workspace Claim identities/revisions and anchored continuation; expected absence of conflicting external operation and missing-workspace artifact; command/effect idempotency authority | preview fingerprint and typed confirmation | operation and artifact identities/initial revisions allocated with abandonment intent before effect / no claim plus artifact, or conflict | claim/artifact after-image |
| Unlock and Forget | console | exact preserved or missing workspace artifact identity/revision; expected absence of conflicting external operation; command/effect idempotency authority | confirmation and exact-path evidence | external operation identity/initial revision allocated with intent before effect / forgotten or conflict | artifact after-image |
| Reconcile | CLI guided recovery or Supervisor internal | exact installation, Agent identity/revision, and each affected existing entity revision from ACV1-IPC-027; expected absence of conflicting recovery operation; command/effect idempotency authority | exact evidence identity | recovery-operation identity/initial revision allocated and attempt recorded / recovered, preserved, read-only | mode/recovery after-image |
| Select legitimate Runtime | CLI guided recovery | every competing Agent/Runtime identity/revision and process/tmux/checkpoint identity; expected absence of conflicting recovery operation; command/effect idempotency authority | selected evidence identity | recovery-operation identity/initial revision allocated with selection intent / resolved or refused | Runtime/ownership after-image |
| List/verify backup | CLI | exact installation and backup manifest identity | no content payload | read/verification result / valid or invalid | backup health after-image when changed |
| Restore backup | CLI guided recovery | exact Quiescent installation and paired manifest/generations; expected absence of conflicting restore operation; command/effect idempotency authority | manifest identity/hash | restore-operation identity/initial revision allocated with intent before effect / restored, read-only, refused | recovery/config/migration after-image |
| Rebind Pi root | CLI guided recovery | exact installation, old root, durable/global revision and configuration revision; expected absence of conflicting root binding and rebind operation; command/effect idempotency authority | canonical old/new root identities and credential action | new binding and rebind-operation identities/initial revisions allocated with intent before effect / rebound or refused | root/config after-image |
| Permanent delete | console | exact Quiescent Agent identity/revision, exact Workspace Claim or artifact disposition identity/revision, and current deletion revision; expected absence of conflicting delete operation and tombstone; command/effect idempotency authority | preview fingerprint and typed confirmation | delete-operation identity/initial revision and tombstone allocated with intent before effect / deleted or conflict | Agent removal/tombstone after-image |
| Supervisor handoff | handoff role | exact installation, old Supervisor process epoch and durable/global revision; expected absence of conflicting new process epoch and handoff operation; command/effect idempotency authority | package/root/capability identity | new process epoch and handoff-operation identity/initial revision allocated with quiesce intent before effect / transferred or preservation | mode/package after-image |
| Supervisor shutdown | CLI | exact installation and Supervisor process epoch; expected absence of conflicting external operation; command/effect idempotency authority | shutdown reason | external operation identity/initial revision allocated with intent before effect / completed or refused | mode/operation after-image |
| Uninstall preparation | CLI | exact installation, Supervisor process epoch and all removal gates; expected absence of conflicting removal operation; command/effect idempotency authority | package/root identity | removal-operation identity/initial revision allocated with intent before effect / completed, preservation, refused | mode/package/removal after-image |
| Purge preparation | CLI | exact installation and every resolved claim/artifact/tombstone gate; expected absence of conflicting purge operation; command/effect idempotency authority | exact purge preview/confirmation | purge-operation identity/initial revision allocated with intent before effect / completed or refused | removal after-image |

### 5.5 Results, acknowledgements, snapshots, events, and counters

- **ACV1-IPC-016** — A command record MUST transition `received` → `accepted` or `rejected`; accepted MAY transition to `pending` and then exactly one immutable `completed` or `failed` terminal outcome. Rejected, completed, and failed are terminal. Runtime-less submit-plus-resume acceptance MUST atomically install its command record, immutable Work Request, frozen launch contract, operation record, and queue membership or slot claim before entering pending startup; stage failure terminalizes the operation/command without deleting or replaying that request. Retries return the current durable record and MUST NOT repeat a non-idempotently proven effect. Results include command ID/issuance epoch, durable/global revision, operation ID where any, target identity, closed result/rejection code, and safe diagnostics.

- **ACV1-IPC-025** — The three acknowledgement contracts MUST remain distinct:

| Acknowledgement | Issuer → receiver | Attests | Cumulative | Lost-ack reconnect | Eviction/retirement |
|---|---|---|---|---|---|
| client event-stream ack | Terminal/CLI client → Supervisor | snapshot installed and every event through client stream sequence applied | yes, within one Supervisor process epoch | resend suffix strictly after the client event-stream acknowledgement watermark if retained; otherwise fresh snapshot | client event-stream acknowledgement watermark may retire after disconnect/session expiry; events retire only after all eligible clients pass them or 4,096-window eviction forces resnapshot |
| Runtime-fact/checkpoint ack | Supervisor → Runtime bridge | facts/checkpoint through Runtime bridge sequence durably committed and projected | yes, within one Agent/Runtime epoch | Runtime resends strictly after its Runtime checkpoint acknowledgement watermark or supplies a checkpoint snapshot; duplicates return the same Runtime checkpoint acknowledgement watermark | checkpoint/facts retire only after cumulative ack plus 7 days and no recovery reference |
| command/external-operation ack | command issuer/effect peer ↔ durable owner | command intent/result or exact effect/checkpoint installed durably, as identified by command/effect ID | no | reconnect queries/resends same ID and receives current durable record; effect repeats only with idempotent proof | unresolved retained until terminal; terminal 30 days; then compact reuse tombstone; operation evidence until every recovery/removal gate passes |

- **ACV1-IPC-017** — An authoritative snapshot MUST include Supervisor/root/process epoch, mode, versions/capabilities, durable/global and snapshot identity/revision/sequence, configuration generation/revision and the complete non-secret current configuration projection—including `concurrencyLimit`, terminal/desktop notification preferences, and notification preference revision—and client stream sequence; every Agent identity/revision, Conversation identity/binding revision, latest authoritative Conversation-scoped model/thinking values or explicit absence, name/pin/archive/project/status/reason/phase after-image; Runtime condition, current or last Runtime epoch, current Runtime revision where any, Runtime checkpoint identity and exact Runtime checkpoint acknowledgement watermark; pending or interrupted Work Request identity/revision, phase, frozen configuration or resume-start metadata, start-operation identity/revision, queue entry or slot claim identity, lineage and retry-payload availability/hash/size (never content); active/settled Work Cycle identity/revision and outstanding/cancelled/resolved Interaction identity/revision, Interaction schema revision, resolution identity/revision and reply-operation state; every operation identity/revision/phase; complete queue order/revision/slot claims; Terminal Client identities/revisions, attachments, each sticky Dispatch Target value/revision, and Input Lease owner/generation/uncertainty; Workspace Claim identities/revisions/reservations/conflicts and preserved or missing artifact identities/revisions; and package/migration/backup/notification health without secrets. A snapshot includes every committed fact through its client stream sequence; resume begins strictly after that client stream sequence.

- **ACV1-IPC-026** — The committed event catalogue MUST use the following logical families and after-images; concrete event names and wire fields remain private.

| Logical committed fact | Authorized publisher/source | Required target identities and fences/revisions | Payload metadata / durable install | Required after-image |
|---|---|---|---|---|
| Supervisor mode changed | Supervisor domain from readiness/recovery evidence | installation, Supervisor process epoch, durable/global revision | closed mode/reason installed atomically | current mode, authority and health |
| configuration installed | Supervisor domain from accepted config command | configuration generation, durable/global revision, configuration revision, and notification preference revision where affected | digest and complete non-secret settings installed in agreeing files | full current configuration projection, including `concurrencyLimit` and terminal/desktop notification preferences |
| migration committed | Supervisor migration journal | old/new schema versions and configuration generations, external operation identity/revision | paired manifest and invariant result installed | schema/config/package health |
| package/removal state changed | Supervisor handoff/package journal | installation, package identity, Supervisor process epoch, external operation identity/revision | closed package/removal phase installed | mode/package/removal health |
| Agent registered/created | Supervisor domain from Registration/New/Dispatch/Adopt | Agent identity/revision, Conversation identity/binding revision, Workspace Claim identity/revision, configuration revision, durable/global revision | identity/config metadata installed atomically | complete Agent identity/projection |
| Agent metadata changed | Supervisor domain from accepted organization command | Agent identity/revision and configuration revision | validated name/pin/archive metadata installed | complete Agent after-image |
| Agent deleted | Supervisor deletion journal | Agent, Conversation hash and deletion revision | tombstone installed before removal | removed identity plus content-free tombstone |
| Runtime binding/condition changed | Supervisor from accepted Registration/operation or Runtime fact | Agent identity/revision, Conversation identity/binding revision, Runtime epoch/revision, process/tmux identities and Runtime bridge sequence | exact binding/condition installed | Runtime and Agent projection |
| checkpoint advanced | Supervisor from authenticated Runtime bridge | Agent, Runtime epoch and Runtime bridge sequence | checksummed Runtime checkpoint acknowledgement watermark durably installed | cumulative Runtime checkpoint acknowledgement/projection |
| Work Request changed | Supervisor command/bridge/reboot projection | Agent identity/revision, Work Request identity/revision, Runtime epoch/revision where any, durable/global revision | phase and content-free integrity/availability metadata installed | immutable request phase/lineage after-image |
| Work Cycle changed | Supervisor from authenticated Runtime fact or stop/reboot intent | Agent identity/revision, Runtime epoch/revision, Work Cycle identity/revision, operation identity/revision where any | active/blocking/settlement metadata installed | cycle phase/outcome and Agent projection |
| Interaction changed | Supervisor from authenticated Runtime fact or accepted Reply | Agent identity/revision, Runtime epoch/revision, Work Cycle identity/revision, Interaction identity/revision, Interaction schema revision, resolution identity/revision where any | schema-safe metadata and reply operation state installed | outstanding/resolved/cancelled after-image |
| queue changed | Supervisor scheduler from accepted command/domain transition | queue revision and stable entry/request/cycle identities | complete affected ordering installed | full queue order/revision |
| slot changed | Supervisor scheduler from authoritative lifecycle fact | Agent identity/revision, Work Request or Work Cycle identity/revision, slot claim identity, queue revision, durable/global revision | claim/release reason installed atomically with queue/work state | complete slot ownership after-image |
| Terminal Client presentation or Dispatch Target changed | Supervisor from authenticated console connection/transition/target command | Terminal Client identity/revision, applicable Agent identity/revision and Runtime epoch/revision, and Dispatch Target revision where affected | attachment/activity metadata or complete sticky target installed | complete client presentation/backgrounding/Dispatch Target after-image |
| Input Lease changed | Supervisor lease domain from accepted transition/evidence | Terminal Client identity, Agent identity/revision, Runtime epoch/revision, Input Lease generation | holder/uncertainty subtype installed | lease authority and attachment after-image |
| Workspace Claim changed | Supervisor workspace journal from exact observation | Agent identity/revision, Workspace Claim identity/revision, canonical repo/path/base and operation identity/revision where any | phase and verified evidence digest installed | claim/operation after-image |
| Workspace Conflict changed | Supervisor workspace reconciliation | Agent identity/revision, Workspace Claim identity/revision and all competing canonical identities with their exact applicable rows | conflict/repair evidence installed without guessed selection | conflict or verified-ready after-image |
| preserved or missing workspace artifact changed | Supervisor workspace/removal journal | workspace artifact identity/revision, originating Agent identity, canonical path/repo | content-free disposition manifest installed | artifact/claim after-image |
| external operation changed | Supervisor operation journal | command/effect identity, target identities and operation identity/revision | ordered phase/observation/outcome installed | operation and affected domain after-image |
| command result changed | Supervisor command domain | command ID, issuance epoch, target identities and durable/global revision | current state/result code installed | immutable terminal or current pending record |
| Notification Intent/delivery changed | Supervisor notification domain/adapter acknowledgement | Notification Intent identity, eligible transition/Interaction identity and notification preference revision | content-minimized eligibility/channel result installed | dedup/delivery/retry/health after-image |

- **ACV1-IPC-014** — Events MUST describe committed domain facts, never optimistic UI state. Each carries Supervisor process epoch, client stream sequence, durable/global revision, every applicable entity revision named by its ACV1-IPC-026 row, relevant stable identities, and resulting safe projection; there is no separate ambiguous “domain revision.”
- **ACV1-IPC-015** — A client MUST build current truth from one snapshot plus a gap-free event suffix. It MUST replace, not heuristically merge, stale local state after resnapshot.

- **ACV1-IPC-027** — Counters and identities MUST satisfy this matrix:

| Counter/identity | Owner and scope | Persistence | Increment/allocation point | Comparison |
|---|---|---|---|---|
| installation identity | Supervisor installation bootstrap, one Agent Console Data Root | durable until explicit full purge; retained in paired backups and recovery evidence | once before the installation first serves or mutates state | opaque equality only; never reused for a later installation |
| canonical Pi-root binding identity | Supervisor, one installation | durable in configuration/registry agreement and recovery evidence | once at initial bind or explicit safe rebind after canonicalization | exact canonical identity equality only; a rebind installs a different never-reused binding identity |
| Supervisor process epoch | singleton Supervisor process | durable last allocation | initial bootstrap allocation, or in the accepted Supervisor-handoff reservation for its successor, always before that process serves IPC | equality; change invalidates stream resume |
| OS process-start identity | Host process adapter, per process incarnation | durable in Runtime/operation/recovery evidence while referenced | obtained from the OS before process authority is accepted; PID alone is not this identity | opaque exact equality only within its OS-defined scope; PID reuse cannot compare equal |
| tmux server/session/pane identity | private tmux fabric, per created fabric object | durable in Runtime/operation/recovery evidence while referenced | once when the exact server, session, or pane is created and before authority is accepted | opaque exact equality as the complete qualified tmux target; names or pane numbers alone are insufficient |
| command issuance epoch | authenticated command issuer, per durable issuer identity | durable last allocation at issuer and in every accepted command record/tombstone | before an issuer incarnation emits any command | exact equality as half of the command key; no cross-epoch freshness inference |
| command ID | authenticated command issuer, installation-wide across that issuer's epochs | issuer retry state plus Supervisor command record; content-free tombstone after outcome retirement | once before first transmission of one logical command | equality together with issuance epoch; reuse under the same or another epoch is rejected |
| client stream sequence | Supervisor, per process epoch | replay window plus the client event-stream acknowledgement watermark for each eligible client | each committed emitted fact | unsigned monotonic within the process epoch; resume strictly greater than the matching client event-stream acknowledgement watermark |
| client event-stream acknowledgement watermark | authenticated Terminal/CLI client, per client identity and Supervisor process epoch | retained transiently by the Supervisor for reconnect until client retirement or replay-window eviction | advances only after the client installs the snapshot and applies every fact through the named client stream sequence | cumulative comparison only against client stream sequence in the same Supervisor process epoch; epoch change invalidates it |
| durable/global revision | Supervisor registry, installation | durable | each committed domain transaction | higher includes earlier; no gaps assumed by clients |
| snapshot identity/revision/sequence | Supervisor, per frozen snapshot within one process epoch | durable source revision and sequence; snapshot identity and frozen tuple transient until installation or discard | once at snapshot freeze, before any chunk emission | install the exact identity/revision/sequence tuple; events start strictly after its sequence |
| snapshot chunk ordinal | Supervisor, per exact snapshot identity/revision/sequence tuple | transient with that tuple's chunks until installation or discard | zero through total-minus-one, allocated consecutively before each chunk emission | unsigned ordinal order only inside the tuple; accept exactly the complete contiguous range beginning at zero |
| Agent identity | Supervisor, one installation | durable through Agent lifetime and deletion tombstone | once in the atomic Register/New/Dispatch/Adopt creation transaction | opaque equality only |
| Agent revision | Supervisor, per Agent | durable | each committed Agent after-image mutation | expected equality; larger is ordered only within that Agent |
| Conversation identity | Pi, one canonical Pi root | durable in Pi and in the Supervisor binding or deletion tombstone hash | once when Pi creates or reserves the Conversation, before Agent binding | opaque equality only |
| Conversation binding revision | Supervisor, per Agent-to-Conversation binding | durable through Agent lifetime and deletion tombstone | initial binding/reservation commit and each authoritative writer-lease, ownership, or deletion-disposition mutation; the Conversation identity itself never changes for a live Agent | expected equality; larger is ordered only within that binding |
| Conversation-writer lease identity/generation | Pi, per Conversation and writer-ownership episode | durable in Pi lease evidence and the Supervisor binding while authoritative or referenced by recovery | once before opening/adopting a writable Conversation and advanced on each authoritative ownership replacement/revocation | exact equality only for the named Conversation; stale or competing evidence conflicts and never orders ownership by magnitude |
| Work Request identity | Supervisor, per Agent | durable through request retention and Agent deletion | once when Dispatch, Submit work, or Retry work is atomically accepted | opaque equality only |
| Work Request revision | Supervisor, per Work Request | durable | each committed phase, lineage, or retained-payload-availability mutation | expected equality; larger is ordered only within that request |
| Work Payload identity | accepting Terminal Client with Supervisor validation, per materialized request/response payload | durable spool binding until byte erasure; content-free identity/integrity disposition thereafter while referenced | once before spool materialization and command acceptance | opaque equality plus exact integrity/size equality; never identifies content by value |
| Work Cycle identity | Supervisor or authorized Runtime, within exact Agent/Runtime epoch | durable in Runtime checkpoint and Supervisor registry | once when the Runtime authoritatively accepts a Work Request | opaque equality only |
| Work Cycle revision | Supervisor, per Work Cycle, reconciled with its authoritative Runtime checkpoint | durable; every Runtime-originated mutation is checkpointed before publication and then installed durably by the Supervisor | initial Runtime acceptance and each committed lifecycle, queue-membership, Interaction-blocking, continuation, or settlement mutation | expected equality; larger is ordered only within that Work Cycle |
| Interaction identity | authorized Runtime, within exact Agent/Runtime epoch and Work Cycle | durable in Runtime checkpoint and Supervisor registry | once before publishing the authoritative Interaction request | opaque equality only |
| Interaction revision | Supervisor, per Interaction, reconciled with the authoritative Runtime checkpoint | durable in Supervisor registry and checkpointed for Runtime-originated mutations | initial authoritative publication and each authoritative phase or outstanding-set membership mutation | expected equality; larger is ordered only within that Interaction; distinct from schema and resolution revisions |
| Interaction schema revision | authorized Runtime, per Interaction | checkpointed and durable in Supervisor registry | initial schema publication and each authoritative schema replacement before any answer reservation | expected equality; larger is ordered only within that Interaction |
| Interaction resolution identity | authenticated replying Terminal Client, scoped to exact Agent/Runtime/Work Cycle/Interaction | durable in the command/reply-operation record and Runtime checkpoint once delivered | once before submitting one logical response; the Supervisor reserves only the first acceptable resolution | opaque equality only |
| Interaction resolution revision | Supervisor, per reserved Interaction resolution | durable | atomic `answer_pending` reservation and each later resolving/terminal phase commit | expected equality; phases never regress |
| queue revision | Supervisor scheduler, one installation-wide queue | durable | each membership, order, or slot transaction | expected equality; larger is queue ordering only |
| queue entry identity | Supervisor scheduler, per waiting-membership episode | durable through removal and retained command/event recovery evidence | once in the atomic transaction admitting a request or continuation to `waiting` | opaque equality only; never a row number and never reused |
| slot claim identity | Supervisor scheduler, per slot-ownership episode | durable through release and retained lifecycle/recovery evidence | once in the atomic transaction that removes waiting membership and claims a slot, or directly claims a free slot at admission | opaque equality only; never reused or transferred except from its request to the Work Cycle named by the same claim |
| Terminal Client identity | Supervisor, one installation and one connected terminal presentation | durable while referenced by attachment, lease, command, or recovery evidence | once after authenticated connection and before snapshot, attachment, or command authority | opaque equality only |
| Terminal Client revision | Supervisor, per Terminal Client | durable while the client identity is retained | each committed attachment, presentation, activity, or Dispatch Target mutation | expected equality; larger is ordered only within that client |
| Dispatch Target revision | Supervisor, per Terminal Client | durable while that Terminal Client identity is retained; survives its Attach/Detach presentation changes | initial target installation before command authority and each accepted deliberate sticky-target change; selection, filtering, grouping, and one-shot `cwd` do not increment it | expected equality; larger is ordered only within that Terminal Client |
| Input Lease generation | Supervisor, per Agent | durable | grant, revoke, completed transfer fence, or reboot revocation | exact equality for native input and control-plane Submit work/Interaction lease-conflict fencing |
| canonical workspace/repository evidence identity | Supervisor workspace service, per exact canonical repo/path/base observation | durable in the Claim/operation/artifact evidence that references it | derived and sealed after canonicalization and before reservation or destructive revalidation | exact equality of the complete canonical identity and evidence digest; paths, branches, or timestamps alone are insufficient |
| Workspace Claim identity | Supervisor, one installation and Agent | durable through claim disposition and retained recovery/artifact evidence | once when reservation commits, before workspace mutation | opaque equality only |
| Workspace Claim revision | Supervisor, per Workspace Claim | durable | each committed claim phase, evidence, conflict, or disposition mutation | expected equality; larger is ordered only within that claim |
| preserved or missing workspace artifact identity | Supervisor workspace/removal journal, per independently preserved checkout or missing-registration artifact | durable through originating Agent deletion and through exact Unlock and Forget; content-free disposition evidence remains while referenced | once in the same transaction that preserves/releases a checkout or commits Workspace Abandonment | opaque equality only; never reused, including after Forget |
| preserved or missing workspace artifact revision | Supervisor, per preserved or missing workspace artifact | durable through Unlock and Forget and its retained content-free disposition evidence | initial artifact allocation and each committed lock, evidence, ownership/disposition, or Forget mutation | expected equality; larger is ordered only within that artifact |
| package identity | package/handoff journal, per exact installed or candidate package artifact | durable through handoff/removal/recovery evidence | obtained from verified package provenance, version, and artifact integrity before package authority is accepted | exact equality of the verified package identity; version text alone is insufficient |
| backup manifest identity | Supervisor backup domain, per paired SQLite/config backup | durable for the manifest's retention lifetime and any restore/recovery evidence | once after both snapshots are sealed and before the paired backup is eligible | opaque equality plus exact manifest hash/schema/configuration-generation equality |
| configuration generation | Supervisor config/registry pair, installation | durable in both and migration journal | atomic config replacement agreement | expected equality as the exact configuration identity |
| configuration revision | Supervisor, installation | durable | each committed non-secret configuration mutation or paired-generation install | expected equality; larger is installation ordering only |
| external operation identity | Supervisor operation journal, per external operation | durable through acknowledgement and every applicable recovery/removal retention gate | once in the initial command's durable acceptance/reservation transaction, together with the initial operation revision and before intent or external effect | opaque equality only; never reused |
| operation revision | Supervisor, per external operation identity | durable | initial revision in the same acceptance/reservation transaction that allocates the operation identity, then each later ordered phase commit | expected equality; phases never regress |
| effect identity | Supervisor operation journal, per externally attempted idempotent effect | durable with its external operation and recovery evidence | once before the exact effect is first attempted | opaque equality only; retry/redelivery uses the same identity and a different effect never does |
| transition identity | Supervisor command/operation domain, per Attach/Detach/Handoff/Takeover transition | durable with its command and any operation evidence | once in the initial durable transition-reservation transaction, before any transition effect | opaque equality only; retry/reconciliation uses the same identity |
| transition revision | Supervisor, per transition identity | durable with its command and any operation evidence | initial revision in the same transaction that allocates the transition identity, then each committed transition phase/evidence mutation | expected equality; larger is ordered only within that transition and phases never regress |
| deletion revision | Supervisor deletion journal, installation | durable including content-free tombstones | each committed deletion-journal transaction, including tombstone installation | expected equality; larger is deletion-journal ordering only |
| notification preference revision | Supervisor, installation-wide user preferences | durable in the agreeing config/registry state | initial disabled-default installation and each committed notification-preference mutation | expected equality; larger is preference ordering only |
| Notification Intent identity | Supervisor notification domain, per eligible transition/Interaction and channel-independent intent | durable through delivery/retry/health retention | once when the eligible committed fact first creates its globally deduplicated intent | opaque equality only; the same transition/Interaction cannot allocate another intent |
| Runtime epoch | Supervisor, per Agent | durable | accepted new Runtime allocation | exact equality; larger only by authoritative allocation |
| Runtime revision | Supervisor, per Runtime epoch | durable in registry and reconciled checkpoint evidence | Runtime allocation and each committed binding, condition, checkpoint-acknowledgement, or termination mutation | expected equality within the exact Runtime epoch; larger is ordered only there |
| Runtime bridge sequence | Runtime, per Runtime epoch | checkpointed | each checkpointed fact | cumulative monotonic within that Runtime epoch; gap requires snapshot |
| Runtime checkpoint acknowledgement watermark | Supervisor acknowledgement retained by Runtime and Supervisor, per Agent/Runtime epoch | checkpointed and durable while facts or recovery references require it | advances only after the Supervisor durably commits and projects every Runtime fact through the named Runtime bridge sequence | cumulative comparison only against Runtime bridge sequence in the same Agent/Runtime epoch; reconciliation retains the exact value and never invents or advances Runtime bridge sequence |
| Runtime checkpoint identity | authorized Runtime, per atomic checkpoint within one Runtime epoch | checkpointed and retained durably while acknowledged facts or recovery references require it | once for each atomic checkpoint publication, before announcing any fact it protects | opaque identity equality; Runtime bridge sequence supplies ordering; never reused within or across Runtime epochs |

- **ACV1-IPC-028** — Every counter, ordinal, and allocated identity in ACV1-IPC-027, numeric or opaque, MUST use a representation and exhaustion policy that prevents wrap, collision, and reuse within its stated scope. Revisions, sequences, and ordinals are compared only inside that scope; identities have equality semantics only unless a row explicitly grants ordering. Snapshot chunk ordinal exhaustion MUST abort and discard that frozen snapshot tuple before the exhausted ordinal's emission and require a newly frozen snapshot; it MUST NOT wrap, truncate, or reuse an ordinal.

### 5.6 Error and event families

- **ACV1-IPC-018** — Rejection/error codes MUST be closed and versioned. Initial families are `invalid_request`, `unauthenticated`, `unauthorized_role`, `root_mismatch`, `unsupported_version`, `capability_missing`, `stale_revision`, `stale_epoch`, `stale_lease`, `not_found`, `state_conflict`, `precondition_failed`, `payload_too_large`, `payload_changed`, `trust_unresolved`, `workspace_conflict`, `publication_unknown`, `supervisor_unavailable`, `read_only`, `preservation_mode`, `operation_pending`, `timeout`, and `internal_error`. Unknown codes MUST fail closed and retain safe diagnostic prose.
- **ACV1-IPC-019** — Event families MUST cover Supervisor mode/health, Agent identity/projection, Runtime/checkpoint, Work Request/Work Cycle/Interaction, Work Queue/slot, Input Lease/client, workspace/operation/artifact, configuration, migration/package, and notification health. Clients MUST NOT infer a missing event family from unrelated facts.

## 6. Host Conformance and Pi boundary

- **ACV1-HOST-007** — A Pi minor is compatible only when documented public types implement every capability in this closed list:

1. **guarded pre-interactive bootstrap/re-exec** for trusted user-global extensions, before session/turn/TUI/raw mode, with source provenance and loop prevention;
2. **mediated Interaction lifecycle** with stable Interaction IDs, response schemas, pre-resolution authorization, external resolution by ID, acknowledgement, requested/resolved/cancelled facts, and authoritative outstanding-Interaction snapshot, with no supervised native mediation bypass;
3. **arbitrary-target project-trust resolver** preserving Pi's temporary-versus-remembered behavior without direct `trust.json` access;
4. **Conversation-writer lease** acquired before opening/adopting a saved Conversation and honored by compatible Pi writers.

- **ACV1-HOST-001** — These capabilities MUST be generic, documented, and package-independent. Pi MUST NOT contain Agent Console UI, commands, scheduler, Supervisor, tmux fabric, persistence, migration, or workspace policy.
- **ACV1-HOST-002** — Compatibility MUST require both an allowlisted Pi minor and successful capability semantics; capability presence alone and peer dependency resolution are insufficient.
- **ACV1-HOST-003** — Patches in an allowlisted minor MAY pass unless denied. Older/newer unqualified minors MUST fail closed while leaving ordinary Pi usable.
- **ACV1-HOST-004** — Development MAY target the versioned Host Conformance Harness. Publication MUST remain blocked until the same black-box suite passes a real public Pi release.
- **ACV1-HOST-005** — Project-local, temporary, Git-source, direct-path, `--no-session`, nested-tmux, and noninteractive invocations MUST NOT activate native supervision or mutate Agent Console state.
- **ACV1-HOST-006** — `PI_AGENT_CONSOLE=0` MUST silently bypass supervision. `/agent-console` and contextual entry, where available, MUST present actionable incompatibility information rather than a degraded substitute.

## 7. Runtime bridge and checkpoints

### 7.1 Runtime handshake and facts

- **ACV1-BRIDGE-011** — A Runtime MUST be identified by Agent identity plus a fresh Runtime epoch, Conversation identity, package/protocol version, bound Pi root, tmux identity, and process identity—never PID alone.

- **ACV1-BRIDGE-009** — Runtime bridges MUST publish the following logical facts, never status strings. Each fact carries Agent identity, Runtime epoch, Runtime bridge sequence, Runtime checkpoint identity, and the listed target identities; the Supervisor durably installs it before cumulatively acknowledging that Runtime bridge sequence.

| Runtime fact | Required target/payload metadata | Supervisor durable result and committed after-image |
|---|---|---|
| runtime ready snapshot | Conversation, process/tmux, active Cycle/accepted Request, outstanding Interaction schemas, latest authoritative Conversation-scoped model/thinking values or explicit absence, latest outcome, Runtime bridge sequence | reconciled Runtime condition/projection or closed conflict |
| work accepted | Work Request, allocated Work Cycle, delivery effect ID, payload hash/size | request `runtime_accepted`, cycle active, payload erasure authorized |
| Interaction requested | Work Cycle identity/revision, Interaction identity/revision, Interaction schema revision, privacy-safe prompt data | outstanding Interaction and Needs input after-image |
| Interaction resolved | Work Cycle, Interaction, resolution/effect ID | immutable resolved after-image |
| Interaction cancelled | Work Cycle, Interaction, closed reason | immutable cancelled historical record |
| work settled | Work Cycle, structured settlement discriminant/reason | immutable terminal cycle and Agent outcome |
| Runtime shutting down | stop/quit effect ID and closed reason | Runtime stopping/none and applicable Stopped after-image |
| Agent name changed | effect identity and validated name | Supervisor-authoritative Agent name/configuration revision or conflict |

- **ACV1-BRIDGE-010** — Supervisor-to-Runtime operations MUST follow this matrix. Each operation is durably journaled before send, carries command/effect IDs, Agent and Runtime epoch, applicable Work Request/Cycle/Interaction identity, Input Lease generation and response schema, and payload integrity metadata; Runtime acknowledgement attests the exact effect is durably checkpointed/installed. Lost acknowledgement causes query or redelivery of the same effect ID only, and duplicate delivery returns the same result without repeating the effect.

| Bridge operation | Required authority and target | Terminal acknowledgement / emitted fact |
|---|---|---|
| deliver work | exact accepted command/effect reservation, Agent/Conversation binding, Runtime epoch/revision, Work Request identity/revision, frozen configuration, hash/size; acceptance-time lease authority for attached native submission or acceptance-time no-conflicting-holder proof for live control-plane submission; Runtime-less startup needs no lease | exactly one `work accepted` with allocated Work Cycle identity/revision, or closed refusal |
| resolve Interaction | exact accepted command, Agent/Runtime/Cycle/Interaction/schema/resolution reservation and current target lease generation; inline control-plane delivery grants no native input | exactly one `Interaction resolved/cancelled` acknowledgement, or still-outstanding snapshot |
| stop/abort Work Cycle | exact Cycle/Runtime and graceful effect ID | structured settled/abort fact or timeout record |
| stop Runtime / session quit | exact Runtime/process/tmux and effect ID | shutting-down/checkpoint and verified exit |
| lease-fenced native input | exact Agent/Runtime/client/lease generation and input command ID | checkpointed accepted/rejected input command result |
| synchronize Agent name | exact Agent/Runtime/name/config generation and effect ID | checkpointed name installed or closed conflict |

- **ACV1-BRIDGE-001** — Every fact MUST carry Agent identity, Runtime epoch/revision, Runtime bridge sequence, and relevant Work Cycle, Work Request, Interaction, resolution, command, or effect identities and revisions. A Work Request already accepted by either control-plane Submit work path is ordinary scheduler authority: delivery MUST NOT Attach, grant a lease, require a newly acquired lease, or reinterpret it as native editor input. Runtime acceptance is checkpointed exactly once by Work Request and delivery effect identity.
- **ACV1-BRIDGE-002** — Old epochs and duplicates MUST be ignored with the current Runtime checkpoint acknowledgement watermark; a Runtime bridge sequence gap MUST require a bridge snapshot, never interpolation.
- **ACV1-BRIDGE-003** — Runtime delivery of an Interaction answer MUST be authorized by a Supervisor command and fenced by target Agent identity/revision, Runtime epoch/revision, Work Cycle identity/revision, Interaction identity/revision, command ID/issuance epoch, the allocated resolution identity/revision, exact response schema and Interaction schema revision, and current Input Lease generation before Pi resolves it. For inline scalar/finite-choice Reply, the initial client command supplied the resolution identity with an expected-absence fence; the Supervisor's durable `answer_pending` transaction allocated its initial revision and proves control-plane authority when the target was unleased or held by the calling Terminal Client at acceptance. Its lease generation is a conflict fence, not a lease grant. The bridge and Pi MUST accept and acknowledge at most one resolution across native and control-plane paths, and lost acknowledgement MAY redeliver only the same reserved effect. Rich/editor resolution remains native and requires Attach plus the actual Input Lease holder.
- **ACV1-BRIDGE-004** — Pi's structured settlement boundary, after retries/compaction/continuations, MUST determine outcome. Agent end, terminal silence, output text, or tool errors MUST NOT.

### 7.2 Runtime checkpoint

- **ACV1-BRIDGE-012** — Each Runtime epoch MUST atomically replace only its own versioned checksummed checkpoint. It contains Runtime checkpoint identity, Runtime revision, Runtime bridge sequence, accepted Work Cycle/Request identities and revisions, outstanding Interaction identities/revisions/schemas, latest settled outcome, shutdown/abort intent, and Runtime checkpoint acknowledgement watermark—never Conversation or payload content.

- **ACV1-BRIDGE-005** — A fact MUST be checkpointed before it is announced when losing it could change projected status or exactly-once behavior.
- **ACV1-BRIDGE-006** — Reconciliation MUST compare Agent and Runtime checkpoint identities, Runtime epoch, Runtime bridge sequence, Work Cycle, terminal outcome, and Runtime checkpoint acknowledgement watermark rather than timestamps.
- **ACV1-BRIDGE-007** — Identity mismatch, regression, or competing outcomes MUST preserve all evidence and enter `ownership_conflict` or `outcome_unknown`; a matching newer checkpoint MAY roll forward.
- **ACV1-BRIDGE-008** — A clean process exit without matching quit/stop intent MUST be Failed `unexpected_exit`; temporary retries and individual tool errors remain Working when Pi continues and settles normally.

## 8. Domain state models

### 8.1 Identity and cardinality

- **ACV1-STATE-001** — An Agent has exactly one Conversation for its lifetime and at most one live Runtime; a Conversation MAY be unowned before Adoption or after Permanent delete.
- **ACV1-STATE-002** — Every Agent, including queued, archived, Failed, Stopped, Completed, and Runtime-less Agents, remains a durable identity until Permanent delete.
- **ACV1-STATE-003** — A Work Cycle belongs to one Agent/Runtime epoch, accepts at most one terminal outcome, and MAY contain model turns, tools, retries, compaction, steering, follow-ups, and Interaction pauses.
- **ACV1-STATE-004** — An Agent MUST have at most one pending Work Request and one Work Queue entry. It MAY have multiple outstanding Interactions.

### 8.2 Agent Status

- **ACV1-STATE-035** — Agent Status is the following closed projection set:

| Status | Meaning |
|---|---|
| Starting | startup or authoritative recovery incomplete |
| Working | autonomous continuation pending or active |
| Needs input | ready for a prompt or blocked by explicit Interaction(s) |
| Completed | latest Work Cycle settled without unrecovered operational failure, cancellation, or Interaction |
| Failed | unintended operational fault prevents trustworthy supervised continuation |
| Stopped | deliberate halt authoritatively confirmed |

- **ACV1-STATE-036** — Starting phase/reason combinations and their guards MUST follow this matrix:

| Starting phase | Allowed reasons | Entry guard | Exit evidence |
|---|---|---|---|
| queued | new, resume, adopt | accepted start waiting for slot | durable slot claim or cancellation |
| provisioning | new, resume, adopt | slot/claim reservation and frozen configuration | verified workspace ready or exact failure |
| launching | new, resume, adopt | verified claim/config and allocated Runtime epoch | verified process/tmux start or exact failure |
| connecting | new, resume, adopt | matching process exists; bridge/Registration incomplete | atomic successful Registration/Rejoin or exact failure |
| dispatching | new, resume, adopt | Runtime ready; promptless start or work delivery pending | ready-for-prompt, Runtime work acceptance, or exact failure |
| recovering | reconcile | authority uncertain or reboot/start reconciliation active | exact reconciled projection or preserved conflict/failure |

- **ACV1-STATE-037** — Agent Status projection MUST apply this precedence:

1. uncertain authority → Starting `recovering`;
2. incomplete startup → Starting unless blocked by Interaction;
3. any open Interaction → Needs input;
4. autonomous continuation pending/active → Working;
5. latest confirmed outcome → Completed, Failed, or Stopped;
6. ready without work/outcome → Needs input `ready_for_prompt`.

- **ACV1-STATE-038** — Status transitions MUST follow this guarded matrix in addition to projection precedence; absent guard evidence the transition is forbidden:

| From | To | Required guard |
|---|---|---|
| any status | Starting | accepted new start/recovery intent, or lost authority requiring reconciliation |
| Starting, Completed, Failed, Stopped | Working | exact same-epoch active/pending Work Cycle; Failed/Stopped require already-live trustworthy Runtime |
| Starting, Working, Completed, Failed, Stopped | Needs input | Runtime ready for prompt or at least one authoritative outstanding Interaction; Failed/Stopped require already-live trustworthy Runtime |
| Starting, Working, Needs input | Completed | structured settlement; Starting only when reconciliation proves settlement |
| Starting, Working, Needs input, Completed, Stopped | Failed | exact unintended operational failure/conflict evidence |
| Starting, Working, Needs input, Completed, Failed | Stopped | acknowledged deliberate queue/work/Runtime/session/policy/reboot halt |

- **ACV1-STATE-005** — Any status MAY enter Starting `recovering` when authority is lost. Historical status MAY be shown with a timestamp but MUST NOT be presented as current.
- **ACV1-STATE-006** — Needs input MUST remain while any Interaction remains. Only resolution of the final blocking Interaction MAY produce Working/answered-continuation queueing.
- **ACV1-STATE-007** — Failed or Stopped MUST NOT transition directly to Completed; verified recovery mediates through Starting.
- **ACV1-STATE-008** — Completed is operational settlement, not semantic success. A normal answer reporting inability remains Completed.
- **ACV1-STATE-009** — Completed, Failed, and Stopped are latched until a meaningful later event. `lastWorkOutcome` MUST survive later status changes.
- **ACV1-STATE-010** — Archive and pending operations are not Agent Status values.
- **ACV1-STATE-026** — Starting MAY reach Completed directly only when reconciliation proves work settled while events were unavailable.
- **ACV1-STATE-027** — Failed or Stopped MAY reach Working/Needs input directly only with an already-live trustworthy Runtime; otherwise recovery passes through Starting.
- **ACV1-STATE-028** — Same-status changes to phase, reason, timestamps, operation progress, or Interaction set are projection updates, not lifecycle transitions.

- **ACV1-STATE-039** — Status Reason values MUST be closed to these families, and unknown reason codes MUST fail closed:

- Starting: phase plus `new`, `resume`, `adopt`, `reconcile`;
- Needs input: `ready_for_prompt`, `interaction_requested`;
- Completed: `settled`;
- Failed: `provisioning_failed`, `launch_failed`, `handshake_failed`, `protocol_mismatch`, `run_error`, `output_limit`, `unexpected_exit`, `bridge_lost`, `outcome_unknown`, `protocol_invariant`, `ownership_conflict`, `launch_environment_lost`, `stop_timeout`;
- Stopped: `queue_cancelled`, `turn_aborted`, `runtime_stopped`, `session_quit`, `policy_stopped`, `system_restarted`.

### 8.3 Runtime Condition and Supervisor Mode

- **ACV1-STATE-040** — Runtime Condition transitions MUST follow this guarded matrix independently of Agent Status:

| From | To | Guard |
|---|---|---|
| none | starting | durable Runtime epoch/start intent allocated |
| starting | live | successful atomic Registration/Rejoin and bridge-ready snapshot |
| starting | unreachable | bounded handshake/reconciliation lacks authority but process may exist |
| starting | none | exact failed start proves no live process |
| live | unreachable | bridge/process authority uncertain; do not infer exit |
| live | stopping | durable exact stop/quit intent |
| unreachable | live | exact same-epoch bridge/process reconciliation |
| unreachable | stopping | exact-target stop authorized |
| unreachable | none | authoritative disconnect/exit evidence |
| stopping | none | verified same-epoch exit |
| stopping | live/unreachable | stop lost race/failed; exact current evidence selects condition |

- **ACV1-STATE-041** — Supervisor Mode and command authority MUST follow this closed matrix:

| Mode | Mutation authority |
|---|---|
| starting | none until lease/state/probes succeed |
| ready | normal commands |
| recovering | only safe reconciliation and exact-target controls |
| read-only | inspection, diagnostics, exact-target safety only |
| preservation | observation and diagnostics; exact Stop/Emergency stop and the diagnostic evidence writes needed to record them; no ordinary new mutation |

- **ACV1-STATE-011** — Global Supervisor failure MUST NOT rewrite every Agent Status. Disconnected is a client condition, not a Supervisor Mode.
- **ACV1-STATE-012** — Failed MAY coexist with a live Runtime; Stopped MAY coexist with a live Runtime after aborting only work.
- **ACV1-STATE-042** — Supervisor Mode transitions MUST follow this guarded matrix; no other transition is permitted:

| From → to | Required durable evidence |
|---|---|
| starting → ready | singleton/root/config/registry/probes/reconciliation all succeed |
| starting/ready → recovering | identified reconcilable authority uncertainty |
| starting/ready/recovering → read-only | integrity, schema, migration, configuration-pair, or invariant failure |
| starting/ready/recovering/read-only → preservation | direct package removal or retained-state package absence |
| recovering/read-only/preservation → ready | identified fault durably repaired and every readiness invariant revalidated |
| ready → starting | only a completed Supervisor handoff to a newly allocated process epoch |

Exact Stop, Emergency stop, and diagnostic evidence writes remain authorized where the mode matrix allows them.

### 8.4 Work Request and payload

- **ACV1-STATE-013** — Work Request text MUST be normalized UTF-8 no larger than 256 KiB. Whitespace-only text without attachments is empty and MUST NOT Dispatch.
- **ACV1-STATE-014** — A Work Request MUST contain no more than 16 attachments, each no larger than 10 MiB and no more than 50 MiB aggregate.
- **ACV1-STATE-015** — Acceptance MUST reject directories/symlinks/devices/unreadable files, copy regular-file bytes, and verify identity/content did not change during materialization. For New and Dispatch, relative attachment references resolve against the effective target as already defined by their frozen start configuration. For every live control-plane, Runtime-less, or attached-native Submit work path targeting an existing Agent, they MUST instead resolve at preflight against that Agent's exact current Agent Workspace path under its Workspace Claim—not the calling Terminal Client's Dispatch Target, a native process working directory, or another Agent—and MUST be copied and revalidated before acceptance.
- **ACV1-STATE-016** — Accepted Work Requests are immutable. Additional work while one is pending MUST be rejected; changing intent requires cancellation and a new command.
- **ACV1-STATE-017** — Once Pi authoritatively accepts a Work Request or Interaction response, Supervisor-owned payload bytes MUST be erased. Interrupted Supervisor-accepted but Runtime-unaccepted Work Request bytes remain only for Retry work, Discard retry data, or Permanent delete.
- **ACV1-STATE-018** — Inline Interaction text responses MUST be normalized UTF-8 no larger than 256 KiB and MUST NOT carry attachments. Finite choices MUST use an option identity from the authoritative response schema.
- **ACV1-STATE-043** — Unbound or incompletely bound payload bytes MUST remain quarantined inside the protected Work Payload Spool for exactly one 30-second reconciliation window. Only an exact durable payload/request-or-resolution binding with matching integrity metadata MAY restore them. At expiry, or on mismatch, bytes MUST be erased and only content-free hash, size, creation/quarantine/erasure timestamps and disposition retained. No quarantined bytes may be dispatched, exported, backed up, logged, or moved outside the spool.
- **ACV1-STATE-029** — An accepted Interaction response awaiting Pi acknowledgement MUST remain a durable exact-target operation and MAY redeliver only with the same Interaction/resolution/Runtime identities after reconciliation proves the Interaction still outstanding. A resolved/cancelled/mismatched snapshot MUST erase response bytes and commit the matching outcome or an explicit conflict, never reinterpret it as new input.

### 8.5 Operational substates

- **ACV1-STATE-019** — Work Request progression is closed to `accepted`, `queued`, `starting`, `delivering`, `runtime_accepted`, `interrupted`, or `cancelled`. Only `runtime_accepted` begins a Work Cycle and authorizes payload erasure; interruption before it retains Retry work data.
- **ACV1-STATE-020** — Work Cycle progression permits `active` ↔ `blocked`, then `settling` and exactly one `settled` outcome. A blocked cycle has one or more outstanding Interactions and no Concurrency Slot.
- **ACV1-STATE-021** — Interaction progression is `outstanding`, `answer_pending`, `resolving`, then exactly one `resolved` or `cancelled`. Every accepted exact-schema Interaction response MUST enter `answer_pending` before resolving. Resolution identity and response schema fence duplicates and stale answers.
- **ACV1-STATE-022** — Input Lease progression is `unleased`, `held`, `transition_reserved`, `uncertain`, or `revoking`. Only authoritative disconnection, successful Handoff, or completed Takeover reaches a different holder/unleased state.
- **ACV1-STATE-023** — Workspace Claim progression is `reserved`, `provisioning`, `ready`, `conflict`, or `releasing`, followed by no claim. Preserve-and-release and Workspace Abandonment create independent preserved-artifact records rather than terminal Claim phases.
- **ACV1-STATE-024** — Durable external-operation progression is `reserved`, `intent_committed`, `effect_started`, `effect_observed`, `outcome_committed`, then `acknowledged`; recovery MAY repeat observation but MUST NOT repeat an effect without exact idempotent proof.
- **ACV1-STATE-025** — Queue membership is only `waiting`; slot claim is separate authoritative state. An entry leaves the Work Queue atomically when it claims a slot, is cancelled, or becomes inapplicable and Failed.
- **ACV1-STATE-030** — A Work Request MAY move `accepted` to `queued`, `starting`, `cancelled`, or `interrupted`; `queued` to `starting`, `cancelled`, or `interrupted`; `starting` to `delivering`, `interrupted`, or acknowledged `cancelled`; and `delivering` to `runtime_accepted`, `interrupted`, or acknowledged `cancelled`. Before `runtime_accepted`, `interrupted` is allowed only by the atomic reboot projection or an exact post-acceptance launch/start-precondition failure: `launch_environment_lost`, invalid frozen configuration/trust, authoritative ownership conflict after bounded recovery, or stage failure. Retry creates a new Work Request identity rather than moving `interrupted` backward; no command retry or recovery may silently substitute or replay it.
- **ACV1-STATE-031** — A Work Cycle moves from `active` to `blocked` only on an outstanding Interaction, returns to active/queued continuation only after its final blocker resolves, and reaches `settling` only from authoritative outcome/stop/cancel intent or the atomic reboot projection. The reboot projection MAY commit `settling` and its exact terminal result in one transaction. `settled` is terminal.
- **ACV1-STATE-032** — An Interaction moves from `outstanding` to `answer_pending` only after atomically accepting exact-schema input, reserving its command/client-created resolution identity against native and control-plane duplicates, and allocating the initial Supervisor-owned resolution revision, to `resolving` only when exact Pi delivery is authorized, and to `resolved` only on acknowledgement; authoritative Pi cancellation or the atomic reboot projection MAY move any unresolved phase to `cancelled` with preserved outcome evidence. Only resolution of the final blocking Interaction queues autonomous continuation.
- **ACV1-STATE-033** — Input Lease holder changes require `transition_reserved` or `revoking`; ambiguity enters `uncertain`, from which only matching generation/tmux/bridge evidence MAY restore `held` or complete an already-authorized transfer.
- **ACV1-STATE-034** — Workspace Claim `reserved` MAY provision or end only before artifacts; `provisioning` MAY become `ready` or `conflict`; `ready` MAY become `conflict` or `releasing`; and `releasing` MAY end only after its exact disposition commits. Conflict recovery MUST revalidate the same claim identity.

- **ACV1-STATE-044** — Operational state machines MUST obey these complete guarded transition matrices; a row not listed is forbidden.

| Machine | From → to | Required guard / effect |
|---|---|---|
| Work Request | accepted → queued / starting / interrupted / cancelled | durable queue membership / slot+start claim / atomic reboot projection or exact post-acceptance `launch_environment_lost`, invalid frozen configuration/trust, ownership conflict after bounded recovery, or stage failure / cancellation wins before effect |
| Work Request | queued → starting / interrupted / cancelled | slot claim / atomic reboot projection or the same exact post-acceptance launch/start-precondition failures / cancellation wins |
| Work Request | starting → delivering / interrupted / cancelled | Runtime ready / exact `launch_environment_lost`, invalid frozen configuration/trust, ownership conflict after bounded recovery, stage failure, or atomic reboot projection / acknowledged cancellation |
| Work Request | delivering → runtime_accepted / interrupted / cancelled | matching Runtime fact / exact delivery/stage failure, ownership conflict after bounded recovery, invalid frozen configuration/trust, `launch_environment_lost`, reconciliation proving one of those failures, or atomic reboot projection / acknowledged cancellation |
| Work Request | interrupted → terminal retention only | Retry allocates a new identity; discard/delete erases eligible bytes |
| Work Cycle | active → blocked / settling | first outstanding Interaction / authoritative settlement or accepted stop |
| Work Cycle | blocked → active / settling | final blocker resolved (queue membership/slot is separate) / authoritative settlement or stop |
| Work Cycle | settling → settled | exactly one authoritative structured outcome, or Stopped `system_restarted` from the atomic reboot projection unless exact checkpoint evidence already proves a stronger terminal outcome |
| Interaction | outstanding → answer_pending / cancelled | atomic exact-schema response plus command/resolution reservation / authoritative Pi cancellation or reboot |
| Interaction | answer_pending → resolving / cancelled | exact bridge delivery authorized / authoritative cancellation or reboot |
| Interaction | resolving → resolved / cancelled | exact Runtime acknowledgement / authoritative cancellation or conflict resolution |
| Input Lease | unleased → held | atomic grant with new generation after attachment proof |
| Input Lease | held → transition_reserved / revoking / uncertain / unleased | Handoff / Takeover / heartbeat, transition, or competing evidence (subtype retained) / exact authoritative disconnect evidence |
| Input Lease | transition_reserved → held / uncertain / unleased | atomic transfer or exact source restoration / ambiguous switch / exact authoritative disconnection evidence proving no holder remains, with generation advanced |
| Input Lease | revoking → held / uncertain / unleased | old generation fenced then new grant / competing evidence / exact authoritative disconnection evidence proving no holder remains, with generation advanced |
| Input Lease | uncertain → held / unleased | exact same-generation holder or authorized transfer evidence / exact authoritative disconnect evidence; heartbeat subtype preserves confirmed-holder input while blocking new attachment, whereas transition/competing subtype fences input |
| Workspace Claim | reserved → provisioning / no claim | operation begins / no artifacts and reservation cancelled |
| Workspace Claim | provisioning → ready / conflict | exact postconditions / any mismatch |
| Workspace Claim | ready → releasing / conflict | disposition intent / observed mismatch |
| Workspace Claim | conflict → ready / no claim | verified repair revalidates same identity / committed Abandonment yields preserved missing artifact, never silent release |
| Workspace Claim | releasing → no claim / conflict | exact disposition verified and committed / mismatch |
| Operation journal | reserved → intent_committed → effect_started → effect_observed → outcome_committed → acknowledged | each transition requires its durable predecessor; observation may repeat; effect repeats only with exact idempotent proof |

- **ACV1-STATE-045** — Waiting queue membership MUST remain a separate machine: absent → waiting only on durable admission with queue revision; waiting → absent only on atomic slot claim, cancellation, inapplicability/failure, or reboot interruption. Queue position changes only under expected queue revision and does not change Work Request phase except as separately committed.

- **ACV1-STATE-047** — Runtime-less submit-plus-resume has one indivisible admission boundary. Before that commit, stale fences, non-Quiescence, non-resumability, a current Runtime, active or unsettled Work Cycle, outstanding or unresolved Interaction, pending Work Request, or unresolved operation, lease ownership, claim conflict, trust/configuration invalidity, or inability to capture a Launch Environment rejects without Agent/Conversation/request/queue/operation mutation; settled/cancelled historical records do not. The commit creates exactly one `accepted` Work Request and either moves it to `queued` with one queue entry or to `starting` with one slot/start claim, while its start operation enters `intent_committed`; the Agent becomes Starting `resume`. Startup may advance the existing request through `starting` and `delivering` only. Runtime `work accepted` alone allocates its Work Cycle, moves the request to `runtime_accepted`, and terminalizes the delivery effect exactly once. `launch_environment_lost`, invalid frozen configuration/trust, authoritative ownership conflict after bounded recovery, or stage failure before that fact moves the request from `accepted`, `queued`, `starting`, or `delivering` to `interrupted`, commits the precise failed operation/command outcome, releases queue/slot ownership, and projects Failed without changing Agent/Conversation identity. Retrying the command ID returns that same record; only explicit Retry work may allocate a successor Work Request with a fresh environment, and no recovery may substitute or replay the original request.

### 8.6 Structured settlement

- **ACV1-STATE-046** — Structured Pi settlement MUST map exactly as follows:

- `stop` → Completed;
- `length` or `error` → Failed;
- `aborted` → Stopped only with accepted user/policy intent, otherwise Failed;
- `pending` or `toolUse` at settlement → Failed `protocol_invariant`.

A Work Cycle abort wins only if acknowledged before settlement; late or duplicate terminal facts are no-ops. A later confirmed Runtime stop changes current Agent Status to Stopped without erasing the Work Cycle outcome.

## 9. Scheduling and configuration

### 9.1 Concurrency Slots and Work Queue

- **ACV1-QUEUE-001** — `concurrencyLimit` MUST be global, durable, default 4, and accept integers 1–32. V1 has no per-project limit.
- **ACV1-QUEUE-002** — Slots limit autonomous work, not Agents or Runtimes. Promptless New and inactive/live Runtimes consume no slot.
- **ACV1-QUEUE-003** — A Work Request claims a slot when provisioning/start begins; the claim transfers to its Work Cycle on `work_accepted` and persists through steering, follow-ups, retry, and compaction.
- **ACV1-QUEUE-004** — An explicit blocking Interaction releases the slot. Final settlement, confirmed startup failure/cancellation, or confirmed Runtime stop releases it. Silence, Detach, `agent_end`, or unacknowledged stop MUST NOT.
- **ACV1-QUEUE-005** — During uncertainty, slot ownership MUST be retained until authoritative evidence releases it.
- **ACV1-QUEUE-006** — Increasing the limit starts eligible entries in order. Decreasing it MUST NOT preempt claims.
- **ACV1-QUEUE-007** — Ordinary starts enter FIFO. Final answered-Interaction continuations enter ahead of ordinary starts, FIFO among answers, without preemption.
- **ACV1-QUEUE-008** — Manual reorder changes authoritative displayed order. Mutations use stable identities and an expected queue revision, never row numbers.
- **ACV1-QUEUE-009** — Queue state/order/limit MUST survive client/Supervisor loss and sleep. Reboot applies only the atomic projection in ACV1-REC-006 and launches nothing automatically.
- **ACV1-QUEUE-010** — Existing-Agent work admission MUST use lifecycle state and the mode-specific ACV1-FLOW-033 fences. `Needs input (ready_for_prompt)` or Completed with a live inactive Runtime accepts control-plane Submit work only while unleased or leased to the calling Terminal Client; a different holder yields a non-mutating lease conflict. An eligible Quiescent resumable unleased Agent with no Runtime accepts Runtime-less submit-plus-resume and passes through Starting `resume` without a prior explicit Resume. Both paths atomically accept exactly one immutable Work Request plus either one waiting membership or one slot claim and reserve against duplicate native/control-plane submission. Working accepts only Pi steering/follow-up within its current Work Cycle; an open Interaction accepts only its schema-valid Reply; Starting, already queued/pending, incompatible, non-resumable, or ownership-conflicted Agents reject new work until resolution.
- **ACV1-QUEUE-011** — Work submitted from an attached native Pi interface MUST require the actual Input Lease holder and current Runtime epoch/revision and lease generation, then use the same durable scheduler and queue when no slot is available; attachment MUST NOT bypass concurrency or the one-request reservation.
- **ACV1-QUEUE-012** — If cancellation wins before startup, it atomically removes the entry and sets Stopped `queue_cancelled`. If startup wins, cancellation becomes the normal acknowledged stop flow and preserves any provisioned workspace.
- **ACV1-QUEUE-013** — When slot-time or later pre-`runtime_accepted` revalidation finds `launch_environment_lost`, invalid frozen configuration/trust, authoritative ownership conflict after bounded recovery, or stage failure, the accepted Work Request MUST become `interrupted`, the Agent MUST become Failed with that precise reason, and any queue membership or authoritative slot/start claim MUST be released so the next queue entry can proceed. It MUST NOT remain silently queued, substitute configuration or environment, replay the request, or allocate a replacement; Retry work uses a new Work Request identity.
- **ACV1-QUEUE-014** — An answered-final-Interaction continuation is Working while queued. Cancelling it MUST remove the queue entry and settle that existing Work Cycle as Stopped without deleting the Agent or erasing an earlier `lastWorkOutcome`.

### 9.2 Start Configuration and Dispatch Target

- **ACV1-CONFIG-023** — Start configuration precedence MUST be one-shot override, trusted target project Pi settings, user-global Pi settings, then Pi defaults.

- **ACV1-CONFIG-001** — For New and Dispatch, freeze effective target/trust, model, thinking, optional name, optional one-shot `cwd`, optional Workspace Base, and Work Request at acceptance. For Runtime-less submit-plus-resume, freeze instead the existing exact Conversation and Agent Workspace, revalidated trust, Work Request, and latest authoritative Conversation-scoped model/thinking when available; with no authoritative values, resolve model/thinking exactly as a fresh Pi invocation in that workspace. That path accepts none of the one-shot overrides named here.
- **ACV1-CONFIG-002** — One-shot overrides are limited to model, thinking, name, `cwd`, and Workspace Base. V1 MUST NOT override credentials, environment, tool set, system prompt, or create persistent Agent profiles.
- **ACV1-CONFIG-003** — Unsupported model/thinking, inaccessible targets, unresolved trust, invalid base, or unavailable frozen resources MUST fail explicitly without clamping, fallback, or substitution.
- **ACV1-CONFIG-004** — At launch, Pi MUST reread current global/project Pi resources and credentials while enforcing frozen fields. Runtime-less submit-plus-resume MUST retain its frozen Conversation/workspace/trust/model/thinking contract and MUST NOT substitute changed fields, the Supervisor environment, or values from another Conversation. Agent Console MUST NOT snapshot executable project resources.
- **ACV1-CONFIG-005** — Each Terminal Client has an explicit sticky Dispatch Target initialized from its opening Agent. Selection/filter/group MUST NOT change it; one-shot `cwd` MUST reset after acceptance.
- **ACV1-CONFIG-006** — Pi remains sole project-trust authority. Agent Console uses the public resolver, never reads/writes `trust.json`, and accesses no protected project resources before resolution.
- **ACV1-CONFIG-007** — Launch Environment MUST come from the accepting client, including the Console client that accepts Runtime-less submit-plus-resume, be sanitized and volatile, never have secret values persisted, never be substituted by the detached Supervisor's environment, and be zeroized after readiness/failure/cancellation.

### 9.3 Names, pins, and views

- **ACV1-CONFIG-008** — Agent Name is Supervisor-authoritative, mutable, non-unique, one-line, and at most 80 terminal cells; rename never changes identity/status/Git paths.
- **ACV1-CONFIG-009** — Initial name for both New and Dispatch is the explicit one-shot name when supplied; otherwise it is `Agent <short-id>`. Default names MUST NOT derive from prompt, attachment, path, Conversation content, or project content. Project is displayed separately.
- **ACV1-CONFIG-010** — Pin affects ordering and automatic Archive only. It MUST NOT affect filters, queue/slot priority, Runtime behavior, or technical log/checkpoint/backup retention.
- **ACV1-CONFIG-011** — Console View State is client-local: project filter, any status combination, archived visibility, transient name search, and one grouping axis (project or status). Default is opening project, all statuses, archived hidden, no grouping.
- **ACV1-CONFIG-012** — Filters/grouping MUST NOT alter Dispatch Target or hide/reorder the complete global Work Queue.
- **ACV1-CONFIG-013** — Agent Name, Pin, Archive, Work Queue, and concurrency configuration MUST survive Supervisor restart and reboot; Console View State and Dispatch Target survive Attach/Detach only within their Terminal Client.
- **ACV1-CONFIG-014** — After acceptance and before `runtime_accepted`, a lost Launch Environment MUST fail closed with `launch_environment_lost`; invalid frozen configuration/trust, authoritative ownership conflict after bounded recovery, or stage failure MUST use its precise closed failure reason. In every case the Runtime-unaccepted Work Request becomes `interrupted` from `accepted`, `queued`, `starting`, or `delivering` and remains eligible only for explicit Retry work with a fresh environment where required. Runtime-less submit-plus-resume MUST preserve the same Agent and Conversation and MUST NOT substitute, auto-replay, allocate a replacement request, or Attach.
- **ACV1-CONFIG-015** — Declining project trust MAY still start with global Pi resources only; unresolved trust MUST create no Agent.
- **ACV1-CONFIG-016** — The Dispatch Target chooser MUST search projects known from the Agent registry and Pi saved-session directories and accept an explicit existing directory while preserving its requested relative subdirectory.
- **ACV1-CONFIG-017** — A Runtime-side Pi name change MUST flow through the bridge to the Supervisor; queued/Runtime-less rename MUST synchronize to Pi on the next Runtime.
- **ACV1-CONFIG-018** — Roster organization order MUST be filter, then optional grouping, then pinned-before-unpinned within each matching group.
- **ACV1-CONFIG-019** — Launch Environment sanitization MUST remove prior Runtime/session identity, tmux-control, and Supervisor-control variables and generate fresh internal values while retaining ordinary toolchain/provider values.
- **ACV1-CONFIG-020** — Before accepting New or Dispatch, Agent Console MUST preview the effective target, project-trust mode, model/thinking, Workspace Base/relative-directory implications, and the fact that uncommitted target files are not copied.
- **ACV1-CONFIG-021** — User model/thinking changes after Attach remain Pi-owned and Conversation-local; they MUST NOT mutate another Agent or the global Agent Console configuration.
- **ACV1-CONFIG-022** — Dispatch Target MUST remain visible in Agent Console and MUST distinguish changing the sticky target from a one-shot `cwd` use.

## 10. Input Lease and terminal state

- **ACV1-LEASE-001** — A Terminal Client presents at most one Agent and holds at most one Input Lease; an Agent has at most one writable native frontend. V1 has no mirrored secondary frontend.
- **ACV1-LEASE-002** — Every lease has a generation. Native-input-bearing commands and attached native Submit work carry Agent, Runtime epoch/revision, Terminal Client, generation, and command identity. Supervisor-mediated inline Reply and live control-plane Submit work carry the target's current generation as a conflict fence without becoming native input. Runtime-less submit-plus-resume requires the target to be unleased and carries the last Runtime epoch plus current Input Lease generation as stale-state fences, not as current Runtime or lease authority.
- **ACV1-LEASE-003** — Stale generations MUST be rejected before Pi input or control-plane Interaction acceptance. Duplicate command retry MUST NOT deliver twice.
- **ACV1-LEASE-004** — Lease release occurs only after exact evidence of authoritative terminal disconnection, completed Handoff, or explicit Takeover. Heartbeat loss alone MUST NOT expire or release it.
- **ACV1-LEASE-005** — Three missed 2-second heartbeats create heartbeat uncertainty and block a new writable attachment but MUST NOT disable input from the confirmed existing holder. Transition or competing-ownership uncertainty fences all input until exact evidence resolves it.
- **ACV1-LEASE-006** — Takeover MUST show the current holder, require explicit choice, revoke/fence the old generation first, and show the former terminal a non-writable moved state.
- **ACV1-LEASE-007** — Reconciliation MUST compare lease generation with tmux/bridge evidence. Competing ownership MUST preserve both sides and project Failed `ownership_conflict` rather than guess or kill.
- **ACV1-LEASE-008** — Only the current Input Lease holder MAY submit attached native work, steering, follow-ups, or rich/editor Interaction responses. Supervisor-mediated inline scalar/finite-choice Reply and live control-plane Submit work are not native input and do not acquire or transfer a lease: the calling Terminal Client MAY retain the Console Host's lease, but the target MUST be unleased or already leased to that same client. A different target holder MUST reject acceptance as a lease conflict, offer Attach/Takeover, and remain undisturbed. Runtime-less submit-plus-resume requires an unleased target, needs no lease holder, grants none, and does not Attach. Accepted inline Reply uses the exact command/Agent/Runtime/Cycle/Interaction/schema/resolution/revision fences; accepted Submit work uses the exact mode-specific ACV1-FLOW-033 fences. Each reserves against native and control-plane duplicates and remains exactly once across retry, reconnect, Handoff, and Takeover.

## 11. Workspace ownership and Git lifecycle

### 11.1 Claims and identity

- **ACV1-WS-001** — The Supervisor registry MUST be authoritative for Workspace Claims. Each Agent has at most one claim; two Agents or claim reservations MUST NOT hold one canonical workspace identity, regardless of status or liveness.
- **ACV1-WS-002** — Identify a repository by canonical absolute common Git directory and a checkout by canonical absolute top-level path after resolving aliases. A reservation excludes the future identity.
- **ACV1-WS-003** — A Git worktree lock is preservation evidence, not ownership authority. External mutation produces Workspace Conflict; supervised ownership MUST never be guessed from branch or process state.

### 11.2 Original Checkout

- **ACV1-WS-004** — A foreground compatible Agent MAY claim its existing user-owned Git or non-Git checkout as Original Checkout only if unclaimed.
- **ACV1-WS-005** — Agent Console MUST never clean, reset, switch, move, remove, automatically reallocate, or apply a managed lock to an Original Checkout.
- **ACV1-WS-006** — Workspace Release from an Original Checkout requires no Runtime/work/Interaction/continuation and only ends the claim. A later Agent MAY claim it deliberately.
- **ACV1-WS-007** — Releasing a non-Git Original Checkout MUST warn that filesystem continuity is lost. Resume remains blocked until explicit selection and claim of another unclaimed existing directory; Agent Console MUST NOT fabricate a Managed Worktree.

### 11.3 Managed Worktree provisioning

- **ACV1-WS-008** — Supported Git requires Git ≥2.36.0 plus capability probes for canonical paths, NUL inventory, add/lock/reason, remove/repair, status, ref validation, and remote inspection. Missing capability fails closed.
- **ACV1-WS-009** — Freeze Workspace Base to the exact target checkout `HEAD` or explicit local branch/commit OID at acceptance. Never fetch, infer remote default, re-resolve, or include uncommitted state.
- **ACV1-WS-010** — The requested relative working directory MUST exist in the frozen commit.
- **ACV1-WS-011** — An Agent's initial Managed Worktree branch MUST be `refs/heads/agent-console/<full-agent-id>` and path MUST be `<Data Root>/worktrees/<repo-key>/<full-agent-id>/`; name/prompt changes have no effect. Post-Abandonment recovery uses only the explicit branch/path exception in ACV1-WS-021.
- **ACV1-WS-012** — Persist reservation/operation before Git mutation. Queue provisioning waits for a slot; New provisions immediately without a slot.
- **ACV1-WS-013** — Allocation MUST serialize per canonical common Git directory and use non-resetting `git worktree add -b ... --lock --reason ...`. It MUST NOT use `-B`, `--force`, remote guessing, or add-then-lock.
- **ACV1-WS-014** — After creation, verify one exact canonical path, branch ref, commit, and Agent Console/Agent identity lock reason from NUL-delimited porcelain before Ready/launch.
- **ACV1-WS-047** — The Agent Console Git lock MUST remain for the entire Managed Worktree assignment and after preserve-and-release until Unlock and Forget; external lock loss does not end or weaken the Workspace Claim.
- **ACV1-WS-015** — Collision, unexpected branch/path, malformed inventory, or mismatch MUST become Workspace Conflict, never suffix/reset/steal.

### 11.4 Reconciliation, release, and cleanup

- **ACV1-WS-016** — Reconcile durable phase, Runtime identity, canonical filesystem/checkout, Git inventory, HEAD/branch, and lock before provision, launch, Resume, Release, cleanup, and Supervisor readiness.
- **ACV1-WS-017** — Recovery MUST roll forward only exact operations. Ambiguous partial directories, drift, duplicates, or metadata remain preserved conflicts.
- **ACV1-WS-042** — A reservation with no artifacts MAY await scheduling or resume provisioning; an expected branch at the frozen base with no path/registration MAY be reused only for the same recorded interrupted operation, without reset.
- **ACV1-WS-043** — An exact expected worktree MAY be relocked and marked ready after every postcondition passes. A completed removal still marked Releasing MAY finalize release only after exact path and registration absence are verified.
- **ACV1-WS-044** — Interrupted ordinary removal MAY retry only after all current ordinary gates pass. Interrupted destructive removal MAY retry only when the reviewed manifest fingerprint is unchanged; otherwise it requires a new preview and confirmation.
- **ACV1-WS-018** — `missing`/`prunable` MUST NOT mean disposable. Keep claim, branch, lock metadata, and continuation evidence; never broad-prune or infer a move.
- **ACV1-WS-019** — A moved path MAY be repaired only after the user supplies a candidate and exact repository/worktree identity validates.
- **ACV1-WS-020** — Workspace Abandonment requires exact absence proof, no Runtime/work/Interaction/continuation, declined repair, anchored committed continuation identity, preview, and typed `abandon <short-agent-id>` confirmation. It ends the claim but retains the missing Git registration/lock as a preserved artifact. It MUST NOT prune or delete Git metadata.
- **ACV1-WS-021** — Resume after Abandonment MUST create a fresh Managed Worktree from the anchored commit using candidate branch `refs/heads/agent-console-recovery/<full-agent-id>-<operation-id>` and candidate path `<Data Root>/worktrees/<repo-key>/<full-agent-id>-recovery-<operation-id>/` only after proving both valid, absent, and unregistered. A collision is a Workspace Conflict; Agent Console MUST NOT steal/reset the missing registration's branch/path or guess a suffix.
- **ACV1-WS-022** — Status, shutdown, cancellation after provisioning, age, Archive, and retention MUST NOT release a claim or worktree.

- **ACV1-WS-048** — Ordinary Managed Worktree removal MUST pass every gate in this closed list: Quiescence for the Agent; exact conflict-free claim/path/registration/lock inside managed root; no submodules; configuration-independent proof of no staged/tracked/untracked/ignored/submodule changes; and Workspace Publication Proof.

- **ACV1-WS-049** — Workspace Publication Proof for ordinary removal MUST be exact local tip equality with Workspace Base, or bounded noninteractive `ls-remote` proof that configured destination ref equals the exact local tip. Offline/auth/no destination/remote-ahead/ambiguity blocks ordinary removal.

- **ACV1-WS-023** — Before removal, anchor current commit in a durable continuation ref, mark Releasing, rerun all checks immediately, unlock only the exact target, use targeted non-force Git removal, verify path/registration gone, and retain ordinary branches.
- **ACV1-WS-024** — Ordinary cleanup MUST NOT use recursive deletion, double force, branch deletion, fetch, local tracking refs as proof, or repository-wide prune.
- **ACV1-WS-036** — Cleanliness proof MUST be semantically equivalent to `git --no-optional-locks status --porcelain=v1 -z --untracked-files=all --ignored --ignore-submodules=none` under configuration that prevents hidden exclusions; any staged, tracked, untracked, ignored, or submodule change blocks ordinary removal.
- **ACV1-WS-037** — Before removal, the current commit MUST be anchored at `refs/agent-console/continuations/<full-agent-id>` and recorded durably; ordinary branches and configured push state MUST remain untouched.
- **ACV1-WS-025** — Unsafe ordinary removal defaults to preserve-and-release: retain files, refs, registration, and lock in a durable Preserved Checkout record independent of the Agent.
- **ACV1-WS-026** — Unlock and Forget removes only Agent Console's lock and artifact record after exact-path confirmation; never files, refs, or registration.
- **ACV1-WS-040** — A Preserved Checkout record MUST retain path, repository identity, branch/commit, originating Agent identity, and preservation reason. It MAY later be deliberately claimed through foreground supervision or Adoption as an Original Checkout when otherwise unclaimed.
- **ACV1-WS-027** — Destructive cleanup MAY override reviewed dirtiness/publication/branch drift/detached state/submodules only after exact manifest and typed `remove <short-agent-id>`. It MUST NOT override liveness, unresolved conflict, unreadable identity/inventory, outside-root path, or inability to anchor current commit.
- **ACV1-WS-028** — Destructive cleanup MAY use targeted Git force-removal but MUST NOT use `rm -rf`, global prune, branch force-delete, or force through identity/metadata conflict.
- **ACV1-WS-041** — The destructive manifest MUST enumerate tracked, staged, untracked, ignored, nested-repository, and submodule state; list commits/refs lacking publication proof; show current branch or detached state; and state that ordinary branches and continuation refs remain.
- **ACV1-WS-029** — An Agent MAY commit, create/switch branches, or detach HEAD inside its claimed workspace. Branch drift does not revoke the claim, but it blocks ordinary cleanup and unattended reconstruction until reviewed.
- **ACV1-WS-030** — Workspace Release MUST NOT change Agent Status or delete its Conversation. A released Managed Worktree is either safely removed with continuation identity retained or converted to a Preserved Checkout.
- **ACV1-WS-031** — Releasing a Git Original Checkout MUST retain committed continuation identity while leaving every file untouched; later Resume provisions a Managed Worktree from that identity without inheriting uncommitted state or stealing an occupied branch.
- **ACV1-WS-032** — Remote publication checks MUST use the requesting client's volatile environment, never persist credentials, and never fall back to the detached Supervisor's environment.
- **ACV1-WS-033** — New and Dispatch into non-Git, read-only/incompatible Git, unborn HEAD, or otherwise unprovisionable targets MUST fail preflight when known; a later queued loss of provisionability leaves the accepted Agent Failed `provisioning_failed` rather than substituting a workspace.
- **ACV1-WS-034** — A missing/stale Agent Console Git lock MAY be restored only for an otherwise exact claimed worktree; unknown locks, competing registrations, or conflicting records MUST remain preserved conflicts.
- **ACV1-WS-035** — A Managed Worktree Runtime MUST start in the requested relative directory inside that worktree, never in the Dispatch Target checkout.
- **ACV1-WS-038** — Agent Console MUST NOT create implicit upstream/push configuration. A managed branch/path/lock collision is reusable only when exact durable operation identity proves it belongs to that interrupted Agent operation.
- **ACV1-WS-039** — Loss of required Git capabilities MUST preserve existing records/artifacts and disable Managed Worktree creation, Resume, repair, and cleanup with precise remediation; an already-owned Original Checkout MAY continue only when canonical identity remains provable.
- **ACV1-WS-045** — Agent Console MUST NOT use newline-delimited worktree inventory or parse private `.git/worktrees` metadata.
- **ACV1-WS-046** — Reconciliation uncertainty MUST project Starting `recovering` and block new work, Reply, Resume, cleanup, and writable attachment until exact authority returns or a preserved Workspace Conflict is established.

## 12. Persistence, transactions, and recovery

### 12.1 Data and runtime roots

- **ACV1-DATA-013** — The Data Root MUST be `<canonical PI_CODING_AGENT_DIR>/agent-console/`, survive package removal, use `0700` directories and `0600` sensitive files, and follow this logical layout (additional private files MAY exist only inside the same security/content boundaries):

```text
agent-console/
├── config.json
├── state/
│   ├── registry.sqlite
│   ├── backups/
│   ├── runtime-checkpoints/<agent-id>/<runtime-epoch>.json
│   └── payloads/<payload-id>/
├── logs/
└── worktrees/<repo-key>/<full-agent-id>/
```

- **ACV1-DATA-014** — Reboot-volatile sockets/coordination MUST live in validated `$XDG_RUNTIME_DIR`, `$TMPDIR`, or guarded `/tmp/pi-agent-console-<uid>`, namespaced by a bound-root digest.

- **ACV1-DATA-001** — One Supervisor binds durably to exactly one canonical Pi root. Another root MUST be rejected; explicit rebind requires no live Runtime, queue, claim mutation, or unresolved operation.
- **ACV1-DATA-002** — `config.json` is the sole global product configuration, strict/versioned/atomic, and contains product settings only. There is no project-local configuration or arbitrary environment configuration layer.
- **ACV1-DATA-003** — `registry.sqlite` MUST use WAL, full synchronous durability, and one Supervisor writer. Clients MUST NOT mutate it directly.
- **ACV1-DATA-004** — `repo-key` MUST be a fixed-length base32 digest of canonical common Git directory; registry stores canonical path/full digest and treats collision as conflict.
- **ACV1-DATA-015** — Every `config.json` change and schema migration MUST use a durable configuration-generation/migration journal. Intent records old/new configuration generation and config digest; replacement writes, fsyncs, and atomically renames a strict config; the registry transaction installs the same generation/digest plus durable/global and configuration revisions; acknowledgement occurs only after reread proves the config and registry agree. A crash before agreement MUST roll forward only from the exact journaled candidate; ambiguity, missing candidate, or digest disagreement keeps the Supervisor read-only without guessed rollback.
- **ACV1-DATA-016** — Backup, restore, and migration MUST use one verified manifest pairing exactly one SQLite backup identity/hash/schema/generation with exactly one config snapshot identity/hash/schema/generation. Install is atomic from the paired manifest. A partially installed pair rolls forward only when journal, hashes, and generations identify one exact candidate; otherwise startup remains read-only and preserves every artifact.

### 12.2 Logical durable records

- **ACV1-DATA-012** — The registry MUST logically retain the following records:
  - installation/bound-root identity, configuration generation/revision, complete non-secret product settings including `concurrencyLimit`, notification preferences/revision, and schema/migration version;
  - Agent identity/revision, Conversation identity/binding revision and association/reservation, latest authoritative non-secret Conversation-scoped model/thinking values or explicit absence, name, pin/archive/inactivity, latest/last outcomes;
  - Runtime epoch/revision/condition, Runtime bridge sequence, Runtime checkpoint identity, and Runtime checkpoint acknowledgement watermark;
  - Work Request identity/revision/immutable integrity metadata/frozen start or resume-start contract/lineage/phase, Work Cycle identity/revision, Interaction identity/revision/schema/resolution revisions, Work Queue entries/order/revision, and slot claims;
  - Terminal Client identity/revision, sticky Dispatch Target value/revision, and Input Lease generation/owner/uncertainty;
  - Workspace Claim/reservation/base/branch/path/phase, operation identity, conflicts, publication evidence, continuation refs;
  - Preserved Checkout and missing-registration artifact identities/revisions, lock/evidence/disposition state;
  - durable command outcomes, external-operation identities/revisions/journals, Emergency stop intent, deletion tombstones;
  - backup/migration/notification health without secret content.

- **ACV1-DATA-005** — Payload content, Conversation content, credentials, Launch Environments, and workspace file contents MUST NOT be stored in registry records, checkpoints, logs, backups, diagnostics, notifications, or exports.
- **ACV1-DATA-006** — The sole intentional pre-acceptance content persistence is a `0600` Work Payload Spool beneath `state/payloads`. It is indexed by opaque payload identity, never secret-bearing source path.
- **ACV1-DATA-007** — Payload spool bytes MUST be excluded from ordinary backups and diagnostic/export traversal. Spool paths MUST be canonicalized and symlink-safe.
- **ACV1-DATA-008** — A Work Request/Reply acceptance transaction MUST atomically bind metadata to already verified spool content. Orphan/incomplete spool material remains quarantined inside that protected spool for one 30-second window, is restored only to an exact durable identity with matching hash and size, and otherwise has bytes erased while retaining content-free hash, size, and timestamps; it is never guessed, moved to an external quarantine, or dispatched.

### 12.3 Operation journal and reconciliation

- **ACV1-DATA-017** — Every external operation MUST use the closed ordered phases `reserved`, `intent_committed`, `effect_started`, `effect_observed`, `outcome_committed`, and `acknowledged`.

- **ACV1-DATA-009** — Recovery MAY complete an operation only when durable intent and exact observed artifacts identify one continuation. It MUST NOT automatically rollback external state.
- **ACV1-DATA-010** — A failed registry write/integrity/schema/migration/invariant check moves Supervisor to read-only and acknowledges no mutation; existing Runtimes/checkpoints continue.
- **ACV1-DATA-011** — Stale sockets, PIDs, paths, locks, rows, and timestamps are evidence, not authority. PID reuse is fenced by Agent, Runtime epoch, tmux, and process identity. Reboot-volatile coordination MAY be replaced only after the new Supervisor holds the singleton lease and proves no live socket owner.

### 12.4 Recovery bounds

- **ACV1-REC-001** — Client reports degraded connectivity at 5 seconds and offers CLI recovery at 15 seconds.
- **ACV1-REC-002** — Runtime bridges and Terminal Clients heartbeat every 2 seconds; three misses/6 seconds create uncertainty and start recovery.
- **ACV1-REC-003** — Runtime/bridge/lease/post-switch reconciliation is bounded to 30 seconds. A confirmed live Runtime without a trustworthy bridge then becomes Failed `bridge_lost` while process/evidence remain preserved.
- **ACV1-REC-004** — Handoff normal bound is 10 seconds, followed by up to 30 seconds exact reconciliation when the switch possibly started.
- **ACV1-REC-005** — Transient startup retry occurs at 0, 1, and 3 seconds—three attempts—only when no ambiguous side effect exists.
- **ACV1-REC-006** — Suspension pauses semantic timers; wake starts fresh windows. On detected reboot, after exact reconciliation against every retained authoritative Runtime checkpoint, the Supervisor MUST commit one atomic reboot projection in one durable/global revision transaction: remove every waiting-queue membership and Concurrency Slot/start claim; move every Runtime-unaccepted Work Request in `accepted`, `queued`, `starting`, or `delivering` to `interrupted` while retaining eligible payload only for explicit Retry work; settle every remaining active, blocked, or settling Work Cycle exactly once as Stopped `system_restarted` unless exact checkpoint evidence already proves a stronger terminal outcome; terminalize every unresolved Interaction as a cancelled historical record; clear every Terminal Client attachment; revoke every Input Lease; and set affected Agents to the checkpoint-proven stronger terminal outcome or otherwise Stopped `system_restarted`, with Runtime Condition `none`. That transaction MUST increment every affected Agent, Runtime, Work Request, Work Cycle, Interaction, and Terminal Client revision; increment queue revision when queue membership or slot state changes; and increment every revoked Input Lease generation. It MUST retain each exact reconciled Runtime checkpoint acknowledgement watermark without inventing or advancing any Runtime bridge sequence, invalidate prior-process client event-stream acknowledgement watermarks by allocating the new Supervisor process epoch, and emit the committed facts with new-epoch client stream sequences. It MUST NOT increment any unaffected scope. Already Runtime-less unaffected Agents retain their latched outcome. Reboot MUST NOT auto-launch, auto-Resume, redeliver, or replay anything.
- **ACV1-REC-007** — Unexpected Runtime exit MUST NOT auto-restart. Resume remains explicit; Retry work is offered only when an interrupted Runtime-unaccepted payload still exists.

### 12.5 Backups and retention

- **ACV1-REC-008** — Keep seven daily and four weekly verified SQLite-and-config manifest pairs plus pre-migration pairs outside the rolling window. Backups exclude payload/Conversation/credential/environment/workspace content.
- **ACV1-REC-009** — Restore requires global Quiescence, quarantines damaged state, verifies one paired SQLite/config manifest and installs both generations atomically, then reconciles all newer checkpoints/processes/requests/claims/files/Git state as preserved conflicts where needed.
- **ACV1-REC-010** — There is no generic repair/reset/force recovery. Recovery Actions are exact domain operations with previews and non-overridable gates.
- **ACV1-REC-011** — Retain completed command outcomes 30 days, acknowledged checkpoints 7 days, and logs 30 days or 50 MiB total, oldest eligible first while preserving current diagnostics.
- **ACV1-REC-012** — Evaluate auto-Archive daily after 30 inactive days only when unpinned and Quiescent. Pin blocks auto-Archive only.
- **ACV1-REC-013** — Never automatically delete Agents, associations, claims, worktrees, Preserved Checkouts, branches, continuation refs, or retry payloads.

### 12.6 Emergency stop

- **ACV1-REC-014** — Emergency stop is the only mutation without a normally writable Supervisor. It authorizes exact abort/Runtime stop and diagnostics only.
- **ACV1-REC-015** — Bridge/CLI MUST durably checkpoint checksummed intent, preview and revalidate Agent/epoch/tmux/process identity immediately before signalling, and refuse if identity/intent durability is uncertain.
- **ACV1-REC-016** — Reconciliation consumes confirmed emergency intent so a deliberate stop projects Stopped rather than unexplained failure.
- **ACV1-REC-017** — Retry work MUST preview the interrupted Runtime-unaccepted payload and frozen launch contract, create a new immutable Work Request referencing the former request, obtain a fresh Launch Environment, and revalidate target, model/thinking, workspace, configuration, credentials, and Pi resources without substitution. Editing content creates ordinary new work. Retry MUST NOT convert an explicit Resume into work replay or weaken the frozen Runtime-less submit-plus-resume restrictions.
- **ACV1-REC-018** — Accepted work, Interaction Reply, Resume, Attach/Handoff, rename, pin/unpin, unarchive, and explicit Recovery Action reset inactivity. Passive Roster/Peek viewing and notification delivery MUST NOT.
- **ACV1-REC-019** — Discard retry data MUST require ordinary confirmation and remove only the selected interrupted Runtime-unaccepted payload; Agent identity, Conversation, Agent Status, and Workspace Claim remain unchanged.
- **ACV1-REC-020** — Backup creation MUST follow an integrity check, and each retained backup MUST pass verification before being eligible for restore.
- **ACV1-REC-021** — Ownership-conflict recovery MUST inventory every competing Runtime/Supervisor/lease identity and let the user select a legitimate owner only after exact Conversation, Runtime epoch, process, tmux, and checkpoint proof; nonselected evidence/processes remain preserved until separately stopped or disproven.
- **ACV1-REC-022** — Reconciliation of Runtime-less submit-plus-resume MUST query the same command, operation, request, queue/slot, Runtime epoch, and checkpoint identities. If acceptance committed, recovery continues or terminalizes only that accepted start/request; if it did not commit, no Agent-domain intent exists. Launch Environment loss, trust/configuration invalidation, ownership conflict, or stage failure MUST use the exact interruption/Failed outcome from ACV1-STATE-047 and offer explicit Retry work, never environment substitution, implicit Resume, Attach, duplicate request allocation, or silent delivery.

## 13. Agent Console interaction model

### 13.1 Roster and Inspector

- **ACV1-UX-001** — Primary hierarchy MUST be Roster + Inspector, usable at approximately 48×18 terminal cells.
- **ACV1-UX-002** — Roster MUST always show Agent Name, project, Agent Status, attention/failure cue, queue/operation indicator, and enough identity to disambiguate duplicate names. Inspector shows authoritative details, reasons, configuration/workspace summaries, available actions, and persistent feedback.
- **ACV1-UX-003** — Status, attention, and destructive distinctions MUST NOT rely on color alone. Keyboard-only focus, monochrome/`NO_COLOR`, and readable narrow layout are required.
- **ACV1-UX-004** — Rejected operations MUST leave persistent inline feedback naming the rejection and its non-effects. Pending operations MUST remain visibly pending without optimistic status changes.

### 13.2 Entry, navigation, and action discovery

- **ACV1-UX-024** — The settled input catalogue MUST be:

| Input | Action |
|---|---|
| empty-editor `←` | open Agent Console |
| `/agent-console` | explicit textual entry |
| configured fallback (unbound by default) | explicit entry even with draft |
| `↑` / `↓` | move Roster selection |
| `Enter` | Attach/Handoff to selection; New from the explicit New form |
| `v` | Peek |

- **ACV1-UX-005** — Literal `←` opens only when main editor owns focus and the complete draft is empty: no text including whitespace, attachments, selection, completion, or modal UI. Otherwise it delegates unchanged even at the left boundary.
- **ACV1-UX-006** — Active Work Cycle does not change the rule; Console opens and work continues. Repeated entry arrows while pending are swallowed.
- **ACV1-UX-007** — The configurable fallback is unbound by default; setup MAY suggest `Ctrl+\` after collision checks. It MUST preserve draft and cursor exactly.
- **ACV1-UX-008** — New, Dispatch, Submit work, Change Dispatch Target, Notification settings, Reply, Attach/Handoff, Stop, Archive, Workspace Release, ordinary/destructive cleanup, and Permanent delete MUST always have discoverable explicit action labels. Only actions for which this specification requires confirmation show confirmation text. Archive remains confirmation-free. Workspace Release and ordinary cleanup MUST show an exact preview and require ordinary confirmation; typed confirmation is reserved for the actions listed in ACV1-UX-014. Exact secondary keys are not normative; a visible legend/action menu MUST make every action keyboard reachable.

### 13.3 Peek and summaries

- **ACV1-UX-009** — Peek MUST expand Inspector only; it MUST NOT start a Runtime, Attach, acquire/transfer a lease, or reset inactivity.
- **ACV1-UX-010** — Peek MUST use structured Supervisor facts, current Interaction response schema/safe prompt data, and deterministic lifecycle/outcome information. It MUST NOT scrape transcript or terminal output.
- **ACV1-UX-011** — Deterministic compact summaries are the default, are computed solely from frozen structured Supervisor facts, and MUST be byte-for-byte repeatable for the same snapshot independent of transcript text. LLM summaries MUST be explicitly labelled “non-authoritative,” supplied only by a compatible Runtime after an explicit user action, disclose provider and cost before confirmation, confirm the sensitive-data boundary, and be unavailable when no compatible Runtime can supply them. Neither summary kind may affect status, scheduling, commands, recovery evidence, inactivity, or notifications.

### 13.4 Safety actions

- **ACV1-UX-012** — Every destructive preview MUST name the exact Agent/path/artifacts, distinguish removed from retained, state consequence, and remain cancellable.
- **ACV1-UX-013** — Ordinary cleanup refusal MUST offer preserve-and-release or the explicit destructive path without weakening gates.
- **ACV1-UX-014** — Typed confirmations are exact: `stop <short-agent-id>`, `remove <short-agent-id>`, `abandon <short-agent-id>`, and `delete <short-agent-id>`.

### 13.5 Notifications and terminal limitations

- **ACV1-UX-015** — Terminal and desktop notification preferences are user-global, independently opt-in, and disabled by default. An Agent is backgrounded only when no Terminal Client is attached to it; any attached Terminal Client suppresses every notification for that Agent. Only a newly requested Interaction, Completed transition, or Failed transition while globally backgrounded is eligible; `ready_for_prompt` is not.
- **ACV1-UX-016** — For each eligible transition/Interaction, the Supervisor MUST create at most one globally deduplicated notification intent keyed by its stable identity. Desktop delivery occurs at most once. Terminal delivery goes at most once to the most recently active connected opted-in Terminal Client, regardless of which client observed the event. A failed channel retries the same intent once after 5 seconds, then produces one content-free health warning with Test/Disable; reconnect MUST NOT create another intent or reroute an already delivered channel.
- **ACV1-UX-017** — Notifications include Agent Name and status only, plus a privacy-filtered non-path project display label when a safe label exists; otherwise project is omitted. They MUST NOT include prompt/response/transcript, filesystem path fragments, payload metadata, credentials, or secret-bearing identifiers. Notification eligibility, suppression, delivery, retry, or failure MUST NOT change Agent state, Interaction state, queue, command retry, inactivity, or work.
- **ACV1-UX-018** — V1 transparency means plain `pi`, no required terminal keybindings or visible tmux chrome, and direct native Pi interfaces—not equivalence to direct Pi.
- **ACV1-UX-019** — Documentation and acceptance MUST preserve accepted differences: choppier rendering; tmux mouse/history and auto-copy behavior; image metadata fallback under Pi 0.83.0; VS Code title limitation; changed inner `TERM`/`TERM_PROGRAM`/`TMUX`; and private terminal configuration behavior.
- **ACV1-UX-020** — Any attached Terminal Client suppresses notification for that Agent, independent of Input Lease ownership; suppression MUST NOT resolve or hide the Interaction in Agent Console.
- **ACV1-UX-021** — LLM summary input/output MUST remain Runtime/client-ephemeral, MUST NOT enter registry, checkpoints, backups, logs, notifications, or diagnostics, and MUST be unavailable rather than reconstructed when no compatible Runtime can provide it.
- **ACV1-UX-022** — The private tmux client label MUST be `agent` for VS Code's `${process}` title; dynamic Agent identity MAY appear through `${sequence}`. Agent Console MUST NOT claim a dynamic process title or image rendering beyond the qualified accepted-difference contract.
- **ACV1-UX-023** — Archived Agents that retain Workspace Claims or preserved artifacts MUST remain represented in a global resources-held summary even when normal archived rows are hidden.

## 14. Security and privacy

### 14.1 Threat model

Agent Console protects against other OS users, stale/accidental/wrong-role/uncredentialed local clients, replay, malformed protocol data, path substitution, symlink attacks, identity races, and package/root confusion. It does not claim protection from root or arbitrary hostile code already running as the Agent Console OS user.

- **ACV1-SEC-001** — The same-UID non-goal MUST be explicit in user/security documentation and tests MUST NOT claim filesystem credentials defeat a fully compromised UID.
- **ACV1-SEC-002** — Despite that non-goal, IPC MUST validate peer UID, per-install credential, role capabilities, root binding, nonce proof, protocol/capabilities, command idempotency, and replay resistance.
- **ACV1-SEC-003** — Private runtime/Data Root parents, socket, database, payloads, checkpoints, backups, config, and logs MUST validate owner, type, mode, canonical path, and absence of symlink substitution before use.

### 14.2 Secrets and content

- **ACV1-SEC-004** — Credentials remain Pi-owned or volatile Launch Environment values. Agent Console MUST NOT copy them into metadata, persistence, logs, status, or UI.
- **ACV1-SEC-005** — Sensitive Work Request/Reply content MAY persist only in the payload spool under [ACV1-DATA-006](#12-persistence-transactions-and-recovery); all other Agent Console stores/outputs MUST redact or omit it.
- **ACV1-SEC-006** — Diagnostic export MUST use a content allowlist; redact canonical secret-bearing paths and environment values; omit payload/Conversation/workspace contents; validate that the canonical destination parent is an allowed user-selected directory; open a new regular file exclusively with no symlink following and restrictive `0600` mode; never overwrite; write only through that verified handle; fsync; and verify final device/inode/type/owner/mode and canonical parent before reporting success. Substitution, outside-root, non-regular, or identity-change evidence MUST abort and remove only the verified newly created file when its identity is still exact.
- **ACV1-SEC-007** — Backups and deletion tombstones MUST contain no prompt, response, credentials, Launch Environment, workspace contents, or payload spool.
- **ACV1-SEC-008** — Permanent delete MUST remove retained payloads and managed backups that can resurrect the association, create a fresh clean backup, and retain only Agent identity plus Conversation-identity hash tombstone.
- **ACV1-SEC-013** — Restoring or importing an older backup MUST apply deletion tombstones before that state becomes authoritative; only full Data Root purge removes tombstones.
- **ACV1-SEC-014** — Permanent delete MUST remove the Agent's current registry metadata, checkpoints, logs, retry payloads, and Conversation association while retaining the external Conversation file and safety-preserved Git artifacts named in its preview.

### 14.3 Destructive authority

- **ACV1-SEC-009** — A destructive mutation MUST NOT occur without current exact identity, authority, preview, required confirmation, and immediate pre-effect revalidation.
- **ACV1-SEC-010** — Uncertainty MUST prevent mutation, never cause guessed rollback, lease expiry, process killing, metadata pruning, or filesystem deletion.
- **ACV1-SEC-011** — Degraded Supervisor modes MUST expose no extra authority beyond specified diagnostics and exact-target stopping.
- **ACV1-SEC-012** — First activation without an existing installation credential MUST generate at least 256 bits of unpredictable material in a `0600` Data Root file, use it only for authenticated local handshakes, retain it across ordinary removal/reinstall, rotate it only on explicit safe rebind or credential-rotation recovery, remove it on purge, and invalidate existing connections after rotation.

## 15. Packaging, compatibility, update, and removal

### 15.1 Artifact and metadata

- **ACV1-PKG-001** — Public package/repository name is `pi-agent-console`; product name is Agent Console. Canonical install is `pi install npm:pi-agent-console` user-global and unversioned.
- **ACV1-PKG-002** — One root TypeScript package/lockfile builds precompiled ESM in the tarball. Generated `dist/` is not committed. The repository MUST contain the exact MIT text in root `LICENSE`. The npm `files` allowlist MUST be exactly `dist/**`, `README.md`, `LICENSE`, and `package.json` (the unavoidable npm-generated package metadata is permitted); no source, tests, fixtures, Data Root material, maps, credentials, test controls, or install/build lifecycle scripts may ship.
- **ACV1-PKG-003** — Supported public surfaces are exactly one `pi.extensions` entry and one `pi-agent-console` bin. `exports` is empty and public `main` omitted.
- **ACV1-PKG-004** — Extension launches Supervisor with Pi's `process.execPath` and an absolute package-relative entry; it MUST NOT search PATH or assume the bin is globally linked.
- **ACV1-PKG-005** — Manifest includes exact `pi-package` keyword, MIT, repository/homepage/bugs, public publish config, Node/os declarations, and a release-tagged PNG/WebP `pi.image`; `pi.video` is omitted until maintained.
- **ACV1-PKG-006** — Actual npm owner and gallery image URL are release checklist inputs, not invented by this specification.

- **ACV1-PKG-032** — The initial dependency contract MUST remain `semver` 7.8.5 plus optional `*` peers for `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui`; Pi packages are not bundled.

- **ACV1-PKG-026** — Initial production MUST NOT require `pi-ai`, `pi-agent-core`, `typebox`, a second Pi package, or a native npm add-on. Additional runtime dependencies MUST be small, audited, pure JavaScript, justified by correctness, and compatible with the supported artifact matrix.
- **ACV1-PKG-027** — An ordinary global npm installation MAY expose the administrative bin but MUST NOT activate Agent Console; only a qualifying user-global Pi installation activates native supervision. Exact npm pins remain supported but are intentionally skipped by unversioned Pi updates.

### 15.2 Runtime floors and allowlisting

- **ACV1-PKG-007** — Node floor is ≥22.19.0 unless the first qualifying Pi requires newer; actual runtime and `node:sqlite` capability MUST be probed.
- **ACV1-PKG-008** — Native mode requires tmux ≥3.5. Managed Worktrees require Git ≥2.36.0 and all listed capabilities.
- **ACV1-PKG-009** — Package declares Darwin/Linux. Claimed oldest/newest OS releases, architectures/terminal lanes, and qualifying Pi minor are recorded in each release qualification manifest.
- **ACV1-PKG-010** — v1 release requires macOS arm64/x64 and Linux arm64/x64 risk-based matrix coverage, but this specification MUST NOT invent release versions before qualification.

### 15.3 CLI

- **ACV1-PKG-030** — The stable top-level command catalogue MUST be exactly:

```text
pi-agent-console status
pi-agent-console doctor
pi-agent-console supervisor shutdown
pi-agent-console uninstall
pi-agent-console purge
pi-agent-console version
```

- **ACV1-PKG-023** — `doctor` MUST consolidate read-only diagnosis, diagnostic export, backup list/verify/restore, Emergency stop, reconciliation retry, and safe Pi-root rebind as guided actions/subcommands. It does not expose Dispatch, Reply, queue, or normal lifecycle automation.

- **ACV1-PKG-024** — The package MUST surface a copyable package-relative form equivalent to:

```text
<pi-node> <absolute-package-root>/dist/cli/index.js <arguments>
```

when the managed bin is not on PATH.

- **ACV1-PKG-031** — The normative v1 CLI exit-code families MUST be:

| Code | Family |
|---:|---|
| 0 | success |
| 2 | usage/input error |
| 3 | unsupported installation/host/version/capability |
| 4 | Supervisor unavailable/connectivity timeout |
| 5 | safe precondition, stale state, or ownership conflict |
| 6 | integrity/schema/migration/read-only failure |
| 7 | preservation/partial administrative outcome requiring user action |
| 8 | unexpected internal failure |

- **ACV1-PKG-011** — Human-readable command/exit behavior is public SemVer surface; no machine-readable output schema exists in v1.
- **ACV1-PKG-012** — Offline CLI mutation MUST first acquire the exclusive Supervisor lease and satisfy the same domain safety rules.

### 15.4 SemVer, migration, and mixed versions

- **ACV1-PKG-013** — First stable is 1.0.0. Public SemVer covers installation, extension behavior, CLI/exit contract, and configuration.
- **ACV1-PKG-029** — Patches contain compatible fixes and newly qualified Pi patches; minors add compatible behavior, commands, fields, or qualified Pi minor lines; majors cover incompatible removal/behavior, a raised Node floor, dropping a previously supported Pi minor, or an update unable to preserve live Agents from the preceding stable major.
- **ACV1-PKG-014** — Private protocol is independently versioned and capability-negotiated. Every supported stable 1.x Runtime bridge MUST work with every supported stable 1.x Supervisor, not only adjacent releases. Optional fields/capabilities are negotiated; only unknown mandatory semantics, discriminants, or reason codes fail closed. Every release MUST qualify the full supported bridge×Supervisor cross-product.
- **ACV1-PKG-015** — A compatible update gracefully hands off Supervisor ownership: quiesce new mutations, resolve command IDs, release lease/database, start package-relative new Supervisor, migrate, snapshot, and reconcile without killing live Agents.
- **ACV1-PKG-016** — Every 1.x release retains ordered migrations from every earlier 1.x schema. Before ready: verify owner/integrity/provenance, create database/config backup, migrate transactionally, run invariants, reconcile external state.
- **ACV1-PKG-017** — Unknown newer schema, migration/invariant failure, downgrade, or incompatible future major MUST fail closed without reset, guessed rollback, or Agent termination.

### 15.5 Removal, reinstall, and purge

- **ACV1-PKG-018** — Supported uninstall refuses until no Runtime, queued work, unresolved operation, or Workspace Conflict; then shuts down Supervisor and uses the user-global Pi removal flow.
- **ACV1-PKG-019** — Package removal MUST preserve Data Root, registry, config, checkpoints, logs, Conversation associations, Managed Worktrees, and Preserved/missing artifacts.
- **ACV1-PKG-020** — Direct `pi remove` causes a surviving Supervisor to enter preservation mode: reject start/resume/migration/ownership/cleanup mutations, continue observation and exact stopping, exit only when safe.
- **ACV1-PKG-021** — Reinstall MUST reconcile retained state, not create a fresh conflicting installation.
- **ACV1-PKG-022** — Purge is separate, explicit, and allowed only after every Workspace Claim and preserved artifact is resolved; it removes the Data Root/tombstones without touching external Pi Conversation or Git artifacts outside its authorized scope.
- **ACV1-PKG-028** — Every release MUST assert the `npm pack --json --dry-run` file list equals the ACV1-PKG-002 allowlist after npm's documented mandatory metadata, verify `LICENSE` byte-for-byte, scan for source maps/test controls/secrets, install the exact tarball into an isolated user-global Pi root, and smoke-test it for user-global install, unsupported-scope refusal, package-relative launch, peer resolution, update Handoff, uninstall preparation, and retained-state reinstall.

## 16. Verification and acceptance contract

### 16.1 Required layers

- **ACV1-VER-001** — Live model inference MUST NOT gate release. A user-approved live-model sanity check MAY be non-gating evidence only.
- **ACV1-VER-002** — A scripted Pi Host stub MUST drive snapshots, events, identities, responses, duplicates, gaps, malformed facts, and faults for deterministic layers.
- **ACV1-VER-003** — A local deterministic provider MUST drive a real compatible Pi/tmux/pseudo-terminal path without networking, credentials, recorded model output, or live inference.
- **ACV1-VER-004** — Required ladder: reference/property models; real temporary SQLite/Git/filesystem module tests; subprocess/Unix-socket tests; real tmux/PTY tests; exact-package lifecycle tests; human terminal acceptance.
- **ACV1-VER-005** — Independent test-only models cover status/Runtime projection, queue/slots, leases/handoff, workspace authority, and durable operation/idempotency. Production MUST NOT import them.

- **ACV1-VER-023** — Every deterministic layer MUST enforce this global invariant oracle:

1. no Work Request, Reply, or native input delivered twice;
2. no status inferred from transcript/ANSI/prose/tools/silence;
3. no two writable frontends hold one lease;
4. no two Agents or claim reservations hold one canonical workspace;
5. no destructive mutation without exact current authority;
6. uncertainty blocks mutation rather than guessing/rollback;
7. no Work Request/Reply content, credential, Launch Environment value, or payload source-file path enters a forbidden registry, checkpoint, backup, log, diagnostic, notification, or export surface; such data exists only in its specified authority and lifetime—the source workspace/client during verified materialization, protected Work Payload Spool through Runtime-unaccepted phases, volatile Launch Environment and target process environment until zeroized, or Pi-owned Runtime/Conversation.

### 16.2 Fault cutpoints and adversaries

- **ACV1-VER-006** — Every intent-before-effect operation MUST be faulted before intent commit, after intent commit, before effect, after effect/before outcome, after outcome/before acknowledgement, and during reconciliation.
- **ACV1-VER-007** — Fault families MUST cover command/snapshot/event loss/duplication; all process/client/tmux losses; stale identities; SQLite/WAL/schema/migration/backup/restore; Git creation/inventory/move/missing/dirty/publication/TOCTOU; sleep/reboot; Launch Environment loss; notification privacy; update/removal/reinstall/purge.
- **ACV1-VER-008** — IPC adversaries MUST cover modes/owners/symlinks, stale socket/PID reuse, wrong root, protocol/capability/role/auth mismatch, malformed/oversized frames, replayed IDs, sequence gaps, uncredentialed same-UID clients, and different OS user where CI permits.
- **ACV1-VER-009** — Destructive tests MUST use isolated temporary home, Pi root, Data Root, repository, tmux server, credentials, hermetic remote, and inside/outside canaries. Real effects run only in disposable sandboxes/VMs.

### 16.3 Scenario catalogue

- **ACV1-VER-024** — Every scenario in this catalogue is mandatory at its assigned layer; its stated oracle is normative.

| Scenario ID | Required oracle |
|---|---|
| `VC-NATIVE-001` | plain interactive bootstrap; noninteractive/opt-out/unsupported scopes bypass |
| `VC-NATIVE-002` | empty versus text/whitespace/attachment/selection/completion/modal `←` routing |
| `VC-NATIVE-003` | active work continues; draft/cursor preserved by fallback entry |
| `VC-HANDOFF-001` | same-terminal native Attach/Detach with unchanged Runtime epoch |
| `VC-HANDOFF-002` | failed/cancelled pre-switch restores source exactly; pending input discarded |
| `VC-HANDOFF-003` | post-switch ambiguity fences then resolves exact source or target |
| `VC-HANDOFF-004` | duplicate terminal and explicit Takeover generation fencing |
| `VC-HANDOFF-005` | Console Host planned/unexpected termination handoff or clean shell return |
| `VC-LIFECYCLE-001` | six statuses, phases, Runtime Conditions, Supervisor Modes and guarded transitions |
| `VC-LIFECYCLE-002` | duplicate/gapped/stale/conflicting bridge facts and checkpoint recovery |
| `VC-LIFECYCLE-003` | structured completion/error/abort/stop projection without inference |
| `VC-LIFECYCLE-004` | sleep/reboot/Resume, no automatic launch or replay |
| `VC-QUEUE-001` | atomic New/Dispatch, command retry, preflight no-op, one-Agent creation |
| `VC-QUEUE-002` | visible order, reorder/cancel races, limit raise/lower, no hidden priority |
| `VC-QUEUE-003` | slot accounting through startup/work/Interaction/uncertainty/settlement |
| `VC-QUEUE-004` | multiple Interactions: inline scalar/finite-choice Reply to a selected non-host background Agent succeeds while the Console Host retains another lease when the target is unleased; atomic `answer_pending` reservation and lost-ack retry deliver exactly once; only final resolution queues priority continuation; when another Terminal Client owns the target lease, acceptance is a non-mutating lease conflict that offers Attach/Takeover, and duplicate native/control-plane resolution cannot bypass or steal it |
| `VC-QUEUE-005` | from Agent Console hosted by A, submit control-plane work to live inactive non-host B while B is unleased: atomically create one immutable request and queue/slot ownership, remain in A's Console, preserve A's attachment/lease, and accept once at B's Runtime. Separately Detach from B so that the same calling client retains B's lease and prove control-plane submission is accepted without changing it; with B leased to another client, prove a non-mutating conflict offers Attach/Takeover. For Quiescent resumable unleased Runtime-less C with an exact ready claim, atomically commit command/request/frozen resume-start contract/operation/queue-or-slot under the last-epoch fence, pass through Starting `resume`, never Attach or grant a lease, then deliver exactly once after readiness. For all three Existing-Agent paths, prove relative attachments materialize before acceptance only from the target Agent's exact claimed Agent Workspace, never the Dispatch Target, native process cwd, or another Agent. Fault before/after acceptance and from every Runtime-unaccepted phase, lose the Launch Environment, invalidate frozen trust/configuration, and inject authoritative ownership conflict after bounded recovery and stage failure; prove `accepted`/`queued`/`starting`/`delivering` becomes `interrupted` with the precise Failed reason, truthful preserved Agent/Conversation/request state, no substitution/replay, explicit Retry work with a new request identity only, and same command/issuance retry returns one durable result without another request, operation, Runtime acceptance, or Work Cycle. Also prove attached native Submit work requires the actual holder/current epoch/generation and converges on that same scheduler, while explicit Resume still starts ready without replay. |
| `VC-PAYLOAD-001` | exact text/attachment limits and regular-file/symlink/TOCTOU materialization |
| `VC-PAYLOAD-002` | spool durability before Supervisor acceptance and through every Runtime-unaccepted phase; erasure only after Pi authoritatively accepts the Work Request/Reply; interrupted retention and Retry/Discard/Delete |
| `VC-ADOPTION-001` | writer-lease and workspace proof across project; successful Adoption |
| `VC-ADOPTION-002` | already-owned/competing/unavailable writer lease, trust, symlink and ambiguity refusal |
| `VC-WORKSPACE-001` | canonical reservation before Git mutation and concurrent allocation exclusion |
| `VC-WORKSPACE-002` | frozen base/path, Managed Worktree isolation, lock/postcondition verification |
| `VC-WORKSPACE-003` | dirty/ignored/submodule/publication states and ordinary refusal |
| `VC-WORKSPACE-004` | preserve/release and Unlock/Forget leave files/refs/registration intact |
| `VC-WORKSPACE-005` | destructive manifest/typed confirmation/non-overridable canary gates |
| `VC-WORKSPACE-006` | moved/missing repair, Workspace Abandonment, retained metadata, safe reprovision |
| `VC-WORKSPACE-007` | non-Git Original Checkout release and explicit replacement-directory Resume |
| `VC-RECOVERY-001` | every operation crash cutpoint and lost acknowledgement idempotency |
| `VC-RECOVERY-002` | Supervisor/bridge/client loss, timing bounds, read-only/preservation authority |
| `VC-RECOVERY-003` | backup verify/restore, newer artifact conflict, no inferred reset |
| `VC-RECOVERY-004` | exact Emergency stop; Force stop only after same-epoch graceful failure/timeout; immediate identity revalidation before signals |
| `VC-RETENTION-001` | auto-Archive eligibility, Pin scope, logs/checkpoints/command/backups retention |
| `VC-DELETE-001` | Permanent delete tombstone/backup pruning and retained Conversation/Git artifacts |
| `VC-SECURITY-001` | peer/root/install/role/nonce/replay/idempotency and same-UID non-goal; closed Runtime-bridge grants permit only bound fact/snapshot/checkpoint, work/Interaction/native-input/name-sync/stop/quit and exact Emergency-stop capabilities while forbidding unrelated policy mutation |
| `VC-SECURITY-002` | secret sentinels absent outside allowed spool/Pi-owned Conversation |
| `VC-SECURITY-003` | malformed/oversized/backpressured stream disconnect and resnapshot |
| `VC-PACKAGE-001` | exact allowlisted tarball metadata/files, MIT LICENSE, two surfaces, no scripts/private imports/debug roles |
| `VC-PACKAGE-002` | user-global activation and unsupported-scope/host refusal |
| `VC-PACKAGE-003` | every stable 1.x bridge/Supervisor pairing and all schema migration fixtures |
| `VC-PACKAGE-004` | update handoff, direct removal preservation, uninstall/reinstall/purge safety |
| `VC-REGISTRATION-001` | Register/Rejoin new/existing/refused outcomes, atomic writer/claim binding, epoch allocation, retry and writable-input gate |
| `VC-PAYLOAD-003` | unbound bytes remain inside spool, exact rebind within 30s, mismatch/expiry erases bytes and retains only hash/size/timestamps |
| `VC-REBOOT-001` | after exact checkpoint reconciliation, one durable/global revision transaction removes queue/slot/start claims; interrupts every Runtime-unaccepted request in accepted/queued/starting/delivering with eligible Retry payload retained; settles remaining active/blocked/settling cycles as Stopped `system_restarted` unless stronger checkpoint terminal evidence exists; cancels unresolved Interactions; clears attachments; increments every and only affected Agent/Runtime/request/cycle/Interaction/client revision, conditional queue revision, and revoked lease generation; retains each exact Runtime checkpoint acknowledgement watermark without advancing Runtime bridge sequence; changes process epoch, invalidates prior client event-stream acknowledgement watermarks, emits new-epoch client stream sequences; and never auto-launches/redelivers/replays |
| `VC-CONFIG-001` | config/registry generation journal and paired backup manifest crash roll-forward/read-only behavior |
| `VC-UX-PEEK-001` | Peek performs no Runtime start/Attach/lease transfer/transcript read/inactivity mutation |
| `VC-UX-SUMMARY-001` | deterministic summary repeats byte-for-byte from identical structured snapshot despite transcript changes |
| `VC-UX-LLM-001` | explicit opt-in, non-authoritative label, Runtime supply, provider/cost/boundary disclosure, ephemerality and unavailability |
| `VC-UX-LLM-002` | LLM summary success/refusal/failure has no status/queue/command/recovery/inactivity/notification effect |
| `VC-NOTIFY-001` | global preferences default off; eligibility only Interaction/Completed/Failed while no client is attached |
| `VC-NOTIFY-002` | newest active opted-in terminal routing, one desktop delivery, global dedup across clients/reconnect, one retry and health warning |
| `VC-NOTIFY-003` | suppression/failure/non-opt-in has no domain effect; safe project label or omission; secret/path sentinels never appear |
| `VC-DIAGNOSTIC-001` | exclusive no-follow export through verified handle; symlink substitution, outside-parent and final-identity canaries abort safely |
| `VC-NAMING-001` | explicit one-shot name wins; New/Dispatch default to Agent short ID independent of prompt/path/project sentinels |
| `VC-E2E-001` | canonical three-Agent, two-project, two-client, concurrency-one journey |
| `HA-NATIVE-001` | keyboard/focus/color-independent 48×18 Roster/Inspector and persistent feedback |
| `HA-NATIVE-002` | native shortcut/draft/paste/modified-key behavior and full Pi attachment |
| `HA-NATIVE-003` | resize/redraw/terminal close/reconnect/nested-tmux refusal and accepted differences |
| `HA-SAFETY-001` | target/consequence wording and cancellability for all safety-gated actions |

### 16.4 Canonical deterministic journey

- **ACV1-VER-016** — `VC-E2E-001` MUST use three Agents, two projects, two Terminal Clients, and concurrency one:
  1. install exact tarball user-global; plain `pi` in project A registers Agent A on Original Checkout;
  2. prove editor routing and Detach while Agent A continues;
  3. Dispatch Agent B into project B Managed Worktree with frozen payload/config; prove its privacy-safe default name is independent of prompt/project content;
  4. deliberately Adopt a separate project-B user checkout as Agent C with writer/workspace proof;
  5. queue B/C; raise multiple Interactions; while Agent A remains Console Host and retains its lease, inline-Reply to an unleased selected background Agent, then give another Terminal Client that target lease; prove final-answer priority, exact `answer_pending` reservation, exactly-once retry, and non-mutating lease-conflict/Attach/Takeover behavior;
  6. Attach/Handoff, inject pre/post-switch failures, and prove second-client Takeover fencing;
  7. close terminal and terminate Supervisor while work continues; reopen plain `pi` and reconcile;
  8. inject stream gap, bridge loss, sleep/wake, reboot; prove bounded recovery, Stopped, explicit Resume/no replay;
  9. make B dirty/untracked/ignored/unpublished; ordinary cleanup refuses; preserve/release with canaries; focused fixture proves clean removal and another proves Abandonment;
  10. quiesce, uninstall, retain Data Root/artifacts, reinstall/migrate/reconcile, and prove purge refusal while claims/artifacts remain.

### 16.5 Platform, scale, and release evidence

- **ACV1-VER-010** — Qualification is risk-based/pairwise: each allowlisted Pi minor earliest/latest patch; Node floor/current LTS; tmux 3.5/current; Git 2.36/current; minimum/current stack each OS; claimed oldest/newest OS; macOS/Linux arm64/x64; negative capabilities.
- **ACV1-VER-011** — Human gates: Terminal.app and VS Code terminal on macOS; GNOME Terminal and VS Code terminal on Ubuntu; zsh/macOS and bash/Linux. Other shells, iTerm2, Ghostty, SSH, and mosh are best effort.
- **ACV1-VER-012** — Scale gates: 32 occupied slots; 1,024 records across 32 projects; 100,000 generated transitions; one-hour loss/restart soak without duplicates, ownership drift, concealed gaps, unbounded resource growth, or leaked processes/tmux artifacts.
- **ACV1-VER-013** — Dedicated performance gates: warm Console and ready Attach/Handoff p95 ≤250 ms; cold bootstrap overhead p95 ≤500 ms; ready reconnect snapshot p95 ≤1 second.
- **ACV1-VER-014** — Every release freezes sanitized schema/checkpoint fixtures, tests every stable 1.x mixed-version pair, and attaches a qualification manifest with commands, seeds, tarball hash, exact environment, probes, tester/date, results, waivers, and reproducible failure logs.
- **ACV1-VER-015** — Native Handoff, lifecycle truth, exactly once, ownership, destructive safety, persistence, IPC security, and secret handling MUST NOT be waived. Only cosmetic terminal discrepancies MAY receive documented time-bounded waivers.
- **ACV1-VER-018** — Property tests are required, and mutation testing MUST periodically demonstrate that Supervisor-policy assertions fail when their safety conditions are removed.
- **ACV1-VER-019** — Release qualification MUST supplement deterministic tests with real subprocess kills, socket/tmux loss, package removal, and one physical sleep/wake and reboot exercise on each OS family.
- **ACV1-VER-020** — Blind retry MUST NOT turn a failure green; unexplained flaky, skipped, or missing mandatory scenarios fail qualification.
- **ACV1-VER-021** — Black-box system tests MUST observe snapshots/events, client/CLI behavior, process/filesystem state, and Git/tmux state without production debug backdoors or database-layout coupling.
- **ACV1-VER-022** — Human acceptance MUST NOT be the sole evidence for lifecycle, security, scheduling, persistence, exactly-once delivery, or destructive safety.

## Appendix A: Requirement-to-scenario traceability

- **ACV1-VER-025** — Requirement-to-scenario coverage MUST include every row in this matrix:

| Requirement ranges | Primary scenarios |
|---|---|
| `ACV1-GEN-*`, `ACV1-FLOW-001..006` | `VC-NATIVE-001..003`, `VC-QUEUE-001`, `VC-E2E-001` |
| `ACV1-FLOW-007..009`, `ACV1-STATE-013..034` | `VC-LIFECYCLE-001..003`, `VC-QUEUE-002..005`, `VC-PAYLOAD-001..002`, `VC-RECOVERY-001` |
| `ACV1-FLOW-010..014`, `ACV1-LEASE-*` | `VC-HANDOFF-001..005`, `VC-QUEUE-004`, `HA-NATIVE-002..003` |
| `ACV1-FLOW-015..019`, `ACV1-HOST-*` | `VC-ADOPTION-001..002`, `VC-NATIVE-001`, `VC-PACKAGE-002` |
| `ACV1-FLOW-020..029` | `VC-HANDOFF-003..005`, `VC-ADOPTION-001..002`, `VC-RECOVERY-004`, `VC-RETENTION-001`, `VC-DELETE-001`, `HA-SAFETY-001` |
| `ACV1-FLOW-030..033` | `VC-REGISTRATION-001`, `VC-QUEUE-001`, `VC-QUEUE-005`, `VC-E2E-001` |
| `ACV1-ARCH-*`, `ACV1-MOD-*` | `VC-LIFECYCLE-002`, `VC-RECOVERY-002`, `VC-PACKAGE-001` |
| `ACV1-IPC-*` | `VC-RECOVERY-001..002`, `VC-QUEUE-004..005`, `VC-SECURITY-001..003` |
| `ACV1-BRIDGE-*`, `ACV1-STATE-001..012` | `VC-LIFECYCLE-001..004`, `VC-QUEUE-004..005` |
| `ACV1-STATE-035..047` | `VC-LIFECYCLE-001..004`, `VC-QUEUE-005`, `VC-REBOOT-001`, `VC-WORKSPACE-006` |
| `ACV1-QUEUE-*`, `ACV1-CONFIG-*` | `VC-QUEUE-001..005`, `VC-E2E-001` |
| `ACV1-WS-*` | `VC-WORKSPACE-001..007`, `HA-SAFETY-001` |
| `ACV1-DATA-*`, `ACV1-REC-*` | `VC-PAYLOAD-002`, `VC-QUEUE-005`, `VC-RECOVERY-001..004`, `VC-RETENTION-001`, `VC-DELETE-001` |
| `ACV1-UX-*` | `VC-NATIVE-002..003`, `VC-HANDOFF-*`, `HA-NATIVE-*`, `HA-SAFETY-001` |
| `ACV1-SEC-*` | `VC-SECURITY-001..003`, `VC-WORKSPACE-005`, `VC-DELETE-001` |
| `ACV1-PKG-*` | `VC-PACKAGE-001..004`, `VC-RECOVERY-003`, `VC-E2E-001` |
| `ACV1-GLOSS-*`, `ACV1-REG-*`, `ACV1-VAL-*` | `VC-REGISTRATION-001`, `VC-LIFECYCLE-001`, `VC-E2E-001` |
| `ACV1-CONFIG-009`, `ACV1-DATA-008`, `ACV1-DATA-015..016`, `ACV1-REC-006` | `VC-NAMING-001`, `VC-PAYLOAD-003`, `VC-CONFIG-001`, `VC-REBOOT-001` |
| `ACV1-UX-009..011`, `ACV1-UX-015..021` | `VC-UX-PEEK-001`, `VC-UX-SUMMARY-001`, `VC-UX-LLM-001..002`, `VC-NOTIFY-001..003` |
| `ACV1-SEC-006` | `VC-DIAGNOSTIC-001` |
| `ACV1-FLOW-008..009`, `ACV1-FLOW-031`, `ACV1-IPC-020`, `ACV1-IPC-023..024`, `ACV1-BRIDGE-003`, `ACV1-BRIDGE-010`, `ACV1-STATE-017..018`, `ACV1-STATE-021`, `ACV1-STATE-029`, `ACV1-STATE-032`, `ACV1-STATE-044`, `ACV1-LEASE-001..008`, `ACV1-REC-018` | `VC-QUEUE-004`, `VC-E2E-001` |
| `ACV1-FLOW-033`, `ACV1-IPC-016..017`, `ACV1-IPC-024`, `ACV1-BRIDGE-001`, `ACV1-BRIDGE-010`, `ACV1-STATE-047`, `ACV1-QUEUE-010..011`, `ACV1-CONFIG-001`, `ACV1-CONFIG-004`, `ACV1-CONFIG-007`, `ACV1-CONFIG-014`, `ACV1-LEASE-002`, `ACV1-LEASE-008`, `ACV1-REC-017`, `ACV1-REC-022` | `VC-QUEUE-005` |
| `ACV1-VER-*` | all `VC-*` and `HA-*` scenarios |

- **ACV1-VER-017** — A conforming test plan MUST expand each row into individual requirement records containing requirement ID, linked source decision, exact scenario/checklist step, layer, platform, fault cutpoint, expected oracle, evidence path/result, and any permitted cosmetic waiver.

## Appendix B: Exact values

- **ACV1-VAL-001** — These exact v1 convention values are approved normative cross-ticket synthesis:

| Concern | V1 value |
|---|---|
| concurrency | default 4; integer 1–32 |
| Agent Name | explicit one-shot name, otherwise `Agent <short-id>`; all names ≤80 cells |
| minimum UI | approximately 48×18 |
| Work Request text | ≤256 KiB UTF-8 |
| attachments | ≤16; ≤10 MiB each; ≤50 MiB aggregate |
| connectivity | degraded 5s; offer CLI 15s |
| heartbeat | 2s; uncertain after three misses/6s |
| reconciliation | 30s |
| Handoff | normal 10s; then up to 30s reconciliation |
| startup transient retry | 0s, 1s, 3s; three attempts |
| graceful stop | 10s; Force stop SIGTERM then 5s then SIGKILL |
| notification retry | once after 5s |
| auto-Archive | daily; 30 inactive days; unpinned and Quiescent |
| checkpoints | acknowledged 7 days |
| logs | 30 days or 50 MiB total |
| command outcomes | 30 days |
| backups | 7 daily + 4 weekly + pre-migration outside rolling window |
| runtime floors | Node ≥22.19.0; tmux ≥3.5; Git ≥2.36.0; Pi first qualifying allowlisted minor |
| performance | open/Handoff p95 ≤250ms; bootstrap overhead ≤500ms; reconnect snapshot ≤1s |
| scale | 32 slots; 1,024 records/32 projects; 100,000 transitions; one-hour soak |
| typed confirmations | `stop`, `remove`, `abandon`, `delete` plus short Agent ID |
| private control frame | 1 MiB decoded |
| client backlog | 1,024 frames or 8 MiB |
| event replay | 4,096 events in one Supervisor process epoch |
| CLI exit families | 0, 2–8 as listed in §15.3 |

## Appendix C: Public compatibility and release inputs

The following are intentionally unresolved external/release facts, not implementation ambiguity:

- the first public Pi minor that implements and passes all four Host Conformance capabilities;
- oldest/newest macOS and Linux releases claimed by a particular package release;
- exact release-tagged gallery image URL;
- npm account/organization ownership;
- availability and release-time control of the unscoped `pi-agent-console` npm name.

- **ACV1-PKG-025** — The release qualification manifest MUST supply them before publication. Until then, implementation targets the Host Conformance Harness and MUST NOT claim production compatibility.

- **ACV1-GEN-009** — The private IPC limits, CLI exit families, error/event/substate labels, typed `abandon <short-agent-id>`, deterministic post-Abandonment recovery ref/path convention, and minimum 256-bit installation credential are approved normative cross-ticket synthesis. Concrete private wire field names remain implementation-private.

## Appendix D: Decision provenance

| Specification area | Authoritative decisions |
|---|---|
| research constraints and graceful refusal | [Establish Pi’s supported native handoff capabilities](https://github.com/frailbongat/pi-agent-console/issues/2); [Compare local Supervisor and IPC designs](https://github.com/frailbongat/pi-agent-console/issues/3); [Find reusable Pi multi-agent prior art](https://github.com/frailbongat/pi-agent-console/issues/4) |
| native topology, Pi boundary, and terminal contract | [Choose the native handoff architecture](https://github.com/frailbongat/pi-agent-console/issues/7); [Validate the transparent tmux path in VS Code](https://github.com/frailbongat/pi-agent-console/issues/17) |
| Agent Status, Runtime bridge, Work Cycle, and Interaction truth | [Define the Agent lifecycle and status contract](https://github.com/frailbongat/pi-agent-console/issues/8) |
| Registration, Conversation ownership, Attach/Detach/Handoff, and Input Lease | [Define handoff, attachment, and session adoption](https://github.com/frailbongat/pi-agent-console/issues/9) |
| New, Dispatch, Work Queue, configuration, names, pins, and views | [Define dispatch, configuration, and queueing](https://github.com/frailbongat/pi-agent-console/issues/10) |
| Git hazards and Workspace Claim lifecycle | [Establish safe git worktree operations](https://github.com/frailbongat/pi-agent-console/issues/5); [Define workspace ownership and worktree lifecycle](https://github.com/frailbongat/pi-agent-console/issues/11) |
| Roster + Inspector hierarchy and prototype evidence | [Choose the Agent Console interaction model](https://github.com/frailbongat/pi-agent-console/issues/12) |
| recovery, retention, destructive authority, backups, and notifications | [Define recovery, retention, and destructive-operation safety](https://github.com/frailbongat/pi-agent-console/issues/13) |
| npm/gallery facts and package/compatibility/data boundaries | [Verify Pi package and gallery requirements](https://github.com/frailbongat/pi-agent-console/issues/6); [Choose package structure and compatibility policy](https://github.com/frailbongat/pi-agent-console/issues/14) |
| verification ladder, scenarios, platforms, performance, and release evidence | [Define verification and acceptance scenarios](https://github.com/frailbongat/pi-agent-console/issues/15) |
| final cross-ticket resolutions and editorial approval | [Approve the implementation-ready Agent Console v1 specification](https://github.com/frailbongat/pi-agent-console/issues/16) |

ACV1-CONFIG-009 records the final cross-ticket resolution approved through [Approve the implementation-ready Agent Console v1 specification](https://github.com/frailbongat/pi-agent-console/issues/16), intentionally superseding the earlier prompt-derived default in [Define dispatch, configuration, and queueing](https://github.com/frailbongat/pi-agent-console/issues/10): explicit name when supplied, otherwise `Agent <short-id>`.

The canonical Wayfinder context is [Specify native Agent Console v1 for Pi](https://github.com/frailbongat/pi-agent-console/issues/1). Decision detail lives in the linked resolution comments; this appendix identifies provenance without duplicating those records.
