# @apexcli/cli

Command-line interface for APEX - AI-powered development team automation.

## Overview

The APEX CLI provides an interactive terminal interface for:

- **Project Initialization** - Set up APEX in any codebase
- **Task Execution** - Run development tasks with AI agents
- **Workflow Management** - Configure and execute multi-stage workflows
- **Real-time Monitoring** - Track task progress with a rich terminal UI
- **Session Management** - Save and resume work sessions

## Installation

```bash
# Install globally
npm install -g @apexcli/cli

# Or use npx
npx @apexcli/cli
```

## Quick Start

```bash
# Initialize APEX in your project
apex init

# Set your API key
export ANTHROPIC_API_KEY=your_key_here

# Run a development task
apex run "Add user authentication with JWT"
```

## Commands

### Core Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `apex init` | | Initialize APEX in current directory |
| `apex run <task>` | `r` | Execute a development task |
| `apex status` | `s` | Show task status and history |
| `apex agents` | `a` | List available AI agents |
| `apex workflows` | `w` | List available workflows |
| `apex config` | `c` | View or edit configuration |
| `apex logs [taskId]` | `l` | View task logs |
| `apex cancel <taskId>` | | Cancel a running task |
| `apex retry <taskId>` | | Retry a failed task |
| `apex version` | `v` | Show APEX version |

### Server & Daemon

| Command | Aliases | Description |
|---------|---------|-------------|
| `apex serve` | | Start the API server |
| `apex web` | | Start the Web UI server |
| `apex stop` | | Stop background servers |
| `apex daemon` | `d` | Manage background daemon process |
| `apex service` | `svc` | Manage daemon as system service |
| `apex install-service` | `install-svc` | Install APEX daemon as system service |
| `apex uninstall-service` | `uninstall-svc` | Remove APEX daemon system service |

### Git & Branching

| Command | Aliases | Description |
|---------|---------|-------------|
| `apex push` | `p` | Push task branch to remote origin |
| `apex pr` | | Create a pull request for a completed task |
| `apex diff` | `d` | Show code changes made by a task |
| `apex merge` | `m` | Merge task branch into main branch |
| `apex checkout` | `co` | Switch to task worktree or manage worktrees |

### Task Interaction

| Command | Aliases | Description |
|---------|---------|-------------|
| `apex interact` | `i` | Interact with running tasks |
| `apex iterate` | | Iterate on a running task with feedback |
| `apex inspect` | `ins` | Inspect task results and details |
| `apex shell` | | Attach interactive shell to running task container |
| `apex undo` | `u` | Undo the last tool action(s) for a task |
| `apex thoughts` | | Toggle thought visibility |

### Task Organization

| Command | Aliases | Description |
|---------|---------|-------------|
| `apex template` | `tpl` | Manage task templates (list, create, delete) |
| `apex archive` | | Archive completed tasks or manage archived tasks |
| `apex unarchive` | | Restore an archived task |
| `apex trash` | `del` | Manage task trash |

### Codebase Analysis

| Command | Aliases | Description |
|---------|---------|-------------|
| `apex doctor` | `dr`, `health` | Run comprehensive health checks for APEX environment |
| `apex map-codebase` | `map`, `analyze` | Analyze existing codebase and generate documentation |
| `apex idle` | `suggestions` | View and manage improvement suggestions and idle processing |
| `apex think` | `t` | Thought capture system (capture, list, search, promote) |
| `apex context` | `ctx` | Show context allocation visualization |

### Memory Management

| Command | Aliases | Description |
|---------|---------|-------------|
| `apex remember` | `rem` | Store information in long-term memory |
| `apex recall` | `search-memory` | Search long-term memory |
| `apex memories` | `mem-list` | List all stored memories |
| `apex forget` | `forget-memory` | Delete memories by ID or criteria |

### MCP & Browser

| Command | Aliases | Description |
|---------|---------|-------------|
| `apex mcp` | | Manage MCP (Model Context Protocol) marketplace and servers |
| `apex browser` | `br` | Configure browser automation settings |

### Authentication & Usage

| Command | Aliases | Description |
|---------|---------|-------------|
| `apex auth` | `login` | Manage AI provider authentication (OAuth/OpenAuth) |
| `apex usage` | `budget` | View usage statistics and budget management |
| `apex workspace` | `ws` | Manage task workspaces (list, info, cleanup, stats) |

## Interactive Mode

Run `apex` without arguments to enter interactive mode:

```bash
apex

# APEX v0.7.0
# Type a task description or use /commands

> Add a dark mode toggle to the settings page
# Task started: task_abc123

> /status
# Shows current task progress

> /logs
# Shows recent logs
```

### Slash Commands

All commands listed above are available as slash commands in interactive mode (e.g., `/status`, `/run`, `/doctor`). Key commands:

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/init` | Initialize project |
| `/status` | Show task status |
| `/run <task>` | Run a task with options |
| `/agents` | List agents |
| `/workflows` | List workflows |
| `/config` | Show/edit configuration |
| `/logs` | View logs |
| `/cancel` | Cancel current task |
| `/doctor` | Run environment health checks |
| `/map-codebase` | Analyze codebase and generate docs |
| `/template` | Manage task templates |
| `/remember <text>` | Store in long-term memory |
| `/recall <query>` | Search long-term memory |
| `/memories` | List all stored memories |
| `/forget <id>` | Delete a memory |
| `/mcp` | Manage MCP servers and marketplace |
| `/browser` | Configure browser automation |
| `/think` | Capture and manage thoughts |
| `/idle` | View improvement suggestions |
| `/context` | Show context allocation |
| `/undo` | Undo last tool action |
| `/clear` | Clear screen |
| `/exit` | Exit APEX |

## Configuration

APEX stores configuration in `.apex/config.yaml`:

```yaml
project:
  name: my-project
  description: My awesome project

autonomy:
  level: supervised  # autonomous | supervised | manual
  requireApproval:
    - deploy
    - delete

limits:
  maxTokensPerTask: 100000
  maxCostPerTask: 5.00
```

## Features

### Rich Terminal UI
- Syntax-highlighted code diffs
- Progress indicators
- Collapsible agent thoughts
- Markdown rendering

### Session Management
- Auto-save progress
- Resume interrupted tasks
- Input history

### Daemon Mode
- Background task processing
- System service integration (Linux/macOS)

## Related Packages

- [@apexcli/core](https://www.npmjs.com/package/@apexcli/core) - Core types and utilities
- [@apexcli/orchestrator](https://www.npmjs.com/package/@apexcli/orchestrator) - Task execution engine
- [@apexcli/api](https://www.npmjs.com/package/@apexcli/api) - REST API server

## Requirements

- Node.js 18+
- Anthropic API key

## License

MIT
