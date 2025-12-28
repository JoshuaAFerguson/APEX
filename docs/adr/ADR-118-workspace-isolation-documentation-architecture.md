# ADR-118: Workspace Isolation Documentation Architecture

## Status

Accepted

## Context

APEX provides comprehensive workspace isolation capabilities with multiple strategies and configuration options. The current documentation is spread across several files:

1. `configuration.md` - Brief workspace section with strategy overview
2. `container-configuration.md` - Complete container field reference (944 lines)
3. `container-isolation.md` - Container isolation user guide (574 lines)
4. `ADR-063-isolation-mode-configuration.md` - Isolation mode design proposal

The task requires creating complete documentation for:
1. **Worktree isolation** - Git worktree-based task isolation
2. **Container isolation modes** - Full container configuration options
3. **Isolation mode selection in workflows** - Per-workflow isolation configuration

### Current Documentation Gaps

1. **Worktree isolation** is mentioned in comparison tables but lacks dedicated documentation
2. **Isolation modes** (`full`, `worktree`, `shared`) are defined in types.ts but not documented
3. **Workflow isolation selection** is proposed in ADR-063 but lacks user-facing documentation
4. **No unified isolation configuration guide** that ties all concepts together

## Decision

### 1. Documentation Architecture

Create a unified workspace isolation documentation structure:

```
docs/
├── workspace-isolation.md          # NEW: Unified isolation configuration guide
├── container-isolation.md          # EXISTING: Container-specific user guide
├── container-configuration.md      # EXISTING: Complete container field reference
├── configuration.md               # UPDATE: Enhanced workspace section with cross-references
└── workflows.md                    # UPDATE: Add isolation mode field documentation
```

### 2. New Documentation: `workspace-isolation.md`

Create a comprehensive guide covering all isolation options:

```markdown
# Workspace Isolation Configuration Guide

## Overview
- What is workspace isolation
- Why use isolation (security, reproducibility, parallel work)
- Isolation strategy comparison

## Isolation Modes (v0.4.0)
- full: Container + worktree (maximum isolation)
- worktree: Git worktree only (lightweight isolation)
- shared: No isolation (current project directory)

## Worktree Isolation
- How it works
- Configuration options
- When to use worktree vs container
- Git workflow integration

## Container Isolation
- Link to container-isolation.md
- Brief overview with cross-references

## Per-Workflow Isolation Configuration
- Configuring isolation in workflows
- Global defaults with workflow overrides
- CLI override options

## Configuration Reference
- Complete field reference
- Schema definitions
- Validation rules
```

### 3. Documentation Structure for `workspace-isolation.md`

```yaml
# Document outline
sections:
  - title: Overview
    subsections:
      - What is Workspace Isolation
      - Isolation Strategies at a Glance
      - Choosing the Right Strategy

  - title: Isolation Modes
    subsections:
      - Full Isolation (container)
      - Worktree Isolation
      - Shared Mode (none)
      - Mode Comparison Table

  - title: Worktree Isolation
    subsections:
      - How Git Worktrees Work
      - Worktree Configuration
      - Worktree Lifecycle
      - Best Practices
      - Troubleshooting

  - title: Container Isolation
    subsections:
      - Overview (link to container-isolation.md)
      - Quick Configuration Reference
      - Full vs Worktree Comparison

  - title: Workflow Isolation Selection
    subsections:
      - Global Isolation Defaults
      - Per-Workflow Overrides
      - Workflow Definition Isolation Field
      - CLI Override Options
      - Configuration Priority Chain

  - title: Configuration Reference
    subsections:
      - workspace Section Schema
      - isolation Section Schema
      - Complete Configuration Examples
```

### 4. Updates to Existing Documentation

#### 4.1 `configuration.md` Updates

Add comprehensive isolation section:

```yaml
# Lines to add/update in workspace section
workspace:
  defaultStrategy: "container"  # none | directory | worktree | container
  cleanupOnComplete: true
  preserveOnFailure: false      # NEW: Document this field
  container:
    # ... existing container docs ...

# NEW section
isolation:
  default: "shared"  # full | worktree | shared
  overrides:
    feature: "full"
    bugfix: "worktree"
    refactor: "worktree"
```

Add cross-references:

```markdown
### workspace

Workspace isolation configuration for running tasks in controlled environments.

> **Comprehensive Guide**: For detailed documentation of all isolation options
> including worktree and container isolation, see the
> [Workspace Isolation Configuration Guide](./workspace-isolation.md).

> **Container Reference**: For complete container configuration field reference,
> see the [Container Configuration Reference](./container-configuration.md).
```

#### 4.2 `workflows.md` Updates

Add isolation mode documentation to workflow fields:

```yaml
### Workflow Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique workflow identifier |
| `description` | Yes | Brief description of the workflow |
| `trigger` | No | Events that can trigger this workflow |
| `stages` | Yes | Array of stage definitions |
| `isolation` | No | **NEW**: Isolation mode for this workflow (full/worktree/shared) |

### Workflow Isolation

Override the project's default isolation mode for a specific workflow:

```yaml
# .apex/workflows/feature.yaml
name: feature
description: Full feature implementation workflow
isolation: full  # Ensure maximum isolation for new features

stages:
  - name: planning
    agent: planner
    # ...
```
```

### 5. Content Structure for Worktree Isolation

The worktree documentation should cover:

#### 5.1 Concept Explanation

```markdown
## Worktree Isolation

Git worktrees allow multiple working directories to share a single repository,
enabling parallel development without full cloning or copying.

### How It Works

1. APEX creates a new Git worktree for each task
2. A new branch is created (or checked out) in the worktree
3. Task execution happens in the isolated worktree
4. Changes are committed to the task branch
5. Worktree is cleaned up after task completion (if configured)

### Benefits

- **Fast creation**: No file copying required
- **Branch isolation**: Each task gets its own branch
- **Low disk usage**: Shares Git objects with main repository
- **Native Git workflow**: Standard branch/merge operations
```

#### 5.2 Configuration Reference

```markdown
### Worktree Configuration

```yaml
workspace:
  defaultStrategy: "worktree"
  cleanupOnComplete: true

# Or use isolation mode abstraction
isolation:
  default: "worktree"
```

### CLI Options

```bash
# Use worktree for a specific task
apex run "implement feature" --workspace-strategy worktree

# Override with isolation mode
apex run "implement feature" --isolation worktree
```
```

#### 5.3 Lifecycle Documentation

```markdown
### Worktree Lifecycle

```
Task Creation
    │
    ├─► Generate branch name (apex/<task-id>)
    │
    ├─► Create worktree: git worktree add <path> -b <branch>
    │
    ├─► Task execution in worktree
    │
    ├─► Commit changes to branch
    │
    └─► Cleanup (if cleanupOnComplete: true)
            │
            ├─► Remove worktree: git worktree remove <path>
            │
            └─► Optionally delete branch
```
```

### 6. Isolation Mode Selection in Workflows

Document the priority chain for isolation resolution:

```markdown
## Isolation Mode Resolution

When executing a task, APEX resolves the isolation mode using this priority chain:

```
1. CLI Flag Override
   │  apex run "task" --isolation full
   ↓
2. Workflow Definition
   │  isolation: full (in workflow YAML)
   ↓
3. Isolation Config Override
   │  isolation.overrides.feature: full (in config.yaml)
   ↓
4. Isolation Config Default
   │  isolation.default: shared (in config.yaml)
   ↓
5. Built-in Default
      'shared' (no isolation)
```

### Configuration Examples

#### Global Default with Workflow Overrides

```yaml
# .apex/config.yaml
isolation:
  default: shared  # Most tasks use shared mode
  overrides:
    feature: full      # Features get full container isolation
    bugfix: worktree   # Bugfixes use worktree only
    security-audit: full  # Security work needs full isolation
```

#### Workflow-Level Override

```yaml
# .apex/workflows/release.yaml
name: release
description: Release preparation workflow
isolation: full  # Always use full isolation for releases
```
```

### 7. Complete Configuration Example

Document the complete workspace and isolation configuration:

```yaml
# .apex/config.yaml - Complete Isolation Configuration
version: "1.0"

project:
  name: my-project
  language: typescript

# High-level isolation mode abstraction (v0.4.0)
isolation:
  default: shared
  overrides:
    feature: full
    bugfix: worktree
    refactor: worktree
    release: full

# Low-level workspace configuration
workspace:
  # Default strategy (maps from isolation mode)
  defaultStrategy: none  # none | directory | worktree | container

  # Cleanup behavior
  cleanupOnComplete: true

  # Container settings for 'container' strategy
  container:
    image: "node:20-alpine"
    dockerfile: ".apex/Dockerfile"  # Optional custom image
    buildContext: "."
    imageTag: "my-project:apex"

    resourceLimits:
      cpu: 2
      memory: "4g"
      memoryReservation: "2g"
      memorySwap: "8g"
      cpuShares: 1024
      pidsLimit: 1000

    networkMode: "bridge"

    environment:
      NODE_ENV: "development"
      CI: "true"

    workingDir: "/workspace"
    user: "1000:1000"

    volumes:
      "./data": "/app/data"

    autoRemove: true
    autoDependencyInstall: true
    useFrozenLockfile: true
    installTimeout: 300000
    installRetries: 2

    # Security hardening
    privileged: false
    capDrop: ["ALL"]
    capAdd: ["NET_BIND_SERVICE"]
    securityOpts:
      - "no-new-privileges:true"
```

### 8. Schema Reference Table

Include a comprehensive schema reference:

```markdown
## Configuration Schema Reference

### Isolation Mode Values

| Mode | Workspace Strategy | Description |
|------|-------------------|-------------|
| `full` | `container` | Maximum isolation with Docker/Podman container |
| `worktree` | `worktree` | Git worktree isolation (lightweight) |
| `shared` | `none` | No isolation, work in project directory |

### Workspace Strategy Values

| Strategy | Isolation Level | Performance | Use Case |
|----------|----------------|-------------|----------|
| `container` | Full (OS-level) | Moderate | CI/CD, security-sensitive |
| `worktree` | Git-level | Fast | Parallel branch work |
| `directory` | File-level | Slow (copy) | Simple file isolation |
| `none` | None | Fastest | Quick tasks, trusted operations |

### Workspace Configuration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `defaultStrategy` | enum | `none` | Default workspace strategy |
| `cleanupOnComplete` | boolean | `true` | Remove workspace after completion |
| `container` | object | - | Container configuration (see container-configuration.md) |

### Isolation Configuration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `default` | enum | `shared` | Default isolation mode for all workflows |
| `overrides` | object | `{}` | Per-workflow isolation mode overrides |
```

## Consequences

### Positive

1. **Unified documentation**: Single source of truth for isolation configuration
2. **Complete coverage**: Worktree isolation properly documented
3. **Clear hierarchy**: Isolation modes → Workspace strategies → Container config
4. **Easy navigation**: Cross-references between related documents
5. **Workflow integration**: Clear documentation of per-workflow isolation

### Negative

1. **Documentation overhead**: New file to maintain
2. **Potential duplication**: Some overlap with container-isolation.md
3. **Migration**: Users may need to update mental models

### Mitigations

1. Use consistent cross-references to avoid duplication
2. Keep container-isolation.md focused on container-specific details
3. Keep workspace-isolation.md focused on strategy selection and configuration
4. Provide clear migration guides for new isolation mode abstraction

## Implementation Checklist

### Documentation Files

1. [ ] Create `docs/workspace-isolation.md` - Unified isolation guide
2. [ ] Update `docs/configuration.md` - Add isolation section, cross-references
3. [ ] Update `docs/workflows.md` - Add isolation field documentation
4. [ ] Update `docs/container-isolation.md` - Add cross-references to new guide

### Content Sections

5. [ ] Document worktree isolation configuration
6. [ ] Document isolation modes (full, worktree, shared)
7. [ ] Document per-workflow isolation configuration
8. [ ] Add complete configuration examples
9. [ ] Add troubleshooting section
10. [ ] Add best practices section

### Validation

11. [ ] Verify all YAML examples are valid
12. [ ] Ensure schema documentation matches types.ts
13. [ ] Test all CLI examples
14. [ ] Review cross-references for accuracy

## References

- ADR-063: Isolation Mode Configuration
- ADR-066: Container Workspace Config Validation
- ADR-068: Container Isolation Architecture
- types.ts: IsolationModeSchema, WorkspaceStrategySchema, WorkspaceConfigSchema
