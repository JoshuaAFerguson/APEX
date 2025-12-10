# Configuration Reference

APEX is configured through `.apex/config.yaml` in your project root.

## Full Configuration Example

```yaml
version: "1.0"

# Project information
project:
  name: "my-project"
  language: "typescript"
  framework: "nextjs"
  testCommand: "npm test"
  lintCommand: "npm run lint"
  buildCommand: "npm run build"

# Autonomy settings
autonomy:
  default: "review-before-merge"
  overrides:
    documentation: "full"
    database-migrations: "manual"
    security-fixes: "review-before-commit"

# Agent configuration
agents:
  enabled:
    - planner
    - architect
    - developer
    - reviewer
    - tester
  disabled:
    - devops  # Disable if not needed

# Model selection per task type
models:
  planning: "opus"
  implementation: "sonnet"
  review: "haiku"

# Approval gates
gates:
  - name: "architecture-review"
    trigger: "after:architecture"
    required: true
    timeout: 60  # minutes
    
  - name: "pre-merge"
    trigger: "before:merge"
    required: true

# Git workflow settings
git:
  branchPrefix: "apex/"
  commitFormat: "conventional"  # or "simple"
  autoPush: true
  defaultBranch: "main"

# Cost and usage limits
limits:
  maxTokensPerTask: 500000
  maxCostPerTask: 10.00
  dailyBudget: 100.00
  maxTurns: 100
  maxConcurrentTasks: 3

# API server settings
api:
  url: "http://localhost:3000"
  port: 3000
```

## Configuration Sections

### project

Basic project metadata used by agents for context.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | (required) | Project name |
| `language` | string | - | Primary language |
| `framework` | string | - | Framework in use |
| `testCommand` | string | `npm test` | Command to run tests |
| `lintCommand` | string | `npm run lint` | Command to run linting |
| `buildCommand` | string | `npm run build` | Command to build |

### autonomy

Control how much human oversight APEX requires.

| Level | Description |
|-------|-------------|
| `full` | No human approval needed |
| `review-before-commit` | Pause before each commit |
| `review-before-merge` | Create PR, wait for approval |
| `manual` | Pause at every stage |

Use `overrides` to set different levels for specific workflows or task types.

### agents

Control which agents are available.

```yaml
agents:
  enabled:
    - planner
    - developer
  disabled:
    - devops
```

If `enabled` is empty, all agents except those in `disabled` are available.

### models

Select Claude models for different task types.

| Type | Description | Recommended |
|------|-------------|-------------|
| `planning` | Task planning, architecture | opus |
| `implementation` | Code writing | sonnet |
| `review` | Code review | haiku |

Options: `opus`, `sonnet`, `haiku`

### gates

Define approval checkpoints in workflows.

```yaml
gates:
  - name: "security-review"
    trigger: "after:implementation"
    required: true
    timeout: 120  # minutes
    approvers:
      - security-team
```

### git

Configure Git behavior.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `branchPrefix` | string | `apex/` | Prefix for feature branches |
| `commitFormat` | string | `conventional` | Commit message style |
| `autoPush` | boolean | `true` | Auto-push commits |
| `defaultBranch` | string | `main` | Main branch name |

### limits

Safety limits to control costs.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxTokensPerTask` | number | 500000 | Max tokens per task |
| `maxCostPerTask` | number | 10.00 | Max cost in USD |
| `dailyBudget` | number | 100.00 | Daily budget in USD |
| `maxTurns` | number | 100 | Max agent turns |
| `maxConcurrentTasks` | number | 3 | Parallel task limit |

## Environment Variables

These override configuration file settings:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | API key (required) |
| `APEX_PROJECT` | Project directory |
| `APEX_API` | API server URL |
| `GH_TOKEN` | GitHub token for PR creation |

## Per-Task Overrides

Override settings when running tasks:

```bash
apex run "task" --autonomy full --workflow bugfix
```
