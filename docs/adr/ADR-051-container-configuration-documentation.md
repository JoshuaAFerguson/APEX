# ADR-051: Container Configuration Documentation Architecture

## Status
Proposed

## Context

APEX v0.4.0 introduces comprehensive container isolation features for running tasks in sandboxed Docker/Podman environments. The container configuration system includes:

- **ContainerConfig schema** with 25+ configurable fields
- **ResourceLimits** for CPU, memory, and process controls
- **Network modes** for isolation levels
- **Security options** including capabilities and privilege controls
- **Dependency management** with auto-install and retry logic
- **Per-task overrides** via CLI flags and programmatic API

The existing documentation in `docs/container-isolation.md` provides a comprehensive guide, but the task requires creating a dedicated **Container Configuration Reference** document that serves as a canonical reference for all configuration options.

### Documentation Gap Analysis

After analyzing the existing documentation:

1. **`docs/container-isolation.md`** - Covers usage, architecture, and troubleshooting but mixes conceptual content with reference material
2. **`docs/configuration.md`** - Has a workspace section with partial container config, but lacks complete field documentation
3. **`packages/core/src/types.ts`** - Contains the source of truth for all schemas with JSDoc comments

The acceptance criteria specifies:
- All `ContainerConfig` fields documented
- Resource limits reference table
- Environment variables section
- Volume mounting documentation
- Network modes explanation
- Security options reference
- Per-task overrides with examples

## Decision

### 1. Documentation Structure

Create a new dedicated reference document: `docs/container-configuration.md`

This document will follow a reference-style format optimized for quick lookups, distinct from the guide-style `container-isolation.md`.

```
docs/
├── container-isolation.md      # Guide: concepts, setup, best practices
├── container-configuration.md  # NEW: Complete field reference
├── configuration.md            # General config (links to container ref)
└── ...
```

### 2. Document Organization

The new `container-configuration.md` will be organized into these sections:

```markdown
# Container Configuration Reference

## Overview
Brief intro linking to container-isolation.md for conceptual background

## Quick Reference
Summary table of all fields with types and defaults

## ContainerConfig Fields

### Image Configuration
- image (required)
- dockerfile
- buildContext
- imageTag

### Resource Limits
Complete ResourceLimits schema reference table

### Environment & Volumes
- environment
- volumes
- workingDir

### Networking
- networkMode (bridge/host/none/container)
- Comparison table

### Security Options
- privileged
- securityOpts
- capAdd
- capDrop
- user

### Lifecycle & Behavior
- autoRemove
- entrypoint
- command
- labels

### Dependency Management
- autoDependencyInstall
- customInstallCommand
- useFrozenLockfile
- installTimeout
- installRetries

## Per-Task Overrides
- CLI flag reference
- Programmatic API examples
- Priority/precedence rules

## Default Configuration
- WorkspaceDefaults schema
- ContainerDefaults schema
- Inheritance chain

## Examples
- Complete configuration examples
- Common use cases
```

### 3. Reference Table Format

Each configuration section will use consistent table format:

```markdown
| Field | Type | Default | Required | Description |
|-------|------|---------|----------|-------------|
| `image` | `string` | - | Yes | Docker/OCI image (e.g., "node:20-alpine") |
```

With validation constraints noted:
- Regex patterns for validation
- Min/max ranges
- Enum values

### 4. Cross-Reference Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Documentation Links                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  container-isolation.md          container-configuration.md              │
│  ├── "Getting Started"    ────►  (conceptual background)                │
│  ├── "Container Config"   ────►  "ContainerConfig Fields"               │
│  └── "Troubleshooting"    ◄────  (link back for issues)                 │
│                                                                          │
│  configuration.md                                                        │
│  └── "workspace.container" ────► container-configuration.md             │
│                                                                          │
│  types.ts (source)                                                       │
│  └── ContainerConfigSchema ────► container-configuration.md             │
│                                   (keeps in sync via JSDoc)              │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5. Field Documentation Template

Each field will be documented with:

```markdown
### `fieldName`

**Type**: `string` | `number` | `boolean` | etc.
**Default**: `value` or "none"
**Required**: Yes/No
**Since**: v0.4.0

Description of what the field does.

**Validation**:
- Constraint 1
- Constraint 2

**Example**:
```yaml
container:
  fieldName: "value"
```

**Related**: [link to related field](#related-field)
```

### 6. Resource Limits Reference Table

Special attention to resource limits with comprehensive table:

| Field | Type | Range | Unit | Docker Flag | Description |
|-------|------|-------|------|-------------|-------------|
| `cpu` | number | 0.1-64 | cores | `--cpus` | CPU limit |
| `memory` | string | - | k/m/g | `--memory` | Memory hard limit |
| `memoryReservation` | string | - | k/m/g | `--memory-reservation` | Memory soft limit |
| `memorySwap` | string | - | k/m/g | `--memory-swap` | Swap limit |
| `cpuShares` | number | 2-262144 | - | `--cpu-shares` | CPU priority weight |
| `pidsLimit` | number | 1+ | - | `--pids-limit` | Process limit |

### 7. Network Mode Comparison

| Mode | Isolation | Performance | Use Case |
|------|-----------|-------------|----------|
| `bridge` | Full | Good | Default, most tasks |
| `host` | None | Best | Performance-critical |
| `none` | Complete | N/A | No network needed |
| `container` | Shared | Good | Container-to-container |

### 8. Security Options Matrix

| Option | Type | Purpose | Risk Level |
|--------|------|---------|------------|
| `privileged: true` | boolean | Full host access | HIGH |
| `capDrop: ["ALL"]` | string[] | Remove all capabilities | Recommended |
| `capAdd: [...]` | string[] | Add specific caps | Medium |
| `securityOpts` | string[] | AppArmor/SELinux | Low |

### 9. Per-Task Override Priority

Document the precedence chain:

```
CLI Flags (highest priority)
    ↓
Task-level configuration
    ↓
Workflow-level defaults
    ↓
Project workspace.container defaults
    ↓
Built-in defaults (lowest priority)
```

## Implementation Notes

### For Documentation Stage

1. Create `docs/container-configuration.md` with all sections
2. Update `docs/container-isolation.md` to link to new reference
3. Update `docs/configuration.md` workspace section to link to container reference
4. Ensure all 25+ ContainerConfig fields are documented

### Verification Checklist

- [ ] All ContainerConfig fields from types.ts documented
- [ ] Resource limits table complete with Docker flag mapping
- [ ] Environment variables section with examples
- [ ] Volume mounting with host:container format examples
- [ ] All 4 network modes documented with use cases
- [ ] Security options (privileged, capAdd, capDrop, securityOpts) documented
- [ ] Per-task override examples for CLI and programmatic use
- [ ] Cross-links between related docs working
- [ ] Examples validated against schema

## Consequences

### Positive
- Single source of truth for container configuration reference
- Easy lookup for specific fields
- Clear separation between guide (container-isolation.md) and reference
- Comprehensive per-task override documentation

### Negative
- Some duplication with container-isolation.md (mitigated by cross-linking)
- Requires keeping in sync with types.ts schema changes

### Neutral
- Additional documentation file to maintain
- Users must know which doc to reference (guide vs reference)

## Related ADRs

- ADR-0XX: Container Isolation Architecture (if exists)
- ADR-0XX: Workspace Strategy Design (if exists)
