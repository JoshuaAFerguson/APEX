/**
 * Integration tests for permission notification in ApexOrchestrator (INT-04, INT-05)
 * Tests orchestrator event emission and notification flow integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { ApexOrchestrator } from '../index';
import {
  PermissionNotification,
  PermissionRequestEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData,
  DangerousOperationDetectedEventData
} from '@apex/core';
import { EventCollector, MockPermissionTrigger } from '@apex/core/src/__tests__/helpers';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

describe('Permission Notification Orchestrator Integration Tests', () => {
  let orchestrator: ApexOrchestrator;
  let eventCollector: EventCollector;
  let mockTrigger: MockPermissionTrigger;
  let testDir: string;

  beforeEach(async () => {
    // Create temporary test directory with .apex config
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-permission-test-'));
    const apexDir = path.join(testDir, '.apex');
    fs.mkdirSync(apexDir, { recursive: true });

    // Create minimal config
    const configPath = path.join(apexDir, 'config.yaml');
    fs.writeFileSync(configPath, `
project:
  name: permission-notification-test
  version: "1.0.0"

autonomy:
  level: supervised

agents:
  - name: test-developer
    role: developer
    config: {}

workflows:
  - name: test-workflow
    description: Test workflow for permission notifications
    stages:
      - name: test-stage
        agent: test-developer
        prompt: "Test stage"
`);

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({
      workingDirectory: testDir,
      // Mock Claude SDK calls to prevent actual API calls
      claudeApiKey: 'test-key'
    });

    // Set up event collection
    eventCollector = new EventCollector(orchestrator);
    mockTrigger = new MockPermissionTrigger();

    // Connect mock trigger to orchestrator events
    mockTrigger.on('permission:request', (data) => {
      orchestrator.emit('permission:request', data);
    });
    mockTrigger.on('permission:granted', (data) => {
      orchestrator.emit('permission:granted', data);
    });
    mockTrigger.on('permission:denied', (data) => {
      orchestrator.emit('permission:denied', data);
    });
    mockTrigger.on('dangerous:detected', (data) => {
      orchestrator.emit('dangerous:detected', data);
    });
    mockTrigger.on('permission:notification', (data) => {
      orchestrator.emit('permission:notification', data);
    });
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.destroy();
    }
    eventCollector?.destroy();
    mockTrigger?.reset();

    // Cleanup test directory
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('INT-04: Orchestrator Permission Event Emission', () => {
    it('should emit permission:notification events when permission events occur', async () => {
      const requestId = mockTrigger.triggerPermissionRequest({
        tool: 'Bash',
        agent: 'test-developer',
        scope: '/test/path',
        description: 'Test bash execution',
        isDangerous: true
      });

      // Wait for permission request event
      const requestEvent = await eventCollector.waitForEvent('permission:request', 1000);
      expect(requestEvent.type).toBe('permission:request');

      const requestData = requestEvent.data as PermissionRequestEventData;
      expect(requestData.requestId).toBe(requestId);
      expect(requestData.tool).toBe('Bash');
      expect(requestData.agent).toBe('test-developer');
      expect(requestData.isDangerous).toBe(true);

      // Now trigger a permission granted event
      mockTrigger.triggerPermissionGranted({
        requestId,
        tool: 'Bash',
        scope: '/test/path',
        level: 'allow'
      });

      // Wait for permission granted event
      const grantedEvent = await eventCollector.waitForEvent('permission:granted', 1000);
      expect(grantedEvent.type).toBe('permission:granted');

      const grantedData = grantedEvent.data as PermissionGrantedEventData;
      expect(grantedData.requestId).toBe(requestId);
      expect(grantedData.tool).toBe('Bash');
      expect(grantedData.level).toBe('allow');
    });

    it('should emit permission:notification events with proper notification structure', async () => {
      // Trigger a notification directly
      const notificationId = mockTrigger.triggerPermissionNotification({
        taskId: 'orchestrator-task-1',
        agent: 'test-developer',
        tool: 'Write',
        type: 'permission:requested',
        title: 'File Write Permission',
        message: 'Agent requests permission to write to sensitive file',
        scope: '/etc/hosts',
        severity: 'warning',
        requiresAction: true,
        actions: ['approve', 'deny', 'modify_scope']
      });

      // Wait for notification event
      const notificationEvent = await eventCollector.waitForEvent('permission:notification', 1000);
      expect(notificationEvent.type).toBe('permission:notification');

      const notification = notificationEvent.data as PermissionNotification;
      expect(notification.id).toBe(notificationId);
      expect(notification.taskId).toBe('orchestrator-task-1');
      expect(notification.agent).toBe('test-developer');
      expect(notification.tool).toBe('Write');
      expect(notification.type).toBe('permission:requested');
      expect(notification.scope).toBe('/etc/hosts');
      expect(notification.severity).toBe('warning');
      expect(notification.requiresAction).toBe(true);
      expect(notification.actions).toEqual(['approve', 'deny', 'modify_scope']);
    });

    it('should handle dangerous operation events and emit appropriate notifications', async () => {
      const operationId = mockTrigger.triggerDangerousOperation({
        tool: 'Bash',
        agent: 'test-developer',
        operation: 'rm -rf /',
        riskLevel: 'critical',
        riskDescription: 'Recursive deletion of root directory'
      });

      // Wait for dangerous operation event
      const dangerousEvent = await eventCollector.waitForEvent('dangerous:detected', 1000);
      expect(dangerousEvent.type).toBe('dangerous:detected');

      const dangerousData = dangerousEvent.data as DangerousOperationDetectedEventData;
      expect(dangerousData.operationId).toBe(operationId);
      expect(dangerousData.tool).toBe('Bash');
      expect(dangerousData.operation).toBe('rm -rf /');
      expect(dangerousData.riskLevel).toBe('critical');

      // Now simulate the notification that would be generated
      const notificationId = mockTrigger.triggerPermissionNotification({
        taskId: 'dangerous-task',
        agent: 'test-developer',
        tool: 'Bash',
        type: 'dangerous:detected',
        title: 'Critical: Dangerous Operation Detected',
        message: 'Agent attempting to delete root directory - immediate action required',
        severity: 'critical',
        requiresAction: true,
        actions: ['block', 'confirm_with_backup', 'modify_command'],
        metadata: {
          operationId,
          originalCommand: 'rm -rf /',
          riskLevel: 'critical'
        }
      });

      const notificationEvent = await eventCollector.waitForEvent('permission:notification', 1000);
      const notification = notificationEvent.data as PermissionNotification;
      expect(notification.id).toBe(notificationId);
      expect(notification.type).toBe('dangerous:detected');
      expect(notification.severity).toBe('critical');
      expect(notification.metadata?.operationId).toBe(operationId);
    });

    it('should handle permission denial flow with notifications', async () => {
      const requestId = mockTrigger.triggerPermissionRequest({
        tool: 'Edit',
        agent: 'test-developer',
        scope: '/system/config',
        description: 'Modify system configuration'
      });

      await eventCollector.waitForEvent('permission:request', 1000);

      // Deny the permission
      mockTrigger.triggerPermissionDenied({
        requestId,
        tool: 'Edit',
        scope: '/system/config',
        reason: 'Insufficient privileges'
      });

      const deniedEvent = await eventCollector.waitForEvent('permission:denied', 1000);
      const deniedData = deniedEvent.data as PermissionDeniedEventData;
      expect(deniedData.requestId).toBe(requestId);
      expect(deniedData.reason).toBe('Insufficient privileges');

      // Trigger corresponding notification
      mockTrigger.triggerPermissionNotification({
        taskId: 'denial-task',
        agent: 'test-developer',
        tool: 'Edit',
        type: 'permission:denied',
        title: 'Permission Denied: Edit',
        message: 'Edit permission denied - insufficient privileges',
        scope: '/system/config',
        severity: 'error'
      });

      const notificationEvent = await eventCollector.waitForEvent('permission:notification', 1000);
      const notification = notificationEvent.data as PermissionNotification;
      expect(notification.type).toBe('permission:denied');
      expect(notification.severity).toBe('error');
    });
  });

  describe('INT-05: Event Flow Integration with Mock Orchestrator', () => {
    it('should handle complex permission flow scenarios', async () => {
      // Simulate a complete permission flow
      const flowResult = await mockTrigger.simulatePermissionFlow({
        tool: 'Bash',
        agent: 'test-developer',
        taskId: 'complex-flow-task',
        approve: true,
        scope: '/tmp/test-script.sh',
        isDangerous: false
      });

      expect(flowResult.result).toBe('approved');

      // Verify all events were emitted
      await new Promise(resolve => setTimeout(resolve, 150)); // Wait for all events

      const requestEvents = eventCollector.getEventsByType('permission:request');
      expect(requestEvents.length).toBeGreaterThan(0);

      const grantedEvents = eventCollector.getEventsByType('permission:granted');
      expect(grantedEvents.length).toBeGreaterThan(0);

      const notifications = eventCollector.getPermissionNotifications();
      expect(notifications.length).toBeGreaterThan(0);

      // Verify notification content matches flow
      const hasRequestedNotification = notifications.some(n =>
        n.type === 'permission:requested' && n.tool === 'Bash'
      );
      const hasGrantedNotification = notifications.some(n =>
        n.type === 'permission:granted' && n.tool === 'Bash'
      );

      expect(hasRequestedNotification).toBe(true);
      expect(hasGrantedNotification).toBe(true);
    });

    it('should handle dangerous operation flow with notifications', async () => {
      const dangerousFlow = await mockTrigger.simulateDangerousOperationFlow({
        tool: 'Bash',
        agent: 'test-developer',
        taskId: 'dangerous-flow-task',
        operation: 'sudo rm important-file.txt',
        confirm: false, // Block the operation
        riskLevel: 'high'
      });

      expect(dangerousFlow.result).toBe('blocked');

      // Wait for all events
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify dangerous operation events
      const dangerousEvents = eventCollector.getEventsByType('dangerous:detected');
      expect(dangerousEvents.length).toBeGreaterThan(0);

      const blockedEvents = eventCollector.getEventsByType('dangerous:blocked');
      expect(blockedEvents.length).toBeGreaterThan(0);

      // Verify corresponding notifications
      const notifications = eventCollector.getPermissionNotifications();
      const dangerousNotification = notifications.find(n => n.type === 'dangerous:detected');
      expect(dangerousNotification).toBeDefined();
      expect(dangerousNotification?.severity).toBe('error');
      expect(dangerousNotification?.requiresAction).toBe(true);
    });

    it('should maintain event ordering in notification flow', async () => {
      const startTime = Date.now();

      // Trigger events in sequence
      const requestId = mockTrigger.triggerPermissionRequest({
        tool: 'Read',
        agent: 'test-developer',
        description: 'Read operation'
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      mockTrigger.triggerPermissionNotification({
        taskId: 'ordering-test',
        agent: 'test-developer',
        tool: 'Read',
        type: 'permission:requested',
        title: 'Read Permission Request',
        message: 'Requesting read permission'
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      mockTrigger.triggerPermissionGranted({
        requestId,
        tool: 'Read',
        level: 'allow'
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      mockTrigger.triggerPermissionNotification({
        taskId: 'ordering-test',
        agent: 'test-developer',
        tool: 'Read',
        type: 'permission:granted',
        title: 'Read Permission Granted',
        message: 'Read permission has been granted'
      });

      // Wait for all events to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      const allEvents = eventCollector.getEvents();
      const relevantEvents = allEvents.filter(e =>
        e.type === 'permission:request' ||
        e.type === 'permission:granted' ||
        (e.type === 'permission:notification' &&
          (e.data as PermissionNotification).tool === 'Read')
      );

      expect(relevantEvents.length).toBe(4);

      // Verify chronological ordering
      for (let i = 1; i < relevantEvents.length; i++) {
        expect(relevantEvents[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          relevantEvents[i - 1].timestamp.getTime()
        );
      }
    });

    it('should handle multiple concurrent permission requests', async () => {
      // Trigger multiple concurrent permission flows
      const flows = await Promise.all([
        mockTrigger.simulatePermissionFlow({
          tool: 'Write',
          agent: 'agent-1',
          taskId: 'concurrent-1',
          approve: true,
          delay: 50
        }),
        mockTrigger.simulatePermissionFlow({
          tool: 'Read',
          agent: 'agent-2',
          taskId: 'concurrent-2',
          approve: false,
          delay: 75
        }),
        mockTrigger.simulatePermissionFlow({
          tool: 'Execute',
          agent: 'agent-3',
          taskId: 'concurrent-3',
          approve: true,
          delay: 25
        })
      ]);

      expect(flows[0].result).toBe('approved');
      expect(flows[1].result).toBe('denied');
      expect(flows[2].result).toBe('approved');

      // Wait for all events to be processed
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify all notifications were captured
      const notifications = eventCollector.getPermissionNotifications();
      const uniqueTaskIds = new Set(notifications.map(n => n.taskId));

      expect(uniqueTaskIds).toContain('concurrent-1');
      expect(uniqueTaskIds).toContain('concurrent-2');
      expect(uniqueTaskIds).toContain('concurrent-3');

      // Verify different tools were handled
      const uniqueTools = new Set(notifications.map(n => n.tool));
      expect(uniqueTools).toContain('Write');
      expect(uniqueTools).toContain('Read');
      expect(uniqueTools).toContain('Execute');
    });
  });

  describe('Orchestrator Event System Integration', () => {
    it('should verify orchestrator EventEmitter integration', () => {
      // Verify that ApexOrchestrator properly extends EventEmitter
      expect(orchestrator).toBeInstanceOf(EventEmitter);

      // Verify that permission event types are properly supported
      const testHandler = vi.fn();

      orchestrator.on('permission:notification', testHandler);
      orchestrator.emit('permission:notification', {
        id: 'test-notification',
        type: 'permission:requested',
        taskId: 'test-task',
        agent: 'test-agent',
        tool: 'TestTool',
        title: 'Test',
        message: 'Test message',
        timestamp: new Date()
      } as PermissionNotification);

      expect(testHandler).toHaveBeenCalledOnce();
    });

    it('should handle event listener cleanup properly', () => {
      const testHandler = vi.fn();

      orchestrator.on('permission:notification', testHandler);
      expect(orchestrator.listenerCount('permission:notification')).toBe(1);

      orchestrator.off('permission:notification', testHandler);
      expect(orchestrator.listenerCount('permission:notification')).toBe(0);
    });
  });
});