# Agent Console

Agent Console is an open-source Pi package for supervising concurrent full Pi sessions through a native, in-session terminal control plane.

## Language

**Agent Console**:
The package and native in-session terminal control plane through which a user supervises agents.
_Avoid_: Agent View, standalone dashboard

**Conversation**:
A durable Pi session identity and history linked to an Agent. It may be reserved while still empty, can exist without a live Agent Runtime, and provides continuity across stop and resume.
_Avoid_: Agent, runtime

**Agent**:
A durable supervised identity linked to exactly one Conversation, whether dispatched by Agent Console or deliberately adopted. It has at most one live Agent Runtime and persists across runtime replacement until permanently deleted.
_Avoid_: Subagent, worker, process

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
One identifiable span of accepted Agent work, including automatic retries, compaction, steering, and queued continuations. It pauses for Interactions and ends with a Completed, Failed, or Stopped outcome.
_Avoid_: Low-level run, turn, tool call

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
A latched Agent Status recording that a Work Cycle or Agent Runtime was deliberately halted and the halt was authoritatively confirmed. It does not by itself say whether an Agent Runtime remains live.
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
