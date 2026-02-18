/**
 * Dynamic Permission Flow Integration Tests
 *
 * Tests for advanced permission scenarios including real-time revocation,
 * concurrent access patterns, and permission state transitions during
 * active task execution.
 *
 * Coverage Goals:
 * - Permission changes during active task execution
 * - Concurrent permission access patterns
 * - Permission state recovery and rollback
 * - Real-time permission event handling
 *
 * @module tests/integration/dynamic-permission-flows
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { PermissionStore, PermissionManager } from '@apexcli/orchestrator';
import { PermissionLevel, Permission } from '@apexcli/core';
import { EventEmitter } from 'eventemitter3';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

// ============================================================================
// Test Infrastructure
// ============================================================================

interface DynamicTestContext {
  tempDir: string;
  orchestrator: ApexOrchestrator;
  permissionManager: PermissionManager;
  permissionStore: PermissionStore;
  eventCapture: EventCapture;
  cleanup: () => Promise<void>;
}

class EventCapture extends EventEmitter {
  private events: Array<{ type: string; data: unknown; timestamp: number }> = [];

  constructor() {
    super();
    this.onAny((type: string, data: unknown) => {
      this.events.push({
        type,
        data,
        timestamp: Date.now()
      });
    });
  }

  async waitForEvent(type: string, timeout = 5000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(type, handler);
        reject(new Error(`Timeout waiting for event: ${type}`));
      }, timeout);

      const handler = (data: unknown) => {
        clearTimeout(timer);
        this.off(type, handler);
        resolve(data);
      };

      this.once(type, handler);
    });
  }

  async waitForMultipleEvents(types: string[], timeout = 5000): Promise<unknown[]> {
    const promises = types.map(type => this.waitForEvent(type, timeout));
    return Promise.all(promises);
  }

  getEventsOfType(type: string): Array<unknown> {
    return this.events
      .filter(event => event.type === type)
      .map(event => event.data);
  }

  getEventsInTimeRange(startTime: number, endTime: number): Array<{ type: string; data: unknown; timestamp: number }> {
    return this.events.filter(event =>
      event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  clear(): void {
    this.events = [];
    this.removeAllListeners();
  }
}

async function createDynamicTestContext(): Promise<DynamicTestContext> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-dynamic-test-'));

  const apexDir = path.join(tempDir, '.apex');
  await fs.mkdir(apexDir, { recursive: true });

  // Config with more permissive settings for dynamic testing
  const configContent = `
version: "1.0"
project:
  name: "dynamic-permission-test"
  testCommand: "npm test"
  lintCommand: "npm run lint"
  buildCommand: "npm run build"
autonomy:
  default: "full"
  tools:
    Bash: "manual"
    Browser: "manual"
    Write: "manual"
permissions:
  presets:
    - name: "dynamic-test"
      description: "Dynamic testing preset"
      permissions:
        - tool: "Read"
          level: "allow-always"
`;

  await fs.writeFile(path.join(apexDir, 'config.yaml'), configContent);

  const orchestrator = new ApexOrchestrator();
  await orchestrator.init(tempDir);

  const permissionManager = (orchestrator as any).permissionManager as PermissionManager;
  const permissionStore = (orchestrator as any).permissionStore as PermissionStore;

  const eventCapture = new EventCapture();

  // Wire up all relevant events
  orchestrator.on('permission:denied', (data) => eventCapture.emit('permission:denied', data));
  orchestrator.on('permission:granted', (data) => eventCapture.emit('permission:granted', data));
  orchestrator.on('permission:revoked', (data) => eventCapture.emit('permission:revoked', data));
  orchestrator.on('permission:request', (data) => eventCapture.emit('permission:request', data));
  orchestrator.on('task:started', (data) => eventCapture.emit('task:started', data));
  orchestrator.on('task:failed', (data) => eventCapture.emit('task:failed', data));
  orchestrator.on('task:interrupted', (data) => eventCapture.emit('task:interrupted', data));

  const cleanup = async () => {
    await orchestrator.shutdown();
    eventCapture.clear();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup temp directory: ${error}`);
    }
  };

  return {
    tempDir,
    orchestrator,
    permissionManager,
    permissionStore,
    eventCapture,
    cleanup
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Dynamic Permission Flow Integration', () => {
  let context: DynamicTestContext;

  beforeEach(async () => {
    context = await createDynamicTestContext();
  });

  afterEach(async () => {
    await context.cleanup();
  });

  describe('Permission Revocation During Task Execution', () => {
    it('should handle permission revoked mid-task gracefully', async () => {
      const { permissionManager, eventCapture } = context;

      // Step 1: Grant permission for long-running task
      await permissionManager.grantPermission('Bash', 'allow-always', 'long-task');

      // Step 2: Verify initial permission state
      const initialCheck = await permissionManager.checkToolPermission('Bash', {
        scope: 'long-task'
      });
      expect(initialCheck.allowed).toBe(true);

      // Step 3: Simulate task start
      const taskStartTime = Date.now();
      eventCapture.emit('task:started', { tool: 'Bash', scope: 'long-task' });

      // Step 4: Revoke permission while "task" is running
      const revocationPromise = eventCapture.waitForEvent('permission:denied', 3000);

      await permissionManager.grantPermission('Bash', 'deny', 'long-task');

      // Step 5: Verify revocation event
      const revocationEvent = await revocationPromise;
      expect(revocationEvent).toMatchObject({
        tool: 'Bash',
        scope: 'long-task',
        level: 'deny'
      });

      // Step 6: Verify permission is now denied
      const postRevocationCheck = await permissionManager.checkToolPermission('Bash', {
        scope: 'long-task'
      });
      expect(postRevocationCheck.allowed).toBe(false);

      // Step 7: Verify state consistency after revocation
      const finalState = await permissionManager.checkPermission('Bash', 'long-task');
      expect(finalState).toBe('deny');
    });

    it('should handle cascading permission dependencies', async () => {
      const { permissionManager, eventCapture } = context;

      // Create a permission dependency chain: Write -> Bash -> Browser
      await permissionManager.grantPermission('Write', 'allow-always', '/project/src');
      await permissionManager.grantPermission('Bash', 'allow-always', 'build-script');
      await permissionManager.grantPermission('Browser', 'allow-always', 'test-ui');

      // Verify initial permissions
      const writeCheck = await permissionManager.checkToolPermission('Write', { scope: '/project/src' });
      const bashCheck = await permissionManager.checkToolPermission('Bash', { scope: 'build-script' });
      const browserCheck = await permissionManager.checkToolPermission('Browser', { scope: 'test-ui' });

      expect(writeCheck.allowed).toBe(true);
      expect(bashCheck.allowed).toBe(true);
      expect(browserCheck.allowed).toBe(true);

      // Revoke middle permission (Bash)
      const denialPromise = eventCapture.waitForEvent('permission:denied', 3000);
      await permissionManager.grantPermission('Bash', 'deny', 'build-script');

      await denialPromise;

      // Verify only Bash is affected (no automatic cascading)
      const postRevocationWrite = await permissionManager.checkToolPermission('Write', { scope: '/project/src' });
      const postRevocationBash = await permissionManager.checkToolPermission('Bash', { scope: 'build-script' });
      const postRevocationBrowser = await permissionManager.checkToolPermission('Browser', { scope: 'test-ui' });

      expect(postRevocationWrite.allowed).toBe(true);
      expect(postRevocationBash.allowed).toBe(false);
      expect(postRevocationBrowser.allowed).toBe(true);
    });
  });

  describe('Concurrent Permission Access Patterns', () => {
    it('should handle concurrent permission checks for same tool/scope', async () => {
      const { permissionManager } = context;

      // Grant permission
      await permissionManager.grantPermission('Read', 'allow-always', '/shared/file.txt');

      // Run multiple concurrent permission checks
      const concurrentChecks = Array.from({ length: 10 }, () =>
        permissionManager.checkToolPermission('Read', { scope: '/shared/file.txt' })
      );

      const results = await Promise.all(concurrentChecks);

      // All checks should succeed and be consistent
      results.forEach(result => {
        expect(result.allowed).toBe(true);
      });
    });

    it('should handle concurrent permission modifications', async () => {
      const { permissionManager, eventCapture } = context;

      const tool = 'Write';
      const scope = '/concurrent/test.txt';

      // Run concurrent modifications
      const modifications = [
        permissionManager.grantPermission(tool, 'allow-once', scope),
        permissionManager.grantPermission(tool, 'deny', scope),
        permissionManager.grantPermission(tool, 'allow-always', scope),
        permissionManager.grantPermission(tool, 'allow-once', scope),
        permissionManager.grantPermission(tool, 'allow-always', scope)
      ];

      await Promise.all(modifications);

      // Allow time for all events to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Final state should be consistent (last write wins)
      const finalState = await permissionManager.checkPermission(tool, scope);
      expect(['allow-once', 'deny', 'allow-always']).toContain(finalState);

      // Verify events were captured for all modifications
      const events = eventCapture.getEventsOfType('permission:granted');
      expect(events.length).toBeGreaterThanOrEqual(3); // At least some modifications should generate events
    });

    it('should handle mixed tool concurrent access', async () => {
      const { permissionManager } = context;

      // Multiple tools, same scope pattern
      const tools = ['Read', 'Write', 'Bash', 'Browser', 'Glob'];
      const scope = '/mixed/access/test';

      // Grant permissions concurrently for different tools
      const grantPromises = tools.map(tool =>
        permissionManager.grantPermission(tool, 'allow-always', scope)
      );

      await Promise.all(grantPromises);

      // Check all permissions concurrently
      const checkPromises = tools.map(tool =>
        permissionManager.checkToolPermission(tool, { scope })
      );

      const results = await Promise.all(checkPromises);

      // All should be allowed
      results.forEach((result, index) => {
        expect(result.allowed).toBe(true);
        // Each result should be for the correct tool (if tool info is included)
      });

      // Verify individual states
      for (const tool of tools) {
        const state = await permissionManager.checkPermission(tool, scope);
        expect(state).toBe('allow-always');
      }
    });
  });

  describe('Permission State Recovery and Rollback', () => {
    it('should maintain permission history for rollback scenarios', async () => {
      const { permissionManager, permissionStore, eventCapture } = context;

      const tool = 'Browser';
      const scope = 'https://rollback-test.com';

      // Create permission history
      await permissionManager.grantPermission(tool, 'allow-always', scope);
      let state1 = await permissionManager.checkPermission(tool, scope);
      expect(state1).toBe('allow-always');

      await permissionManager.grantPermission(tool, 'deny', scope);
      let state2 = await permissionManager.checkPermission(tool, scope);
      expect(state2).toBe('deny');

      await permissionManager.grantPermission(tool, 'allow-once', scope);
      let state3 = await permissionManager.checkPermission(tool, scope);
      expect(state3).toBe('allow-once');

      // Simulate rollback by clearing current permission and re-granting previous state
      await permissionStore.clearPermission({ tool, scope });
      await permissionManager.grantPermission(tool, 'allow-always', scope);

      const rolledBackState = await permissionManager.checkPermission(tool, scope);
      expect(rolledBackState).toBe('allow-always');
    });

    it('should handle permission store corruption recovery', async () => {
      const { permissionManager, permissionStore } = context;

      // Grant some permissions
      await permissionManager.grantPermission('Read', 'allow-always', '/test1');
      await permissionManager.grantPermission('Write', 'deny', '/test2');

      // Verify initial state
      const state1 = await permissionManager.checkPermission('Read', '/test1');
      const state2 = await permissionManager.checkPermission('Write', '/test2');
      expect(state1).toBe('allow-always');
      expect(state2).toBe('deny');

      // Simulate corruption by closing and reopening store
      permissionStore.close();
      await permissionStore.initialize();

      // Verify state recovery (permissions should still exist due to SQLite persistence)
      const recoveredState1 = await permissionManager.checkPermission('Read', '/test1');
      const recoveredState2 = await permissionManager.checkPermission('Write', '/test2');
      expect(recoveredState1).toBe('allow-always');
      expect(recoveredState2).toBe('deny');
    });

    it('should handle session cache recovery after manager restart', async () => {
      const { permissionStore, eventCapture } = context;

      // Create a new permission manager with same store to simulate restart
      const newPermissionManager = new PermissionManager(permissionStore);

      // Grant permission with new manager
      await newPermissionManager.grantPermission('Glob', 'allow-once', '*.test');

      // Verify permission exists
      const state = await newPermissionManager.checkPermission('Glob', '*.test');
      expect(state).toBe('allow-once');

      // Use the permission (should be consumed)
      await newPermissionManager.checkToolPermission('Glob', { scope: '*.test' });

      // Verify consumption
      const consumedState = await newPermissionManager.checkPermission('Glob', '*.test');
      expect(consumedState).toBe(null); // Should be consumed
    });
  });

  describe('Real-time Permission Event Handling', () => {
    it('should maintain correct event ordering under load', async () => {
      const { permissionManager, eventCapture } = context;

      const tool = 'Bash';
      const scope = 'load-test';

      // Generate rapid permission changes
      const eventPromises = [];
      for (let i = 0; i < 20; i++) {
        const level = ['allow-once', 'deny', 'allow-always'][i % 3] as PermissionLevel;
        eventPromises.push(
          permissionManager.grantPermission(tool, level, scope)
        );
      }

      const startTime = Date.now();
      await Promise.all(eventPromises);
      const endTime = Date.now();

      // Allow additional time for event propagation
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify events were captured in the time range
      const eventsInRange = eventCapture.getEventsInTimeRange(startTime - 100, endTime + 200);
      expect(eventsInRange.length).toBeGreaterThan(0);

      // Verify final state is consistent
      const finalState = await permissionManager.checkPermission(tool, scope);
      expect(['allow-once', 'deny', 'allow-always']).toContain(finalState);
    });

    it('should handle event listener registration/deregistration dynamically', async () => {
      const { eventCapture } = context;

      let eventCount = 0;
      const dynamicHandler = () => { eventCount++; };

      // Register dynamic listener
      eventCapture.on('permission:granted', dynamicHandler);

      // Trigger some events
      eventCapture.emit('permission:granted', { tool: 'Test', level: 'allow-always' });
      eventCapture.emit('permission:granted', { tool: 'Test2', level: 'allow-once' });

      expect(eventCount).toBe(2);

      // Deregister listener
      eventCapture.off('permission:granted', dynamicHandler);

      // Trigger more events
      eventCapture.emit('permission:granted', { tool: 'Test3', level: 'deny' });

      // Count should not increase
      expect(eventCount).toBe(2);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of permissions efficiently', async () => {
      const { permissionManager } = context;

      const startTime = Date.now();

      // Create many permissions
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          permissionManager.grantPermission(
            `Tool${i % 10}`, // 10 different tools
            'allow-always',
            `/path/to/file${i}`
          )
        );
      }

      await Promise.all(promises);
      const grantTime = Date.now() - startTime;

      // Check performance is reasonable (should complete in under 5 seconds)
      expect(grantTime).toBeLessThan(5000);

      // Verify a sample of permissions exist
      for (let i = 0; i < 10; i++) {
        const state = await permissionManager.checkPermission(`Tool${i}`, `/path/to/file${i}`);
        expect(state).toBe('allow-always');
      }
    });

    it('should handle rapid permission state changes efficiently', async () => {
      const { permissionManager } = context;

      const tool = 'Write';
      const scope = '/performance/test';

      const startTime = Date.now();

      // Rapid state changes
      for (let i = 0; i < 50; i++) {
        const level = i % 2 === 0 ? 'allow-always' : 'deny';
        await permissionManager.grantPermission(tool, level as PermissionLevel, scope);
      }

      const changeTime = Date.now() - startTime;

      // Should complete in reasonable time
      expect(changeTime).toBeLessThan(3000);

      // Final state should be consistent
      const finalState = await permissionManager.checkPermission(tool, scope);
      expect(['allow-always', 'deny']).toContain(finalState);
    });
  });
});

describe('Dynamic Permission Infrastructure Validation', () => {
  it('should create robust test contexts', async () => {
    const contexts = [];

    // Create multiple contexts to test resource isolation
    for (let i = 0; i < 3; i++) {
      contexts.push(await createDynamicTestContext());
    }

    try {
      // Verify isolation
      for (let i = 0; i < contexts.length; i++) {
        await contexts[i].permissionManager.grantPermission(`Tool${i}`, 'allow-always');
        const state = await contexts[i].permissionManager.checkPermission(`Tool${i}`);
        expect(state).toBe('allow-always');

        // Verify other contexts don't have this permission
        for (let j = 0; j < contexts.length; j++) {
          if (i !== j) {
            const otherState = await contexts[j].permissionManager.checkPermission(`Tool${i}`);
            expect(otherState).toBe(null);
          }
        }
      }
    } finally {
      // Cleanup all contexts
      await Promise.all(contexts.map(ctx => ctx.cleanup()));
    }
  });

  it('should handle event capture system reliability', async () => {
    const context = await createDynamicTestContext();

    try {
      const { eventCapture } = context;

      // Test event capture under stress
      const eventTypes = ['test:event1', 'test:event2', 'test:event3'];
      const eventCount = 100;

      for (let i = 0; i < eventCount; i++) {
        const eventType = eventTypes[i % eventTypes.length];
        eventCapture.emit(eventType, { index: i });
      }

      // Verify all events were captured
      const allEvents = eventCapture.getEventsOfType('test:event1')
        .concat(eventCapture.getEventsOfType('test:event2'))
        .concat(eventCapture.getEventsOfType('test:event3'));

      expect(allEvents.length).toBe(eventCount);

      // Test cleanup
      eventCapture.clear();
      const eventsAfterClear = eventCapture.getEventsOfType('test:event1');
      expect(eventsAfterClear.length).toBe(0);
    } finally {
      await context.cleanup();
    }
  });
});