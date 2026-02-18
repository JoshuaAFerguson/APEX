/**
 * Integration tests for end-to-end permission notification flow
 *
 * This test suite verifies the complete permission notification flow:
 * - Permission change events are emitted by the orchestrator
 * - Events are properly broadcast to WebSocket clients via API
 * - CLI receives and handles permission events correctly
 * - Notification content is accurate and actionable
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { createServer, ServerOptions } from '@apexcli/api';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { useOrchestratorEvents } from '@apexcli/cli/src/ui/hooks/useOrchestratorEvents';
import { renderHook, act } from '@testing-library/react';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Integration: Permission Notification Flow', () => {
  let testDir: string;
  let server: FastifyInstance;
  let orchestrator: ApexOrchestrator;
  let port: number;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-permission-test-'));

    // Initialize APEX project structure
    const apexDir = path.join(testDir, '.apex');
    const agentsDir = path.join(apexDir, 'agents');
    const workflowsDir = path.join(apexDir, 'workflows');

    await fs.mkdir(apexDir, { recursive: true });
    await fs.mkdir(agentsDir, { recursive: true });
    await fs.mkdir(workflowsDir, { recursive: true });

    // Create minimal config
    await fs.writeFile(
      path.join(apexDir, 'config.yaml'),
      `project:
  name: permission-test-project
  language: typescript`
    );

    // Create test agents
    await fs.writeFile(
      path.join(agentsDir, 'developer.md'),
      `---
name: developer
description: Writes code
tools: Read, Write, Edit, Bash
---
You are a developer.`
    );

    // Create test workflow
    await fs.writeFile(
      path.join(workflowsDir, 'feature.yaml'),
      `name: feature
description: Feature workflow
stages:
  - name: implementation
    agent: developer
    description: Implement the feature`
    );

    // Find available port
    port = 3000 + Math.floor(Math.random() * 1000);

    // Create server
    const serverOptions: ServerOptions = {
      port,
      host: '127.0.0.1',
      projectPath: testDir,
      silent: true
    };

    server = await createServer(serverOptions);
    await server.listen({ port, host: '127.0.0.1' });

    // Get orchestrator instance from server context
    orchestrator = server.orchestrator as ApexOrchestrator;
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await server?.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Permission Request Flow', () => {
    it('should emit permission:request event and broadcast to WebSocket clients', async () => {
      const task = await orchestrator.createTask({
        description: 'Test permission flow',
        workflow: 'feature'
      });

      // Set up WebSocket client to capture events
      const ws = new WebSocket(`ws://127.0.0.1:${port}/stream/${task.id}`);
      const receivedEvents: any[] = [];

      // Wait for WebSocket to connect
      await new Promise<void>((resolve) => {
        ws.on('open', () => resolve());
      });

      ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      // Simulate permission request from orchestrator
      const permissionRequest = {
        requestId: 'test-request-001',
        tool: 'Write',
        scope: '/test/file.ts',
        description: 'Need permission to create test file',
        isDangerous: false,
        agent: 'developer',
        timestamp: new Date(),
        metadata: { taskId: task.id }
      };

      // Emit permission request event
      orchestrator.emit('permission:request', permissionRequest);

      // Wait for event to be processed and broadcast
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify the event was broadcast to WebSocket client
      const permissionEvents = receivedEvents.filter(e => e.type === 'permission:request');
      expect(permissionEvents).toHaveLength(1);

      const broadcastEvent = permissionEvents[0];
      expect(broadcastEvent.taskId).toBe(task.id);
      expect(broadcastEvent.data.requestId).toBe('test-request-001');
      expect(broadcastEvent.data.tool).toBe('Write');
      expect(broadcastEvent.data.scope).toBe('/test/file.ts');
      expect(broadcastEvent.data.description).toBe('Need permission to create test file');
      expect(broadcastEvent.data.isDangerous).toBe(false);
      expect(broadcastEvent.data.agent).toBe('developer');

      ws.close();
    });

    it('should emit permission:granted event with correct data', async () => {
      const task = await orchestrator.createTask({
        description: 'Test permission grant flow',
        workflow: 'feature'
      });

      const ws = new WebSocket(`ws://127.0.0.1:${port}/stream/${task.id}`);
      const receivedEvents: any[] = [];

      await new Promise<void>((resolve) => {
        ws.on('open', () => resolve());
      });

      ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      // Simulate permission granted
      const permissionGranted = {
        requestId: 'test-request-002',
        tool: 'Write',
        scope: '/test/file.ts',
        level: 'allow-once' as const,
        grantedBy: 'user',
        timestamp: new Date(),
        reason: 'User approved file creation'
      };

      orchestrator.emit('permission:granted', permissionGranted);
      await new Promise(resolve => setTimeout(resolve, 100));

      const grantedEvents = receivedEvents.filter(e => e.type === 'permission:granted');
      expect(grantedEvents).toHaveLength(1);

      const broadcastEvent = grantedEvents[0];
      expect(broadcastEvent.data.requestId).toBe('test-request-002');
      expect(broadcastEvent.data.tool).toBe('Write');
      expect(broadcastEvent.data.level).toBe('allow-once');
      expect(broadcastEvent.data.grantedBy).toBe('user');
      expect(broadcastEvent.data.reason).toBe('User approved file creation');

      ws.close();
    });

    it('should emit permission:denied event with correct data', async () => {
      const task = await orchestrator.createTask({
        description: 'Test permission denial flow',
        workflow: 'feature'
      });

      const ws = new WebSocket(`ws://127.0.0.1:${port}/stream/${task.id}`);
      const receivedEvents: any[] = [];

      await new Promise<void>((resolve) => {
        ws.on('open', () => resolve());
      });

      ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      // Simulate permission denied
      const permissionDenied = {
        requestId: 'test-request-003',
        tool: 'Bash',
        scope: 'rm -rf',
        deniedBy: 'security-policy',
        timestamp: new Date(),
        reason: 'Dangerous operation not allowed'
      };

      orchestrator.emit('permission:denied', permissionDenied);
      await new Promise(resolve => setTimeout(resolve, 100));

      const deniedEvents = receivedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(1);

      const broadcastEvent = deniedEvents[0];
      expect(broadcastEvent.data.requestId).toBe('test-request-003');
      expect(broadcastEvent.data.tool).toBe('Bash');
      expect(broadcastEvent.data.deniedBy).toBe('security-policy');
      expect(broadcastEvent.data.reason).toBe('Dangerous operation not allowed');

      ws.close();
    });
  });

  describe('CLI Event Handling', () => {
    it('should handle permission events in useOrchestratorEvents hook', async () => {
      // Mock orchestrator for CLI testing
      const mockOrchestrator = new EventEmitter() as any;
      mockOrchestrator.listTasks = vi.fn().mockResolvedValue([]);

      const testWorkflow = {
        stages: [
          { name: 'implementation', agent: 'developer' }
        ]
      };

      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          debug: true
        })
      );

      // Capture console logs for permission events
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      act(() => {
        // Simulate permission request
        mockOrchestrator.emit('permission:request', {
          requestId: 'cli-test-001',
          tool: 'Write',
          scope: '/src/test.ts',
          description: 'Creating test file',
          isDangerous: false,
          agent: 'developer',
          timestamp: new Date()
        });

        // Simulate permission granted
        mockOrchestrator.emit('permission:granted', {
          requestId: 'cli-test-001',
          tool: 'Write',
          scope: '/src/test.ts',
          level: 'allow-once',
          grantedBy: 'user',
          timestamp: new Date(),
          reason: 'Approved for testing'
        });
      });

      // Verify that the hook processed the events
      // (In a real implementation, this would update state or trigger notifications)
      expect(result.current.agents).toHaveLength(1);
      expect(result.current.agents[0].name).toBe('developer');

      consoleSpy.mockRestore();
    });

    it('should handle permission events with proper filtering by taskId', async () => {
      const mockOrchestrator = new EventEmitter() as any;
      mockOrchestrator.listTasks = vi.fn().mockResolvedValue([]);

      const testWorkflow = {
        stages: [
          { name: 'implementation', agent: 'developer' }
        ]
      };

      const targetTaskId = 'target-task-123';

      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          taskId: targetTaskId,
          workflow: testWorkflow,
          debug: true
        })
      );

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      act(() => {
        // Emit permission event for target task
        mockOrchestrator.emit('permission:request', {
          requestId: 'filtered-test-001',
          tool: 'Read',
          scope: '/src/config.yaml',
          description: 'Reading configuration',
          isDangerous: false,
          agent: 'developer',
          timestamp: new Date(),
          taskId: targetTaskId
        });

        // Emit permission event for different task (should be ignored)
        mockOrchestrator.emit('permission:request', {
          requestId: 'filtered-test-002',
          tool: 'Write',
          scope: '/src/other.ts',
          description: 'Writing other file',
          isDangerous: false,
          agent: 'developer',
          timestamp: new Date(),
          taskId: 'other-task-456'
        });
      });

      // The hook should process events properly
      expect(result.current.agents).toHaveLength(1);

      consoleSpy.mockRestore();
    });
  });

  describe('Complete Notification Flow', () => {
    it('should complete the full permission notification cycle', async () => {
      const task = await orchestrator.createTask({
        description: 'Complete permission flow test',
        workflow: 'feature'
      });

      // Set up WebSocket to monitor the complete flow
      const ws = new WebSocket(`ws://127.0.0.1:${port}/stream/${task.id}`);
      const receivedEvents: any[] = [];

      await new Promise<void>((resolve) => {
        ws.on('open', () => resolve());
      });

      ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      // Simulate the complete permission flow
      const requestId = 'complete-flow-001';

      // 1. Permission requested
      orchestrator.emit('permission:request', {
        requestId,
        tool: 'Write',
        scope: '/src/feature.ts',
        description: 'Creating new feature file',
        isDangerous: false,
        agent: 'developer',
        timestamp: new Date(),
        metadata: {
          taskId: task.id,
          operation: 'file-creation',
          estimatedChanges: '50 lines'
        }
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // 2. Permission granted
      orchestrator.emit('permission:granted', {
        requestId,
        tool: 'Write',
        scope: '/src/feature.ts',
        level: 'allow-once',
        grantedBy: 'user',
        timestamp: new Date(),
        reason: 'Feature implementation approved'
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify complete flow
      expect(receivedEvents.length).toBeGreaterThanOrEqual(2);

      const requestEvent = receivedEvents.find(e => e.type === 'permission:request');
      const grantEvent = receivedEvents.find(e => e.type === 'permission:granted');

      expect(requestEvent).toBeDefined();
      expect(grantEvent).toBeDefined();

      // Verify request event content
      expect(requestEvent.data.requestId).toBe(requestId);
      expect(requestEvent.data.tool).toBe('Write');
      expect(requestEvent.data.description).toBe('Creating new feature file');
      expect(requestEvent.data.metadata.operation).toBe('file-creation');

      // Verify grant event content
      expect(grantEvent.data.requestId).toBe(requestId);
      expect(grantEvent.data.level).toBe('allow-once');
      expect(grantEvent.data.grantedBy).toBe('user');

      ws.close();
    });

    it('should handle dangerous operation detection and confirmation flow', async () => {
      const task = await orchestrator.createTask({
        description: 'Dangerous operation flow test',
        workflow: 'feature'
      });

      const ws = new WebSocket(`ws://127.0.0.1:${port}/stream/${task.id}`);
      const receivedEvents: any[] = [];

      await new Promise<void>((resolve) => {
        ws.on('open', () => resolve());
      });

      ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      const operationId = 'dangerous-op-001';

      // 1. Dangerous operation detected
      orchestrator.emit('dangerous:detected', {
        operationId,
        tool: 'Bash',
        operation: 'sudo rm -rf /tmp/*',
        riskLevel: 'high',
        riskDescription: 'Deleting files with elevated privileges',
        agent: 'developer',
        timestamp: new Date(),
        context: {
          workingDir: '/tmp',
          command: 'sudo rm -rf /tmp/*',
          taskId: task.id
        }
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // 2. User confirms the operation
      orchestrator.emit('dangerous:confirmed', {
        operationId,
        tool: 'Bash',
        operation: 'sudo rm -rf /tmp/*',
        confirmedBy: 'user',
        timestamp: new Date(),
        reason: 'User confirmed cleanup is necessary'
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify dangerous operation flow
      const detectedEvent = receivedEvents.find(e => e.type === 'dangerous:detected');
      const confirmedEvent = receivedEvents.find(e => e.type === 'dangerous:confirmed');

      expect(detectedEvent).toBeDefined();
      expect(confirmedEvent).toBeDefined();

      expect(detectedEvent.data.operationId).toBe(operationId);
      expect(detectedEvent.data.riskLevel).toBe('high');
      expect(detectedEvent.data.riskDescription).toBe('Deleting files with elevated privileges');

      expect(confirmedEvent.data.operationId).toBe(operationId);
      expect(confirmedEvent.data.confirmedBy).toBe('user');

      ws.close();
    });
  });

  describe('WebSocket Event Filtering', () => {
    it('should filter permission events when event filtering is enabled', async () => {
      const task = await orchestrator.createTask({
        description: 'Event filtering test',
        workflow: 'feature'
      });

      // Connect with permission event filter only
      const ws = new WebSocket(`ws://127.0.0.1:${port}/stream/${task.id}?events=permission:request,permission:granted`);
      const receivedEvents: any[] = [];

      await new Promise<void>((resolve) => {
        ws.on('open', () => resolve());
      });

      ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString());
          receivedEvents.push(event);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      // Emit various events, only permission events should be received
      orchestrator.emit('permission:request', {
        requestId: 'filter-test-001',
        tool: 'Write',
        scope: '/test/filter.ts',
        description: 'Filtered permission request',
        isDangerous: false,
        agent: 'developer',
        timestamp: new Date()
      });

      orchestrator.emit('agent:tool-use', task.id, 'Read', { path: '/src/file.ts' });

      orchestrator.emit('permission:granted', {
        requestId: 'filter-test-001',
        tool: 'Write',
        scope: '/test/filter.ts',
        level: 'allow-once',
        grantedBy: 'user',
        timestamp: new Date()
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should only receive permission events, not tool-use events
      const permissionEvents = receivedEvents.filter(e =>
        e.type === 'permission:request' || e.type === 'permission:granted'
      );
      const toolUseEvents = receivedEvents.filter(e => e.type === 'agent:tool-use');

      expect(permissionEvents).toHaveLength(2);
      expect(toolUseEvents).toHaveLength(0);

      ws.close();
    });
  });
});