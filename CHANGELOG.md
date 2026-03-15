# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.0] - 2026-03-15

### Added

- **Context & Memory:** Intelligent context management and project understanding
  - Git status awareness with branch, uncommitted changes, and recent commit detection
  - Project structure analysis, dependency detection, and framework auto-detection
  - Configuration awareness for tsconfig, package.json, and project-specific configs
  - Test framework detection for automated test execution
  - Workspace health checks via `apex doctor` command
  - Update available checker with non-blocking npm registry lookup on CLI startup
- **Brownfield Codebase Analysis:** New `apex map-codebase` command for comprehensive codebase documentation
  - Parallel agent execution across 5 analysis domains: Stack, Architecture, Conventions, Technical Debt, and Documentation
  - Multiple output formats: Markdown, JSON, YAML (default: Markdown)
  - Configurable concurrency with `--parallel` option (1-10 parallel analyzers, default: 4)
  - Include/exclude glob patterns (`--include`, `--exclude`) for targeted analysis
  - Quick mode (`--quick`) for faster, less deep analysis on large codebases
  - Verbose mode (`--verbose`) for detailed real-time progress reporting
  - Command aliases: `map`, `analyze` for convenience
  - REPL access via `/map-codebase` command with full option support
  - Output written to `.apex/codebase-analysis/` by default
  - Language detection for 25+ programming languages
- **Codebase Intelligence:** AST-aware repository analysis powered by Tree-sitter
  - Repository map with function, class, and signature extraction
  - Codebase indexing with semantic code search
  - Symbol resolution for definitions and usages
  - Import graph for understanding module dependencies
  - Type awareness leveraging TypeScript type information
  - Documentation extraction from JSDoc, docstrings, and comments
- **Multimodal Input:** Visual context support for AI agents
  - Image context (screenshots, diagrams) for visual task descriptions
  - Web page context fetching and inclusion
  - GitHub issue image processing
  - Design mockup input (Figma/design files)
  - Error screenshot analysis
- **Conversation Memory:** Persistent memory across sessions
  - Session context with full conversation history
  - Run replay bundles for reproducible reruns
  - Long-term memory with RAG over repo, docs, and issues
  - Context summarization for intelligent compression
  - Explicit memory management (remember, search, edit, delete)
  - Living memory files for multi-session continuity
  - Cross-session agent insights and pattern retention
- **Cross-Task Context:** Learning and adaptation
  - Task history awareness and pattern recognition
  - User preference and coding style learning
  - Project convention detection and enforcement
- **Smart Context Management:** Token-efficient context handling
  - Relevant file auto-detection and prioritization
  - Token-aware truncation with external change detection
  - Context visualization showing current context window contents
- **AI Platform Agnostic Orchestration:** Multi-provider support
  - Modular driver architecture for switching AI backends
  - Claude Code MAX, OpenAI Codex, and Gemini Code Assist support
  - Generic LLM support via Vercel AI SDK
  - Standalone MCP integration independent of AI provider

### Enhanced

- **Tool Visualization:** Fixed WebSocket serialization for tool events
  - Safe JSON serialization with circular reference handling
  - Payload truncation for large outputs (100K+ items)
  - Correct tool timing event streaming
  - MCP error event handling and broadcasting
- **MCP Ecosystem:** Fixed marketplace and installation flow
  - Error handling in MCP marketplace server discovery
  - End-to-end MCP server installation and auto-configuration
- **Daemon Process Management:** Improved stability and resource control
  - Vitest worker limits to prevent CPU exhaustion
  - Process tree cleanup for orphaned child processes
  - Auto-triage fixes for stuck/phantom task failures
  - `projectPath` validation to prevent database misrouting

### Fixed

- Fixed auto-triage incorrectly marking parent tasks as failed when subtasks were still running
- Fixed process cleanup gaps where auto-triage updated task status without killing Claude subprocesses
- Fixed CPU exhaustion from uncapped vitest workers (default 1 per CPU core, now capped at cores/4)
- Excluded Playwright browser tests from default `npm test` to prevent Chrome instance proliferation
- Fixed `TaskStore` accepting undefined `projectPath`, creating errant `undefined/.apex/` database
- Fixed API health endpoint reporting version `0.1.0` instead of `0.6.0`

## [0.5.0] - 2026-02-18

### Added

- **Browser Automation:** Comprehensive headless browser testing with Playwright integration
  - Navigate, click, type, scroll, hover operations
  - Screenshot capture for visual debugging and regression testing
  - Console log capture and runtime error detection
  - Visual regression testing with screenshot comparison
- **Permission System:** Fine-grained permission controls for all tool operations
  - Three permission levels: allow-always, allow-once, deny
  - Per-tool and per-directory permission configuration
  - Permission presets: autonomous, review-all, read-only
  - Dangerous operation warnings and elevated permissions
  - Permission persistence across sessions
- **Built-in Tools:** Complete Claude Code tool parity
  - Read, Write, Edit, MultiEdit, Bash, Glob, Grep tools
  - WebFetch, WebSearch, NotebookEdit, TodoWrite tools
  - Tool visualization with syntax highlighting and timing
  - Undo capability and dry-run mode for safe operations
- **Autonomy Controls:** Intelligent resource management and safety controls
  - Budget limits with cost tracking and warnings
  - Token limits for input/output token management
  - Time limits and idle timeout detection
  - Change limits (files/lines modified) with approval gates
  - Configurable approval gates for sensitive operations
- **Code Quality Integration:** Automated code quality enforcement
  - Lint-after-edit with automatic linting after file changes
  - Auto-fix capabilities for syntax errors and imports
  - Pre-edit validation to prevent syntax errors
  - Compiler feedback loop with TypeScript integration
  - Test-Driven Development (TDD) mode support
- **Tool Extensions:** Extensible tool system architecture
  - Custom tool development with TypeScript/JavaScript
  - Tool hooks for pre/post execution processing
  - Tool aliases for common operation patterns
  - Model Context Protocol (MCP) server integration
- **MCP Ecosystem:** Marketplace and easy installation
  - MCP server discovery and installation
  - Auto-configuration for standard tool patterns
  - Community tool sharing and distribution
- **Policy-as-Code:** Repository rules and governance
  - File path allowlist/blocklist configuration
  - Approval rules for sensitive operations
  - Secret leak detection and prevention
  - Configurable enforcement modes (enforce/audit/disabled)
- **Integration Testing:** Comprehensive test suite for v0.5.0 features
  - Browser + Permission system integration tests
  - Multi-tool workflow with policy enforcement tests
  - Permission preset + autonomy controls integration tests
  - MCP + Permission system integration tests
  - Code quality + tool actions + undo integration tests
  - End-to-end workflow integration tests

### Enhanced

- **API Reference:** Updated with v0.5.0 feature documentation
- **Documentation:** Complete guides for all new v0.5.0 capabilities
  - Browser automation guide with usage examples
  - Permission system deep dive and configuration
  - Autonomy controls setup and best practices
  - Tool extensions development guide
  - Code quality integration patterns

### Fixed

- Resolved cyclic dependency between `@apex/test-utils` and production packages that blocked Turbo builds
- Fixed duplicate export declarations in API middleware (`auth.ts`)
- Fixed `workspace:*` protocol references incompatible with npm workspaces
- Aligned vitest ecosystem package versions (`vitest`, `@vitest/browser`, `@vitest/coverage-v8`) to prevent peer dependency conflicts
- Fixed TypeScript type mismatches in CLI permission event handlers
- Fixed `no-case-declarations` lint errors in browser package test utilities
- Fixed `no-this-alias` lint error in orchestrator repair loop host
- Fixed boolean coercion issue in web-ui MultiSelect component (`maxSelections && expr` returning `0`)
- Reverted accidental pnpm migration back to npm workspaces

### Documentation

- Added comprehensive documentation for all v0.5.0 features
- Updated ROADMAP.md to mark v0.5.0 features as complete
- Enhanced API reference with tool system capabilities

## [0.4.0] - 2025-12-26

### Added

- **Sleepless Daemon Mode:** Introduced a persistent daemon process (`apex daemon`) to manage background tasks, ensuring continuous operation and resilience.
- **Service Management:** Added `apex install-service` and `uninstall-service` commands to manage the daemon as a system service that starts on boot.
- **Intelligent Task Scheduling:** Implemented a scheduler with capacity monitoring to manage token usage, automatically pausing and resuming tasks based on available capacity.
- **Advanced Containerization:**
    - Integrated Docker for full workspace isolation.
    - Added automatic dependency detection and installation for multiple languages within containers.
    - Implemented container lifecycle management, resource limit configuration, and log streaming.
    - Added `apex shell <taskId>` for direct access to a task's containerized environment.
- **Git Workflow Automation:**
    - New commands (`apex push`, `apex merge`, `apex diff`) to manage task-specific branches.
    - Automated worktree management for cleaner branch handling and cleanup.
- **Idle Task Generation:** A new `apex idle` command suite to proactively find, suggest, and automate development tasks based on analyzing the codebase for:
    - Documentation gaps and inconsistencies.
    - Test coverage holes and anti-patterns.
    - Code quality issues, security vulnerabilities, and outdated dependencies.
- **Enhanced API:** Added REST API endpoints for managing task templates, archives, and trash.
- **Homebrew Distribution:** Prepared the repository for Homebrew packaging to simplify installation.
- **Testing:** Massively expanded E2E and integration test coverage for all new features.
- Standard repository files (CODE_OF_CONDUCT.md, SECURITY.md, CHANGELOG.md, AUTHORS, .editorconfig, SUPPORT.md, CITATION.cff).

### Fixed
- Resolved various test failures and added null safety checks for improved stability.

## [0.3.0] - 2024-01-01

### Added

- Initial project structure for APEX.
- Workspace configuration for packages.
- Basic CLI implementation.
