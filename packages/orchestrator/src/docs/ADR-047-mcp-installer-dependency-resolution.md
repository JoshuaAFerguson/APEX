# ADR-047: MCP Installer Dependency Resolution

## Status
Accepted

## Context

The MCPInstaller currently provides version management capabilities (parsing, comparison, range satisfaction) and handles individual MCP server installations. However, MCP servers may depend on other MCP servers. For example:

- A "code-analysis" MCP server might depend on "filesystem" and "git" MCP servers
- A "full-stack-dev" MCP server might depend on "code-analysis" which in turn depends on "filesystem" (transitive dependency)
- Complex dependency graphs may contain circular references that need detection

We need a dependency resolution system that:
1. Resolves single-level dependencies
2. Resolves transitive dependencies (dependencies of dependencies)
3. Detects circular dependencies and reports them clearly
4. Handles missing dependencies gracefully
5. Resolves version conflicts when multiple servers depend on different versions of the same server

## Decision

### Architecture: MCPDependencyResolver Class

We will implement a `MCPDependencyResolver` class within the orchestrator package that integrates with the existing `MCPInstaller`. The resolver operates on a dependency graph model.

### Core Interfaces

```typescript
/**
 * Represents a dependency declaration for an MCP server
 */
export interface MCPDependency {
  /** The name/ID of the required MCP server */
  name: string;
  /** Version range requirement (semver) */
  versionRange: string;
  /** Whether this dependency is optional */
  optional?: boolean;
}

/**
 * Represents an MCP server with its dependencies
 */
export interface MCPServerWithDependencies {
  /** The MCP server definition */
  server: MCPServer;
  /** List of dependencies this server requires */
  dependencies: MCPDependency[];
}

/**
 * Result of dependency resolution
 */
export interface DependencyResolutionResult {
  /** Ordered list of servers to install (topologically sorted) */
  installOrder: MCPServerWithDependencies[];
  /** Any warnings (e.g., optional dependencies not found) */
  warnings: DependencyWarning[];
  /** Whether the resolution was fully successful */
  resolved: boolean;
}

/**
 * Represents an error encountered during dependency resolution
 */
export interface DependencyResolutionError {
  type: 'circular' | 'missing' | 'version_conflict';
  message: string;
  /** The dependency that caused the error */
  dependency: MCPDependency;
  /** For circular: the cycle path; for version_conflict: conflicting requirements */
  details: string[];
}

/**
 * Warning generated during dependency resolution
 */
export interface DependencyWarning {
  type: 'optional_missing' | 'version_downgrade';
  message: string;
  dependency: MCPDependency;
}
```

### Dependency Resolution Algorithm

The resolver uses a modified depth-first topological sort with cycle detection:

1. **Build Graph**: Construct an adjacency list from server dependency declarations
2. **Detect Cycles**: Use DFS with a "visiting" state (white/gray/black coloring) to detect back edges
3. **Topological Sort**: Process nodes in reverse post-order for installation ordering
4. **Version Resolution**: When multiple versions are required, select the highest version satisfying all constraints (using the existing `satisfiesRange` from MCPInstaller)
5. **Missing Dependency Handling**: Report missing required dependencies as errors, missing optional dependencies as warnings

### Integration with MCPInstaller

The `MCPDependencyResolver` will:
- Accept a registry/catalog of available servers (as `MCPServerWithDependencies[]`)
- Use `MCPInstaller.satisfiesRange()` for version compatibility checks
- Return a resolution result that the installer can use for ordered installation

### Key Design Decisions

1. **Separate Class**: Dependency resolution is a separate class from MCPInstaller to maintain SRP (Single Responsibility Principle)
2. **Stateless Resolution**: The resolver does not maintain state between calls; it operates on the input registry each time
3. **Fail-Fast for Circular Dependencies**: Circular dependencies are detected and reported immediately, not silently resolved
4. **Version Conflict Strategy**: "Highest Compatible" - select the highest version that satisfies all constraints
5. **Topological Installation Order**: Results are ordered so dependencies are installed before their dependents

## File Structure

```
packages/orchestrator/src/
  mcp-dependency-resolver.ts          # MCPDependencyResolver class
  __tests__/
    mcp-installer-dependency-resolution.test.ts  # Unit tests
```

## Consequences

### Positive
- Enables complex MCP server ecosystems with inter-dependencies
- Prevents installation failures from unmet dependencies
- Clear error reporting for unresolvable dependency graphs
- Leverages existing version management infrastructure
- Clean separation of concerns (resolver vs. installer)

### Negative
- Adds complexity to the installation workflow
- Requires servers to declare dependencies (registry/catalog enhancement)
- Resolution may fail for complex graphs with conflicting requirements

### Risks
- Large dependency graphs could have performance implications (mitigated by the typical small size of MCP server ecosystems)
- Version conflicts may require user intervention (mitigated by clear error reporting)
