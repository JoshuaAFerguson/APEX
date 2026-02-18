/**
 * @fileoverview Type validation tests for confirmation flow test fixtures
 *
 * This file tests TypeScript type safety, export completeness,
 * and interface compatibility of the fixtures module.
 */

import { describe, it, expect } from 'vitest';
import type {
  PermissionRequestEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData,
  DangerousOperationDetectedEventData,
  DangerousOperationConfirmedEventData,
  DangerousOperationBlockedEventData,
  ApprovalRequiredEventData,
  ApprovalGrantedEventData,
  ApprovalDeniedEventData,
  ApprovalResolvedEventData,
  PermissionLevel,
  ApprovalCheckpointType,
} from '@apexcli/core';

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
  generateTimeoutScenarios,
  type ConfirmationScenario,
  type PermissionMatrixEntry,
  type RiskLevelScenario,
  type TimeoutScenario,
  // Backwards compatibility exports
  createMockPermissionRequestEventData,
  createMockPermissionGrantedEventData,
  createMockPermissionDeniedEventData,
  createMockDangerousOperationDetectedEventData,
  createMockDangerousOperationConfirmedEventData,
  createMockDangerousOperationBlockedEventData,
  createMockApprovalRequiredEventData,
  createMockApprovalGrantedEventData,
  createMockApprovalDeniedEventData,
  createMockApprovalResolvedEventData,
} from './confirmation-flows';

describe('Confirmation Flow Fixtures - Type Tests', () => {

  describe('Factory Function Type Compatibility', () => {
    it('should return correctly typed permission request events', () => {
      const request = createMockPermissionRequest();

      // Type assertions to verify compatibility
      const typedRequest: PermissionRequestEventData = request;

      expect(typedRequest.requestId).toMatch(/^req_/);
      expect(typeof typedRequest.tool).toBe('string');
      expect(typeof typedRequest.description).toBe('string');
      expect(typeof typedRequest.isDangerous).toBe('boolean');
      expect(typeof typedRequest.agent).toBe('string');
      expect(typedRequest.timestamp).toBeInstanceOf(Date);
      expect(typeof typedRequest.metadata).toBe('object');
    });

    it('should return correctly typed permission granted events', () => {
      const granted = createMockPermissionGranted();

      const typedGranted: PermissionGrantedEventData = granted;

      expect(typedGranted.requestId).toMatch(/^req_/);
      expect(typeof typedGranted.tool).toBe('string');
      expect(['allow-always', 'allow-once', 'deny']).toContain(typedGranted.level);
      expect(typeof typedGranted.grantedBy).toBe('string');
      expect(typedGranted.timestamp).toBeInstanceOf(Date);
    });

    it('should return correctly typed permission denied events', () => {
      const denied = createMockPermissionDenied();

      const typedDenied: PermissionDeniedEventData = denied;

      expect(typedDenied.requestId).toMatch(/^req_/);
      expect(typeof typedDenied.tool).toBe('string');
      expect(typeof typedDenied.deniedBy).toBe('string');
      expect(typeof typedDenied.reason).toBe('string');
      expect(typedDenied.timestamp).toBeInstanceOf(Date);
    });

    it('should return correctly typed dangerous operation detected events', () => {
      const detected = createMockDangerousOperationDetected();

      const typedDetected: DangerousOperationDetectedEventData = detected;

      expect(typedDetected.operationId).toMatch(/^op_/);
      expect(typeof typedDetected.tool).toBe('string');
      expect(typeof typedDetected.operation).toBe('string');
      expect(['low', 'medium', 'high', 'critical']).toContain(typedDetected.riskLevel);
      expect(typeof typedDetected.riskDescription).toBe('string');
      expect(typeof typedDetected.agent).toBe('string');
      expect(typedDetected.timestamp).toBeInstanceOf(Date);
    });

    it('should return correctly typed dangerous operation confirmed events', () => {
      const confirmed = createMockDangerousOperationConfirmed();

      const typedConfirmed: DangerousOperationConfirmedEventData = confirmed;

      expect(typedConfirmed.operationId).toMatch(/^op_/);
      expect(typeof typedConfirmed.tool).toBe('string');
      expect(typeof typedConfirmed.operation).toBe('string');
      expect(typeof typedConfirmed.confirmedBy).toBe('string');
      expect(typedConfirmed.timestamp).toBeInstanceOf(Date);
    });

    it('should return correctly typed dangerous operation blocked events', () => {
      const blocked = createMockDangerousOperationBlocked();

      const typedBlocked: DangerousOperationBlockedEventData = blocked;

      expect(typedBlocked.operationId).toMatch(/^op_/);
      expect(typeof typedBlocked.tool).toBe('string');
      expect(typeof typedBlocked.operation).toBe('string');
      expect(typeof typedBlocked.blockedBy).toBe('string');
      expect(typeof typedBlocked.reason).toBe('string');
      expect(typedBlocked.timestamp).toBeInstanceOf(Date);
    });

    it('should return correctly typed approval required events', () => {
      const required = createMockApprovalRequired();

      const typedRequired: ApprovalRequiredEventData = required;

      expect(typedRequired.approvalId).toMatch(/^approval_/);
      expect(typedRequired.taskId).toMatch(/^task_/);
      expect(typeof typedRequired.gateName).toBe('string');
      expect(typeof typedRequired.gateType).toBe('string');
      expect(typedRequired.timestamp).toBeInstanceOf(Date);
    });

    it('should return correctly typed approval granted events', () => {
      const granted = createMockApprovalGranted();

      const typedGranted: ApprovalGrantedEventData = granted;

      expect(typedGranted.approvalId).toMatch(/^approval_/);
      expect(typedGranted.taskId).toMatch(/^task_/);
      expect(typeof typedGranted.approver).toBe('string');
      expect(typedGranted.timestamp).toBeInstanceOf(Date);
    });

    it('should return correctly typed approval denied events', () => {
      const denied = createMockApprovalDenied();

      const typedDenied: ApprovalDeniedEventData = denied;

      expect(typedDenied.approvalId).toMatch(/^approval_/);
      expect(typedDenied.taskId).toMatch(/^task_/);
      expect(typeof typedDenied.approver).toBe('string');
      expect(typeof typedDenied.reason).toBe('string');
      expect(typedDenied.timestamp).toBeInstanceOf(Date);
    });

    it('should return correctly typed approval resolved events', () => {
      const resolved = createMockApprovalResolved();

      const typedResolved: ApprovalResolvedEventData = resolved;

      expect(typedResolved.approvalId).toMatch(/^approval_/);
      expect(typedResolved.taskId).toMatch(/^task_/);
      expect(typeof typedResolved.gateName).toBe('string');
      expect(['approved', 'denied', 'timeout', 'cancelled']).toContain(typedResolved.resolution);
      expect(typedResolved.timestamp).toBeInstanceOf(Date);
      expect(typedResolved.requestedAt).toBeInstanceOf(Date);
    });
  });

  describe('Scenario Type Compatibility', () => {
    it('should have properly typed permission scenarios', () => {
      const approvedScenarios = PERMISSION_SCENARIOS.approved;

      approvedScenarios.forEach(scenario => {
        const typedScenario: ConfirmationScenario<PermissionRequestEventData, PermissionGrantedEventData> = scenario;

        expect(typeof typedScenario.name).toBe('string');
        expect(typeof typedScenario.description).toBe('string');
        expect(typeof typedScenario.expectedOutcome).toBe('string');

        const request: PermissionRequestEventData = typedScenario.request;
        const response: PermissionGrantedEventData = typedScenario.response;

        expect(request.requestId).toBeTruthy();
        expect(response.requestId).toBeTruthy();
      });

      const deniedScenarios = PERMISSION_SCENARIOS.denied;

      deniedScenarios.forEach(scenario => {
        const typedScenario: ConfirmationScenario<PermissionRequestEventData, PermissionDeniedEventData> = scenario;

        const request: PermissionRequestEventData = typedScenario.request;
        const response: PermissionDeniedEventData = typedScenario.response;

        expect(request.requestId).toBeTruthy();
        expect(response.requestId).toBeTruthy();
        expect(response.reason).toBeTruthy();
      });
    });

    it('should have properly typed dangerous operation scenarios', () => {
      const confirmedScenarios = DANGEROUS_OPERATION_SCENARIOS.confirmed;

      confirmedScenarios.forEach(scenario => {
        const typedScenario: ConfirmationScenario<DangerousOperationDetectedEventData, DangerousOperationConfirmedEventData> = scenario;

        const request: DangerousOperationDetectedEventData = typedScenario.request;
        const response: DangerousOperationConfirmedEventData = typedScenario.response;

        expect(request.operationId).toBeTruthy();
        expect(response.operationId).toBeTruthy();
      });

      const blockedScenarios = DANGEROUS_OPERATION_SCENARIOS.blocked;

      blockedScenarios.forEach(scenario => {
        const typedScenario: ConfirmationScenario<DangerousOperationDetectedEventData, DangerousOperationBlockedEventData> = scenario;

        const request: DangerousOperationDetectedEventData = typedScenario.request;
        const response: DangerousOperationBlockedEventData = typedScenario.response;

        expect(request.operationId).toBeTruthy();
        expect(response.operationId).toBeTruthy();
        expect(response.reason).toBeTruthy();
      });
    });

    it('should have properly typed approval scenarios', () => {
      const approvedScenarios = APPROVAL_SCENARIOS.approved;

      approvedScenarios.forEach(scenario => {
        const typedScenario: ConfirmationScenario<ApprovalRequiredEventData, ApprovalGrantedEventData> = scenario;

        const request: ApprovalRequiredEventData = typedScenario.request;
        const response: ApprovalGrantedEventData = typedScenario.response;

        expect(request.approvalId).toBeTruthy();
        expect(response.approvalId).toBeTruthy();
      });
    });
  });

  describe('Generator Function Type Compatibility', () => {
    it('should generate properly typed permission matrix entries', () => {
      const matrix = generatePermissionMatrix(['Read', 'Write']);

      matrix.forEach(entry => {
        const typedEntry: PermissionMatrixEntry = entry;

        expect(typeof typedEntry.tool).toBe('string');
        expect(['allow-always', 'allow-once', 'deny']).toContain(typedEntry.level);

        const request: PermissionRequestEventData = typedEntry.request;
        const grantedResponse: PermissionGrantedEventData = typedEntry.grantedResponse;
        const deniedResponse: PermissionDeniedEventData = typedEntry.deniedResponse;

        expect(request.tool).toBe(typedEntry.tool);
        expect(grantedResponse.tool).toBe(typedEntry.tool);
        expect(deniedResponse.tool).toBe(typedEntry.tool);
        expect(grantedResponse.level).toBe(typedEntry.level);
      });
    });

    it('should generate properly typed risk level scenarios', () => {
      const scenarios = generateRiskLevelScenarios();

      scenarios.forEach(scenario => {
        const typedScenario: RiskLevelScenario = scenario;

        expect(['low', 'medium', 'high', 'critical']).toContain(typedScenario.riskLevel);

        const operation: DangerousOperationDetectedEventData = typedScenario.operation;
        const confirmed: DangerousOperationConfirmedEventData = typedScenario.confirmedResponse;
        const blocked: DangerousOperationBlockedEventData = typedScenario.blockedResponse;

        expect(operation.riskLevel).toBe(typedScenario.riskLevel);
        expect(confirmed.operationId).toBe(operation.operationId);
        expect(blocked.operationId).toBe(operation.operationId);
      });
    });

    it('should generate properly typed timeout scenarios', () => {
      const scenarios = generateTimeoutScenarios();

      scenarios.forEach(scenario => {
        const typedScenario: TimeoutScenario = scenario;

        expect(typeof typedScenario.name).toBe('string');
        expect(typeof typedScenario.timeoutMinutes).toBe('number');
        expect(['reject', 'approve', 'escalate']).toContain(typedScenario.timeoutAction);

        const request: ApprovalRequiredEventData = typedScenario.request;
        const resolution: ApprovalResolvedEventData = typedScenario.expectedResolution;

        expect(request.timeoutMinutes).toBe(typedScenario.timeoutMinutes);
        expect(resolution.approvalId).toBe(request.approvalId);
      });
    });
  });

  describe('Backwards Compatibility Types', () => {
    it('should export backwards compatible factory functions', () => {
      // Test that all backwards compatibility exports exist and have correct types
      expect(typeof createMockPermissionRequestEventData).toBe('function');
      expect(typeof createMockPermissionGrantedEventData).toBe('function');
      expect(typeof createMockPermissionDeniedEventData).toBe('function');
      expect(typeof createMockDangerousOperationDetectedEventData).toBe('function');
      expect(typeof createMockDangerousOperationConfirmedEventData).toBe('function');
      expect(typeof createMockDangerousOperationBlockedEventData).toBe('function');
      expect(typeof createMockApprovalRequiredEventData).toBe('function');
      expect(typeof createMockApprovalGrantedEventData).toBe('function');
      expect(typeof createMockApprovalDeniedEventData).toBe('function');
      expect(typeof createMockApprovalResolvedEventData).toBe('function');

      // Test that they return the same types as the main exports
      expect(createMockPermissionRequestEventData).toBe(createMockPermissionRequest);
      expect(createMockPermissionGrantedEventData).toBe(createMockPermissionGranted);
      expect(createMockPermissionDeniedEventData).toBe(createMockPermissionDenied);
    });

    it('should maintain type compatibility for legacy usage', () => {
      // Test that legacy factory names return compatible types
      const legacyRequest = createMockPermissionRequestEventData();
      const modernRequest = createMockPermissionRequest();

      const typedLegacy: PermissionRequestEventData = legacyRequest;
      const typedModern: PermissionRequestEventData = modernRequest;

      expect(typeof typedLegacy.requestId).toBe(typeof typedModern.requestId);
      expect(typeof typedLegacy.tool).toBe(typeof typedModern.tool);
    });
  });

  describe('Enum Type Compatibility', () => {
    it('should handle all permission levels correctly', () => {
      const levels: PermissionLevel[] = ['allow-always', 'allow-once', 'deny'];

      levels.forEach(level => {
        const granted = createMockPermissionGranted({ level });
        const typedGranted: PermissionGrantedEventData = granted;
        expect(typedGranted.level).toBe(level);
      });
    });

    it('should handle all approval checkpoint types correctly', () => {
      const checkpointTypes: ApprovalCheckpointType[] = [
        'before-commit',
        'before-deploy',
        'before-destructive',
        'before-network',
        'before-file-write',
        'deployment',
        'custom'
      ];

      checkpointTypes.forEach(gateType => {
        const approval = createMockApprovalRequired({ gateType });
        const typedApproval: ApprovalRequiredEventData = approval;
        expect(typedApproval.gateType).toBe(gateType);
      });
    });

    it('should handle all risk levels correctly', () => {
      const riskLevels = ['low', 'medium', 'high', 'critical'] as const;

      riskLevels.forEach(riskLevel => {
        const detected = createMockDangerousOperationDetected({ riskLevel });
        expect(detected.riskLevel).toBe(riskLevel);
      });
    });
  });

  describe('Type Inference Tests', () => {
    it('should correctly infer types from function calls', () => {
      // TypeScript should infer these types correctly
      const inferredRequest = createMockPermissionRequest();
      const inferredGranted = createMockPermissionGranted();
      const inferredOperation = createMockDangerousOperationDetected();
      const inferredApproval = createMockApprovalRequired();

      // These should compile without explicit type annotations
      function acceptsPermissionRequest(req: PermissionRequestEventData) {
        return req.requestId;
      }

      function acceptsPermissionGranted(granted: PermissionGrantedEventData) {
        return granted.level;
      }

      function acceptsDangerousOperation(op: DangerousOperationDetectedEventData) {
        return op.riskLevel;
      }

      function acceptsApproval(approval: ApprovalRequiredEventData) {
        return approval.gateName;
      }

      expect(acceptsPermissionRequest(inferredRequest)).toBeTruthy();
      expect(acceptsPermissionGranted(inferredGranted)).toBeTruthy();
      expect(acceptsDangerousOperation(inferredOperation)).toBeTruthy();
      expect(acceptsApproval(inferredApproval)).toBeTruthy();
    });
  });
});