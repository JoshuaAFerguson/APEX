# APEX CLI Guide

This comprehensive guide covers all CLI commands, keyboard shortcuts, session management, and display modes available in APEX.

## Table of Contents

- [Getting Started](#getting-started)
- [Starting APEX](#starting-apex)
- [REPL Commands](#repl-commands)
- [Session Management](#session-management)
- [Display Modes](#display-modes)
- [StatusBar Reference](#statusbar-reference)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Natural Language Tasks](#natural-language-tasks)
- [Server Management](#server-management)
- [Task Management](#task-management)
- [Configuration](#configuration)

**✨ NEW in v0.3.0**: See the [Complete v0.3.0 Features Overview](features/v030-features.md) for detailed documentation of all enhanced features.

---

## Getting Started

APEX provides two interface modes:

1. **Rich Terminal UI** (default) - Modern Ink-based interface with real-time updates ✨ NEW in v0.3.0
2. **Classic Mode** - Traditional readline-based interface

```bash
# Start with rich UI (default)
apex

# Start with classic readline UI
apex --classic

# Run a command directly without entering REPL
apex <command> [args]
```

### ✨ What's New in v0.3.0

APEX v0.3.0 introduces a completely redesigned terminal experience with:
- **[Rich Terminal Interface](#starting-apex)** - Real-time streaming output and visual feedback
- **[Display Modes](#display-modes)** - Compact, normal, and verbose display options ([detailed guide](user-guide/display-modes.md))
- **[Input Preview](#preview---toggle-preview-mode--new-in-v030)** - Preview commands before execution with intent detection ([detailed guide](user-guide/input-preview.md))
- **[Enhanced Session Management](#session-management)** - Improved persistence and branching capabilities
- **[Advanced Keyboard Shortcuts](#keyboard-shortcuts)** - Comprehensive shortcut system with auto-completion

See the [Complete v0.3.0 Features Overview](features/v030-features.md) for in-depth technical details and examples.

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

> **✨ NEW in v0.3.0**: Enhanced session management with improved persistence, branching capabilities, and visual feedback. Session data now integrates seamlessly with the rich terminal interface.

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

> **✨ NEW in v0.3.0**: Enhanced display modes with improved terminal interface and responsive design. See the detailed [Display Modes User Guide](user-guide/display-modes.md) for comprehensive usage examples and best practices.

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

### `/preview` - Toggle Preview Mode ✨ NEW in v0.3.0

Enable/disable preview of actions before execution with intent detection and confidence levels.

> See the comprehensive [Input Preview User Guide](user-guide/input-preview.md) for detailed usage examples, best practices, and troubleshooting.

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

## StatusBar Reference

The StatusBar component provides real-time session and task information at the bottom of the APEX interface. It features a sophisticated responsive design with priority-based element display that adapts to your terminal width and selected display mode.

> **✨ NEW in v0.3.0**: The StatusBar component has been completely redesigned with responsive behavior, priority-based element visibility, and mode-specific enhancements. It intelligently adapts to terminal width and display modes to ensure critical information is always visible.

### Visual Example

**Full StatusBar (Wide Terminal, Normal Mode):**
```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ● ⎇ main | ⚡developer | ▶implementation | 📋 [2/5]                                                tokens: 45.2k | cost: $0.1523 | model: sonnet | 05:23 │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 ↑   ↑       ↑             ↑                  ↑                                                       ↑               ↑              ↑            ↑
 │   │       │             │                  │                                                       │               │              │            │
 │   │       │             │                  └─ Subtask Progress                                     │               │              │            └─ Session Timer
 │   │       │             └─ Workflow Stage                                                          │               │              └─ Model Indicator
 │   │       └─ Agent Indicator                                                                       │               └─ Cost Display
 │   └─ Git Branch                                                                                    └─ Token Count
 └─ Connection Status
```

**Compact Mode:**
```
┌─────────────────────────────────────────────┐
│ ● main | $0.1523                            │
└─────────────────────────────────────────────┘
```

**Verbose Mode (Additional Elements):**
```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ● main | ⚡dev | ▶impl | 📋 [2/5] | 💾 my-session | api:3000 | web:3001     tokens: 12.5k→8.2k | total: 20.7k | cost: $0.15 | session: $1.25 | model: sonnet | active: 3m42s | idle: 1m18s | stage: 45s | 🔍 VERBOSE │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Display Elements

The StatusBar displays up to 21 different elements organized by priority and side. Elements are automatically hidden or abbreviated based on terminal width and display mode.

#### Priority System

| Priority | Level | Description | Visibility |
|----------|-------|-------------|------------|
| **CRITICAL** | Always shown | Core functionality indicators | All widths, all modes |
| **HIGH** | Essential | Important status information | Normal+ terminal widths |
| **MEDIUM** | Standard | Detailed progress information | Wide terminal widths |
| **LOW** | Extended | Additional context and debug info | Wide terminals, verbose mode |

#### Left Side Elements

##### 1. Connection Status (●/○)

**Visual Example:**
```
● (connected) or ○ (disconnected)
```

**Location:** Left side (leftmost)
**Priority:** CRITICAL
**Icon/Label:** Solid/hollow circle indicating connection state

**Description:**
Real-time connection status to the APEX backend services. This is always visible as it's critical for understanding if your commands can be executed.

**Color Coding:**
| State | Color | Meaning |
|-------|-------|---------|
| ● | Green | Connected and ready |
| ○ | Red | Disconnected or error |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| All | ✓ | ✓ | ✓ |

##### 2. Git Branch (⎇ branch-name)

**Visual Example:**
```
⎇ main
⎇ feature/auth-impl
⎇ apex/abc123-fix-bug
```

**Location:** Left side
**Priority:** HIGH
**Icon/Label:** Git branch symbol (⎇) followed by branch name

**Description:**
Current git branch name, essential for tracking which branch your changes are being made to. APEX creates specific branches for tasks.

**Format:**
- Full branch names in normal and verbose modes
- Truncated to 12 characters with `...` in narrow terminals
- Branch names longer than available space are abbreviated

**Color Coding:**
| Element | Color | Meaning |
|---------|-------|---------|
| ⎇ | Cyan | Branch icon |
| Name | Yellow | Branch name |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Narrow+ | ✓ | ✓ | ✓ |

##### 3. Agent Indicator (⚡agent-name)

**Visual Example:**
```
⚡developer
⚡planner
⚡architect
```

**Location:** Left side
**Priority:** HIGH
**Icon/Label:** Lightning bolt (⚡) followed by active agent name

**Description:**
Shows which AI agent is currently active or was last active. Different agents have different capabilities and are used for different workflow stages.

**Common Agent Names:**
- `planner` - Creates implementation plans
- `architect` - Designs system architecture
- `developer` - Implements features and writes code
- `tester` - Creates and runs tests
- `reviewer` - Reviews code quality

**Color Coding:**
| Element | Color | Meaning |
|---------|-------|---------|
| ⚡ | Magenta | Agent icon |
| Name | White | Agent name |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Normal+ | ✗ | ✓ | ✓ |

##### 4. Workflow Stage (▶stage-name)

**Visual Example:**
```
▶planning
▶architecture
▶implementation
▶testing
▶review
```

**Location:** Left side
**Priority:** MEDIUM
**Icon/Label:** Play arrow (▶) followed by current workflow stage

**Description:**
Current stage in the workflow execution. Workflows typically progress through planning, architecture, implementation, testing, and review stages.

**Common Stages:**
- `planning` - Breaking down tasks and creating plans
- `architecture` - Designing technical solutions
- `implementation` - Writing code and making changes
- `testing` - Creating and running tests
- `review` - Code review and quality checks

**Color Coding:**
| Element | Color | Meaning |
|---------|-------|---------|
| ▶ | Blue | Stage icon |
| Name | Gray | Stage name |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Wide | ✗ | ✓ | ✓ |

##### 5. Subtask Progress (📋 [X/Y])

**Visual Example:**
```
📋 [2/5]
📋 [0/3]
📋 [5/5]
```

**Location:** Left side
**Priority:** MEDIUM
**Icon/Label:** Clipboard (📋) followed by completion count in brackets

**Description:**
Shows progress through subtasks within the current workflow stage. Useful for understanding how much work remains in the current stage.

**Format:**
- `[completed/total]` format
- Only shown when total > 0

**Color Coding:**
| State | Color | Meaning |
|-------|-------|---------|
| 📋 | Cyan | Progress icon |
| [X/Y] incomplete | Yellow | Work in progress |
| [Y/Y] complete | Green | Stage completed |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Wide | ✗ | ✓ | ✓ |

##### 6. Session Name (💾 session-name)

**Visual Example:**
```
💾 my-project-work
💾 auth-feature
💾 bug-investigation
```

**Location:** Left side
**Priority:** LOW
**Icon/Label:** Floppy disk (💾) followed by session name

**Description:**
Named session identifier when you've saved your current session with a custom name using `/session save`.

**Format:**
- Session names longer than 15 characters are truncated with `...`
- Only shown when a session has been explicitly named

**Color Coding:**
| Element | Color | Meaning |
|---------|-------|---------|
| 💾 | Blue | Session icon |
| Name | Cyan | Session name |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Wide | ✗ | ✗ | ✓ |

##### 7. API URL (api:port)

**Visual Example:**
```
api:3000
→ 3000 (abbreviated)
```

**Location:** Left side
**Priority:** LOW
**Icon/Label:** `api:` or `→` (abbreviated) followed by port number

**Description:**
Shows the port number where the APEX API server is running. Useful when integrating with other tools or debugging connectivity.

**Format:**
- Full format: `api:3000`
- Abbreviated format: `→ 3000`
- Shows port only (localhost is assumed)

**Color Coding:**
| Element | Color | Meaning |
|---------|-------|---------|
| Label | Gray | URL label |
| Port | Green | Port number |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Wide | ✗ | ✗ | ✓ |

##### 8. Web URL (web:port)

**Visual Example:**
```
web:3001
↗ 3001 (abbreviated)
```

**Location:** Left side
**Priority:** LOW
**Icon/Label:** `web:` or `↗` (abbreviated) followed by port number

**Description:**
Shows the port number where the APEX Web UI is running. The web interface provides a browser-based alternative to the CLI.

**Format:**
- Full format: `web:3001`
- Abbreviated format: `↗ 3001`
- Shows port only (localhost is assumed)

**Color Coding:**
| Element | Color | Meaning |
|---------|-------|---------|
| Label | Gray | URL label |
| Port | Green | Port number |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Wide | ✗ | ✗ | ✓ |

#### Right Side Elements

##### 9. Session Timer (MM:SS)

**Visual Example:**
```
05:23
12:05
00:42
```

**Location:** Right side (rightmost)
**Priority:** CRITICAL
**Icon/Label:** Time in MM:SS format

**Description:**
Elapsed time since the current session started. Helps track how long you've been working and estimate task duration. Updates every second.

**Format:**
- `MM:SS` format (minutes:seconds)
- Continues counting indefinitely
- Resets when starting a new session

**Color Coding:**
| Element | Color | Meaning |
|---------|-------|---------|
| Time | Gray | Session elapsed time |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Normal+ | ✗ | ✓ | ✓ |

##### 10. Model Indicator (model: name)

**Visual Example:**
```
model: sonnet
m: sonnet (abbreviated)
model: opus
model: haiku
```

**Location:** Right side
**Priority:** HIGH
**Icon/Label:** `model:` or `m:` (abbreviated) followed by model name

**Description:**
Shows which AI model is currently being used for task execution. Different models have different capabilities and costs.

**Common Models:**
- `sonnet` - Balanced performance and cost
- `opus` - Highest capability, most expensive
- `haiku` - Fastest, most economical

**Format:**
- Full format: `model: sonnet`
- Abbreviated format: `m: sonnet`

**Color Coding:**
| Element | Color | Meaning |
|---------|-------|---------|
| Label | Gray | Model label |
| Name | Blue | Model name |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Normal+ | ✗ | ✓ | ✓ |

##### 11. Cost Display (cost: $X.XXXX)

**Visual Example:**
```
cost: $0.1523
$0.1523 (abbreviated - no label)
cost: $0.0045
```

**Location:** Right side
**Priority:** HIGH
**Icon/Label:** `cost:` label (hidden when abbreviated) followed by dollar amount

**Description:**
Current task cost in USD. Tracks the estimated cost of API calls for the current task. Essential for monitoring usage and staying within budgets.

**Format:**
- Full format: `cost: $0.1523`
- Abbreviated format: `$0.1523` (no label)
- Always shows 4 decimal places
- Updates in real-time during task execution

**Color Coding:**
| Element | Color | Meaning |
|---------|-------|---------|
| Label | Gray | Cost label |
| Amount | Green | Dollar amount |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Narrow+ | ✓ | ✓ | ✓ |

##### 12. Token Count (tokens: X.Xk)

**Visual Example:**
```
tokens: 45.2k
tk: 1.5k (abbreviated)
tokens: 234
```

**Location:** Right side
**Priority:** MEDIUM
**Icon/Label:** `tokens:` or `tk:` (abbreviated) followed by formatted count

**Description:**
Total token count (input + output) for the current task. Tokens are the units that AI models process, and understanding token usage helps with cost and performance optimization.

**Format:**
- Numbers ≥ 1M: `1.5M`
- Numbers ≥ 1k: `45.2k`
- Numbers < 1k: Show exact number
- Full format: `tokens: 45.2k`
- Abbreviated format: `tk: 45.2k`

**Color Coding:**
| Element | Color | Meaning |
|---------|-------|---------|
| Label | Gray | Token label |
| Count | Cyan | Token count |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Wide | ✗ | ✓ | See Verbose Elements |

#### Verbose Mode Only Elements

These elements are only shown in verbose mode and provide additional debugging and monitoring information.

##### 13. Token Breakdown (tokens: X.Xk→Y.Yk)

**Visual Example:**
```
tokens: 12.5k→8.2k
tk: 1.5k→800 (abbreviated)
```

**Location:** Right side
**Priority:** MEDIUM
**Icon/Label:** `tokens:` or `tk:` (abbreviated) followed by input→output breakdown

**Description:**
In verbose mode, shows detailed token breakdown as input→output instead of just total. Helps understand the ratio of context vs. generation.

**Format:**
- Format: `input→output`
- Uses same number formatting as total tokens
- Replaces the simple token count in verbose mode

**Color Coding:**
| Element | Color | Meaning |
|---------|-------|---------|
| Label | Gray | Token label |
| Breakdown | Cyan | Input→output counts |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Wide | ✗ | ✗ | ✓ |

##### 14. Total Tokens (total: X.Xk)

**Visual Example:**
```
total: 20.7k
∑: 2.3k (abbreviated)
```

**Location:** Right side
**Priority:** MEDIUM
**Icon/Label:** `total:` or `∑:` (abbreviated) followed by total count

**Description:**
In verbose mode, shows the total token count alongside the detailed breakdown. Provides both detailed and summary views of token usage.

**Format:**
- Same number formatting as other token displays
- Full format: `total: 20.7k`
- Abbreviated format: `∑: 20.7k`

**Color Coding:**
| Element | Color | Meaning |
|---------|-------|---------|
| Label | Gray | Total label |
| Count | Blue | Total token count |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Wide | ✗ | ✗ | ✓ |

##### 15. Session Cost (session: $X.XXXX)

**Visual Example:**
```
session: $1.2500
sess: $5.67 (abbreviated)
```

**Location:** Right side
**Priority:** LOW
**Icon/Label:** `session:` or `sess:` (abbreviated) followed by session total

**Description:**
Cumulative cost for the entire session when different from current task cost. Helps track total spending across multiple tasks in a session.

**Format:**
- Full format: `session: $1.2500`
- Abbreviated format: `sess: $1.25`
- Only shown when different from current task cost
- 4 decimal places for precision

**Color Coding:**
| Element | Color | Meaning |
|---------|-------|---------|
| Label | Gray | Session label |
| Amount | Yellow | Session cost total |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Wide | ✗ | ✗ | ✓ |

##### 16. Active Time (active: XmXXs)

**Visual Example:**
```
active: 3m42s
a: 1m30s (abbreviated)
active: 45s
```

**Location:** Right side
**Priority:** MEDIUM
**Icon/Label:** `active:` or `a:` (abbreviated) followed by duration

**Description:**
Total time spent actively processing (not idle or waiting). Useful for understanding actual work time vs. total elapsed time.

**Format:**
- Hours: `2h15m` (when ≥1 hour)
- Minutes: `3m42s` (when ≥1 minute)
- Seconds: `45s` (when <1 minute)
- Full format: `active: 3m42s`
- Abbreviated format: `a: 3m42s`

**Color Coding:**
| Element | Color | Meaning |
|---------|-------|---------|
| Label | Gray | Active label |
| Duration | Green | Active processing time |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Wide | ✗ | ✗ | ✓ |

##### 17. Idle Time (idle: XmXXs)

**Visual Example:**
```
idle: 1m18s
i: 2m5s (abbreviated)
idle: 30s
```

**Location:** Right side
**Priority:** MEDIUM
**Icon/Label:** `idle:` or `i:` (abbreviated) followed by duration

**Description:**
Total time spent waiting or idle (not actively processing). Includes time waiting for API responses, user input, or rate limits.

**Format:**
- Same time formatting as active time
- Full format: `idle: 1m18s`
- Abbreviated format: `i: 1m18s`

**Color Coding:**
| Element | Color | Meaning |
|---------|-------|---------|
| Label | Gray | Idle label |
| Duration | Yellow | Idle/waiting time |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Wide | ✗ | ✗ | ✓ |

##### 18. Stage Time (stage: XmXXs)

**Visual Example:**
```
stage: 45s
s: 2m15s (abbreviated)
stage: 1m30s
```

**Location:** Right side
**Priority:** MEDIUM
**Icon/Label:** `stage:` or `s:` (abbreviated) followed by duration

**Description:**
Time elapsed in the current workflow stage. Resets when transitioning between stages. Useful for understanding how long each stage takes.

**Format:**
- Same time formatting as other durations
- Full format: `stage: 45s`
- Abbreviated format: `s: 45s`
- Resets to 0s when stage changes

**Color Coding:**
| Element | Color | Meaning |
|---------|-------|---------|
| Label | Gray | Stage label |
| Duration | Cyan | Current stage elapsed time |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Wide | ✗ | ✗ | ✓ |

##### 19. Preview Mode Indicator (📋 PREVIEW)

**Visual Example:**
```
📋 PREVIEW
```

**Location:** Right side
**Priority:** LOW
**Icon/Label:** Clipboard icon (📋) followed by "PREVIEW"

**Description:**
Indicator that preview mode is enabled. Preview mode shows command intent and confidence before execution.

**Color Coding:**
| Element | Color | Meaning |
|---------|-------|---------|
| Indicator | Cyan | Preview mode active |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Wide | ✗ | ✓ | ✓ |

##### 20. Thoughts Display Indicator (💭 THOUGHTS)

**Visual Example:**
```
💭 THOUGHTS
```

**Location:** Right side
**Priority:** LOW
**Icon/Label:** Thought bubble (💭) followed by "THOUGHTS"

**Description:**
Indicator that AI reasoning/thinking process display is enabled. Shows the AI's thought process during task execution.

**Color Coding:**
| Element | Color | Meaning |
|---------|-------|---------|
| Indicator | Magenta | Thoughts display active |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Wide | ✗ | ✓ | ✓ |

##### 21. Verbose Mode Indicator (🔍 VERBOSE)

**Visual Example:**
```
🔍 VERBOSE
```

**Location:** Right side
**Priority:** LOW
**Icon/Label:** Magnifying glass (🔍) followed by "VERBOSE"

**Description:**
Indicator that verbose mode is active. Reminds you that you're seeing enhanced debug information and all available elements.

**Color Coding:**
| Element | Color | Meaning |
|---------|-------|---------|
| Indicator | Cyan | Verbose mode active |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Wide | ✗ | ✗ | ✓ |

### Responsive Behavior

The StatusBar automatically adapts to your terminal width using a priority-based system:

| Terminal Width | Display Tier | Elements Shown |
|----------------|--------------|----------------|
| < 60 columns | Narrow | CRITICAL + HIGH priority only, abbreviated labels |
| 60-160 columns | Normal | CRITICAL + HIGH + MEDIUM priority, full labels |
| > 160 columns | Wide | All priority levels, full labels + extended details |

**Responsive Features:**
- **Automatic abbreviation**: Labels become shorter (e.g., `tokens:` → `tk:`) in narrow terminals
- **Progressive hiding**: Lower priority elements disappear first when space is limited
- **Value compression**: Long values are truncated with `...` when necessary
- **Mode override**: Compact mode always shows minimal info, verbose mode overrides width constraints

### Display Mode Variations

#### Compact Mode
Always shows only essential elements regardless of terminal width:
- Connection status (●)
- Git branch
- Current task cost

#### Normal Mode
Respects responsive tier filtering based on terminal width:
- Shows priority-appropriate elements for current width
- Uses full labels when space allows
- Hides verbose-only elements

#### Verbose Mode
Shows maximum information regardless of terminal width:
- All 21 possible elements when data is available
- Detailed timing breakdown
- Token input→output breakdown
- Session cost tracking
- Mode indicator

### Color Coding Reference

The StatusBar uses consistent color coding across all elements:

| Color | Usage | Examples |
|-------|-------|----------|
| **Green** | Success, connected, active processing | Connection (●), cost amounts, active time |
| **Red** | Error, disconnected, failed | Connection (○) when disconnected |
| **Yellow** | Warning, in-progress, totals | Branch names, incomplete progress, session costs |
| **Blue** | Information, models, stage indicators | Workflow stage (▶), model names, totals |
| **Cyan** | Progress, data, mode indicators | Token counts, session names, mode indicators |
| **Magenta** | Agents, special features | Agent indicator (⚡), thoughts display |
| **Gray** | Labels, secondary info, timers | All labels, session timer, secondary text |
| **White** | Primary content | Agent names, most display values |

### Troubleshooting

#### Missing Information
If expected information isn't showing:
1. **Check display mode**: Some elements only appear in verbose mode
2. **Check terminal width**: Narrow terminals hide lower-priority elements
3. **Check data availability**: Elements only show when data exists (e.g., no cost display without an active task)

#### Abbreviations
If labels are too short:
1. **Widen terminal**: Wider terminals show full labels
2. **Switch to verbose mode**: `/verbose` overrides width constraints
3. **Reference this guide**: Abbreviated labels are documented above

#### Performance
If the StatusBar updates slowly:
1. **Check terminal performance**: Some terminals render slowly
2. **Use compact mode**: `/compact` reduces rendering complexity
3. **Check session complexity**: Very long sessions may impact performance

---

## Keyboard Shortcuts

APEX supports comprehensive keyboard shortcuts for efficient navigation and control across all interfaces.

> **✨ NEW in v0.3.0**: Complete keyboard shortcuts system with context-aware handling, session management, and quick commands. All 22 shortcuts are organized by category for easy reference.

### Global Shortcuts
*Available in all contexts*

| Shortcut | Description | Context |
|----------|-------------|---------|
| `Ctrl+D` | Exit APEX | Global |
| `Ctrl+L` | Clear screen | Global |
| `Escape` | Dismiss suggestions/modal | Global |
| `Ctrl+S` | Quick save session | Global |
| `Ctrl+H` | Show help | Global |

### Session Management
*Quick access to session operations*

| Shortcut | Description | Context |
|----------|-------------|---------|
| `Ctrl+Shift+I` | Show session info | Global |
| `Ctrl+Shift+L` | List sessions | Global |

### Quick Commands
*Instant access to status and lists*

| Shortcut | Description | Context |
|----------|-------------|---------|
| `Ctrl+Shift+S` | Show status | Global |
| `Ctrl+Shift+A` | List agents | Global |
| `Ctrl+Shift+W` | List workflows | Global |
| `Ctrl+T` | Toggle thoughts display | Global |

### Input & Editing
*Text editing and line manipulation*

| Shortcut | Description | Context |
|----------|-------------|---------|
| `Ctrl+U` | Clear current line | Input |
| `Ctrl+W` | Delete word before cursor | Input |
| `Ctrl+A` | Move to beginning of line | Input |
| `Ctrl+E` | Move to end of line | Input |
| `Enter` | Submit input | Input |
| `Shift+Enter` | Insert newline (multi-line mode) | Input |
| `Tab` | Complete suggestion | Input |

### History Navigation
*Command history browsing*

| Shortcut | Description | Context |
|----------|-------------|---------|
| `Ctrl+P` | Previous history entry | Input |
| `Ctrl+N` | Next history entry | Input |
| `Ctrl+R` | Search history | Input |

### Processing & Control
*Operation control during task execution*

| Shortcut | Description | Context |
|----------|-------------|---------|
| `Ctrl+C` | Cancel current operation | Processing |

### Context-Aware Behavior

**Context Stack System**: APEX uses a context stack to determine which shortcuts are active:
- **Global**: Available everywhere
- **Input**: Active when typing commands or text
- **Processing**: Active during task execution
- **Suggestions**: Active when autocomplete suggestions are shown
- **Modal**: Active when dialogs/modals are displayed

**Smart Context Switching**: Shortcuts automatically become available based on your current activity:
- Typing → Input shortcuts active
- Task running → Processing shortcuts active
- Autocomplete visible → Tab completion available
- Modal open → Escape to dismiss

### Quick Reference Card

For quick access, here are the most frequently used shortcuts:

| Category | Shortcuts |
|----------|-----------|
| **Essential** | `Ctrl+D` (exit), `Ctrl+C` (cancel), `Ctrl+L` (clear) |
| **Input** | `Ctrl+A/E` (line start/end), `Ctrl+U` (clear line) |
| **History** | `Ctrl+P/N` (prev/next), `Ctrl+R` (search) |
| **Sessions** | `Ctrl+S` (save), `Ctrl+Shift+I` (info) |
| **Quick** | `Ctrl+H` (help), `Ctrl+Shift+S` (status) |

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

## Related Documentation

### ✨ v0.3.0 Features
- **[Complete v0.3.0 Features Overview](features/v030-features.md)** - Comprehensive guide to all new features and capabilities
- **[Display Modes User Guide](user-guide/display-modes.md)** - Detailed guide to compact, normal, and verbose display modes
- **[Input Preview User Guide](user-guide/input-preview.md)** - Complete guide to command preview with intent detection

### Core Guides
- **[Getting Started Guide](getting-started.md)** - Quick start tutorial with v0.3.0 terminal interface examples
- **[Agent Configuration](agents.md)** - Customize agent behavior and capabilities
- **[Workflow Definitions](workflows.md)** - Create and modify development workflows
- **[API Reference](api-reference.md)** - Programmatic integration with APEX
- **[Best Practices](best-practices.md)** - Tips for effective APEX usage

## Getting Help

- **In-app Help:** `/help` or `?`
- **Documentation:** [https://github.com/JoshuaAFerguson/apex](https://github.com/JoshuaAFerguson/apex)
- **Issues:** [GitHub Issues](https://github.com/JoshuaAFerguson/apex/issues)
- **Discussions:** [GitHub Discussions](https://github.com/JoshuaAFerguson/apex/discussions)
