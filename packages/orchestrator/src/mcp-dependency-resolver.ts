import { MCPServer } from '@apexcli/core';
import { MCPInstaller } from './mcp-installer';

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

/** Node visit states for DFS cycle detection */
enum VisitState {
  /** Not yet visited */
  White = 'white',
  /** Currently being visited (on the current DFS path) */
  Gray = 'gray',
  /** Fully processed */
  Black = 'black',
}

/**
 * MCPDependencyResolver resolves dependencies between MCP servers.
 *
 * Handles:
 * - Single dependency resolution
 * - Transitive dependencies (dependencies of dependencies)
 * - Circular dependency detection
 * - Missing dependency handling (errors for required, warnings for optional)
 * - Version conflict resolution (highest compatible version strategy)
 *
 * Uses a modified depth-first topological sort with cycle detection.
 */
export class MCPDependencyResolver {
  private installer: MCPInstaller;

  constructor(installer: MCPInstaller) {
    this.installer = installer;
  }

  /**
   * Resolve dependencies for a target server within a registry of available servers.
   *
   * @param targetServer - The server whose dependencies should be resolved
   * @param registry - Available servers (the "catalog") to resolve against
   * @returns Resolution result with ordered install list, or throws on unresolvable errors
   * @throws DependencyResolutionError for circular dependencies, missing required deps, or version conflicts
   */
  resolve(
    targetServer: MCPServerWithDependencies,
    registry: MCPServerWithDependencies[]
  ): DependencyResolutionResult {
    const warnings: DependencyWarning[] = [];
    const errors: DependencyResolutionError[] = [];

    // Build a lookup map from the registry: name -> MCPServerWithDependencies[]
    const registryMap = this.buildRegistryMap(registry);

    // Include the target server itself in the map if not already present
    if (!registryMap.has(targetServer.server.name)) {
      registryMap.set(targetServer.server.name, [targetServer]);
    }

    // Resolve version conflicts first and build a resolved registry
    const resolvedRegistry = this.resolveVersionConflicts(
      targetServer,
      registryMap,
      errors,
      warnings
    );

    if (errors.length > 0) {
      throw this.createError(errors[0]);
    }

    // Perform topological sort with cycle detection
    const visitState = new Map<string, VisitState>();
    const installOrder: MCPServerWithDependencies[] = [];
    const path: string[] = [];

    this.dfs(
      targetServer.server.name,
      resolvedRegistry,
      visitState,
      installOrder,
      path,
      errors,
      warnings
    );

    if (errors.length > 0) {
      throw this.createError(errors[0]);
    }

    return {
      installOrder,
      warnings,
      resolved: true,
    };
  }

  /**
   * Resolve dependencies for multiple target servers at once.
   *
   * @param targets - The servers to resolve dependencies for
   * @param registry - Available servers to resolve against
   * @returns Combined resolution result
   */
  resolveMultiple(
    targets: MCPServerWithDependencies[],
    registry: MCPServerWithDependencies[]
  ): DependencyResolutionResult {
    const warnings: DependencyWarning[] = [];
    const errors: DependencyResolutionError[] = [];
    const registryMap = this.buildRegistryMap(registry);

    // Add all targets to registry map
    for (const target of targets) {
      if (!registryMap.has(target.server.name)) {
        registryMap.set(target.server.name, [target]);
      }
    }

    // Collect all required versions across all targets
    const resolvedRegistry = new Map<string, MCPServerWithDependencies>();
    for (const target of targets) {
      const resolved = this.resolveVersionConflicts(
        target,
        registryMap,
        errors,
        warnings
      );
      for (const [name, server] of resolved) {
        if (!resolvedRegistry.has(name)) {
          resolvedRegistry.set(name, server);
        }
      }
    }

    if (errors.length > 0) {
      throw this.createError(errors[0]);
    }

    // Topological sort across all targets
    const visitState = new Map<string, VisitState>();
    const installOrder: MCPServerWithDependencies[] = [];

    for (const target of targets) {
      const path: string[] = [];
      this.dfs(
        target.server.name,
        resolvedRegistry,
        visitState,
        installOrder,
        path,
        errors,
        warnings
      );

      if (errors.length > 0) {
        throw this.createError(errors[0]);
      }
    }

    return {
      installOrder,
      warnings,
      resolved: true,
    };
  }

  /**
   * Check if a dependency graph has circular dependencies without performing full resolution.
   *
   * @param servers - The servers to check for cycles
   * @returns Array of cycle paths found (empty if no cycles)
   */
  detectCircularDependencies(
    servers: MCPServerWithDependencies[]
  ): string[][] {
    const registryMap = this.buildRegistryMap(servers);
    const resolvedRegistry = new Map<string, MCPServerWithDependencies>();

    for (const server of servers) {
      resolvedRegistry.set(server.server.name, server);
    }

    const cycles: string[][] = [];
    const visitState = new Map<string, VisitState>();

    for (const server of servers) {
      if (visitState.get(server.server.name) !== VisitState.Black) {
        const path: string[] = [];
        this.detectCycles(
          server.server.name,
          resolvedRegistry,
          visitState,
          path,
          cycles
        );
      }
    }

    return cycles;
  }

  /**
   * Get the flat list of all transitive dependencies for a server.
   *
   * @param server - The server to get dependencies for
   * @param registry - Available servers to resolve against
   * @returns Flat list of all transitive dependencies (not including the server itself)
   */
  getTransitiveDependencies(
    server: MCPServerWithDependencies,
    registry: MCPServerWithDependencies[]
  ): MCPServerWithDependencies[] {
    const result = this.resolve(server, registry);
    // Remove the target server itself from the result
    return result.installOrder.filter(s => s.server.name !== server.server.name);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Build a map from server name to all available versions of that server.
   */
  private buildRegistryMap(
    registry: MCPServerWithDependencies[]
  ): Map<string, MCPServerWithDependencies[]> {
    const map = new Map<string, MCPServerWithDependencies[]>();

    for (const entry of registry) {
      const existing = map.get(entry.server.name) || [];
      existing.push(entry);
      map.set(entry.server.name, existing);
    }

    return map;
  }

  /**
   * Resolve version conflicts across the dependency graph.
   * Uses "highest compatible version" strategy.
   */
  private resolveVersionConflicts(
    root: MCPServerWithDependencies,
    registryMap: Map<string, MCPServerWithDependencies[]>,
    errors: DependencyResolutionError[],
    warnings: DependencyWarning[]
  ): Map<string, MCPServerWithDependencies> {
    const resolved = new Map<string, MCPServerWithDependencies>();
    const versionRequirements = new Map<string, MCPDependency[]>();

    // Collect all version requirements by traversing the graph (BFS)
    this.collectVersionRequirements(root, registryMap, versionRequirements, new Set());

    // Resolve each dependency to a specific version
    resolved.set(root.server.name, root);

    for (const [name, requirements] of versionRequirements) {
      const candidates = registryMap.get(name);

      if (!candidates || candidates.length === 0) {
        // Check if all requirements are optional
        const allOptional = requirements.every(r => r.optional);
        if (allOptional) {
          for (const req of requirements) {
            warnings.push({
              type: 'optional_missing',
              message: `Optional dependency '${name}' not found in registry`,
              dependency: req,
            });
          }
          continue;
        }

        errors.push({
          type: 'missing',
          message: `Required dependency '${name}' not found in registry`,
          dependency: requirements[0],
          details: requirements.map(r => `Required by: ${r.name} (${r.versionRange})`),
        });
        continue;
      }

      // Find a version that satisfies all requirements
      const selectedCandidate = this.findBestVersion(candidates, requirements);

      if (!selectedCandidate) {
        errors.push({
          type: 'version_conflict',
          message: `No version of '${name}' satisfies all requirements`,
          dependency: requirements[0],
          details: requirements.map(
            r => `Requires: ${r.versionRange}`
          ),
        });
        continue;
      }

      resolved.set(name, selectedCandidate);
    }

    return resolved;
  }

  /**
   * BFS to collect all version requirements across the dependency graph.
   */
  private collectVersionRequirements(
    current: MCPServerWithDependencies,
    registryMap: Map<string, MCPServerWithDependencies[]>,
    requirements: Map<string, MCPDependency[]>,
    visited: Set<string>
  ): void {
    if (visited.has(current.server.name)) {
      return; // Already processed (cycle will be caught later)
    }
    visited.add(current.server.name);

    for (const dep of current.dependencies) {
      const existing = requirements.get(dep.name) || [];
      existing.push(dep);
      requirements.set(dep.name, existing);

      // Recurse into the dependency's own dependencies
      const candidates = registryMap.get(dep.name);
      if (candidates && candidates.length > 0) {
        // Use the first candidate for requirement collection
        // (actual version will be resolved in resolveVersionConflicts)
        for (const candidate of candidates) {
          this.collectVersionRequirements(candidate, registryMap, requirements, visited);
        }
      }
    }
  }

  /**
   * Find the best (highest) version from candidates that satisfies all requirements.
   */
  private findBestVersion(
    candidates: MCPServerWithDependencies[],
    requirements: MCPDependency[]
  ): MCPServerWithDependencies | null {
    // Sort candidates by version (highest first)
    const sorted = [...candidates].sort((a, b) =>
      this.installer.compareVersions(b.server.version, a.server.version)
    );

    // Find the first candidate that satisfies all requirements
    for (const candidate of sorted) {
      const satisfiesAll = requirements.every(req =>
        this.installer.satisfiesRange(candidate.server.version, req.versionRange)
      );

      if (satisfiesAll) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * Depth-first search for topological sort with cycle detection.
   */
  private dfs(
    serverName: string,
    resolvedRegistry: Map<string, MCPServerWithDependencies>,
    visitState: Map<string, VisitState>,
    installOrder: MCPServerWithDependencies[],
    path: string[],
    errors: DependencyResolutionError[],
    warnings: DependencyWarning[]
  ): void {
    const state = visitState.get(serverName) || VisitState.White;

    if (state === VisitState.Black) {
      return; // Already processed
    }

    if (state === VisitState.Gray) {
      // Cycle detected!
      const cycleStart = path.indexOf(serverName);
      const cyclePath = [...path.slice(cycleStart), serverName];

      errors.push({
        type: 'circular',
        message: `Circular dependency detected: ${cyclePath.join(' -> ')}`,
        dependency: { name: serverName, versionRange: '*' },
        details: cyclePath,
      });
      return;
    }

    // Mark as visiting (gray)
    visitState.set(serverName, VisitState.Gray);
    path.push(serverName);

    const server = resolvedRegistry.get(serverName);
    if (!server) {
      // This shouldn't happen if resolveVersionConflicts ran first,
      // but handle gracefully
      path.pop();
      visitState.set(serverName, VisitState.Black);
      return;
    }

    // Visit all dependencies
    for (const dep of server.dependencies) {
      const depServer = resolvedRegistry.get(dep.name);
      if (!depServer) {
        if (!dep.optional) {
          errors.push({
            type: 'missing',
            message: `Required dependency '${dep.name}' not found`,
            dependency: dep,
            details: [`Required by: ${serverName}`],
          });
        } else {
          // Only add warning if not already warned (resolveVersionConflicts may have added one)
          const alreadyWarned = warnings.some(
            w => w.type === 'optional_missing' && w.dependency.name === dep.name
          );
          if (!alreadyWarned) {
            warnings.push({
              type: 'optional_missing',
              message: `Optional dependency '${dep.name}' not found`,
              dependency: dep,
            });
          }
        }
        continue;
      }

      this.dfs(dep.name, resolvedRegistry, visitState, installOrder, path, errors, warnings);

      if (errors.length > 0) {
        return; // Bail early on first error
      }
    }

    // Mark as fully processed (black)
    path.pop();
    visitState.set(serverName, VisitState.Black);
    installOrder.push(server);
  }

  /**
   * Detect cycles without full resolution (for validation purposes).
   */
  private detectCycles(
    serverName: string,
    registry: Map<string, MCPServerWithDependencies>,
    visitState: Map<string, VisitState>,
    path: string[],
    cycles: string[][]
  ): void {
    const state = visitState.get(serverName) || VisitState.White;

    if (state === VisitState.Black) {
      return;
    }

    if (state === VisitState.Gray) {
      const cycleStart = path.indexOf(serverName);
      cycles.push([...path.slice(cycleStart), serverName]);
      return;
    }

    visitState.set(serverName, VisitState.Gray);
    path.push(serverName);

    const server = registry.get(serverName);
    if (server) {
      for (const dep of server.dependencies) {
        this.detectCycles(dep.name, registry, visitState, path, cycles);
      }
    }

    path.pop();
    visitState.set(serverName, VisitState.Black);
  }

  /**
   * Create a proper Error from a DependencyResolutionError.
   */
  private createError(error: DependencyResolutionError): Error {
    const err = new Error(error.message) as Error & { resolutionError: DependencyResolutionError };
    err.resolutionError = error;
    return err;
  }
}
