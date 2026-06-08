---
description: Run a plugin health self-check — validates components, manifest version sync, internal links, and environment setup.
---

# Doctor

Runs `everything-claude-code`'s health self-check to confirm the plugin is
installed and internally consistent.

## What This Command Does

1. **Environment**: Confirms Node.js >= 18 and that a package manager is detectable
2. **Inventory**: Confirms agents, skills, and commands are present
3. **Validation**: Runs every component validator (agents, commands, rules, skills, hooks)
4. **Integrity**: Checks internal markdown links resolve, manifests are version-synced, and `llms.txt` is current
5. **Report**: Prints a per-check pass/fail summary and exits non-zero if anything is broken

## Usage

```bash
npm run doctor
# or directly
node scripts/doctor.js
```

## When to Use

- After installing or updating the plugin
- After adding a new agent, skill, or command
- When something isn't loading and you want a fast integrity check
- In CI as a smoke test before publishing

## Related

- Script: `scripts/doctor.js`
- Validators: `scripts/ci/validate-*.js`
