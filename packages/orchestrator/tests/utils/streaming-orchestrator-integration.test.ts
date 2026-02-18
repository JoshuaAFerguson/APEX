/**
 * Integration tests for streaming test utilities with APEX orchestrator
 * Tests real orchestrator event patterns, approval flows, and task execution scenarios
 */

import { EventEmitter } from 'eventemitter3';
import {
  StreamingEventCapture,
  createStreamingEventCapture,
  StreamingTestUtils,
  StreamingAssertions,
  type StreamingTestConfig,
  type StreamTestScenario
} from './streaming-test-utils';
import { createEventCapture } from './event-capture';

// Mock the orchestrator structure for testing
interface MockTask {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  stage?: string;
  workflow: string;
  metadata?: any;
}

interface MockApprovalGate {
  id: string;
  taskId: string;
  name: string;
  status: 'pending' | 'approved' | 'denied';
  requiredBy: string;
  approvedBy?: string;
}

class MockOrchestrator extends EventEmitter {
  private tasks = new Map<string, MockTask>();
  private approvalGates = new Map<string, MockApprovalGate>();
  private currentTaskId = 0;
  private currentGateId = 0;

  async createTask(config: { title: string; workflow: string; metadata?: any }): Promise<MockTask> {
    const taskId = `task-${++this.currentTaskId}`;
    const task: MockTask = {
      id: taskId,
      title: config.title,
      status: 'pending',
      workflow: config.workflow,
      metadata: config.metadata
    };

    this.tasks.set(taskId, task);
    this.emit('task:created', { taskId, ...config });
    return task;
  }

  async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    task.status = 'running';
    this.emit('task:started', { taskId, workflow: task.workflow });

    // Simulate stage progression
    const stages = ['planning', 'architecture', 'implementation', 'testing', 'deployment'];

    for (const stage of stages) {
      task.stage = stage;
      this.emit('stage:changed', { taskId, stage, previousStage: null });

      // Simulate approval requirement for certain stages
      if (stage === 'deployment' || (task.workflow === 'destructive' && stage === 'implementation')) {
        await this.requireApproval(taskId, `${stage}-approval`);
      }

      // Simulate stage duration
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    task.status = 'completed';
    this.emit('task:completed', { taskId, result: 'success', duration: 250 });
  }

  private async requireApproval(taskId: string, gateName: string): Promise<void> {
    const gateId = `gate-${++this.currentGateId}`;
    const gate: MockApprovalGate = {
      id: gateId,
      taskId,
      name: gateName,
      status: 'pending',
      requiredBy: 'system'
    };

    this.approvalGates.set(gateId, gate);

    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'paused';
      this.emit('task:paused', { taskId, reason: 'approval-required' });
    }

    this.emit('approval:required', {
      taskId,
      gateId,
      gateName,
      reason: `Approval required for ${gateName}`,
      requiredBy: 'system'
    });

    // Auto-approve after delay (simulating user action)
    setTimeout(() => {
      this.approveGate(gateId, 'test-user');
    }, 100);

    // Wait for approval
    return new Promise((resolve) => {
      const handler = (data: any) => {
        if (data.gateId === gateId) {
          this.off('approval:granted', handler);
          resolve();
        }
      };
      this.on('approval:granted', handler);
    });
  }

  approveGate(gateId: string, approvedBy: string): void {
    const gate = this.approvalGates.get(gateId);
    if (!gate) throw new Error(`Gate ${gateId} not found`);

    gate.status = 'approved';
    gate.approvedBy = approvedBy;

    this.emit('approval:granted', {
      taskId: gate.taskId,
      gateId,
      gateName: gate.name,
      approvedBy
    });

    // Resume task
    const task = this.tasks.get(gate.taskId);
    if (task) {
      task.status = 'running';
      this.emit('task:resumed', { taskId: gate.taskId });
    }
  }

  denyGate(gateId: string, deniedBy: string, reason: string): void {
    const gate = this.approvalGates.get(gateId);
    if (!gate) throw new Error(`Gate ${gateId} not found`);

    gate.status = 'denied';

    this.emit('approval:denied', {
      taskId: gate.taskId,
      gateId,
      gateName: gate.name,
      deniedBy,
      reason
    });

    // Fail task
    const task = this.tasks.get(gate.taskId);
    if (task) {
      task.status = 'failed';
      this.emit('task:failed', { taskId: gate.taskId, reason: 'approval-denied' });
    }
  }

  simulateAgentCommunication(agentCount: number = 3): void {
    const agents = ['planner', 'architect', 'developer', 'tester', 'reviewer'];

    for (let i = 0; i < agentCount; i++) {
      const agentId = agents[i] || `agent-${i}`;

      setTimeout(() => {
        this.emit('agent:started', { agentId, stage: `stage-${i + 1}` });
      }, i * 50);

      setTimeout(() => {
        this.emit('agent:message', {
          agentId,
          message: `Processing ${agentId} tasks`,
          timestamp: Date.now()
        });
      }, i * 50 + 25);

      setTimeout(() => {
        this.emit('agent:completed', {
          agentId,
          result: 'success',
          duration: 75
        });
      }, i * 50 + 75);
    }
  }

  simulateHighVolumeActivity(eventCount: number = 100): void {
    const eventTypes = [
      'task:progress',
      'agent:message',
      'system:metric',
      'user:action',
      'resource:allocation'
    ];

    for (let i = 0; i < eventCount; i++) {
      const eventType = eventTypes[i % eventTypes.length];

      setTimeout(() => {
        this.emit(eventType, {
          index: i,
          timestamp: Date.now(),
          data: `Event ${i} data for ${eventType}`
        });
      }, i * 10); // 100 events/sec
    }
  }
}

describe('Streaming Orchestrator Integration Tests', () => {
  let orchestrator: MockOrchestrator;
  let streamingCapture: StreamingEventCapture;

  beforeEach(() => {
    orchestrator = new MockOrchestrator();
  });

  afterEach(() => {
    streamingCapture?.dispose();
  });

  describe('Task Execution Flow Integration', () => {
    it('should capture complete task execution with approvals', async () => {
      const config: StreamingTestConfig = {
        maxLatency: 200,
        expectedEventsPerSecond: 20,
        streamTimeout: 5000
      };

      streamingCapture = createStreamingEventCapture(orchestrator, {}, config);

      const expectedEvents = [
        'task:created',
        'task:started',
        'stage:changed', // planning
        'stage:changed', // architecture
        'stage:changed', // implementation
        'approval:required', // implementation approval for destructive workflow
        'task:paused',
        'approval:granted',
        'task:resumed',
        'stage:changed', // testing
        'stage:changed', // deployment
        'approval:required', // deployment approval
        'task:paused',
        'approval:granted',
        'task:resumed',
        'task:completed'
      ];

      streamingCapture.startStreamingTest(expectedEvents);

      // Execute destructive workflow task
      const task = await orchestrator.createTask({
        title: 'Test Destructive Workflow',
        workflow: 'destructive',
        metadata: { requiresApproval: true }
      });

      await orchestrator.executeTask(task.id);

      // Wait for all events
      const streamingEvents = await streamingCapture.waitForStreamingEvents(
        events => events.length >= expectedEvents.length - 2, // Allow some flexibility
        6000
      );

      const metrics = streamingCapture.endStreamingTest();

      // Verify event sequence and data
      expect(streamingEvents.length).toBeGreaterThanOrEqual(14);

      const taskCreatedEvent = streamingEvents.find(e => e.type === 'task:created');
      expect(taskCreatedEvent?.data.title).toBe('Test Destructive Workflow');
      expect(taskCreatedEvent?.data.workflow).toBe('destructive');

      const approvalEvents = streamingEvents.filter(e => e.type === 'approval:required');
      expect(approvalEvents.length).toBe(2); // implementation + deployment

      const stageEvents = streamingEvents.filter(e => e.type === 'stage:changed');
      expect(stageEvents.length).toBe(5); // All stages

      // Verify performance metrics
      const latencyResult = streamingCapture.assertStreamLatency(300);
      expect(latencyResult.passed).toBe(true);

      const orderingResult = streamingCapture.assertStreamOrdering();
      expect(orderingResult.passed).toBe(true);

      const completenessResult = streamingCapture.assertStreamCompleteness();
      expect(completenessResult.passed).toBe(true);

      // Verify approval flow timing
      const approvalRequired = streamingEvents.find(e => e.type === 'approval:required');
      const approvalGranted = streamingEvents.find(e => e.type === 'approval:granted');

      if (approvalRequired && approvalGranted) {
        const approvalLatency = approvalGranted.timing.capturedAt.getTime() -
          approvalRequired.timing.capturedAt.getTime();
        expect(approvalLatency).toBeGreaterThan(90); // Should reflect the 100ms delay
        expect(approvalLatency).toBeLessThan(200); // But not too much overhead
      }
    }, 10000);

    it('should handle task failure with approval denial', async () => {
      streamingCapture = createStreamingEventCapture(orchestrator);

      const failureEvents = [
        'task:created',
        'task:started',
        'approval:required',
        'task:paused',
        'approval:denied',
        'task:failed'
      ];

      streamingCapture.startStreamingTest(failureEvents);

      const task = await orchestrator.createTask({
        title: 'Test Failed Approval',
        workflow: 'destructive'
      });

      // Start task execution
      const executionPromise = orchestrator.executeTask(task.id).catch(() => {
        // Expected to fail due to denial
      });

      // Wait for approval request
      await new Promise(resolve => {
        orchestrator.on('approval:required', (data) => {
          // Deny approval instead of approving
          setTimeout(() => {
            orchestrator.denyGate(data.gateId, 'test-user', 'Testing denial flow');
          }, 50);
          resolve(void 0);
        });
      });

      await executionPromise;

      await streamingCapture.waitForStreamingEvents(
        events => events.some(e => e.type === 'task:failed'),
        2000
      );

      const events = streamingCapture.getStreamingEvents();
      const metrics = streamingCapture.endStreamingTest();

      // Verify failure flow
      expect(events.some(e => e.type === 'approval:denied')).toBe(true);
      expect(events.some(e => e.type === 'task:failed')).toBe(true);

      const denialEvent = events.find(e => e.type === 'approval:denied');
      expect(denialEvent?.data.reason).toBe('Testing denial flow');
      expect(denialEvent?.data.deniedBy).toBe('test-user');

      // Performance should still be good despite failure
      expect(metrics.averageLatency).toBeLessThan(100);
      expect(metrics.outOfOrderEvents).toBe(0);
    });

    it('should capture concurrent task executions', async () => {
      streamingCapture = createStreamingEventCapture(orchestrator, {}, {
        streamBufferSize: 200, // Large buffer for concurrent events
        maxLatency: 300
      });

      const allTaskEvents = [
        'task:created',
        'task:started',
        'stage:changed',
        'task:completed',
        'task:paused',
        'task:resumed',
        'approval:required',
        'approval:granted'
      ];

      streamingCapture.startStreamingTest(allTaskEvents);

      // Create and execute multiple tasks concurrently
      const taskPromises = [
        (async () => {
          const task1 = await orchestrator.createTask({
            title: 'Concurrent Task 1',
            workflow: 'standard'
          });
          return orchestrator.executeTask(task1.id);
        })(),

        (async () => {
          const task2 = await orchestrator.createTask({
            title: 'Concurrent Task 2',
            workflow: 'standard'
          });
          return orchestrator.executeTask(task2.id);
        })(),

        (async () => {
          const task3 = await orchestrator.createTask({
            title: 'Concurrent Task 3',
            workflow: 'destructive' // Will require approvals
          });
          return orchestrator.executeTask(task3.id);
        })()
      ];

      await Promise.all(taskPromises);

      await streamingCapture.waitForStreamingEvents(
        events => events.filter(e => e.type === 'task:completed').length >= 3,
        10000
      );

      const events = streamingCapture.getStreamingEvents();
      const metrics = streamingCapture.endStreamingTest();

      // Verify all tasks completed
      const completedEvents = events.filter(e => e.type === 'task:completed');
      expect(completedEvents.length).toBe(3);

      // Verify concurrent execution patterns
      const taskIds = new Set(completedEvents.map(e => e.data.taskId));
      expect(taskIds.size).toBe(3); // Three different tasks

      // Verify interleaving (events from different tasks should be mixed)
      let hasInterleaving = false;
      for (let i = 1; i < events.length; i++) {
        const currentTaskId = events[i].data?.taskId;
        const prevTaskId = events[i - 1].data?.taskId;

        if (currentTaskId && prevTaskId && currentTaskId !== prevTaskId) {
          hasInterleaving = true;
          break;
        }
      }
      expect(hasInterleaving).toBe(true);

      // Performance should handle concurrent load
      expect(metrics.averageLatency).toBeLessThan(400);
      expect(metrics.eventsPerSecond).toBeGreaterThan(10);
    }, 15000);
  });

  describe('Agent Communication Integration', () => {
    it('should capture agent handoff patterns', async () => {
      streamingCapture = createStreamingEventCapture(orchestrator, {}, {
        expectedEventsPerSecond: 30,
        maxLatency: 150
      });

      const agentEvents = [
        'agent:started',
        'agent:message',
        'agent:completed'
      ];

      streamingCapture.startStreamingTest(agentEvents);

      // Simulate agent communication
      orchestrator.simulateAgentCommunication(5);

      await streamingCapture.waitForStreamingEvents(
        events => events.length >= 15, // 5 agents × 3 events each
        3000
      );

      const events = streamingCapture.getStreamingEvents();
      const metrics = streamingCapture.endStreamingTest();

      // Verify agent progression
      const startedEvents = events.filter(e => e.type === 'agent:started');
      const messageEvents = events.filter(e => e.type === 'agent:message');
      const completedEvents = events.filter(e => e.type === 'agent:completed');

      expect(startedEvents.length).toBe(5);
      expect(messageEvents.length).toBe(5);
      expect(completedEvents.length).toBe(5);

      // Verify agent sequence for each agent
      const agents = new Set(startedEvents.map(e => e.data.agentId));
      agents.forEach(agentId => {
        const agentEvents = events.filter(e => e.data?.agentId === agentId);
        const eventTypes = agentEvents.map(e => e.type);

        expect(eventTypes).toEqual([
          'agent:started',
          'agent:message',
          'agent:completed'
        ]);
      });

      // Verify timing between agent events
      agents.forEach(agentId => {
        const agentEvents = events
          .filter(e => e.data?.agentId === agentId)
          .sort((a, b) => a.timing.sequence - b.timing.sequence);

        if (agentEvents.length === 3) {
          const startToMessage = agentEvents[1].timing.capturedAt.getTime() -
            agentEvents[0].timing.capturedAt.getTime();
          const messageToComplete = agentEvents[2].timing.capturedAt.getTime() -
            agentEvents[1].timing.capturedAt.getTime();

          expect(startToMessage).toBeGreaterThan(20); // ~25ms expected
          expect(messageToComplete).toBeGreaterThan(40); // ~50ms expected
        }
      });

      // Performance assertions
      expect(metrics.averageLatency).toBeLessThan(200);
      expect(metrics.outOfOrderEvents).toBe(0);
    });

    it('should handle high-volume agent communication', async () => {
      streamingCapture = createStreamingEventCapture(orchestrator, {}, {
        streamBufferSize: 150, // Limited buffer to test backpressure
        expectedEventsPerSecond: 100,
        maxLatency: 100
      });

      const highVolumeEvents = [
        'task:progress',
        'agent:message',
        'system:metric',
        'user:action',
        'resource:allocation'
      ];

      streamingCapture.startStreamingTest(highVolumeEvents);

      // Generate high-volume activity
      orchestrator.simulateHighVolumeActivity(200); // 200 events at 100/sec

      await streamingCapture.waitForStreamingEvents(
        events => events.length >= 100, // Allow for some backpressure
        3000
      );

      const metrics = streamingCapture.endStreamingTest();

      // Should handle high volume with backpressure
      expect(metrics.backpressureCount).toBeGreaterThan(0);
      expect(metrics.totalEvents).toBeLessThanOrEqual(150); // Buffer limit
      expect(metrics.eventsPerSecond).toBeGreaterThan(50);

      // Despite backpressure, should maintain low latency
      expect(metrics.averageLatency).toBeLessThan(200);

      // Should have captured mix of event types
      const events = streamingCapture.getStreamingEvents();
      const eventTypes = new Set(events.map(e => e.type));
      expect(eventTypes.size).toBeGreaterThan(3);
    });
  });

  describe('Integration with EventCapture', () => {
    it('should work alongside regular EventCapture', async () => {
      const regularCapture = createEventCapture(orchestrator, { autoStart: true });
      streamingCapture = createStreamingEventCapture(orchestrator);

      try {
        const testEvents = ['integration:test', 'coordination:check'];
        streamingCapture.startStreamingTest(testEvents);

        const task = await orchestrator.createTask({
          title: 'Integration Test',
          workflow: 'standard'
        });

        // Emit custom events for coordination testing
        orchestrator.emit('integration:test', { phase: 'start', taskId: task.id });
        await orchestrator.executeTask(task.id);
        orchestrator.emit('coordination:check', { phase: 'complete', taskId: task.id });

        await streamingCapture.waitForStreamingEvents(
          events => events.length >= 2,
          2000
        );

        // Both captures should have events
        const streamingEvents = streamingCapture.getStreamingEvents();
        const regularEvents = regularCapture.getAllEvents();

        expect(streamingEvents.length).toBeGreaterThanOrEqual(2);
        expect(regularEvents.length).toBeGreaterThanOrEqual(2);

        // Both should capture task execution events
        const streamingTaskEvents = streamingEvents.filter(e =>
          e.type.startsWith('task:') || e.type.startsWith('stage:')
        );
        const regularTaskEvents = regularEvents.filter(e =>
          e.type.startsWith('task:') || e.type.startsWith('stage:')
        );

        expect(streamingTaskEvents.length).toBeGreaterThan(0);
        expect(regularTaskEvents.length).toBeGreaterThan(0);

        // Streaming capture should have timing metadata
        streamingEvents.forEach(event => {
          expect(event.timing).toBeDefined();
          expect(event.timing.latency).toBeGreaterThanOrEqual(0);
        });

        // Regular capture should have basic timestamp
        regularEvents.forEach(event => {
          expect(event.timestamp).toBeInstanceOf(Date);
        });

        // Both should support basic assertions
        streamingCapture.expectEventEmitted('integration:test');
        regularCapture.expectEventEmitted('integration:test');

        const streamingIntegrationEvent = streamingEvents.find(e => e.type === 'integration:test');
        const regularIntegrationEvent = regularEvents.find(e => e.type === 'integration:test');

        expect(streamingIntegrationEvent?.data.phase).toBe('start');
        expect(regularIntegrationEvent?.data.phase).toBe('start');

      } finally {
        regularCapture.dispose();
      }
    });

    it('should provide enhanced debugging for integration scenarios', async () => {
      streamingCapture = createStreamingEventCapture(orchestrator, {}, {
        maxLatency: 100,
        strictOrdering: true
      });

      streamingCapture.startStreamingTest([
        'debug:scenario',
        'task:started',
        'task:completed',
        'performance:metric'
      ]);

      // Create scenario with timing-sensitive operations
      const startTime = Date.now();

      orchestrator.emit('debug:scenario', { phase: 'start', timestamp: startTime });

      const task = await orchestrator.createTask({
        title: 'Debug Integration',
        workflow: 'performance-test'
      });

      await orchestrator.executeTask(task.id);

      orchestrator.emit('performance:metric', {
        phase: 'end',
        duration: Date.now() - startTime,
        taskId: task.id
      });

      await streamingCapture.waitForStreamingEvents(
        events => events.length >= 4,
        3000
      );

      const events = streamingCapture.getStreamingEvents();
      const metrics = streamingCapture.endStreamingTest();

      // Enhanced debugging information
      console.log('Integration Debug Info:');
      console.log(`- Total events: ${metrics.totalEvents}`);
      console.log(`- Stream duration: ${metrics.streamDuration}ms`);
      console.log(`- Average latency: ${metrics.averageLatency.toFixed(2)}ms`);
      console.log(`- Events per second: ${metrics.eventsPerSecond.toFixed(2)}`);

      events.forEach((event, index) => {
        console.log(`  Event ${index + 1}: ${event.type} (${event.timing.latency}ms latency)`);
      });

      // Performance assertions with detailed feedback
      const latencyResult = streamingCapture.assertStreamLatency();
      const orderingResult = streamingCapture.assertStreamOrdering();
      const completenessResult = streamingCapture.assertStreamCompleteness();

      expect(latencyResult.passed).toBe(true);
      expect(orderingResult.passed).toBe(true);
      expect(completenessResult.passed).toBe(true);

      // Verify integration timing
      const debugEvent = events.find(e => e.type === 'debug:scenario');
      const perfEvent = events.find(e => e.type === 'performance:metric');

      if (debugEvent && perfEvent) {
        const totalLatency = perfEvent.timing.capturedAt.getTime() -
          debugEvent.timing.capturedAt.getTime();

        expect(totalLatency).toBeGreaterThan(200); // Task execution takes time
        expect(totalLatency).toBeLessThan(2000); // But not too long

        // Cross-reference with performance metric data
        expect(perfEvent.data.duration).toBeCloseTo(totalLatency, -2); // Within 100ms
      }
    });
  });

  describe('Real-world Scenario Simulations', () => {
    it('should handle complete CI/CD pipeline simulation', async () => {
      streamingCapture = createStreamingEventCapture(orchestrator, {}, {
        streamTimeout: 15000,
        expectedEventsPerSecond: 20,
        maxLatency: 500 // Relaxed for complex pipeline
      });

      const pipelineEvents = [
        'pipeline:started',
        'stage:changed', // build
        'test:started',
        'test:completed',
        'approval:required', // deployment approval
        'task:paused',
        'approval:granted',
        'task:resumed',
        'deployment:started',
        'deployment:completed',
        'pipeline:completed'
      ];

      streamingCapture.startStreamingTest(pipelineEvents);

      // Simulate full CI/CD pipeline
      orchestrator.emit('pipeline:started', { pipelineId: 'ci-cd-001', commit: 'abc123' });

      const buildTask = await orchestrator.createTask({
        title: 'CI/CD Pipeline Build',
        workflow: 'pipeline',
        metadata: { stage: 'build', commit: 'abc123' }
      });

      orchestrator.emit('stage:changed', { taskId: buildTask.id, stage: 'build' });

      // Simulate testing phase
      orchestrator.emit('test:started', { taskId: buildTask.id, testSuite: 'integration' });
      await new Promise(resolve => setTimeout(resolve, 100));
      orchestrator.emit('test:completed', { taskId: buildTask.id, result: 'pass', coverage: 85 });

      // Deployment requires approval
      const deployTask = await orchestrator.createTask({
        title: 'Production Deployment',
        workflow: 'destructive', // Requires approval
        metadata: { environment: 'production' }
      });

      const deploymentPromise = orchestrator.executeTask(deployTask.id);

      // Wait for approval and approve
      await new Promise(resolve => {
        orchestrator.once('approval:required', (data) => {
          setTimeout(() => {
            orchestrator.approveGate(data.gateId, 'devops-team');
            resolve(void 0);
          }, 200); // Simulate approval delay
        });
      });

      await deploymentPromise;

      // Complete pipeline
      orchestrator.emit('deployment:started', { taskId: deployTask.id, environment: 'production' });
      orchestrator.emit('deployment:completed', { taskId: deployTask.id, status: 'success' });
      orchestrator.emit('pipeline:completed', { pipelineId: 'ci-cd-001', status: 'success' });

      await streamingCapture.waitForStreamingEvents(
        events => events.some(e => e.type === 'pipeline:completed'),
        10000
      );

      const events = streamingCapture.getStreamingEvents();
      const metrics = streamingCapture.endStreamingTest();

      // Verify pipeline completion
      expect(events.some(e => e.type === 'pipeline:completed')).toBe(true);

      const pipelineCompleteEvent = events.find(e => e.type === 'pipeline:completed');
      expect(pipelineCompleteEvent?.data.status).toBe('success');

      // Verify approval flow worked
      expect(events.some(e => e.type === 'approval:required')).toBe(true);
      expect(events.some(e => e.type === 'approval:granted')).toBe(true);

      // Performance should be acceptable for pipeline
      expect(metrics.streamDuration).toBeLessThan(5000);
      expect(metrics.averageLatency).toBeLessThan(800);

      // Verify pipeline timing
      const pipelineStart = events.find(e => e.type === 'pipeline:started');
      const pipelineEnd = events.find(e => e.type === 'pipeline:completed');

      if (pipelineStart && pipelineEnd) {
        const pipelineDuration = pipelineEnd.timing.capturedAt.getTime() -
          pipelineStart.timing.capturedAt.getTime();

        expect(pipelineDuration).toBeGreaterThan(300); // Pipeline takes time
        expect(pipelineDuration).toBeLessThan(3000); // But reasonable
      }
    }, 20000);

    it('should simulate emergency response workflow', async () => {
      streamingCapture = createStreamingEventCapture(orchestrator, {}, {
        maxLatency: 50, // Very strict latency for emergency
        expectedEventsPerSecond: 50
      });

      const emergencyEvents = [
        'alert:triggered',
        'escalation:started',
        'team:notified',
        'response:initiated',
        'mitigation:deployed',
        'alert:resolved'
      ];

      streamingCapture.startStreamingTest(emergencyEvents);

      // Simulate emergency response
      orchestrator.emit('alert:triggered', {
        severity: 'critical',
        service: 'api-gateway',
        message: 'High error rate detected'
      });

      orchestrator.emit('escalation:started', {
        escalationLevel: 1,
        targetTeam: 'oncall-engineers'
      });

      orchestrator.emit('team:notified', {
        team: 'oncall-engineers',
        method: 'pager',
        responseTime: 30
      });

      orchestrator.emit('response:initiated', {
        engineer: 'john-doe',
        action: 'investigating'
      });

      orchestrator.emit('mitigation:deployed', {
        action: 'circuit-breaker-enabled',
        engineer: 'john-doe'
      });

      orchestrator.emit('alert:resolved', {
        resolutionTime: 180,
        rootCause: 'downstream-service-timeout'
      });

      await streamingCapture.waitForStreamingEvents(
        events => events.length === emergencyEvents.length,
        2000
      );

      const events = streamingCapture.getStreamingEvents();
      const metrics = streamingCapture.endStreamingTest();

      // Emergency response should be very fast
      expect(metrics.maxLatency).toBeLessThan(100);
      expect(metrics.outOfOrderEvents).toBe(0); // Critical for emergency response

      // Verify response time
      const alertTriggered = events.find(e => e.type === 'alert:triggered');
      const alertResolved = events.find(e => e.type === 'alert:resolved');

      if (alertTriggered && alertResolved) {
        const responseTime = alertResolved.timing.capturedAt.getTime() -
          alertTriggered.timing.capturedAt.getTime();

        expect(responseTime).toBeLessThan(500); // Very fast emergency response
        expect(alertResolved.data.resolutionTime).toBe(180);
      }

      // All events should be present for complete audit trail
      expect(events.length).toBe(emergencyEvents.length);
      emergencyEvents.forEach(eventType => {
        expect(events.some(e => e.type === eventType)).toBe(true);
      });
    });
  });
});