# Getting Started with APEX

This guide will walk you through setting up APEX and running your first automated development task.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18 or higher** - [Download Node.js](https://nodejs.org/)
- **Anthropic API Key** - [Get an API key](https://console.anthropic.com/)
- **Git** - For version control operations

### Windows-Specific Prerequisites

For Windows users, ensure you have:
- **Node.js 18+** - Install from [nodejs.org](https://nodejs.org/) or use `winget install OpenJS.NodeJS`
- **Git for Windows** - [Download](https://git-scm.com/download/win) for full Git functionality
- **PowerShell 5.1+** - Included with Windows 10/11
- **Windows Terminal** (recommended) - [Install from Microsoft Store](https://aka.ms/terminal) for the best CLI experience

> **Note:** APEX works in Command Prompt, PowerShell, Git Bash, and Windows Terminal. We recommend Windows Terminal for the best experience with colors and formatting.

## Installation

### Option 1: Global Installation (Recommended)

**All Platforms:**
```bash
npm install -g @apexcli/cli
```

**Windows-Specific:**
```powershell
# PowerShell (recommended)
npm install -g @apexcli/cli

# Or install Node.js first with winget
winget install OpenJS.NodeJS
npm install -g @apexcli/cli
```

### Option 2: Use npx

```bash
npx @apexcli/cli <command>
```

### Option 3: Local Development

```bash
git clone https://github.com/JoshuaAFerguson/apex.git
cd apex
npm install
npm run build
npm link
```

> **Windows Note:** If you encounter permission issues during global installation, run your terminal as Administrator or use `npm config set prefix %APPDATA%\npm` to install to your user directory.

## Quick Start

### 1. Set Your API Key

**Unix/Linux/macOS:**
```bash
export ANTHROPIC_API_KEY=your_api_key_here
```

**Windows Command Prompt:**
```cmd
set ANTHROPIC_API_KEY=your_api_key_here
```

**Windows PowerShell:**
```powershell
$env:ANTHROPIC_API_KEY="your_api_key_here"
```

#### Permanent Environment Variable Setup

**Unix/Linux/macOS:** Add to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):
```bash
echo 'export ANTHROPIC_API_KEY=your_api_key_here' >> ~/.bashrc
source ~/.bashrc
```

**Windows:** Set permanently using System Properties:
1. Press `Win + R`, type `sysdm.cpl`, press Enter
2. Click "Environment Variables" button
3. Under "User variables", click "New"
4. Variable name: `ANTHROPIC_API_KEY`
5. Variable value: `your_api_key_here`
6. Click OK and restart your terminal

**Or use PowerShell to set permanently:**
```powershell
[Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "your_api_key_here", "User")
# Restart your terminal after running this command
```

### 2. Initialize Your Project

Navigate to your project directory and run:

```bash
cd your-project
apex init
```

You'll be prompted for:
- **Project name** - Name of your project
- **Language** - Primary programming language (typescript, python, etc.)
- **Framework** - Optional framework (nextjs, fastapi, etc.)

This creates the `.apex/` directory with default configuration, agents, and workflows.

### 3. Review the Configuration

Open `.apex/config.yaml` to customize:

```yaml
version: "1.0"
project:
  name: "my-project"
  language: "typescript"

autonomy:
  default: "review-before-merge"  # Human approval before merging

limits:
  max_cost_per_task: 10.00  # Safety limit
```

### 4. Run Your First Task

```bash
apex run "Add a health check endpoint to the API"
```

APEX will:
1. Create a feature branch
2. Plan the implementation
3. Write the code
4. Create tests
5. Review the changes
6. Create a pull request (if configured)

## Understanding the Output

When you run a task, you'll see:

```
🚀 Starting APEX task...

Task created: task_abc123_def456
Branch: apex/abc123-add-health-check
Workflow: feature
Autonomy: review-before-merge

📍 Stage: planning
  🔧 Read
  🔧 Grep

📍 Stage: implementation
  🔧 Write
  🔧 Bash

✅ Task Completed

Tokens: 45,234
Cost: $0.1523
Duration: 3m 42s
```

## Terminal Interface (v0.3.0)

APEX now features a rich terminal interface with real-time updates, enhanced visual feedback, and customizable display modes:

### Progress Indicators

Tasks display live progress with detailed stage information:

```
🚀 APEX Task: Add authentication middleware

┌─ Task Progress ──────────────────────────────────────┐
│ Stage: implementation [■■■■■■■░░░] 70%               │
│ Agent: developer                                     │
│ File: src/middleware/auth.ts                         │
│                                                      │
│ Recent Actions:                                      │
│ ✓ Created auth middleware structure                  │
│ ✓ Added JWT validation logic                        │
│ → Writing error handling...                         │
└──────────────────────────────────────────────────────┘

Tokens: 12,456 | Cost: $0.0425 | Elapsed: 1m 23s
```

### Display Modes ✨ NEW in v0.3.0

Customize how information is displayed to match your workflow:

```bash
# Toggle compact mode for minimal display
/compact
● main | $0.0425

# Toggle verbose mode for maximum detail
/verbose
● main | ⚡developer | ▶implementation | tokens: 1.5k→800 | total: 2.3k | cost: $0.0425 | 🔍 VERBOSE

# Return to normal balanced display
/compact  # (toggles off)
```

**Three Display Modes:**
- **Normal** - Balanced information display (default)
- **Compact** - Minimal display for focus or small terminals
- **Verbose** - Maximum information for debugging and analysis

See [Display Modes Guide](user-guide/display-modes.md) for complete details.

### Input Preview ✨ NEW in v0.3.0

Preview what will be sent to Claude before executing commands:

```bash
# Enable preview mode
/preview on

# Now when you type commands, you'll see:
┌─ Input Preview ─────────────────────────────────────┐
│ Input: "implement user authentication"              │
│                                                     │
│ Intent: task_execution (85% confidence)            │
│ This will be sent to the developer agent           │
│                                                     │
│ [Enter] Execute  [Escape] Cancel  [E] Edit          │
└─────────────────────────────────────────────────────┘
```

**Benefits of Input Preview:**
- Verify your intent before execution
- See confidence levels for command interpretation
- Catch potential issues before they happen
- Learn how APEX processes different input types

See [Input Preview Guide](user-guide/input-preview.md) for complete details.

### Interactive Controls

Control task execution with keyboard shortcuts:
- `Space` - Pause/resume task
- `q` - Quit task
- `l` - View detailed logs
- `Enter` - Approve current stage (manual mode)
- `/compact` - Toggle compact display mode
- `/verbose` - Toggle verbose display mode
- `/preview on|off` - Control input preview mode

### Color-coded Output

- 🟢 Success indicators
- 🟡 Warnings and reviews
- 🔴 Errors and failures
- 🔵 Information and status updates
- 📋 Preview mode active indicator
- 🔍 Verbose mode active indicator

## Rich Terminal UI Framework

APEX's terminal interface is built on a modern React-based framework designed for exceptional developer experience. This section covers the 8 core UI capabilities that power the interactive CLI.

### Ink-based Rendering

APEX uses Ink, a React renderer for CLI applications, enabling component-based terminal interfaces with familiar React patterns:

```
Components render as a tree, just like React DOM:
┌─ App ─────────────────────────────────┐
│ ├─ Banner                             │
│ ├─ StatusBar                          │
│ ├─ TaskProgress                       │
│ ├─ AgentPanel                         │
│ └─ InputPrompt                        │
└───────────────────────────────────────┘
```

The component architecture enables maintainable, testable terminal interfaces with proper state management and event handling.

### Streaming & Real-time Updates

Experience live updates as agents work, with character-by-character streaming and animated cursors:

```
Streaming output with live cursor:
┌──────────────────────────────────────┐
│ The agent is analyzing your code...▊ │
└──────────────────────────────────────┘
```

Text appears dynamically with typewriter effects, creating an engaging real-time development experience that shows exactly what agents are thinking and doing.

### Markdown Rendering

Rich markdown content renders with full formatting support, making documentation and responses easy to read:

```
Markdown renders with full formatting:
# Header 1                    (cyan, bold)
## Header 2                   (blue, bold)
• Bullet points              (yellow bullets)
1. Numbered lists            (yellow numbers)
> Blockquotes               (gray with │ prefix)
`inline code`               (highlighted background)
```

Headers, lists, blockquotes, and inline code all render with appropriate colors and formatting for maximum readability.

### Syntax Highlighting

Code blocks receive full syntax highlighting for supported languages (TypeScript, JavaScript, Python, Rust, Go):

```
┌─ typescript ────────── 5 lines ──┐
│  1 │ const greeting = "Hello";   │
│  2 │ function sayHello() {       │
│  3 │   // This is a comment      │
│  4 │   console.log(greeting);    │
│  5 │ }                           │
└──────────────────────────────────┘
```

Keywords, strings, and comments are color-coded with line numbers. Code automatically wraps for narrow terminals while preserving readability.

### Diff Views

View code changes with comprehensive diff rendering supporting three display modes:

```
Unified diff view:
--- src/api.ts
+++ src/api.ts
@@ -1,3 +1,4 @@
   import express from 'express';
+  import cors from 'cors';        ← added (green)
   const app = express();
-  app.listen(3000);               ← removed (red)
+  app.listen(process.env.PORT);   ← added (green)
```

Unified, split, and inline modes automatically adapt to your terminal width. Line numbers, hunk headers, and color-coded additions/deletions make code changes clear.

### Responsive Layouts

The interface adapts to any terminal size using a 4-tier breakpoint system:

```
Breakpoint System:
┌────────────────────────────────────────────────────────────┐
│  Narrow   │  Compact  │   Normal   │        Wide          │
│  < 60     │  60-99    │  100-159   │       160+           │
│  cols     │  cols     │   cols     │       cols           │
├───────────┼───────────┼────────────┼──────────────────────┤
│ Minimal   │ Condensed │ Standard   │ Full with extras     │
│ UI only   │ display   │ display    │ split diffs, etc.    │
└────────────────────────────────────────────────────────────┘
```

Components automatically adjust their layout, information density, and visual elements based on available space using the `useStdoutDimensions` hook.

### Theme Support

Comprehensive theming supports both dark and light modes with agent-specific color schemes:

```
Agent Colors (Dark Theme):
  🟡 planner    - Yellow
  🔵 architect  - Blue
  🟢 developer  - Green
  🟣 reviewer   - Magenta
  🔵 tester     - Cyan
  🔴 devops     - Red
```

The ThemeProvider manages consistent colors across all UI components, syntax highlighting, and diff views with automatic adaptation for different terminal capabilities.

### Progress Indicators

Multiple progress indicator types provide clear feedback on task execution:

```
Progress indicators:
[■■■■■■■░░░] 70%            ← Progress bar
◐ Loading...                 ← Spinner
Step 2 of 4: implementation  ← Step progress
```

Progress bars show completion percentages, spinners indicate background activity, and step indicators track workflow stage progress. Multi-task views coordinate progress across parallel operations.

## Session Management Basics

APEX maintains session state for improved workflow continuity:

### Active Sessions

View and manage active tasks:

```bash
# List all active sessions
apex sessions

# Resume a paused session
apex resume task_abc123_def456

# Attach to a running session
apex attach task_abc123_def456
```

### Session Persistence

Sessions survive terminal disconnections and system restarts:
- Task state is automatically saved to `.apex/apex.db`
- Progress is preserved across interruptions
- Resume where you left off with full context

### Background Execution

Run tasks in the background:

```bash
# Start task in background
apex run "Fix memory leak" --background

# Check background tasks
apex status --background
```

### Production Deployment

For production environments or continuous operation, install APEX as a system service:

```bash
# Install as system service
apex install-service --enable

# Service will auto-start on boot and restart on failure
# View service status
systemctl --user status apex-daemon  # Linux
launchctl list | grep apex           # macOS
```

> 📖 **See [Service Management Guide](service-management.md)** for complete installation, configuration, and troubleshooting instructions.

## Keyboard Shortcuts & Tab Completion

### Tab Completion

APEX supports intelligent tab completion for faster workflows:

```bash
# Complete commands
apex <tab>
# Shows: init, run, status, logs, sessions, serve

# Complete task IDs
apex status task_<tab>
# Shows recent task IDs

# Complete autonomy levels
apex run "task" --autonomy <tab>
# Shows: full, review-before-commit, review-before-merge, manual
```

### Essential Shortcuts

| Shortcut | Action |
|----------|---------|
| `Ctrl+C` | Graceful task termination |
| `Ctrl+Z` | Pause task (resume with `fg`) |
| `↑/↓` | Navigate command history |
| `Tab` | Auto-complete commands/options |
| `Ctrl+L` | Clear terminal (preserves task state) |

### Setup Tab Completion

Add to your shell profile for persistent completion:

**Bash:**
```bash
echo 'eval "$(apex completion bash)"' >> ~/.bashrc
```

**Zsh:**
```bash
echo 'eval "$(apex completion zsh)"' >> ~/.zshrc
```

**Fish:**
```bash
apex completion fish | source
```

## Autonomy Levels

Choose how much control to give APEX:

| Level | Description |
|-------|-------------|
| `full` | Complete autonomy - executes without stopping |
| `review-before-commit` | Pauses before each commit for review |
| `review-before-merge` | Creates PR and waits for human approval |
| `manual` | Pauses at each stage for approval |

Set the default in config or override per-task:

```bash
apex run "Fix login bug" --autonomy manual
```

## Checking Status

View task status:

```bash
# List recent tasks
apex status

# Get details for a specific task
apex status task_abc123_def456

# View logs
apex logs task_abc123_def456
```

## Next Steps

### ✨ NEW in v0.3.0 - Enhanced Features
- **[Complete v0.3.0 Features Overview](features/v030-features.md)** - Comprehensive guide to all new features and capabilities
- **[Display Modes Guide](user-guide/display-modes.md)** - Customize how information is displayed (compact, normal, verbose)
- **[Input Preview Guide](user-guide/input-preview.md)** - Preview commands before execution with intent detection

### Complete Documentation
- [CLI Guide](cli-guide.md) - Complete command reference and advanced features
- [Service Management](service-management.md) - Install and manage APEX as a system service
- [Configure your agents](agents.md) - Customize agent behavior
- [Define workflows](workflows.md) - Create custom development workflows
- [API Reference](api-reference.md) - Integrate with your tools
- [Best Practices](best-practices.md) - Tips for effective usage

## Troubleshooting

### "APEX not initialized"

Run `apex init` in your project directory first.

### "ANTHROPIC_API_KEY not set"

Ensure your API key is set in the environment:
```bash
export ANTHROPIC_API_KEY=your_key
```

### Task exceeds budget

Increase the limit in `.apex/config.yaml`:
```yaml
limits:
  max_cost_per_task: 20.00
```

### Agent makes wrong decisions

1. Add more context to your task description
2. Include acceptance criteria
3. Customize agent prompts in `.apex/agents/`

## Getting Help

- [GitHub Issues](https://github.com/JoshuaAFerguson/apex/issues) - Report bugs
- [Discussions](https://github.com/JoshuaAFerguson/apex/discussions) - Ask questions
- [Discord](#) - Community chat (coming soon)
