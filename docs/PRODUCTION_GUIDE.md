# Production Guide — Using Everything Claude Code in Real Work

A step-by-step, actionable guide for adopting this plugin as your day-to-day AI
coding harness: installed correctly, secrets handled safely, cost controlled,
security gated, health-checked, and rolled out to a team and CI.

This is not about deploying an application — it is about operationalizing the
plugin so it reliably improves real development across your projects.

> Owner note: commands below use `robertclapp/everything-claude-code`. The
> upstream project is `affaan-m/everything-claude-code`; substitute whichever
> repo you actually install from.

---

## Phase 0 — Decide your source and prerequisites

### 0.1 Which copy are you installing

`/plugin marketplace add <owner>/<repo>` pulls the repo's **default branch**
(`main`). If your hardening work lives on a feature branch, the marketplace
install will not serve it until that branch is merged.

- **If your changes are merged to `main`:** use the marketplace path (Mode A).
- **If they are still on a feature branch:** install from a local clone of that
  branch (Mode B), or merge first.

### 0.2 Verify prerequisites

```bash
claude --version      # must be >= v2.1.0 (hook auto-load behavior)
node --version        # must be >= 18 (all scripts/hooks are Node.js)
git --version
```

If `claude` is below v2.1.0, upgrade before continuing — hooks will not load
correctly otherwise.

### 0.3 Pin your package manager

The plugin auto-detects npm/pnpm/yarn/bun, but pin it for deterministic team
behavior:

```bash
export CLAUDE_CODE_PACKAGE_MANAGER=pnpm        # or npm / yarn / bun
node scripts/setup-package-manager.js --global pnpm
```

---

## Phase 1 — Install the plugin

Pick **one** mode as your team standard.

### Mode A — Marketplace plugin (recommended once on `main`)

```bash
# In Claude Code:
/plugin marketplace add robertclapp/everything-claude-code
/plugin install everything-claude-code@everything-claude-code
/plugin list everything-claude-code@everything-claude-code   # confirm
```

Or declaratively in `~/.claude/settings.json` (better for reproducibility):

```json
{
  "extraKnownMarketplaces": {
    "everything-claude-code": {
      "source": { "source": "github", "repo": "robertclapp/everything-claude-code" }
    }
  },
  "enabledPlugins": {
    "everything-claude-code@everything-claude-code": true
  }
}
```

Plugin commands are **namespaced**: `/everything-claude-code:plan "..."`.

### Mode B — Clone and manual (full control, or pre-merge)

```bash
git clone https://github.com/robertclapp/everything-claude-code.git
cd everything-claude-code

cp agents/*.md   ~/.claude/agents/
cp commands/*.md ~/.claude/commands/
cp -r .agents/skills/* ~/.claude/skills/        # core skills
```

With Mode B, commands use the **short form**: `/plan "..."`.

---

## Phase 2 — Install rules (REQUIRED — the most-missed step)

Claude Code plugins **cannot ship `rules/`** (an upstream limitation). Rules are
what enforce coding style, git workflow, the test-coverage bar, and mandatory
security checks — they are what makes this "production grade" rather than just a
command palette. Use the cross-platform installer:

```bash
# From the cloned repo — works on Windows/macOS/Linux (Node-based):
node scripts/install.js typescript                  # common rules + your stack
node scripts/install.js typescript python golang    # multiple stacks

# POSIX shell users can still use:
./install.sh typescript
```

- **User-level** (all projects): the default target installs to `~/.claude/rules/`.
- **Project-level** (one repo — preferred for teams, see Phase 6): copy into
  `./.claude/rules/` instead.

Verify:

```bash
ls ~/.claude/rules/        # expect common-* plus your language rules
```

See `rules/README.md` for structure and manual-install details.

---

## Phase 3 — Confirm hooks are active

Hooks provide the safety rails: secret detection on prompts, auto-format and
typecheck after edits, `console.log` warnings, blocking dev servers outside
tmux, and session memory persistence.

- On Claude Code **v2.1+, `hooks/hooks.json` auto-loads** from the installed
  plugin. Do nothing — and specifically **never** add a `"hooks"` field to
  `.claude-plugin/plugin.json` (it triggers a "Duplicate hooks file" error).
- For **Mode B**, merge the entries from `hooks/hooks.json` into
  `~/.claude/settings.json`.

Smoke test: edit a `.ts` file containing `console.log` and confirm you get the
`[Hook] Remove console.log` warning.

---

## Phase 4 — Configure MCP servers and secrets

This is where production discipline matters most: **secrets must never be
committed.**

### 4.1 Copy only what you need

Copy the servers you actually use from `mcp-configs/mcp-servers.json` into
`~/.claude.json`. The file ships GitHub, Supabase, Vercel, Railway, and others
with `YOUR_*_HERE` placeholders.

### 4.2 Inject secrets via environment, not literals

```json
{ "mcpServers": { "github": { "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" } } } }
```

Keep the real values in your shell profile, a secret manager, or a git-ignored
`.env`.

### 4.3 Cap MCP count to protect your context window

Keep **under 10 MCPs and under 80 active tools**. Disable the rest per project:

```json
{ "disabledMcpServers": ["supabase", "railway", "vercel"] }
```

Each MCP's tool descriptions consume your 200k context; unmanaged, it can shrink
to roughly 70k. This is the most common "Claude got worse" cause.

---

## Phase 5 — Cost and token controls

Set production defaults in `~/.claude/settings.json`:

```json
{
  "model": "sonnet",
  "env": {
    "MAX_THINKING_TOKENS": "10000",
    "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "50",
    "CLAUDE_CODE_SUBAGENT_MODEL": "haiku"
  }
}
```

Daily levers: `/model opus` only for hard architecture or debugging; `/clear`
between unrelated tasks; `/compact` at logical breakpoints (the bundled
`strategic-compact` skill prompts you); `/cost` to monitor spend.

---

## Phase 6 — Make it a team standard (commit it to your repos)

Do not rely on each developer's `~/.claude`. Bake the configuration **into each
product repo** so it is versioned and onboarding is one `git pull`:

```bash
# Inside your product repo:
mkdir -p .claude/rules .claude/commands
node /path/to/everything-claude-code/scripts/install.js typescript   # project-level target
cp -r /path/to/everything-claude-code/agents/*.md .claude/agents/    # optional: pin agents
```

Commit:

- `.claude/rules/` — enforced standards (the real value)
- `.claude/settings.json` — model defaults, `disabledMcpServers`, PM pin
- A project `CLAUDE.md` — see `examples/saas-nextjs-CLAUDE.md`,
  `examples/django-api-CLAUDE.md`, `examples/go-microservice-CLAUDE.md`, and
  `examples/rust-api-CLAUDE.md` for real-world templates
- `.claude/package-manager.json`

**Do not commit** `~/.claude.json` or any file containing MCP secrets.

Onboarding then becomes: clone repo, run `claude`, add personal secrets to env.

---

## Phase 7 — Wire the daily workflows

These workflows turn "installed" into "in production use":

**New feature**

```text
/plan "Add user authentication with OAuth"   -> planner: blueprint
/tdd                                          -> tests first, coverage bar
/code-review                                  -> quality + security pass
```

**Bug fix**

```text
/tdd          -> failing test reproduces the bug -> fix -> green
/code-review  -> catch regressions
```

**Pre-release gate (run before every production deploy)**

```text
/security-scan   -> AgentShield OWASP-style audit of config + code
/e2e             -> critical user-flow tests
/test-coverage   -> confirm coverage threshold
```

---

## Phase 8 — Security hardening

1. **Run AgentShield regularly.** It scans CLAUDE.md, settings, MCP configs,
   hooks, agents, and skills for secrets, permission issues, and injection
   risks:

   ```bash
   npx ecc-agentshield scan            # quick
   npx ecc-agentshield scan --fix      # auto-fix safe issues
   ```

   Exit code 2 on critical findings makes it usable as a build gate.

2. **Disclosure policy.** `SECURITY.md` defines how vulnerabilities are
   reported; keep it in the repo.

3. **Secret hygiene.** The secret-detection hooks (`sk-`, `ghp_`, `AKIA...`) and
   the `.env`/`.key`/`.pem` read blocks are part of the hook set; confirm they
   are active (Phase 3).

---

## Phase 9 — CI integration

Turn the standards into gates. Useful commands from this repo:

```bash
npm run doctor      # health self-check: env, inventory, component consistency
npm test            # validators (agents/commands/rules/skills/hooks/links/version-sync/llms) + suite
npm run coverage    # c8 coverage report
```

In CI for **your product repos**, add a security gate:

```yaml
- run: npx ecc-agentshield scan        # fails the build on critical findings
```

CodeQL and Dependabot are configured in this repo to keep its own code and
dependencies scanned; mirror that pattern where it helps.

---

## Phase 10 — Verify the install is healthy

```bash
/plugin list everything-claude-code@everything-claude-code   # commands/agents/skills present?
npm run doctor                                               # or: node scripts/doctor.js
ls ~/.claude/rules/                                          # rules present?
```

`doctor` exits non-zero if anything is broken — wire it into onboarding so a bad
install fails loudly.

---

## Other harnesses (optional)

- **Cursor:** `node scripts/install.js --target cursor typescript` installs to
  `.cursor/`.
- **Codex CLI:** `cp .codex/config.toml ~/.codex/config.toml`, then run `codex`
  in the repo (AGENTS.md is auto-detected). Codex has no hooks yet — security is
  instruction- and sandbox-based.
- **OpenCode:** `npm install ecc-universal`, then add `"plugin": ["ecc-universal"]`
  to `opencode.json`.

---

## Maintenance

- **Updates:** `/plugin marketplace update` (Mode A) or `git pull` plus
  re-running `node scripts/install.js <lang>` (Mode B) to refresh rules.
- **Dependabot** raises weekly dependency and action PRs; review and merge.
- **Re-run `npm run doctor`** after every plugin update to catch drift.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Duplicate hooks file detected" | Remove any `"hooks"` field from `.claude-plugin/plugin.json` |
| Commands not found | Mode A uses `/everything-claude-code:plan`; Mode B uses `/plan` |
| Context shrinking / lower quality | Too many MCPs — set `disabledMcpServers`, stay under 10 MCPs / 80 tools |
| Rules not applying | They do not ship via plugin — run Phase 2 manually |
| Hooks silent | Requires Claude Code v2.1.0+ |
