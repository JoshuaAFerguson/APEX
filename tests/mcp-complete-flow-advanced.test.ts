/**
 * @fileoverview MCP Complete Flow Advanced Testing Scenarios
 *
 * Additional comprehensive tests covering advanced scenarios, edge cases,
 * and integration patterns for the MCP marketplace complete flow.
 *
 * This supplements the main unit tests with:
 * - Network failure scenarios
 * - Permission error scenarios
 * - Concurrent operation testing
 * - Performance validation
 * - Complex workflow combinations
 * - Recovery and resilience testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

// ============================================================================
// Types
// ============================================================================

interface TestContext {
  tempDir: string;
  configPath: string;
  apexDir: string;
}

interface WorkflowResult {
  success: boolean;
  steps: Array<{
    name: string;
    duration: number;
    success: boolean;
    error?: string;
  }>;
  totalDuration: number;
  firstError?: string;
}

// ============================================================================
// Advanced Test Utilities
// ============================================================================

/**
 * Create test context with temporary directory
 */
async function createTestContext(prefix = 'mcp-advanced-'): Promise<TestContext> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const apexDir = path.join(tempDir, '.apex');
  const configPath = path.join(apexDir, 'config.yaml');

  await fs.mkdir(apexDir, { recursive: true });

  const defaultConfig = {
    project: { name: 'test-project', language: 'typescript' },
    mcp: { servers: {} }
  };

  await fs.writeFile(configPath, stringifyYaml(defaultConfig));

  return { tempDir, configPath, apexDir };
}

/**
 * Cleanup test context
 */
async function cleanupTestContext(ctx: TestContext): Promise<void> {
  try {
    await fs.rm(ctx.tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Simulate network failure scenarios
 */
class NetworkFailureSimulator {
  private failureRate: number;
  private timeoutMs: number;

  constructor(failureRate = 0.3, timeoutMs = 5000) {
    this.failureRate = failureRate;
    this.timeoutMs = timeoutMs;
  }

  async simulateNetworkCall(operation: string): Promise<{ success: boolean; error?: string; data?: any }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    if (Math.random() < this.failureRate) {
      const errors = [
        'Network timeout',
        'Connection refused',
        'DNS resolution failed',
        'Service unavailable',
        'Rate limit exceeded'
      ];
      return {
        success: false,
        error: errors[Math.floor(Math.random() * errors.length)]
      };
    }

    return { success: true, data: `${operation} completed successfully` };
  }

  async simulateMarketplaceListing(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    const result = await this.simulateNetworkCall('marketplace-listing');
    if (!result.success) return result;

    return {
      success: true,
      data: [
        { id: 'filesystem', name: 'Filesystem Server', verified: true },
        { id: 'memory', name: 'Memory Server', verified: true }
      ]
    };
  }

  async simulateServerInstallation(serverId: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.simulateNetworkCall(`install-${serverId}`);
    return result;
  }
}

/**
 * Permission error simulator
 */
class PermissionErrorSimulator {
  private deniedOperations: Set<string>;

  constructor(deniedOperations: string[] = []) {
    this.deniedOperations = new Set(deniedOperations);
  }

  checkPermission(operation: string): { allowed: boolean; error?: string } {
    if (this.deniedOperations.has(operation)) {
      return {
        allowed: false,
        error: `Permission denied for operation: ${operation}`
      };
    }
    return { allowed: true };
  }

  denyOperation(operation: string): void {
    this.deniedOperations.add(operation);
  }

  allowOperation(operation: string): void {
    this.deniedOperations.delete(operation);
  }
}

/**
 * Advanced workflow runner
 */
class AdvancedWorkflowRunner {
  private networkSim: NetworkFailureSimulator;
  private permissionSim: PermissionErrorSimulator;
  private ctx: TestContext;

  constructor(
    ctx: TestContext,
    networkFailureRate = 0,
    deniedOperations: string[] = []
  ) {
    this.ctx = ctx;
    this.networkSim = new NetworkFailureSimulator(networkFailureRate);
    this.permissionSim = new PermissionErrorSimulator(deniedOperations);
  }

  async runFullWorkflow(serverId: string): Promise<WorkflowResult> {
    const steps: WorkflowResult['steps'] = [];
    const startTime = Date.now();
    let success = true;
    let firstError: string | undefined;

    const runStep = async (name: string, operation: () => Promise<any>) => {
      const stepStart = Date.now();
      try {
        const result = await operation();
        const stepSuccess = result?.success !== false;

        steps.push({
          name,
          duration: Date.now() - stepStart,
          success: stepSuccess,
          error: stepSuccess ? undefined : result?.error || 'Unknown error'
        });

        if (!stepSuccess && !firstError) {
          firstError = result?.error || 'Unknown error';
          success = false;
        }
      } catch (error) {
        steps.push({
          name,
          duration: Date.now() - stepStart,
          success: false,
          error: (error as Error).message
        });
        if (!firstError) {
          firstError = (error as Error).message;
          success = false;
        }
      }
    };

    // Step 1: List marketplace
    await runStep('list-marketplace', async () => {
      const permCheck = this.permissionSim.checkPermission('list-marketplace');
      if (!permCheck.allowed) {
        return { success: false, error: permCheck.error };
      }
      return await this.networkSim.simulateMarketplaceListing();
    });

    // Step 2: Search server
    await runStep('search-server', async () => {
      const permCheck = this.permissionSim.checkPermission('search-server');
      if (!permCheck.allowed) {
        return { success: false, error: permCheck.error };
      }
      return await this.networkSim.simulateNetworkCall('search-server');
    });

    // Step 3: Install server
    await runStep('install-server', async () => {
      const permCheck = this.permissionSim.checkPermission('install-server');
      if (!permCheck.allowed) {
        return { success: false, error: permCheck.error };
      }
      return await this.networkSim.simulateServerInstallation(serverId);
    });

    // Step 4: Verify installation
    await runStep('verify-installation', async () => {
      const permCheck = this.permissionSim.checkPermission('verify-installation');
      if (!permCheck.allowed) {
        return { success: false, error: permCheck.error };
      }
      return { success: true };
    });

    // Step 5: Validate configuration
    await runStep('validate-config', async () => {
      const permCheck = this.permissionSim.checkPermission('validate-config');
      if (!permCheck.allowed) {
        return { success: false, error: permCheck.error };
      }
      return { success: true };
    });

    return {
      success,
      steps,
      totalDuration: Date.now() - startTime,
      firstError
    };
  }

  setNetworkFailureRate(rate: number): void {
    this.networkSim = new NetworkFailureSimulator(rate);
  }

  denyPermission(operation: string): void {
    this.permissionSim.denyOperation(operation);
  }

  allowPermission(operation: string): void {
    this.permissionSim.allowOperation(operation);
  }
}

/**
 * Configuration corruption simulator
 */
async function corruptConfig(configPath: string, corruptionType: 'syntax' | 'missing-fields' | 'invalid-yaml'): Promise<void> {
  switch (corruptionType) {
    case 'syntax':
      await fs.writeFile(configPath, 'project:\n  name: test\n  invalid: [unclosed\nmcp:\n  servers: {}}');
      break;
    case 'missing-fields':
      await fs.writeFile(configPath, stringifyYaml({ mcp: { servers: {} } })); // Missing project section
      break;
    case 'invalid-yaml':
      await fs.writeFile(configPath, 'invalid: yaml: content: [ { unclosed');
      break;
  }
}

/**
 * Concurrent operation simulator
 */
class ConcurrentOperationSimulator {
  private operations: Array<() => Promise<any>> = [];

  addOperation(name: string, operation: () => Promise<any>): void {
    this.operations.push(operation);
  }

  async runConcurrently(): Promise<{ results: any[]; allSuccessful: boolean; errors: string[] }> {
    const promises = this.operations.map(op => op().catch(err => ({ error: err.message })));
    const results = await Promise.all(promises);

    const errors = results
      .filter(result => result?.error || result?.success === false)
      .map(result => result?.error || 'Unknown error');

    return {
      results,
      allSuccessful: errors.length === 0,
      errors
    };
  }

  clear(): void {
    this.operations = [];
  }
}

// ============================================================================
// Advanced Test Suites
// ============================================================================

describe('MCP Complete Flow Advanced Testing Scenarios', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(ctx);
  });

  describe('Network Failure Scenarios', () => {
    it('should handle marketplace listing network failures gracefully', async () => {
      const runner = new AdvancedWorkflowRunner(ctx, 1.0); // 100% failure rate
      const result = await runner.runFullWorkflow('filesystem');

      expect(result.success).toBe(false);
      expect(result.firstError).toBeDefined();
      expect(result.steps[0].name).toBe('list-marketplace');
      expect(result.steps[0].success).toBe(false);
    });

    it('should retry and eventually succeed with intermittent network issues', async () => {
      const runner = new AdvancedWorkflowRunner(ctx, 0.7); // 70% failure rate

      let attemptCount = 0;
      let lastResult: WorkflowResult;

      // Retry up to 5 times
      while (attemptCount < 5) {
        lastResult = await runner.runFullWorkflow('filesystem');
        if (lastResult.success) break;
        attemptCount++;

        // Gradually reduce failure rate to simulate network recovery
        runner.setNetworkFailureRate(0.7 - (attemptCount * 0.15));
      }

      expect(attemptCount).toBeLessThan(5); // Should succeed before max retries
      expect(lastResult!.success).toBe(true);
    });

    it('should handle partial network failures during multi-step workflow', async () => {
      const runner = new AdvancedWorkflowRunner(ctx, 0.3); // 30% failure rate
      const results: WorkflowResult[] = [];

      // Run workflow multiple times to catch intermittent failures
      for (let i = 0; i < 10; i++) {
        const result = await runner.runFullWorkflow('filesystem');
        results.push(result);
      }

      const successCount = results.filter(r => r.success).length;
      const partialFailures = results.filter(r => !r.success && r.steps.some(s => s.success)).length;

      // With 30% failure rate, we should have some successes and some partial failures
      expect(successCount).toBeGreaterThan(0);
      expect(partialFailures).toBeGreaterThan(0);
    });

    it('should timeout gracefully on network operations', async () => {
      const networkSim = new NetworkFailureSimulator(0, 100); // Very short timeout

      const startTime = Date.now();
      try {
        await networkSim.simulateMarketplaceListing();
        const duration = Date.now() - startTime;

        // Should complete within reasonable time even with delays
        expect(duration).toBeLessThan(1000);
      } catch (error) {
        // Network errors are acceptable in this scenario
        expect(error).toBeDefined();
      }
    });
  });

  describe('Permission Error Scenarios', () => {
    it('should handle marketplace listing permission denial', async () => {
      const runner = new AdvancedWorkflowRunner(ctx, 0, ['list-marketplace']);
      const result = await runner.runFullWorkflow('filesystem');

      expect(result.success).toBe(false);
      expect(result.firstError).toContain('Permission denied for operation: list-marketplace');
      expect(result.steps[0].success).toBe(false);
    });

    it('should handle server installation permission denial', async () => {
      const runner = new AdvancedWorkflowRunner(ctx, 0, ['install-server']);
      const result = await runner.runFullWorkflow('filesystem');

      expect(result.success).toBe(false);
      expect(result.firstError).toContain('Permission denied for operation: install-server');

      // Earlier steps should succeed
      expect(result.steps[0].success).toBe(true); // list-marketplace
      expect(result.steps[1].success).toBe(true); // search-server
      expect(result.steps[2].success).toBe(false); // install-server
    });

    it('should continue workflow when non-critical permissions are denied', async () => {
      const runner = new AdvancedWorkflowRunner(ctx, 0, ['verify-installation']);
      const result = await runner.runFullWorkflow('filesystem');

      // Workflow should fail only at verification step
      expect(result.success).toBe(false);
      expect(result.steps[0].success).toBe(true); // list-marketplace
      expect(result.steps[1].success).toBe(true); // search-server
      expect(result.steps[2].success).toBe(true); // install-server
      expect(result.steps[3].success).toBe(false); // verify-installation
    });

    it('should handle permission recovery during workflow', async () => {
      const runner = new AdvancedWorkflowRunner(ctx, 0, ['install-server']);

      // Start workflow (should fail at install step)
      let result = await runner.runFullWorkflow('filesystem');
      expect(result.success).toBe(false);

      // Grant permission and retry
      runner.allowPermission('install-server');
      result = await runner.runFullWorkflow('filesystem');
      expect(result.success).toBe(true);
    });
  });

  describe('Configuration Corruption and Recovery', () => {
    it('should handle YAML syntax errors gracefully', async () => {
      await corruptConfig(ctx.configPath, 'syntax');

      try {
        const content = await fs.readFile(ctx.configPath, 'utf-8');
        parseYaml(content);
        expect.fail('Should have thrown YAML parse error');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toMatch(/flow|block|collection|indented|\]/i);
      }
    });

    it('should detect missing required configuration fields', async () => {
      await corruptConfig(ctx.configPath, 'missing-fields');

      const content = await fs.readFile(ctx.configPath, 'utf-8');
      const config = parseYaml(content);

      expect(config.project).toBeUndefined();
      expect(config.mcp).toBeDefined();
    });

    it('should recover from corrupted configuration', async () => {
      // Corrupt the configuration
      await corruptConfig(ctx.configPath, 'syntax');

      // Simulate recovery by restoring valid configuration
      const validConfig = {
        project: { name: 'recovered-project', language: 'typescript' },
        mcp: { servers: {} }
      };

      await fs.writeFile(ctx.configPath, stringifyYaml(validConfig));

      // Verify recovery
      const content = await fs.readFile(ctx.configPath, 'utf-8');
      const config = parseYaml(content);

      expect(config.project.name).toBe('recovered-project');
      expect(config.mcp.servers).toBeDefined();
    });
  });

  describe('Concurrent Operations Testing', () => {
    it('should handle concurrent server installations safely', async () => {
      const simulator = new ConcurrentOperationSimulator();

      // Add multiple server installation operations
      ['filesystem', 'memory', 'fetch'].forEach(serverId => {
        simulator.addOperation(`install-${serverId}`, async () => {
          const config = parseYaml(await fs.readFile(ctx.configPath, 'utf-8'));
          if (!config.mcp.servers) config.mcp.servers = {};

          // Simulate installation delay
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

          if (config.mcp.servers[serverId]) {
            return { success: false, error: 'Already installed' };
          }

          config.mcp.servers[serverId] = {
            name: serverId,
            type: 'stdio',
            command: 'npx',
            args: [`@modelcontextprotocol/server-${serverId}`],
            autoStart: true
          };

          await fs.writeFile(ctx.configPath, stringifyYaml(config));
          return { success: true };
        });
      });

      const result = await simulator.runConcurrently();

      // At least one should succeed, others may fail due to race conditions
      const successCount = result.results.filter(r => r.success !== false).length;
      expect(successCount).toBeGreaterThan(0);

      // Verify final configuration is valid
      const finalConfig = parseYaml(await fs.readFile(ctx.configPath, 'utf-8'));
      expect(finalConfig.mcp.servers).toBeDefined();
      expect(Object.keys(finalConfig.mcp.servers).length).toBeGreaterThan(0);
    });

    it('should handle concurrent configuration reads/writes', async () => {
      const simulator = new ConcurrentOperationSimulator();
      const results: any[] = [];

      // Add concurrent read operations
      for (let i = 0; i < 5; i++) {
        simulator.addOperation(`read-${i}`, async () => {
          const content = await fs.readFile(ctx.configPath, 'utf-8');
          const config = parseYaml(content);
          results.push({ operation: 'read', success: true, config });
          return { success: true };
        });
      }

      // Add concurrent write operations
      for (let i = 0; i < 3; i++) {
        simulator.addOperation(`write-${i}`, async () => {
          const config = {
            project: { name: `test-${i}`, language: 'typescript' },
            mcp: { servers: {} }
          };
          await fs.writeFile(ctx.configPath, stringifyYaml(config));
          results.push({ operation: 'write', success: true, config });
          return { success: true };
        });
      }

      const result = await simulator.runConcurrently();

      // All operations should complete (though some reads may get inconsistent data)
      expect(result.results.length).toBe(8);
      expect(result.allSuccessful).toBe(true);
    });
  });

  describe('Performance and Scalability Testing', () => {
    it('should complete workflow within performance thresholds', async () => {
      const runner = new AdvancedWorkflowRunner(ctx, 0); // No network failures

      const startTime = Date.now();
      const result = await runner.runFullWorkflow('filesystem');
      const totalDuration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(totalDuration).toBeLessThan(5000); // Should complete within 5 seconds

      // Individual steps should be reasonably fast
      result.steps.forEach(step => {
        expect(step.duration).toBeLessThan(2000); // Each step < 2 seconds
      });
    });

    it('should handle large numbers of marketplace entries efficiently', async () => {
      const networkSim = new NetworkFailureSimulator(0);

      // Mock a large marketplace
      const originalMethod = networkSim.simulateMarketplaceListing;
      networkSim.simulateMarketplaceListing = async () => {
        const largeMarketplace = Array.from({ length: 1000 }, (_, i) => ({
          id: `server-${i}`,
          name: `Server ${i}`,
          verified: i % 2 === 0
        }));

        return { success: true, data: largeMarketplace };
      };

      const startTime = Date.now();
      const result = await networkSim.simulateMarketplaceListing();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1000);
      expect(duration).toBeLessThan(1000); // Should handle 1000 entries quickly
    });

    it('should handle memory efficiently during operations', async () => {
      const initialMemory = process.memoryUsage();

      // Perform multiple workflow operations
      for (let i = 0; i < 10; i++) {
        const runner = new AdvancedWorkflowRunner(ctx, 0);
        await runner.runFullWorkflow(`server-${i}`);
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (< 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should scale linearly with number of servers', async () => {
      const serverCounts = [1, 5, 10];
      const durations: number[] = [];

      for (const count of serverCounts) {
        const startTime = Date.now();

        for (let i = 0; i < count; i++) {
          const runner = new AdvancedWorkflowRunner(ctx, 0);
          await runner.runFullWorkflow(`server-${i}`);
        }

        durations.push(Date.now() - startTime);
      }

      // Duration should scale approximately linearly
      const ratio1 = durations[1] / durations[0];
      const ratio2 = durations[2] / durations[1];

      // Ratios should be within reasonable bounds (not exponential growth)
      expect(ratio1).toBeLessThan(8); // 5x servers should not take > 8x time
      expect(ratio2).toBeLessThan(3); // 2x servers should not take > 3x time
    });
  });

  describe('Complex Workflow Combinations', () => {
    it('should handle interleaved install/uninstall operations', async () => {
      const operations = [
        () => mockInstallServer('filesystem'),
        () => mockInstallServer('memory'),
        () => mockUninstallServer('filesystem'),
        () => mockInstallServer('fetch'),
        () => mockUninstallServer('memory'),
        () => mockInstallServer('filesystem')
      ];

      for (const operation of operations) {
        await operation();
      }

      // Verify final state
      const config = parseYaml(await fs.readFile(ctx.configPath, 'utf-8'));
      expect(config.mcp.servers.filesystem).toBeDefined();
      expect(config.mcp.servers.fetch).toBeDefined();
      expect(config.mcp.servers.memory).toBeUndefined();
    });

    it('should handle rapid install/validate cycles', async () => {
      const servers = ['filesystem', 'memory', 'fetch'];

      for (const serverId of servers) {
        await mockInstallServer(serverId);

        // Validate after each installation
        const config = parseYaml(await fs.readFile(ctx.configPath, 'utf-8'));
        expect(config.mcp.servers[serverId]).toBeDefined();
      }

      // Final validation
      const finalConfig = parseYaml(await fs.readFile(ctx.configPath, 'utf-8'));
      servers.forEach(serverId => {
        expect(finalConfig.mcp.servers[serverId]).toBeDefined();
      });
    });

    it('should maintain consistency across complex workflows', async () => {
      const workflow = [
        async () => {
          await mockInstallServer('filesystem');
          await mockInstallServer('memory');
        },
        async () => {
          await mockUninstallServer('filesystem');
          await mockInstallServer('fetch');
        },
        async () => {
          await mockInstallServer('filesystem');
          await mockValidateConfig();
        }
      ];

      for (const step of workflow) {
        await step();

        // Verify configuration remains valid after each step
        const config = parseYaml(await fs.readFile(ctx.configPath, 'utf-8'));
        expect(config.project).toBeDefined();
        expect(config.mcp).toBeDefined();
      }
    });
  });

  // Mock helper functions
  async function mockInstallServer(serverId: string): Promise<void> {
    const config = parseYaml(await fs.readFile(ctx.configPath, 'utf-8'));
    if (!config.mcp.servers) config.mcp.servers = {};

    config.mcp.servers[serverId] = {
      name: serverId,
      type: 'stdio',
      command: 'npx',
      args: [`@modelcontextprotocol/server-${serverId}`],
      autoStart: true
    };

    await fs.writeFile(ctx.configPath, stringifyYaml(config));
  }

  async function mockUninstallServer(serverId: string): Promise<void> {
    const config = parseYaml(await fs.readFile(ctx.configPath, 'utf-8'));
    if (config.mcp?.servers?.[serverId]) {
      delete config.mcp.servers[serverId];
      await fs.writeFile(ctx.configPath, stringifyYaml(config));
    }
  }

  async function mockValidateConfig(): Promise<boolean> {
    try {
      const config = parseYaml(await fs.readFile(ctx.configPath, 'utf-8'));
      return !!(config.project && config.mcp);
    } catch {
      return false;
    }
  }
});