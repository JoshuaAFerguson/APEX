/**
 * @fileoverview Manual validation test for permission and dangerous operation functionality
 *
 * This test can be run independently to validate that the permission system is working correctly.
 * It's designed to be simple and focused on the core acceptance criteria.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile, mkdir } from 'fs/promises';

import { ApexOrchestrator } from '../index';
import type { PermissionRequestEventData, PermissionGrantedEventData, PermissionDeniedEventData } from '@apexcli/core';

describe('Permission System Manual Validation', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'apex-manual-validation-'));

    // Create .apex directory
    const apexDir = join(tempDir, '.apex');
    await mkdir(apexDir, { recursive: true });

    // Create basic config
    const configContent = `
project:
  name: manual-validation-test
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: review-all

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

  it('✅ VALIDATION: Can receive and process permission confirmations from external sources', async () => {
    // This test validates the core acceptance criteria

    let permissionRequestReceived = false;
    let permissionGrantedReceived = false;
    let requestData: PermissionRequestEventData;
    let grantData: PermissionGrantedEventData;

    // Listen for permission events
    orchestrator.on('permission:request', (data) => {
      permissionRequestReceived = true;
      requestData = data;
    });

    orchestrator.on('permission:granted', (data) => {
      permissionGrantedReceived = true;
      grantData = data;
    });

    // Step 1: Agent requests permission (simulates internal agent)
    const requestId = await orchestrator.requestPermission(
      'validation-task-001',
      'Write',
      '/project/src/newfile.ts',
      'Create TypeScript file',
      false,
      'developer-agent',
      { fileType: 'typescript' }
    );

    // Verify request was processed
    expect(permissionRequestReceived).toBe(true);
    expect(requestData!).toMatchObject({
      requestId,
      tool: 'Write',
      scope: '/project/src/newfile.ts',
      isDangerous: false,
      agent: 'developer-agent'
    });

    // Step 2: External CLI/API grants permission (simulates external confirmation)
    await orchestrator.grantPermissionConfirmation(
      requestId,
      'validation-task-001',
      'Write',
      '/project/src/newfile.ts',
      'allow-once',
      'external-cli-user', // This represents external source
      'Approved via CLI interface'
    );

    // Verify grant was processed
    expect(permissionGrantedReceived).toBe(true);
    expect(grantData!).toMatchObject({
      requestId,
      tool: 'Write',
      scope: '/project/src/newfile.ts',
      level: 'allow-once',
      grantedBy: 'external-cli-user', // External source confirmation
      reason: 'Approved via CLI interface'
    });

    console.log('✅ PASS: External permission confirmation processing works correctly');
  });

  it('✅ VALIDATION: Updates permission store on user decisions', async () => {
    const tool = 'Read';
    const scope = '/project/data/**';

    // Grant permission through external confirmation
    const requestId = await orchestrator.requestPermission(
      'store-validation-001',
      tool,
      scope,
      'Read project data files',
      false,
      'data-agent'
    );

    await orchestrator.grantPermissionConfirmation(
      requestId,
      'store-validation-001',
      tool,
      scope,
      'allow-always',
      'external-admin',
      'Permanent read access granted'
    );

    // Verify permission is stored
    const hasPermission = await orchestrator['permissionManager'].hasPermission(tool, scope);
    expect(hasPermission).toBe(true);

    // Verify permission details
    const permissionCheck = await orchestrator['permissionManager'].checkPermission(tool, scope);
    expect(permissionCheck.granted).toBe(true);
    expect(permissionCheck.level).toBe('allow-always');

    console.log('✅ PASS: Permission store updates correctly on user decisions');
  });

  it('✅ VALIDATION: Emits permission:granted and permission:denied events accordingly', async () => {
    const events: Array<{ type: string; source: string }> = [];

    // Track all permission events
    orchestrator.on('permission:request', () => events.push({ type: 'request', source: 'internal' }));
    orchestrator.on('permission:granted', (data) => events.push({ type: 'granted', source: data.grantedBy }));
    orchestrator.on('permission:denied', (data) => events.push({ type: 'denied', source: data.deniedBy }));

    // Test grant scenario
    const grantRequestId = await orchestrator.requestPermission(
      'event-test-grant',
      'Edit',
      '/config/app.json',
      'Edit app configuration',
      false,
      'config-agent'
    );

    await orchestrator.grantPermissionConfirmation(
      grantRequestId,
      'event-test-grant',
      'Edit',
      '/config/app.json',
      'allow-once',
      'external-api-admin',
      'Configuration edit approved'
    );

    // Test deny scenario
    const denyRequestId = await orchestrator.requestPermission(
      'event-test-deny',
      'Delete',
      '/system/critical.db',
      'Delete critical database',
      true,
      'cleanup-agent'
    );

    await orchestrator.denyPermissionConfirmation(
      denyRequestId,
      'event-test-deny',
      'Delete',
      '/system/critical.db',
      'external-security',
      'Critical system deletion denied'
    );

    // Verify event sequence
    expect(events).toEqual([
      { type: 'request', source: 'internal' },
      { type: 'granted', source: 'external-api-admin' },
      { type: 'request', source: 'internal' },
      { type: 'denied', source: 'external-security' }
    ]);

    console.log('✅ PASS: Permission events are emitted correctly for grant and deny scenarios');
  });

  it('✅ VALIDATION: Dangerous operation confirmation works end-to-end', async () => {
    let dangerousDetected = false;
    let dangerousConfirmed = false;

    orchestrator.on('dangerous:detected', () => {
      dangerousDetected = true;
    });

    orchestrator.on('dangerous:confirmed', (data) => {
      dangerousConfirmed = true;
      expect(data.confirmedBy).toBe('external-ops-team');
    });

    // Flag dangerous operation
    const operationId = await orchestrator.flagDangerousOperation(
      'dangerous-validation-001',
      'Bash',
      'sudo service database restart',
      'high',
      'Critical service restart required',
      'deployment-agent',
      { service: 'database', impact: 'service-interruption' }
    );

    expect(dangerousDetected).toBe(true);

    // External confirmation
    await orchestrator.confirmDangerousOperation(
      operationId,
      'dangerous-validation-001',
      'Bash',
      'sudo service database restart',
      'external-ops-team',
      'Service restart approved during maintenance window'
    );

    expect(dangerousConfirmed).toBe(true);

    console.log('✅ PASS: Dangerous operation confirmation workflow works correctly');
  });

  it('✅ VALIDATION: System handles concurrent external confirmations', async () => {
    const eventCounts = { requests: 0, grants: 0, denials: 0 };

    orchestrator.on('permission:request', () => eventCounts.requests++);
    orchestrator.on('permission:granted', () => eventCounts.grants++);
    orchestrator.on('permission:denied', () => eventCounts.denials++);

    // Create multiple permission requests simultaneously
    const requests = await Promise.all([
      orchestrator.requestPermission('concurrent-1', 'Read', '/path1', 'Read file 1', false, 'agent'),
      orchestrator.requestPermission('concurrent-2', 'Write', '/path2', 'Write file 2', false, 'agent'),
      orchestrator.requestPermission('concurrent-3', 'Delete', '/path3', 'Delete file 3', true, 'agent')
    ]);

    expect(requests).toHaveLength(3);
    expect(eventCounts.requests).toBe(3);

    // Process confirmations concurrently from external sources
    await Promise.all([
      orchestrator.grantPermissionConfirmation(requests[0], 'concurrent-1', 'Read', '/path1', 'allow-once', 'external-1', 'Grant 1'),
      orchestrator.grantPermissionConfirmation(requests[1], 'concurrent-2', 'Write', '/path2', 'allow-once', 'external-2', 'Grant 2'),
      orchestrator.denyPermissionConfirmation(requests[2], 'concurrent-3', 'Delete', '/path3', 'external-security', 'Deny dangerous delete')
    ]);

    expect(eventCounts.grants).toBe(2);
    expect(eventCounts.denials).toBe(1);

    console.log('✅ PASS: Concurrent external confirmations handled correctly');
  });

  it('✅ VALIDATION: Complete acceptance criteria workflow', async () => {
    // This test validates all acceptance criteria in one comprehensive workflow

    const workflow: Array<{ step: string; completed: boolean }> = [
      { step: 'Agent requests permission', completed: false },
      { step: 'External CLI/API receives request', completed: false },
      { step: 'External source grants permission', completed: false },
      { step: 'Permission store is updated', completed: false },
      { step: 'permission:granted event is emitted', completed: false }
    ];

    let grantEventReceived = false;

    orchestrator.on('permission:granted', (data) => {
      grantEventReceived = true;
      // Verify external source confirmation
      expect(data.grantedBy).toMatch(/^external-/);
    });

    // Step 1: Agent requests permission
    const requestId = await orchestrator.requestPermission(
      'acceptance-criteria-test',
      'ComplexTool',
      '/complex/operation/path',
      'Complex operation requiring external approval',
      true,
      'complex-agent',
      { complexity: 'high', requiresApproval: true }
    );

    workflow[0].completed = true; // Agent requests permission
    workflow[1].completed = true; // External CLI/API receives request (simulated)

    // Step 2: External CLI/API grants permission
    await orchestrator.grantPermissionConfirmation(
      requestId,
      'acceptance-criteria-test',
      'ComplexTool',
      '/complex/operation/path',
      'allow-once',
      'external-approval-system',
      'Complex operation approved after external review and validation'
    );

    workflow[2].completed = true; // External source grants permission

    // Step 3: Verify permission store is updated
    const hasPermission = await orchestrator['permissionManager'].hasPermission(
      'ComplexTool',
      '/complex/operation/path'
    );
    expect(hasPermission).toBe(true);

    workflow[3].completed = true; // Permission store is updated

    // Step 4: Verify event was emitted
    expect(grantEventReceived).toBe(true);

    workflow[4].completed = true; // permission:granted event is emitted

    // Verify all workflow steps completed
    const allCompleted = workflow.every(step => step.completed);
    expect(allCompleted).toBe(true);

    console.log('✅ PASS: Complete acceptance criteria workflow validated successfully');
    console.log('✅ ALL ACCEPTANCE CRITERIA MET:');
    console.log('  ✓ Orchestrator can receive and process permission confirmations from external sources');
    console.log('  ✓ Updates permission store on user decisions');
    console.log('  ✓ Emits permission:granted or permission:denied events accordingly');
  });
});