# Security Policy

## Supported Versions

This project ships configuration (agents, skills, commands, rules, hooks) and a
small set of zero-dependency Node.js utilities. Security fixes are applied to the
latest released minor version.

| Version | Supported          |
| ------- | ------------------ |
| 1.7.x   | :white_check_mark: |
| < 1.7   | :x:                |

## Reporting a Vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report suspected vulnerabilities privately via one of:

1. **GitHub Security Advisories** — open a private report at
   [Security → Report a vulnerability](https://github.com/affaan-m/everything-claude-code/security/advisories/new)
   (preferred).
2. **Email** — `me@affaanmustafa.com` with subject `SECURITY: everything-claude-code`.

Please include:

- A description of the issue and its impact.
- Steps to reproduce (a minimal proof-of-concept where possible).
- Affected version(s) and environment (OS, Node version, package manager).

### What to expect

- **Acknowledgement** within 72 hours.
- An initial assessment and severity classification within 7 days.
- Coordinated disclosure: we will agree on a timeline before any public details
  are shared, and credit reporters who wish to be named.

## Scope

In scope:

- The Node.js utilities under `scripts/` and `tests/` (command injection, path
  traversal, unsafe file handling, prototype pollution, etc.).
- Hook configurations in `hooks/` and `scripts/hooks/` that execute commands.
- The installer (`scripts/install.js`, `install.sh`).
- MCP server configurations in `mcp-configs/` that could leak secrets.

Out of scope:

- Vulnerabilities in third-party tools, MCP servers, or models that this repo
  merely references or configures.
- Social-engineering or physical attacks.
- The contents of prompts/skills themselves (these are advisory text, not
  executable trust boundaries) — though report anything that could cause an
  agent to take a destructive action by default.

## Hardening notes for users

- Review hooks before enabling them — hooks can run arbitrary commands on tool
  use. See [`hooks/README.md`](hooks/README.md).
- Never commit real secrets to `mcp-configs/`; use environment variables. The
  repo's `.gitignore` excludes common secret file patterns.
- Run `/security-scan` and the `security-reviewer` agent on your own code before
  shipping.
