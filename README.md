# APEX

Autonomous Product Engineering eXecutor - AI-powered development team automation.

## Installation

### NPM

```bash
npm install -g @apexcli/cli
```

### Homebrew (macOS)

```bash
brew tap joshuaaferguson/apex
brew install apex
```

<p align="center">
  <img src="docs/logo.svg" alt="APEX Logo" width="200"/>
</p>

<p align="center">
  <strong>AI-powered development team automation built on the Claude Agent SDK</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#git-worktree-support">Worktrees</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#contributing">Contributing</a>
</p>

---

APEX is an open-source platform that orchestrates a team of specialized AI agents to automate software development workflows. Built on Anthropic's Claude Agent SDK, it provides a complete "product team in a box" that can plan, implement, test, and review code changes.

## Features

- **🤖 Specialized Agents** - Purpose-built agents for planning, architecture, implementation, testing, code review, and DevOps
- **🔄 Configurable Workflows** - Define custom development workflows with stages, dependencies, and approval gates
- **🎛️ Autonomy Levels** - From fully autonomous to human-in-the-loop approval at each stage
- **🌳 Git Worktree Support** - Parallel task execution with automatic branch isolation and cleanup
- **📊 Real-time Monitoring** - Web UI and WebSocket API for live task tracking
- **💰 Cost Controls** - Built-in token budgets and usage tracking
- **🔌 Extensible** - Add custom agents, skills, and workflows
- **🏢 Enterprise Ready** - Scales from individual developers to large teams

## Platform Support

APEX is designed to work cross-platform with full compatibility across operating systems:

| Platform | Status | Notes |
|----------|--------|--------|
| **Linux** | ✅ Full Support | All features including service management |
| **macOS** | ✅ Full Support | All features including service management |
| **Windows** | ✅ Core Support | All core functionality works; service management in development |

### Windows Compatibility

- ✅ **Core Features**: Task orchestration, AI agents, workflows, API server
- ✅ **Build & Test**: Full CI/CD pipeline with Windows testing
- ✅ **Git Operations**: Worktrees, branching, and all Git workflows
- ✅ **Development**: TypeScript compilation, testing, and packaging
- ⚠️ **Service Management**: Manual process management (Windows service support planned)

For detailed Windows compatibility information, see [WINDOWS_COMPATIBILITY.md](WINDOWS_COMPATIBILITY.md).

## Quick Start

### Prerequisites

- Node.js 18+
- Anthropic API key
- Git

### Installation

```bash
# Install globally
npm install -g @apexcli/cli

# Or use npx
npx @apexcli/cli init
```

### Initialize a Project

```bash
cd your-project

# Initialize APEX
apex init

# Follow the prompts to configure your project
```

### Run Your First Task

```bash
# Set your API key
export ANTHROPIC_API_KEY=your_key_here

# Run a development task
apex run "Add user authentication with JWT tokens"
```

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/getting-started.md) | Installation and first steps |
| [Configuration](docs/configuration.md) | Project configuration options |
| [Time-Based Usage Management](docs/time-based-usage-management.md) | Day/night modes, auto-pause/resume, capacity management |
| [Service Management](docs/service-management.md) | Install and manage as system service |
| [Agents](docs/agents.md) | Built-in agents and customization |
| [Workflows](docs/workflows.md) | Defining development workflows |
| [API Reference](docs/api-reference.md) | REST API documentation |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        APEX Platform                          │
├──────────────────────────────────────────────────────────────┤
│  CLI / Web UI / VS Code Extension                            │
│          │                                                    │
│          ▼                                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                    APEX API Server                      │  │
│  │  REST endpoints + WebSocket for real-time streaming     │  │
│  └────────────────────────────────────────────────────────┘  │
│          │                                                    │
│          ▼                                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                  APEX Orchestrator                      │  │
│  │         (Claude Agent SDK Integration)                  │  │
│  │                                                         │  │
│  │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │  │
│  │   │ Planner │ │Architect│ │Developer│ │ Tester  │     │  │
│  │   └─────────┘ └─────────┘ └─────────┘ └─────────┘     │  │
│  │   ┌─────────┐ ┌─────────┐                              │  │
│  │   │Reviewer │ │ DevOps  │  ... Custom Agents           │  │
│  │   └─────────┘ └─────────┘                              │  │
│  └────────────────────────────────────────────────────────┘  │
│          │                                                    │
│          ▼                                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                  Project Repository                     │  │
│  │  .apex/config.yaml  .apex/agents/  .apex/workflows/    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Built-in Agents

| Agent | Description | Model |
|-------|-------------|-------|
| **planner** | Creates implementation plans and breaks down tasks | opus |
| **architect** | Designs system architecture and makes technical decisions | opus |
| **developer** | Implements features and writes production code | sonnet |
| **reviewer** | Reviews code for quality, bugs, and security issues | haiku |
| **tester** | Creates and runs tests, analyzes coverage | sonnet |
| **devops** | Handles infrastructure, CI/CD, and deployment | sonnet |

## Workflows

APEX includes pre-built workflows for common development patterns:

- **feature** - Full feature implementation (plan → design → implement → test → review)
- **bugfix** - Bug investigation and fix (investigate → fix → test → review)
- **refactor** - Code refactoring (analyze → refactor → test → review)

Create custom workflows in `.apex/workflows/` to match your team's process.

## Git Worktree Support

APEX includes advanced git worktree management for parallel task execution and isolation. Worktrees allow multiple tasks to work simultaneously without interfering with each other.

### Overview

Git worktrees create isolated working directories that share the same repository history but have independent working trees and staged areas. This enables:

- **Parallel Task Execution**: Run multiple tasks simultaneously without conflicts
- **Branch Isolation**: Each task operates on its own branch in a separate directory
- **Resource Efficiency**: Share git history while maintaining separate workspaces
- **Automatic Cleanup**: Intelligent cleanup of stale worktrees

### Enabling Worktree Management

Add worktree configuration to your `.apex/config.yaml`:

```yaml
# .apex/config.yaml
version: "1.0"
git:
  autoWorktree: true  # Enable automatic worktree creation for tasks
  worktree:
    cleanupOnComplete: true       # Auto-cleanup after task completion
    maxWorktrees: 5              # Maximum concurrent worktrees
    pruneStaleAfterDays: 7       # Days before stale worktree cleanup
    preserveOnFailure: false     # Keep worktree on task failure for debugging
    cleanupDelayMs: 5000         # Delay before cleanup (allows file handles to close)
    baseDir: "../.apex-worktrees"  # Custom base directory (optional)
```

### The /checkout Command

Use the `/checkout` command to manage task worktrees:

#### Switch to Task Worktree
```bash
/checkout <task_id>  # Switch to the worktree for a specific task
```

#### List All Worktrees
```bash
/checkout --list     # Show all task worktrees with their status
```

#### Cleanup Worktrees
```bash
/checkout --cleanup                 # Remove all orphaned/stale worktrees
/checkout --cleanup <task_id>       # Remove worktree for specific task
```

### Benefits of Parallel Execution

With worktrees enabled:

1. **No Branch Conflicts**: Each task works on its own branch in isolation
2. **Concurrent Development**: Multiple agents can implement features simultaneously
3. **Safe Experimentation**: Failed tasks don't affect other work
4. **Easy Context Switching**: Quickly switch between tasks without losing state
5. **Automatic Management**: APEX handles worktree creation, cleanup, and maintenance

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `cleanupOnComplete` | `true` | Automatically delete worktree when task completes successfully |
| `maxWorktrees` | `5` | Maximum number of concurrent worktrees allowed |
| `pruneStaleAfterDays` | `7` | Days after which unused worktrees are considered stale |
| `preserveOnFailure` | `false` | Keep worktree when task fails (useful for debugging) |
| `cleanupDelayMs` | `0` | Delay before cleanup to ensure file handles are released |
| `baseDir` | `../.apex-worktrees` | Directory where worktrees are created |

### Worktree Lifecycle

1. **Creation**: When a task starts with `autoWorktree: true`, APEX creates a new worktree
2. **Branch Creation**: A new branch is created for the task (e.g., `apex/task-abc123`)
3. **Task Execution**: All agent work happens in the isolated worktree
4. **Cleanup**: After completion, the worktree is automatically removed (if `cleanupOnComplete: true`)
5. **Merge**: Changes are merged back to the main branch

### Example Workflow

```bash
# Enable worktrees in your project
apex config set git.autoWorktree true

# Start multiple tasks - they'll run in parallel worktrees
apex run "Add user authentication"
apex run "Implement API rate limiting"
apex run "Fix database connection pooling"

# Check active worktrees
/checkout --list

# Switch to a specific task's worktree for manual inspection
/checkout abc123

# Clean up stale worktrees
/checkout --cleanup
```

## Configuration

```yaml
# .apex/config.yaml
version: "1.0"
project:
  name: "my-project"
  language: "typescript"
  framework: "nextjs"

git:
  autoWorktree: true
  branchPrefix: "apex/"
  worktree:
    cleanupOnComplete: true
    maxWorktrees: 5
    preserveOnFailure: false

autonomy:
  default: "review-before-merge"
  overrides:
    documentation: "full"
    database-migrations: "manual"

models:
  planning: "opus"
  implementation: "sonnet"
  review: "haiku"

limits:
  max_tokens_per_task: 500000
  max_cost_per_task: 10.00
  daily_budget: 100.00
```

## API Server

Start the API server for web UI and programmatic access:

```bash
# Start the server
apex serve

# Or with custom options
apex serve --port 3000 --host 0.0.0.0
```

### REST Endpoints

```
POST   /tasks              - Create a new task
GET    /tasks              - List tasks
GET    /tasks/:id          - Get task details
POST   /tasks/:id/status   - Update task status
GET    /agents             - List available agents
WS     /stream/:taskId     - Real-time task updates
```

## Development

```bash
# Clone the repository
git clone https://github.com/JoshuaAFerguson/apex.git
cd apex

# Install dependencies
npm install

# Build all packages
npm run build

# Run in development mode
npm run dev
```

## Project Structure

```
apex/
├── packages/
│   ├── core/           # Shared types and utilities
│   ├── orchestrator/   # Claude Agent SDK orchestration
│   ├── cli/            # Command-line interface
│   ├── api/            # REST + WebSocket server
│   ├── web-ui/         # Dashboard (coming soon)
│   └── vscode/         # VS Code extension (coming soon)
├── templates/          # Default agent/workflow templates
├── docs/               # Documentation
└── examples/           # Example projects
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built on [Claude Agent SDK](https://docs.anthropic.com/en/agent-sdk) by Anthropic
- Inspired by the vision of AI-assisted software development

---

<p align="center">
  Made with 🤖 by <a href="https://github.com/JoshuaAFerguson">Joshua A. Ferguson</a>
</p>
