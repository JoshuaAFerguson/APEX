/**
 * Event Data Integrity Test Suite
 *
 * Comprehensive validation tests for APEX event data integrity across all event types.
 * Tests JSON serialization, schema validation, field constraints, and cross-references.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitter } from 'eventemitter3';
import { EventCapture, createEventCapture } from '../packages/orchestrator/tests/utils/event-capture';
import {
  ApprovalRequiredEventDataSchema,
  ApprovalResponseEventDataSchema,
  ApprovalGrantedEventDataSchema,
  ApprovalDeniedEventDataSchema,
  ApprovalResolvedEventDataSchema,
  type ApprovalRequiredEventData,
  type ApprovalResponseEventData,
  type ApprovalGrantedEventData,
  type ApprovalDeniedEventData,
  type ApprovalResolvedEventData,
  type ContainerEventDataBase,
  type ContainerCreatedEventData,
  type ContainerStartedEventData,
  type ContainerStoppedEventData,
  type ContainerDiedEventData,
  type ContainerRemovedEventData,
  type ContainerHealthEventData,
  type PermissionRequestEventData,
  type PermissionGrantedEventData,
  type PermissionDeniedEventData,
  type DangerousOperationDetectedEventData,
  type DangerousOperationConfirmedEventData,
  type DangerousOperationBlockedEventData,
} from '../packages/core/src/types';
import {
  generateTestId,
  createTestTimestamp,
  validateJsonRoundTrip,
  validateRequiredFields,
  validateFieldTypes,
  validateStringConstraints,
  validateNumericConstraints,
  createSchemaTestHelper,
  EventSequenceValidator,
  CrossReferenceValidator,
  eventAssert,
} from './event-data-integrity/shared/event-test-utils';

describe('Event Data Integrity', () => {
  let emitter: EventEmitter;
  let eventCapture: EventCapture;

  beforeEach(() => {
    emitter = new EventEmitter();
    eventCapture = createEventCapture(emitter);
  });

  afterEach(() => {
    eventCapture?.dispose();
  });

  describe('Approval Event Data Integrity', () => {
    const approvalHelper = createSchemaTestHelper(ApprovalRequiredEventDataSchema);
    const responseHelper = createSchemaTestHelper(ApprovalResponseEventDataSchema);
    const grantedHelper = createSchemaTestHelper(ApprovalGrantedEventDataSchema);
    const deniedHelper = createSchemaTestHelper(ApprovalDeniedEventDataSchema);
    const resolvedHelper = createSchemaTestHelper(ApprovalResolvedEventDataSchema);

    describe('ApprovalRequired Event Data', () => {
      const createValidApprovalData = (): ApprovalRequiredEventData => ({
        approvalId: generateTestId('approval'),
        taskId: generateTestId('task'),
        gateName: 'manual-approval-gate',
        gateType: 'deployment',
        description: 'Manual approval required for deployment',
        approvers: ['admin@example.com', 'deployer@example.com'],
        minApprovals: 1,
        timeoutMinutes: 30,
        expiresAt: createTestTimestamp(30 * 60 * 1000), // 30 minutes
        stage: 'deployment',
        agent: 'deployment-agent',
        timestamp: createTestTimestamp(),
        context: { environment: 'production', version: '1.0.0' },
        changesSummary: 'Deploy version 1.0.0 to production',
        affectedFiles: ['package.json', 'src/main.ts'],
        blocking: true,
        approvalUrl: 'https://apex.example.com/approvals/123',
      });

      it('should validate complete approval required data', () => {
        const data = createValidApprovalData();
        expect(() => approvalHelper.expectValid(data)).not.toThrow();
      });

      it('should validate minimal approval required data', () => {
        const minimalData: ApprovalRequiredEventData = {
          approvalId: generateTestId('approval'),
          taskId: generateTestId('task'),
          gateName: 'test-gate',
          gateType: 'deployment',
          timestamp: createTestTimestamp(),
        };
        expect(() => approvalHelper.expectValid(minimalData)).not.toThrow();
      });

      it('should reject invalid approval data', () => {
        const invalidData = {
          approvalId: '', // Empty string should fail
          taskId: generateTestId('task'),
          gateName: 'test-gate',
          gateType: 'deployment',
          timestamp: createTestTimestamp(),
        };
        expect(() => approvalHelper.expectInvalid(invalidData)).not.toThrow();
      });

      it('should survive JSON round-trip serialization', () => {
        const data = createValidApprovalData();
        const result = validateJsonRoundTrip(data, [
          'timestamp',
          'expiresAt'
        ]);

        expect(result.isValid).toBe(true);
        expect(result.differences).toHaveLength(0);
      });

      it('should validate required fields', () => {
        const data = createValidApprovalData();
        const result = validateRequiredFields(data, [
          'approvalId',
          'taskId',
          'gateName',
          'gateType',
          'timestamp'
        ]);

        expect(result.isValid).toBe(true);
        expect(result.missingFields).toHaveLength(0);
      });

      it('should validate field types', () => {
        const data = createValidApprovalData();
        const result = validateFieldTypes(data, {
          approvalId: 'string',
          taskId: 'string',
          gateName: 'string',
          minApprovals: 'number',
          timeoutMinutes: 'number',
          timestamp: 'date',
          expiresAt: 'date',
          blocking: 'boolean',
          approvers: 'array',
          context: 'object',
          affectedFiles: 'array',
        });

        expect(result.isValid).toBe(true);
        expect(result.typeErrors).toHaveLength(0);
      });

      it('should validate string constraints', () => {
        expect(() => {
          eventAssert.stringMatches(generateTestId('approval'), {
            minLength: 1,
            pattern: /^approval-\d+-[a-z0-9]+$/
          });
        }).not.toThrow();
      });

      it('should validate numeric constraints', () => {
        expect(() => {
          eventAssert.numberMatches(1, {
            min: 1,
            integer: true,
            positive: true
          });
        }).not.toThrow();
      });

      it('should handle event emission and capture', () => {
        const data = createValidApprovalData();
        emitter.emit('approval:required', data);

        const events = eventCapture.getEventsByType('approval:required');
        expect(events).toHaveLength(1);

        const capturedEvent = events[0];
        expect(capturedEvent.type).toBe('approval:required');
        expect(capturedEvent.data).toEqual(data);
        expect(capturedEvent.timestamp).toBeInstanceOf(Date);
        expect(capturedEvent.index).toBe(0);
      });
    });

    describe('ApprovalResponse Event Data', () => {
      const createValidResponseData = (): ApprovalResponseEventData => ({
        approvalId: generateTestId('approval'),
        taskId: generateTestId('task'),
        gateName: 'manual-approval-gate',
        gateType: 'deployment',
        approved: true,
        approver: 'admin@example.com',
        comment: 'Looks good to deploy',
        timestamp: createTestTimestamp(),
        requestedAt: createTestTimestamp(-300000), // 5 minutes ago
        responseTimeMs: 300000, // 5 minutes
        stage: 'deployment',
        approvalsReceived: 1,
        approvalsRequired: 1,
        allApprovalsReceived: true,
        context: { reviewedBy: 'admin', reviewedAt: new Date() },
      });

      it('should validate complete response data', () => {
        const data = createValidResponseData();
        expect(() => responseHelper.expectValid(data)).not.toThrow();
      });

      it('should calculate response time correctly', () => {
        const data = createValidResponseData();
        const expectedResponseTime = data.timestamp.getTime() - data.requestedAt.getTime();
        expect(data.responseTimeMs).toBe(expectedResponseTime);
      });

      it('should validate approval logic consistency', () => {
        const data = createValidResponseData();

        // If approved=true and approvalsReceived >= approvalsRequired, allApprovalsReceived should be true
        if (data.approved && data.approvalsReceived !== undefined && data.approvalsRequired !== undefined) {
          if (data.approvalsReceived >= data.approvalsRequired) {
            expect(data.allApprovalsReceived).toBe(true);
          }
        }
      });

      it('should survive JSON round-trip with dates', () => {
        const data = createValidResponseData();
        const result = validateJsonRoundTrip(data, [
          'timestamp',
          'requestedAt',
          'context.reviewedAt'
        ]);

        expect(result.isValid).toBe(true);
      });
    });

    describe('Approval Event Sequences', () => {
      it('should validate proper approval sequence', () => {
        const validator = new EventSequenceValidator([
          'approval:required',
          'approval:granted',
          'approval:resolved'
        ]);

        const approvalId = generateTestId('approval');
        const taskId = generateTestId('task');

        // Emit events in sequence
        validator.addEvent('approval:required', { approvalId, taskId });
        validator.addEvent('approval:granted', { approvalId, taskId });
        validator.addEvent('approval:resolved', { approvalId, taskId });

        const result = validator.validate();
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect missing events in sequence', () => {
        const validator = new EventSequenceValidator([
          'approval:required',
          'approval:granted',
          'approval:resolved'
        ]);

        const approvalId = generateTestId('approval');
        const taskId = generateTestId('task');

        // Emit incomplete sequence
        validator.addEvent('approval:required', { approvalId, taskId });
        validator.addEvent('approval:resolved', { approvalId, taskId }); // Missing granted

        const result = validator.validate();
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('approval:granted');
      });
    });

    describe('Approval Cross-Reference Validation', () => {
      it('should validate cross-references between approval events', () => {
        const crossRef = new CrossReferenceValidator();

        const approvalId = generateTestId('approval');
        const taskId = generateTestId('task');

        // Register references
        crossRef.registerReference('approvalId', approvalId);
        crossRef.registerReference('taskId', taskId);

        // Validate references exist
        const result = crossRef.validateReferences([
          { refType: 'approvalId', refValue: approvalId },
          { refType: 'taskId', refValue: taskId },
        ]);

        expect(result.isValid).toBe(true);
        expect(result.missingReferences).toHaveLength(0);
      });

      it('should detect missing cross-references', () => {
        const crossRef = new CrossReferenceValidator();

        const approvalId = generateTestId('approval');
        const taskId = generateTestId('task');

        // Register only one reference
        crossRef.registerReference('approvalId', approvalId);

        // Try to validate both
        const result = crossRef.validateReferences([
          { refType: 'approvalId', refValue: approvalId },
          { refType: 'taskId', refValue: taskId }, // Missing
        ]);

        expect(result.isValid).toBe(false);
        expect(result.missingReferences).toHaveLength(1);
        expect(result.missingReferences[0].refType).toBe('taskId');
      });
    });
  });

  describe('Container Event Data Integrity', () => {
    const createContainerEventBase = (): ContainerEventDataBase => ({
      containerId: generateTestId('container'),
      containerName: 'test-container',
      image: 'node:18-alpine',
      timestamp: createTestTimestamp(),
      metadata: {
        created: createTestTimestamp(),
        labels: { 'app': 'test', 'version': '1.0.0' },
        ports: [{ internal: 3000, external: 8080 }]
      }
    });

    describe('ContainerCreated Event Data', () => {
      it('should validate container created event', () => {
        const data: ContainerCreatedEventData = {
          ...createContainerEventBase(),
          command: ['node', 'server.js'],
          env: { NODE_ENV: 'production', PORT: '3000' },
          volumes: ['/app:/usr/src/app'],
          networks: ['default'],
          ports: [{ internal: 3000, external: 8080 }],
          labels: { 'app': 'test' }
        };

        expect(() => {
          eventAssert.hasRequiredFields(data, [
            'containerId',
            'containerName',
            'image',
            'timestamp'
          ]);
        }).not.toThrow();

        expect(() => {
          eventAssert.hasFieldType(data, 'containerId', 'string');
          eventAssert.hasFieldType(data, 'timestamp', 'date');
          eventAssert.hasFieldType(data, 'command', 'array');
          eventAssert.hasFieldType(data, 'env', 'object');
        }).not.toThrow();
      });

      it('should survive JSON serialization', () => {
        const data: ContainerCreatedEventData = {
          ...createContainerEventBase(),
          command: ['node', 'server.js'],
          env: { NODE_ENV: 'production' }
        };

        const result = validateJsonRoundTrip(data, ['timestamp', 'metadata.created']);
        expect(result.isValid).toBe(true);
      });
    });

    describe('ContainerHealth Event Data', () => {
      it('should validate container health data', () => {
        const data: ContainerHealthEventData = {
          ...createContainerEventBase(),
          status: 'healthy',
          healthCheck: {
            test: ['CMD', 'curl', '-f', 'http://localhost:3000/health'],
            interval: 30000,
            timeout: 10000,
            retries: 3,
            startPeriod: 60000
          },
          healthHistory: [
            { status: 'starting', timestamp: createTestTimestamp(-60000) },
            { status: 'healthy', timestamp: createTestTimestamp() }
          ]
        };

        expect(() => {
          eventAssert.stringMatches(data.status, {
            enum: ['starting', 'healthy', 'unhealthy']
          });
        }).not.toThrow();

        expect(() => {
          eventAssert.numberMatches(data.healthCheck.interval, {
            min: 1000, // Minimum 1 second
            integer: true
          });
        }).not.toThrow();
      });
    });
  });

  describe('Permission Event Data Integrity', () => {
    describe('PermissionRequest Event Data', () => {
      it('should validate permission request data', () => {
        const data: PermissionRequestEventData = {
          requestId: generateTestId('permission'),
          userId: 'user123',
          operation: 'file:write',
          resource: '/etc/config.json',
          reason: 'Update configuration',
          timestamp: createTestTimestamp(),
          context: {
            sessionId: generateTestId('session'),
            clientIP: '192.168.1.100'
          },
          requiredPermissions: ['admin', 'config:write'],
          autoGranted: false
        };

        expect(() => {
          eventAssert.hasRequiredFields(data, [
            'requestId',
            'userId',
            'operation',
            'resource',
            'timestamp'
          ]);
        }).not.toThrow();

        expect(() => {
          eventAssert.hasFieldType(data, 'autoGranted', 'boolean');
          eventAssert.hasFieldType(data, 'requiredPermissions', 'array');
        }).not.toThrow();
      });
    });

    describe('DangerousOperation Event Data', () => {
      it('should validate dangerous operation data', () => {
        const data: DangerousOperationDetectedEventData = {
          operationId: generateTestId('operation'),
          operation: 'file:delete',
          resource: '/important/data.json',
          dangerLevel: 'high',
          detectedBy: 'security-scanner',
          timestamp: createTestTimestamp(),
          context: {
            fileSize: 1048576,
            lastModified: createTestTimestamp(-86400000)
          },
          autoBlocked: true,
          requiresConfirmation: true
        };

        expect(() => {
          eventAssert.stringMatches(data.dangerLevel, {
            enum: ['low', 'medium', 'high', 'critical']
          });
        }).not.toThrow();

        expect(() => {
          eventAssert.hasField(data, 'autoBlocked', true);
          eventAssert.hasField(data, 'requiresConfirmation', true);
        }).not.toThrow();
      });
    });
  });

  describe('Event Payload Size and Performance', () => {
    it('should validate event payload size limits', () => {
      const largeData: ApprovalRequiredEventData = {
        approvalId: generateTestId('approval'),
        taskId: generateTestId('task'),
        gateName: 'test-gate',
        gateType: 'deployment',
        timestamp: createTestTimestamp(),
        description: 'A'.repeat(10000), // Large description
        context: {
          largeArray: new Array(1000).fill('data'),
          largeObject: Object.fromEntries(
            new Array(100).fill(0).map((_, i) => [`key${i}`, `value${i}`])
          )
        }
      };

      const serialized = JSON.stringify(largeData);
      const sizeKB = new Blob([serialized]).size / 1024;

      // Event payloads should be reasonable size (< 100KB for this test)
      expect(sizeKB).toBeLessThan(100);
    });

    it('should validate serialization performance', () => {
      const data: ApprovalRequiredEventData = {
        approvalId: generateTestId('approval'),
        taskId: generateTestId('task'),
        gateName: 'test-gate',
        gateType: 'deployment',
        timestamp: createTestTimestamp(),
        context: Object.fromEntries(
          new Array(50).fill(0).map((_, i) => [`key${i}`, { data: `value${i}`, timestamp: new Date() }])
        )
      };

      // Measure serialization time
      const start = performance.now();
      const serialized = JSON.stringify(data);
      const parsed = JSON.parse(serialized);
      const end = performance.now();

      const serializationTime = end - start;

      // Should serialize/deserialize quickly (< 10ms for this test)
      expect(serializationTime).toBeLessThan(10);
      expect(parsed).toBeDefined();
    });
  });

  describe('Event Data Corruption Detection', () => {
    it('should detect corrupted JSON data', () => {
      const validData: ApprovalRequiredEventData = {
        approvalId: generateTestId('approval'),
        taskId: generateTestId('task'),
        gateName: 'test-gate',
        gateType: 'deployment',
        timestamp: createTestTimestamp(),
      };

      // Simulate corruption by manually modifying serialized JSON
      let serialized = JSON.stringify(validData);
      serialized = serialized.replace('"manual"', '"corrupted-type"');

      const corruptedData = JSON.parse(serialized);

      // Should fail schema validation
      const approvalHelper = createSchemaTestHelper(ApprovalRequiredEventDataSchema);
      expect(() => approvalHelper.expectValid(corruptedData)).toThrow();
    });

    it('should detect missing required fields after transmission', () => {
      const incompleteData = {
        approvalId: generateTestId('approval'),
        // Missing required fields: taskId, gateName, gateType, timestamp
      };

      const result = validateRequiredFields(incompleteData as any, [
        'approvalId',
        'taskId',
        'gateName',
        'gateType',
        'timestamp'
      ]);

      expect(result.isValid).toBe(false);
      expect(result.missingFields).toContain('taskId');
      expect(result.missingFields).toContain('gateName');
      expect(result.missingFields).toContain('gateType');
      expect(result.missingFields).toContain('timestamp');
    });

    it('should detect type corruption', () => {
      const corruptedData = {
        approvalId: generateTestId('approval'),
        taskId: 12345, // Should be string, not number
        gateName: 'test-gate',
        gateType: 'deployment',
        timestamp: 'not-a-date', // Should be Date, not string
      };

      const result = validateFieldTypes(corruptedData as any, {
        approvalId: 'string',
        taskId: 'string',
        gateName: 'string',
        timestamp: 'date'
      });

      expect(result.isValid).toBe(false);
      expect(result.typeErrors).toContain('taskId: Expected string, got number');
    });
  });

  describe('Event Data Edge Cases', () => {
    it('should handle undefined and null values correctly', () => {
      const dataWithNulls: Partial<ApprovalRequiredEventData> = {
        approvalId: generateTestId('approval'),
        taskId: generateTestId('task'),
        gateName: 'test-gate',
        gateType: 'deployment',
        timestamp: createTestTimestamp(),
        description: undefined,
        approvers: null as any,
        context: undefined,
      };

      // Should handle undefined/null gracefully for optional fields
      const result = validateRequiredFields(dataWithNulls as any, [
        'approvalId',
        'taskId',
        'gateName',
        'gateType',
        'timestamp'
      ]);

      expect(result.isValid).toBe(true);
    });

    it('should handle empty arrays and objects', () => {
      const dataWithEmpties: ApprovalRequiredEventData = {
        approvalId: generateTestId('approval'),
        taskId: generateTestId('task'),
        gateName: 'test-gate',
        gateType: 'deployment',
        timestamp: createTestTimestamp(),
        approvers: [], // Empty array
        context: {}, // Empty object
        affectedFiles: [], // Empty array
      };

      const approvalHelper = createSchemaTestHelper(ApprovalRequiredEventDataSchema);
      expect(() => approvalHelper.expectValid(dataWithEmpties)).not.toThrow();
    });

    it('should handle maximum field lengths', () => {
      const maxLengthData: ApprovalRequiredEventData = {
        approvalId: generateTestId('approval'),
        taskId: generateTestId('task'),
        gateName: 'a'.repeat(1000), // Very long gate name
        gateType: 'deployment',
        timestamp: createTestTimestamp(),
        description: 'b'.repeat(10000), // Very long description
      };

      // Should handle long strings appropriately
      const result = validateStringConstraints(maxLengthData.gateName, {
        maxLength: 2000 // Should pass
      });

      expect(result.isValid).toBe(true);

      // Test exceeding limit
      const tooLong = validateStringConstraints(maxLengthData.gateName, {
        maxLength: 500 // Should fail
      });

      expect(tooLong.isValid).toBe(false);
    });

    it('should handle numeric edge cases', () => {
      const numericData: ApprovalRequiredEventData = {
        approvalId: generateTestId('approval'),
        taskId: generateTestId('task'),
        gateName: 'test-gate',
        gateType: 'deployment',
        timestamp: createTestTimestamp(),
        minApprovals: 0, // Edge case: zero approvals
        timeoutMinutes: Number.MAX_SAFE_INTEGER, // Very large number
      };

      expect(() => {
        eventAssert.numberMatches(numericData.minApprovals!, {
          min: 0,
          integer: true,
          nonNegative: true
        });
      }).not.toThrow();

      expect(() => {
        eventAssert.numberMatches(numericData.timeoutMinutes!, {
          min: 1,
          integer: true,
          positive: true
        });
      }).not.toThrow();
    });
  });
});