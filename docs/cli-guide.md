# APEX CLI Guide

This comprehensive guide covers all CLI commands, keyboard shortcuts, session management, and display modes available in APEX.

See [Session Management](#session-management) for persistence, branching, and export details.

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
Type `/help` at any time to see the full command list and shortcuts.

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
Run `/init` first if you have not initialized this project yet.

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
/run "description" --workflow feature --autonomy full
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
/logs task_abc123 --limit 100    # Show last 100 entries
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

APEX automatically manages sessions, tracking your conversation history, tasks, and costs across all interactions. Session management is one of the core strengths of APEX, providing comprehensive tools for persistence, organization, and workflow optimization.

> **✨ NEW in v0.3.0**: Enhanced session management with improved persistence, branching capabilities, and visual feedback. Session data now integrates seamlessly with the rich terminal interface, providing the 7 core session features documented below.

### Overview

Session management in APEX encompasses seven key features designed to support both short-term interactions and long-running development workflows:

1. **[Session Persistence](#session-persistence)** - Automatic session resumption across APEX restarts
2. **[Session Export Formats](#session-export-formats)** - Export sessions as markdown, JSON, or HTML
3. **[Session Branching](#session-branching)** - Create alternative conversation branches
4. **[Named Sessions](#named-sessions)** - Organize sessions with meaningful names and tags
5. **[Session Search](#session-search)** - Find sessions by name, content, or metadata
6. **[Auto-Save](#auto-save)** - Intelligent automatic session persistence
7. **[Session Commands Reference](#session-commands-reference)** - Complete command reference

### The 7 Session Features

#### 1. Session Persistence

**Description**: APEX automatically persists your session state and resumes it when you restart the application. This ensures continuity of work and prevents loss of conversation history.

**How It Works**:
- Sessions are automatically stored in `.apex/sessions/`
- Last active session resumes by default on APEX startup
- Crash recovery restores session state from last auto-save
- Session lifecycle is managed transparently

**Examples**:
```bash
# Session is automatically persisted during normal usage
apex> Add a health check endpoint to the API
# ... work continues, session auto-saves periodically ...

# When you restart APEX, the session resumes automatically
$ apex
Resuming session: sess_1703123456789_abc123def...
Previous session: "Feature Development" (45 messages, $1.23)

# To start a completely fresh session instead
$ apex --new-session
Starting new session...
```

**Configuration**:
```yaml
# .apex/config.yaml
session:
  autoResume: true          # Resume last session on startup
  crashRecovery: true       # Enable crash recovery
  maxSessions: 100          # Maximum stored sessions
```

**Tips**:
- Session resumption includes full conversation context
- Unsaved work is preserved across unexpected shutdowns
- Use `--new-session` flag when you want to start completely fresh

#### 2. Session Export Formats

**Description**: Export your sessions to various formats for documentation, sharing, or archival purposes. Three formats are supported: markdown for readability, JSON for programmatic use, and HTML for rich presentation.

**Commands**:
| Command | Description | Example |
|---------|-------------|---------|
| `/session export` | Preview in markdown format | Display session content |
| `/session export --format md` | Export as markdown | Same as default |
| `/session export --format json` | Export as structured JSON | For API integration |
| `/session export --format html` | Export as styled HTML | For sharing/reports |
| `/session export --output <file>` | Save to specific file | Write to disk |

**Examples**:
```bash
# Preview session as markdown (default)
/session export

# Export to JSON for programmatic processing
/session export --format json --output session-data.json

# Export to HTML for team sharing
/session export --format html --output project-session.html

# Export current session to markdown file
/session export --format md --output session-backup.md
```

**Sample Output Formats**:

**Markdown Format**:
```markdown
# APEX Session: Feature Development

**Created:** 2024-12-15T10:30:00.000Z
**Last Updated:** 2024-12-15T12:45:00.000Z
**Total Messages:** 45
**Total Cost:** $1.2345
**Tokens:** 125,456 (input: 89,123 | output: 36,333)

---

### **User** *(2024-12-15 10:30:15)*

Add a health check endpoint to the API

### **Assistant (planner)** *(2024-12-15 10:30:45)*

I'll analyze your codebase and create a plan for implementing a health check endpoint...

[Agent: planner | Stage: planning | Tokens: 1,234 | Cost: $0.0012]

### **User** *(2024-12-15 10:35:22)*

Make sure it includes database connectivity status
```

**JSON Format**:
```json
{
  "id": "sess_1703123456789_abc123def",
  "name": "Feature Development",
  "created": "2024-12-15T10:30:00.000Z",
  "lastUpdated": "2024-12-15T12:45:00.000Z",
  "metadata": {
    "tags": ["feature", "api", "health-check"],
    "parentSessionId": null,
    "branchCount": 2
  },
  "messages": [
    {
      "id": "msg_001",
      "index": 0,
      "timestamp": "2024-12-15T10:30:15.000Z",
      "role": "user",
      "content": "Add a health check endpoint to the API"
    },
    {
      "id": "msg_002",
      "index": 1,
      "timestamp": "2024-12-15T10:30:45.000Z",
      "role": "assistant",
      "content": "I'll analyze your codebase...",
      "metadata": {
        "agent": "planner",
        "stage": "planning",
        "tokens": {"input": 850, "output": 384},
        "cost": 0.0012
      }
    }
  ],
  "state": {
    "totalTokens": {"input": 89123, "output": 36333},
    "totalCost": 1.2345,
    "currentAgent": "developer",
    "currentStage": "implementation"
  }
}
```

**HTML Format**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <title>APEX Session: Feature Development</title>
    <style>
        .message { margin: 1rem 0; padding: 1rem; border-radius: 8px; }
        .user { background: #e3f2fd; border-left: 4px solid #2196f3; }
        .assistant { background: #f3e5f5; border-left: 4px solid #9c27b0; }
        .metadata { font-size: 0.8em; color: #666; }
    </style>
</head>
<body>
    <h1>APEX Session: Feature Development</h1>
    <div class="session-info">
        <p><strong>Created:</strong> December 15, 2024, 10:30:00 AM</p>
        <p><strong>Messages:</strong> 45 | <strong>Cost:</strong> $1.2345</p>
    </div>

    <div class="message user">
        <h3>User <span class="metadata">(10:30:15)</span></h3>
        <p>Add a health check endpoint to the API</p>
    </div>

    <div class="message assistant">
        <h3>Assistant (planner) <span class="metadata">(10:30:45)</span></h3>
        <p>I'll analyze your codebase and create a plan...</p>
        <div class="metadata">Tokens: 1,234 | Cost: $0.0012</div>
    </div>
</body>
</html>
```

**Configuration**: No additional configuration required - export formats work with default settings.

**Tips**:
- Use markdown for documentation and team reviews
- Use JSON for integration with other tools or analysis
- Use HTML for polished reports and presentations
- Preview with `/session export` before saving to file

#### 3. Session Branching

**Description**: Create alternative conversation branches from any point in your session. This powerful feature allows you to explore different approaches, try alternative solutions, or backtrack to earlier decisions without losing your original conversation flow.

**Commands**:
| Command | Description | Example |
|---------|-------------|---------|
| `/session branch <name>` | Create branch from current point | Create new direction |
| `/session branch <name> --from <index>` | Create branch from specific message | Branch from earlier point |
| `/session info` | View branch relationships | See parent/child sessions |

**Examples**:
```bash
# Create a branch from the current conversation point
/session branch "Alternative Approach"

# Create a branch from a specific message (0-based index)
/session branch "Try Redux Implementation" --from 15

# Create an unnamed branch (auto-generated name)
/session branch

# View current session's branch relationships
/session info
```

**Branch Workflow Visualization**:
```
Session: "Main Development"
├── Message 1: User: "Implement user authentication"
├── Message 2: AI: "I'll create a JWT-based auth system..."
├── Message 3: User: "Actually, let's also consider OAuth"
├── Message 4: AI: "Here's a comparison of JWT vs OAuth..." ◄─── Branch point
│   │
│   └── Branch: "OAuth Implementation"
│       ├── Message 5 (branch): User: "Let's go with OAuth"
│       ├── Message 6 (branch): AI: "I'll implement OAuth with Google..."
│       └── Message 7 (branch): User: "Add GitHub provider too"
│
├── Message 5: User: "Let's stick with JWT for now"
├── Message 6: AI: "I'll implement the JWT solution..."
└── Message 7: User: "Add password reset functionality"
```

**Output Examples**:

When creating a branch:
```bash
apex> /session branch "OAuth Approach" --from 4

✅ Created session branch
   Name: OAuth Approach
   Branched from: Message 4 in "Main Development"
   New session ID: sess_1703123567890_def456ghi

Switched to branch session. Use /session load sess_1703123456789_abc123def to return to parent.
```

When viewing session info with branches:
```bash
apex> /session info

Current Session:
  ID: sess_1703123456789_abc123def
  Name: Main Development
  Messages: 8
  Created: 12/15/2024, 9:00:00 AM
  Updated: 12/15/2024, 11:30:00 AM

Parent Session: None
Child Branches: 2
├── sess_1703123567890_def456ghi: "OAuth Approach" (3 messages)
└── sess_1703123678901_ghi789jkl: "Redis Caching" (5 messages)

Total Cost: $1.2345
Tokens: 125,456
```

**Configuration**: No additional configuration required - branching works with default session settings.

**Tips**:
- Use branches to explore "what if" scenarios without losing your main conversation
- Branch before making significant changes to your approach
- View `/session info` to understand branch relationships
- Use `/session list` to see all your session branches

#### 4. Named Sessions

**Description**: Organize your sessions with meaningful names and tags for better discoverability and project management. Named sessions transform anonymous session IDs into recognizable, searchable work units.

**Commands**:
| Command | Description | Example |
|---------|-------------|---------|
| `/session save <name>` | Save current session with a name | Assign meaningful name |
| `/session save <name> --tags <tags>` | Save with organizational tags | Add searchable metadata |
| `/session load <name>` | Load session by name | Load by name instead of ID |
| `/session list` | View named sessions | See all named sessions |

**Examples**:
```bash
# Save current session with a descriptive name
/session save "Auth Implementation"

# Save with tags for better organization
/session save "Sprint 5 Work" --tags sprint5,auth,backend,api

# Save with multiple organizational tags
/session save "Database Refactor" --tags refactor,database,performance,sprint3

# Load a session by its name
/session load "Auth Implementation"

# Load by partial name match (if unique)
/session load "Auth"
```

**Session Naming Best Practices**:
```bash
# Feature-based naming
/session save "User Profile Management"
/session save "Payment Integration"
/session save "Email Notifications"

# Sprint/iteration-based naming
/session save "Sprint 3 - Authentication"
/session save "v2.0 API Updates"
/session save "Bug Fix - User Login Issue"

# Component-based naming
/session save "Frontend: React Components"
/session save "Backend: Database Layer"
/session save "DevOps: CI/CD Pipeline"
```

**Output Examples**:

When saving a named session:
```bash
apex> /session save "Auth Feature Development" --tags auth,feature,backend

✅ Session saved successfully
   Name: Auth Feature Development
   Tags: auth, feature, backend
   ID: sess_1703123456789_abc123def
   Messages: 23 | Cost: $0.89 | Created: 2h 15m ago
```

Session list with names:
```bash
apex> /session list

Sessions:

  🔖 Auth Feature Development    │ 23 msgs │ $0.89  │ 2h ago    │ #auth #feature
  🔖 Database Refactor          │ 15 msgs │ $0.45  │ 1d ago    │ #refactor #db
  📁 Sprint 3 Planning          │ 8 msgs  │ $0.23  │ 3d ago    │ #sprint3
  💡 Bug Investigation          │ 12 msgs │ $0.34  │ 5d ago    │ #bugfix
  a1b2c3 | 12 msgs | $0.34 | 2h ago | "Auth Feature"
     sess_1703120000000_old123  │ 5 msgs  │ $0.15  │ 1w ago    │ (unnamed)
```

Loading by name:
```bash
apex> /session load "Auth"

🔍 Multiple sessions match "Auth":
   1. Auth Feature Development (23 msgs, $0.89)
   2. Authentication Refactor (15 msgs, $0.45)

Select session [1-2]: 1

✅ Loaded session: Auth Feature Development
   Resuming at message 23...
```

**Configuration**:
```yaml
# .apex/config.yaml
session:
  naming:
    suggestNames: true        # AI suggests names based on content
    requireTags: false        # Whether tags are required
    maxTagsPerSession: 10     # Limit number of tags
```

**Tips**:
- Use consistent naming patterns across your project
- Tags help organize sessions across multiple projects
- Load sessions by name for faster access than remembering IDs
- Use AI suggestions for naming (when `suggestNames: true`)

#### 5. Session Search

**Description**: Search across your session history by name, content, tags, or metadata. Powerful search capabilities help you find relevant conversations quickly, even with extensive session history.

**Commands**:
| Command | Description | Example |
|---------|-------------|---------|
| `/session list --search <query>` | Search by name/content | Find specific sessions |
| `/session list --all --search <query>` | Include archived sessions | Search all history |
| `/session list --search <tag>` | Search by tag | Find tagged sessions |

**Examples**:
```bash
# Search by session name
/session list --search "auth"

# Search by content keywords
/session list --search "database migration"

# Search by specific tags
/session list --search "#backend"

# Search across all sessions including archived
/session list --all --search "payment"

# Search with multiple terms
/session list --search "react component"
```

**Advanced Search Examples**:
```bash
# Find all authentication-related work
/session list --search "auth"

# Find specific feature discussions
/session list --search "user profile"

# Search by technology stack
/session list --search "redis"
/session list --search "postgresql"

# Search by development phase
/session list --search "#planning"
/session list --search "#implementation"

# Find error investigation sessions
/session list --search "error"
/session list --search "bug"
```

**Output Examples**:

Basic search results:
```bash
apex> /session list --search "auth"

Search Results for "auth" (4 matches):

  🔖 Auth Feature Development    │ 23 msgs │ $0.89  │ 2h ago    │ #auth #feature
  🔖 Authentication Refactor     │ 15 msgs │ $0.45  │ 1d ago    │ #auth #refactor
  💡 OAuth Integration           │ 8 msgs  │ $0.23  │ 3d ago    │ #auth #oauth
  📁 User Auth Bug Fix          │ 12 msgs │ $0.34  │ 5d ago    │ #auth #bugfix
```

Detailed search with content preview:
```bash
apex> /session list --search "database" --verbose

Search Results for "database" (2 matches):

┌─ Database Refactor ─────────────────────────────────────────┐
│ ID: sess_1703123456789_abc123def                            │
│ Messages: 15 | Cost: $0.45 | Created: 1d ago               │
│ Tags: #refactor #database #performance                      │
│ Content preview: "Let's refactor the user table to improve │
│ query performance and add proper indexing..."               │
└─────────────────────────────────────────────────────────────┘

┌─ Database Migration Planning ───────────────────────────────┐
│ ID: sess_1703123567890_def456ghi                            │
│ Messages: 8 | Cost: $0.23 | Created: 3d ago                │
│ Tags: #planning #database #migration                        │
│ Content preview: "Plan the migration from MySQL to         │
│ PostgreSQL for better JSON support..."                      │
└─────────────────────────────────────────────────────────────┘
```

No results found:
```bash
apex> /session list --search "kubernetes"

No sessions found matching "kubernetes"

Suggestions:
• Try broader search terms
• Check spelling
• Use /session list --all to include archived sessions
• Use /session list to see all available sessions
```

**Search Tips and Patterns**:
```bash
# Find sessions by development stage
/session list --search "#planning"
/session list --search "#implementation"
/session list --search "#testing"

# Find sessions by project component
/session list --search "frontend"
/session list --search "api"
/session list --search "database"

# Find sessions by time frame
/session list --search "#sprint3"
/session list --search "#v2"

# Find troubleshooting sessions
/session list --search "error"
/session list --search "debug"
/session list --search "fix"
```

**Configuration**:
```yaml
# .apex/config.yaml
session:
  search:
    caseSensitive: false      # Case-insensitive search by default
    maxResults: 20            # Maximum search results to show
    contentPreview: true      # Show content preview in results
    highlightMatches: true    # Highlight search terms in results
```

**Tips**:
- Use tags consistently for better searchability
- Search terms match both session names and content
- Use `--all` flag to search archived sessions
- Combine multiple search terms for more specific results

#### 6. Auto-Save

**Description**: Intelligent automatic session persistence that saves your work based on configurable triggers. Auto-save prevents data loss and ensures session continuity without manual intervention.

**How Auto-Save Works**:
- **Interval-based saving**: Saves every N seconds of activity
- **Message threshold saving**: Saves after N new messages
- **Smart triggers**: Saves before potentially risky operations
- **Unsaved changes tracking**: Shows count of unsaved messages
- **Background operation**: Non-intrusive, happens transparently

**Configuration**:
```yaml
# .apex/config.yaml
session:
  autoSave:
    enabled: true             # Enable auto-save functionality
    intervalMs: 30000         # Save every 30 seconds (during activity)
    maxUnsavedMessages: 5     # Save after 5 unsaved messages
    onCriticalOperations: true # Save before risky operations
    onSessionSwitch: true     # Save when switching sessions
    onExit: true              # Save when exiting APEX
```

**Commands**:
| Command | Description | Example |
|---------|-------------|---------|
| `/session save <name>` | Force immediate save | Manual save override |
| `/session info` | Check unsaved changes | See unsaved count |
| `Ctrl+S` | Quick save session | Keyboard shortcut |

**Examples**:
```bash
# Auto-save happens automatically - no commands needed!
apex> Add authentication to the API
# ... conversation continues ...
# [Auto-saved: 5 messages] (shown in verbose mode)

# Force manual save at any time
/session save "Auth Work in Progress"

# Check if there are unsaved changes
/session info
# Shows: Unsaved changes: 3

# Quick save with keyboard shortcut
# Press Ctrl+S
✅ Session saved (forced save)
```

**Auto-Save Triggers and Notifications**:

Interval-based auto-save:
```bash
apex> # Working on a feature...
# After 30 seconds of activity:
# [Auto-saved: interval trigger] (verbose mode only)
```

Message threshold auto-save:
```bash
apex> Message 1
apex> Message 2
apex> Message 3
apex> Message 4
apex> Message 5
# [Auto-saved: 5 messages threshold] (verbose mode only)
```

Critical operation auto-save:
```bash
apex> /session branch "Alternative Approach"
# [Auto-saved before branching]
✅ Created session branch...
```

Session switch auto-save:
```bash
apex> /session load "Different Project"
# [Auto-saved current session]
✅ Loaded session: Different Project...
```

**Session Info with Auto-Save Details**:
```bash
apex> /session info

Current Session:
  ID: sess_1703123456789_abc123def
  Name: Feature Development
  Messages: 23
  Created: 12/15/2024, 9:00:00 AM
  Last Updated: 12/15/2024, 11:30:00 AM
  Last Auto-Save: 12/15/2024, 11:28:15 AM

  Unsaved Changes: 3 messages
  Next Auto-Save: in 25 seconds (or 2 more messages)

Auto-Save Status: ✅ Enabled
  Interval: 30 seconds
  Message threshold: 5 messages
  Last trigger: message threshold
```

**Auto-Save Settings Management**:
```bash
# View current auto-save settings
/config get session.autoSave

# Disable auto-save temporarily
/config set session.autoSave.enabled=false

# Adjust save frequency
/config set session.autoSave.intervalMs=60000    # Save every minute
/config set session.autoSave.maxUnsavedMessages=10  # Save after 10 messages

# Re-enable with new settings
/config set session.autoSave.enabled=true
```

**Tips**:
- Auto-save is enabled by default and works transparently
- Use `Ctrl+S` for immediate manual saves when needed
- Check `/session info` to see unsaved changes count
- Adjust intervals based on your workflow - shorter for critical work
- Auto-save respects your naming when you've used `/session save`

#### 7. Session Commands Reference

**Description**: Complete reference for all session-related commands with their options, arguments, and usage patterns.

**Quick Reference Table**:

| Command | Description | Options | Examples |
|---------|-------------|---------|----------|
| `/session list` | List available sessions | `--all`, `--search <query>` | `/session list --search auth` |
| `/session load <id\|name>` | Load a session | - | `/session load "Auth Work"` |
| `/session save <name>` | Save current session | `--tags <tag1,tag2>` | `/session save "Feature" --tags api,auth` |
| `/session branch [name]` | Create session branch | `--from <message_index>` | `/session branch "Alt" --from 15` |
| `/session export` | Export session | `--format <md\|json\|html>`, `--output <file>` | `/session export --format html --output report.html` |
| `/session delete <id>` | Delete a session | - | `/session delete sess_123...` |
| `/session info` | Show current session info | - | `/session info` |

**Detailed Command Documentation**:

**`/session list` - List Available Sessions**

*List and search through your session history with filtering options.*

**Syntax:**
```bash
/session list [--all] [--search <query>] [--verbose]
```

**Options:**
- `--all` - Include archived sessions in results
- `--search <query>` - Filter sessions by name, content, or tags
- `--verbose` - Show detailed information including content preview

**Examples:**
```bash
/session list                           # List recent active sessions
/session list --all                     # Include archived sessions
/session list --search "authentication" # Find auth-related sessions
/session list --all --search "#bugfix"  # Search archived bugfix sessions
```

**`/session load` - Load a Session**

*Switch to a different session by ID or name.*

**Syntax:**
```bash
/session load <session_id|name>
```

**Arguments:**
- `session_id` - Full session ID (e.g., `sess_1703123456789_abc123def`)
- `name` - Session name (supports partial matching if unique)

**Examples:**
```bash
/session load sess_1703123456789_abc123def    # Load by full ID
/session load "Auth Implementation"           # Load by exact name
/session load "Auth"                          # Load by partial name (if unique)
```

**`/session save` - Save Current Session**

*Save the current session with a name and optional organizational tags.*

**Syntax:**
```bash
/session save <name> [--tags <tag1,tag2,...>]
```

**Arguments:**
- `name` - Descriptive name for the session (quoted if contains spaces)

**Options:**
- `--tags <tag1,tag2,...>` - Comma-separated tags for organization

**Examples:**
```bash
/session save "API Development"                    # Save with name only
/session save "Auth Feature" --tags auth,api,v2   # Save with tags
/session save "Bug Investigation #142" --tags bugfix,urgent
```

**`/session branch` - Create Session Branch**

*Create a new conversation branch from the current session or a specific message.*

**Syntax:**
```bash
/session branch [<name>] [--from <message_index>]
```

**Arguments:**
- `name` - Name for the new branch (optional, auto-generated if not provided)

**Options:**
- `--from <index>` - 0-based message index to branch from (default: current point)

**Examples:**
```bash
/session branch                              # Create unnamed branch from current point
/session branch "Alternative Approach"      # Named branch from current point
/session branch "Try OAuth" --from 10       # Branch from message 10
```

**`/session export` - Export Session**

*Export session content to various formats for documentation or sharing.*

**Syntax:**
```bash
/session export [--format <md|json|html>] [--output <file>]
```

**Options:**
- `--format <format>` - Export format: `md` (default), `json`, `html`
- `--output <file>` - Output file path (if not provided, displays to terminal)

**Examples:**
```bash
/session export                                    # Preview as markdown
/session export --format json                     # Show as JSON
/session export --output session-backup.md        # Save as markdown file
/session export --format html --output report.html # Save as HTML report
/session export --format json --output data.json  # Save structured data
```

**`/session delete` - Delete a Session**

*Permanently remove a session from storage.*

**Syntax:**
```bash
/session delete <session_id>
```

**Arguments:**
- `session_id` - Full session ID to delete

**Examples:**
```bash
/session delete sess_1703123456789_abc123def    # Delete specific session
```

**Safety Notes:**
- Session deletion is permanent and cannot be undone
- You cannot delete the currently active session
- Consider exporting important sessions before deletion

**`/session info` - Show Current Session Info**

*Display detailed information about the currently active session.*

**Syntax:**
```bash
/session info
```

**Example Output:**
```bash
Current Session:
  ID: sess_1703123456789_abc123def
  Name: Feature Development
  Messages: 23
  Created: 12/15/2024, 9:00:00 AM
  Last Updated: 12/15/2024, 11:30:00 AM

Branch Information:
  Parent Session: None
  Child Branches: 2
  ├── sess_1703123567890_def456ghi: "OAuth Approach" (3 messages)
  └── sess_1703123678901_ghi789jkl: "Alternative UI" (7 messages)

Session State:
  Total Cost: $1.2345
  Tokens: 125,456 (input: 89,123 | output: 36,333)
  Tags: feature, authentication, api
  Unsaved Changes: 3 messages
  Auto-Save: ✅ Enabled (next save in 25 seconds)
```

### Session Workflows

Session management in APEX supports various development workflows. Here are common patterns and best practices:

#### Workflow 1: Long-Running Feature Development

*For features that span multiple days or weeks*

```bash
# Day 1: Start feature work
apex> Implement user authentication system

# Save progress with descriptive name
/session save "User Auth - Initial Planning" --tags auth,feature,planning

# Continue working...
apex> Let's start with JWT token implementation

# End of day - session auto-saves automatically
# No manual action needed

# Day 2: Resume work
$ apex
# Automatically resumes: "User Auth - Initial Planning"
Previous session: User Auth - Initial Planning (45 messages, $2.34)

# Continue from where you left off
apex> Now let's add password reset functionality

# Save milestone progress
/session save "User Auth - Password Reset Added" --tags auth,feature,milestone

# Day 3: Add OAuth integration
apex> Add Google OAuth as an alternative login method

# Final implementation complete
/session save "User Auth - Complete Implementation" --tags auth,feature,complete

# Export for documentation
/session export --format html --output auth-implementation-log.html
```

#### Workflow 2: Exploring Alternative Approaches

*When you want to try different solutions without losing your original work*

```bash
# Working on caching implementation
apex> Implement a caching layer for the API

# AI suggests Redis approach
# Assistant: I recommend using Redis for caching...

# You want to also explore in-memory caching
/session branch "In-Memory Caching Approach"

# Explore alternative in the new branch
apex> Actually, let's try an in-memory caching solution instead

# If in-memory approach doesn't work well, switch back
/session load "Original Caching Work"  # Load parent session

# Or continue with alternative if it's better
# The branch preserves both approaches for comparison
```

#### Workflow 3: Bug Investigation and Resolution

*Systematic approach to debugging with full documentation trail*

```bash
# Start investigating a reported bug
apex> Users are reporting login failures after password reset

# Save investigation session
/session save "Bug #142 - Login After Reset" --tags bugfix,urgent,investigation

# AI helps investigate...
# Multiple back-and-forth debugging conversations

# Found potential solution, but want to try two approaches
/session branch "Fix Approach A - Token Validation"
apex> Let's try fixing the token validation logic

# Switch to try alternative approach
/session branch "Fix Approach B - Session Reset" --from 15
apex> Maybe we need to reset the session after password change

# Compare approaches and choose the best one
/session export --format json --output bug-142-investigation.json

# Implement final solution in main branch
/session load "Bug #142 - Login After Reset"
apex> Implement the session reset approach we discussed

# Document resolution
/session save "Bug #142 - Resolved" --tags bugfix,resolved
/session export --format html --output bug-142-resolution-report.html
```

#### Workflow 4: Code Review and Team Collaboration

*Documenting review sessions and sharing insights*

```bash
# Review teammate's pull request
apex> Review the authentication changes in PR #87

# Document review session
/session save "Code Review - PR #87 Auth Changes" --tags review,authentication

# AI helps analyze the code and provides feedback
# Session captures all review comments and suggestions

# Export for team sharing
/session export --format html --output pr-87-review-notes.html

# Create follow-up session for discussing improvements
/session branch "PR #87 - Improvement Suggestions"
apex> Based on the review, let's discuss potential improvements
```

#### Workflow 5: Documentation and Knowledge Capture

*Creating comprehensive project documentation from development sessions*

```bash
# After completing a major feature
/session load "User Auth - Complete Implementation"

# Export technical documentation
/session export --format md --output docs/auth-implementation-process.md

# Create summary session for key learnings
/session branch "Auth Implementation - Key Learnings"
apex> Summarize the key architectural decisions and lessons learned

# Save as knowledge base entry
/session save "Knowledge Base - Auth Architecture" --tags knowledge,auth,architecture

# Export for team wiki
/session export --format html --output wiki/auth-architecture-decisions.html
```

### Configuration

Session management behavior can be customized through the `.apex/config.yaml` file:

```yaml
# Session Management Configuration
session:
  # Auto-resume behavior
  autoResume: true              # Resume last session on APEX startup
  crashRecovery: true           # Enable crash recovery from auto-saves

  # Storage settings
  storageLocation: ".apex/sessions"  # Where sessions are stored
  maxSessions: 100              # Maximum number of sessions to keep
  archiveAfterDays: 30          # Archive sessions after N days of inactivity

  # Auto-save configuration
  autoSave:
    enabled: true               # Enable automatic saving
    intervalMs: 30000           # Save every 30 seconds during activity
    maxUnsavedMessages: 5       # Save after 5 unsaved messages
    onCriticalOperations: true  # Save before risky operations (branch, load, etc.)
    onSessionSwitch: true       # Save when switching sessions
    onExit: true                # Save when exiting APEX

  # Search and display
  search:
    caseSensitive: false        # Case-insensitive search by default
    maxResults: 20              # Maximum search results to display
    contentPreview: true        # Show content preview in search results
    highlightMatches: true      # Highlight search terms in results

  # Export settings
  export:
    defaultFormat: "md"         # Default export format
    includeMetadata: true       # Include session metadata in exports
    timestampFormat: "iso"      # Timestamp format: "iso", "local", "relative"

  # Naming and organization
  naming:
    suggestNames: true          # AI suggests session names based on content
    requireTags: false          # Whether tags are required when saving
    maxTagsPerSession: 10       # Maximum number of tags per session

  # Keyboard shortcuts (global)
  shortcuts:
    quickSave: "Ctrl+S"         # Quick save current session
    sessionInfo: "Ctrl+Shift+I" # Show session info
    sessionList: "Ctrl+Shift+L" # List sessions
```

### Session Shortcuts

Session management includes dedicated keyboard shortcuts for quick access:

| Shortcut | Description | Context |
|----------|-------------|---------|
| `Ctrl+S` | Quick save session (triggers immediate save) | Global |
| `Ctrl+Shift+I` | Show session info | Global |
| `Ctrl+Shift+L` | List sessions | Global |

### Session Troubleshooting

Common session management issues and their solutions:

#### Session Loading Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **"No active session"** | Commands fail, no session context | Run `/session info` to check status, or restart APEX to auto-resume |
| **"Session not found"** | Cannot load specific session | Use `/session list --all` to verify session exists and check ID/name |
| **"Session corrupted"** | Load fails with error | Check `.apex/sessions/` directory permissions and disk space |

#### Auto-Save Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Auto-save not working** | Changes lost between sessions | Check config: `session.autoSave.enabled: true` |
| **Too frequent auto-saves** | Performance impact, frequent disk writes | Increase `session.autoSave.intervalMs` value |
| **Auto-save not triggering** | Large number of unsaved changes | Check `session.autoSave.maxUnsavedMessages` setting |

#### Export Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Export fails with permission error** | Cannot write to output file | Ensure output directory exists and is writable |
| **Export incomplete or corrupted** | Missing content in exported file | Check session integrity with `/session info` |
| **Large export takes too long** | Export command times out | Try exporting in smaller chunks or different format |

#### Search and Discovery

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Cannot find expected sessions** | Search returns no results | Use `/session list --all` to include archived sessions |
| **Search too slow** | Long delay in search results | Consider reducing `session.search.maxResults` or cleaning old sessions |
| **Partial name match fails** | Cannot load by partial name | Use exact name or full session ID for loading |

#### Branch Management

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Branch index out of range** | "Message index not found" error | Use `/session info` to check total message count |
| **Cannot find parent session** | Branch relationship lost | Check session ID in branch metadata, may need manual reconnection |
| **Too many branches** | Confusing session hierarchy | Use meaningful names and consider cleaning up unused branches |

**Debug Commands for Troubleshooting:**

```bash
# Check session system status
/session info

# Verify session storage
/config get session

# List all sessions including problematic ones
/session list --all

# Test export functionality
/session export --format json

# Force manual save to test auto-save
/session save "Test Save"

# Check APEX logs for session-related errors
/logs --level error --search "session"
```

### Tips and Best Practices

#### Session Organization
- Use consistent naming patterns across your projects
- Apply tags systematically for better searchability
- Archive or delete old sessions to keep the list manageable
- Use descriptive names that include project and feature context

#### Workflow Optimization
- Save sessions at logical milestones (end of planning, after implementation, etc.)
- Use branching to explore alternatives without losing original work
- Export important sessions for documentation and team sharing
- Leverage auto-save for peace of mind, manual save for milestones

#### Performance Considerations
- Regularly clean up old or unused sessions
- Adjust auto-save frequency based on your workflow intensity
- Use search instead of browsing when you have many sessions
- Archive completed project sessions to reduce active list size

#### Team Collaboration
- Export sessions in HTML format for easy sharing with team members
- Use consistent tagging schemes across team members
- Include session exports in project documentation
- Name sessions descriptively for better team understanding

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

Verbose Mode Additions:
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

The StatusBar component provides real-time session and task information at the bottom of the APEX interface. This section provides comprehensive StatusBar documentation for all elements and modes. It features a sophisticated responsive design with priority-based element display that adapts to your terminal width and selected display mode. The StatusBar displays up to 21 different elements organized by priority and side, and it intelligently adapts to ensure critical information is always visible.

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

**Verbose Mode (Additional Elements):**
```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ● ⎇ main | ⚡developer | ▶implementation | 📋 [2/5] | 💾 my-session | api:3000 | web:3001                      │
│ tokens: 12.5k→8.2k | total: 20.7k | cost: $0.1523 | session: $1.25 | model: sonnet                          │
│ active: 3m42s | idle: 1m18s | stage: 45s | 🔍 VERBOSE                                                      │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Display Elements

The StatusBar displays up to 21 display elements organized by priority and side. Elements are automatically hidden or abbreviated based on terminal width and display mode.

#### Priority System

| Priority | Level | Description | Visibility |
|----------|-------|-------------|------------|
| **CRITICAL** | Always shown | Core functionality indicators | All widths, all modes |
| **HIGH** | Essential | Important status information | Normal+ terminal widths |
| **MEDIUM** | Standard | Detailed progress information | Wide terminal widths |
| **LOW** | Extended | Additional context and debug info | Wide terminals, verbose mode |

#### Left Side Elements

Left side elements appear in this order when space allows: Connection Status, Git Branch, Agent Indicator, Workflow Stage, Subtask Progress, Session Name, API Port, Web UI Port.

##### 1. **Connection Status**

Visual Example:
```
● (connected) or ○ (disconnected)
```

**Icon:** ●/○
**Values:** Connected (●) / Disconnected (○)
**Location:** Left side (leftmost)
**Priority:** CRITICAL

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
| Narrow | ✓ | ✓ | ✓ |
| Normal | ✓ | ✓ | ✓ |
| Wide | ✓ | ✓ | ✓ |

##### 2. **Git Branch**

Visual Example:
```
⎇ main
⎇ feature/auth-impl
⎇ apex/abc123-fix-bug
```

**Icon:** ⎇
**Values:** Current git branch name
**Location:** Left side
**Priority:** CRITICAL

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
| Narrow | ✓ | ✓ | ✓ |
| Normal | ✓ | ✓ | ✓ |
| Wide | ✓ | ✓ | ✓ |

##### 3. **Agent Indicator**

Visual Example:
```
⚡developer
⚡planner
⚡architect
```

**Icon:** ⚡
**Values:** Shows current active agent
**Location:** Left side
**Priority:** CRITICAL

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
| Narrow | ✗ | ✓ | ✓ |
| Normal | ✗ | ✓ | ✓ |
| Wide | ✗ | ✓ | ✓ |

##### 4. **Workflow Stage**

Visual Example:
```
▶planning
▶architecture
▶implementation
▶testing
▶review
```

**Icon:** ▶
**Values:** Current workflow stage name
**Location:** Left side
**Priority:** CRITICAL

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

##### 5. **Subtask Progress**

Visual Example:
```
📋 [2/5]
📋 [0/3]
📋 [5/5]
```

**Icon:** 📋
**Values:** Current subtask index and total count ([2/5])
**Location:** Left side
**Priority:** HIGH

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

##### 6. **Session Name**

Visual Example:
```
💾 my-project-work
💾 auth-feature
💾 bug-investigation
```

**Icon:** 💾
**Values:** Named session identifier
**Location:** Left side
**Priority:** LOW

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

##### 7. **API Port**

Visual Example:
```
api:3000
→ 3000 (abbreviated)
```

**Icon:** api:
**Values:** API port number (api:3000)
**Location:** Left side
**Priority:** LOW

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

##### 8. **Web UI Port**

Visual Example:
```
web:3001
↗ 3001 (abbreviated)
```

**Icon:** web:
**Values:** Web UI port number (web:3001)
**Location:** Left side
**Priority:** LOW

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

Right side elements appear in this order when space allows: Token Count, Cost Display, Model Indicator, Session Timer.

##### 9. **Token Count**

Visual Example:
```
tokens: 45.2k
tk: 1.5k (abbreviated)
tokens: 234
```

**Icon:** tokens:
**Values:** Total tokens (e.g., 45.2k)
**Location:** Right side
**Priority:** HIGH

**Description:**
Total token count (input + output) for the current task. Tokens are the units that AI models process, and understanding token usage helps with cost and performance optimization. Updates in real-time.

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

##### 10. **Cost Display**

Visual Example:
```
cost: $0.1523
$0.1523 (abbreviated - no label)
cost: $0.0045
```

**Icon:** cost:
**Values:** Current task cost (e.g., $0.1523)
**Location:** Right side
**Priority:** HIGH

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
| Narrow | ✓ | ✓ | ✓ |
| Normal | ✓ | ✓ | ✓ |
| Wide | ✓ | ✓ | ✓ |

##### 11. **Model Indicator**

Visual Example:
```
model: sonnet
mod: sonnet (abbreviated)
model: opus
model: haiku
```

**Icon:** model:
**Values:** Model name (e.g., sonnet)
**Location:** Right side
**Priority:** HIGH

**Description:**
Shows which AI model is currently being used for task execution. Different models have different capabilities and costs. Model name is stable across the task.

**Format:**
- Full format: `model: sonnet`
- Abbreviated format: `mod: sonnet`

**Color Coding:**
| Element | Color | Meaning |
|---------|-------|---------|
| Label | Gray | Model label |
| Name | Blue | Model name |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| Narrow | ✗ | ✓ | ✓ |
| Normal | ✗ | ✓ | ✓ |
| Wide | ✗ | ✓ | ✓ |

##### 12. **Session Timer**

Visual Example:
```
05:23
12:05
00:42
```

**Icon:** MM:SS
**Values:** Session duration in MM:SS
**Location:** Right side (rightmost)
**Priority:** HIGH

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
| Narrow | ✗ | ✓ | ✓ |
| Normal | ✗ | ✓ | ✓ |
| Wide | ✗ | ✓ | ✓ |

#### Verbose Mode Only Elements

These elements are only shown in verbose mode and provide additional debugging and monitoring information.

##### 13. **Token Breakdown**

Visual Example:
```
tokens: 12.5k→8.2k
tk: 1.5k→800 (abbreviated)
```

**Icon:** tokens:
**Values:** Token input→output breakdown (12.5k→8.2k)
**Location:** Right side
**Priority:** MEDIUM

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

##### 14. **Total Token Count**

Visual Example:
```
total: 20.7k
∑: 2.3k (abbreviated)
```

**Icon:** total:
**Values:** Total token count (20.7k)
**Location:** Right side
**Priority:** MEDIUM

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

##### 15. **Session Cost**

Visual Example:
```
session: $1.2500
sess: $5.67 (abbreviated)
```

**Icon:** session:
**Values:** Session total cost (session: $1.25)
**Location:** Right side
**Priority:** MEDIUM

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

##### 16. **Active Time**

Visual Example:
```
active: 3m42s
a: 1m30s (abbreviated)
active: 45s
```

**Icon:** active:
**Values:** Active processing time (3m42s)
**Location:** Right side
**Priority:** MEDIUM

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

##### 17. **Idle Time**

Visual Example:
```
idle: 1m18s
i: 2m5s (abbreviated)
idle: 30s
```

**Icon:** idle:
**Values:** Idle/waiting time (1m18s)
**Location:** Right side
**Priority:** MEDIUM

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

##### 18. **Stage Timer**

Visual Example:
```
stage: 45s
s: 2m15s (abbreviated)
stage: 1m30s
```

**Icon:** stage:
**Values:** Current stage duration (45s)
**Location:** Right side
**Priority:** MEDIUM

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

##### 19. **Preview Mode**

Visual Example:
```
📋 PREVIEW
```

**Icon:** 📋
**Values:** PREVIEW
**Location:** Right side
**Priority:** LOW

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

##### 20. **Thoughts Mode**

Visual Example:
```
💭 THOUGHTS
```

**Icon:** 💭
**Values:** THOUGHTS
**Location:** Right side
**Priority:** LOW

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

##### 21. **Verbose Mode**

Visual Example:
```
🔍 VERBOSE
```

**Icon:** 🔍
**Values:** VERBOSE
**Location:** Right side
**Priority:** LOW

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

The StatusBar automatically adapts to your terminal width using a priority-based system. This priority-based element display adapts to any terminal size and ensures critical information is always visible. It intelligently adapts to terminal width and display modes so critical information is always visible, whether you're in a wide terminal or a narrow terminal.

| Terminal Width | Display Tier | Elements Shown |
|----------------|--------------|----------------|
| < 60 columns | Narrow | CRITICAL + HIGH priority only, abbreviated labels |
| 60-160 columns | Normal | CRITICAL + HIGH + MEDIUM priority, full labels |
| > 160 columns | Wide | All priority levels, full labels + extended details |

**Responsive Features:**
- **Automatic abbreviation**: Labels automatically shorten in narrow terminals (e.g., `tokens:` → `tk:`) so narrow terminals show abbreviated labels while normal and wide terminals show full labels.
- **Progressive hiding**: Lower priority elements disappear first when space is limited
- **Value compression**: Long values are truncated with `...` when necessary
- **Mode override**: Compact mode always shows minimal info, verbose mode overrides width constraints

**Abbreviation Mapping:**
- `tokens:` → `tk:`
- `model:` → `mod:`
- `session:` → `sess:`
- `active:` → `act:`
- `cost:` → (no label)

### Display Mode Behavior

#### Compact Mode
Minimal elements only with Essential status information. Forces most aggressive space optimization regardless of terminal width and reduces rendering complexity.

#### Normal Mode
Responsive to terminal width. Shows standard development information and Balances information density with readability.

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

#### Missing Elements
If expected information isn't showing:
1. **Check display mode**: Some elements only appear in verbose mode
2. **Check terminal width**: Narrow terminals hide lower-priority elements
3. **Check data availability**: Elements only show when data exists (e.g., no cost display without an active task)
4. Compact mode hides non-essential elements
5. Elements only show when data exists

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

### Input Shortcuts
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

### Auto-Completion
*Suggestion and completion controls*

| Shortcut | Description | Context |
|----------|-------------|---------|
| `Tab` | Accept highlighted suggestion | Suggestions |
| `Ctrl+R` | Search input history for completions | Input |

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

Single-line summary:
```
✅ Task Completed - Tokens: 45,234 Cost: $0.1523 Duration: 3m 42s
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
- Formatting helpers: `formatTokens` and `formatCost` normalize display output

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
