# Getting Started with APEX

This guide will walk you through setting up APEX and running your first automated development task.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18 or higher** - [Download Node.js](https://nodejs.org/)
- **Anthropic API Key** - [Get an API key](https://console.anthropic.com/)
- **Git** - For version control operations

## Installation

### Option 1: Global Installation (Recommended)

```bash
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

## Quick Start

### 1. Set Your API Key

```bash
export ANTHROPIC_API_KEY=your_api_key_here
```

Or add it to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
echo 'export ANTHROPIC_API_KEY=your_api_key_here' >> ~/.bashrc
source ~/.bashrc
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
