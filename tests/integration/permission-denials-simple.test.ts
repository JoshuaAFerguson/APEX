/**
 * @fileoverview Simple Permission Denials Integration Test
 *
 * Simplified test to verify the integration test implementation is working correctly.
 * Tests basic denial functionality to validate our comprehensive test file.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import { ApexOrchestrator } from '@apexcli/orchestrator';

describe('Permission Denials - Simple Integration Test', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'apex-simple-denial-test-'));

    const apexDir = join(tempDir, '.apex');
    await mkdir(apexDir, { recursive: true });

    // Minimal config
    const config = `
project:
  name: simple-denial-test
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: review-all

agents:
  test-agent:
    role: "Simple test agent"
    model: sonnet
    tools: [Read, Write]

workflows:
  simple-test:
    name: "Simple Test"
    agents: [test-agent]
    stages:
      - name: test
        agent: test-agent
        description: "Simple test stage"

limits:
  maxTasksPerHour: 100
  maxCostPerTask: 10.0
`;

    await writeFile(join(apexDir, 'config.yaml'), config);

    orchestrator = new ApexOrchestrator(tempDir);
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

  describe('Basic Denial Functionality', () => {
    it('should deny permission explicitly and prevent tool execution', async () => {
      // GIVEN: Explicitly denied permission
      await orchestrator.permissionManager.grantPermission('Write', '/denied/file', 'deny');

      // WHEN: Checking tool permission for denied resource
      const result = await orchestrator.permissionManager.checkToolPermission('Write', {
        scope: '/denied/file',
        operation: 'file-write'
      });

      // THEN: Tool execution should be prevented
      expect(result.allowed).toBe(false);
      expect(result.denialReason).toContain('denied');
      expect(result.level).toBe('deny');
    });

    it('should track denial through confirmation flow', async () => {
      // GIVEN: A permission request
      const requestId = await orchestrator.requestPermission(
        'simple-test-task',
        'Write',
        '/test/file',
        'Simple test operation',
        false,
        'test-agent'
      );

      // WHEN: Denying the permission
      await orchestrator.denyPermissionConfirmation(
        requestId,
        'simple-test-task',
        'Write',
        '/test/file',
        'test-denier',
        'Simple denial test'
      );

      // THEN: Permission should be denied
      const deniedPermission = await orchestrator.permissionManager.checkPermission('Write', '/test/file');
      expect(deniedPermission).toBe('deny');
    });

    it('should allow re-requesting denied permissions', async () => {
      // GIVEN: Initially denied permission
      const initialRequestId = await orchestrator.requestPermission(
        'initial-task',
        'Read',
        '/re-request/test',
        'Initial request',
        false,
        'test-agent'
      );

      await orchestrator.denyPermissionConfirmation(
        initialRequestId,
        'initial-task',
        'Read',
        '/re-request/test',
        'initial-denier',
        'Initial denial'
      );

      // Verify initial denial
      const initialCheck = await orchestrator.permissionManager.checkPermission('Read', '/re-request/test');
      expect(initialCheck).toBe('deny');

      // WHEN: Re-requesting the same permission
      const newRequestId = await orchestrator.requestPermission(
        'retry-task',
        'Read',
        '/re-request/test',
        'Re-request after review',
        false,
        'test-agent'
      );

      // THEN: Should receive new request ID
      expect(newRequestId).toBeDefined();
      expect(newRequestId).not.toBe(initialRequestId);

      // WHEN: Granting the re-request
      await orchestrator.grantPermissionConfirmation(
        newRequestId,
        'retry-task',
        'Read',
        '/re-request/test',
        'allow-once',
        'approver',
        'Approved after review'
      );

      // THEN: Permission should now be allowed
      const finalCheck = await orchestrator.permissionManager.checkPermission('Read', '/re-request/test');
      expect(finalCheck).toBe('allow-once');
    });
  });
});