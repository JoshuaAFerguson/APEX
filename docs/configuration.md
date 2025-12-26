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

# Workspace isolation settings
workspace:
  defaultStrategy: "none"
  cleanupOnComplete: true
  container:
    image: "node:20-alpine"
    resourceLimits:
      cpu: 2
      memory: "4g"
      memoryReservation: "2g"
      cpuShares: 1024
      pidsLimit: 1000
    networkMode: "bridge"
    environment:
      NODE_ENV: "development"
    autoRemove: true
    installTimeout: 300000

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

### workspace

Workspace isolation configuration for running tasks in controlled environments.

```yaml
workspace:
  defaultStrategy: "container"  # none, directory, worktree, container
  cleanupOnComplete: true
  container:
    image: "node:20-alpine"
    resourceLimits:
      cpu: 2
      memory: "4g"
      memoryReservation: "2g"
      cpuShares: 1024
      pidsLimit: 1000
    networkMode: "bridge"
    environment:
      NODE_ENV: "development"
      NPM_CONFIG_UPDATE_NOTIFIER: "false"
    autoRemove: true
    installTimeout: 300000
```

#### Workspace Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| `none` | No isolation (default) | Development on local machine |
| `directory` | Copy to isolated directory | Simple file isolation |
| `worktree` | Use Git worktrees | Branch isolation |
| `container` | Run in Docker container | Full environment isolation |

#### Container Resource Limits

Resource limits control CPU, memory, and process constraints for containerized tasks.

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `cpu` | number | 0.1-64 | CPU limit in cores (e.g., 0.5 for half core) |
| `memory` | string | - | Memory limit with unit (e.g., "256m", "1g", "2048m") |
| `memoryReservation` | string | - | Memory reservation (soft limit) |
| `memorySwap` | string | - | Maximum memory swap with unit |
| `cpuShares` | number | 2-262144 | CPU shares for relative weighting (1024 = 1 share) |
| `pidsLimit` | number | 1+ | Maximum number of processes allowed |

**Memory Units**: Support standard suffixes - k/K (kilobytes), m/M (megabytes), g/G (gigabytes)

#### Container Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `image` | string | - | Docker image (e.g., "node:20-alpine") |
| `dockerfile` | string | - | Path to custom Dockerfile |
| `buildContext` | string | "." | Build context for custom images |
| `imageTag` | string | - | Custom tag for built images |
| `volumes` | object | - | Host:container path mappings |
| `environment` | object | - | Environment variables |
| `resourceLimits` | object | - | CPU/memory constraints |
| `networkMode` | string | "bridge" | Network mode (bridge/host/none) |
| `workingDir` | string | - | Working directory in container |
| `user` | string | - | User to run as (e.g., "1000:1000") |
| `autoRemove` | boolean | true | Remove container after completion |
| `installTimeout` | number | - | Dependency installation timeout (ms) |

#### Per-Task Resource Overrides

Individual tasks can override the default resource limits:

```bash
# CLI override example
apex run "build project" --workspace-strategy container \
  --container-cpu 4 --container-memory "8g"

# Programmatic override via task configuration
{
  "workspace": {
    "strategy": "container",
    "container": {
      "resourceLimits": {
        "cpu": 1,
        "memory": "2g",
        "pidsLimit": 500
      }
    }
  }
}
```

**Available Override Options**:
- `--workspace-strategy`: Change isolation strategy
- `--container-cpu`: Override CPU limit
- `--container-memory`: Override memory limit
- `--container-memory-reservation`: Override memory reservation
- `--container-cpu-shares`: Override CPU shares
- `--container-pids-limit`: Override process limit

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
