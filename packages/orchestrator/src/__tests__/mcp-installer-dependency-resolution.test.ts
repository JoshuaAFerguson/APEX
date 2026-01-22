import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import {
  MCPDependencyResolver,
  MCPDependency,
  MCPServerWithDependencies,
  DependencyResolutionResult,
  DependencyResolutionError,
  DependencyWarning,
} from '../mcp-dependency-resolver';
import { MCPInstaller } from '../mcp-installer';
import { TaskStore } from '../store';
import { MCPServer } from '@apexcli/core';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('../store');

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock MCPServer with minimal required fields
 */
function createMockServer(
  name: string,
  version: string = '1.0.0',
  overrides: Partial<MCPServer> = {}
): MCPServer {
  return {
    name,
    package: `@test/${name}`,
    command: 'npx',
    args: [`@test/${name}`],
    version,
    ...overrides,
  };
}

/**
 * Create a mock MCPServerWithDependencies
 */
function createServerWithDeps(
  name: string,
  version: string = '1.0.0',
  dependencies: MCPDependency[] = []
): MCPServerWithDependencies {
  return {
    server: createMockServer(name, version),
    dependencies,
  };
}

/**
 * Create a dependency reference
 */
function dep(name: string, versionRange: string = '*', optional: boolean = false): MCPDependency {
  return { name, versionRange, optional };
}

// ============================================================================
// Tests
// ============================================================================

describe('MCPDependencyResolver', () => {
  let resolver: MCPDependencyResolver;
  let installer: MCPInstaller;
  let mockStore: vi.Mocked<TaskStore>;

  const projectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();

    mockStore = {
      createMcpInstallation: vi.fn(),
      getMcpInstallation: vi.fn(),
      listMcpInstallations: vi.fn(),
      removeMcpInstallation: vi.fn(),
      upsertMcpMarketplaceEntry: vi.fn(),
      listMcpMarketplaceEntries: vi.fn(),
    } as any;

    installer = new MCPInstaller(projectPath, mockStore);
    resolver = new MCPDependencyResolver(installer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. Single Dependency Resolution
  // ==========================================================================

  describe('Single Dependency Resolution', () => {
    it('should resolve a server with no dependencies', () => {
      const server = createServerWithDeps('server-a');
      const registry: MCPServerWithDependencies[] = [server];

      const result = resolver.resolve(server, registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder).toHaveLength(1);
      expect(result.installOrder[0].server.name).toBe('server-a');
      expect(result.warnings).toHaveLength(0);
    });

    it('should resolve a server with a single required dependency', () => {
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      const serverB = createServerWithDeps('server-b', '1.2.0');
      const registry = [serverA, serverB];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder).toHaveLength(2);
      // Dependencies should come before the dependent
      expect(result.installOrder[0].server.name).toBe('server-b');
      expect(result.installOrder[1].server.name).toBe('server-a');
    });

    it('should resolve a server with multiple direct dependencies', () => {
      const serverA = createServerWithDeps('server-a', '1.0.0', [
        dep('server-b', '^1.0.0'),
        dep('server-c', '>=2.0.0'),
      ]);
      const serverB = createServerWithDeps('server-b', '1.5.0');
      const serverC = createServerWithDeps('server-c', '2.1.0');
      const registry = [serverA, serverB, serverC];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder).toHaveLength(3);
      // server-a should be last (it depends on both b and c)
      expect(result.installOrder[result.installOrder.length - 1].server.name).toBe('server-a');
      // Both b and c should appear before a
      const namesBeforeA = result.installOrder.slice(0, -1).map(s => s.server.name);
      expect(namesBeforeA).toContain('server-b');
      expect(namesBeforeA).toContain('server-c');
    });

    it('should resolve with wildcard version range', () => {
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '*')]);
      const serverB = createServerWithDeps('server-b', '3.0.0');
      const registry = [serverA, serverB];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder).toHaveLength(2);
      expect(result.installOrder[0].server.name).toBe('server-b');
    });

    it('should resolve with exact version match', () => {
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '2.0.0')]);
      const serverB = createServerWithDeps('server-b', '2.0.0');
      const registry = [serverA, serverB];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder[0].server.name).toBe('server-b');
      expect(result.installOrder[0].server.version).toBe('2.0.0');
    });

    it('should resolve with tilde version range', () => {
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '~1.2.0')]);
      const serverB = createServerWithDeps('server-b', '1.2.5');
      const registry = [serverA, serverB];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder[0].server.name).toBe('server-b');
      expect(result.installOrder[0].server.version).toBe('1.2.5');
    });

    it('should handle optional dependency that exists', () => {
      const serverA = createServerWithDeps('server-a', '1.0.0', [
        dep('server-b', '^1.0.0', true),
      ]);
      const serverB = createServerWithDeps('server-b', '1.3.0');
      const registry = [serverA, serverB];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder).toHaveLength(2);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle optional dependency that is missing with a warning', () => {
      const serverA = createServerWithDeps('server-a', '1.0.0', [
        dep('server-b', '^1.0.0', true),
      ]);
      const registry = [serverA]; // server-b not in registry

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder).toHaveLength(1);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('optional_missing');
      expect(result.warnings[0].dependency.name).toBe('server-b');
    });

    it('should select the highest compatible version from multiple candidates', () => {
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      const serverB_1_0 = createServerWithDeps('server-b', '1.0.0');
      const serverB_1_5 = createServerWithDeps('server-b', '1.5.0');
      const serverB_1_9 = createServerWithDeps('server-b', '1.9.0');
      const serverB_2_0 = createServerWithDeps('server-b', '2.0.0');
      const registry = [serverA, serverB_1_0, serverB_1_5, serverB_1_9, serverB_2_0];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      // Should pick 1.9.0 (highest that satisfies ^1.0.0, not 2.0.0)
      expect(result.installOrder[0].server.version).toBe('1.9.0');
    });
  });

  // ==========================================================================
  // 2. Transitive Dependencies
  // ==========================================================================

  describe('Transitive Dependencies', () => {
    it('should resolve a chain of transitive dependencies (A -> B -> C)', () => {
      const serverC = createServerWithDeps('server-c', '1.0.0');
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-c', '^1.0.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      const registry = [serverA, serverB, serverC];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder).toHaveLength(3);
      // Installation order: C first, then B, then A
      expect(result.installOrder[0].server.name).toBe('server-c');
      expect(result.installOrder[1].server.name).toBe('server-b');
      expect(result.installOrder[2].server.name).toBe('server-a');
    });

    it('should resolve deep transitive chains (A -> B -> C -> D -> E)', () => {
      const serverE = createServerWithDeps('server-e', '1.0.0');
      const serverD = createServerWithDeps('server-d', '1.0.0', [dep('server-e', '^1.0.0')]);
      const serverC = createServerWithDeps('server-c', '1.0.0', [dep('server-d', '^1.0.0')]);
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-c', '^1.0.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      const registry = [serverA, serverB, serverC, serverD, serverE];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder).toHaveLength(5);
      // Should be in reverse dependency order
      expect(result.installOrder[0].server.name).toBe('server-e');
      expect(result.installOrder[1].server.name).toBe('server-d');
      expect(result.installOrder[2].server.name).toBe('server-c');
      expect(result.installOrder[3].server.name).toBe('server-b');
      expect(result.installOrder[4].server.name).toBe('server-a');
    });

    it('should handle diamond dependencies (A -> B, A -> C, B -> D, C -> D)', () => {
      const serverD = createServerWithDeps('server-d', '1.0.0');
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-d', '^1.0.0')]);
      const serverC = createServerWithDeps('server-c', '1.0.0', [dep('server-d', '^1.0.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [
        dep('server-b', '^1.0.0'),
        dep('server-c', '^1.0.0'),
      ]);
      const registry = [serverA, serverB, serverC, serverD];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder).toHaveLength(4);
      // D should be installed first (both B and C depend on it)
      expect(result.installOrder[0].server.name).toBe('server-d');
      // A should be installed last
      expect(result.installOrder[result.installOrder.length - 1].server.name).toBe('server-a');
      // D should only appear once (no duplicates)
      const dCount = result.installOrder.filter(s => s.server.name === 'server-d').length;
      expect(dCount).toBe(1);
    });

    it('should handle shared transitive dependencies without duplication', () => {
      const shared = createServerWithDeps('shared', '2.0.0');
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('shared', '^2.0.0')]);
      const serverC = createServerWithDeps('server-c', '1.0.0', [dep('shared', '^2.0.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [
        dep('server-b', '^1.0.0'),
        dep('server-c', '^1.0.0'),
      ]);
      const registry = [serverA, serverB, serverC, shared];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      // shared should appear exactly once
      const sharedEntries = result.installOrder.filter(s => s.server.name === 'shared');
      expect(sharedEntries).toHaveLength(1);
      // shared should be before both B and C
      const sharedIdx = result.installOrder.findIndex(s => s.server.name === 'shared');
      const bIdx = result.installOrder.findIndex(s => s.server.name === 'server-b');
      const cIdx = result.installOrder.findIndex(s => s.server.name === 'server-c');
      expect(sharedIdx).toBeLessThan(bIdx);
      expect(sharedIdx).toBeLessThan(cIdx);
    });

    it('should resolve transitive dependencies with version constraints', () => {
      const serverC = createServerWithDeps('server-c', '2.5.0');
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-c', '~2.5.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      const registry = [serverA, serverB, serverC];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder[0].server.name).toBe('server-c');
      expect(result.installOrder[0].server.version).toBe('2.5.0');
    });

    it('should use getTransitiveDependencies to get flat dependency list', () => {
      const serverC = createServerWithDeps('server-c', '1.0.0');
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-c', '^1.0.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      const registry = [serverA, serverB, serverC];

      const transitive = resolver.getTransitiveDependencies(serverA, registry);

      // Should not include serverA itself
      expect(transitive).toHaveLength(2);
      expect(transitive.map(s => s.server.name)).toContain('server-b');
      expect(transitive.map(s => s.server.name)).toContain('server-c');
    });

    it('should handle transitive optional dependencies', () => {
      const serverC = createServerWithDeps('server-c', '1.0.0', [
        dep('optional-dep', '^1.0.0', true),
      ]);
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-c', '^1.0.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      const registry = [serverA, serverB, serverC];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder).toHaveLength(3);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('optional_missing');
      expect(result.warnings[0].dependency.name).toBe('optional-dep');
    });
  });

  // ==========================================================================
  // 3. Circular Dependency Detection
  // ==========================================================================

  describe('Circular Dependency Detection', () => {
    it('should detect a direct circular dependency (A -> B -> A)', () => {
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-a', '^1.0.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      const registry = [serverA, serverB];

      expect(() => resolver.resolve(serverA, registry)).toThrow(/[Cc]ircular dependency/);
    });

    it('should detect a self-referencing dependency (A -> A)', () => {
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-a', '^1.0.0')]);
      const registry = [serverA];

      expect(() => resolver.resolve(serverA, registry)).toThrow(/[Cc]ircular dependency/);
    });

    it('should detect indirect circular dependencies (A -> B -> C -> A)', () => {
      const serverC = createServerWithDeps('server-c', '1.0.0', [dep('server-a', '^1.0.0')]);
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-c', '^1.0.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      const registry = [serverA, serverB, serverC];

      expect(() => resolver.resolve(serverA, registry)).toThrow(/[Cc]ircular dependency/);
    });

    it('should detect deeply nested circular dependencies (A -> B -> C -> D -> B)', () => {
      const serverD = createServerWithDeps('server-d', '1.0.0', [dep('server-b', '^1.0.0')]);
      const serverC = createServerWithDeps('server-c', '1.0.0', [dep('server-d', '^1.0.0')]);
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-c', '^1.0.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      const registry = [serverA, serverB, serverC, serverD];

      expect(() => resolver.resolve(serverA, registry)).toThrow(/[Cc]ircular dependency/);
    });

    it('should include the cycle path in the error message', () => {
      const serverC = createServerWithDeps('server-c', '1.0.0', [dep('server-a', '^1.0.0')]);
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-c', '^1.0.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      const registry = [serverA, serverB, serverC];

      try {
        resolver.resolve(serverA, registry);
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('server-a');
        expect(error.resolutionError.type).toBe('circular');
        expect(error.resolutionError.details).toContain('server-a');
      }
    });

    it('should detect circular dependencies using detectCircularDependencies', () => {
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-a', '^1.0.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      const servers = [serverA, serverB];

      const cycles = resolver.detectCircularDependencies(servers);

      expect(cycles.length).toBeGreaterThan(0);
      // At least one cycle should contain both server-a and server-b
      const hasCycle = cycles.some(
        cycle => cycle.includes('server-a') && cycle.includes('server-b')
      );
      expect(hasCycle).toBe(true);
    });

    it('should return empty array when no circular dependencies exist', () => {
      const serverC = createServerWithDeps('server-c', '1.0.0');
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-c', '^1.0.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      const servers = [serverA, serverB, serverC];

      const cycles = resolver.detectCircularDependencies(servers);

      expect(cycles).toHaveLength(0);
    });

    it('should handle multiple independent cycles in the same graph', () => {
      // Cycle 1: A -> B -> A
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-a', '^1.0.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      // Cycle 2: C -> D -> C
      const serverD = createServerWithDeps('server-d', '1.0.0', [dep('server-c', '^1.0.0')]);
      const serverC = createServerWithDeps('server-c', '1.0.0', [dep('server-d', '^1.0.0')]);
      const servers = [serverA, serverB, serverC, serverD];

      const cycles = resolver.detectCircularDependencies(servers);

      expect(cycles.length).toBeGreaterThanOrEqual(1);
    });

    it('should not report false circular dependencies in diamond graphs', () => {
      // Diamond: A -> B, A -> C, B -> D, C -> D (no cycle!)
      const serverD = createServerWithDeps('server-d', '1.0.0');
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-d', '^1.0.0')]);
      const serverC = createServerWithDeps('server-c', '1.0.0', [dep('server-d', '^1.0.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [
        dep('server-b', '^1.0.0'),
        dep('server-c', '^1.0.0'),
      ]);
      const servers = [serverA, serverB, serverC, serverD];

      const cycles = resolver.detectCircularDependencies(servers);

      expect(cycles).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 4. Missing Dependency Handling
  // ==========================================================================

  describe('Missing Dependency Handling', () => {
    it('should throw an error for a missing required dependency', () => {
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('missing-server', '^1.0.0')]);
      const registry = [serverA];

      expect(() => resolver.resolve(serverA, registry)).toThrow(/missing-server.*not found/i);
    });

    it('should include the missing dependency name in the error', () => {
      const serverA = createServerWithDeps('server-a', '1.0.0', [
        dep('nonexistent-pkg', '>=2.0.0'),
      ]);
      const registry = [serverA];

      try {
        resolver.resolve(serverA, registry);
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('nonexistent-pkg');
        expect(error.resolutionError.type).toBe('missing');
        expect(error.resolutionError.dependency.name).toBe('nonexistent-pkg');
      }
    });

    it('should generate a warning for a missing optional dependency', () => {
      const serverA = createServerWithDeps('server-a', '1.0.0', [
        dep('optional-missing', '^1.0.0', true),
      ]);
      const registry = [serverA];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder).toHaveLength(1);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('optional_missing');
      expect(result.warnings[0].dependency.name).toBe('optional-missing');
    });

    it('should handle mixed required and optional missing dependencies', () => {
      const serverA = createServerWithDeps('server-a', '1.0.0', [
        dep('required-dep', '^1.0.0', false),
        dep('optional-dep', '^1.0.0', true),
      ]);
      const registry = [serverA];

      // Should throw because of the required missing dep
      expect(() => resolver.resolve(serverA, registry)).toThrow(/required-dep.*not found/i);
    });

    it('should handle multiple missing required dependencies', () => {
      const serverA = createServerWithDeps('server-a', '1.0.0', [
        dep('missing-1', '^1.0.0'),
        dep('missing-2', '^2.0.0'),
      ]);
      const registry = [serverA];

      expect(() => resolver.resolve(serverA, registry)).toThrow(/not found/i);
    });

    it('should handle missing transitive dependency', () => {
      const serverB = createServerWithDeps('server-b', '1.0.0', [
        dep('missing-transitive', '^1.0.0'),
      ]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      const registry = [serverA, serverB];

      expect(() => resolver.resolve(serverA, registry)).toThrow(/missing-transitive.*not found/i);
    });

    it('should handle missing optional transitive dependency with warning', () => {
      const serverB = createServerWithDeps('server-b', '1.0.0', [
        dep('optional-transitive', '^1.0.0', true),
      ]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      const registry = [serverA, serverB];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder).toHaveLength(2);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].dependency.name).toBe('optional-transitive');
    });

    it('should succeed when all required dependencies are present', () => {
      const serverB = createServerWithDeps('server-b', '1.0.0');
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      const registry = [serverA, serverB];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 5. Version Conflict Resolution
  // ==========================================================================

  describe('Version Conflict Resolution', () => {
    it('should resolve when two dependents require compatible versions', () => {
      // B requires C ^1.0.0, D requires C ^1.2.0
      // C 1.5.0 satisfies both
      const serverC = createServerWithDeps('server-c', '1.5.0');
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-c', '^1.0.0')]);
      const serverD = createServerWithDeps('server-d', '1.0.0', [dep('server-c', '^1.2.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [
        dep('server-b', '^1.0.0'),
        dep('server-d', '^1.0.0'),
      ]);
      const registry = [serverA, serverB, serverC, serverD];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      const cEntry = result.installOrder.find(s => s.server.name === 'server-c');
      expect(cEntry).toBeDefined();
      expect(cEntry!.server.version).toBe('1.5.0');
    });

    it('should select the highest version satisfying all constraints', () => {
      // Two versions of C: 1.3.0 and 1.8.0
      // B requires ^1.0.0 (both satisfy)
      // D requires ^1.5.0 (only 1.8.0 satisfies)
      const serverC_1_3 = createServerWithDeps('server-c', '1.3.0');
      const serverC_1_8 = createServerWithDeps('server-c', '1.8.0');
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-c', '^1.0.0')]);
      const serverD = createServerWithDeps('server-d', '1.0.0', [dep('server-c', '^1.5.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [
        dep('server-b', '^1.0.0'),
        dep('server-d', '^1.0.0'),
      ]);
      const registry = [serverA, serverB, serverC_1_3, serverC_1_8, serverD];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      const cEntry = result.installOrder.find(s => s.server.name === 'server-c');
      expect(cEntry!.server.version).toBe('1.8.0');
    });

    it('should throw when version requirements are incompatible', () => {
      // B requires C ^1.0.0, D requires C ^2.0.0
      // Only C 1.5.0 available - can't satisfy ^2.0.0
      const serverC = createServerWithDeps('server-c', '1.5.0');
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-c', '^1.0.0')]);
      const serverD = createServerWithDeps('server-d', '1.0.0', [dep('server-c', '^2.0.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [
        dep('server-b', '^1.0.0'),
        dep('server-d', '^1.0.0'),
      ]);
      const registry = [serverA, serverB, serverC, serverD];

      expect(() => resolver.resolve(serverA, registry)).toThrow(/[Nn]o version.*satisfies|version.*conflict/i);
    });

    it('should throw when incompatible major versions are required', () => {
      // B requires C ^1.0.0, D requires C ^2.0.0
      // Both C 1.5.0 and C 2.3.0 are available, but no single version satisfies both
      const serverC_1_5 = createServerWithDeps('server-c', '1.5.0');
      const serverC_2_3 = createServerWithDeps('server-c', '2.3.0');
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-c', '^1.0.0')]);
      const serverD = createServerWithDeps('server-d', '1.0.0', [dep('server-c', '^2.0.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [
        dep('server-b', '^1.0.0'),
        dep('server-d', '^1.0.0'),
      ]);
      const registry = [serverA, serverB, serverC_1_5, serverC_2_3, serverD];

      expect(() => resolver.resolve(serverA, registry)).toThrow(/[Nn]o version.*satisfies|version.*conflict/i);
    });

    it('should resolve version conflict with prerelease versions', () => {
      const serverC_1_0_alpha = createServerWithDeps('server-c', '1.0.0-alpha');
      const serverC_1_0_0 = createServerWithDeps('server-c', '1.0.0');
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-c', '^1.0.0')]);
      const registry = [serverA, serverC_1_0_alpha, serverC_1_0_0];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      // Should prefer the stable release over prerelease
      const cEntry = result.installOrder.find(s => s.server.name === 'server-c');
      expect(cEntry!.server.version).toBe('1.0.0');
    });

    it('should handle version conflict with exact version requirements', () => {
      // B requires C exactly 1.2.3, D requires C exactly 1.2.4
      // These are incompatible
      const serverC_1_2_3 = createServerWithDeps('server-c', '1.2.3');
      const serverC_1_2_4 = createServerWithDeps('server-c', '1.2.4');
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-c', '1.2.3')]);
      const serverD = createServerWithDeps('server-d', '1.0.0', [dep('server-c', '1.2.4')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [
        dep('server-b', '^1.0.0'),
        dep('server-d', '^1.0.0'),
      ]);
      const registry = [serverA, serverB, serverC_1_2_3, serverC_1_2_4, serverD];

      expect(() => resolver.resolve(serverA, registry)).toThrow(/[Nn]o version.*satisfies|version.*conflict/i);
    });

    it('should resolve when all dependents require compatible ranges', () => {
      // B requires ^1.2.0, C requires ~1.2.3, D requires >=1.2.3
      // Version 1.2.5 satisfies all
      const shared = createServerWithDeps('shared', '1.2.5');
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('shared', '^1.2.0')]);
      const serverC = createServerWithDeps('server-c', '1.0.0', [dep('shared', '~1.2.3')]);
      const serverD = createServerWithDeps('server-d', '1.0.0', [dep('shared', '>=1.2.3')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [
        dep('server-b', '^1.0.0'),
        dep('server-c', '^1.0.0'),
        dep('server-d', '^1.0.0'),
      ]);
      const registry = [serverA, serverB, serverC, serverD, shared];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      const sharedEntry = result.installOrder.find(s => s.server.name === 'shared');
      expect(sharedEntry!.server.version).toBe('1.2.5');
    });

    it('should include version conflict details in the error', () => {
      const serverC = createServerWithDeps('server-c', '1.5.0');
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-c', '^1.0.0')]);
      const serverD = createServerWithDeps('server-d', '1.0.0', [dep('server-c', '^2.0.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [
        dep('server-b', '^1.0.0'),
        dep('server-d', '^1.0.0'),
      ]);
      const registry = [serverA, serverB, serverC, serverD];

      try {
        resolver.resolve(serverA, registry);
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.resolutionError).toBeDefined();
        expect(error.resolutionError.type).toBe('version_conflict');
        expect(error.resolutionError.details.length).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // 6. Edge Cases and Integration
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle a server with an empty dependencies array', () => {
      const server = createServerWithDeps('standalone', '1.0.0', []);
      const registry = [server];

      const result = resolver.resolve(server, registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder).toHaveLength(1);
    });

    it('should handle resolving the same server multiple times', () => {
      const serverB = createServerWithDeps('server-b', '1.0.0');
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      const registry = [serverA, serverB];

      // Resolve twice - should give same result
      const result1 = resolver.resolve(serverA, registry);
      const result2 = resolver.resolve(serverA, registry);

      expect(result1.installOrder.map(s => s.server.name)).toEqual(
        result2.installOrder.map(s => s.server.name)
      );
    });

    it('should handle a large dependency graph (10+ servers)', () => {
      const servers: MCPServerWithDependencies[] = [];

      // Create a chain of 15 servers: s0 -> s1 -> s2 -> ... -> s14
      for (let i = 14; i >= 0; i--) {
        const deps = i < 14 ? [dep(`server-${i + 1}`, '^1.0.0')] : [];
        servers.push(createServerWithDeps(`server-${i}`, '1.0.0', deps));
      }

      const result = resolver.resolve(servers[servers.length - 1], servers);

      expect(result.resolved).toBe(true);
      expect(result.installOrder).toHaveLength(15);
      // First in install order should be the leaf (server-14)
      expect(result.installOrder[0].server.name).toBe('server-14');
      // Last should be the root (server-0)
      expect(result.installOrder[14].server.name).toBe('server-0');
    });

    it('should handle resolveMultiple with independent servers', () => {
      const serverB = createServerWithDeps('server-b', '1.0.0');
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      const serverD = createServerWithDeps('server-d', '1.0.0');
      const serverC = createServerWithDeps('server-c', '1.0.0', [dep('server-d', '^1.0.0')]);
      const registry = [serverA, serverB, serverC, serverD];

      const result = resolver.resolveMultiple([serverA, serverC], registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder).toHaveLength(4);
      // B before A, D before C
      const bIdx = result.installOrder.findIndex(s => s.server.name === 'server-b');
      const aIdx = result.installOrder.findIndex(s => s.server.name === 'server-a');
      const dIdx = result.installOrder.findIndex(s => s.server.name === 'server-d');
      const cIdx = result.installOrder.findIndex(s => s.server.name === 'server-c');
      expect(bIdx).toBeLessThan(aIdx);
      expect(dIdx).toBeLessThan(cIdx);
    });

    it('should handle resolveMultiple with shared dependencies', () => {
      const shared = createServerWithDeps('shared', '1.0.0');
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('shared', '^1.0.0')]);
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('shared', '^1.0.0')]);
      const registry = [serverA, serverB, shared];

      const result = resolver.resolveMultiple([serverA, serverB], registry);

      expect(result.resolved).toBe(true);
      // shared should only appear once
      const sharedCount = result.installOrder.filter(s => s.server.name === 'shared').length;
      expect(sharedCount).toBe(1);
    });

    it('should handle server not in registry (target added automatically)', () => {
      const serverB = createServerWithDeps('server-b', '1.0.0');
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      // Note: serverA is NOT in the registry, only serverB
      const registry = [serverB];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder).toHaveLength(2);
    });

    it('should handle latest version range in dependency', () => {
      const serverB = createServerWithDeps('server-b', '5.0.0');
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', 'latest')]);
      const registry = [serverA, serverB];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder).toHaveLength(2);
    });

    it('should handle complex real-world scenario', () => {
      // Simulate: full-stack-dev -> code-analysis -> filesystem, git
      //                           -> testing -> filesystem
      //                           -> deployment -> git
      const filesystem = createServerWithDeps('filesystem', '2.0.0');
      const git = createServerWithDeps('git', '1.5.0');
      const codeAnalysis = createServerWithDeps('code-analysis', '1.0.0', [
        dep('filesystem', '^2.0.0'),
        dep('git', '^1.0.0'),
      ]);
      const testing = createServerWithDeps('testing', '1.0.0', [
        dep('filesystem', '^2.0.0'),
      ]);
      const deployment = createServerWithDeps('deployment', '1.0.0', [
        dep('git', '^1.0.0'),
      ]);
      const fullStackDev = createServerWithDeps('full-stack-dev', '1.0.0', [
        dep('code-analysis', '^1.0.0'),
        dep('testing', '^1.0.0'),
        dep('deployment', '^1.0.0'),
      ]);
      const registry = [fullStackDev, codeAnalysis, testing, deployment, filesystem, git];

      const result = resolver.resolve(fullStackDev, registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder).toHaveLength(6);
      // filesystem and git should be first (leaf nodes)
      const fsIdx = result.installOrder.findIndex(s => s.server.name === 'filesystem');
      const gitIdx = result.installOrder.findIndex(s => s.server.name === 'git');
      const caIdx = result.installOrder.findIndex(s => s.server.name === 'code-analysis');
      const testIdx = result.installOrder.findIndex(s => s.server.name === 'testing');
      const deployIdx = result.installOrder.findIndex(s => s.server.name === 'deployment');
      const fullIdx = result.installOrder.findIndex(s => s.server.name === 'full-stack-dev');

      // Leaf nodes before their dependents
      expect(fsIdx).toBeLessThan(caIdx);
      expect(fsIdx).toBeLessThan(testIdx);
      expect(gitIdx).toBeLessThan(caIdx);
      expect(gitIdx).toBeLessThan(deployIdx);
      // full-stack-dev should be last
      expect(fullIdx).toBe(result.installOrder.length - 1);
    });

    it('should handle prerelease dependency versions', () => {
      const serverB = createServerWithDeps('server-b', '2.0.0-beta.1');
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '*')]);
      const registry = [serverA, serverB];

      const result = resolver.resolve(serverA, registry);

      expect(result.resolved).toBe(true);
      expect(result.installOrder[0].server.version).toBe('2.0.0-beta.1');
    });

    it('should maintain consistent ordering across multiple resolutions', () => {
      const serverC = createServerWithDeps('server-c', '1.0.0');
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-c', '^1.0.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [
        dep('server-b', '^1.0.0'),
        dep('server-c', '^1.0.0'),
      ]);
      const registry = [serverA, serverB, serverC];

      // Run resolution multiple times
      const results = Array.from({ length: 5 }, () => resolver.resolve(serverA, registry));

      // All results should have the same ordering
      const firstOrder = results[0].installOrder.map(s => s.server.name);
      for (const result of results) {
        expect(result.installOrder.map(s => s.server.name)).toEqual(firstOrder);
      }
    });
  });

  // ==========================================================================
  // 7. Error Type Validation
  // ==========================================================================

  describe('Error Type Validation', () => {
    it('should attach resolutionError with type "circular" for cycles', () => {
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-a', '^1.0.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('server-b', '^1.0.0')]);
      const registry = [serverA, serverB];

      try {
        resolver.resolve(serverA, registry);
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.resolutionError).toBeDefined();
        expect(error.resolutionError.type).toBe('circular');
      }
    });

    it('should attach resolutionError with type "missing" for missing deps', () => {
      const serverA = createServerWithDeps('server-a', '1.0.0', [dep('missing', '^1.0.0')]);
      const registry = [serverA];

      try {
        resolver.resolve(serverA, registry);
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.resolutionError).toBeDefined();
        expect(error.resolutionError.type).toBe('missing');
        expect(error.resolutionError.dependency.name).toBe('missing');
      }
    });

    it('should attach resolutionError with type "version_conflict" for conflicts', () => {
      const serverC = createServerWithDeps('server-c', '1.5.0');
      const serverB = createServerWithDeps('server-b', '1.0.0', [dep('server-c', '^1.0.0')]);
      const serverD = createServerWithDeps('server-d', '1.0.0', [dep('server-c', '^2.0.0')]);
      const serverA = createServerWithDeps('server-a', '1.0.0', [
        dep('server-b', '^1.0.0'),
        dep('server-d', '^1.0.0'),
      ]);
      const registry = [serverA, serverB, serverC, serverD];

      try {
        resolver.resolve(serverA, registry);
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.resolutionError).toBeDefined();
        expect(error.resolutionError.type).toBe('version_conflict');
      }
    });

    it('should provide meaningful error messages with dependency details', () => {
      const serverA = createServerWithDeps('server-a', '1.0.0', [
        dep('missing-dep', '>=3.0.0'),
      ]);
      const registry = [serverA];

      try {
        resolver.resolve(serverA, registry);
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toBeTruthy();
        expect(error.message.length).toBeGreaterThan(10);
        expect(error.resolutionError.details).toBeInstanceOf(Array);
      }
    });
  });
});
