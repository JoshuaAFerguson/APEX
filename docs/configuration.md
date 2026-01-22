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
  typecheckCommand: "npm run typecheck"

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

# Linting integration
linter:
  global:
    enabled: true
    runAfterEdit: true
    parallel: false
    failFast: false
    timeoutMs: 60000
  integrations:
    ide:
      autoFixOnSave: true

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

# Permission presets for tool access control
permissions:
  preset: "review-all"  # "autonomous", "review-all", or "read-only"
  customRules:
    - tool: "Read"
      behavior: "allow"  # Allow read operations without confirmation
    - tool: "Write"
      behavior: "confirm"
      scope: "/src/**"
      reason: "Source files require review"
    - tool: "Bash"
      behavior: "deny"  # Block shell commands

# Policy rules and approvals
policy:
  enabled: true
  approvalRules:
    enabled: true
    rules:
      - id: "modify-approval"
        name: "Modify approval"
        conditions:
          - type: "operation"
            operations: ["modify"]
        approvers: ["security"]
        minApprovals: 1

# Secret detection in tool outputs
scanner:
  onSecretDetected: "mask" # "log" | "warn" | "mask" | "block"
  includeBuiltInPatterns: true
  maskSecrets: true
  contextLength: 20
  customPatterns:
    - name: "stripe-secret"
      pattern: "sk_live_[a-zA-Z0-9]{24,}"
      secretType: "stripe-secret"
      severity: "high"

# Guardrails override scanner behavior when enabled
guardrails:
  enabled: true
  enforcement: "warn"
  secrets:
    enabled: true
    onDetection: "mask"
    includeBuiltInPatterns: true

# Per-tool configuration overrides
tools:
  Browser:
    backend: "puppeteer"
    engine: "chromium"
    headless: true

# API server settings
api:
  url: "http://localhost:3000"
  port: 3000

# Slack integration
slack:
  enabled: true
  mode: socket
  defaultChannel: "#apex"
  notificationChannels:
    - "#apex"
  threadUpdates: true
  useBlocks: true
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

### linter

Configure linting behavior and lint-after-edit automation.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `global.enabled` | boolean | `true` | Enable linting |
| `global.runAfterEdit` | boolean | `false` | Lint files after tool-driven edits |
| `global.parallel` | boolean | `true` | Run linters in parallel |
| `global.failFast` | boolean | `false` | Stop on first linter failure |
| `global.timeoutMs` | number | `60000` | Lint timeout in milliseconds |
| `integrations.ide.autoFixOnSave` | boolean | `false` | Apply auto-fixes during lint-after-edit |

### codeQuality

Automation for pre-edit validation and typecheck feedback.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `preEditValidation.enabled` | boolean | `false` | Validate JSON/YAML before file edits |
| `preEditValidation.mode` | string | `warn` | `warn` or `block` on invalid content |
| `typecheck.enabled` | boolean | `false` | Enable typecheck integration |
| `typecheck.runAfterEdit` | boolean | `false` | Run typecheck after tool-driven edits |
| `typecheck.command` | string | `project.typecheckCommand` | Typecheck command override |
| `typecheck.timeoutMs` | number | `60000` | Typecheck timeout in milliseconds |
| `typecheck.failOnError` | boolean | `false` | Reserved for future enforcement control |

### customTools

Define custom tools executed as local commands via an in-process MCP server.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `customTools[].name` | string | - | Tool name (unique) |
| `customTools[].description` | string | - | Tool description shown to the agent |
| `customTools[].command` | string | - | Command to execute |
| `customTools[].args` | array | `[]` | Command arguments; supports `{{input}}` or `{{input.key}}` |
| `customTools[].parameters` | object | `{}` | JSON Schema for tool parameters |
| `customTools[].outputParser` | string | `text` | `text`, `json`, or `lines` |
| `customTools[].timeoutMs` | number | `60000` | Tool execution timeout in milliseconds |
| `customTools[].workingDirectory` | string | - | Working directory override |
| `customTools[].env` | object | - | Environment variables for the tool |
| `customTools[].enabled` | boolean | `true` | Enable/disable the tool |

### mcp

Configure MCP servers and marketplace sources.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `mcp.enabled` | boolean | `true` | Enable MCP integration |
| `mcp.servers` | object | `{}` | Map of server names to MCP configs |
| `mcp.servers.<name>.type` | string | `stdio` | `stdio`, `http`, `sse`, or `sdk` |
| `mcp.servers.<name>.command` | string | - | Command for stdio servers |
| `mcp.servers.<name>.args` | array | - | Args for stdio servers |
| `mcp.servers.<name>.env` | object | - | Environment variables for stdio servers |
| `mcp.servers.<name>.url` | string | - | URL for `http`/`sse` servers |
| `mcp.servers.<name>.headers` | object | - | Headers for `http`/`sse` servers |
| `mcp.marketplace.url` | string | - | Marketplace JSON URL or local path |
| `mcp.marketplace.enabled` | boolean | `true` | Enable marketplace lookups |
| `mcp.marketplace.refreshIntervalMinutes` | number | `1440` | Refresh interval for marketplace cache |
| `mcp.marketplace.allowUnverified` | boolean | `false` | Allow unverified entries |

### tdd

Test-driven development automation settings.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `tdd.enabled` | boolean | `false` | Enable TDD automation |
| `tdd.testCommand` | string | `npm test` | Test command to run |
| `tdd.watchMode` | boolean | `false` | Enable watch mode (manual use) |
| `tdd.maxIterations` | number | `5` | Max fix iterations in auto-correction loop |
| `tdd.regressionGuard` | boolean | `true` | Run full test suite after corrections |

### policy

Policy rules control path restrictions, approvals, and test requirements during execution. Approval rules can trigger task pauses when a tool action matches configured conditions.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable policy enforcement |
| `enforcement` | string | `warn` | `strict`, `warn`, `audit`, or `disabled` |
| `allowedPaths.mode` | string | `allowlist` | `allowlist` or `blocklist` |
| `allowedPaths.allow` | array | `[]` | Allowed path globs when using allowlist mode |
| `allowedPaths.block` | array | `[]` | Blocked path globs (always enforced) |
| `allowedPaths.sensitivePatterns` | array | `[]` | Paths requiring explicit approval |
| `requiredTests.enforcement` | string | `warn` | `none`, `warn`, or `require` |
| `requiredTests.rules` | array | `[]` | Test requirement rules (source/test patterns) |
| `approvalRules.enabled` | boolean | `true` | Enable approval rule evaluation |
| `approvalRules.rules` | array | `[]` | Approval rules for operations and thresholds |

### scanner

Configure secret scanning for tool outputs. When secrets are detected, APEX emits `secret:detected` and applies the configured behavior.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `onSecretDetected` | string | `warn` | `log` (info only), `warn`, `mask` (redact with `[REDACTED]`), or `block` |
| `includeBuiltInPatterns` | boolean | `true` | Enable built-in secret patterns |
| `customPatterns` | array | `[]` | Custom secret patterns |
| `maskSecrets` | boolean | `true` | Mask secret matches in findings |
| `contextLength` | number | `20` | Characters of context around detections |
| `maxLineLength` | number | `10000` | Maximum line length to scan |

### guardrails

Guardrails provide a unified configuration for secret handling and policy enforcement. When `guardrails.secrets` is enabled, it overrides `scanner` settings for detection behavior.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable guardrails |
| `enforcement` | string | `warn` | `warn`, `block`, or `audit` |
| `secrets.enabled` | boolean | `true` | Enable secret guardrails |
| `secrets.onDetection` | string | `warn` | `log`, `warn`, `mask`, or `block` |
| `secrets.includeBuiltInPatterns` | boolean | `true` | Include built-in secret patterns |
| `secrets.customPatterns` | array | `[]` | Custom secret patterns |

### workspace

Workspace isolation configuration for running tasks in controlled environments.

> **Complete Reference**: For detailed documentation of all container configuration fields, see the [Container Configuration Reference](./container-configuration.md).

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

### permissions

Permission presets control which tools agents can use and when user confirmation is required.

```yaml
permissions:
  preset: "review-all"         # Permission preset: autonomous, review-all, read-only
  customRules:                 # Override preset behavior for specific tools
    - tool: "Read"
      behavior: "allow"        # allow, confirm, deny
    - tool: "Write"
      behavior: "confirm"
      scope: "/src/**"
      reason: "Source files require review"
    - tool: "Bash"
      behavior: "deny"
```

#### Permission Presets

| Preset | Description | Use Case |
|--------|-------------|----------|
| `autonomous` | All tools allowed without confirmation | Full automation, trusted environments |
| `review-all` | All tools require user confirmation (default) | Manual review of every action |
| `read-only` | Only read-only tools allowed | Code exploration, analysis without changes |

#### Custom Rules

Override preset behavior for specific tools with custom rules:

| Field | Type | Description |
|-------|------|-------------|
| `tool` | string | Tool name (supports wildcards like `Web*`) |
| `behavior` | string | `allow`, `confirm`, or `deny` |
| `scope` | string | Optional scope restriction (e.g., file path pattern) |
| `reason` | string | Optional reason for this permission rule |

#### Browser tool backend

Browser backend selection lives in the `tools.Browser` config in `.apex/config.yaml`.
Set `backend` to `playwright` or `puppeteer` along with browser-specific controls:

```yaml
tools:
  Browser:
    backend: "puppeteer"
    engine: "chromium"
    headless: true
```

You can also set it from the CLI:

```text
/browser backend puppeteer
```

Additional CLI helpers:

```text
/browser engine chromium
/browser headless true
```

#### Tool Categories

**Read-only tools** (safe in `read-only` preset):
- `Read`, `Grep`, `Glob` - File system reading
- `WebFetch`, `WebSearch` - Web access

**Write/execute tools** (restricted in `read-only` preset):
- `Write`, `Edit`, `MultiEdit`, `NotebookEdit` - File modifications
- `Bash` - Command execution
- `TodoWrite` - Todo management

### daemon

Daemon configuration for background task processing and time-based usage management.

```yaml
daemon:
  pollInterval: 5000       # Daemon polling interval (ms)
  autoStart: false         # Start daemon automatically
  logLevel: "info"         # Daemon log level

  # Time-based usage management
  timeBasedUsage:
    enabled: true
    dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17]
    nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6]
    dayModeCapacityThreshold: 0.80
    nightModeCapacityThreshold: 0.95
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `pollInterval` | number | 5000 | Daemon polling interval in milliseconds |
| `autoStart` | boolean | false | Start daemon automatically with APEX |
| `logLevel` | string | `info` | Log level (debug, info, warn, error) |

> **Complete Reference**: For detailed time-based usage configuration including day/night modes, auto-pause/resume, and capacity management, see the [Time-Based Usage Management Guide](./time-based-usage-management.md).

### slack

Slack integration for Socket Mode task management via `/apex`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | false | Enable Slack integration |
| `mode` | string | `socket` | Socket Mode connection |
| `defaultChannel` | string | `#apex` | Default channel for responses |
| `notificationChannels` | string[] | `[]` | Additional channels for task updates |
| `threadUpdates` | boolean | true | Post task updates in command threads |
| `useBlocks` | boolean | true | Use Block Kit formatting |

## Environment Variables

These override configuration file settings:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | API key (required) |
| `APEX_PROJECT` | Project directory |
| `APEX_API` | API server URL |
| `GH_TOKEN` | GitHub token for PR creation |
| `SLACK_APP_TOKEN` | Slack App-Level Token (Socket Mode) |
| `SLACK_BOT_TOKEN` | Slack Bot Token |
| `SLACK_DEFAULT_CHANNEL` | Default Slack channel |
| `SLACK_NOTIFICATION_CHANNELS` | Comma-separated channel list |
| `SLACK_THREAD_UPDATES` | Set `false` to disable thread updates |
| `SLACK_USE_BLOCKS` | Set `false` to disable Block Kit |

## Per-Task Overrides

Override settings when running tasks:

```bash
apex run "task" --autonomy full --workflow bugfix
```
