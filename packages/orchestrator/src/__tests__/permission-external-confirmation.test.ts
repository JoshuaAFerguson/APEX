/**
 * @fileoverview Tests for permission and dangerous operation confirmation from external sources
 *
 * This test suite specifically tests the acceptance criteria for the v0.5.0 feature:
 * "Orchestrator can receive and process permission confirmations from external sources (CLI/API),
 *  updates permission store on user decisions, emits permission:granted or permission:denied events accordingly"
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile, mkdir } from 'fs/promises';

import { ApexOrchestrator } from '../index';
import type {
  PermissionLevel,
  PermissionRequestEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData,
  DangerousOperationDetectedEventData,
  DangerousOperationConfirmedEventData,
  DangerousOperationBlockedEventData
} from '@apexcli/core';

describe('External Permission Confirmation Integration', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'apex-external-permission-test-'));

    // Create .apex directory
    const apexDir = join(tempDir, '.apex');
    await mkdir(apexDir, { recursive: true });

    // Create minimal config
    const configContent = `
project:
  name: external-permission-test
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: review-all
  customRules: []

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

    await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);

    orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('External Permission Confirmation from CLI/API', () => {
    it('should process permission grant from external CLI source', async () => {
      const events: Array<{ type: string; data: any }> = [];

      // Set up event listeners to track permission events
      orchestrator.on('permission:request', (data) => {
        events.push({ type: 'permission:request', data });
      });
      orchestrator.on('permission:granted', (data) => {
        events.push({ type: 'permission:granted', data });
      });

      const taskId = 'cli-external-task-001';
      const tool = 'Write';
      const scope = '/external/cli/file.txt';
      const description = 'Create file via CLI confirmation';
      const agent = 'developer';

      // Step 1: Agent requests permission (this would happen internally)
      const requestId = await orchestrator.requestPermission(
        taskId,
        tool,
        scope,
        description,
        false,
        agent
      );

      // Verify permission request was emitted
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('permission:request');
      expect(events[0].data).toMatchObject({
        requestId,
        tool,
        scope,
        description,
        isDangerous: false,
        agent
      });

      // Step 2: External CLI/API grants permission (simulating user approval via CLI)
      await orchestrator.grantPermissionConfirmation(
        requestId,
        taskId,
        tool,
        scope,
        'allow-once',
        'cli-user',
        'Approved via CLI interface'
      );

      // Verify permission:granted event was emitted
      expect(events).toHaveLength(2);
      expect(events[1].type).toBe('permission:granted');
      expect(events[1].data).toMatchObject({
        requestId,
        tool,
        scope,
        level: 'allow-once',
        grantedBy: 'cli-user',
        reason: 'Approved via CLI interface'
      });

      // Step 3: Verify permission was stored in the permission store
      const hasPermission = await orchestrator['permissionManager'].hasPermission(tool, scope);
      expect(hasPermission).toBe(true);
    });

    it('should process permission denial from external API source', async () => {
      const events: Array<{ type: string; data: any }> = [];

      orchestrator.on('permission:request', (data) => {
        events.push({ type: 'permission:request', data });
      });
      orchestrator.on('permission:denied', (data) => {
        events.push({ type: 'permission:denied', data });
      });

      const taskId = 'api-external-task-001';
      const tool = 'Bash';
      const scope = '/system/critical';
      const description = 'Execute system command';

      // Step 1: Request permission
      const requestId = await orchestrator.requestPermission(
        taskId,
        tool,
        scope,
        description,
        true, // dangerous operation
        'agent'
      );

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('permission:request');

      // Step 2: External API denies permission (simulating user denial via API)
      await orchestrator.denyPermissionConfirmation(
        requestId,
        taskId,
        tool,
        scope,
        'api-admin',
        'Denied via API - insufficient privileges'
      );

      // Verify permission:denied event was emitted
      expect(events).toHaveLength(2);
      expect(events[1].type).toBe('permission:denied');
      expect(events[1].data).toMatchObject({
        requestId,
        tool,
        scope,
        deniedBy: 'api-admin',
        reason: 'Denied via API - insufficient privileges'
      });

      // Step 3: Verify deny permission was stored
      const hasPermission = await orchestrator['permissionManager'].hasPermission(tool, scope);
      expect(hasPermission).toBe(false);
    });

    it('should handle multiple concurrent external confirmations', async () => {
      const events: Array<{ type: string; data: any }> = [];

      ['permission:request', 'permission:granted', 'permission:denied'].forEach(eventType => {
        orchestrator.on(eventType as any, (data) => {
          events.push({ type: eventType, data });
        });
      });

      // Create multiple permission requests
      const requests = [
        { taskId: 'concurrent-1', tool: 'Read', scope: '/path1', shouldGrant: true },
        { taskId: 'concurrent-2', tool: 'Write', scope: '/path2', shouldGrant: false },
        { taskId: 'concurrent-3', tool: 'Edit', scope: '/path3', shouldGrant: true },
        { taskId: 'concurrent-4', tool: 'Delete', scope: '/path4', shouldGrant: false },
        { taskId: 'concurrent-5', tool: 'Bash', scope: '/path5', shouldGrant: true }
      ];

      // Step 1: Make all permission requests
      const requestIds = await Promise.all(
        requests.map(req =>
          orchestrator.requestPermission(
            req.taskId,
            req.tool,
            req.scope,
            `External operation for ${req.taskId}`,
            false,
            'external-agent'
          )
        )
      );

      // Verify all request events were emitted
      expect(events.filter(e => e.type === 'permission:request')).toHaveLength(5);

      // Step 2: Process all confirmations concurrently (simulating external decisions)
      await Promise.all(
        requestIds.map((requestId, index) => {
          const request = requests[index];
          return request.shouldGrant
            ? orchestrator.grantPermissionConfirmation(
                requestId,
                request.taskId,
                request.tool,
                request.scope,
                'allow-once',
                'external-system',
                'Granted by external system'
              )
            : orchestrator.denyPermissionConfirmation(
                requestId,
                request.taskId,
                request.tool,
                request.scope,
                'external-system',
                'Denied by external system'
              );
        })
      );

      // Verify all confirmation events were emitted
      const grantedEvents = events.filter(e => e.type === 'permission:granted');
      const deniedEvents = events.filter(e => e.type === 'permission:denied');

      expect(grantedEvents).toHaveLength(3); // 3 should be granted
      expect(deniedEvents).toHaveLength(2);  // 2 should be denied

      // Verify permissions were stored correctly
      const grantedRequests = requests.filter(r => r.shouldGrant);
      const deniedRequests = requests.filter(r => !r.shouldGrant);

      for (const request of grantedRequests) {
        const hasPermission = await orchestrator['permissionManager'].hasPermission(
          request.tool,
          request.scope
        );
        expect(hasPermission).toBe(true);
      }

      for (const request of deniedRequests) {
        const hasPermission = await orchestrator['permissionManager'].hasPermission(
          request.tool,
          request.scope
        );
        expect(hasPermission).toBe(false);
      }
    });
  });

  describe('External Dangerous Operation Confirmation', () => {
    it('should process dangerous operation confirmation from external source', async () => {
      const events: Array<{ type: string; data: any }> = [];

      ['dangerous:detected', 'dangerous:confirmed'].forEach(eventType => {
        orchestrator.on(eventType as any, (data) => {
          events.push({ type: eventType, data });
        });
      });

      const taskId = 'dangerous-external-task-001';
      const tool = 'Bash';
      const operation = 'sudo service apache2 restart';
      const riskLevel = 'medium';
      const agent = 'devops';

      // Step 1: Flag dangerous operation
      const operationId = await orchestrator.flagDangerousOperation(
        taskId,
        tool,
        operation,
        riskLevel,
        'Service restart may cause brief downtime',
        agent,
        { service: 'apache2', action: 'restart' }
      );

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('dangerous:detected');

      // Step 2: External source confirms dangerous operation
      await orchestrator.confirmDangerousOperation(
        operationId,
        taskId,
        tool,
        operation,
        'external-admin',
        'Confirmed via external admin panel - maintenance window active'
      );

      expect(events).toHaveLength(2);
      expect(events[1].type).toBe('dangerous:confirmed');
      expect(events[1].data).toMatchObject({
        operationId,
        tool,
        operation,
        confirmedBy: 'external-admin',
        reason: 'Confirmed via external admin panel - maintenance window active'
      });
    });

    it('should process dangerous operation blocking from external source', async () => {
      const events: Array<{ type: string; data: any }> = [];

      ['dangerous:detected', 'dangerous:blocked'].forEach(eventType => {
        orchestrator.on(eventType as any, (data) => {
          events.push({ type: eventType, data });
        });
      });

      const taskId = 'dangerous-block-task-001';
      const operation = 'rm -rf /var/log/*';

      // Step 1: Flag dangerous operation
      const operationId = await orchestrator.flagDangerousOperation(
        taskId,
        'Bash',
        operation,
        'high',
        'Mass deletion of log files',
        'agent'
      );

      // Step 2: External source blocks dangerous operation
      await orchestrator.blockDangerousOperation(
        operationId,
        taskId,
        'Bash',
        operation,
        'external-security',
        'Blocked by external security policy - log retention required'
      );

      expect(events).toHaveLength(2);
      expect(events[1].type).toBe('dangerous:blocked');
      expect(events[1].data).toMatchObject({
        operationId,
        blockedBy: 'external-security',
        reason: 'Blocked by external security policy - log retention required'
      });
    });

    it('should handle mixed permission and dangerous operation confirmations from external sources', async () => {
      const events: Array<{ type: string; data: any }> = [];

      const eventTypes = [
        'permission:request', 'permission:granted', 'permission:denied',
        'dangerous:detected', 'dangerous:confirmed', 'dangerous:blocked'
      ];

      eventTypes.forEach(eventType => {
        orchestrator.on(eventType as any, (data) => {
          events.push({ type: eventType, data });
        });
      });

      const taskId = 'mixed-external-task-001';

      // Step 1: Request permission
      const requestId = await orchestrator.requestPermission(
        taskId,
        'Bash',
        '/etc/nginx/sites-available',
        'Modify nginx configuration',
        true,
        'external-agent'
      );

      // Step 2: External source grants permission
      await orchestrator.grantPermissionConfirmation(
        requestId,
        taskId,
        'Bash',
        '/etc/nginx/sites-available',
        'allow-once',
        'external-ops-team',
        'Granted by ops team via external dashboard'
      );

      // Step 3: Flag dangerous operation
      const operationId = await orchestrator.flagDangerousOperation(
        taskId,
        'Bash',
        'sudo nginx -t && sudo nginx -s reload',
        'medium',
        'Configuration validation and reload',
        'external-agent',
        { configCheck: true }
      );

      // Step 4: External source confirms dangerous operation
      await orchestrator.confirmDangerousOperation(
        operationId,
        taskId,
        'Bash',
        'sudo nginx -t && sudo nginx -s reload',
        'external-ops-team',
        'Confirmed by ops team - configuration validated'
      );

      // Verify complete workflow
      expect(events).toHaveLength(4);
      expect(events.map(e => e.type)).toEqual([
        'permission:request',
        'permission:granted',
        'dangerous:detected',
        'dangerous:confirmed'
      ]);

      // Verify all confirmations came from external sources
      const confirmationEvents = events.filter(e =>
        e.type === 'permission:granted' || e.type === 'dangerous:confirmed'
      );

      confirmationEvents.forEach(event => {
        if (event.type === 'permission:granted') {
          expect(event.data.grantedBy).toBe('external-ops-team');
        } else if (event.type === 'dangerous:confirmed') {
          expect(event.data.confirmedBy).toBe('external-ops-team');
        }
      });
    });
  });

  describe('Permission Store Updates from External Confirmations', () => {
    it('should update permission store when external source grants allow-always permission', async () => {
      const tool = 'Read';
      const scope = '/project/src/**/*.ts';

      const requestId = await orchestrator.requestPermission(
        'store-test-001',
        tool,
        scope,
        'Read TypeScript files',
        false,
        'agent'
      );

      // External source grants persistent permission
      await orchestrator.grantPermissionConfirmation(
        requestId,
        'store-test-001',
        tool,
        scope,
        'allow-always',
        'external-lead-dev',
        'Persistent read access approved for development'
      );

      // Verify permission persists
      const hasPermission = await orchestrator['permissionManager'].hasPermission(tool, scope);
      expect(hasPermission).toBe(true);

      // Verify permission details
      const checkResult = await orchestrator['permissionManager'].checkPermission(tool, scope);
      expect(checkResult.granted).toBe(true);
      expect(checkResult.level).toBe('allow-always');
    });

    it('should update permission store when external source grants allow-once permission', async () => {
      const tool = 'Write';
      const scope = '/temp/output.log';

      const requestId = await orchestrator.requestPermission(
        'store-test-002',
        tool,
        scope,
        'Write temporary log file',
        false,
        'agent'
      );

      // External source grants one-time permission
      await orchestrator.grantPermissionConfirmation(
        requestId,
        'store-test-002',
        tool,
        scope,
        'allow-once',
        'external-supervisor',
        'One-time write permission for logging'
      );

      // Verify permission exists initially
      const hasPermission = await orchestrator['permissionManager'].hasPermission(tool, scope);
      expect(hasPermission).toBe(true);

      // For allow-once, the permission should be available but consumable
      const checkResult = await orchestrator['permissionManager'].checkPermission(tool, scope, true);
      expect(checkResult.granted).toBe(true);
      expect(checkResult.level).toBe('allow-once');
    });

    it('should update permission store when external source denies permission', async () => {
      const tool = 'Delete';
      const scope = '/production/data';

      const requestId = await orchestrator.requestPermission(
        'store-test-003',
        tool,
        scope,
        'Delete production data',
        true,
        'agent'
      );

      // External source denies permission
      await orchestrator.denyPermissionConfirmation(
        requestId,
        'store-test-003',
        tool,
        scope,
        'external-security-admin',
        'Production data deletion denied for security'
      );

      // Verify denial is recorded
      const hasPermission = await orchestrator['permissionManager'].hasPermission(tool, scope);
      expect(hasPermission).toBe(false);

      const checkResult = await orchestrator['permissionManager'].checkPermission(tool, scope);
      expect(checkResult.granted).toBe(false);
      expect(checkResult.level).toBe('deny');
    });
  });

  describe('Event Emission Compliance', () => {
    it('should emit events in correct order for external confirmations', async () => {
      const eventOrder: string[] = [];

      const eventTypes = [
        'permission:request', 'permission:granted',
        'dangerous:detected', 'dangerous:confirmed'
      ];

      eventTypes.forEach(eventType => {
        orchestrator.on(eventType as any, () => {
          eventOrder.push(eventType);
        });
      });

      // Complete workflow with external confirmations
      const requestId = await orchestrator.requestPermission(
        'order-test-001',
        'Bash',
        '/var/www',
        'Deploy website',
        true,
        'deployment-agent'
      );

      const operationId = await orchestrator.flagDangerousOperation(
        'order-test-001',
        'Bash',
        'sudo service apache2 restart',
        'medium',
        'Service restart required',
        'deployment-agent'
      );

      // External confirmations
      await orchestrator.grantPermissionConfirmation(
        requestId,
        'order-test-001',
        'Bash',
        '/var/www',
        'allow-once',
        'external-deployment-manager',
        'Deployment approved via external system'
      );

      await orchestrator.confirmDangerousOperation(
        operationId,
        'order-test-001',
        'Bash',
        'sudo service apache2 restart',
        'external-deployment-manager',
        'Service restart confirmed via external system'
      );

      expect(eventOrder).toEqual([
        'permission:request',
        'dangerous:detected',
        'permission:granted',
        'dangerous:confirmed'
      ]);
    });

    it('should include correct metadata in events for external confirmations', async () => {
      const eventData: Record<string, any> = {};

      orchestrator.on('permission:granted', (data) => {
        eventData.granted = data;
      });
      orchestrator.on('dangerous:confirmed', (data) => {
        eventData.confirmed = data;
      });

      const requestId = await orchestrator.requestPermission(
        'metadata-test-001',
        'ComplexTool',
        '/complex/path',
        'Complex operation',
        true,
        'complex-agent',
        { complexity: 'high', validation: true }
      );

      const operationId = await orchestrator.flagDangerousOperation(
        'metadata-test-001',
        'ComplexTool',
        'complex operation',
        'high',
        'High complexity operation',
        'complex-agent',
        { operationType: 'complex', safety: 'verified' }
      );

      // External confirmations with detailed metadata
      await orchestrator.grantPermissionConfirmation(
        requestId,
        'metadata-test-001',
        'ComplexTool',
        '/complex/path',
        'allow-once',
        'external-complex-admin',
        'Approved after external review and validation'
      );

      await orchestrator.confirmDangerousOperation(
        operationId,
        'metadata-test-001',
        'ComplexTool',
        'complex operation',
        'external-complex-admin',
        'Confirmed after safety verification via external system'
      );

      // Verify event data contains all expected fields
      expect(eventData.granted).toMatchObject({
        requestId,
        tool: 'ComplexTool',
        scope: '/complex/path',
        level: 'allow-once',
        grantedBy: 'external-complex-admin',
        reason: 'Approved after external review and validation'
      });

      expect(eventData.confirmed).toMatchObject({
        operationId,
        tool: 'ComplexTool',
        operation: 'complex operation',
        confirmedBy: 'external-complex-admin',
        reason: 'Confirmed after safety verification via external system'
      });

      // Verify timestamps are present and valid
      expect(eventData.granted.timestamp).toBeInstanceOf(Date);
      expect(eventData.confirmed.timestamp).toBeInstanceOf(Date);
    });
  });
});