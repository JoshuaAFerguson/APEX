/**
 * Basic tests for tri-system integration test utilities
 */

import { describe, it, expect } from 'vitest';
import {
  createTriSystemTestEnvironment,
  createMockTriSystemTask,
  createPermissionDeniedScenario,
  assertTriSystemReady
} from './test-utils.js';

describe('Tri-System Integration Test Utilities', () => {
  describe('Environment Creation', () => {
    it('should create a tri-system test environment with default options', async () => {
      const env = await createTriSystemTestEnvironment();

      try {
        // Verify all systems are initialized
        assertTriSystemReady(env);

        expect(env.testDir).toBeDefined();
        expect(env.orchestrator).toBeDefined();
        expect(env.taskStore).toBeDefined();
        expect(env.eventEmitter).toBeDefined();
        expect(env.toolSystem).toBeDefined();
        expect(env.permissionSystem).toBeDefined();
        expect(env.browserSystem).toBeDefined();
        expect(env.systemEvents).toBeDefined();
        expect(typeof env.cleanup).toBe('function');
      } finally {
        await env.cleanup();
      }
    }, 30000);

    it('should create permission denied scenario', async () => {
      const env = await createPermissionDeniedScenario({
        deniedTools: ['Browser', 'Write'],
        blockedDomains: ['malicious.com']
      });

      try {
        expect(env).toBeDefined();
        expect(env.permissionSystem.config.deniedOperations).toContain('Browser');
        expect(env.permissionSystem.config.blockedDomains).toContain('malicious.com');
      } finally {
        await env.cleanup();
      }
    }, 15000);
  });

  describe('Mock Factories', () => {
    it('should create mock tri-system task', () => {
      const task = createMockTriSystemTask({
        description: 'Custom test task',
        autonomy: 'full'
      });

      expect(task).toBeDefined();
      expect(task.description).toBe('Custom test task');
      expect(task.autonomy).toBe('full');
      expect(task.workflow).toBe('tri-system-test');
    });
  });

  describe('Event Capture', () => {
    it('should capture events from all three systems', async () => {
      const env = await createTriSystemTestEnvironment({
        eventConfig: {
          captureAll: true,
          enableCorrelation: true
        }
      });

      try {
        // Start capturing events
        env.systemEvents.start();

        // Trigger some events
        env.eventEmitter.emit('tool:execution:start', { tool: 'Read' });
        env.eventEmitter.emit('permission:requested', { tool: 'Read' });
        env.eventEmitter.emit('browser:operation:start', { operation: 'navigate' });

        // Give events time to be captured
        await new Promise(resolve => setTimeout(resolve, 100));

        const allEvents = env.systemEvents.getAllEvents();
        expect(allEvents.length).toBeGreaterThan(0);

        const toolEvents = env.systemEvents.getEventsBySystem('tool');
        const permissionEvents = env.systemEvents.getEventsBySystem('permission');
        const browserEvents = env.systemEvents.getEventsBySystem('browser');

        expect(toolEvents.length).toBeGreaterThan(0);
        expect(permissionEvents.length).toBeGreaterThan(0);
        expect(browserEvents.length).toBeGreaterThan(0);
      } finally {
        await env.cleanup();
      }
    }, 15000);
  });

  describe('Integration Scenarios', () => {
    it('should handle tool execution with permission check', async () => {
      const env = await createTriSystemTestEnvironment({
        permissionConfig: {
          preset: 'allowAll'
        }
      });

      try {
        // Execute a tool operation
        const result = await env.toolSystem.executor.execute('Read', {
          filePath: '/test/file.txt'
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.metadata).toBeDefined();
        expect(result.metadata?.tool).toBe('Read');
      } finally {
        await env.cleanup();
      }
    }, 15000);
  });
});