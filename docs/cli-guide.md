# APEX CLI Guide

This comprehensive guide covers all CLI commands, keyboard shortcuts, session management, and display modes available in APEX.

## Table of Contents

- [Getting Started](#getting-started)
- [Starting APEX](#starting-apex)
- [REPL Commands](#repl-commands)
- [Session Management](#session-management)
- [Display Modes](#display-modes)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Natural Language Tasks](#natural-language-tasks)
- [Server Management](#server-management)
- [Task Management](#task-management)
- [Configuration](#configuration)

---

## Getting Started

APEX provides two interface modes:

1. **Rich Terminal UI** (default) - Modern Ink-based interface with real-time updates
2. **Classic Mode** - Traditional readline-based interface

```bash
# Start with rich UI (default)
apex

# Start with classic readline UI
apex --classic

# Run a command directly without entering REPL
apex <command> [args]
```

---

## Starting APEX

### Command-Line Options

```bash
apex                    # Start interactive REPL (rich UI)
apex --classic          # Start with classic readline UI
apex <command> [args]   # Run a command directly
apex --help             # Show help information
apex --version          # Show version
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (required) |
| `APEX_CLASSIC_UI` | Set to `1` to use classic UI by default |

---

## REPL Commands

All REPL commands start with `/`. Commands can be typed in the interactive prompt.

### Core Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `/help` | `h`, `?` | Show available commands |
| `/init` | - | Initialize APEX in current project |
| `/status` | `s` | Show task status |
| `/agents` | `a` | List available agents |
| `/workflows` | `w` | List available workflows |
| `/config` | `c` | View or edit configuration |
| `/version` | `v` | Show version |
| `/clear` | `cls` | Clear the screen |
| `/exit` | `quit`, `q` | Exit APEX |

### `/help` - Show Available Commands

Displays all available REPL commands with their aliases and descriptions.

```
apex> /help

Available Commands:

  /help (h, ?)            Show available commands
  /init                   Initialize APEX in the current project
  /status (s)             Show task status
  /agents (a)             List available agents
  /workflows (w)          List available workflows
  ...

Or just type a natural language task description to execute it.
```

### `/init` - Initialize APEX

Initializes APEX in the current project directory, creating the `.apex/` configuration folder.

**Usage:**
```bash
/init [--yes] [--name <name>] [--language <lang>] [--framework <fw>]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--yes` | `-y` | Skip prompts, use defaults |
| `--name` | `-n` | Project name |
| `--language` | `-l` | Primary language (typescript, python, etc.) |
| `--framework` | `-f` | Framework (nextjs, fastapi, etc.) |

**Examples:**
```bash
/init                                    # Interactive initialization
/init --yes                              # Use defaults
/init --name my-project --language python
/init -n api-server -l typescript -f fastify
```

**Created Files:**
- `.apex/config.yaml` - Project configuration
- `.apex/agents/` - Agent definition files
- `.apex/workflows/` - Workflow definitions
- `.apex/apex.db` - SQLite task database

### `/status` - Show Task Status

View task status and history.

**Usage:**
```bash
/status [task_id]
```

**Examples:**
```bash
/status                    # List recent tasks
/status task_abc123_def456 # Show details for specific task
```

**Output (list mode):**
```
Recent Tasks:

  task_abc123_def ✅ completed      $0.15  Add health check endpoint
  task_xyz789_ghi 🔄 in-progress    $0.08  Implement user auth
  task_def456_jkl ❌ failed         $0.03  Fix login bug
```

**Output (detail mode):**
```
Task: task_abc123_def456
Status: ✅ completed
Description: Add health check endpoint
Workflow: feature
Branch: apex/abc123-add-health-check
Created: 12/15/2024, 10:30:00 AM
Tokens: 45,234
Cost: $0.1523
```

### `/agents` - List Available Agents

Display all configured agents with their capabilities.

**Example Output:**
```
Available Agents:

  ✓ planner (opus)
    Creates implementation plans and breaks down tasks into subtasks
    Tools: Read, Grep, Glob

  ✓ architect (opus)
    Designs system architecture and makes technical decisions
    Tools: Read, Grep, Glob, Write

  ✓ developer (sonnet)
    Implements features and writes production code
    Tools: Read, Write, Edit, MultiEdit, Bash, Grep, Glob

  ✓ tester (sonnet)
    Creates and runs tests, analyzes coverage
    Tools: Read, Write, Bash, Grep

  ✓ reviewer (haiku)
    Reviews code for quality, bugs, and security issues
    Tools: Read, Grep, Glob
```

### `/workflows` - List Available Workflows

Display all configured workflows with their stages.

**Example Output:**
```
Available Workflows:

  feature
    Full feature implementation workflow
    Stages: planning → architecture → implementation → testing → review

  bugfix
    Bug investigation and fix workflow
    Stages: investigation → fix → testing → review

  refactor
    Code refactoring workflow
    Stages: analysis → refactor → testing → review
```

### `/config` - View or Edit Configuration

View or modify APEX configuration.

**Usage:**
```bash
/config                           # Show full configuration
/config --json                    # Output as JSON
/config get <key>                 # Get specific value
/config set <key>=<value>         # Set a value
```

**Examples:**
```bash
/config                           # Show formatted config
/config get project.name          # Get project name
/config set limits.maxCostPerTask=20.00
/config set autonomy.default=full
```

### `/run` - Run a Task

Execute a task with specific options.

**Usage:**
```bash
/run "<description>" [--workflow <name>] [--autonomy <level>] [--priority <level>]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--workflow` | `-w` | Workflow to use (feature, bugfix, refactor) |
| `--autonomy` | `-a` | Autonomy level |
| `--priority` | `-p` | Task priority |

**Autonomy Levels:**
- `full` - Complete autonomy, executes without stopping
- `review-before-commit` - Pauses before each commit
- `review-before-merge` - Creates PR, waits for approval
- `manual` - Pauses at each stage

**Examples:**
```bash
/run "Add login endpoint" --workflow feature
/run "Fix user validation bug" -w bugfix -a manual
/run "Refactor auth module" --workflow refactor --priority high
```

### `/logs` - Show Task Logs

View logs for a specific task.

**Usage:**
```bash
/logs <task_id> [--level <level>] [--limit <n>]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--level` | `-l` | Filter by log level (debug, info, warn, error) |
| `--limit` | `-n` | Limit number of log entries (default: 20) |

**Examples:**
```bash
/logs task_abc123           # Show logs for task
/logs task_abc123 --level error  # Show only errors
/logs task_abc123 -n 50     # Show last 50 entries
```

### `/cancel` - Cancel a Running Task

Cancel a task that is currently in progress.

**Usage:**
```bash
/cancel <task_id>
```

### `/retry` - Retry a Failed Task

Retry a task that has failed or been cancelled.

**Usage:**
```bash
/retry <task_id>
```

**Note:** Only tasks with status `failed`, `cancelled`, `in-progress`, or `planning` can be retried.

### `/resume` - Resume a Paused Task

Resume a task that has been paused (e.g., due to rate limits).

**Usage:**
```bash
/resume [task_id]
```

Without a task ID, shows all paused tasks:
```
Paused Tasks:

  task_abc123_d │ rate_limit   │ Auto-resume: 10:35:00 AM    │ Add user authentication
  task_xyz789_g │ user_request │ Manual resume required      │ Refactor database layer

Use /resume <task_id> to resume a specific task.
```

### `/pr` - Create Pull Request

Create a GitHub pull request for a completed task.

**Usage:**
```bash
/pr <task_id> [--draft]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--draft` | `-d` | Create as draft PR |

---

## Session Management

APEX automatically manages sessions, tracking your conversation history, tasks, and costs.

### Session Commands

All session commands use the `/session` prefix:

| Command | Description |
|---------|-------------|
| `/session list` | List available sessions |
| `/session load <id>` | Load a session |
| `/session save <name>` | Save current session with a name |
| `/session branch [name]` | Create a branch from current session |
| `/session export` | Export session to file |
| `/session delete <id>` | Delete a session |
| `/session info` | Show current session info |

### `/session list` - List Sessions

**Usage:**
```bash
/session list [--all] [--search <query>]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--all` | Include archived sessions |
| `--search <query>` | Filter by name or content |

**Example Output:**
```
Sessions:

  abc123def456 │ Feature Development     │ 45 msgs │ $1.23 │ 12/15/2024
  xyz789ghi012 │ Bug Investigation       │ 12 msgs │ $0.34 │ 12/14/2024
  def456jkl789 │ Unnamed                 │  8 msgs │ $0.15 │ 12/13/2024 (archived)
```

### `/session load` - Load a Session

Load a previously saved session to continue where you left off.

**Usage:**
```bash
/session load <session_id|name>
```

**Example:**
```bash
/session load abc123def456
/session load "Feature Development"
```

### `/session save` - Save Current Session

Save the current session with a name and optional tags.

**Usage:**
```bash
/session save <name> [--tags <tag1,tag2,...>]
```

**Examples:**
```bash
/session save "Auth Implementation"
/session save "Sprint 5 Work" --tags sprint5,auth,backend
```

### `/session branch` - Create Session Branch

Create a new session branching from the current conversation at a specific point.

**Usage:**
```bash
/session branch [<name>] [--from <message_index>]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--from <index>` | Message index to branch from (0-based) |

**Examples:**
```bash
/session branch "Alternative Approach"
/session branch "Try Redux" --from 15
```

### `/session export` - Export Session

Export the current session to a file.

**Usage:**
```bash
/session export [--format md|json|html] [--output <file>]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--format` | Output format: `md` (default), `json`, `html` |
| `--output` | Output file path |

**Examples:**
```bash
/session export                           # Preview as markdown
/session export --format json --output session.json
/session export --format html --output report.html
```

### `/session info` - Current Session Info

Display information about the current active session.

**Example Output:**
```
Current Session:
  ID: abc123def456ghi789
  Name: Feature Development
  Messages: 45
  Created: 12/15/2024, 9:00:00 AM
  Updated: 12/15/2024, 11:30:00 AM
  Total Cost: $1.2345
  Tokens: 125,456
  Tags: auth, backend
  Branches: 2
  Unsaved changes: 3
```

---

## Display Modes

APEX supports three display modes to customize output verbosity:

| Mode | Description |
|------|-------------|
| `normal` | Standard display with all components (default) |
| `compact` | Condensed output, single-line status |
| `verbose` | Detailed debug information |

### `/compact` - Toggle Compact Mode

Toggles between compact and normal display mode.

**Compact Mode Changes:**
- Banner: Single line with version and project name
- StatusBar: Essential metrics only
- ActivityLog: Hidden
- Messages: Truncated to single lines
- AgentPanel: Current agent only
- TaskProgress: Single status line

**Usage:**
```bash
/compact              # Toggle compact mode
```

### `/verbose` - Toggle Verbose Mode

Toggles between verbose and normal display mode.

**Verbose Mode Additions:**
- Full debug logging
- Detailed token breakdown
- Message timestamps and IDs
- Complete tool input/output JSON
- Agent event stream with timing

**Usage:**
```bash
/verbose              # Toggle verbose mode
```

### `/thoughts` - Toggle AI Reasoning Display

Control visibility of AI reasoning/thinking process.

**Usage:**
```bash
/thoughts [on|off|toggle|status]
```

**Examples:**
```bash
/thoughts             # Toggle visibility
/thoughts on          # Enable thought display
/thoughts off         # Disable thought display
/thoughts status      # Show current setting
```

### `/preview` - Toggle Preview Mode

Enable/disable preview of actions before execution.

**Usage:**
```bash
/preview [on|off|toggle|status]
```

**Examples:**
```bash
/preview              # Toggle preview mode
/preview on           # Enable previews
/preview off          # Disable previews
```

---

## Keyboard Shortcuts

APEX supports comprehensive keyboard shortcuts for efficient navigation and control.

### Global Shortcuts

| Shortcut | Description |
|----------|-------------|
| `Ctrl+C` | Cancel current operation |
| `Ctrl+D` | Exit APEX |
| `Ctrl+L` | Clear screen |
| `?` | Show help (when idle) |

### Input Shortcuts

| Shortcut | Description |
|----------|-------------|
| `Ctrl+U` | Clear current line |
| `Ctrl+W` | Delete word before cursor |
| `Ctrl+A` | Move cursor to start of line |
| `Ctrl+E` | Move cursor to end of line |
| `Escape` | Cancel current input |

### History Navigation

| Shortcut | Description |
|----------|-------------|
| `Ctrl+P` or `↑` | Previous history item |
| `Ctrl+N` or `↓` | Next history item |
| `Ctrl+R` | Reverse search history |

### Auto-Completion

| Shortcut | Description |
|----------|-------------|
| `Tab` | Auto-complete command or path |
| `Tab` (with suggestions) | Select next suggestion |
| `Shift+Tab` | Select previous suggestion |
| `Escape` | Dismiss suggestions |

---

## Natural Language Tasks

You can enter natural language task descriptions directly without any command prefix. APEX will interpret your request and execute it using the appropriate workflow.

### Examples

```bash
apex> Add a health check endpoint to the API

apex> Fix the bug where users can't reset their password

apex> Refactor the authentication module to use JWT tokens

apex> Add unit tests for the user service

apex> Update the README with installation instructions
```

### Task Execution Flow

When you enter a natural language task:

1. **Task Creation** - APEX creates a task with a unique ID
2. **Branch Creation** - A git branch is created for the changes
3. **Workflow Execution** - The appropriate workflow runs through its stages:
   - Planning - Break down the task
   - Architecture - Design the solution
   - Implementation - Write the code
   - Testing - Create and run tests
   - Review - Review the changes
4. **Completion** - Summary with tokens, cost, and duration

### Output Example

```
🚀 Starting task...

Task created: task_abc123_def456
Branch: apex/abc123-add-health-check
Workflow: feature

📍 Stage: planning
  🔧 Read
  🔧 Grep

📍 Stage: architecture
  🔧 Read
  🔧 Write

📍 Stage: implementation
  🔧 Write
  🔧 Edit
  🔧 Bash

📍 Stage: testing
  🔧 Write
  🔧 Bash

📍 Stage: review
  🔧 Read

╭──────────────────────────╮
│ ✅ Task Completed        │
│                          │
│ Tokens: 45,234           │
│ Cost: $0.1523            │
│ Duration: 3m 42s         │
╰──────────────────────────╯
```

---

## Server Management

APEX can run API and Web UI servers for integration with other tools.

### `/serve` - Start API Server

Start the REST API server for programmatic access.

**Usage:**
```bash
/serve [--port <port>]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--port` | `-p` | Port number (default: 3000) |

**Example:**
```bash
/serve                # Start on default port 3000
/serve --port 8080    # Start on port 8080
```

### `/web` - Start Web UI

Start the Next.js web interface.

**Usage:**
```bash
/web [--port <port>]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--port` | `-p` | Port number (default: 3001) |

**Example:**
```bash
/web                  # Start on default port 3001
/web --port 8081      # Start on port 8081
```

### `/stop` - Stop Servers

Stop running background servers.

**Usage:**
```bash
/stop [api|web|all]
```

**Examples:**
```bash
/stop                 # Stop all servers
/stop api             # Stop only API server
/stop web             # Stop only Web UI
```

### Auto-Start Configuration

Configure servers to start automatically in `.apex/config.yaml`:

```yaml
api:
  port: 3000
  autoStart: true

webUI:
  port: 3001
  autoStart: true
```

---

## Task Management

### Task Lifecycle

Tasks progress through the following states:

| Status | Icon | Description |
|--------|------|-------------|
| `pending` | ⏳ | Task created, waiting to start |
| `queued` | 📋 | Task queued for execution |
| `planning` | 🤔 | Planning stage in progress |
| `in-progress` | 🔄 | Task actively executing |
| `waiting-approval` | ✋ | Waiting for user approval |
| `paused` | ⏸️ | Task paused (rate limit, user request) |
| `completed` | ✅ | Task finished successfully |
| `failed` | ❌ | Task failed with error |
| `cancelled` | 🚫 | Task cancelled by user |

### Working with Branches

APEX creates git branches for each task:
- Branch format: `apex/<task_id_prefix>-<slug>`
- Example: `apex/abc123-add-health-check`

### Cost and Token Tracking

APEX tracks usage for each task:
- **Input Tokens** - Tokens sent to the AI
- **Output Tokens** - Tokens received from the AI
- **Estimated Cost** - Cost based on model pricing

View with `/status <task_id>` or in the status bar.

---

## Configuration

### Configuration File Location

```
.apex/
├── config.yaml       # Main configuration
├── agents/           # Agent definitions
├── workflows/        # Workflow definitions
├── apex.db           # SQLite database
└── scripts/          # Helper scripts
```

### Key Configuration Options

```yaml
version: "1.0"

project:
  name: "my-project"
  language: "typescript"
  framework: "nextjs"

autonomy:
  default: "review-before-merge"

models:
  planning: "opus"
  implementation: "sonnet"
  review: "haiku"

limits:
  maxTokensPerTask: 1000000
  maxCostPerTask: 10.00
  dailyBudget: 50.00

api:
  port: 3000
  autoStart: false

webUI:
  port: 3001
  autoStart: false

agents:
  disabled: []  # List of disabled agent names
```

### Common Configuration Tasks

**Change default autonomy:**
```bash
/config set autonomy.default=full
```

**Increase cost limit:**
```bash
/config set limits.maxCostPerTask=25.00
```

**Enable API auto-start:**
```bash
/config set api.autoStart=true
```

---

## Tips and Best Practices

### 1. Use Descriptive Task Descriptions

```bash
# Good
Add a REST endpoint at /api/users/{id} that returns user profile data with proper error handling

# Less effective
Add user endpoint
```

### 2. Leverage Autonomy Levels

- Use `full` for repetitive, well-understood tasks
- Use `manual` when learning or for critical changes
- Use `review-before-merge` for production code

### 3. Monitor Costs

- Check the status bar for running cost
- Use `/status` to review task costs
- Set `limits.maxCostPerTask` appropriately

### 4. Use Session Management

- Save sessions with meaningful names
- Use branches to try alternative approaches
- Export sessions for documentation

### 5. Customize Display Mode

- Use `/compact` for focused work
- Use `/verbose` for debugging
- Use `/thoughts` to understand AI reasoning

---

## Getting Help

- **In-app Help:** `/help` or `?`
- **Documentation:** [https://github.com/JoshuaAFerguson/apex](https://github.com/JoshuaAFerguson/apex)
- **Issues:** [GitHub Issues](https://github.com/JoshuaAFerguson/apex/issues)
- **Discussions:** [GitHub Discussions](https://github.com/JoshuaAFerguson/apex/discussions)
