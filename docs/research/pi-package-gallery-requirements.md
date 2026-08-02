# Pi package and gallery requirements for Agent Console

**Research date:** 2026-08-02

**Question:** What currently governs publishing Agent Console as public GitHub source and an npm Pi package, and making it eligible for `pi.dev/packages`?

## Conclusion

Agent Console can be one npm package containing both a Pi extension and a companion executable, but Pi and npm treat those as separate surfaces. Pi only discovers declared `extensions`, `skills`, `prompts`, and `themes`; npm's `bin` field packages an executable. A Pi-managed npm install is a dependency-style install under Pi's private npm root, so its `bin` is **not promised as a user-global shell command**. The specification must therefore settle how the extension locates/starts the Supervisor and whether a separately global command is required.

Gallery eligibility is simple but narrow: publish a public npm package with the exact `pi-package` keyword. Preview URLs belong under `pi.video` or `pi.image`; MP4 is the only documented video format, the documented image formats are PNG/JPEG/GIF/WebP, and video wins when both are present. No separate submission workflow is documented.

The largest distribution hazards are trust and lifecycle behavior. Pi packages and npm install scripts execute with the installing user's permissions, project trust is only a resource-loading gate rather than a sandbox, and npm provides no uninstall lifecycle hook on which Supervisor shutdown or state cleanup can rely. Pi also has no manifest field for a minimum Pi version, and its documented host-package peers use `"*"`; compatibility will need an explicit package policy and tests rather than relying on Pi's manifest or managed npm peer resolution.

## Verified baseline

This note was checked against the released `@earendil-works/pi-coding-agent` **0.83.0** source and package metadata, plus Pi `main` at immutable commit `aa0ec808b970db31822e07835a46647cb51d9d66`. The package/gallery documentation is byte-identical at those two revisions; `main` merely extracted manifest parsing into a dedicated module. Pi 0.83.0 declares Node `>=22.19.0`. ([Pi 0.83.0 `package.json`](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/package.json#L1-L10), [engine declaration](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/package.json#L92-L100))

## Supported facts

### 1. Pi package manifest and extension payload

- A Pi package is an npm/git/local package whose root `package.json` may contain a `pi` object. The supported resource fields are `extensions`, `skills`, `prompts`, and `themes`, each an array of paths relative to the package root; entries can include globs and `!` exclusions. The current parser recognizes only those four resource fields. ([package docs](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/packages.md#L116-L133), [current manifest type/parser](https://github.com/earendil-works/pi/blob/aa0ec808b970db31822e07835a46647cb51d9d66/packages/coding-agent/src/core/pi-manifest.ts#L1-L30))
- Without a `pi` manifest, Pi uses conventional directories: `extensions/` for `.ts`/`.js`, `skills/` for `SKILL.md` folders and top-level Markdown skills, `prompts/` for Markdown, and `themes/` for JSON. An explicit manifest is supported and avoids making convention-based discovery carry responsibility for the companion executable or helper files. ([package docs](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/packages.md#L156-L165))
- A distributed extension entry may be TypeScript; Pi loads extensions through `jiti`. Runtime imports must nevertheless be present in the installed package. ([extension docs](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/extensions.md#L139-L152), [extension loading](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/extensions.md#L154-L181))

### 2. Gallery eligibility and preview metadata

- Pi's official package documentation says the gallery displays packages tagged with the exact npm keyword `pi-package`; the live gallery describes itself as a catalog of resources published to npm and gives `pi install npm:<package>` commands. Therefore the documented eligibility path for this ticket is npm publication plus that keyword, not Git publication alone. ([package docs](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/packages.md#L116-L123), [gallery docs](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/packages.md#L135-L154), [live gallery](https://pi.dev/packages))
- Preview metadata is nested under `pi`: `video` must point to an MP4; `image` may point to PNG, JPEG, GIF, or WebP. Desktop video autoplays on hover and opens fullscreen on click. If both fields exist, video takes precedence. ([gallery metadata docs](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/packages.md#L135-L154))
- npm requires publishable packages to have `name` and semver-parseable `version`; `description` and `keywords` are discovery metadata. `license: "MIT"` is the appropriate SPDX expression for the map's MIT requirement, and `repository` should be a publicly usable VCS URL (with `directory` when publishing from a monorepo). ([npm package metadata](https://github.com/npm/cli/blob/5b7bb9d2981ecebc429523d11461120ff1e3385f/docs/lib/content/configuring-npm/package-json.md#L14-L72), [license](https://github.com/npm/cli/blob/5b7bb9d2981ecebc429523d11461120ff1e3385f/docs/lib/content/configuring-npm/package-json.md#L109-L145), [repository](https://github.com/npm/cli/blob/5b7bb9d2981ecebc429523d11461120ff1e3385f/docs/lib/content/configuring-npm/package-json.md#L474-L536))
- npm publication is public by default for a new package in the current npm 11 documentation, and `access` can be fixed to `public` through publish configuration or `--access=public`. A previously published `name@version` cannot be reused. ([npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/#description), [access](https://docs.npmjs.com/cli/v11/commands/npm-publish/#access))

### 3. Packaging an extension and executable together

- Pi has no executable field in its manifest. An executable is an npm concern: `package.json.bin` maps a command name to a packaged file. The target is always included in the npm tarball, and a Node script used as a bin must begin with `#!/usr/bin/env node`. ([Pi manifest type](https://github.com/earendil-works/pi/blob/aa0ec808b970db31822e07835a46647cb51d9d66/packages/coding-agent/src/core/pi-manifest.ts#L1-L30), [npm `bin`](https://github.com/npm/cli/blob/5b7bb9d2981ecebc429523d11461120ff1e3385f/docs/lib/content/configuring-npm/package-json.md#L350-L396), [always-included files](https://github.com/npm/cli/blob/5b7bb9d2981ecebc429523d11461120ff1e3385f/docs/lib/content/configuring-npm/package-json.md#L265-L285))
- Pi installs npm packages as dependencies under `~/.pi/agent/npm/node_modules/<name>` or `.pi/npm/node_modules/<name>` (temporary `-e` installs use a private temp root). npm says a dependency's bin is linked for `npm exec` and npm scripts; only a global npm installation links it into the global bin directory. **Derived constraint:** `pi install npm:<agent-console>` does not by itself promise that `pi-agent-console` is on the user's normal shell `PATH`. ([Pi install roots](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/core/package-manager.ts#L1962-L2039), [npm dependency/global bin behavior](https://github.com/npm/cli/blob/5b7bb9d2981ecebc429523d11461120ff1e3385f/docs/lib/content/configuring-npm/package-json.md#L350-L396))
- npm's `files` allowlist controls tarball contents, while `package.json`, README, LICENSE, `main`, and `bin` targets are always included. `npm pack --dry-run` is the official way to inspect the publish set. The extension entry, all imported helpers, executable support files, and any runtime assets must survive this check. ([npm `files`](https://github.com/npm/cli/blob/5b7bb9d2981ecebc429523d11461120ff1e3385f/docs/lib/content/configuring-npm/package-json.md#L265-L310), [npm publish file check](https://github.com/npm/cli/blob/5b7bb9d2981ecebc429523d11461120ff1e3385f/docs/lib/content/commands/npm-publish.md#L66-L91))

### 4. Runtime and peer dependencies

- Third-party runtime code belongs in `dependencies`; `devDependencies` are not available to distributed extensions at runtime. npm- and git-installed packages get their runtime dependencies installed automatically. ([Pi dependency docs](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/packages.md#L167-L173), [extension runtime dependency rule](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/extensions.md#L139-L152))
- If Agent Console imports Pi's host-provided core packages, Pi directs package authors to list the imported packages in `peerDependencies` with range `"*"` and not bundle them: `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, and `typebox`. Only packages actually imported need declarations. ([Pi dependency docs](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/packages.md#L167-L173))
- A dependency that is itself another Pi resource package is different: Pi requires it in both `dependencies` and `bundledDependencies`, with its resources explicitly referenced through `node_modules/...` manifest paths. Separate Pi package installations do not share module roots. ([bundled Pi package docs](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/packages.md#L173-L188))
- Current Pi-managed npm installation deliberately disables/relaxes peer resolution (`--legacy-peer-deps` for npm; equivalent settings for bun/pnpm) so host-provided Pi peers are not installed or solved inside the managed root. Consequently, peer declarations document host imports but cannot be assumed to enforce Agent Console's Pi compatibility during `pi install`. ([package-manager source](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/core/package-manager.ts#L1761-L1801))

### 5. Install, update, remove, and temporary flows

- Supported sources are npm, git, and local paths. `pi install`/`pi remove` default to user settings (`~/.pi/agent/settings.json`); `-l` writes project settings (`.pi/settings.json`). Missing project packages are installed on startup only after project trust. `pi -e npm:...` or `pi -e git:...` installs into a temporary directory for that run without persisting the source. ([install/manage docs](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/packages.md#L18-L50))
- npm installs live under Pi's user/project managed npm roots. An exact npm version such as `@1.0.0` is pinned and skipped by package updates. Unversioned packages update through `pi update --extensions`/`--all` or a targeted update. The implementation also accepts semver ranges and updates within the configured range, although the prose docs only explicitly call out exact-version pinning. ([npm source docs](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/packages.md#L56-L74), [pin/range parser](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/core/package-manager.ts#L1435-L1475), [update behavior](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/core/package-manager.ts#L1048-L1174))
- Git refs are fixed checkout targets. Updates do not advance them, but reconcile the clone to the configured ref; changed checkouts are hard-reset and cleaned before dependency installation. Unpinned git sources track their configured upstream. Local paths are referenced in place rather than copied. ([git/local source docs](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/packages.md#L76-L114))
- `pi remove` removes the npm package or managed git clone and removes its settings entry; removing a local-path package only removes the reference. Pi exposes no package-specific teardown contract. ([package-manager install/remove source](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/core/package-manager.ts#L995-L1050))

### 6. Trust and execution behavior

- Pi packages run with full user-level system access. Extensions execute arbitrary code and skills can direct the model to run executables. Pi has no built-in sandbox. ([package warning](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/packages.md#L18-L21), [security model](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/security.md#L31-L37))
- Project trust governs loading project settings/resources/packages and access to project package storage. It does not constrain what already-loaded extensions or tools can do. Before trust is resolved, only context files, user/global extensions, and CLI `-e` extensions load; declining trust skips project packages and extensions. ([project trust](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/security.md#L5-L29), [project-scope enforcement](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/core/package-manager.ts#L1727-L1734))
- Pi's managed install command does not add npm's `--ignore-scripts`. npm installation can therefore execute package `preinstall`, `install`, `postinstall`, `prepublish`, `prepare`, and related lifecycle scripts with the user's permissions. This is a supply-chain surface in addition to extension startup. ([Pi npm install arguments](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/core/package-manager.ts#L1774-L1801), [npm install lifecycle](https://github.com/npm/cli/blob/5b7bb9d2981ecebc429523d11461120ff1e3385f/docs/lib/content/using-npm/scripts.md#L128-L143))
- npm 7 and later do not implement uninstall lifecycle scripts. Agent Console cannot rely on `preuninstall`/`uninstall`/`postuninstall` to stop a Supervisor, remove launch configuration, or delete state. ([npm uninstall lifecycle note](https://github.com/npm/cli/blob/5b7bb9d2981ecebc429523d11461120ff1e3385f/docs/lib/content/using-npm/scripts.md#L212-L226))

## Constraints and hazards for the later specification

1. **Two installation meanings.** `pi install` makes the extension available to Pi; it does not guarantee a globally invocable companion command. A global npm install would make `bin` global, but that is a distinct user action and update/uninstall surface.
2. **Supervisor teardown is outside package removal.** Pi removes package files/settings, while npm has no uninstall scripts. A running Supervisor and durable Agent Console state require a separately specified, explicit lifecycle; this research does not choose it.
3. **Install-time code execution.** Avoiding lifecycle scripts and shipping prebuilt/runnable artifacts reduces install-time execution, but whether to do so is a later packaging decision. Git installs run dependency installation in the checkout and may clean/reset it on update. ([git install/update source](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/core/package-manager.ts#L1820-L1895))
4. **No Pi compatibility gate.** The current `pi` manifest has no `engines.pi`, minimum version, or extension API version field. The prescribed `"*"` peers and Pi's relaxed peer installation do not reject an incompatible Pi host.
5. **Node/OS metadata have limited enforcement.** npm supports `engines.node` and `os`; `engines` is advisory unless the installer enables `engine-strict`. These can communicate the map's macOS/Linux and runtime constraints but are not a substitute for runtime compatibility handling. ([npm engines](https://github.com/npm/cli/blob/5b7bb9d2981ecebc429523d11461120ff1e3385f/docs/lib/content/configuring-npm/package-json.md#L1009-L1034), [npm OS field](https://github.com/npm/cli/blob/5b7bb9d2981ecebc429523d11461120ff1e3385f/docs/lib/content/configuring-npm/package-json.md#L1036-L1056))
6. **Published artifacts, not repository contents, are installed from npm.** The release process must verify the tarball, including imported helper modules and Supervisor assets, rather than assuming a public GitHub file is present in npm.

## Important unknowns

The reviewed first-party sources do not specify:

- gallery indexing/refresh latency, ranking, moderation beyond the visible report mechanism, or whether keyword removal immediately removes a listing;
- preview dimensions, byte limits, hosting/CORS requirements, cache behavior, accessibility metadata, or fallback behavior for unreachable media;
- a manual gallery submission/review/approval process (none is documented);
- a Pi-native way to expose an npm dependency-style `bin` globally;
- a package uninstall callback or Supervisor cleanup protocol;
- a Pi extension compatibility manifest field or formal extension API stability policy;
- which exact Pi version Agent Console must support, because that depends on the public APIs selected by later architecture work;
- whether the npm package name is available and which npm account/scope will own it.

These should remain specification questions or release-checklist items rather than inferred gallery requirements.

## Candidate implications (not architecture decisions)

- Use an explicit `pi.extensions` entry for a single package-owned extension entry point; package the Supervisor executable/support files in the same tarball with npm `bin` only if the chosen lifecycle can locate them without assuming global `PATH` installation.
- Put only imported Pi host packages in `peerDependencies` with the Pi-documented `"*"` range; put all non-host runtime libraries in `dependencies`; keep build/test tooling in `devDependencies`.
- Declare `keywords: ["pi-package", ...]`, public GitHub `repository`, `license: "MIT"`, and optional `pi.video`/`pi.image`; use `publishConfig.access: "public"` as an explicit publication safeguard if a scope is used.
- Consider `engines.node: ">=22.19.0"` and `os: ["darwin", "linux"]` for the current v1 target, while recognizing that the later specification must decide whether to support older Pi/Node combinations.
- Make `npm pack --dry-run` plus an install smoke test from the generated tarball release gates. Test unversioned, exact-pinned, project-local trusted, and `-e` flows separately.
- Define a compatibility statement and runtime failure mode tied to the earliest Pi API Agent Console actually uses; do not treat `peerDependencies: { "@earendil-works/pi-coding-agent": "*" }` as enforcement.
- Define explicit Supervisor stop/disable/data-retention behavior before documenting uninstall. Do not rely on npm uninstall hooks.

An illustrative metadata shape, deliberately not a final manifest, is:

```json
{
  "name": "<available npm name>",
  "version": "0.1.0",
  "description": "Native in-session control plane for concurrent Pi sessions",
  "keywords": ["pi-package"],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/frailbongat/pi-agent-console.git"
  },
  "files": ["extensions", "dist", "bin", "README.md", "LICENSE"],
  "bin": {
    "pi-agent-console": "./bin/pi-agent-console.js"
  },
  "engines": {
    "node": ">=22.19.0"
  },
  "os": ["darwin", "linux"],
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*"
  },
  "pi": {
    "extensions": ["./extensions/index.ts"],
    "video": "https://<public-host>/agent-console.mp4",
    "image": "https://<public-host>/agent-console.webp"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

## Primary sources

- [Pi package documentation, release 0.83.0](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/packages.md)
- [Pi extension documentation, release 0.83.0](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/extensions.md)
- [Pi security documentation, release 0.83.0](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/docs/security.md)
- [Pi package manager implementation, release 0.83.0](https://github.com/earendil-works/pi/blob/845d6ff1f6643aba440341cce877ce1c43ebbc39/packages/coding-agent/src/core/package-manager.ts)
- [Current Pi manifest parser](https://github.com/earendil-works/pi/blob/aa0ec808b970db31822e07835a46647cb51d9d66/packages/coding-agent/src/core/pi-manifest.ts)
- [Pi package gallery](https://pi.dev/packages)
- [npm 11 `package.json` documentation source](https://github.com/npm/cli/blob/5b7bb9d2981ecebc429523d11461120ff1e3385f/docs/lib/content/configuring-npm/package-json.md)
- [npm 11 publish documentation source](https://github.com/npm/cli/blob/5b7bb9d2981ecebc429523d11461120ff1e3385f/docs/lib/content/commands/npm-publish.md)
- [npm 11 lifecycle-script documentation source](https://github.com/npm/cli/blob/5b7bb9d2981ecebc429523d11461120ff1e3385f/docs/lib/content/using-npm/scripts.md)
