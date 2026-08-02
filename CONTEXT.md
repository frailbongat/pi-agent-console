# Agent Console

Agent Console is an open-source Pi package for supervising concurrent full Pi sessions through a native, in-session terminal control plane.

## Language

**Agent Console**:
The package and native in-session terminal control plane through which a user supervises agents.
_Avoid_: Agent View, standalone dashboard

**Agent**:
One supervised full Pi session, whether dispatched by Agent Console or deliberately adopted from saved Pi sessions.
_Avoid_: Subagent, worker

**Supervisor**:
The user-level background process that owns running agents independently of any Agent Console interface.
_Avoid_: Agent Console, agent
