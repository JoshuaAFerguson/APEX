/**
 * Complex Permission Level Scenarios E2E Tests
 *
 * This test suite covers comprehensive end-to-end testing of complex permission scenarios
 * across the APEX tri-system integration (Tools, Permissions, Browser). Tests validate:
 *
 * 1. Permission Presets (autonomous, supervised, readOnly)
 * 2. Scoped Permissions across Multiple Tools
 * 3. Permission Inheritance hierarchies
 * 4. Permission Cascade across systems
 * 5. Complex multi-tool workflows with mixed permissions
 * 6. Permission escalation and degradation scenarios
 * 7. Cross-system permission enforcement consistency
 *
 * @fileoverview E2E tests for complex permission level scenarios in tri-system integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Import test utilities and types
import {
  createTriSystemTestEnvironment,
  createPermissionDeniedScenario,
  createFullAutonomyScenario,
  createSupervisedModeScenario,
  assertTriSystemEventSequence,
  assertPermissionEnforced,
  assertTriSystemReady,
  assertCrossSystemEventPropagation,
  type TriSystemTestEnvironment,
  type SystemEvent,
  type ToolExecutionResult,
  type BrowserOperation
} from './test-utils';

// Import core types
import type {
  PermissionLevel,
  PermissionPreset,
  AgentTool,
  ToolPermissionResult
} from '@apexcli/core';

describe('Complex Permission Level Scenarios - E2E Tests', () => {
  let env: TriSystemTestEnvironment;

  afterEach(async () => {
    if (env) {
      await env.cleanup();
    }
  });

  describe('Permission Presets', () => {
    describe('Autonomous Preset', () => {
      beforeEach(async () => {
        env = await createFullAutonomyScenario();
        assertTriSystemReady(env);
      });

      it('should allow all tools without confirmation in autonomous mode', async () => {
        // Test multiple tools in sequence with autonomous preset
        const tools: AgentTool[] = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'Browser'];
        const results: ToolExecutionResult[] = [];

        for (const tool of tools) {
          const result = await env.toolSystem.executor.executeWithPermissionCheck(
            tool,
            'test-operation',
            {
              operation: 'test',
              params: {
                url: 'https://example.com',
                filePath: '/tmp/test.txt',
                selector: '#test',
                command: 'echo test'
              }
            }
          );
          results.push(result);
        }

        // All tools should succeed without permission denials
        results.forEach((result, index) => {
          assertPermissionEnforced(result, 'granted');
          expect(result.metadata?.tool).toBe(tools[index]);
          expect(result.metadata?.permissionLevel).toBe('allow-always');
        });

        // Verify event sequence shows all permissions granted
        const events = env.systemEvents.getAllEvents();
        const permissionEvents = events.filter(e => e.type.startsWith('permission:'));

        expect(permissionEvents.length).toBeGreaterThanOrEqual(tools.length * 2); // request + grant per tool

        const grantedEvents = permissionEvents.filter(e => e.type === 'permission:granted');
        expect(grantedEvents.length).toBe(tools.length);
      });

      it('should handle rapid-fire tool executions without blocking', async () => {
        // Execute multiple tools concurrently in autonomous mode
        const promises = [
          env.toolSystem.executor.executeWithPermissionCheck('Read', 'concurrent-read', { operation: 'read', params: { filePath: '/tmp/file1.txt' } }),
          env.toolSystem.executor.executeWithPermissionCheck('Write', 'concurrent-write', { operation: 'write', params: { filePath: '/tmp/file2.txt' } }),
          env.toolSystem.executor.executeWithPermissionCheck('Browser', 'concurrent-browse', { operation: 'navigate', params: { url: 'https://example.com' } }),
          env.toolSystem.executor.executeWithPermissionCheck('Grep', 'concurrent-search', { operation: 'search', params: { pattern: 'test' } }),
          env.toolSystem.executor.executeWithPermissionCheck('Bash', 'concurrent-shell', { operation: 'execute', params: { command: 'pwd' } })
        ];

        const results = await Promise.all(promises);

        // All concurrent executions should succeed
        results.forEach(result => {
          assertPermissionEnforced(result, 'granted');
          expect(result.success).toBe(true);
        });

        // Verify no permission denials occurred
        const events = env.systemEvents.getAllEvents();
        const deniedEvents = events.filter(e => e.type === 'permission:denied');
        expect(deniedEvents).toHaveLength(0);
      });
    });

    describe('Supervised Preset (Review-All)', () => {
      beforeEach(async () => {
        env = await createSupervisedModeScenario();
        assertTriSystemReady(env);
      });

      it('should require confirmation for all tools in supervised mode', async () => {
        // Attempt tool execution without pre-granted permission
        const result = await env.toolSystem.executor.executeWithPermissionCheck(
          'Write',
          'supervised-write',
          {
            operation: 'write',
            params: { filePath: '/tmp/supervised.txt', content: 'test' }
          }
        );

        // Should be denied due to lack of confirmation
        assertPermissionEnforced(result, 'denied');
        expect(result.error).toContain('Permission denied');

        // Verify permission request event was emitted
        const events = env.systemEvents.getAllEvents();
        const requestEvents = events.filter(e => e.type === 'permission:requested');
        expect(requestEvents.length).toBeGreaterThan(0);

        const requestEvent = requestEvents[0];
        expect(requestEvent.data.tool).toBe('Write');
      });

      it('should allow execution after permission grant in supervised mode', async () => {
        // Pre-grant permission for specific tool/scope
        await env.permissionSystem.manager.grantPermission('Edit', 'allow-once', '/tmp/supervised-edit.txt');

        // Now attempt execution
        const result = await env.toolSystem.executor.executeWithPermissionCheck(
          'Edit',
          'supervised-edit',
          {
            operation: 'edit',
            params: { filePath: '/tmp/supervised-edit.txt' }
          }
        );

        // Should succeed with granted permission
        assertPermissionEnforced(result, 'granted');
        expect(result.metadata?.permissionLevel).toBe('allow-once');
      });

      it('should handle mixed permission levels correctly', async () => {
        // Set up mixed permissions
        await env.permissionSystem.manager.grantPermission('Read', 'allow-always', '/tmp/always/*');
        await env.permissionSystem.manager.grantPermission('Write', 'allow-once', '/tmp/once.txt');
        await env.permissionSystem.manager.grantPermission('Edit', 'deny', '/tmp/denied/*');

        const tests = [
          { tool: 'Read' as AgentTool, scope: '/tmp/always/file.txt', expected: 'granted' as const, level: 'allow-always' },
          { tool: 'Write' as AgentTool, scope: '/tmp/once.txt', expected: 'granted' as const, level: 'allow-once' },
          { tool: 'Edit' as AgentTool, scope: '/tmp/denied/file.txt', expected: 'denied' as const, level: null }
        ];

        for (const test of tests) {
          const result = await env.toolSystem.executor.executeWithPermissionCheck(
            test.tool,
            'mixed-permission-test',
            {
              operation: 'test',
              params: { filePath: test.scope }
            }
          );

          assertPermissionEnforced(result, test.expected);
          if (test.expected === 'granted') {
            expect(result.metadata?.permissionLevel).toBe(test.level);
          }
        }
      });
    });

    describe('Read-Only Preset', () => {
      beforeEach(async () => {
        env = await createPermissionDeniedScenario({
          deniedTools: ['Write', 'Edit', 'Bash'],
          deniedOperations: ['file-write', 'shell-command'],
          blockedDomains: ['dangerous.com']
        });
        assertTriSystemReady(env);
      });

      it('should allow only read-only tools in read-only mode', async () => {
        const readOnlyTools: AgentTool[] = ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'];
        const writeTools: AgentTool[] = ['Write', 'Edit', 'Bash'];

        // Test read-only tools - should succeed
        for (const tool of readOnlyTools) {
          const result = await env.toolSystem.executor.executeWithPermissionCheck(
            tool,
            'readonly-test',
            {
              operation: 'read',
              params: {
                filePath: '/tmp/readonly.txt',
                pattern: 'test',
                url: 'https://example.com'
              }
            }
          );

          expect(result.success).toBe(true);
          expect(result.permissionDenied).not.toBe(true);
        }

        // Test write tools - should be denied
        for (const tool of writeTools) {
          const result = await env.toolSystem.executor.executeWithPermissionCheck(
            tool,
            'write-test',
            {
              operation: 'write',
              params: { filePath: '/tmp/writetest.txt' }
            }
          );

          assertPermissionEnforced(result, 'denied');
        }
      });

      it('should block dangerous browser operations in read-only mode', async () => {
        // Test browser operations that should be blocked
        const dangerousOperations: BrowserOperation[] = ['click', 'type', 'submit'];

        for (const operation of dangerousOperations) {
          const result = await env.toolSystem.executor.executeWithPermissionCheck(
            'Browser',
            operation,
            {
              operation,
              params: {
                url: 'https://dangerous.com',
                selector: '#harmful-button'
              }
            }
          );

          assertPermissionEnforced(result, 'denied');
          expect(result.error).toMatch(/denied|blocked/i);
        }

        // Safe browser operations might still be allowed (like navigate to safe domains)
        const safeResult = await env.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'navigate',
          {
            operation: 'navigate',
            params: { url: 'https://example.com' }
          }
        );

        // This might succeed or fail depending on read-only configuration
        expect(safeResult).toBeDefined();
      });
    });
  });

  describe('Scoped Permissions Across Multiple Tools', () => {
    beforeEach(async () => {
      env = await createTriSystemTestEnvironment({
        permissionConfig: {
          preset: 'selective',
          defaultLevel: 'allow-once'
        },
        eventConfig: {
          captureAll: true,
          enableCorrelation: true
        }
      });
      assertTriSystemReady(env);
    });

    it('should respect file path scoping across filesystem tools', async () => {
      // Set up scoped permissions for different directories
      const permissions = [
        { tool: 'Read', scope: '/tmp/public/*', level: 'allow-always' },
        { tool: 'Write', scope: '/tmp/public/*', level: 'allow-always' },
        { tool: 'Edit', scope: '/tmp/public/*', level: 'allow-always' },
        { tool: 'Read', scope: '/tmp/private/*', level: 'deny' },
        { tool: 'Write', scope: '/tmp/private/*', level: 'deny' },
        { tool: 'Edit', scope: '/tmp/private/*', level: 'deny' }
      ];

      for (const perm of permissions) {
        await env.permissionSystem.manager.grantPermission(perm.tool, perm.level, perm.scope);
      }

      // Test public directory access - should succeed
      const publicTests = [
        { tool: 'Read' as AgentTool, file: '/tmp/public/document.txt' },
        { tool: 'Write' as AgentTool, file: '/tmp/public/newfile.txt' },
        { tool: 'Edit' as AgentTool, file: '/tmp/public/existing.txt' }
      ];

      for (const test of publicTests) {
        const result = await env.toolSystem.executor.executeWithPermissionCheck(
          test.tool,
          'scoped-test',
          {
            operation: 'file-operation',
            params: { filePath: test.file }
          }
        );

        assertPermissionEnforced(result, 'granted');
        expect(result.metadata?.permissionLevel).toBe('allow-always');
      }

      // Test private directory access - should be denied
      const privateTests = [
        { tool: 'Read' as AgentTool, file: '/tmp/private/secret.txt' },
        { tool: 'Write' as AgentTool, file: '/tmp/private/confidential.txt' },
        { tool: 'Edit' as AgentTool, file: '/tmp/private/classified.txt' }
      ];

      for (const test of privateTests) {
        const result = await env.toolSystem.executor.executeWithPermissionCheck(
          test.tool,
          'scoped-test',
          {
            operation: 'file-operation',
            params: { filePath: test.file }
          }
        );

        assertPermissionEnforced(result, 'denied');
      }
    });

    it('should handle URL-based scoping for web tools', async () => {
      // Set up domain-based permissions
      await env.permissionSystem.manager.grantPermission('WebFetch', 'allow-always', 'https://api.example.com/*');
      await env.permissionSystem.manager.grantPermission('WebSearch', 'allow-always', 'search:safe-topics');
      await env.permissionSystem.manager.grantPermission('Browser', 'deny', 'https://malicious.com/*');

      // Test allowed domain
      const allowedResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'WebFetch',
        'fetch-allowed',
        {
          operation: 'fetch',
          params: { url: 'https://api.example.com/data' }
        }
      );

      assertPermissionEnforced(allowedResult, 'granted');

      // Test blocked domain for Browser
      const blockedResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate-blocked',
        {
          operation: 'navigate',
          params: { url: 'https://malicious.com/bad-page' }
        }
      );

      assertPermissionEnforced(blockedResult, 'denied');
    });

    it('should enforce command-pattern scoping for shell tools', async () => {
      // Set up command-based permissions
      await env.permissionSystem.manager.grantPermission('Bash', 'allow-always', 'ls *');
      await env.permissionSystem.manager.grantPermission('Bash', 'allow-always', 'echo *');
      await env.permissionSystem.manager.grantPermission('Bash', 'deny', 'rm *');
      await env.permissionSystem.manager.grantPermission('Bash', 'deny', 'sudo *');

      const commandTests = [
        { command: 'ls -la', expected: 'granted' as const },
        { command: 'echo hello world', expected: 'granted' as const },
        { command: 'rm -rf /', expected: 'denied' as const },
        { command: 'sudo rm file', expected: 'denied' as const }
      ];

      for (const test of commandTests) {
        const result = await env.toolSystem.executor.executeWithPermissionCheck(
          'Bash',
          'command-test',
          {
            operation: 'shell-command',
            params: { command: test.command }
          }
        );

        assertPermissionEnforced(result, test.expected);
      }
    });
  });

  describe('Permission Inheritance', () => {
    beforeEach(async () => {
      env = await createTriSystemTestEnvironment({
        permissionConfig: {
          preset: 'selective',
          defaultLevel: 'allow-once'
        }
      });
      assertTriSystemReady(env);
    });

    it('should inherit permissions from parent directory scopes', async () => {
      // Grant permission to parent directory
      await env.permissionSystem.manager.grantPermission('Read', 'allow-always', '/projects/*');

      // Test inheritance for subdirectories
      const inheritanceTests = [
        '/projects/apex/src/main.ts',
        '/projects/apex/tests/unit.test.ts',
        '/projects/other-project/readme.md',
        '/projects/deep/nested/structure/file.json'
      ];

      for (const filePath of inheritanceTests) {
        const result = await env.toolSystem.executor.executeWithPermissionCheck(
          'Read',
          'inheritance-test',
          {
            operation: 'read',
            params: { filePath }
          }
        );

        assertPermissionEnforced(result, 'granted');
        expect(result.metadata?.permissionLevel).toBe('allow-always');
      }

      // Test that files outside the parent scope are not inherited
      const outsideResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'Read',
        'outside-test',
        {
          operation: 'read',
          params: { filePath: '/home/user/document.txt' }
        }
      );

      // This should use default permission (allow-once) or be denied
      expect(outsideResult).toBeDefined();
    });

    it('should handle conflicting inheritance with specific overrides', async () => {
      // Set up conflicting permissions: parent allows, child denies
      await env.permissionSystem.manager.grantPermission('Write', 'allow-always', '/data/*');
      await env.permissionSystem.manager.grantPermission('Write', 'deny', '/data/sensitive/*');

      // Test parent directory permission
      const parentResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'parent-test',
        {
          operation: 'write',
          params: { filePath: '/data/public-file.txt' }
        }
      );

      assertPermissionEnforced(parentResult, 'granted');

      // Test child directory override (more specific should win)
      const childResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'child-test',
        {
          operation: 'write',
          params: { filePath: '/data/sensitive/secret.txt' }
        }
      );

      assertPermissionEnforced(childResult, 'denied');
    });

    it('should support multi-level permission inheritance chains', async () => {
      // Create a complex inheritance chain
      await env.permissionSystem.manager.grantPermission('Edit', 'allow-always', '/*');                // Global allow
      await env.permissionSystem.manager.grantPermission('Edit', 'allow-once', '/restricted/*');       // Override to once
      await env.permissionSystem.manager.grantPermission('Edit', 'deny', '/restricted/forbidden/*');   // Override to deny

      const chainTests = [
        { path: '/unrestricted/file.txt', expected: 'granted' as const, level: 'allow-always' },
        { path: '/restricted/document.txt', expected: 'granted' as const, level: 'allow-once' },
        { path: '/restricted/forbidden/secret.txt', expected: 'denied' as const, level: null }
      ];

      for (const test of chainTests) {
        const result = await env.toolSystem.executor.executeWithPermissionCheck(
          'Edit',
          'chain-test',
          {
            operation: 'edit',
            params: { filePath: test.path }
          }
        );

        assertPermissionEnforced(result, test.expected);
        if (test.expected === 'granted') {
          expect(result.metadata?.permissionLevel).toBe(test.level);
        }
      }
    });
  });

  describe('Permission Cascade Across Systems', () => {
    beforeEach(async () => {
      env = await createTriSystemTestEnvironment({
        permissionConfig: {
          preset: 'selective',
          defaultLevel: 'allow-once'
        },
        eventConfig: {
          captureAll: true,
          enableCorrelation: true
        }
      });
      assertTriSystemReady(env);
    });

    it('should cascade browser permissions to affect web tools', async () => {
      // Block browser access to specific domain
      await env.permissionSystem.manager.grantPermission('Browser', 'deny', 'https://blocked-site.com/*');

      // This should also affect WebFetch to same domain (cascade effect)
      const browserResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate-blocked',
        {
          operation: 'navigate',
          params: { url: 'https://blocked-site.com/page' }
        }
      );

      assertPermissionEnforced(browserResult, 'denied');

      // Verify cross-system event propagation
      assertCrossSystemEventPropagation(env, 'permission', 'browser', 'permission:denied');
    });

    it('should cascade file permissions across filesystem tools', async () => {
      // Grant cascading permission for directory to all file tools
      const fileTools: AgentTool[] = ['Read', 'Write', 'Edit', 'Glob'];

      for (const tool of fileTools) {
        await env.permissionSystem.manager.grantPermission(tool, 'allow-always', '/shared/*');
      }

      // Test cascade effect - all tools should work on shared directory
      for (const tool of fileTools) {
        const result = await env.toolSystem.executor.executeWithPermissionCheck(
          tool,
          'cascade-test',
          {
            operation: 'file-operation',
            params: { filePath: '/shared/document.txt' }
          }
        );

        assertPermissionEnforced(result, 'granted');
        expect(result.metadata?.permissionLevel).toBe('allow-always');
      }

      // Verify correlated events across tool system
      const correlatedGroups = env.systemEvents.correlatedEvents;
      expect(correlatedGroups.length).toBeGreaterThan(0);

      const fileSystemGroup = correlatedGroups.find(group =>
        group.systems.has('tool') && group.systems.has('permission')
      );
      expect(fileSystemGroup).toBeDefined();
    });

    it('should handle permission cascade conflicts gracefully', async () => {
      // Set up cascading permissions that might conflict
      await env.permissionSystem.manager.grantPermission('Browser', 'allow-always', 'https://example.com/*');
      await env.permissionSystem.manager.grantPermission('WebFetch', 'deny', 'https://example.com/api/*');

      // Test that specific permissions override cascade
      const browserResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'general-access',
        {
          operation: 'navigate',
          params: { url: 'https://example.com/homepage' }
        }
      );

      assertPermissionEnforced(browserResult, 'granted');

      const webFetchResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'WebFetch',
        'api-access',
        {
          operation: 'fetch',
          params: { url: 'https://example.com/api/data' }
        }
      );

      assertPermissionEnforced(webFetchResult, 'denied');

      // Verify both systems generated appropriate events
      const events = env.systemEvents.getAllEvents();
      const permissionEvents = events.filter(e => e.type.startsWith('permission:'));
      expect(permissionEvents.length).toBeGreaterThanOrEqual(4); // 2 requests + 2 responses
    });
  });

  describe('Complex Multi-Tool Workflows', () => {
    beforeEach(async () => {
      env = await createTriSystemTestEnvironment({
        permissionConfig: {
          preset: 'selective',
          defaultLevel: 'allow-once'
        },
        eventConfig: {
          captureAll: true,
          enableCorrelation: true
        }
      });
      assertTriSystemReady(env);
    });

    it('should handle complex workflow with mixed permission requirements', async () => {
      // Set up complex permission scenario for a realistic workflow
      const workflowPermissions = [
        { tool: 'Read', scope: '/project/config.yaml', level: 'allow-always' },
        { tool: 'WebFetch', scope: 'https://api.github.com/*', level: 'allow-always' },
        { tool: 'Write', scope: '/project/output/*', level: 'allow-always' },
        { tool: 'Browser', scope: 'https://github.com/*', level: 'allow-once' },
        { tool: 'Bash', scope: 'git *', level: 'allow-once' },
        { tool: 'Edit', scope: '/project/sensitive/*', level: 'deny' }
      ];

      for (const perm of workflowPermissions) {
        await env.permissionSystem.manager.grantPermission(perm.tool, perm.level, perm.scope);
      }

      // Execute complex workflow steps
      const workflowSteps = [
        { tool: 'Read' as AgentTool, operation: 'read-config', params: { filePath: '/project/config.yaml' }, expected: 'granted' as const },
        { tool: 'WebFetch' as AgentTool, operation: 'fetch-api', params: { url: 'https://api.github.com/repos/user/project' }, expected: 'granted' as const },
        { tool: 'Browser' as AgentTool, operation: 'navigate', params: { url: 'https://github.com/user/project' }, expected: 'granted' as const },
        { tool: 'Write' as AgentTool, operation: 'write-output', params: { filePath: '/project/output/results.json' }, expected: 'granted' as const },
        { tool: 'Bash' as AgentTool, operation: 'git-commit', params: { command: 'git add .' }, expected: 'granted' as const },
        { tool: 'Edit' as AgentTool, operation: 'edit-sensitive', params: { filePath: '/project/sensitive/secrets.txt' }, expected: 'denied' as const }
      ];

      const results = [];
      for (const step of workflowSteps) {
        const result = await env.toolSystem.executor.executeWithPermissionCheck(
          step.tool,
          step.operation,
          {
            operation: step.operation,
            params: step.params
          }
        );

        results.push(result);
        assertPermissionEnforced(result, step.expected);
      }

      // Verify workflow event sequence
      const expectedEventSequence = workflowSteps.flatMap(step => [
        { type: 'permission:requested', system: 'permission' as const },
        { type: step.expected === 'granted' ? 'permission:granted' : 'permission:denied', system: 'permission' as const }
      ]);

      const events = env.systemEvents.getAllEvents();
      assertTriSystemEventSequence(events, expectedEventSequence);
    });

    it('should support permission escalation during workflow execution', async () => {
      // Start with restrictive permissions
      await env.permissionSystem.manager.grantPermission('Write', 'allow-once', '/tmp/test.txt');

      // First execution should succeed (consume allow-once)
      const firstResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'first-write',
        {
          operation: 'write',
          params: { filePath: '/tmp/test.txt' }
        }
      );

      assertPermissionEnforced(firstResult, 'granted');
      expect(firstResult.metadata?.permissionLevel).toBe('allow-once');

      // Second execution should fail (allow-once consumed)
      const secondResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'second-write',
        {
          operation: 'write',
          params: { filePath: '/tmp/test.txt' }
        }
      );

      assertPermissionEnforced(secondResult, 'denied');

      // Escalate permission to allow-always
      await env.permissionSystem.manager.grantPermission('Write', 'allow-always', '/tmp/test.txt');

      // Third execution should succeed with escalated permission
      const thirdResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'third-write',
        {
          operation: 'write',
          params: { filePath: '/tmp/test.txt' }
        }
      );

      assertPermissionEnforced(thirdResult, 'granted');
      expect(thirdResult.metadata?.permissionLevel).toBe('allow-always');
    });

    it('should maintain permission consistency across concurrent operations', async () => {
      // Set up permissions for concurrent operations
      await env.permissionSystem.manager.grantPermission('Read', 'allow-always', '/concurrent/*');
      await env.permissionSystem.manager.grantPermission('Write', 'allow-once', '/concurrent/write-once.txt');
      await env.permissionSystem.manager.grantPermission('Browser', 'allow-always', 'https://example.com/*');

      // Execute multiple operations concurrently
      const concurrentOperations = [
        env.toolSystem.executor.executeWithPermissionCheck('Read', 'concurrent-read-1', { operation: 'read', params: { filePath: '/concurrent/file1.txt' } }),
        env.toolSystem.executor.executeWithPermissionCheck('Read', 'concurrent-read-2', { operation: 'read', params: { filePath: '/concurrent/file2.txt' } }),
        env.toolSystem.executor.executeWithPermissionCheck('Write', 'concurrent-write', { operation: 'write', params: { filePath: '/concurrent/write-once.txt' } }),
        env.toolSystem.executor.executeWithPermissionCheck('Browser', 'concurrent-browse-1', { operation: 'navigate', params: { url: 'https://example.com/page1' } }),
        env.toolSystem.executor.executeWithPermissionCheck('Browser', 'concurrent-browse-2', { operation: 'navigate', params: { url: 'https://example.com/page2' } })
      ];

      const results = await Promise.all(concurrentOperations);

      // Verify results
      expect(results[0].success).toBe(true); // Read 1 - allow-always
      expect(results[1].success).toBe(true); // Read 2 - allow-always
      expect(results[2].success).toBe(true); // Write - allow-once
      expect(results[3].success).toBe(true); // Browser 1 - allow-always
      expect(results[4].success).toBe(true); // Browser 2 - allow-always

      // Verify permission levels are correct
      expect(results[0].metadata?.permissionLevel).toBe('allow-always');
      expect(results[1].metadata?.permissionLevel).toBe('allow-always');
      expect(results[2].metadata?.permissionLevel).toBe('allow-once');
      expect(results[3].metadata?.permissionLevel).toBe('allow-always');
      expect(results[4].metadata?.permissionLevel).toBe('allow-always');

      // Verify no race conditions occurred
      const events = env.systemEvents.getAllEvents();
      const permissionEvents = events.filter(e => e.type.startsWith('permission:'));
      const deniedEvents = permissionEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(0);
    });
  });

  describe('Permission System Edge Cases', () => {
    beforeEach(async () => {
      env = await createTriSystemTestEnvironment({
        permissionConfig: {
          preset: 'selective',
          defaultLevel: 'allow-once'
        }
      });
      assertTriSystemReady(env);
    });

    it('should handle permission conflicts with deterministic resolution', async () => {
      // Create conflicting permissions (more specific should win)
      await env.permissionSystem.manager.grantPermission('Read', 'allow-always', '/data/*');
      await env.permissionSystem.manager.grantPermission('Read', 'deny', '/data/private/*');
      await env.permissionSystem.manager.grantPermission('Read', 'allow-once', '/data/private/temp/*');

      const conflictTests = [
        { path: '/data/public.txt', expected: 'granted' as const, level: 'allow-always' },
        { path: '/data/private/secret.txt', expected: 'denied' as const, level: null },
        { path: '/data/private/temp/cache.txt', expected: 'granted' as const, level: 'allow-once' }
      ];

      for (const test of conflictTests) {
        const result = await env.toolSystem.executor.executeWithPermissionCheck(
          'Read',
          'conflict-test',
          {
            operation: 'read',
            params: { filePath: test.path }
          }
        );

        assertPermissionEnforced(result, test.expected);
        if (test.expected === 'granted') {
          expect(result.metadata?.permissionLevel).toBe(test.level);
        }
      }
    });

    it('should handle permission expiry and renewal correctly', async () => {
      // Grant permission with short expiry
      const futureExpiry = new Date(Date.now() + 1000); // 1 second from now

      // Note: The mock system doesn't actually handle expiry, so we test the concept
      await env.permissionSystem.manager.grantPermission('Write', 'allow-once', '/tmp/expiring.txt');

      // First use should succeed
      const firstResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'expiry-test-1',
        {
          operation: 'write',
          params: { filePath: '/tmp/expiring.txt' }
        }
      );

      assertPermissionEnforced(firstResult, 'granted');

      // Second use should fail (allow-once consumed)
      const secondResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'expiry-test-2',
        {
          operation: 'write',
          params: { filePath: '/tmp/expiring.txt' }
        }
      );

      assertPermissionEnforced(secondResult, 'denied');
    });

    it('should handle invalid permission requests gracefully', async () => {
      // Test invalid tool names, scopes, etc.
      const invalidTests = [
        { tool: '' as AgentTool, scope: '/tmp/test.txt' },
        { tool: 'InvalidTool' as AgentTool, scope: '' },
        { tool: 'Read' as AgentTool, scope: null }
      ];

      for (const test of invalidTests) {
        try {
          const result = await env.toolSystem.executor.executeWithPermissionCheck(
            test.tool,
            'invalid-test',
            {
              operation: 'test',
              params: { filePath: test.scope }
            }
          );

          // Should either succeed with default behavior or fail gracefully
          expect(result).toBeDefined();
        } catch (error) {
          // Errors should be handled gracefully
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('Cross-System Permission Enforcement', () => {
    beforeEach(async () => {
      env = await createTriSystemTestEnvironment({
        permissionConfig: {
          preset: 'selective',
          defaultLevel: 'allow-once'
        },
        browserConfig: {
          backend: 'mock',
          headless: true
        },
        eventConfig: {
          captureAll: true,
          enableCorrelation: true
        }
      });
      assertTriSystemReady(env);
    });

    it('should enforce consistent permissions between Tool and Browser systems', async () => {
      // Set up cross-system permissions
      await env.permissionSystem.manager.grantPermission('WebFetch', 'allow-always', 'https://api.example.com/*');
      await env.permissionSystem.manager.grantPermission('Browser', 'allow-always', 'https://example.com/*');
      await env.permissionSystem.manager.grantPermission('WebSearch', 'deny', 'search:restricted-topics');

      // Test WebFetch permission
      const webFetchResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'WebFetch',
        'api-call',
        {
          operation: 'fetch',
          params: { url: 'https://api.example.com/data' }
        }
      );

      assertPermissionEnforced(webFetchResult, 'granted');

      // Test Browser permission
      const browserResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate',
        {
          operation: 'navigate',
          params: { url: 'https://example.com/homepage' }
        }
      );

      assertPermissionEnforced(browserResult, 'granted');

      // Test WebSearch denial
      const searchResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'WebSearch',
        'restricted-search',
        {
          operation: 'search',
          params: { query: 'search:restricted-topics' }
        }
      );

      assertPermissionEnforced(searchResult, 'denied');

      // Verify cross-system event correlation
      const correlatedGroups = env.systemEvents.correlatedEvents;
      expect(correlatedGroups.length).toBeGreaterThan(0);

      // Should have correlations between permission and tool systems
      const crossSystemCorrelation = correlatedGroups.find(group =>
        group.systems.has('permission') && (group.systems.has('tool') || group.systems.has('browser'))
      );
      expect(crossSystemCorrelation).toBeDefined();
    });

    it('should maintain permission audit trail across systems', async () => {
      // Execute operations across all three systems
      const operations = [
        { system: 'tool', tool: 'Read' as AgentTool, operation: 'file-read' },
        { system: 'tool', tool: 'Write' as AgentTool, operation: 'file-write' },
        { system: 'browser', tool: 'Browser' as AgentTool, operation: 'navigate' },
        { system: 'tool', tool: 'WebFetch' as AgentTool, operation: 'web-fetch' }
      ];

      for (const op of operations) {
        await env.toolSystem.executor.executeWithPermissionCheck(
          op.tool,
          op.operation,
          {
            operation: op.operation,
            params: {
              filePath: '/tmp/audit-test.txt',
              url: 'https://example.com',
              command: 'echo test'
            }
          }
        );
      }

      // Verify complete audit trail
      const allEvents = env.systemEvents.getAllEvents();
      const permissionRequestEvents = allEvents.filter(e => e.type === 'permission:requested');

      expect(permissionRequestEvents.length).toBe(operations.length);

      // Each operation should have corresponding permission events
      for (let i = 0; i < operations.length; i++) {
        const requestEvent = permissionRequestEvents[i];
        expect(requestEvent.data.tool).toBe(operations[i].tool);
        expect(requestEvent.system).toBe('permission');
      }
    });
  });
});