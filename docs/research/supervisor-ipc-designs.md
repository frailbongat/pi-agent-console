# Local Supervisor and IPC designs

## Scope and baseline

This note answers the research question in [Compare local Supervisor and IPC designs](https://github.com/frailbongat/pi-agent-console/issues/3) for the specification map [Specify native Agent Console v1 for Pi](https://github.com/frailbongat/pi-agent-console/issues/1). It compares local, single-user macOS/Linux mechanisms; it does **not** choose the v1 architecture.

Research was performed against Pi `v0.83.0` and the primary sources listed below. In this note, **Agent**, **Agent Console**, and **Supervisor** use the map's terminology.

The requirements imply three separate concerns that should not be conflated:

1. **Supervisor lifetime** — remain alive when Agent Console and its launching shell close, and resume after system sleep.
2. **Agent ownership and terminal lifetime** — keep an active Pi process and any controlling terminal alive while no console is attached.
3. **Control-plane IPC and persistence** — authorize the current user, stream structured events, reconnect clients, and preserve explicit-resume records across reboot.

No userspace process literally survives reboot. Reboot continuity therefore means durable Supervisor metadata plus Pi's saved session, followed by an explicit resume; Pi already saves sessions as per-project JSONL and can open a session by path or ID.[Pi sessions](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/sessions.md#L1-L20)

## Supported facts and constraints

### Pi's structured control surfaces are strong, but not equivalent to native attachment

Pi RPC mode is a headless subprocess protocol over stdin/stdout. It accepts LF-delimited JSON commands and streams responses and Agent events as JSON lines.[Pi RPC protocol](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/rpc.md#L1-L37) The event set includes Agent, turn, message, tool, queue, compaction, retry, and extension-error lifecycle events; `agent_settled` specifically means no automatic continuation remains.[Pi RPC events](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/rpc.md#L832-L887) RPC also exposes `get_state`, correlated command responses, and `get_entries`; stable entry IDs can be used as durable cursors across client restarts.[Pi durable entry cursor](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/rpc.md#L694-L716)

That protocol is not the full native Pi interface. Built-in TUI commands are unavailable through RPC, and TUI-specific extension operations such as `custom()`, custom editors, headers, footers, and working indicators are absent or degraded.[Pi RPC fidelity limits](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/rpc.md#L820-L834) [Pi RPC extension-UI limits](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/rpc.md#L1143-L1164)

The Node SDK gives direct `AgentSession` event subscriptions and lifecycle control, and exports `InteractiveMode` for a full TUI.[Pi SDK](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/sdk.md#L65-L107) [Pi InteractiveMode example](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/sdk.md#L1004-L1040) At `v0.83.0`, however, `InteractiveModeOptions` has no terminal/transport injection option and the implementation constructs a process-global `ProcessTerminal` itself.[Pi InteractiveMode options](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/modes/interactive/interactive-mode.ts#L303-L321) [Pi ProcessTerminal construction](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/modes/interactive/interactive-mode.ts#L448-L460) Consequently, the documented SDK does not currently provide a way for a daemon to hot-plug a later terminal into an already-running native `InteractiveMode`.

An RPC Agent is also coupled to its owning stdin pipe: the current RPC implementation gracefully shuts down when stdin reaches EOF.[Pi RPC input-end handling](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/modes/rpc/rpc-mode.ts#L717-L815) If a Supervisor directly owns RPC pipes, restarting or crashing that Supervisor cannot transparently recover those pipes; the RPC Agents exit when the pipe closes.

These facts create the central attach/detach constraint: **structured RPC/SDK control is readily supported, while byte-for-byte native Pi attachment requires retaining a real terminal endpoint (PTY/tmux) or adding an upstream terminal-handoff interface.** Starting a second Pi process on the same saved session is resume, not attachment to the still-running Agent, and Pi's public session documentation does not define concurrent multi-process ownership of one session file.[Pi sessions](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/sessions.md#L1-L20)

### Detached Node process

On Unix, Node's `spawn(..., { detached: true })` makes the child leader of a new process group and session. To let the parent exit independently, Node additionally requires `unref()` and stdio that is not connected to the parent/controlling terminal.[Node detached processes](https://github.com/nodejs/node/blob/20da4aeadabc5b0a01e3fcf520f91df8285c68a2/doc/api/child_process.md#L902-L971)

This is sufficient to launch a self-managed Supervisor that survives Agent Console and shell exit without installation into an OS service manager. It does not itself provide restart-on-crash, socket activation, logout policy, durable state, or an attachable terminal. It also makes the Supervisor the lifetime root: an in-process SDK Agent dies with it, and directly piped RPC Agents shut down when it loses their stdin.

A detached Supervisor must handle a single-instance race and stale socket files. Node documents that pathname Unix sockets persist after a crash until unlinked, and that typical path limits are only 107 bytes on Linux and 103 bytes on macOS.[Node IPC paths](https://github.com/nodejs/node/blob/20da4aeadabc5b0a01e3fcf520f91df8285c68a2/doc/api/net.md#L35-L56) Correct startup therefore needs a connect/health check before stale cleanup, owner/type checks before unlinking, and a deliberately short runtime path.

### User service managers

#### macOS `launchd`

Apple designates `launchd` user agents as the preferred per-user background-process mechanism. A user agent is loaded for a logged-in user, can be kept alive or launched on demand, and receives `SIGTERM` at logout.[Apple launchd jobs](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html) `launchd` can own a Unix socket and pass it to a job; its property-list schema includes `Sockets`, `SockPathName`, and `SockPathMode`.[launchd socket keys](https://github.com/apple-oss-distributions/launchd/blob/e78b4a6f0b94da2a40446d08f15d0a36f37aaf4d/launchd/src/launchd.plist.5#L218-L268)

A LaunchAgent can therefore remove shell parentage, centralize restart policy, and optionally avoid a stale Supervisor socket through socket activation. It is macOS-only and explicitly does **not** survive user logout. Apple also requires a managed process not to daemonize or call `setsid`, so the detached-Node launch pattern and the LaunchAgent pattern are alternatives at the Supervisor boundary, not settings to stack together.[Apple launchd managed-process rules](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html#//apple_ref/doc/uid/TP40001762-104142)

#### Linux `systemd --user`

A systemd user service removes shell parentage and can use `Restart=` to recover the Supervisor after failure.[systemd restart policy](https://github.com/systemd/systemd/blob/781d9d0789379d1ea1f2ecefb804d41e9c8b6c38/man/systemd.service.xml#L797-L833) A paired user socket unit can own a filesystem `AF_UNIX` listener and explicitly set `SocketMode=` and `DirectoryMode=`.[systemd Unix socket](https://github.com/systemd/systemd/blob/781d9d0789379d1ea1f2ecefb804d41e9c8b6c38/man/systemd.socket.xml#L176-L197) [systemd socket ownership and modes](https://github.com/systemd/systemd/blob/781d9d0789379d1ea1f2ecefb804d41e9c8b6c38/man/systemd.socket.xml#L371-L400)

Logout lifetime is policy-dependent. `loginctl enable-linger` starts a user's manager at boot and keeps it after logout; without lingering, user-manager teardown depends on logind configuration and delay.[systemd lingering](https://github.com/systemd/systemd/blob/781d9d0789379d1ea1f2ecefb804d41e9c8b6c38/man/loginctl.xml#L185-L199) [systemd user teardown](https://github.com/systemd/systemd/blob/781d9d0789379d1ea1f2ecefb804d41e9c8b6c38/man/logind.conf.xml#L105-L125) [systemd user stop delay](https://github.com/systemd/systemd/blob/781d9d0789379d1ea1f2ecefb804d41e9c8b6c38/man/logind.conf.xml#L188-L198) Enabling linger also starts the Supervisor at boot, so the specification would need to distinguish “restart the Supervisor” from the explicitly out-of-scope behavior “automatically restart unfinished Agents.”

Systemd's process-tree ownership is useful but consequential. Its default `KillMode=control-group` kills all processes in the service cgroup when the unit stops; allowing children to escape with `process` or `none` is explicitly discouraged.[systemd KillMode](https://github.com/systemd/systemd/blob/781d9d0789379d1ea1f2ecefb804d41e9c8b6c38/man/systemd.kill.xml#L62-L101) Thus restarting a single Supervisor unit either also stops its directly owned Agents, or requires Agents to live in separate broker/units. A user service manager improves Supervisor lifecycle but does not preserve lost RPC pipes or PTY master descriptors by itself.

Systemd user units are also a Linux runtime prerequisite, not a portable Linux API. Supporting both platforms through native service managers means two install/uninstall/status adapters plus a fallback for Linux environments without a compatible user manager.

### tmux

Tmux is already a process supervisor plus PTY broker: each session is a collection of pseudo-terminals, sessions survive client disconnection/detach, clients reattach later, and a server manages them through a private Unix socket.[tmux model](https://github.com/tmux/tmux/blob/cc117b5048f77a4842820f8ebbe3a86e5c077224/tmux.1#L34-L94) Its default `tmux-UID` socket directory must not be accessible to other users.[tmux socket permissions](https://github.com/tmux/tmux/blob/cc117b5048f77a4842820f8ebbe3a86e5c077224/tmux.1#L161-L193)

A normal tmux client attachment preserves the actual interactive Pi process and therefore the native TUI. Tmux control mode supplies a text protocol and pane-output notifications to automation clients,[tmux control mode](https://github.com/tmux/tmux/blob/cc117b5048f77a4842820f8ebbe3a86e5c077224/tmux.1#L7634-L7675) [tmux pane output](https://github.com/tmux/tmux/blob/cc117b5048f77a4842820f8ebbe3a86e5c077224/tmux.1#L7702-L7736) but those notifications are terminal bytes, not Pi's semantic Agent/tool/Needs-input state. Trustworthy Agent Console state would still need a structured Pi side channel; scraping pane text is not a reliable substitute.

Tmux's advantages are mature detach/reattach, resize, screen-state retention, and isolation from the console client. Its costs are an external executable/version/configuration dependency, nested-tmux behavior, a tmux-specific control adapter, and a separate semantic-event channel. Pi's own tmux guide documents modified-key fidelity requirements and recommends tmux 3.5+ with CSI-u configuration for the most reliable behavior.[Pi tmux requirements](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/tmux.md#L1-L63)

Tmux sessions remain in-memory processes; they do not provide reboot persistence. After reboot, Pi's session plus Supervisor metadata would still drive explicit resume.

### Custom PTY broker

A pseudoterminal has a master and slave; the slave behaves like a classical terminal, while a program holding the master can provide input and read output.[Linux PTY interface, man-pages 6.18](https://git.kernel.org/pub/scm/docs/man-pages/man-pages.git/tree/man/man7/pty.7?h=man-pages-6.18) This permits a broker to run an ordinary interactive Pi on the slave and bridge an attached console to the master. Detach then closes only the console connection, not the PTY master or Pi.

`node-pty` exposes this model to Node, supports macOS and Linux, and provides read/write/resize operations.[node-pty API and platforms](https://github.com/microsoft/node-pty/blob/1def5774632305246fe21f0f69e23a664d6c5910/README.md#L5-L41) It is native code with documented compiler prerequisites, which adds packaging and ABI validation work to an npm Pi package.[node-pty build requirements](https://github.com/microsoft/node-pty/blob/1def5774632305246fe21f0f69e23a664d6c5910/README.md#L74-L96)

A PTY alone is a byte channel, not a reconnectable terminal protocol or semantic Agent API. A robust broker must continuously drain output while detached, impose bounded buffering/backpressure, track terminal size, decide how a new client reconstructs current screen state, enforce one input owner, and pair PTY bytes with structured Pi events. A terminal emulator/state model in the broker can reconstruct a screen; a blind replay buffer cannot in general recover from arbitrary cursor-addressing sequences.

A **per-Agent PTY broker** is materially different from one Supervisor owning all PTY masters. Per-Agent brokers could outlive and re-register with a restarted top-level Supervisor; a monolithic Supervisor loses every PTY handle when it crashes. The per-Agent form buys fault isolation at the cost of another process, discovery protocol, and cleanup lifecycle per Agent.

### Unix-domain Supervisor IPC

A pathname `AF_UNIX` stream socket is the common portable local IPC substrate for the detached process, service-manager, tmux-sidecar, and PTY-broker candidates. Unix sockets communicate only on the same machine and can carry streams, file descriptors, and process credentials.[Linux Unix sockets, man-pages 6.18](https://git.kernel.org/pub/scm/docs/man-pages/man-pages.git/tree/man/man7/unix.7?h=man-pages-6.18) Node exposes pathname Unix sockets through `node:net` on non-Windows platforms.[Node IPC paths](https://github.com/nodejs/node/blob/20da4aeadabc5b0a01e3fcf520f91df8285c68a2/doc/api/net.md#L35-L56)

For user isolation, the portable baseline is a socket inside a user-owned directory with mode `0700`, with the socket restricted to `0600`. Linux `$XDG_RUNTIME_DIR` is specifically defined for per-user runtime objects such as sockets, must be owned by the user with mode `0700`, and does not provide reboot persistence.[XDG Base Directory Specification 0.8](https://specifications.freedesktop.org/basedir-spec/0.8/) Linux enforces pathname-socket permissions, but POSIX does not specify socket-file permission semantics and some BSD implementations historically ignored them; the private parent directory must therefore be the primary filesystem boundary rather than socket mode alone.[Linux Unix-socket permissions, man-pages 6.18](https://git.kernel.org/pub/scm/docs/man-pages/man-pages.git/tree/man/man7/unix.7?h=man-pages-6.18)

Kernel peer credentials can strengthen the check: Linux offers `SO_PEERCRED`, and macOS offers `getpeereid()` for a connected Unix-domain peer.[Linux SO_PEERCRED, man-pages 6.18](https://git.kernel.org/pub/scm/docs/man-pages/man-pages.git/tree/man/man7/unix.7?h=man-pages-6.18) [Apple getpeereid(3)](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man3/getpeereid.3.html) The documented Node `net.Socket` API does not expose either peer-UID primitive, so using them from a Node Supervisor would require a native binding/helper or an upstream Node API. For the stated single-user boundary—not protection against malicious processes already running as the same UID—a private directory, restrictive umask/mode, owner checks, and no TCP listener form a viable portable baseline.

## Candidate implications for a specification

The following are candidate implications, not architecture decisions.

### Comparison

| Candidate | Shell/console closure | Supervisor crash/restart | Structured events/control | Full native Pi attach | Main hazards |
|---|---|---|---|---|---|
| Detached Node Supervisor + Unix socket | Supported when detached, unref'ed, and stdio-independent | Self-restart is not provided; a crash loses in-process SDK Agents and direct RPC pipes | Strong with SDK/RPC and a Supervisor protocol | Not by itself | stale socket/singleton races; monolithic failure domain; logout policy |
| `launchd` LaunchAgent + Unix socket | Supported while the user is logged in | Restart/socket activation available | Same application protocol as above | Not by itself | macOS-only; logout terminates job; installation/lifecycle adapter |
| `systemd --user` + Unix socket | Supported; post-logout requires policy/linger | Restart/socket activation/cgroup cleanup available | Same application protocol as above | Not by itself | systemd prerequisite; linger policy; default cgroup restart also kills child Agents |
| Dedicated tmux server/session per Agent | Native detach/reattach survives client loss | Tmux server remains a failure domain; no reboot recovery | Weak from control mode alone; strong only with a Pi semantic side channel | Yes | external dependency; key/config/nesting behavior; two control channels |
| Custom PTY broker per Agent | Yes if broker itself is detached or service-managed | Can isolate Agents if brokers outlive/re-register with Supervisor | Requires a separate semantic channel | Yes | terminal emulation/replay, flow control, native addon, resize/input leases, cleanup |
| Supervisor-hosted SDK Agents | Yes while Supervisor lives | All Agents share Supervisor failure domain | Strongest direct typed event/control surface | No documented daemon-to-terminal handoff | process-global TUI boundary; one crash affects all Agents |
| Supervisor-owned RPC child per Agent | Yes while Supervisor and pipe live | RPC Agent exits when Supervisor stdin pipe closes | Strong, language-neutral event/control surface | No; RPC UI is reduced fidelity | direct pipe is unrecoverable after owner crash; custom UI would duplicate native Pi |

### A protocol shape common to the viable candidates

A local stream protocol can remain independent of the process manager and terminal mechanism:

- a version/capability handshake before commands;
- request IDs and exactly one acceptance/error response, mirroring Pi RPC's correlation model;
- an initial authoritative snapshot followed by monotonically sequenced events;
- reconnect with the last seen sequence, with “snapshot required” when the in-memory event window has expired;
- durable Agent metadata and Pi session-entry cursors stored separately from the runtime socket;
- separate structured-control and PTY-byte channels, or explicit framing that prevents terminal traffic from blocking control traffic;
- a single input/attach lease per Agent, with optional read-only watchers;
- bounded per-client queues: Node's `socket.write()` reports backpressure and emits `drain`, so a slow console should be disconnected/resynchronized rather than allowed to stall an Agent.[Node socket backpressure](https://github.com/nodejs/node/blob/20da4aeadabc5b0a01e3fcf520f91df8285c68a2/doc/api/net.md#L1526-L1548)

Pi's persisted entry IDs can repair durable transcript gaps, but live token deltas, partial tool output, queue changes, and PTY screen state still need Supervisor sequencing or a fresh snapshot.[Pi durable entry cursor](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/rpc.md#L694-L716)

### Sleep, logout, and reboot are different lifecycle boundaries

Linux system suspend freezes user processes during the suspend/resume transition; applications should not expect to execute while asleep, only to continue after thaw.[systemd sleep behavior](https://github.com/systemd/systemd/blob/781d9d0789379d1ea1f2ecefb804d41e9c8b6c38/man/systemd-suspend.service.xml#L55-L77) Thus “survive sleep” should be specified as **the process and Agent records remain valid and clients can reconnect after wake**, with disconnect/retry handling for provider network streams. It should not promise progress while asleep.

Logout is separate and currently underspecified: LaunchAgents terminate at logout, while systemd can continue only under configured user-manager policy/linger. Reboot destroys runtime processes and sockets in every candidate; only durable records and Pi sessions remain.

## Hazards that apply across candidates

1. **Supervisor restart is not Agent recovery.** A service manager can restart a PID, but cannot reconstruct another process's lost pipe or PTY file descriptor. Preserving live Agents through Supervisor replacement requires separate per-Agent brokers/units, tmux, or a deliberate handoff protocol.
2. **Terminal bytes are not trustworthy state.** Working/Needs-input/Completed/Failed must come from Pi events and process exit information, not ANSI-screen scraping. PTY/tmux needs a sideband extension or upstream event endpoint.
3. **Native attachment and headless control currently diverge.** RPC/SDK supply semantics; PTY/tmux supplies native TUI. Combining them without two competing Pi runtimes requires an explicit hybrid design.
4. **Existing-process adoption is harder than new dispatch.** A Pi process already attached to the user's real terminal cannot be retroactively placed under a newly created PTY/tmux session through any documented Pi API. The initial Agent needs a special in-process path, a wrapper present from process start, or an upstream handoff capability.
5. **Stale identity can target the wrong process.** Persisted PIDs are not durable identities. Runtime records need a Supervisor/Agent instance nonce plus a live handshake; reboot-resume records should refer to Pi session IDs/files, not old PIDs or socket paths.
6. **Stop semantics must cover process trees.** Agents can spawn tools and grandchildren. The implementation must define graceful stop, timeout, escalation, and whole-tree cleanup; systemd cgroups provide this natively, while detached/PTY/tmux designs must implement and test equivalent ownership.
7. **Socket and state storage have different lifetimes.** Runtime sockets belong in private ephemeral storage; Agent/session/resume metadata belongs in durable user storage. Never infer durable state solely from the presence of a socket.
8. **Sleep interrupts transports.** Provider streams and console sockets may fail across wake even when processes survive. State transitions need reconnect/error rules rather than assuming open connections remain healthy.

## Important unknowns and validation targets

- Will Pi expose a documented injectable terminal or detach/reattach/handoff API? The current public `InteractiveMode` surface does not.
- Is exact native attachment mandatory for every additional Agent if that upstream interface is unavailable, or is an RPC-rendered reduced-fidelity fallback acceptable? This is explicitly unresolved on the map.
- Must active Agents survive a **Supervisor crash/update**, or only Agent Console/shell closure and machine sleep? The answer changes whether a monolithic detached/service-managed Supervisor is viable.
- Must Agents survive **user logout**? macOS LaunchAgents do not; Linux requires explicit user-manager policy/linger.
- What is the supported Linux service-manager baseline, and may installation enable lingering or write user-unit files?
- Can a Pi extension provide all semantic events needed for a native interactive process over a side channel, especially deterministic Needs-input and queue state, without relying on undocumented internals?
- How should a newly attached PTY client reconstruct the exact screen: maintained terminal model, bounded replay plus forced redraw, or an upstream full-render request?
- How will the first already-running Pi session satisfy shell-close survival if Agent Console is installed as an extension rather than launched through a wrapper/broker?
- macOS sleep/wake, terminal-emulator, nested-tmux, stale-socket, Supervisor-crash, and provider-stream behavior need focused platform spikes; the primary APIs establish mechanisms but not this product's end-to-end recovery behavior.

## Conclusion

The realistic design space has two orthogonal layers. A private pathname Unix socket with a versioned snapshot/event protocol is viable across macOS and Linux regardless of how the Supervisor is launched. The Supervisor itself can be a detached Node process or an OS-managed user service; service managers add restart, activation, and process-tree policy but do not solve native attachment or recover lost Agent transports.

For Agent execution, SDK/RPC provides the required structured event stream but not full native Pi attachment, while tmux or a custom PTY broker preserves the native TUI but needs a separate semantic side channel. A per-Agent broker can isolate live Agents from Supervisor replacement; a monolithic Supervisor cannot. The later architecture decision therefore depends chiefly on the unresolved native terminal-handoff requirement and on whether live Agents must survive Supervisor restart—not on the choice of Unix socket protocol.

## Primary source list

- Pi `v0.83.0`: [RPC protocol](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/rpc.md), [SDK](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/sdk.md), [sessions](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/sessions.md), [InteractiveMode source](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/modes/interactive/interactive-mode.ts), and [RPC implementation](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/modes/rpc/rpc-mode.ts).
- Node.js `v24.18.0`: [child process](https://github.com/nodejs/node/blob/20da4aeadabc5b0a01e3fcf520f91df8285c68a2/doc/api/child_process.md) and [`node:net`](https://github.com/nodejs/node/blob/20da4aeadabc5b0a01e3fcf520f91df8285c68a2/doc/api/net.md).
- Apple: [Daemons and Services Programming Guide — launchd jobs](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html), [launchd.plist(5) source](https://github.com/apple-oss-distributions/launchd/blob/e78b4a6f0b94da2a40446d08f15d0a36f37aaf4d/launchd/src/launchd.plist.5), and [getpeereid(3)](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man3/getpeereid.3.html).
- systemd `v258`: [service restart](https://github.com/systemd/systemd/blob/781d9d0789379d1ea1f2ecefb804d41e9c8b6c38/man/systemd.service.xml), [user lingering](https://github.com/systemd/systemd/blob/781d9d0789379d1ea1f2ecefb804d41e9c8b6c38/man/loginctl.xml), [logind policy](https://github.com/systemd/systemd/blob/781d9d0789379d1ea1f2ecefb804d41e9c8b6c38/man/logind.conf.xml), [socket units](https://github.com/systemd/systemd/blob/781d9d0789379d1ea1f2ecefb804d41e9c8b6c38/man/systemd.socket.xml), [process killing](https://github.com/systemd/systemd/blob/781d9d0789379d1ea1f2ecefb804d41e9c8b6c38/man/systemd.kill.xml), and [sleep](https://github.com/systemd/systemd/blob/781d9d0789379d1ea1f2ecefb804d41e9c8b6c38/man/systemd-suspend.service.xml).
- tmux `3.6a`: [tmux(1) source](https://github.com/tmux/tmux/blob/cc117b5048f77a4842820f8ebbe3a86e5c077224/tmux.1).
- Linux man-pages `6.18`: [unix(7)](https://git.kernel.org/pub/scm/docs/man-pages/man-pages.git/tree/man/man7/unix.7?h=man-pages-6.18) and [pty(7)](https://git.kernel.org/pub/scm/docs/man-pages/man-pages.git/tree/man/man7/pty.7?h=man-pages-6.18).
- Microsoft node-pty `v1.1.0`: [README/API and build requirements](https://github.com/microsoft/node-pty/blob/1def5774632305246fe21f0f69e23a664d6c5910/README.md).
- freedesktop.org: [XDG Base Directory Specification 0.8](https://specifications.freedesktop.org/basedir-spec/0.8/).
