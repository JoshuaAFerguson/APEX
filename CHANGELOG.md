# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
