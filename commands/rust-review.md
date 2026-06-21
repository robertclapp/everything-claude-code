---
description: Comprehensive Rust code review for ownership, borrowing, error handling, async safety, and idiomatic patterns. Invokes the rust-reviewer agent.
---

# Rust Code Review

This command invokes the **rust-reviewer** agent for comprehensive Rust-specific code review.

## What This Command Does

1. **Identify Rust Changes**: Find modified `.rs` files via `git diff`
2. **Run Static Analysis**: Execute `cargo clippy` and `cargo fmt --check`
3. **Safety Review**: Audit every `unsafe` block for documented invariants
4. **Ownership Review**: Flag unnecessary clones, interior-mutability overuse, lifetime smells
5. **Async Review**: Check for blocking calls and locks held across `.await`
6. **Generate Report**: Categorize issues by severity

## When to Use

Use `/rust-review` when:

- After writing or modifying Rust code
- Before committing Rust changes
- Reviewing pull requests with Rust code
- Onboarding to a new Rust codebase
- Learning idiomatic Rust patterns

## Automated Checks Run

```bash
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
cargo build --release
cargo audit          # if cargo-audit installed
```

## Approval Criteria

| Status      | Condition                                |
| ----------- | ---------------------------------------- |
| ✅ Approve  | No CRITICAL or HIGH issues               |
| ⚠️ Warning  | Only MEDIUM issues (merge with caution)  |
| ❌ Block    | CRITICAL or HIGH issues found            |

## Related

- Agent: `agents/rust-reviewer.md`
- Use `/code-review` for non-Rust-specific concerns
