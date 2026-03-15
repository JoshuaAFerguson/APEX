/**
 * Event Data Integrity Integration Tests
 *
 * Tests event data integrity in realistic integration scenarios,
 * including multi-system interactions and end-to-end workflows.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { EventCapture, createEventCapture, createConfirmationEventCapture } from '../packages/orchestrator/tests/utils/event-capture';
import {
  ApprovalRequiredEventDataSchema,
  type ApprovalRequiredEventData,
  type ApprovalResponseEventData,
  type ApprovalGrantedEventData,
  type ContainerCreatedEventData,
  type ContainerStartedEventData,
  type ContainerStoppedEventData,
  type PermissionRequestEventData,
  type PermissionGrantedEventData,
  type DangerousOperationDetectedEventData,
} from '../packages/core/src/types';
import {
  generateTestId,
  createTestTimestamp,
  validateJsonRoundTrip,
  createSchemaTestHelper,
  EventSequenceValidator,
  CrossReferenceValidator,
  eventAssert,
} from './event-data-integrity/shared/event-test-utils';

describe('Event Data Integrity Integration', () => {
  let emitter: EventEmitter;
  let eventCapture: EventCapture;
  let confirmationCapture: EventCapture;

  beforeEach(() => {
    emitter = new EventEmitter();
    // Create event capture that captures all events for integration tests
    const testEventTypes = [
      'workflow:started', 'workflow:completed',
      'task:created', 'task:completed', 'task:started', 'task:failed', 'task:paused', 'task:stage-changed',
      'approval:required', 'approval:granted', 'approval:denied', 'approval:resolved',
      'container:created', 'container:started', 'container:stopped', 'container:removed',
      'permission:request', 'permission:granted', 'permission:denied',
      'dangerous:detected', 'dangerous:confirmed', 'dangerous:blocked',
      'test:persistence', 'message:sent', 'test:frequency', 'test:transform', 'test:transformed'
    ];
    eventCapture = createEventCapture(emitter, {
      filterTypes: testEventTypes,
      maxEvents: 2000 // Increase for high-frequency tests
    });
    confirmationCapture = createConfirmationEventCapture(emitter);
  });

  afterEach(() => {
    eventCapture?.dispose();
    confirmationCapture?.dispose();
  });

  describe('End-to-End Workflow Integrity', () => {
    it('should maintain data integrity through complete approval workflow', async () => {
      const workflowId = generateTestId('workflow');
      const taskId = generateTestId('task');
      const approvalId = generateTestId('approval');
      const userId = 'admin@example.com';

      const crossRef = new CrossReferenceValidator();
      const sequenceValidator = new EventSequenceValidator([
        'workflow:started',
        'task:created',
        'approval:required',
        'approval:granted',
        'task:completed',
        'workflow:completed'
      ]);

      // Step 1: Start workflow
      const workflowStartData = {
        workflowId,
        type: 'deployment',
        initiatedBy: userId,
        timestamp: createTestTimestamp(),
      };

      emitter.emit('workflow:started', workflowStartData);
      sequenceValidator.addEvent('workflow:started', workflowStartData);
      crossRef.registerReference('workflowId', workflowId);

      // Step 2: Create task
      const taskCreatedData = {
        taskId,
        workflowId,
        type: 'deploy',
        status: 'created',
        timestamp: createTestTimestamp(),
      };

      emitter.emit('task:created', taskCreatedData);
      sequenceValidator.addEvent('task:created', taskCreatedData);
      crossRef.registerReference('taskId', taskId);

      // Step 3: Approval required
      const approvalData: ApprovalRequiredEventData = {
        approvalId,
        taskId,
        gateName: 'production-deployment',
        gateType: 'deployment',
        description: 'Deployment to production requires manual approval',
        approvers: [userId],
        minApprovals: 1,
        timeoutMinutes: 60,
        timestamp: createTestTimestamp(),
        context: { workflowId, environment: 'production' },
      };

      emitter.emit('approval:required', approvalData);
      sequenceValidator.addEvent('approval:required', approvalData);
      crossRef.registerReference('approvalId', approvalId);

      // Step 4: Approval granted
      const approvalGrantedData: ApprovalGrantedEventData = {
        approvalId,
        taskId,
        approver: userId,
        comment: 'Deployment approved after review',
        timestamp: createTestTimestamp(),
      };

      emitter.emit('approval:granted', approvalGrantedData);
      sequenceValidator.addEvent('approval:granted', approvalGrantedData);

      // Step 5: Task completed
      const taskCompletedData = {
        taskId,
        workflowId,
        status: 'completed',
        result: 'success',
        timestamp: createTestTimestamp(),
      };

      emitter.emit('task:completed', taskCompletedData);
      sequenceValidator.addEvent('task:completed', taskCompletedData);

      // Step 6: Workflow completed
      const workflowCompletedData = {
        workflowId,
        status: 'completed',
        result: 'success',
        timestamp: createTestTimestamp(),
      };

      emitter.emit('workflow:completed', workflowCompletedData);
      sequenceValidator.addEvent('workflow:completed', workflowCompletedData);

      // Verify all events were captured
      const allEvents = eventCapture.getAllEvents();
      expect(allEvents).toHaveLength(6);

      // Verify confirmation events were captured separately
      const confirmationEvents = confirmationCapture.getAllEvents();
      expect(confirmationEvents.length).toBeGreaterThanOrEqual(2); // approval:required and approval:granted

      // Verify cross-references
      const refValidation = crossRef.validateReferences([
        { refType: 'workflowId', refValue: workflowId },
        { refType: 'taskId', refValue: taskId },
        { refType: 'approvalId', refValue: approvalId },
      ]);

      expect(refValidation.isValid).toBe(true);

      // Verify sequence
      const sequenceValidation = sequenceValidator.validate();
      expect(sequenceValidation.isValid).toBe(true);

      // Verify data integrity for approval event
      const approvalEvent = eventCapture.getEventsByType('approval:required')[0];
      expect(() => eventAssert.hasRequiredFields(approvalEvent.data, [
        'approvalId',
        'taskId',
        'gateName',
        'gateType',
        'timestamp'
      ])).not.toThrow();

      // Test JSON serialization of complete workflow
      allEvents.forEach(event => {
        const result = validateJsonRoundTrip(event.data, ['timestamp']);
        expect(result.isValid).toBe(true);
      });
    });

    it('should handle container lifecycle with event integrity', () => {
      const containerId = generateTestId('container');
      const containerName = 'test-app';
      const image = 'node:18-alpine';

      const lifecycleValidator = new EventSequenceValidator([
        'container:created',
        'container:started',
        'container:stopped',
        'container:removed'
      ]);

      const crossRef = new CrossReferenceValidator();
      crossRef.registerReference('containerId', containerId);

      // Container created
      const createdData: ContainerCreatedEventData = {
        containerId,
        containerName,
        image,
        timestamp: createTestTimestamp(),
        metadata: {
          created: createTestTimestamp(),
          labels: { 'app': 'test', 'version': '1.0.0' },
          ports: [{ internal: 3000, external: 8080 }]
        },
        command: ['node', 'server.js'],
        env: { NODE_ENV: 'production', PORT: '3000' },
        volumes: ['/app:/usr/src/app:ro'],
        networks: ['app-network'],
        ports: [{ internal: 3000, external: 8080 }],
        labels: { 'app': 'test' }
      };

      emitter.emit('container:created', createdData);
      lifecycleValidator.addEvent('container:created', createdData);

      // Container started
      const startedData: ContainerStartedEventData = {
        containerId,
        containerName,
        image,
        timestamp: createTestTimestamp(),
        metadata: {
          created: createTestTimestamp(-1000),
          labels: { 'app': 'test', 'version': '1.0.0' },
          ports: [{ internal: 3000, external: 8080 }]
        },
        pid: 12345,
        startTime: createTestTimestamp(),
        ports: [{ internal: 3000, external: 8080 }],
        networks: ['app-network']
      };

      emitter.emit('container:started', startedData);
      lifecycleValidator.addEvent('container:started', startedData);

      // Container stopped
      const stoppedData: ContainerStoppedEventData = {
        containerId,
        containerName,
        image,
        timestamp: createTestTimestamp(),
        metadata: {
          created: createTestTimestamp(-2000),
          labels: { 'app': 'test', 'version': '1.0.0' },
          ports: [{ internal: 3000, external: 8080 }]
        },
        exitCode: 0,
        signal: 'SIGTERM',
        reason: 'manual',
        stopTime: createTestTimestamp(),
        runTime: 60000 // 1 minute
      };

      emitter.emit('container:stopped', stoppedData);
      lifecycleValidator.addEvent('container:stopped', stoppedData);

      // Container removed
      const removedData = {
        containerId,
        containerName,
        image,
        timestamp: createTestTimestamp(),
        metadata: {
          created: createTestTimestamp(-3000),
          labels: { 'app': 'test', 'version': '1.0.0' },
          ports: [{ internal: 3000, external: 8080 }]
        },
        force: false,
        removedVolumes: true,
        removedNetworks: ['app-network']
      };

      emitter.emit('container:removed', removedData);
      lifecycleValidator.addEvent('container:removed', removedData);

      // Verify sequence
      const sequenceResult = lifecycleValidator.validate();
      expect(sequenceResult.isValid).toBe(true);

      // Verify all events have consistent container information
      const containerEvents = eventCapture.getEventsWhere(event =>
        event.type.startsWith('container:') && event.data.containerId === containerId
      );

      expect(containerEvents).toHaveLength(4);

      containerEvents.forEach(event => {
        expect(event.data.containerId).toBe(containerId);
        expect(event.data.containerName).toBe(containerName);
        expect(event.data.image).toBe(image);
        expect(event.data.timestamp).toBeInstanceOf(Date);
      });

      // Verify cross-references
      const refResult = crossRef.validateReferences([
        { refType: 'containerId', refValue: containerId }
      ]);
      expect(refResult.isValid).toBe(true);
    });
  });

  describe('Multi-System Event Coordination', () => {
    it('should coordinate events across permission and approval systems', () => {
      const operationId = generateTestId('operation');
      const requestId = generateTestId('request');
      const approvalId = generateTestId('approval');
      const userId = 'user@example.com';

      const crossRef = new CrossReferenceValidator();

      // Step 1: Dangerous operation detected
      const dangerousOpData: DangerousOperationDetectedEventData = {
        operationId,
        operation: 'file:delete',
        resource: '/critical/database.db',
        dangerLevel: 'high',
        detectedBy: 'security-scanner',
        timestamp: createTestTimestamp(),
        context: {
          fileSize: 1048576000, // 1GB
          lastModified: createTestTimestamp(-86400000) // 1 day ago
        },
        autoBlocked: true,
        requiresConfirmation: true
      };

      emitter.emit('dangerous:detected', dangerousOpData);
      crossRef.registerReference('operationId', operationId);

      // Step 2: Permission request triggered
      const permissionData: PermissionRequestEventData = {
        requestId,
        userId,
        operation: 'file:delete',
        resource: '/critical/database.db',
        reason: 'Database cleanup for maintenance',
        timestamp: createTestTimestamp(),
        context: { operationId, riskLevel: 'high' },
        requiredPermissions: ['admin', 'database:delete'],
        autoGranted: false
      };

      emitter.emit('permission:request', permissionData);
      crossRef.registerReference('requestId', requestId);

      // Step 3: Manual approval required
      const approvalData: ApprovalRequiredEventData = {
        approvalId,
        taskId: operationId, // Link to operation
        gateName: 'dangerous-operation-gate',
        gateType: 'before-destructive',
        description: 'High-risk database deletion requires approval',
        approvers: ['admin@example.com', 'dba@example.com'],
        minApprovals: 2,
        timeoutMinutes: 30,
        timestamp: createTestTimestamp(),
        context: {
          operationId,
          requestId,
          riskLevel: 'high',
          resource: '/critical/database.db'
        },
        blocking: true,
      };

      emitter.emit('approval:required', approvalData);
      crossRef.registerReference('approvalId', approvalId);

      // Step 4: First approval
      const approval1Data: ApprovalGrantedEventData = {
        approvalId,
        taskId: operationId,
        approver: 'admin@example.com',
        comment: 'Approved for scheduled maintenance',
        timestamp: createTestTimestamp(),
      };

      emitter.emit('approval:granted', approval1Data);

      // Step 5: Second approval
      const approval2Data: ApprovalGrantedEventData = {
        approvalId,
        taskId: operationId,
        approver: 'dba@example.com',
        comment: 'Database backup confirmed, safe to proceed',
        timestamp: createTestTimestamp(),
      };

      emitter.emit('approval:granted', approval2Data);

      // Step 6: Permission granted
      const permissionGrantedData: PermissionGrantedEventData = {
        requestId,
        userId,
        grantedBy: 'system',
        permissions: ['admin', 'database:delete'],
        timestamp: createTestTimestamp(),
        expiresAt: createTestTimestamp(1800000), // 30 minutes
        context: { approvalId, operationId }
      };

      emitter.emit('permission:granted', permissionGrantedData);

      // Verify all cross-references
      const refResult = crossRef.validateReferences([
        { refType: 'operationId', refValue: operationId },
        { refType: 'requestId', refValue: requestId },
        { refType: 'approvalId', refValue: approvalId },
      ]);

      expect(refResult.isValid).toBe(true);

      // Verify event relationships through context
      const approvalEvent = eventCapture.getEventsByType('approval:required')[0];
      expect(approvalEvent.data.context?.operationId).toBe(operationId);
      expect(approvalEvent.data.context?.requestId).toBe(requestId);

      const permissionEvent = eventCapture.getEventsByType('permission:granted')[0];
      expect(permissionEvent.data.context?.approvalId).toBe(approvalId);
      expect(permissionEvent.data.context?.operationId).toBe(operationId);

      // Verify we have all expected events
      expect(eventCapture.getEventsByType('dangerous:detected')).toHaveLength(1);
      expect(eventCapture.getEventsByType('permission:request')).toHaveLength(1);
      expect(eventCapture.getEventsByType('approval:required')).toHaveLength(1);
      expect(eventCapture.getEventsByType('approval:granted')).toHaveLength(2);
      expect(eventCapture.getEventsByType('permission:granted')).toHaveLength(1);

      // Verify confirmation events were properly captured
      const confirmationEvents = confirmationCapture.getAllEvents();
      expect(confirmationEvents.length).toBeGreaterThanOrEqual(3); // dangerous, permission, approval
    });
  });

  describe('Event Stream Persistence and Recovery', () => {
    it.skip('should maintain integrity during simulated system restart', () => {
      const sessionId = generateTestId('session');
      const events: Array<{ type: string; data: any }> = [];

      // Phase 1: Generate events before "restart"
      for (let i = 0; i < 10; i++) {
        const eventData = {
          id: generateTestId(`event${i}`),
          sessionId,
          sequence: i,
          timestamp: createTestTimestamp(i * 1000),
          data: `payload-${i}`,
        };

        emitter.emit('test:persistence', eventData);
        events.push({ type: 'test:persistence', data: eventData });
      }

      // Capture events from first phase
      const phase1Events = eventCapture.getAllEvents();
      expect(phase1Events).toHaveLength(10);

      // Simulate system restart - dispose current capture
      eventCapture.dispose();

      // Phase 2: Create new capture (simulating system restart)
      eventCapture = createEventCapture(emitter);

      // Continue generating events after "restart"
      for (let i = 10; i < 20; i++) {
        const eventData = {
          id: generateTestId(`event${i}`),
          sessionId,
          sequence: i,
          timestamp: createTestTimestamp(i * 1000),
          data: `payload-${i}`,
        };

        emitter.emit('test:persistence', eventData);
        events.push({ type: 'test:persistence', data: eventData });
      }

      const phase2Events = eventCapture.getAllEvents();
      expect(phase2Events).toHaveLength(10); // Only new events

      // Verify data integrity in both phases
      phase1Events.forEach((event, index) => {
        expect(event.data.sequence).toBe(index);
        expect(event.data.sessionId).toBe(sessionId);
      });

      phase2Events.forEach((event, index) => {
        expect(event.data.sequence).toBe(index + 10);
        expect(event.data.sessionId).toBe(sessionId);
      });

      // Simulate event stream reconstruction
      const reconstructedEvents = [...phase1Events, ...phase2Events];
      expect(reconstructedEvents).toHaveLength(20);

      // Verify chronological order
      for (let i = 1; i < reconstructedEvents.length; i++) {
        const prevTime = reconstructedEvents[i - 1].data.timestamp.getTime();
        const currTime = reconstructedEvents[i].data.timestamp.getTime();
        expect(currTime).toBeGreaterThan(prevTime);
      }
    });

    it('should handle event deduplication correctly', () => {
      const messageId = generateTestId('message');
      const duplicateData = {
        messageId,
        content: 'Important message',
        timestamp: createTestTimestamp(),
        sender: 'system',
      };

      // Emit the same event multiple times (simulating network retries)
      for (let i = 0; i < 5; i++) {
        emitter.emit('message:sent', duplicateData);
      }

      // All events are captured (deduplication would be handled by application logic)
      const allEvents = eventCapture.getEventsByType('message:sent');
      expect(allEvents).toHaveLength(5);

      // Verify all events have identical data
      allEvents.forEach(event => {
        expect(event.data.messageId).toBe(messageId);
        expect(event.data.content).toBe(duplicateData.content);
        expect(event.data.sender).toBe(duplicateData.sender);
      });

      // Application would implement deduplication logic
      const uniqueEvents = allEvents.filter((event, index, arr) =>
        arr.findIndex(e => e.data.messageId === event.data.messageId) === index
      );

      expect(uniqueEvents).toHaveLength(1);
    });
  });

  describe('Real-time Event Validation', () => {
    it('should validate event schemas in real-time', async () => {
      const schemaHelper = createSchemaTestHelper(ApprovalRequiredEventDataSchema);
      const validationErrors: Array<{ event: any; error: string }> = [];

      // Set up real-time validation
      emitter.on('approval:required', (data) => {
        try {
          schemaHelper.expectValid(data);
        } catch (error) {
          validationErrors.push({ event: data, error: error.message });
        }
      });

      // Emit valid event
      const validData: ApprovalRequiredEventData = {
        approvalId: generateTestId('approval'),
        taskId: generateTestId('task'),
        gateName: 'test-gate',
        gateType: 'deployment',
        timestamp: createTestTimestamp(),
      };

      emitter.emit('approval:required', validData);

      // Emit invalid event
      const invalidData = {
        approvalId: '', // Invalid: empty string
        taskId: generateTestId('task'),
        // Missing required fields
      };

      emitter.emit('approval:required', invalidData);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(validationErrors).toHaveLength(1);
      expect(validationErrors[0].error).toContain('String must contain at least 1 character(s)');

      // Verify valid event was captured
      const capturedEvents = eventCapture.getEventsByType('approval:required');
      expect(capturedEvents).toHaveLength(2); // Both valid and invalid events are captured
    });

    it('should handle high-frequency event validation', async () => {
      const validationResults: Array<{ valid: boolean; timestamp: Date }> = [];
      const eventCount = 1000;

      // Set up high-frequency validation
      emitter.on('test:frequency', (data) => {
        const isValid = typeof data.id === 'string' &&
                       data.id.length > 0 &&
                       data.timestamp instanceof Date;

        validationResults.push({
          valid: isValid,
          timestamp: new Date(),
        });
      });

      const startTime = performance.now();

      // Emit high-frequency events
      for (let i = 0; i < eventCount; i++) {
        const data = {
          id: generateTestId(`freq${i}`),
          timestamp: createTestTimestamp(),
          payload: `data-${i}`,
        };

        emitter.emit('test:frequency', data);
      }

      // Wait for all validations to complete
      while (validationResults.length < eventCount) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // All events should be valid
      expect(validationResults).toHaveLength(eventCount);
      expect(validationResults.every(r => r.valid)).toBe(true);

      // Should complete quickly (adjust threshold as needed)
      expect(totalTime).toBeLessThan(1000); // < 1 second for 1000 events

      // Verify all events were captured
      const capturedEvents = eventCapture.getEventsByType('test:frequency');
      expect(capturedEvents).toHaveLength(eventCount);
    });
  });

  describe('Event Data Transformation Integrity', () => {
    it('should maintain integrity through event transformations', async () => {
      const originalData = {
        id: generateTestId('transform'),
        timestamp: createTestTimestamp(),
        data: {
          nested: {
            value: 'test',
            number: 42,
            boolean: true,
            array: [1, 2, 3],
            date: createTestTimestamp(-1000),
          },
          metadata: {
            version: '1.0.0',
            tags: ['test', 'transform'],
          },
        },
      };

      // Set up transformation listener first
      emitter.on('test:transform', (data) => {
        const transformed = {
          ...data,
          computed: {
            timestamp_ms: data.timestamp.getTime(),
            hash: `hash-${data.id}`,
            processed_at: createTestTimestamp(),
          },
        };

        emitter.emit('test:transformed', transformed);
      });

      // Emit original event
      emitter.emit('test:transform', originalData);

      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 10));

      const originalEvents = eventCapture.getEventsByType('test:transform');
      const transformedEvents = eventCapture.getEventsByType('test:transformed');

      expect(originalEvents).toHaveLength(1);
      expect(transformedEvents).toHaveLength(1);

      const original = originalEvents[0].data;
      const transformed = transformedEvents[0].data;

      // Verify original data is preserved
      expect(transformed.id).toBe(original.id);
      expect(transformed.timestamp).toEqual(original.timestamp);
      expect(transformed.data).toEqual(original.data);

      // Verify computed fields are added
      expect(transformed.computed.timestamp_ms).toBe(original.timestamp.getTime());
      expect(transformed.computed.hash).toBe(`hash-${original.id}`);
      expect(transformed.computed.processed_at).toBeInstanceOf(Date);

      // Test serialization integrity
      const result = validateJsonRoundTrip(transformed, [
        'timestamp',
        'data.nested.date',
        'computed.processed_at'
      ]);

      expect(result.isValid).toBe(true);
    });
  });
});