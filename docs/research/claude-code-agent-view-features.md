# Claude Code Agent View Features

Agent View (`claude agents`) is a terminal dashboard for managing multiple **full Claude Code conversations** concurrently.

## Core capabilities

- Dispatch parallel sessions from one input.
- Background an existing session with `←` or `/bg`.
- Fork the current conversation into an independent background session with `/fork`.
- Run background shell jobs by prefixing a dispatch with `!`.
- Monitor status: Working, Needs input, Idle, Completed, Failed, or Stopped.
- See concise live summaries, elapsed time, scheduled-loop progress, and linked pull-request status.
- Peek without attaching to see the current question, result, status, transcript context, or command output.
- Reply inline, including selecting numbered answers to questions.
- Attach to the full conversation with all normal Claude Code commands and tools.
- Detach without stopping the session.
- Rename, pin, reorder, group, filter, stop, delete, and restore sessions.
- Manage sessions across projects, or filter with `claude agents --cwd <path>`.
- Receive notifications when an agent needs input, completes, or fails.

## Persistence and recovery

A separate per-user supervisor process:

- Keeps sessions running after Agent View or the shell closes.
- Persists session state to disk.
- Reconnects after supervisor and Claude Code updates.
- Preserves sessions across machine sleep.
- Restarts unexpectedly exited dispatched sessions with safeguards.
- Stops idle, unpinned processes after about an hour while retaining their conversation.
- Restarts a stopped process when you peek, reply, or attach.
- Supports explicit inspection and recovery commands such as:
  - `claude daemon status`
  - `claude respawn <id>`
  - `claude respawn --all`

A full machine shutdown still stops running processes, but their saved conversations can be resumed.

## Git worktree isolation

Before a background session edits repository files, Claude normally moves it into an isolated worktree under:

```text
.claude/worktrees/
```

This allows multiple agents to work without modifying the same checkout. Claude-created sessions can commit, push their own branch, and open draft pull requests, but they do not automatically push to `main`, force-push, or merge.

Cleanup protections include:

- Unpushed commits prevent automatic worktree deletion.
- User-created worktrees are preserved.
- `claude rm` preserves worktrees with uncommitted changes.
- Deleting with `Ctrl+X` twice can remove uncommitted changes, so wanted work should be committed first.

## Main controls

| Action                     | Control                   |
| -------------------------- | ------------------------- |
| Open Agent View            | `claude agents`           |
| Dispatch                   | Type prompt, then `Enter` |
| Dispatch and attach        | `Shift+Enter`             |
| Peek/reply                 | `Space`                   |
| Attach                     | `Enter` or `→`            |
| Detach                     | `←`, `/exit`, or `Ctrl+Z` |
| Background current session | `←` or `/bg`              |
| Fork current conversation  | `/fork`                   |
| Rename                     | `Ctrl+R`                  |
| Pin                        | `Ctrl+T`                  |
| Reorder                    | `Shift+↑` / `Shift+↓`     |
| Group by state/directory   | `Ctrl+S`                  |
| Stop, then delete          | `Ctrl+X`, then again      |
| Show shortcuts             | `?`                       |

## Agent View versus `/resume`

Unlike `/resume`, which browses saved conversations, Agent View actively supervises multiple concurrent background sessions.

## Source

[Claude Code Agent View documentation](https://code.claude.com/docs/en/agent-view)
