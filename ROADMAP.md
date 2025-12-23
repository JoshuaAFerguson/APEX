# APEX Roadmap

This document outlines the planned development roadmap for APEX. Our goal is to create a **general-purpose multi-agent orchestration platform** that starts with world-class software development capabilities (on par with Claude Code, Codex CLI, and Gemini CLI) and expands to support any domain requiring intelligent agent collaboration—education, creative writing, game development, business, research, and beyond.

> **Legend:**
>
> - 🟢 Complete
> - 🟡 In Progress
> - ⚪ Planned
> - 💡 Under Consideration

---

## v0.1.0 - Foundation (Complete)

*Core infrastructure and MVP functionality*

### Core Platform

- 🟢 Monorepo structure with Turborepo
- 🟢 Type-safe configuration system (Zod schemas)
- 🟢 SQLite task persistence
- 🟢 Agent definition format (Markdown + YAML frontmatter)
- 🟢 Workflow definition format (YAML)
- 🟢 Claude Agent SDK integration

### CLI

- 🟢 `apex init` - Project initialization
- 🟢 `apex run` - Execute tasks
- 🟢 `apex status` - View task status
- 🟢 `apex agents` - List agents
- 🟢 `apex workflows` - List workflows
- 🟢 `apex logs` - View task logs

### Agents

- 🟢 Planner agent
- 🟢 Architect agent
- 🟢 Developer agent
- 🟢 Reviewer agent
- 🟢 Tester agent
- 🟢 DevOps agent

### API Server

- 🟢 REST API for task management
- 🟢 WebSocket streaming for real-time updates
- 🟢 Health check endpoint

### Safety & Controls

- 🟢 Dangerous command blocking
- 🟢 Token usage tracking
- 🟢 Cost estimation
- 🟢 Budget limits

---

## v0.2.0 - Production Ready (Complete)

*Stability, testing, and deployment improvements*

### Testing & Quality

- 🟢 Unit test suite (>80% coverage) - *560 tests, 89% coverage*
- 🟢 Integration tests
- 🟢 End-to-end tests - *21 CLI E2E tests*
- ⚪ Performance benchmarks
- ⚪ Load testing

### CLI Enhancements

- 🟢 `apex serve` - Start API server from CLI
- 🟢 `apex cancel <taskId>` - Cancel running tasks
- 🟢 `apex retry <taskId>` - Retry failed tasks
- 🟢 `apex config` - View/edit configuration
- 🟢 `apex pr <taskId>` - Create pull requests
- 🟢 Interactive REPL mode (Claude Code-style)
- 🟢 `/commands` system for special operations
- 🟢 Background service auto-start (API & Web UI)
- 🟢 Silent mode for background services
- 🟢 Progress bars and spinners

### Orchestrator Improvements

- 🟢 Task queue with priorities
- 🟢 Concurrent task execution
- 🟢 Task dependencies
- 🟢 Automatic retries with backoff
- 🟢 Subtask decomposition and execution
- 🟢 Context compaction strategies

### Git Integration

- 🟢 Automatic PR creation via `gh` CLI
- 🟢 PR description generation
- 🟢 Commit message improvements
- 🟢 Branch cleanup after merge
- 🟢 Conflict detection and resolution suggestions
- 🟢 Conventional changelog generation

### Documentation

- 🟢 API reference (OpenAPI/Swagger)
- 🟢 Agent authoring guide
- 🟢 Workflow authoring guide
- 🟢 Best practices guide
- 🟢 Troubleshooting guide

---

## v0.3.0 - Claude Code-like Interactive Experience (In Progress)

*Transform APEX into a world-class AI coding assistant CLI*

The goal of v0.3.0 is to make APEX feel as polished and intuitive as Claude Code, Codex CLI, and Gemini CLI while maintaining our unique multi-agent orchestration capabilities.

> **Technical Design**: See [ADR-008: Comprehensive Technical Design](/docs/adr/008-v030-comprehensive-technical-design.md) for detailed implementation specifications.
> **Implementation Plan**: See [ADR-009: Implementation Plan](/docs/adr/009-v030-implementation-plan.md) for detailed remaining work.

### Rich Terminal UI (`@apexcli/cli`)

- 🟢 **Ink-based UI framework** - React for CLI for complex layouts
- 🟢 **Streaming response rendering** - Character-by-character output (`StreamingText.tsx`)
- 🟢 **Markdown rendering** - Full CommonMark support (`MarkdownRenderer.tsx`)
- 🟢 **Syntax-highlighted code blocks** - Language-aware highlighting (`SyntaxHighlighter.tsx`)
- 🟢 **Diff views** - Unified, split, and inline modes (`DiffViewer.tsx`)
- 🟢 **Boxed UI elements** - Panels, cards, and bordered sections
- 🟢 **Responsive layouts** - Full 4-tier breakpoint system (narrow/compact/normal/wide)
- 🟢 **Theme support** - Dark/light modes with ThemeContext

### Status Bar & Information Display

- 🟢 **Persistent status bar** - Always visible at bottom (`StatusBar.tsx`)
- 🟢 **Token usage counter** - Real-time input/output token display
- 🟢 **Cost tracker** - Running cost with session total
- 🟢 **Model indicator** - Show which model is active
- 🟢 **Session timer** - Integrated in StatusBar with elapsed time display
- 🟢 **Git branch display** - Current branch in prompt
- 🟢 **Agent indicator** - Which agent is currently active
- 🟢 **Workflow stage display** - Current stage in multi-stage workflows
- 🟢 **Subtask progress** - StatusBar supports props with responsive layout

### Natural Language Interface

- 🟢 **Natural language first** - Type tasks directly without commands
- 🟢 **Smart intent detection** - Distinguish commands from tasks (`IntentDetector.tsx`)
- 🟢 **Conversational context** - ConversationManager implemented, needs REPL integration
- 🟢 **Task refinement** - Clarification flow in ConversationManager
- 🟢 **Suggested actions** - Contextual suggestions (`SmartSuggestions`)

### Input Experience

- 🟢 **Tab completion** - CompletionEngine integrated with AdvancedInput (debounced, fuzzy search)
- 🟢 **History navigation** - Up/down arrows for command history
- 🟢 **History search** - Ctrl+R search implemented via ShortcutManager
- 🟢 **Multi-line input** - Shift+Enter support in AdvancedInput
- 🟢 **Inline editing** - Edit previous input before sending
- 🟢 **Input preview** - Show what will be sent before execution

### Output & Feedback

- 🟢 **Streaming output** - Real-time character streaming
- 🟢 **Progress indicators** - Spinners, progress bars, percentage (`ProgressIndicators.tsx`)
- 🟢 **Activity log** - Collapsible log of actions (`ActivityLog.tsx`)
- 🟢 **Error formatting** - Clear, actionable error messages (`ErrorDisplay.tsx`)
- 🟢 **Success celebration** - Visual feedback on task completion (`SuccessCelebration.tsx`)
- 🟢 **Compact mode** - Condensed output for experienced users
- 🟢 **Verbose mode** - Detailed output for debugging

### Keyboard Shortcuts

- 🟢 **Ctrl+C** - Cancel current operation
- 🟢 **Ctrl+D** - Exit REPL
- 🟢 **Ctrl+L** - ShortcutManager registered, needs handler wiring
- 🟢 **Ctrl+U** - Clear current line (registered)
- 🟢 **Ctrl+W** - Delete word (registered)
- 🟢 **Ctrl+A/E** - Beginning/end of line (registered)
- 🟢 **Ctrl+P/N** - Previous/next history (registered)
- 🟢 **Tab** - Complete suggestion (registered)
- 🟢 **Escape** - Dismiss (registered)
- 🟢 **Full ShortcutManager** - Context-aware shortcut system implemented

### Multi-Agent Visualization

- 🟢 **Agent activity panel** - AgentPanel.tsx with full mode and compact mode
- 🟢 **Agent handoff animation** - Animated arrows (→→→), pulse effects, elapsed time display (see ADR-013)
- 🟢 **Parallel execution view** - Shows agents working simultaneously with ⟂ icon, cyan styling (see ADR-012)
- 🟢 **Subtask tree** - Full collapse/expand, keyboard navigation, interactive subtask hierarchy
- 🟢 **Workflow progress** - Visual workflow stage progression
- 🟢 **Agent thought display** - Complete thoughts system with `/thoughts` command, collapsible AgentThoughts components

### Session Management

- 🟢 **Session persistence** - SessionStore fully implemented with CRUD
- 🟢 **Session export** - Export to markdown/JSON/HTML implemented
- 🟢 **Session branching** - branchSession() implemented
- 🟢 **Named sessions** - Save and load named sessions implemented
- 🟢 **Session search** - listSessions() with search filter
- 🟢 **Auto-save** - SessionAutoSaver with interval + threshold triggers
- 🟢 **Session commands** - All commands implemented in repl.tsx

### v0.3.0 Development Plan (Updated December 2024)

> **Architecture Review**: See [ADR-010: Feature Development Technical Design](/docs/adr/010-v030-feature-development-technical-design.md) for detailed implementation specifications.

**Phase 1: Integration Work (COMPLETE)**

| Task | Status | Effort | Files |
|------|--------|--------|-------|
| Wire CompletionEngine to AdvancedInput | 🟢 | Complete | `cli/src/ui/components/AdvancedInput.tsx` |
| Integrate ConversationManager with REPL | 🟢 | Complete | `cli/src/repl.tsx` |
| StatusBar session timer + subtask progress | 🟢 | Complete | `cli/src/ui/components/StatusBar.tsx` |
| Wire ShortcutManager event handlers | 🟢 | Complete | `cli/src/repl.tsx`, `App.tsx` |
| Real-time streaming to UI | 🟢 | Complete | `cli/src/repl.tsx` (agent:message, agent:tool-use, usage:updated events) |

**Phase 2: Enhancements (COMPLETE)**

| Task | Status | Effort | Files |
|------|--------|--------|-------|
| AgentPanel enhancements (handoff, parallel) | 🟢 | Complete | `AgentPanel.tsx`, `HandoffIndicator.tsx`, `useAgentHandoff.ts` (see ADR-012, ADR-013, ADR-014) |
| SubtaskTree enhancements (collapse/expand) | 🟢 | Complete | `cli/src/ui/components/agents/SubtaskTree.tsx` |
| Display modes (compact/verbose) | 🟢 | Complete | `cli/src/repl.tsx` |

**Phase 3: Polish & Testing (MEDIUM PRIORITY)**

| Task | Status | Effort | Files |
|------|--------|--------|-------|
| Integration tests | ⚪ | 1 day | `cli/src/__tests__/v030-features.integration.test.tsx` |
| Documentation updates | 🟢 Complete | 1 day | `docs/` |

**Estimated Remaining**: 2 days (testing + documentation)

> **Key Finding**: Most core services (SessionStore, CompletionEngine, ShortcutManager, ConversationManager) are already implemented. Primary remaining work is **integration** and **UI component enhancements**.

### Dependencies (Already Installed)

- `ink` - React for CLI
- `ink-syntax-highlight`, `shiki`, `prism-react-renderer` - Syntax highlighting
- `marked`, `marked-terminal` - Markdown rendering
- `diff`, `fast-diff` - Diff computation
- `fuse.js` - Fuzzy search for completion
- `terminal-kit` - Advanced terminal features

---

## v0.4.0 - Sleepless Mode & Autonomy

*24/7 autonomous operation with intelligent scheduling - inspired by [sleepless-agent](https://github.com/context-machine-lab/sleepless-agent)*

### Daemon Mode

- ⚪ **Background service** - Run APEX as persistent daemon (`apex daemon start/stop/status`)
- ⚪ **Service installation** - `apex install-service` for systemd (Linux) and launchd (macOS)
- ⚪ **Auto-start on boot** - Optional system service registration
- ⚪ **Task queue processing** - Automatically process queued tasks
- ⚪ **Health monitoring** - Self-healing daemon with watchdog
- ⚪ **Graceful shutdown** - Complete in-progress tasks before stopping

### Time-Based Usage Management

- ⚪ **Day/night modes** - Different usage thresholds by time of day
- ⚪ **Night mode (aggressive)** - Higher threshold (e.g., 96%) for overnight execution
- ⚪ **Day mode (conservative)** - Lower threshold (e.g., 90%) to preserve manual capacity
- ⚪ **Configurable time windows** - Define custom day/night hours
- ⚪ **Auto-pause at threshold** - Stop new tasks when limit approached
- ⚪ **Auto-resume after cooldown** - Resume when usage resets (already implemented for rate limits)

### Session Recovery & Continuity

- ⚪ **Auto-resume on session limit** - Automatically resume highest parent task when context window expires
- ⚪ **Session state persistence** - Save task progress before session ends
- ⚪ **Conversation summary injection** - Inject summary of previous session context on resume
- ⚪ **Seamless task continuation** - Resume exactly where the task left off
- ⚪ **Resume notification** - Notify user when auto-resume triggers
- ⚪ **Resume delay configuration** - Configurable delay before auto-resume (default: immediate)
- ⚪ **Max resume attempts** - Limit consecutive auto-resumes to prevent infinite loops

### Task Auto-Generation (Idle Processing)

- ⚪ **Idle task generation** - Generate improvement tasks during idle periods
- ⚪ **Configurable strategies** - Maintenance (40%), refactoring (30%), documentation (20%), tests (10%)
- ⚪ **Project-aware suggestions** - Analyze codebase for potential improvements
- ⚪ **Priority queuing** - Auto-generated tasks at lower priority than manual
- ⚪ **Strategy customization** - Configure via `.apex/config.yaml`
- ⚪ **Opt-in/opt-out** - Disable auto-generation per project

### Thought Capture Mode

- ⚪ **Quick thought capture** - `apex think "idea"` for low-friction idea logging
- ⚪ **Auto-commit to ideas branch** - Thoughts committed to `apex/ideas` branch
- ⚪ **Thought → task promotion** - Convert thoughts to full tasks when ready
- ⚪ **Thought search** - Search and browse captured thoughts
- ⚪ **Thought expiration** - Optional auto-cleanup of old thoughts

### Workspace Isolation (inspired by [Rover](https://github.com/endorhq/rover))

**Container Sandbox**

- ⚪ **Docker/Podman sandbox** - Each task runs in isolated container
- ⚪ **Custom base images** - Project-specific sandbox images (`.apex/Dockerfile`)
- ⚪ **Auto dependency install** - Install project dependencies in sandbox
- ⚪ **Sandbox shell access** - `apex shell <taskId>` for manual intervention
- ⚪ **Resource limits** - CPU/memory limits per container

**Git Worktree Isolation**

- ⚪ **Worktree per task** - Each task gets independent git worktree
- ⚪ **Branch isolation** - Separate branch per task (already have this)
- ⚪ **True parallel execution** - Multiple tasks modify code simultaneously
- ⚪ **Worktree cleanup** - Auto-cleanup after merge/cancel

**Isolation Modes**

- ⚪ **Full isolation** - Container + worktree (safest, slower)
- ⚪ **Worktree only** - Git worktree without container (faster)
- ⚪ **Shared workspace** - Current behavior (fastest, single task)
- ⚪ **Configurable per workflow** - Set default isolation mode

### Task Interaction Commands (inspired by [Rover](https://github.com/endorhq/rover))

**Task Refinement**

- ⚪ **`apex iterate <taskId>`** - Refine task with additional instructions
- ⚪ **`apex iterate <taskId> "feedback"`** - Add specific feedback for next iteration
- ⚪ **Iteration history** - Track all iterations and their outcomes
- ⚪ **Iteration diff** - Compare changes between iterations

**Task Inspection**

- ⚪ **`apex inspect <taskId>`** - View comprehensive task results
- ⚪ **`apex inspect <taskId> --files`** - List generated/modified files
- ⚪ **`apex inspect <taskId> --file <path>`** - View specific file content
- ⚪ **`apex inspect <taskId> --docs`** - View generated documentation
- ⚪ **`apex inspect <taskId> --timeline`** - View execution timeline

**Code Review Commands**

- ⚪ **`apex diff <taskId>`** - View all code changes made by task
- ⚪ **`apex diff <taskId> --stat`** - Summary of changes (files, lines)
- ⚪ **`apex diff <taskId> --file <path>`** - Diff for specific file
- ⚪ **`apex diff <taskId> --staged`** - Show what will be committed

**Git Integration**

- ⚪ **`apex push <taskId>`** - Push task branch to remote
- ⚪ **`apex merge <taskId>`** - Merge task branch to current branch
- ⚪ **`apex merge <taskId> --squash`** - Squash merge task changes
- ⚪ **`apex checkout <taskId>`** - Switch to task's worktree/branch

### Task Lifecycle Improvements

- ⚪ **Soft delete (trash)** - `apex trash <taskId>` moves to trash instead of hard delete
- ⚪ **Trash recovery** - `apex restore <taskId>` to recover deleted tasks
- ⚪ **Trash management** - `apex trash list`, `apex trash empty`
- ⚪ **Task archival** - Archive completed tasks for long-term storage
- ⚪ **Task templates** - Save and reuse task configurations

### Project Customization

- ⚪ **Project Rules (.apexrules)** - Natural language rules file for agent behavior
- ⚪ **Project conventions** - User-defined conventions for code style and patterns

### Safety & Control Enhancements

- ⚪ **Granular Checkpoints** - "Time travel" undo for recent agent actions (filesystem revert)
- ⚪ **Safe Revert** - Explicit rollback of last task actions

---

## v0.5.0 - Tool System & Permissions

*Powerful tool system with fine-grained permission controls*

### Browser Automation (inspired by [Cline](https://github.com/cline/cline) & [OpenHands](https://github.com/OpenHands/OpenHands))

- ⚪ **Headless browser** - Launch sites in headless browser for testing
- ⚪ **Browser actions** - Click, type, scroll, navigate
- ⚪ **Screenshot capture** - Capture screenshots for visual debugging
- ⚪ **Console log capture** - Capture browser console for error detection
- ⚪ **Visual regression testing** - Compare screenshots across runs
- ⚪ **Runtime error detection** - Detect and fix JavaScript runtime errors

### Built-in Tools (Claude Code parity)

- ⚪ **Read** - Read file contents with line numbers
- ⚪ **Write** - Create new files
- ⚪ **Edit** - Surgical edits with old_string/new_string
- ⚪ **MultiEdit** - Multiple edits in single operation
- ⚪ **Bash** - Execute shell commands
- ⚪ **Glob** - Fast file pattern matching
- ⚪ **Grep** - Content search with ripgrep
- ⚪ **WebFetch** - Fetch and analyze web content
- ⚪ **WebSearch** - Search the web for information
- ⚪ **NotebookEdit** - Edit Jupyter notebooks
- ⚪ **TodoWrite** - Manage task lists

### Tool Visualization

- ⚪ **Tool call display** - Show tool name, parameters in real-time
- ⚪ **Tool output formatting** - Syntax highlighted, truncated large outputs
- ⚪ **Tool timing** - Show execution duration
- ⚪ **Tool error display** - Clear error messages with context
- ⚪ **Diff preview** - Show changes before applying
- ⚪ **Undo capability** - Revert tool actions
- ⚪ **Dry-run mode** - Simulate tool actions and show planned changes before execution

### Permission System

- ⚪ **Permission levels** - Allow always, allow once, deny
- ⚪ **Per-tool permissions** - Different settings per tool
- ⚪ **Per-directory permissions** - Restrict access to certain paths
- ⚪ **Dangerous operation warnings** - Extra confirmation for risky actions
- ⚪ **Permission presets** - "Autonomous", "Review all", "Read-only"
- ⚪ **Permission persistence** - Remember choices across sessions
- ⚪ **Policy-as-code rules** - Enforce repo rules (paths, tests, approvals) via config
- ⚪ **Secret-leak guardrails** - Block commits/tool outputs matching secret patterns

### Autonomy Controls

- ⚪ **Autonomy levels** - Full auto, review before commit, review all
- ⚪ **Approval gates** - Configurable checkpoints requiring approval
- ⚪ **Budget limits** - Pause when cost threshold reached
- ⚪ **Token limits** - Pause when token threshold reached
- ⚪ **Time limits** - Maximum task duration
- ⚪ **Change limits** - Maximum files/lines changed without approval

### Code Quality Integration (inspired by [Aider](https://github.com/Aider-AI/aider) & [SWE-agent](https://github.com/SWE-agent/SWE-agent))

- ⚪ **Lint-after-edit** - Automatically lint code after every edit
- ⚪ **Auto-fix linting errors** - Fix syntax errors, missing imports automatically
- ⚪ **Pre-edit validation** - Validate syntax before allowing edits
- ⚪ **Compiler feedback loop** - Monitor compiler errors and fix proactively
- ⚪ **Type checking integration** - Run TypeScript/Flow checks after edits

### Tool Extensions

- ⚪ **Custom tools** - Define project-specific tools
- ⚪ **Tool hooks** - Pre/post execution hooks
- ⚪ **Tool aliases** - Shortcuts for common tool patterns
- ⚪ **MCP server support** - Model Context Protocol integration

### MCP Ecosystem (Accelerated)

- ⚪ **MCP Marketplace** - Discover and install MCP servers
- ⚪ **Easy Install** - One-click installation of capabilities
- ⚪ **Auto-configuration** - Minimal config setup for standard tools

### Test-Driven Development (TDD)

- ⚪ **TDD Mode** - "Write test first, then fix" loop
- ⚪ **Auto-Correction Loop** - Iteratively fix code until tests pass
- ⚪ **Regression Guard** - Ensure existing tests don't break

---

## v0.6.0 - Context & Memory

*Intelligent context management and project understanding*

### Project Context

- ⚪ **Git status awareness** - Branch, uncommitted changes, recent commits
- ⚪ **Project structure analysis** - Understand directory layout
- ⚪ **Dependency detection** - Identify project dependencies
- ⚪ **Framework detection** - Auto-detect frameworks and conventions
- ⚪ **Configuration awareness** - Understand project configs (tsconfig, package.json, etc.)
- ⚪ **Test framework detection** - Know how to run tests
- ⚪ **Workspace health checks** - `apex doctor` validates toolchain and config per package

### Codebase Intelligence (inspired by [Aider](https://github.com/Aider-AI/aider))

- ⚪ **Repository map** - AST-aware map of entire codebase (functions, classes, signatures)
- ⚪ **Codebase indexing** - Build searchable index of code
- ⚪ **Semantic code search** - Find code by meaning, not just text
- ⚪ **Symbol resolution** - Understand function/class definitions and usages
- ⚪ **Import graph** - Understand module dependencies
- ⚪ **Type awareness** - Leverage TypeScript/type information
- ⚪ **Documentation extraction** - Parse JSDoc, docstrings, comments
- ⚪ **Tree-sitter integration** - Language-aware parsing for all major languages

### Multimodal Input (inspired by [Aider](https://github.com/Aider-AI/aider) & [SWE-agent](https://github.com/SWE-agent/SWE-agent))

- ⚪ **Image context** - Add screenshots, diagrams to provide visual context
- ⚪ **Web page context** - Fetch and include web pages as reference
- ⚪ **GitHub issue images** - Process images attached to GitHub issues
- ⚪ **Design mockup input** - Accept Figma/design mockups as input
- ⚪ **Error screenshot analysis** - Analyze screenshots of errors/bugs

### Conversation Memory

- ⚪ **Session context** - Remember everything in current session
- ⚪ **Run replay bundles** - Capture inputs, tool calls, and diffs for reproducible reruns
- ⚪ **Long-term memory** - Persistent project and user memory across sessions
- ⚪ **RAG over repo/docs/issues** - Retrieval-augmented context for answers and plans
- ⚪ **Context summarization** - Compress old context intelligently
- ⚪ **Memory persistence** - Remember across sessions
- ⚪ **Explicit memory** - User can tell APEX to remember things
- ⚪ **Memory search** - Search through remembered information
- ⚪ **Memory management UI** - View, edit, delete memories

### Cross-Task Context

- ⚪ **Task history** - Learn from previous tasks
- ⚪ **Pattern learning** - Recognize repeated patterns
- ⚪ **Preference learning** - Remember user preferences
- ⚪ **Style learning** - Adapt to coding style over time
- ⚪ **Project conventions** - Learn and follow project conventions

### Smart Context Management

- ⚪ **Relevant file detection** - Auto-include relevant files
- ⚪ **Context prioritization** - Most relevant context first
- ⚪ **Token-aware truncation** - Smart truncation when context is full
- ⚪ **Context refresh** - Detect when files have changed externally
- ⚪ **Context visualization** - Show what's in current context

---

## v0.7.0 - Web Dashboard & Integrations

*Visual interface for monitoring and management with chat platform integrations*

### Dashboard Core (`@apexcli/web-ui`)
- 🟢 React + Next.js dashboard foundation
- 🟢 Real-time task monitoring via WebSocket
- 🟢 Live log streaming
- 🟢 Token usage visualization
- 🟢 Cost analytics display
- 🟢 Task history browser
- 🟢 Agent list view
- 🟢 Configuration viewer
- 🟢 Dark/light theme
- ⚪ Drag-and-drop workflow editor
- ⚪ Visual agent configuration editor
- ⚪ Rich diff viewer with syntax highlighting
- ⚪ Interactive approval gate interface

### Dashboard Features

- ⚪ Project overview with health metrics
- ⚪ Active tasks panel with real-time updates
- ⚪ Recent activity feed
- ⚪ Performance metrics and charts
- ⚪ Budget utilization gauge
- ⚪ Agent utilization statistics
- ⚪ Task dependency visualization
- ⚪ Subtask hierarchy view

### Task Management UI

- ⚪ Create tasks from web interface
- ⚪ Task templates and quick actions
- ⚪ Bulk task operations
- ⚪ Task filtering and search
- ⚪ Export task reports

### Slack Integration (Full Task Management)

- ⚪ **Slack App** - OAuth-based Slack app installation
- ⚪ **Task submission** - `/apex run "task description"` slash command
- ⚪ **Thought capture** - `/apex think "idea"` for quick ideas
- ⚪ **Status checks** - `/apex status` to view active tasks
- ⚪ **Task reports** - `/apex report [taskId]` for detailed reports
- ⚪ **Cancellation** - `/apex cancel <taskId>` to cancel tasks
- ⚪ **Notifications** - Task completion/failure notifications to channels
- ⚪ **Thread updates** - Real-time task progress in Slack threads

### Other Chat Integrations

- ⚪ Discord bot with similar commands
- ⚪ Microsoft Teams integration
- ⚪ Webhook support for custom integrations

### Notifications

- ⚪ In-app notification center
- ⚪ Browser push notifications
- ⚪ Email notifications (task completion, failures, daily digest)
- ⚪ Configurable notification preferences

### Reporting & Analytics

- ⚪ **Daily reports** - Markdown summary of daily activity
- ⚪ **Weekly digest** - Weekly task statistics and metrics
- ⚪ **JSONL export** - Performance metrics in JSONL format
- ⚪ **Task statistics** - Success/failure rates, average duration
- ⚪ **Cost reports** - Usage breakdown by workflow, agent, time period
- ⚪ **Custom reports** - Build reports with filters and date ranges

---

## v0.8.0 - IDE Integration

*Deep integration with development environments*

### VS Code Extension (`@apexcli/vscode`)
- ⚪ APEX sidebar panel
- ⚪ Task creation from editor context
- ⚪ Inline task status indicators
- ⚪ Code diff previews in editor
- ⚪ Approval actions via editor UI
- ⚪ Integrated log panel
- ⚪ Configuration IntelliSense
- ⚪ Agent/workflow file snippets
- ⚪ Context menu actions (select code → create task)
- ⚪ Status bar integration
- ⚪ CodeLens for APEX suggestions
- ⚪ Inline chat mode

### JetBrains Plugin

- 💡 IntelliJ IDEA support
- 💡 WebStorm support
- 💡 PyCharm support

### Other IDEs

- 💡 Neovim plugin (Lua)
- 💡 Emacs package (elisp)
- 💡 Sublime Text plugin

---

## v0.9.0 - Advanced Workflows

*Complex workflow capabilities and automation*

### Built-in Workflow Templates (inspired by [Rover](https://github.com/endorhq/rover))

- ⚪ **`swe` (Software Engineering)** - Full development workflow (plan → architect → develop → review → test)
- ⚪ **`tech-writer`** - Documentation generation workflow
- ⚪ **`refactor`** - Code refactoring with safety checks
- ⚪ **`test-suite`** - Test generation and coverage improvement
- ⚪ **`bugfix`** - Focused bug investigation and fixing
- ⚪ **`security-audit`** - Security review workflow
- ⚪ **`performance`** - Performance optimization workflow
- ⚪ **`apex workflows inspect <name>`** - View detailed workflow configuration
- ⚪ **Workflow step validation** - Validate workflow definitions before execution

### Workflow Engine

- ⚪ Conditional stage execution (if/else)
- ⚪ Parallel stage execution
- ⚪ Dynamic stage generation
- ⚪ Loop/iteration support
- ⚪ Error handling stages (catch/finally)
- ⚪ Rollback stages
- ⚪ Sub-workflow composition
- ⚪ Workflow templates library

### Triggers & Automation

- ⚪ GitHub webhook triggers
- ⚪ GitLab webhook triggers
- ⚪ Issue-to-task automation
- ⚪ PR comment commands (`/apex fix`, `/apex test`)
- ⚪ Scheduled tasks (cron-style)
- ⚪ File change watchers
- ⚪ CI/CD pipeline integration

### GitHub Issue Resolver (inspired by [OpenHands](https://github.com/OpenHands/OpenHands))

- ⚪ **Auto-fix labeled issues** - Automatically fix issues tagged with `apex-fix` label
- ⚪ **GitHub Action integration** - Run as GitHub Action in CI/CD
- ⚪ **Issue analysis** - Analyze issue description and reproduce the problem
- ⚪ **Auto PR creation** - Create pull request with fix
- ⚪ **PR review response** - Respond to PR review comments automatically
- ⚪ **Issue triage** - Auto-label and categorize new issues
- ⚪ **Duplicate detection** - Identify and link duplicate issues

### GitHub Integration

- ⚪ GitHub App for seamless auth
- ⚪ Issue analysis and task creation
- ⚪ PR review comments from agents
- ⚪ Check runs integration
- ⚪ Actions workflow integration
- ⚪ Project board updates

### GitLab Integration

- ⚪ GitLab OAuth
- ⚪ Merge request integration
- ⚪ Issue tracking
- ⚪ CI pipeline integration

---

## v0.10.0 - Intelligence & Learning

*Smarter agents and continuous improvement*

### Confidence & Clarification (inspired by [Devin](https://devin.ai/))

- ⚪ **Confidence scoring** - Self-assess confidence before executing tasks
- ⚪ **Clarification requests** - Ask for clarification when confidence is low
- ⚪ **Uncertainty handling** - Different strategies for high/low confidence tasks
- ⚪ **Human escalation** - Escalate to human when stuck or uncertain
- ⚪ **Assumption declaration** - Explicitly state assumptions before proceeding

### Auto-Documentation (inspired by [Devin](https://devin.ai/))

- ⚪ **Devin-style Wiki** - Auto-generate project documentation
- ⚪ **Code documentation** - Generate JSDoc/docstrings for code
- ⚪ **Architecture docs** - Generate architecture diagrams and descriptions
- ⚪ **API documentation** - Auto-generate API docs from code
- ⚪ **Change documentation** - Document what changed and why after each task
- ⚪ **Interactive search** - Search & answer engine for codebase questions

### Agent Intelligence

- ⚪ Agent performance analytics
- ⚪ Automatic prompt optimization
- ⚪ A/B testing for agent prompts
- ⚪ Success/failure pattern analysis
- ⚪ Cost optimization suggestions
- ⚪ Model selection optimization
- ⚪ **Adaptive Model Routing** - Smartly route simple tasks to faster/cheaper models

### Quality Improvements

- ⚪ Code quality scoring
- ⚪ Test coverage tracking
- ⚪ Security vulnerability detection
- ⚪ Performance regression detection
- ⚪ Dependency update suggestions
- ⚪ Technical debt identification

### Self-Improvement

- ⚪ Learn from rejected PRs
- ⚪ Incorporate review feedback
- ⚪ Adapt to coding style
- ⚪ Remember project-specific patterns
- ⚪ Improve from user corrections

---

## v0.11.0 - Enterprise Features

*Features for team and enterprise adoption*

### Team Collaboration

- ⚪ Multi-user support
- ⚪ Role-based access control (RBAC)
- ⚪ Team workspaces
- ⚪ Shared agent configurations
- ⚪ Shared workflow templates
- ⚪ Task assignment
- ⚪ Review workflows

### Authentication & Security

- ⚪ SSO/SAML integration
- ⚪ OAuth providers (Google, GitHub, etc.)
- ⚪ API key management
- ⚪ Audit logging
- ⚪ Data encryption at rest
- ⚪ Secret management integration (Vault, AWS Secrets)
- ⚪ SOC 2 compliance features

### Administration

- ⚪ Admin dashboard
- ⚪ Usage quotas per user/team
- ⚪ Billing integration
- ⚪ License management
- ⚪ Organization settings
- ⚪ Policy enforcement

### Deployment Options

- ⚪ Docker Compose
- ⚪ Kubernetes Helm chart
- ⚪ AWS deployment (ECS/EKS)
- ⚪ GCP deployment (Cloud Run/GKE)
- ⚪ Azure deployment (AKS)
- ⚪ On-premises installation guide
- ⚪ Air-gapped deployment support

---

## v0.12.0 - Domain-Specific Agent Packs

*Expand APEX beyond software development to other creative and professional domains*

### Educational Content Agents (inspired by [ai-infra-curriculum](https://github.com/ai-infra-curriculum))

- ⚪ **Curriculum Designer** - Design course structure, learning objectives, prerequisites
- ⚪ **Lesson Planner** - Create detailed lesson plans with activities and materials
- ⚪ **Content Writer** - Generate educational content, explanations, examples
- ⚪ **Quiz Generator** - Create assessments, quizzes, and practice problems
- ⚪ **Lab Designer** - Design hands-on exercises and lab environments
- ⚪ **Slide Deck Generator** - Create presentation slides from content
- ⚪ **Study Guide Creator** - Generate summaries, flashcards, review materials
- ⚪ **Rubric Designer** - Create grading rubrics and evaluation criteria

### Game Development Agents

- ⚪ **Narrative Designer** - Create storylines, dialogue, lore, and world-building
- ⚪ **Level Designer** - Design game levels, puzzles, and progression
- ⚪ **Character Creator** - Design characters, backstories, and abilities
- ⚪ **Dialogue Writer** - Generate NPC dialogue, branching conversations
- ⚪ **Item/Loot Designer** - Create items, weapons, rewards, and balance
- ⚪ **Quest Designer** - Design quests, objectives, and reward structures
- ⚪ **Game Balance Analyst** - Analyze and suggest balance adjustments
- ⚪ **Asset Descriptor** - Generate descriptions for AI image/3D generation

### Personal Assistant Agents

- ⚪ **Task Manager** - Break down goals into actionable tasks
- ⚪ **Research Assistant** - Research topics and synthesize information
- ⚪ **Email Drafter** - Draft emails, responses, and communications
- ⚪ **Meeting Summarizer** - Summarize meetings and extract action items
- ⚪ **Schedule Optimizer** - Suggest optimal scheduling and time blocking
- ⚪ **Decision Helper** - Analyze options and provide decision frameworks
- ⚪ **Learning Coach** - Create personalized learning plans
- ⚪ **Habit Tracker** - Design and track habit formation strategies

### Creative Writing Agents

- ⚪ **Story Architect** - Design plot structure, story arcs, and pacing
- ⚪ **Character Developer** - Create detailed character profiles, motivations, and arcs
- ⚪ **World Builder** - Design settings, cultures, histories, and magic systems
- ⚪ **Dialogue Coach** - Write and improve character dialogue and voice
- ⚪ **Scene Writer** - Draft individual scenes with description and action
- ⚪ **Continuity Editor** - Track and maintain story consistency
- ⚪ **Beta Reader** - Provide feedback on drafts from reader perspective
- ⚪ **Genre Specialist** - Adapt writing to specific genre conventions (fantasy, sci-fi, romance, thriller)
- ⚪ **Outline Generator** - Create detailed story outlines and chapter breakdowns
- ⚪ **Writing Prompt Generator** - Generate creative prompts to overcome writer's block

### Content Creation Agents

- ⚪ **Blog Writer** - Generate blog posts, articles, and long-form content
- ⚪ **Social Media Manager** - Create posts, threads, and content calendars
- ⚪ **Copywriter** - Write marketing copy, ads, and landing pages
- ⚪ **Editor** - Review and improve written content
- ⚪ **SEO Optimizer** - Optimize content for search engines
- ⚪ **Newsletter Creator** - Design and write email newsletters
- ⚪ **Script Writer** - Write video scripts, podcasts, and presentations
- ⚪ **Content Repurposer** - Transform content across formats

### Data & Research Agents

- ⚪ **Data Analyst** - Analyze datasets and generate insights
- ⚪ **Report Generator** - Create reports from data and findings
- ⚪ **Literature Reviewer** - Synthesize research papers and sources
- ⚪ **Fact Checker** - Verify claims and find supporting evidence
- ⚪ **Trend Analyzer** - Identify patterns and trends in data
- ⚪ **Survey Designer** - Create surveys and analyze responses
- ⚪ **Competitive Analyst** - Research competitors and market landscape

### Business & Strategy Agents

- ⚪ **Business Plan Writer** - Generate business plans and pitch decks
- ⚪ **Market Researcher** - Research markets, audiences, and opportunities
- ⚪ **Financial Modeler** - Create financial projections and models
- ⚪ **Product Manager** - Define requirements, user stories, and roadmaps
- ⚪ **OKR Designer** - Create objectives and key results frameworks
- ⚪ **Process Documenter** - Document workflows and SOPs

### Domain Pack Infrastructure

- ⚪ **Agent pack format** - Standardized format for distributing agent packs
- ⚪ **Pack installation** - `apex packs install <pack-name>`
- ⚪ **Pack registry** - Community registry for sharing agent packs
- ⚪ **Pack versioning** - Semantic versioning for agent packs
- ⚪ **Pack dependencies** - Packs can depend on other packs
- ⚪ **Custom workflows per domain** - Domain-specific workflow templates

---

## v0.13.0 - Ecosystem & Extensibility

*Plugin system and community features*

### Plugin System

- ⚪ Plugin API specification
- ⚪ Plugin discovery and installation
- ⚪ Custom agent plugins
- ⚪ Custom workflow actions
- ⚪ Custom tool integrations
- ⚪ Hook system for extensions

### MCP Marketplace (Moved to v0.5.0)

- ⚪ *Moved to v0.5.0 for earlier adoption*

### Agent Marketplace

- ⚪ Community agent repository
- ⚪ Agent publishing workflow
- ⚪ Agent ratings and reviews
- ⚪ Verified agents program
- ⚪ Agent versioning

### Workflow Marketplace

- ⚪ Community workflow templates
- ⚪ Workflow sharing
- ⚪ Import/export workflows
- ⚪ Workflow versioning

### Integrations

- ⚪ Jira integration
- ⚪ Linear integration
- ⚪ Asana integration
- ⚪ Notion integration
- ⚪ Confluence integration
- ⚪ Datadog/monitoring integration
- ⚪ PagerDuty integration

---

## v0.14.0 - Scale & Performance

*Optimization for large-scale usage*

### Scalability

- ⚪ Redis-backed task queue
- ⚪ PostgreSQL support
- ⚪ Horizontal scaling
- ⚪ Load balancing
- ⚪ Rate limiting
- ⚪ Connection pooling

### Performance

- ⚪ Response streaming optimization
- ⚪ Caching layer (Redis)
- ⚪ CDN for static assets
- ⚪ Database query optimization
- ⚪ Memory usage optimization
- ⚪ Cold start reduction

### Multi-Repo Support

- ⚪ Monorepo awareness
- ⚪ Cross-repo tasks
- ⚪ Shared configuration
- ⚪ Dependency-aware changes
- ⚪ Coordinated releases

### Observability (inspired by [claude-code-otel](https://github.com/ColeMurray/claude-code-otel))

**OpenTelemetry Integration**
- ⚪ `@apexcli/telemetry` package - OTEL export for metrics, traces, and logs
- ⚪ OTLP exporter - gRPC (4317) and HTTP (4318) endpoints
- ⚪ Prometheus metrics endpoint - `/metrics` in @apexcli/api
- ⚪ Loki log aggregation support
- ⚪ Distributed tracing across agents and subtasks

**Core Metrics**

- ⚪ `apex.session.count` - CLI sessions initiated
- ⚪ `apex.task.count` - Tasks by status (pending/running/completed/failed)
- ⚪ `apex.subtask.count` - Subtask execution counts
- ⚪ `apex.lines_of_code.count` - Modified code lines per task
- ⚪ `apex.commit.count` - Generated commits
- ⚪ `apex.pull_request.count` - Created pull requests

**Cost & Token Metrics**

- ⚪ `apex.cost.usage` - Cost by model, agent, and workflow
- ⚪ `apex.token.usage` - Token breakdown (input/output/cache)
- ⚪ `apex.api_request.duration` - API latency histograms
- ⚪ `apex.api_request.count` - Request counts by model/status
- ⚪ `apex.api_error.count` - API failures by error type

**Agent & Tool Metrics**

- ⚪ `apex.agent.duration` - Time spent per agent
- ⚪ `apex.agent.handoff.count` - Agent transition counts
- ⚪ `apex.tool.duration` - Tool execution timing
- ⚪ `apex.tool.success_rate` - Tool success/failure rates
- ⚪ `apex.workflow.stage.duration` - Time per workflow stage

**Telemetry Configuration**

```yaml
# .apex/config.yaml
telemetry:
  enabled: true
  exporters: [otlp, prometheus]
  endpoint: "http://localhost:4317"
  protocol: grpc  # or http
  exportInterval: 60000  # 1 minute for production
  privacy:
    includePrompts: false
    includeSessionId: true
    includeAccountId: false
```

**Grafana Dashboard Templates**

- ⚪ Overview dashboard - Active tasks, costs, tokens, agents
- ⚪ Cost analysis dashboard - Spending by model/workflow/time
- ⚪ Performance dashboard - Latency, success rates, errors
- ⚪ Agent dashboard - Per-agent metrics and comparisons
- ⚪ Tool dashboard - Tool usage patterns and performance

**Docker Compose Stack**

- ⚪ `docker-compose.observability.yml` - Full OTEL stack
- ⚪ Pre-configured Prometheus scrape configs
- ⚪ Pre-configured Grafana dashboards
- ⚪ Loki for structured log aggregation

**Alerting**

- ⚪ Cost threshold alerts
- ⚪ Error rate alerts
- ⚪ Task failure alerts
- ⚪ API latency alerts
- ⚪ Budget exhaustion warnings

---

## v1.0.0 - General Availability

*Stable release with full feature set*

### Stability

- ⚪ API stability guarantee
- ⚪ Semantic versioning
- ⚪ LTS support policy
- ⚪ Migration guides
- ⚪ Deprecation policy

### Documentation

- ⚪ Comprehensive docs site
- ⚪ API playground
- ⚪ Interactive tutorials
- ⚪ Case studies
- ⚪ Architecture deep-dives

### Community

- ⚪ Contributor program
- ⚪ Bug bounty program
- ⚪ Community forums
- ⚪ Regular release cadence
- ⚪ Public roadmap voting

---

## Future Considerations (v1.x+)

*Long-term vision and experimental features*

### Multi-LLM Backend Support (inspired by [Rover](https://github.com/endorhq/rover))

- 💡 **Pluggable LLM backends** - Support multiple AI providers
- 💡 **Claude Code backend** - Current default (via Claude Agent SDK)
- 💡 **OpenAI Codex backend** - OpenAI's coding model
- 💡 **Gemini CLI backend** - Google's Gemini models
- 💡 **Qwen Code backend** - Alibaba's coding model
- 💡 **Cursor backend** - Cursor's AI capabilities
- 💡 **Local models** - Ollama, llama.cpp integration
- 💡 **Per-task model selection** - Choose model per task
- 💡 **Per-agent model selection** - Different models for different agents
- 💡 **Cost comparison** - Compare costs across providers
- 💡 **Fallback chains** - Try cheaper model first, escalate if needed

### Advanced AI Features

- 💡 Multi-model orchestration (Claude + GPT + Gemini + local models)
- 💡 Fine-tuned models for specific tasks
- 💡 RAG integration for documentation
- 💡 Code generation benchmarking
- 💡 Automated code review learning

### Developer Experience

- 💡 Mobile app for monitoring
- 💡 **Voice coding** (inspired by [Aider](https://github.com/Aider-AI/aider)) - Speak to APEX about code changes
- 💡 Natural language task refinement
- 💡 Pair programming mode
- 💡 Live collaboration features
- 💡 **Debugger integration** (inspired by [SWE-agent](https://github.com/SWE-agent/SWE-agent)) - Attach to debugger for complex issues

### Ticket System Integrations (inspired by [Devin](https://devin.ai/))

- 💡 **Linear integration** - Assign tickets directly to APEX
- 💡 **Jira integration** - Work on Jira tickets automatically
- 💡 **Shortcut integration** - Clubhouse/Shortcut ticket support
- 💡 **ClickUp integration** - ClickUp task automation
- 💡 **Ticket-to-PR pipeline** - End-to-end ticket → code → PR

### Advanced Automation

- 💡 Full CI/CD pipeline generation
- 💡 Infrastructure as Code generation
- 💡 Database migration generation
- 💡 API documentation generation
- 💡 Test data generation

### Security & Compliance

- 💡 HIPAA compliance features
- 💡 GDPR compliance features
- 💡 FedRAMP certification path
- 💡 Security scanning integration
- 💡 Penetration testing automation

### Analytics & Insights

- 💡 Developer productivity metrics
- 💡 Code quality trends
- 💡 Cost optimization recommendations
- 💡 Team performance insights
- 💡 Project health scoring

### Experimental

- 💡 Browser automation agent
- 💡 Design-to-code agent (Figma → code)
- 💡 Natural language to SQL agent
- 💡 Legacy code modernization
- 💡 Automated refactoring suggestions

---

## CLI Feature Comparison

| Feature | Claude Code | Codex CLI | Gemini CLI | Aider | Cline | OpenHands | Rover | APEX |
|---------|-------------|-----------|------------|-------|-------|-----------|-------|------|
| Streaming responses | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | 🟢 |
| Syntax highlighting | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | 🟢 |
| Markdown rendering | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | 🟢 |
| Diff views | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 |
| Tab completion | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | 🟢 |
| History navigation | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | 🟢 |
| Tool approval workflow | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ⚪ |
| Cost/token tracking | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | 🟢 |
| Multi-turn conversations | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | 🟢 |
| Session persistence | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | 🟢 |
| Git awareness | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 |
| **Multi-agent orchestration** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟢 |
| **Workflow system** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | 🟢 |
| **Subtask decomposition** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟢 |
| **Web dashboard** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | 🟢 |
| **Browser automation** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ⚪ |
| **Voice coding** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | 💡 |
| **Multimodal input (images)** | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ⚪ |
| **Repository map (AST)** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ⚪ |
| **Lint-after-edit** | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ⚪ |
| **GitHub issue resolver** | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ⚪ |
| **Confidence scoring** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚪ |
| **Auto-documentation** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚪ |
| **MCP marketplace** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ⚪ |
| **24/7 daemon mode** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚪ |
| **Auto-resume on session limit** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚪ |
| **Container sandbox isolation** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ⚪ |
| **Git worktree isolation** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ⚪ |
| **Multi-LLM backends** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | 💡 |
| **VSCode extension** | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ⚪ |

> **Legend**: 🟢 Complete | 🟡 Partial | ⚪ Planned | 💡 Considering | ✅ Has feature | ❌ No feature

---

## How to Contribute

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Priority Areas

1. **CLI UX** - Rich terminal UI, streaming, completions
2. **Tool System** - Built-in tools and permissions
3. **Testing** - Unit and integration tests
4. **Documentation** - Guides and examples
5. **Agents** - New specialized agents
6. **Workflows** - Workflow templates

### Feature Requests

Have an idea? Open a [Discussion](https://github.com/JoshuaAFerguson/apex/discussions) to propose new features.

---

## Release Schedule

| Version | Target Date | Focus |
|---------|-------------|-------|
| v0.1.0 | Q1 2025 | Foundation ✅ |
| v0.2.0 | Q1 2025 | Production Ready ✅ |
| v0.3.0 | Q2 2025 | Claude Code-like CLI Experience |
| v0.4.0 | Q2 2025 | Sleepless Mode & Autonomy |
| v0.5.0 | Q2 2025 | Tool System & Permissions |
| v0.6.0 | Q3 2025 | Context & Memory |
| v0.7.0 | Q3 2025 | Web Dashboard & Integrations |
| v0.8.0 | Q3 2025 | IDE Integration |
| v0.9.0 | Q4 2025 | Advanced Workflows |
| v0.10.0 | Q4 2025 | Intelligence & Learning |
| v0.11.0 | Q1 2026 | Enterprise Features |
| v0.12.0 | Q1 2026 | Domain-Specific Agent Packs |
| v0.13.0 | Q2 2026 | Ecosystem & Extensibility |
| v0.14.0 | Q2 2026 | Scale & Performance |
| v1.0.0 | Q3 2026 | General Availability |

*Dates are tentative and subject to change based on community feedback and priorities.*

---

<p align="center">
  <em>Building the future of AI-assisted development with autonomous multi-agent orchestration.</em>
</p>
