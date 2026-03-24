# APEX

<p align="center">
  <img src="docs/logo.svg" alt="APEX Logo" width="200"/>
</p>

<p align="center">
  <strong>Autonomous Product Engineering eXecutor</strong><br/>
  AI-powered development team automation built on the Claude Agent SDK
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#contributing">Contributing</a>
</p>

---

APEX orchestrates specialized AI agents to automate software development workflows. It provides a "product team in a box" that can plan, implement, test, and review code changes.

## Quick Start

### Prerequisites

- Node.js 18+
- Git
- Anthropic API key

### Installation

```bash
# NPM (all platforms)
npm install -g @apexcli/cli

# Homebrew (macOS)
brew tap joshuaaferguson/apex
brew install apex
```

### Usage

```bash
# Initialize in your project
cd your-project
apex init

# Set your API key
export ANTHROPIC_API_KEY=your_key_here

# Run a development task
apex run "Add user authentication with JWT tokens"

# Start the API server and web dashboard
apex serve
```

## Features

- **Specialized Agents** — Purpose-built agents for planning, architecture, implementation, testing, code review, and DevOps
- **Configurable Workflows** — Define custom workflows with stages, dependencies, and approval gates
- **Autonomy Levels** — From fully autonomous to human-in-the-loop approval at each stage
- **Git Worktree Support** — Parallel task execution with automatic branch isolation and cleanup
- **Built-in Tools** — Full Claude Code tool parity (Read, Write, Edit, Bash, Glob, Grep, WebFetch, etc.)
- **Browser Automation** — Headless browser testing with Playwright integration
- **Permission System** — Fine-grained per-tool, per-directory permission controls with presets
- **Policy Engine** — Policy-as-code governance with approval rules and secret detection
- **Smart Autonomy Controls** — Budget, token, time, and change limits with approval gates
- **Code Quality** — Lint-after-edit, type checking integration, and TDD mode
- **MCP Integration** — Model Context Protocol for third-party tool servers
- **Context & Memory** — Git-aware context, project analysis, and persistent conversation memory
- **Codebase Intelligence** — AST-aware analysis with Tree-sitter for semantic code search
- **AI Platform Agnostic** — Modular driver architecture supporting Claude, OpenAI Codex, Gemini, and generic LLMs
- **Real-time Monitoring** — Web UI and WebSocket API for live task tracking
- **Cost Controls** — Built-in token budgets and usage tracking

## Built-in Agents

| Agent | Role | Model |
|-------|------|-------|
| **planner** | Creates implementation plans and breaks down tasks | opus |
| **architect** | Designs system architecture and makes technical decisions | opus |
| **developer** | Implements features and writes production code | sonnet |
| **tester** | Creates and runs tests, analyzes coverage | sonnet |
| **reviewer** | Reviews code for quality, bugs, and security issues | haiku |
| **devops** | Handles infrastructure, CI/CD, and deployment | sonnet |

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      APEX Platform                        │
├──────────────────────────────────────────────────────────┤
│  CLI / Web UI / Slack                                     │
│          │                                                │
│          ▼                                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │                  APEX API Server                    │  │
│  │    REST endpoints + WebSocket streaming             │  │
│  └────────────────────────────────────────────────────┘  │
│          │                                                │
│          ▼                                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │                APEX Orchestrator                    │  │
│  │       (Claude Agent SDK Integration)               │  │
│  │                                                     │  │
│  │   ┌────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐   │  │
│  │   │Planner │ │Architect│ │Developer│ │ Tester │   │  │
│  │   └────────┘ └─────────┘ └─────────┘ └────────┘   │  │
│  │   ┌────────┐ ┌────────┐                            │  │
│  │   │Reviewer│ │ DevOps │  ... Custom Agents         │  │
│  │   └────────┘ └────────┘                            │  │
│  └────────────────────────────────────────────────────┘  │
│          │                                                │
│          ▼                                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │                Project Repository                   │  │
│  │  .apex/config.yaml  .apex/agents/  .apex/workflows/ │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Project Structure

```
apex/
├── packages/
│   ├── core/           # Shared types, config, utilities
│   ├── orchestrator/   # Task engine, Claude Agent SDK integration
│   ├── cli/            # Commander.js CLI
│   ├── api/            # Fastify REST + WebSocket server
│   ├── browser/        # Playwright browser automation
│   └── web-ui/         # Next.js web dashboard
├── docs/               # Documentation
└── templates/          # Default agent/workflow templates
```

## Documentation

| Document | Description |
|----------|-------------|
| [Documentation Index](docs/INDEX.md) | Master navigation index for all 111+ docs |
| [Getting Started](docs/getting-started.md) | Installation and first steps |
| [Configuration](docs/configuration.md) | Project configuration options |
| [Agents](docs/agents.md) | Built-in agents and customization |
| [Workflows](docs/workflows.md) | Defining development workflows |
| [Browser Automation](docs/browser-automation.md) | Headless browser testing and visual regression |
| [Permission System](docs/permission-system.md) | Fine-grained permission controls |
| [Tool System](docs/tool-system.md) | Built-in tools, extensions, and MCP integration |
| [Autonomy Controls](docs/autonomy-controls.md) | Budget, token, and time limits |
| [Service Management](docs/service-management.md) | Daemon mode and system service setup |
| [TDD Workflows](docs/tdd-workflows.md) | Test-Driven Development with AI assistance |
| [Slack Integration](docs/slack-integration.md) | Socket Mode Slack app setup |
| [API Reference](docs/api-reference.md) | REST API and utility functions |
| [Windows Installation](docs/windows-installation.md) | Windows-specific setup |

## Development

```bash
git clone https://github.com/JoshuaAFerguson/apex.git
cd apex
npm install
npm run build
npm run dev
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built on [Claude Agent SDK](https://docs.anthropic.com/en/agent-sdk) by Anthropic

---

<p align="center">
  Made with 🤖 by <a href="https://github.com/JoshuaAFerguson">Joshua A. Ferguson</a>
</p>
