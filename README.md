# APEX

Autonomous Product Engineering eXecutor - AI-powered development team automation.

## Installation

### NPM (Windows, macOS, Linux)

```bash
npm install -g @apexcli/cli
```

### Homebrew (macOS)

```bash
brew tap joshuaaferguson/apex
brew install apex
```

### Windows-Specific Installation

For Windows users, APEX works with Node.js and npm out of the box. You can also use Windows Package Manager:

```powershell
# Using winget (Windows Package Manager)
winget install OpenJS.NodeJS

# Then install APEX globally
npm install -g @apexcli/cli
```

**Windows Prerequisites:**
- Node.js 18+ ([Download](https://nodejs.org/))
- Git for Windows ([Download](https://git-scm.com/download/win))
- PowerShell 5.1+ (included with Windows 10/11)

> 📋 **Windows Note:** APEX has excellent Windows compatibility for core functionality. Service management features use manual process management on Windows (Windows service support is planned for future releases).

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

### Core Platform
- **🤖 Specialized Agents** - Purpose-built agents for planning, architecture, implementation, testing, code review, and DevOps
- **🔄 Configurable Workflows** - Define custom development workflows with stages, dependencies, and approval gates
- **🎛️ Autonomy Levels** - From fully autonomous to human-in-the-loop approval at each stage
- **🌳 Git Worktree Support** - Parallel task execution with automatic branch isolation and cleanup
- **📊 Real-time Monitoring** - Web UI and WebSocket API for live task tracking
- **💰 Cost Controls** - Built-in token budgets and usage tracking
- **🔌 Extensible** - Add custom agents, skills, and workflows
- **🏢 Enterprise Ready** - Scales from individual developers to large teams

### v0.5.0 - Tool System & Permissions ✨ **NEW**
- **🌐 Browser Automation** - Headless browser testing with Playwright (Chrome, Firefox, Safari)
- **🔧 Built-in Tools** - Complete Claude Code tool parity (Read, Write, Edit, Bash, etc.)
- **🛡️ Permission System** - Fine-grained control with autonomous/review/read-only presets
- **📋 Policy Engine** - Policy-as-code rules for path restrictions and approval gates
- **🎯 Autonomy Controls** - Smart budget, token, time, and change limits
- **🔍 Code Quality** - Lint-after-edit, auto-fix, type checking, and TDD mode
- **🔗 MCP Integration** - Model Context Protocol for extensible tool ecosystem
- **🔐 Secret Protection** - Automatic detection and blocking of credential leaks

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

> **Windows Users:** Use Command Prompt, PowerShell, or Windows Terminal for the best experience. Git Bash is also supported.

### Initialize a Project

```bash
cd your-project

# Initialize APEX
apex init

# Follow the prompts to configure your project
```

### Run Your First Task

```bash
# Set your API key (Unix/Linux/macOS)
export ANTHROPIC_API_KEY=your_key_here

# Windows Command Prompt
set ANTHROPIC_API_KEY=your_key_here

# Windows PowerShell
$env:ANTHROPIC_API_KEY="your_key_here"

# Run a development task
apex run "Add user authentication with JWT tokens"
```

### Slack Integration (Socket Mode)

1. Create a Slack app using `docs/slack-app-manifest.yaml`.
2. Enable Socket Mode and install the app to your workspace.
3. Set the Slack tokens in your environment (see `.env.example`).

Once the API is running, use `/apex` commands in Slack:

```
/apex run "task description"
/apex status
```

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/getting-started.md) | Installation and first steps |
| [Windows Installation Guide](docs/windows-installation.md) | Windows-specific setup and configuration |
| [Configuration](docs/configuration.md) | Project configuration options |
| [Slack Integration](docs/slack-integration.md) | Socket Mode Slack app setup and commands |
| [Time-Based Usage Management](docs/time-based-usage-management.md) | Day/night modes, auto-pause/resume, capacity management |
| [Service Management](docs/service-management.md) | Install and manage as system service |
| [Agents](docs/agents.md) | Built-in agents and customization |
| [Workflows](docs/workflows.md) | Defining development workflows |
| [TDD Workflows](docs/tdd-workflows.md) | Test-Driven Development with AI assistance |
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

## Utility Functions

APEX includes a comprehensive set of utility functions in the `@apex/core` package for common development tasks:

### Formatting Functions

#### `formatDuration(ms: number): string`
Formats duration in milliseconds to human-readable format.

```typescript
import { formatDuration } from '@apex/core';

formatDuration(500);       // "500ms"
formatDuration(2500);      // "2.5s"
formatDuration(125000);    // "2m 5s"
formatDuration(3725000);   // "1h 2m"
```

#### `formatElapsed(startTime: Date, currentTime?: Date): string`
Formats elapsed time from a start date to current time in human-readable format.

```typescript
import { formatElapsed } from '@apex/core';

const startTime = new Date('2024-01-01T10:00:00Z');
const currentTime = new Date('2024-01-01T10:02:30Z');

formatElapsed(startTime, currentTime);  // "2m 30s"
formatElapsed(startTime);               // Calculates from current time
formatElapsed(new Date(Date.now() - 5000));  // "5s"
```

#### `formatTokens(tokens: number): string`
Formats token count with commas for readability.

```typescript
import { formatTokens } from '@apex/core';

formatTokens(1234);      // "1,234"
formatTokens(5678901);   // "5,678,901"
formatTokens(42);        // "42"
```

#### `formatCost(cost: number): string`
Formats cost as USD with 4 decimal places.

```typescript
import { formatCost } from '@apex/core';

formatCost(0.0042);    // "$0.0042"
formatCost(1.2345);    // "$1.2345"
formatCost(10);        // "$10.0000"
```

### Truncation Functions

#### `truncate(str: string, maxLength: number, suffix?: string): string`
Truncates a string to a maximum length with optional suffix.

```typescript
import { truncate } from '@apex/core';

truncate("This is a long string", 10);          // "This is..."
truncate("Short", 10);                          // "Short"
truncate("Long content", 8, " [more]");         // "Lo [more]"
```

#### `truncateToolOutput(output: string, options?: TruncateOptions): TruncateResult`
Truncates tool output while preserving readability and JSON structure.

```typescript
import { truncateToolOutput } from '@apex/core';

// Basic truncation
const result = truncateToolOutput("Very long output...", { maxLength: 50 });
// result.output: truncated string
// result.truncated: boolean indicating if truncation occurred
// result.originalLength: original string length
// result.truncatedLength: final string length

// JSON-aware truncation
const jsonOutput = JSON.stringify({ items: [1, 2, 3, 4, 5] });
const truncated = truncateToolOutput(jsonOutput, {
  maxLength: 30,
  preserveJson: true
});
// Preserves JSON structure while truncating
```

### ID Generation Functions

#### `generateTaskId(): string`
Generates a unique task identifier.

```typescript
import { generateTaskId } from '@apex/core';

generateTaskId();  // "task_lx2n8p_a1b2c3d4"
```

#### `generateIdleTaskId(): string`
Generates a unique idle task identifier.

```typescript
import { generateIdleTaskId } from '@apex/core';

generateIdleTaskId();  // "idle_lx2n8p_e5f6g7h8"
```

#### `generateTaskTemplateId(): string`
Generates a unique task template identifier.

```typescript
import { generateTaskTemplateId } from '@apex/core';

generateTaskTemplateId();  // "template_lx2n8p_i9j0k1l2"
```

#### `generateApprovalId(): string`
Generates a unique approval identifier.

```typescript
import { generateApprovalId } from '@apex/core';

generateApprovalId();  // "apr_lx2n8p_m3n4o5p6"
```

All ID generation functions create unique identifiers using timestamps and cryptographic randomness for collision-free operation across distributed systems.

### Path Utilities

APEX provides cross-platform path utility functions in the `@apex/core` package for handling file system paths across Windows, macOS, and Linux.

#### `getHomeDir(): string`
Gets the user's home directory path in a cross-platform way.

```typescript
import { getHomeDir } from '@apex/core';

getHomeDir();  // On Windows: "C:\Users\username"
               // On macOS: "/Users/username"
               // On Linux: "/home/username"
```

#### `normalizePath(pathStr: string): string`
Normalizes a file path for the current platform, converting path separators and resolving relative components.

```typescript
import { normalizePath } from '@apex/core';

normalizePath('./src/../dist/file.js');     // "dist/file.js"
normalizePath('src\\utils\\..\\index.ts');  // "src/index.ts" (on Windows)
normalizePath('src/utils/../index.ts');     // "src/index.ts" (on Unix)
```

#### `getConfigDir(appName?: string): string`
Gets the configuration directory path in a cross-platform way.

```typescript
import { getConfigDir } from '@apex/core';

getConfigDir();           // On Windows: "C:\Users\username\AppData\Roaming"
                          // On macOS/Linux: "/Users/username/.config"

getConfigDir('apex');     // On Windows: "C:\Users\username\AppData\Roaming\apex"
                          // On macOS/Linux: "/Users/username/.config/apex"
```

### Shell Utilities

APEX provides cross-platform shell utility functions for executing commands and managing processes across different operating systems.

#### `getPlatformShell(): ShellConfig`
Gets the platform-appropriate shell configuration for command execution.

```typescript
import { getPlatformShell } from '@apex/core';

const shell = getPlatformShell();
// On Windows: { shell: 'cmd.exe', shellArgs: ['/d', '/s', '/c'] }
// On Unix: { shell: '/bin/sh', shellArgs: ['-c'] }

// Use with child_process.spawn
import { spawn } from 'child_process';
const child = spawn(shell.shell, [...shell.shellArgs, 'echo Hello'], { stdio: 'pipe' });
```

#### `isWindows(): boolean`
Checks if the current platform is Windows.

```typescript
import { isWindows } from '@apex/core';

isWindows();  // true on Windows, false on macOS/Linux

if (isWindows()) {
  console.log('Running on Windows');
} else {
  console.log('Running on Unix-like system');
}
```

#### `getKillCommand(pid: number): string[]`
Gets the platform-appropriate command to kill a process by PID.

```typescript
import { getKillCommand } from '@apex/core';

const killCmd = getKillCommand(12345);
// On Windows: ['taskkill', '/f', '/pid', '12345']
// On Unix: ['kill', '-9', '12345']

// Use with child_process.spawn
import { spawn } from 'child_process';
const killProcess = spawn(killCmd[0], killCmd.slice(1));
```

#### `createShellCommand(commandParts: string[]): string`
Creates a shell command string with proper platform-specific escaping.

```typescript
import { createShellCommand } from '@apex/core';

const cmd = createShellCommand(['echo', 'Hello World']);
// On Windows: 'echo "Hello World"'
// On Unix: "echo 'Hello World'"

const complexCmd = createShellCommand(['git', 'commit', '-m', 'feat: add new feature']);
// On Windows: 'git commit -m "feat: add new feature"'
// On Unix: "git commit -m 'feat: add new feature'"

// Handle special characters
const pathCmd = createShellCommand(['cp', '/path/with spaces/file.txt', '/dest']);
// On Unix: "cp '/path/with spaces/file.txt' /dest"
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
