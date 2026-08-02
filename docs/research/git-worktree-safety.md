# Safe Git worktree operations for Agent Console v1

## Scope

This note answers the research question in [Establish safe git worktree operations](https://github.com/frailbongat/pi-agent-console/issues/5): what Git can and cannot guarantee when the Supervisor gives each active Agent exclusive use of the original checkout or one managed linked worktree. It covers inventory, branch creation, duplicate detection, preservation checks, locks, missing/prunable worktrees, and crash recovery. It does not choose the final Agent Console architecture.

The evidence is current upstream Git documentation, source, and tests pinned to commit [`a97fcc37`](https://github.com/git/git/tree/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7). Commands and fields still need a minimum-supported-Git-version decision before implementation.

## Concise conclusion

Git supplies a stable inventory (`git worktree list --porcelain -z`), canonical repository paths, branch-name validation, a default refusal to check out one branch in two worktrees, persistent worktree locks, conservative non-force removal, prune diagnostics, and repair operations. Those are useful mechanisms, but they do **not** express Agent ownership or exclude two processes from one checkout. The Supervisor would need its own serialized ownership registry and reconciliation loop, keyed by canonical repository and worktree paths, while treating Git's inventory as independently observed state.

A safe policy can be conservative: create an explicit unique branch and linked worktree without any force/reset flags; atomically request `--lock` during creation; stop and release Agent ownership before cleanup; independently check tracked, untracked, ignored, and submodule state; block automatic cleanup whenever publication status is unknown; and never infer that `locked`, `missing`, or `prunable` means disposable. Missing paths may have been moved and should be repair candidates. Detached `HEAD`, initialized submodules, inconsistent metadata, or any race/conflict should leave the worktree preserved for inspection.

## Supported facts and constraints

### Repository and worktree identity

- A non-bare repository has one **main worktree** and zero or more **linked worktrees**. Linked worktrees share repository data but have per-worktree data such as `HEAD` and the index. Most `refs/...` are shared, while `HEAD` is per-worktree.[^worktree-model]
- `git rev-parse --path-format=absolute --git-common-dir` emits an absolute canonical common Git directory. It is the same repository-level directory from a linked worktree, whereas `--show-toplevel` emits that checkout's top-level path.[^rev-parse-paths] These are stronger identity inputs than a user-supplied current directory, which may be relative or reached through a symlink.
- `git worktree list` lists the main worktree first and reports path, `HEAD`, branch or detached state, and `locked`/`prunable` annotations. `--porcelain` is documented as stable across Git versions and user configuration; combining it with `-z` makes paths and reasons containing newlines unambiguous.[^worktree-list]
- Git's internal linked-worktree identifier is an administrative directory name based on the path basename and may gain a numeric suffix. Git explicitly advises callers to use Git commands rather than assume internal `$GIT_DIR` paths.[^worktree-details] The porcelain record's canonical path and full branch ref are therefore better public identifiers than deriving an internal ID.

**Constraint:** Git inventories checkouts and branch attachment, not process ownership. A second terminal or unsupervised process can enter an existing path, and multiple detached worktrees may point at the same commit. A worktree lock prevents Git prune/move/remove; it is not an operating-system lock on file access.[^worktree-lock]

### Creation and branch attachment

- `git worktree add -b <new-branch> <path> <start-point>` creates a new branch at the selected start point and checks it out. `-b` refuses an existing branch; `-B` instead resets an existing branch. Without explicit arguments Git has path-basename and remote-guessing behavior, so explicit path, branch, and start point avoid configuration-dependent DWIM behavior.[^worktree-add]
- `git check-ref-format --branch <name>` is the public branch-name validator.[^check-ref]
- Without `--force`, `worktree add` refuses an existing branch already checked out in another worktree and refuses a path still assigned to a missing worktree. `--force` overrides those safeguards; two force flags can override a missing locked registration. `-B` and force deletion/reset variants similarly bypass preservation checks.[^worktree-force]
- `git worktree add --lock --reason <reason> ...` leaves the new linked worktree locked and is specifically documented as avoiding the race in a separate `add` followed by `lock`.[^add-lock]
- Creation is not one transaction across the branch ref, filesystem directory, and worktree metadata. Upstream source invokes `git branch` first and then enters `add_worktree`; `add_worktree` separately checks candidate path and branch occupancy, creates an administrative directory, writes an `initializing` lock, writes linking files, creates per-worktree `HEAD`, and checks out files.[^add-source] A failed or killed operation can therefore require reconciliation and can leave a branch or partial locked worktree.
- The checked-out-branch safeguard itself scans current worktree records and then fails if it finds a matching `HEAD`; worktree creation happens afterward.[^branch-check-source] There is no repository-wide transaction joining that scan with allocation. **Source-supported inference:** two concurrent allocations have a check-then-create window, so Supervisor-side serialization per common Git directory is needed if duplicate ownership must be an invariant rather than a best effort.

### Detecting duplicate ownership and inconsistent state

Git can reveal, but cannot by itself resolve, several conflicts:

1. Parse all `git worktree list --porcelain -z` records and compare canonical paths and full `branch refs/heads/...` values.[^worktree-list]
2. Compare that inventory with the Supervisor's active ownership records. More than one active Agent naming one canonical checkout is an Agent Console conflict even if Git reports only one worktree.
3. Treat a branch reported by more than one worktree as a conflict. Git normally prevents this, but `--force` permits it, and external callers are outside Supervisor control.[^worktree-force]
4. Treat duplicate canonical paths, an unexpected bare/main record, a detached managed worktree, malformed records, and Supervisor records absent from Git's inventory as inconsistent rather than automatically repairing or deleting them.

Upstream prune tests explicitly cover corrupt duplicate linked/linked and main/linked administrative entries and remove the duplicate metadata.[^prune-tests] That demonstrates duplicate metadata is a recoverable corruption case, not evidence that either entry is safe to assign.

### Dirty work and local files

- `git status --porcelain=v1 -z` is stable and configuration-independent in format. Explicit `--untracked-files=all`, `--ignored`, and `--ignore-submodules=none` expose individual untracked files, ignored files, and submodule modifications that defaults can hide.[^status]
- For a background safety probe, `git --no-optional-locks status ...` avoids the optional index refresh lock that the status documentation warns may conflict with simultaneous Git processes.[^status-locks]
- The documented `git worktree remove` contract refuses modified tracked files and untracked files unless forced, cannot remove the main worktree, and requires two `--force` occurrences to override a lock.[^worktree-remove]
- That refusal is not sufficient for Agent Console's stronger preservation rule. Current Git source implements the pre-remove check with `git status --porcelain --ignore-submodules=none`, honors user status configuration, does not request ignored files, and then recursively deletes the entire worktree directory. The source itself calls its safety assumption potentially bad.[^remove-source] Consequently, ignored artifacts—and untracked files hidden by `status.showUntrackedFiles=no`—can escape Git's check and still be deleted.
- Git's current worktree documentation says multiple checkout support for submodules is incomplete and does not recommend multiple checkouts of a superproject.[^submodules] Current source rejects move/remove of worktrees with initialized submodules before its normal cleanliness check.[^remove-source]

**Hazard:** a successful independent status probe is only a snapshot. Files can change between probing and removal. Supervisor serialization can exclude other supervised Agents, but Git provides no way to exclude an arbitrary external writer. Automatic cleanup therefore cannot be globally race-free without a stronger filesystem/process coordination mechanism.

### Unpushed commits and reachability

Git has no single authoritative local boolean meaning “all work from this Agent has been pushed.” It exposes evidence:

- `git for-each-ref` reports a branch's configured `%(upstream)` and `%(push)` refs, including ahead/behind tracking and empty output when no push ref is configured.[^ref-tracking]
- `git rev-list <upstream>..<branch>` lists commits reachable from the branch but not its upstream; this is the documented upstream-ahead calculation.[^rev-list]
- `git branch -r --contains <commit>` or `git for-each-ref --contains=<commit> refs/remotes/` finds local remote-tracking refs whose tips descend from that commit.[^branch-contains]
- Remote-tracking refs are local copies updated by fetch; they may be stale until a fetch, and fetch can also prune or force-update them according to configuration/refspecs.[^fetch]
- `git ls-remote` queries currently advertised remote refs and object IDs, but it does not download missing history. Exact tip equality is useful evidence; a different remote tip alone cannot establish whether the local commit is its ancestor without the required objects.[^ls-remote]

**Constraint:** no upstream/push ref, no remote, an unavailable remote, stale local tracking refs, multiple possible remotes, force-pushed history, and detached `HEAD` all make publication status ambiguous. Under the map's “never remove ... unpushed commits automatically” requirement, ambiguity must be a preservation result unless the later specification defines a stronger first-party remote check and its failure semantics.

A branch ref is shared and remains separate from the linked worktree's per-worktree `HEAD` metadata.[^worktree-model] This makes an explicit managed branch an important recovery anchor. By contrast, removing metadata for a detached worktree can remove its only obvious ref to commits, leaving eventual object retention dependent on reflogs and garbage-collection expiry. The exact branch-retention and later branch-cleanup policy remains a specification decision; branch deletion has its own merged/upstream safeguards, while `-D` bypasses them.[^branch-delete]

### Locks, missing/prunable records, and repair

- `lock` is for preserving a linked worktree's administrative entry when its path may be unavailable. It prevents prune, move, and delete; a reason can be stored. The main worktree cannot be locked.[^worktree-lock]
- `prunable` means Git considers administrative metadata eligible for `worktree prune`; it does **not** mean the checkout has no valuable work. `prune` removes `$GIT_DIR/worktrees` information for missing paths. `--dry-run` reports without removing, and `--expire` controls age eligibility.[^worktree-prune]
- `git gc` normally invokes `git worktree prune --expire 3.months.ago`; `gc.worktreePruneExpire` can change that to immediate or never. A locked metadata entry is excluded from prune.[^gc-prune]
- A missing path can mean manual deletion **or manual movement**. `git worktree repair` is the documented operation to reconnect a moved main or linked worktree, including when both sides moved.[^worktree-repair]
- Upstream tests show targeted `git worktree remove <missing-path>` removes an unlocked missing entry, while a missing locked entry is retained.[^remove-tests] This is narrower than repository-wide `prune`, but still removes recovery metadata and is not evidence that the absent directory was not moved.

### Crash behavior

During `worktree add`, Git registers normal-exit and common-signal cleanup handlers, marks the partial administrative directory `locked` with reason `initializing`, and removes partial worktree and metadata directories on handled failure. It clears the temporary lock only after setup unless `--lock` was requested.[^add-source] This is best-effort process cleanup, not a durable transaction. An abrupt process or machine failure can leave one or more of: a newly created branch, a partial directory, a locked `initializing` entry, or Supervisor state that disagrees with Git.

Git's recovery primitives are inventory, unlock, targeted remove, prune, and repair; none knows whether an Agent is still alive or owns the path. Crash recovery therefore requires Supervisor reconciliation before new assignment or cleanup.

## Candidate safety invariants for the later specification

These are implications to evaluate, not final architecture decisions:

1. **Canonical identity:** identify a repository by canonical absolute common Git directory and a checkout by canonical absolute top-level path; preserve the distinction between main and linked worktrees.
2. **Single serialized allocator:** serialize allocate/release/reconcile operations per common Git directory. Commit Supervisor ownership state and process launch in an order with explicit rollback/recovery states.
3. **One live owner:** at most one active Agent record may own a canonical checkout. Git branch occupancy is an additional check, not the ownership authority.
4. **Explicit unique branch:** derive a collision-resistant Agent branch, validate it with `check-ref-format --branch`, provide an explicit start point, use `-b`, and avoid `-B`/`--force`. Record branch and path before launch.
5. **Atomic Git lock request:** use `worktree add --lock --reason ...`, with a recognizable reason, if managed worktrees must survive Git's automatic pruning. Do not interpret that lock as an Agent lease.
6. **Postcondition check:** after creation, re-read porcelain inventory and verify exactly one expected path/branch/lock record before assigning it. On mismatch, quarantine for reconciliation.
7. **Conservative release:** stop the Agent and revoke ownership first; then probe status with explicit tracked/untracked/ignored/submodule options and inspect current `HEAD`, managed branch, and publication evidence. Any output, error, detached state, unknown push state, or unexpected ref blocks automatic removal.
8. **No destructive override in automation:** normal automation should not use `worktree remove --force`, double-force, `-B`, forced branch deletion, or global prune. An explicit destructive user flow can be specified separately with a precise preview.
9. **Missing is recoverable:** classify missing/prunable records as repair-or-review, not garbage. Prefer `repair` when a moved path is known. Only remove targeted metadata after ownership, movement, branch reachability, and publication checks are resolved.
10. **Reconcile after every interruption:** on Supervisor startup and failed Git subprocesses, compare registry, Agent process state, canonical filesystem paths, and porcelain inventory. Preserve ambiguous entries and expose a recovery action rather than silently reassigning.
11. **Never clean the main worktree:** Git already refuses main-worktree removal; Agent Console should also treat the original checkout as user-owned and outside managed linked-worktree cleanup.

## Hazards to carry into specification and tests

- Two concurrent `worktree add` calls can pass pre-creation occupancy checks; Git's worktree allocation is not a repository-wide ownership transaction.[^add-source]
- An external caller can deliberately create duplicate branch checkouts with `--force`.[^worktree-force]
- Branch creation can succeed before later worktree setup fails, leaving a branch without the intended checkout.[^add-source]
- Non-force `worktree remove` may delete ignored files or untracked files hidden by user configuration.[^remove-source]
- A clean worktree can still have commits not known to be on a remote; cleanup cleanliness and publication safety are separate checks.[^rev-list]
- Detached commits can lose their obvious per-worktree ref when metadata is removed.[^worktree-model]
- `prunable` and `missing` can describe a moved, temporarily unavailable, or corrupt worktree—not only abandoned state.[^worktree-repair]
- Locks can become stale after a crash; automatically breaking one destroys its preservation value.
- Worktrees containing initialized submodules do not fit the ordinary move/remove lifecycle, and upstream still labels multiple-superproject checkout support incomplete.[^submodules]
- Status and cleanup are subject to time-of-check/time-of-use races with unsupervised processes.
- Paths may contain newlines; non-`-z` parsing is unsafe.[^worktree-list]

## Important unknowns

The later specification still needs to settle:

- Minimum supported Git version on macOS and Linux, and whether startup capability-probes required options/fields.
- Exact branch/path naming scheme, managed-root location, and behavior when names already exist from an earlier crash.
- Durable ordering between Supervisor records, branch creation, worktree creation, and Agent process spawn.
- What counts as sufficient proof of “pushed”: configured push target, any remote-tracking ref, a live remote query/fetch, or explicit user acknowledgement; and behavior offline or with multiple remotes.
- Whether cleanup may perform a fetch. Fetch mutates shared repository refs and can invoke configured transport/credential behavior, so it is not a neutral read.
- How to detect a manually moved worktree when its new path is unknown.
- Whether initialized submodules are unsupported in v1, preserved indefinitely, or handled by a separate explicit workflow.
- Whether Agent activity is restricted from detaching `HEAD`, switching branches, creating extra branches/worktrees, or changing shared repository configuration; otherwise attribution becomes ambiguous.
- How an explicit destructive confirmation previews ignored files, nested repositories, submodules, and unpushed commits.
- How to handle a user or external tool entering a managed checkout while no supervised Agent owns it; Git offers no checkout-level process lock.

## Sources

All GitHub links below are immutable links to upstream Git commit `a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7`.

[^worktree-model]: Git, [`git-worktree(1)`: model, shared/per-worktree refs](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-worktree.adoc#L22-L62), [ref sharing](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-worktree.adoc#L296-L325).
[^rev-parse-paths]: Git, [`git-rev-parse(1)`: canonical path format, common Git directory, top level](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-rev-parse.adoc#L246-L300).
[^worktree-list]: Git, [`git-worktree(1)`: list and stable NUL-delimited porcelain](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-worktree.adoc#L111-L116), [options](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-worktree.adoc#L257-L266), [record grammar](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-worktree.adoc#L458-L522).
[^worktree-details]: Git, [`git-worktree(1)`: linked-worktree administrative layout and path-resolution warning](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-worktree.adoc#L361-L414).
[^worktree-lock]: Git, [`git-worktree(1)`: lock semantics](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-worktree.adoc#L118-L123), [upstream lock/unlock tests, including main-worktree refusal](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/t/t2403-worktree-move.sh#L17-L56).
[^worktree-add]: Git, [`git-worktree(1)`: explicit and implicit add behavior](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-worktree.adoc#L39-L50), [`-b` versus `-B`](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-worktree.adoc#L195-L202).
[^check-ref]: Git, [`git-check-ref-format(1)`: branch validation](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-check-ref-format.adoc#L16-L19), [`--branch` behavior](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-check-ref-format.adoc#L80-L96).
[^worktree-force]: Git, [`git-worktree(1)`: force overrides for occupied branches and registered/locked paths](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-worktree.adoc#L177-L202).
[^add-lock]: Git, [`git-worktree(1)`: `add --lock` avoids separate-command race](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-worktree.adoc#L243-L246).
[^add-source]: Git source, [`builtin/worktree.c`: partial-worktree cleanup, candidate checks, metadata creation, initialization lock, checkout, and completion](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/builtin/worktree.c#L268-L295), [`add_worktree`](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/builtin/worktree.c#L461-L633), [branch creation precedes `add_worktree`](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/builtin/worktree.c#L932-L964).
[^branch-check-source]: Git source, [`branch.c`: checked-out branch scan](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/branch.c#L847-L863).
[^prune-tests]: Git tests, [`t2401-worktree-prune.sh`: duplicate administrative entries](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/t/t2401-worktree-prune.sh#L98-L120).
[^status]: Git, [`git-status(1)`: porcelain stability and untracked controls](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-status.adoc#L39-L49), [untracked files](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-status.adoc#L59-L88), [submodule and ignored-file controls](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-status.adoc#L90-L133), [v1 `-z` guarantees](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-status.adoc#L251-L273).
[^status-locks]: Git, [`git-status(1)`: background status and `--no-optional-locks`](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-status.adoc#L491-L502).
[^worktree-remove]: Git, [`git-worktree(1)`: remove contract and force behavior](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-worktree.adoc#L142-L147), [force rules](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-worktree.adoc#L177-L193).
[^remove-source]: Git source, [`builtin/worktree.c`: submodule validation and status-based cleanliness check](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/builtin/worktree.c#L1218-L1247), [source warning, recursive deletion, and remove flow](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/builtin/worktree.c#L1318-L1435).
[^submodules]: Git, [`git-worktree(1)` BUGS: incomplete submodule support](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-worktree.adoc#L538-L542).
[^ref-tracking]: Git, [`git-for-each-ref(1)`: upstream and push fields](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-for-each-ref.adoc#L79-L106).
[^rev-list]: Git, [`git-rev-list(1)`: commits on branch but not upstream](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-rev-list.adoc#L37-L48).
[^branch-contains]: Git, [`git-branch(1)`: `--contains` reachability semantics](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-branch.adoc#L46-L54), [`--remotes` and `--contains` options](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-branch.adoc#L155-L188).
[^fetch]: Git, [`git-fetch(1)`: fetch updates remote-tracking refs](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-fetch.adoc#L18-L40), [configured remote-tracking branches](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-fetch.adoc#L69-L100), [pruning and stale refs](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-fetch.adoc#L102-L162).
[^ls-remote]: Git, [`git-ls-remote(1)`: advertised remote refs and object IDs](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-ls-remote.adoc#L16-L20), [output and missing-object limitation](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-ls-remote.adoc#L47-L83).
[^branch-delete]: Git, [`git-branch(1)`: delete and force-delete safeguards](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-branch.adoc#L96-L128).
[^worktree-prune]: Git, [`git-worktree(1)`: prune meaning](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-worktree.adoc#L132-L140), [dry-run and expiry](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-worktree.adoc#L248-L282).
[^gc-prune]: Git, [`git-config(1)`: `gc.worktreePruneExpire`](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/config/gc.adoc#L107-L113), [locked-entry prune test](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/t/t2401-worktree-prune.sh#L74-L89).
[^worktree-repair]: Git, [`git-worktree(1)`: repair moved/corrupt links](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/Documentation/git-worktree.adoc#L149-L169).
[^remove-tests]: Git tests, [`t2403-worktree-move.sh`: missing and missing-locked removal](https://github.com/git/git/blob/a97fcc37c2bc6340a8d7ce78dedf227aac4e9aa7/t/t2403-worktree-move.sh#L183-L198).
