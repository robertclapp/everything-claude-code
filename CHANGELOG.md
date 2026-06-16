# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `SECURITY.md` responsible-disclosure policy and supported-versions matrix.
- `.editorconfig` and `.gitattributes` (LF normalization) for cross-platform consistency.
- Prettier formatting (`.prettierrc`), with `format` / `format:check` npm scripts and CI gate.
- Cross-platform Node installer `scripts/install.js` (now the `ecc-install` bin), replacing the bash-only `bin` entry.
- Auto-generated `llms.txt` index plus `scripts/generate-llms-txt.js` (`npm run llms`).
- New CI validators: internal-link checker (`validate-links.js`), version-sync gate (`validate-version-sync.js`), and `llms.txt` freshness check (`validate-llms-txt.js`).
- Test coverage measurement via `c8` (`npm run coverage`).
- `/doctor` command + `scripts/doctor.js` plugin-health self-check.
- New `rust-reviewer` and `dependency-auditor` agents, and `/rust-review` command.
- Supply-chain scanning: Dependabot config and CodeQL workflow.
- `docs/PRODUCTION_GUIDE.md` — step-by-step guide for adopting the plugin in production (install, rules, MCP/secrets, cost controls, team rollout, security, CI, and verification).

### Fixed

- Two non-deterministic tests that failed under root (read-only-file assertions) now skip on root, matching the existing guard pattern — suite is deterministic at 992/992.
- `package.json` shipped a `files` reference to a non-existent `llms.txt`; the file is now generated and committed.
- Hardened a test source-patching regex to tolerate reformatting.
- Corrected a stale `commit.md` reference in `CONTRIBUTING.md`.

### Security

- `release.yml` now passes `github.ref_name` through an `env:` variable in the tag-validation step instead of interpolating it directly into the shell, removing a workflow script-injection sink (git tag names may contain shell metacharacters).
- CodeQL analysis is scoped to shipped runtime code (`scripts/`) via `.github/codeql/codeql-config.yml`, excluding test fixtures and vendored files (not an attack surface, not published), and uses the default high-precision query suite instead of `security-and-quality` to keep findings actionable.

## [1.7.0] — 2026-02

- Codex app + CLI support; installer targeting and Codex docs.
- `frontend-slides` skill — zero-dependency HTML presentation builder.
- Five new business/content skills: `article-writing`, `content-engine`, `market-research`, `investor-materials`, `investor-outreach`.
- Broader cross-harness coverage (Cursor, Codex, OpenCode).

## [1.6.0] — 2026-02

- Codex CLI support via `/codex-setup`.
- Seven new skills including `search-first`, `swift-actor-persistence`, `cost-aware-llm-pipeline`, `skill-stocktake`.
- AgentShield integration via `/security-scan`.
- GitHub Marketplace listing.

## [1.4.1] — 2026-02

- Fixed instinct import content loss in `parse_instinct_file()` during `/instinct-import`.

## [1.4.0] — 2026-02

- Interactive installation wizard (`configure-ecc`).
- PM2 & multi-agent orchestration commands.
- Multi-language rules architecture (`common/` + per-language directories).
- Simplified Chinese translations.

## [1.3.0] — 2026-02

- Full OpenCode integration (agents, commands, skills, hooks).
- Three native custom tools: run-tests, check-coverage, security-audit.
- `llms.txt` documentation for OpenCode.

## [1.2.0] — 2026-02

- Python/Django and Java Spring Boot skill suites.
- `/sessions` command for session history.
- Continuous learning v2 (instinct-based, with import/export and evolution).

[Unreleased]: https://github.com/affaan-m/everything-claude-code/compare/v1.7.0...HEAD
[1.7.0]: https://github.com/affaan-m/everything-claude-code/releases/tag/v1.7.0
[1.6.0]: https://github.com/affaan-m/everything-claude-code/releases/tag/v1.6.0
[1.4.1]: https://github.com/affaan-m/everything-claude-code/releases/tag/v1.4.1
[1.4.0]: https://github.com/affaan-m/everything-claude-code/releases/tag/v1.4.0
[1.3.0]: https://github.com/affaan-m/everything-claude-code/releases/tag/v1.3.0
[1.2.0]: https://github.com/affaan-m/everything-claude-code/releases/tag/v1.2.0
