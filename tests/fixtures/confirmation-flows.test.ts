/**
 * @fileoverview Tests for the confirmation flow test fixtures
 *
 * This file tests the fixtures themselves to ensure they generate
 * valid data structures and handle edge cases correctly.
 */

import { describe, it, expect } from 'vitest';
import {
  createMockPermissionRequest,
  createMockPermissionGranted,
  createMockPermissionDenied,
  createMockDangerousOperationDetected,
  createMockDangerousOperationConfirmed,
  createMockDangerousOperationBlocked,
  createMockApprovalRequired,
  createMockApprovalGranted,
  createMockApprovalDenied,
  createMockApprovalResolved,
  PERMISSION_SCENARIOS,
  DANGEROUS_OPERATION_SCENARIOS,
  APPROVAL_SCENARIOS,
  generatePermissionMatrix,
  generateRiskLevelScenarios,
  generateTimeoutScenarios
} from './confirmation-flows';

describe('Confirmation Flow Test Fixtures', () => {
  describe('Permission Request Factories', () => {
    it('should create valid permission request with defaults', () => {
      const request = createMockPermissionRequest();

      expect(request.requestId).toMatch(/^req_\d+_[a-z0-9]{9}$/);
      expect(request.tool).toBe('Read');
      expect(request.description).toBe('Mock permission request for testing');
      expect(request.isDangerous).toBe(false);
      expect(request.agent).toBe('test-agent');
      expect(request.timestamp).toBeInstanceOf(Date);
      expect(request.metadata).toEqual({});
    });

    it('should create permission request with overrides', () => {
      const overrides = {
        tool: 'Write',
        scope: '/project/test.ts',
        description: 'Custom test description',
        isDangerous: true
      };

      const request = createMockPermissionRequest(overrides);

      expect(request.tool).toBe('Write');
      expect(request.scope).toBe('/project/test.ts');
      expect(request.description).toBe('Custom test description');
      expect(request.isDangerous).toBe(true);
    });

    it('should create valid permission granted event', () => {
      const granted = createMockPermissionGranted({
        tool: 'Bash',
        level: 'allow-once'
      });

      expect(granted.requestId).toMatch(/^req_\d+_[a-z0-9]{9}$/);
      expect(granted.tool).toBe('Bash');
      expect(granted.level).toBe('allow-once');
      expect(granted.grantedBy).toBe('test-user');
      expect(granted.timestamp).toBeInstanceOf(Date);
    });

    it('should create valid permission denied event', () => {
      const denied = createMockPermissionDenied({
        tool: 'WebFetch',
        reason: 'Security policy violation'
      });

      expect(denied.tool).toBe('WebFetch');
      expect(denied.reason).toBe('Security policy violation');
      expect(denied.deniedBy).toBe('test-system');
      expect(denied.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Dangerous Operation Factories', () => {
    it('should create valid dangerous operation detection', () => {
      const detected = createMockDangerousOperationDetected();

      expect(detected.operationId).toMatch(/^op_\d+_[a-z0-9]{9}$/);
      expect(detected.tool).toBe('Bash');
      expect(detected.operation).toBe('rm -rf temp/');
      expect(detected.riskLevel).toBe('medium');
      expect(detected.agent).toBe('test-agent');
      expect(detected.timestamp).toBeInstanceOf(Date);
    });

    it('should create confirmed operation with matching IDs', () => {
      const detected = createMockDangerousOperationDetected({ tool: 'WebFetch' });
      const confirmed = createMockDangerousOperationConfirmed({
        operationId: detected.operationId,
        tool: detected.tool,
        operation: detected.operation
      });

      expect(confirmed.operationId).toBe(detected.operationId);
      expect(confirmed.tool).toBe(detected.tool);
      expect(confirmed.operation).toBe(detected.operation);
    });

    it('should create blocked operation with matching IDs', () => {
      const detected = createMockDangerousOperationDetected({ riskLevel: 'critical' });
      const blocked = createMockDangerousOperationBlocked({
        operationId: detected.operationId,
        reason: 'Auto-blocked critical operation'
      });

      expect(blocked.operationId).toBe(detected.operationId);
      expect(blocked.reason).toBe('Auto-blocked critical operation');
    });
  });

  describe('Approval Gate Factories', () => {
    it('should create valid approval request with defaults', () => {
      const approval = createMockApprovalRequired();

      expect(approval.approvalId).toMatch(/^approval_\d+_[a-z0-9]{9}$/);
      expect(approval.taskId).toMatch(/^task_\d+_[a-z0-9]{9}$/);
      expect(approval.gateName).toBe('test-gate');
      expect(approval.gateType).toBe('custom');
      expect(approval.minApprovals).toBe(1);
      expect(approval.blocking).toBe(true);
    });

    it('should create approval granted with matching IDs', () => {
      const request = createMockApprovalRequired({ gateName: 'deploy-gate' });
      const granted = createMockApprovalGranted({
        approvalId: request.approvalId,
        taskId: request.taskId
      });

      expect(granted.approvalId).toBe(request.approvalId);
      expect(granted.taskId).toBe(request.taskId);
    });

    it('should create approval resolved with duration calculation', () => {
      const requestedAt = new Date('2024-01-01T10:00:00Z');
      const resolvedAt = new Date('2024-01-01T11:30:00Z');

      const resolved = createMockApprovalResolved({
        requestedAt,
        timestamp: resolvedAt
      });

      expect(resolved.totalDurationMs).toBe(90 * 60 * 1000); // 90 minutes
      expect(resolved.requestedAt).toEqual(requestedAt);
      expect(resolved.timestamp).toEqual(resolvedAt);
    });
  });

  describe('Standard Test Scenarios', () => {
    it('should provide permission approval scenarios', () => {
      expect(PERMISSION_SCENARIOS.approved).toHaveLength(2);

      const scenario = PERMISSION_SCENARIOS.approved[0];
      expect(scenario.name).toBe('File read permission granted always');
      expect(scenario.expectedOutcome).toBe('approved');
      expect(scenario.request.tool).toBe('Read');
      expect(scenario.response.level).toBe('allow-always');
    });

    it('should provide permission denial scenarios', () => {
      expect(PERMISSION_SCENARIOS.denied).toHaveLength(2);

      const scenario = PERMISSION_SCENARIOS.denied[0];
      expect(scenario.name).toBe('Network access denied by policy');
      expect(scenario.expectedOutcome).toBe('denied');
      expect(scenario.request.isDangerous).toBe(true);
    });

    it('should provide dangerous operation scenarios', () => {
      expect(DANGEROUS_OPERATION_SCENARIOS.confirmed).toHaveLength(2);
      expect(DANGEROUS_OPERATION_SCENARIOS.blocked).toHaveLength(2);

      const confirmedScenario = DANGEROUS_OPERATION_SCENARIOS.confirmed[0];
      expect(confirmedScenario.expectedOutcome).toBe('approved');

      const blockedScenario = DANGEROUS_OPERATION_SCENARIOS.blocked[0];
      expect(blockedScenario.expectedOutcome).toBe('blocked');
    });

    it('should provide approval scenarios for all outcomes', () => {
      expect(APPROVAL_SCENARIOS.approved).toHaveLength(2);
      expect(APPROVAL_SCENARIOS.denied).toHaveLength(2);
      expect(APPROVAL_SCENARIOS.timeout).toHaveLength(2);
    });
  });

  describe('Parameterized Generators', () => {
    it('should generate permission matrix for tools and levels', () => {
      const matrix = generatePermissionMatrix(['Read', 'Write']);

      expect(matrix).toHaveLength(6); // 2 tools × 3 levels

      const readAlwaysEntry = matrix.find(entry =>
        entry.tool === 'Read' && entry.level === 'allow-always'
      );
      expect(readAlwaysEntry).toBeDefined();
      expect(readAlwaysEntry!.request.tool).toBe('Read');
      expect(readAlwaysEntry!.grantedResponse.level).toBe('allow-always');
      expect(readAlwaysEntry!.deniedResponse.tool).toBe('Read');
    });

    it('should generate risk level scenarios for all levels', () => {
      const scenarios = generateRiskLevelScenarios();

      expect(scenarios).toHaveLength(4);

      const levels = scenarios.map(s => s.riskLevel);
      expect(levels).toEqual(['low', 'medium', 'high', 'critical']);

      const criticalScenario = scenarios.find(s => s.riskLevel === 'critical');
      expect(criticalScenario!.operation.riskLevel).toBe('critical');
    });

    it('should generate timeout scenarios with different durations', () => {
      const scenarios = generateTimeoutScenarios();

      expect(scenarios.length).toBeGreaterThan(0);

      const quickTimeout = scenarios.find(s => s.timeoutMinutes === 5);
      expect(quickTimeout).toBeDefined();
      expect(quickTimeout!.expectedResolution.resolution).toBe('timeout');
    });
  });

  describe('ID Generation', () => {
    it('should generate unique IDs for concurrent calls', () => {
      const request1 = createMockPermissionRequest();
      const request2 = createMockPermissionRequest();

      expect(request1.requestId).not.toBe(request2.requestId);
    });

    it('should generate IDs with correct prefixes', () => {
      const permissionRequest = createMockPermissionRequest();
      const operationDetected = createMockDangerousOperationDetected();
      const approvalRequest = createMockApprovalRequired();

      expect(permissionRequest.requestId).toMatch(/^req_/);
      expect(operationDetected.operationId).toMatch(/^op_/);
      expect(approvalRequest.approvalId).toMatch(/^approval_/);
      expect(approvalRequest.taskId).toMatch(/^task_/);
    });
  });
});