---
name: [skill-name-in-kebab-case]
description: [Imperative sentence specifying exact trigger and operational outcome. Max 250 characters.]
---

# [Skill Name in Human-Readable Title]

Canonical specification for [skill-name].

## 1. Scope & Blast Radius

- **MUTABLE PATHS:** `[Declared output paths, e.g., src/**, .agent/**]`
- **IMMUTABLE PATHS:** `[Protected paths, e.g., data/schedule.db, .env, *.lock]`
- **FORBIDDEN ACTIONS:**
  - `[Negative constraint 1, e.g., MUST NOT execute destructive schema mutations directly]`
  - `[Negative constraint 2, e.g., MUST NOT log credentials or secrets]`

## 2. When to Use (Triggers)

The agent MUST activate this skill when:
- [Trigger 1: Exact technical condition or explicit user instruction]
- [Trigger 2: Invariant domain condition]

The agent MUST NOT activate this skill when:
- [Anti-trigger 1: Condition delegated to another named skill]
- [Anti-trigger 2: Condition out of scope]

## 3. Required Tools & Prerequisites

- **Tools / MCPs:** `[e.g., uv, pytest, ruff, mypy, homelab-schedule MCP, none]`
- **Pre-Conditions:** `[Verifiable binary criteria, e.g., git status is clean, database connection is valid]`

## 4. Conflict Resolution & Precedence

Precedence order when rules conflict:
1. Security, Credentials & Blast Radius (Immutable Paths)
2. Falsifiable Invariants & Automated Verification
3. Task Specifications & Performance
4. Style & Formatting Conventions

If an unresolvable rule conflict occurs, the agent MUST halt execution and request human clarification.

## 5. Operational Procedure

### Step 1: Pre-Flight Verification
1. Verify [exact invariant with automated command].
2. Assert [binary condition or state].

### Step 2: Execution
1. Execute [actionable technical instruction].
2. Enforce [domain constraints and error contracts].

### Step 3: Validation
1. Run [validation command or test suite].
2. Assert exit code == 0 and [expected output condition].

## 6. Fail-Stop & Escalation Protocol

- **Retry Limit:** If any step fails 2 consecutive times with the same error, STOP execution immediately.
- **Escalation Payload:** Report MUST state:
  1. Identified root cause
  2. Exact commands executed and raw error output
  3. Current workspace state and git diff
- **Forbidden Action:** The agent MUST NOT attempt undocumented ad-hoc workarounds or bypass safety checks once the retry limit is reached.

## 7. Git & Environment Safety

- **Forbidden Git Commands:** NEVER run `git push --force`, `git reset --hard`, or `git clean -fd` without explicit human instruction.
- **Secret Protection:** NEVER print, log, or transmit secrets, `.env` file contents, API tokens, or private keys in command outputs or agent responses.

## 8. Contrast Pairs

```[language]
// BAD: [Prohibited implementation pattern]
[bad_code_example]

// GOOD: [Required compliant pattern]
[good_code_example]
```

*(Safety Rule: For security-sensitive constraints, OMIT the BAD example; state constraint as MUST NOT plus a single GOOD example).*

## 9. Verification Checklist

- [ ] Command `[verification-command]` exits with status code 0
- [ ] Output conforms strictly to `[declared contract/schema]`
- [ ] Zero unverified changes in immutable paths
- [ ] No secrets, credentials, or tokens exposed
