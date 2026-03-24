# APEX Documentation Index

Master navigation index for all APEX documentation files.

---

## Getting Started

| Document | Description |
|----------|-------------|
| [Getting Started](getting-started.md) | Installation, first steps, and project initialization |
| [CLI Guide](cli-guide.md) | Complete CLI command reference and interactive mode guide |
| [Configuration](configuration.md) | Project configuration options (`.apex/config.yaml`) |
| [Windows Installation](windows-installation.md) | Windows-specific setup instructions |
| [Publishing](PUBLISHING.md) | Package publishing guide for npm and Homebrew |

## Guides

| Document | Description |
|----------|-------------|
| [Agents](agents.md) | Agent authoring guide and customization |
| [Workflows](workflows.md) | Workflow authoring and multi-stage pipelines |
| [Autonomy Controls](autonomy-controls.md) | Budget, token, time, and change limits with approval gates |
| [Browser Automation](browser-automation.md) | Headless browser testing with Playwright integration |
| [Permission System](permission-system.md) | Fine-grained per-tool, per-directory permission controls |
| [Tool System](tool-system.md) | Built-in tools, extensions, and MCP integration |
| [Tool Extensions](tool-extensions.md) | Custom tool development and plugin architecture |
| [Code Quality](code-quality.md) | Lint-after-edit, type checking, and TDD mode |
| [TDD Workflows](tdd-workflows.md) | Test-Driven Development with AI assistance |
| [Service Management](service-management.md) | Daemon mode and system service setup |
| [Container Isolation](container-isolation.md) | Docker-based workspace isolation |
| [Container Configuration](container-configuration.md) | Container resource limits and environment setup |
| [Container Troubleshooting](container-troubleshooting.md) | Diagnosing container issues |
| [Workspace Isolation](workspace-isolation.md) | Git worktree isolation per task |
| [Slack Integration](slack-integration.md) | Socket Mode Slack app setup |
| [Time-Based Usage Management](time-based-usage-management.md) | Usage tracking and time-based budget controls |
| [Best Practices](best-practices.md) | Recommended patterns for APEX usage |
| [Troubleshooting](troubleshooting.md) | Common issues and solutions |
| [v0.5.0 Feature Guide](v050-features.md) | Tools, permissions, and browser automation features |
| [v0.1.0 CLI Commands Status](v010-cli-commands-status.md) | Historical: original CLI command implementation status |

### User Guide

| Document | Description |
|----------|-------------|
| [Display Modes](user-guide/display-modes.md) | Terminal display mode configuration |
| [Output & Feedback](user-guide/output-feedback.md) | Output formatting and feedback settings |

## API Reference

| Document | Description |
|----------|-------------|
| [API Reference](api-reference.md) | REST API endpoints and utility functions |
| [OpenAPI Spec](openapi.yaml) | OpenAPI 3.0 specification for the REST API |
| [System APIs Reference](system-apis-reference.md) | Internal system API documentation |
| [System Integration Guide](system-integration-guide.md) | Integrating external systems with APEX |
| [Slack App Manifest](slack-app-manifest.yaml) | Slack app configuration manifest |

## Architecture Decision Records (ADRs)

### Dashboard & UI Components

| ADR | Title |
|-----|-------|
| [ADR-0001](adr/ADR-0001-budget-gauge-component.md) | Budget Gauge Component Architecture |
| [ADR-0002](adr/ADR-0002-websocket-connection-indicator-architecture.md) | WebSocketConnectionIndicator Component Architecture |
| [ADR-0003](adr/ADR-0003-active-tasks-panel-realtime-updates.md) | ActiveTasksPanel WebSocket Real-time Updates |
| [ADR-0003](adr/ADR-0003-active-tasks-panel-testing-architecture.md) | ActiveTasksPanel Testing Architecture |
| [ADR-0004](adr/ADR-0004-recent-activity-feed-realtime-integration.md) | RecentActivityFeed WebSocket Real-Time Integration |
| [ADR-0004](adr/ADR-0004-useApprovalGateWebSocket-hook-architecture.md) | useApprovalGateWebSocket Hook Architecture |
| [ADR-0015](adr/ADR-0015-active-tasks-panel-dashboard-integration.md) | ActiveTasksPanel Dashboard Integration |
| [ADR-0016](adr/ADR-0016-dashboard-budget-agent-widgets-integration.md) | Budget and Agent Utilization Dashboard Widgets |
| [ADR-0016](adr/ADR-0016-recent-activity-feed-test-architecture.md) | RecentActivityFeed Test Architecture |
| [ADR-0017](adr/ADR-0017-recent-activity-feed-component-architecture.md) | RecentActivityFeed Component Architecture |
| [ADR-0018](adr/ADR-0018-TokenUsageOverTimeChart-Architecture.md) | TokenUsageOverTimeChart Component Architecture |
| [ADR-0019](adr/ADR-0019-dashboard-panels-integration-architecture.md) | Dashboard Panels Integration Architecture |
| [ADR-0044](adr/ADR-0044-changelog-display-component-architecture.md) | Automated Changelog Display Component Architecture |
| [ADR-0050](adr/ADR-0050-in-app-notification-center-architecture.md) | In-App Notification Center Architecture |
| [ADR-012](adr/ADR-012-quick-actions-bar-architecture.md) | QuickActionsBar Dashboard Integration |
| [ADR](adr/ADR-agent-utilization-zero-data-handling.md) | Zero-Data State Handling for AgentUtilizationChart |
| [ADR](architecture/adr/ADR-ProjectHealthPanel.md) | ProjectHealthPanel Component Architecture |

### Agent Terminal Panel

| ADR | Title |
|-----|-------|
| [ADR-0015](adr/0015-agent-terminal-panel-architecture.md) | AgentTerminalPanel Component Architecture |
| [ADR-0015](adr/0015-agent-terminal-panel-keyboard-accessibility-tests.md) | AgentTerminalPanel Keyboard Accessibility Tests |
| [ADR-0016](adr/0016-agent-terminal-panel-architecture.md) | AgentTerminalPanel Component Architecture (Revised) |
| [ADR-007](adr/ADR-007-agent-terminal-panel-state-hook.md) | useAgentTerminalPanelState Hook Architecture |
| [ADR-0032](adr/ADR-0032-agent-terminal-panel-minimize-maximize-architecture.md) | AgentTerminalPanel Minimize/Maximize Functionality |
| [ADR-0033](adr/ADR-0033-useAgentLogStream-hook-architecture.md) | useAgentLogStream Hook Architecture |
| [ADR-0043](adr/ADR-0043-agent-terminal-panel-css-transitions.md) | AgentTerminalPanel CSS Transitions |
| [ADR-0045](adr/ADR-0045-agent-terminal-panel-keyboard-shortcuts-enhancement.md) | AgentTerminalPanel Keyboard Shortcuts Enhancement |
| [ADR-0054](adr/ADR-0054-terminal-panel-state-feedback-architecture.md) | Terminal Panel State Feedback Architecture |
| [ADR-0055](adr/ADR-0055-agent-terminal-panel-test-architecture-implementation.md) | AgentTerminalPanel Test Architecture Implementation |
| [ADR-0032](architecture/adr/ADR-0032-technical-design.md) | AgentTerminalPanel Three-State Technical Design |
| [ADR](architecture/adr/ADR-TAB-NAVIGATION.md) | Tab Navigation Between Panels |
| [ADR-0044](architecture/adr-0044-agent-terminal-panel-test-architecture.md) | AgentTerminalPanel Test Architecture |

### Kanban & Workflow

| ADR | Title |
|-----|-------|
| [ADR-0021](adr/ADR-0021-kanban-drag-and-drop-architecture.md) | Kanban Board Drag-and-Drop Architecture |
| [ADR-0031](adr/ADR-0031-visual-kanban-enhancements-integration-architecture.md) | Visual Kanban Enhancements Integration |
| [ADR-0023](adr/ADR-0023-visual-workflow-editor-architecture.md) | Visual Workflow Editor Architecture |
| [ADR-0011](adr/0011-kanban-context-injection-button.md) | KanbanCard Context Injection Button |
| [ADR-0041](adr/ADR-0041-kanban-context-injection-integration-tests.md) | Kanban Context Injection Integration Tests |

### Approval & Templates

| ADR | Title |
|-----|-------|
| [ADR-0024](adr/ADR-0024-approval-gate-panel-architecture.md) | ApprovalGatePanel Component Architecture |
| [ADR-0026](adr/ADR-0026-approval-diff-preview-architecture.md) | ApprovalDiffPreview Component Architecture |
| [ADR-012](adr/ADR-012-approval-gate-panel-integration-tests.md) | ApprovalGatePanel Integration Tests |
| [ADR-0027](adr/ADR-0027-template-selection-modal-architecture.md) | TemplateSelectionModal Component Architecture |
| [ADR-0028](adr/ADR-0028-save-template-modal-architecture.md) | SaveTemplateModal Component Architecture |
| [ADR-0029](adr/ADR-0029-template-storage-api-endpoints.md) | Template Storage and API Endpoints |
| [ADR](adr/ADR-template-storage-api.md) | Task Template Storage and API Implementation |

### Agent Management

| ADR | Title |
|-----|-------|
| [ADR-006](adr/ADR-006-agent-file-crud-operations.md) | Agent File CRUD Operations |
| [ADR-007](adr/007-visual-agent-configuration-editor.md) | Visual Agent Configuration Editor |
| [ADR-007](adr/ADR-007-parallel-agent-view-architecture.md) | Parallel Agent View Component Architecture |
| [ADR-0025](adr/ADR-0025-orchestrator-agent-crud-methods.md) | ApexOrchestrator Agent CRUD Methods |
| [ADR](adr/ADR-agent-crud-integration-tests.md) | Agent CRUD Integration Tests |
| [ADR](adr/ADR-agent-editor-comprehensive-tests.md) | Agent Configuration Editor Tests |
| [ADR-012](adrs/ADR-012-agent-form-component.md) | AgentForm Component Architecture |

### Context & Execution

| ADR | Title |
|-----|-------|
| [ADR-0010](adr/0010-context-injection-api-endpoint.md) | Context Injection API Endpoint |
| [ADR-0023](adr/0023-context-injection-modal-component.md) | Context Injection Modal Component |
| [ADR-0012](adr/0012-use-budget-status-hook-design.md) | useBudgetStatus Hook Design |
| [ADR-0015](adr/0015-execution-timeline-integration-tests.md) | ExecutionTimeline Integration Tests |
| [ADR-0030](adr/ADR-0030-execution-timeline-component-architecture.md) | ExecutionTimeline Component Architecture |
| [ADR-0042](adr/ADR-0042-task-export-reporting-architecture.md) | Task Export and Reporting Architecture |
| [ADR-2026-0315](adr/ADR-2026-0315-fix-taskdependencygraph-edge-case-tests.md) | Fix TaskDependencyGraph Edge Case Tests |

### Integrations

| ADR | Title |
|-----|-------|
| [ADR-0016](adr/ADR-0016-webhook-system-architecture.md) | Webhook System Architecture |
| [ADR-0020](adr/ADR-0020-microsoft-teams-integration-architecture.md) | Microsoft Teams Integration Architecture |
| [ADR-0022](adr/ADR-0022-discord-bot-integration-architecture.md) | Discord Bot Integration Architecture |
| [ADR-0023](adr/ADR-0023-slack-app-foundation-oauth-architecture.md) | Slack App Foundation with OAuth |

### Architecture & Design

| Document | Description |
|----------|-------------|
| [ActiveTasksPanel](architecture/adr-active-tasks-panel.md) | ActiveTasksPanel Component Architecture |
| [ParallelAgentView Tests](architecture/adr-parallel-agent-view-tests.md) | ParallelAgentView Test Enhancement |
| [ParallelAgentView Design](design/parallel-agent-view-technical-design.md) | ParallelAgentView Technical Design Spec |
| [AI Agnostic Migration](MIGRATION_PLAN_AI_AGNOSTIC.md) | Migration Plan: AI Platform Agnostic Orchestration |
| [AI Driver Interface Spec](SPEC_AI_DRIVER_INTERFACE.md) | Technical Spec: AI Driver Interface |

## Testing & Quality

| Document | Description |
|----------|-------------|
| [E2E Testing Guide](e2e.md) | End-to-end testing overview |
| [E2E Test Configuration](E2E_TEST_CONFIGURATION.md) | E2E test setup and configuration |
| [E2E Best Practices](e2e-best-practices.md) | E2E testing patterns and best practices |
| [E2E Debugging](e2e-debugging.md) | E2E test debugging and troubleshooting |
| [E2E Examples](e2e-examples.md) | E2E test examples and patterns |
| [E2E Utilities API](e2e-utilities-api.md) | E2E test utility function reference |
| [Contributing E2E Tests](contributing-e2e-tests.md) | Guide for writing new E2E tests |
| [Unified Test Configuration](UNIFIED_TEST_CONFIGURATION.md) | Unified test setup across packages |
| [Test Utilities](test-utilities.md) | Shared test utility reference |
| [Mock Helpers API](mock-helpers-api.md) | Mock helper function reference |
| [Browser Permission Test Utilities](browser-permission-test-utilities.md) | Browser permission test helpers |
| [Browser State Fixtures API](browser-state-fixtures-api.md) | Browser state fixture reference |
| [Logged-In Page Fixture Guide](logged-in-page-fixture-guide.md) | Logged-in page fixture implementation |
| [Timeout Configurations](timeout-configurations.md) | Timeout and wait strategy configuration |
| [Timeout Integration Tests](timeout-integration-test-documentation.md) | Timeout integration test documentation |
| [Load Testing Results](load-testing-results.md) | Performance baselines and load test results |

---

*111 documentation files across guides, API references, architecture decisions, and testing documentation.*
