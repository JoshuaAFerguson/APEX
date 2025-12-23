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

| Command | Description |
|---------|-------------|
| `apex init` | Initialize APEX in current directory |
| `apex run <task>` | Execute a development task |
| `apex status` | Show task status and history |
| `apex agents` | List available AI agents |
| `apex workflows` | List available workflows |
| `apex config` | View/edit configuration |
| `apex logs [taskId]` | View task logs |
| `apex cancel <taskId>` | Cancel a running task |
| `apex retry <taskId>` | Retry a failed task |
| `apex serve` | Start the API server |
| `apex daemon` | Manage background daemon |

## Interactive Mode

Run `apex` without arguments to enter interactive mode:

```bash
apex

# APEX v0.3.0
# Type a task description or use /commands

> Add a dark mode toggle to the settings page
# Task started: task_abc123

> /status
# Shows current task progress

> /logs
# Shows recent logs
```

### Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/init` | Initialize project |
| `/status` | Show task status |
| `/agents` | List agents |
| `/workflows` | List workflows |
| `/config` | Show configuration |
| `/logs` | View logs |
| `/cancel` | Cancel current task |
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
