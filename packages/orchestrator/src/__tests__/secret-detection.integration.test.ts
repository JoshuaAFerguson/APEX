/**
 * @fileoverview Integration tests for secret detection in tool outputs
 *
 * These tests verify that the secret:detected event is properly emitted
 * when secrets are found in tool outputs during task execution.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type {
  SecretDetectedEvent,
  ToolCallCompleteEvent,
  SecretDetectionBehavior
} from '../index';
import { SecretScanner } from '../scanner';

// Mock emitter to test event emission patterns
class MockOrchestratorEmitter extends EventEmitter {
  private secretScanner?: SecretScanner;

  constructor(scannerConfig?: { onSecretDetected?: SecretDetectionBehavior }) {
    super();

    if (scannerConfig) {
      this.secretScanner = new SecretScanner({
        customPatterns: [{
          name: 'test-integration-pattern',
          regex: /TEST_INTEGRATION_[A-Z0-9]{8}/g,
          secretType: 'test-integration',
          confidence: 1.0,
          severity: 'high',
          description: 'Safe test pattern for integration testing',
        }],
        includeBuiltInPatterns: false,
        onSecretDetected: scannerConfig.onSecretDetected,
      });
    }
  }

  // Simulates the orchestrator's tool output processing
  processToolOutput(taskId: string, toolName: string, callId: string, output: string) {
    // Scan for secrets if scanner is configured
    if (this.secretScanner) {
      const findings = this.secretScanner.scan(output, `tool:${toolName}:${callId}`);

      // If secrets detected, emit secret:detected event
      if (findings.length > 0) {
        const severityCounts = {
          critical: findings.filter(f => f.severity === 'critical').length,
          high: findings.filter(f => f.severity === 'high').length,
          medium: findings.filter(f => f.severity === 'medium').length,
          low: findings.filter(f => f.severity === 'low').length,
        };

        this.emit('secret:detected', {
          taskId,
          toolName,
          callId,
          findings,
          count: findings.length,
          severityCounts,
          behavior: 'warn',
          timestamp: new Date(),
        } as SecretDetectedEvent);
      }
    }

    // Then emit tool:complete event (as would happen in real orchestrator)
    this.emit('tool:complete', {
      taskId,
      toolName,
      callId,
      result: {
        success: true,
        output,
      },
      timing: {
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
      },
      timestamp: new Date(),
    } as ToolCallCompleteEvent);
  }
}

describe('Secret Detection Integration Tests', () => {
  let orchestrator: MockOrchestratorEmitter;

  describe('Event Emission Flow', () => {
    beforeEach(() => {
      orchestrator = new MockOrchestratorEmitter({ onSecretDetected: 'warn' });
    });

    it('should emit secret:detected event before tool:complete when secrets found', () => {
      const events: string[] = [];
      const secretListener = vi.fn(() => events.push('secret:detected'));
      const toolCompleteListener = vi.fn(() => events.push('tool:complete'));

      orchestrator.on('secret:detected', secretListener);
      orchestrator.on('tool:complete', toolCompleteListener);

      const toolOutput = 'Configuration loaded: TEST_INTEGRATION_ABCD1234';
      orchestrator.processToolOutput('task-123', 'Read', 'call-456', toolOutput);

      expect(secretListener).toHaveBeenCalledOnce();
      expect(toolCompleteListener).toHaveBeenCalledOnce();

      // secret:detected should come before tool:complete
      expect(events).toEqual(['secret:detected', 'tool:complete']);
    });

    it('should not emit secret:detected when no secrets found', () => {
      const secretListener = vi.fn();
      const toolCompleteListener = vi.fn();

      orchestrator.on('secret:detected', secretListener);
      orchestrator.on('tool:complete', toolCompleteListener);

      const cleanOutput = 'Normal tool output with no sensitive information';
      orchestrator.processToolOutput('task-789', 'Write', 'call-101', cleanOutput);

      expect(secretListener).not.toHaveBeenCalled();
      expect(toolCompleteListener).toHaveBeenCalledOnce();
    });

    it('should not emit secret:detected when scanner not configured', () => {
      const unconfiguredOrchestrator = new MockOrchestratorEmitter();
      const secretListener = vi.fn();
      const toolCompleteListener = vi.fn();

      unconfiguredOrchestrator.on('secret:detected', secretListener);
      unconfiguredOrchestrator.on('tool:complete', toolCompleteListener);

      const outputWithTestPattern = 'Found: TEST_INTEGRATION_ABCD1234';
      unconfiguredOrchestrator.processToolOutput('task-999', 'Read', 'call-999', outputWithTestPattern);

      expect(secretListener).not.toHaveBeenCalled();
      expect(toolCompleteListener).toHaveBeenCalledOnce();
    });
  });

  describe('Event Payload Validation', () => {
    beforeEach(() => {
      orchestrator = new MockOrchestratorEmitter({ onSecretDetected: 'warn' });
    });

    it('should emit secret:detected with correct event structure', () => {
      const secretListener = vi.fn();
      orchestrator.on('secret:detected', secretListener);

      const taskId = 'test-task-123';
      const toolName = 'Read';
      const callId = 'test-call-456';
      const output = 'Test pattern found: TEST_INTEGRATION_XYZU6789';

      orchestrator.processToolOutput(taskId, toolName, callId, output);

      expect(secretListener).toHaveBeenCalledOnce();
      const eventData = secretListener.mock.calls[0][0] as SecretDetectedEvent;

      expect(eventData.taskId).toBe(taskId);
      expect(eventData.toolName).toBe(toolName);
      expect(eventData.callId).toBe(callId);
      expect(eventData.count).toBe(1);
      expect(eventData.behavior).toBe('warn');
      expect(eventData.timestamp).toBeInstanceOf(Date);

      expect(Array.isArray(eventData.findings)).toBe(true);
      expect(eventData.findings).toHaveLength(1);

      const finding = eventData.findings[0];
      expect(finding.secretType).toBe('test-integration');
      expect(finding.severity).toBe('high');
      expect(finding.confidence).toBe(1.0);
      expect(finding.line).toBe(1);
      expect(finding.column).toBeGreaterThan(0);

      expect(eventData.severityCounts.critical).toBe(0);
      expect(eventData.severityCounts.high).toBe(1);
      expect(eventData.severityCounts.medium).toBe(0);
      expect(eventData.severityCounts.low).toBe(0);
    });

    it('should handle multiple test patterns in single tool output', () => {
      const orchestratorMulti = new MockOrchestratorEmitter({
        onSecretDetected: 'warn'
      });

      const multiScanner = new SecretScanner({
        customPatterns: [
          {
            name: 'test-pattern-alpha',
            regex: /ALPHA_TEST_[0-9]{4}/g,
            secretType: 'alpha-test',
            confidence: 1.0,
            severity: 'high',
            description: 'Alpha test pattern',
          },
          {
            name: 'test-pattern-beta',
            regex: /BETA_TEST_[A-Z]{4}/g,
            secretType: 'beta-test',
            confidence: 0.8,
            severity: 'medium',
            description: 'Beta test pattern',
          }
        ],
        includeBuiltInPatterns: false,
      });

      (orchestratorMulti as any).secretScanner = multiScanner;

      const secretListener = vi.fn();
      orchestratorMulti.on('secret:detected', secretListener);

      const multiSecretOutput = 'Config: ALPHA_TEST_1234 and BETA_TEST_WXYZ';
      orchestratorMulti.processToolOutput('multi-task', 'Config', 'multi-call', multiSecretOutput);

      expect(secretListener).toHaveBeenCalledOnce();
      const eventData = secretListener.mock.calls[0][0] as SecretDetectedEvent;

      expect(eventData.count).toBe(2);
      expect(eventData.findings).toHaveLength(2);
      expect(eventData.severityCounts.high).toBe(1);
      expect(eventData.severityCounts.medium).toBe(1);

      const secretTypes = eventData.findings.map(f => f.secretType);
      expect(secretTypes).toContain('alpha-test');
      expect(secretTypes).toContain('beta-test');
    });
  });

  describe('Scanner Configuration Effects', () => {
    it('should respect different detection behaviors', () => {
      const behaviors: SecretDetectionBehavior[] = ['log', 'warn', 'mask', 'block'];

      behaviors.forEach(behavior => {
        const behaviorOrchestrator = new MockOrchestratorEmitter({ onSecretDetected: behavior });
        const secretListener = vi.fn();
        behaviorOrchestrator.on('secret:detected', secretListener);

        behaviorOrchestrator.processToolOutput('behavior-test', 'Test', 'behavior-call', 'Test: TEST_INTEGRATION_BEHAV123');

        expect(secretListener).toHaveBeenCalled();
        const eventData = secretListener.mock.calls[0][0] as SecretDetectedEvent;
        expect(eventData.behavior).toBe(behavior);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      orchestrator = new MockOrchestratorEmitter({ onSecretDetected: 'warn' });
    });

    it('should handle empty tool output', () => {
      const secretListener = vi.fn();
      const toolCompleteListener = vi.fn();

      orchestrator.on('secret:detected', secretListener);
      orchestrator.on('tool:complete', toolCompleteListener);

      orchestrator.processToolOutput('empty-task', 'EmptyTool', 'empty-call', '');

      expect(secretListener).not.toHaveBeenCalled();
      expect(toolCompleteListener).toHaveBeenCalledOnce();
    });

    it('should handle tool output with only whitespace', () => {
      const secretListener = vi.fn();
      orchestrator.on('secret:detected', secretListener);

      orchestrator.processToolOutput('whitespace-task', 'WhitespaceTool', 'whitespace-call', '   \n\t\n   ');

      expect(secretListener).not.toHaveBeenCalled();
    });

    it('should handle very large tool outputs', () => {
      const secretListener = vi.fn();
      orchestrator.on('secret:detected', secretListener);

      const largeOutput = 'x'.repeat(5000) + 'TEST_INTEGRATION_LARGE123';
      orchestrator.processToolOutput('large-task', 'LargeTool', 'large-call', largeOutput);

      expect(secretListener).toHaveBeenCalledOnce();
      const eventData = secretListener.mock.calls[0][0] as SecretDetectedEvent;
      expect(eventData.count).toBe(1);
    });

    it('should handle special characters in tool output', () => {
      const secretListener = vi.fn();
      orchestrator.on('secret:detected', secretListener);

      const specialOutput = 'Config with special chars: TEST_INTEGRATION_SPEC1234 end';
      orchestrator.processToolOutput('special-task', 'SpecialTool', 'special-call', specialOutput);

      expect(secretListener).toHaveBeenCalledOnce();
    });
  });

  describe('Event Listener Management', () => {
    beforeEach(() => {
      orchestrator = new MockOrchestratorEmitter({ onSecretDetected: 'warn' });
    });

    it('should support multiple event listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      orchestrator.on('secret:detected', listener1);
      orchestrator.on('secret:detected', listener2);

      orchestrator.processToolOutput('multi-listener', 'Tool', 'call', 'Found: TEST_INTEGRATION_MULTI123');

      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledOnce();
    });

    it('should support one-time listeners', () => {
      const onceListener = vi.fn();

      orchestrator.once('secret:detected', onceListener);

      orchestrator.processToolOutput('once-1', 'Tool', 'call-1', 'First: TEST_INTEGRATION_ONCE1234');
      expect(onceListener).toHaveBeenCalledOnce();

      orchestrator.processToolOutput('once-2', 'Tool', 'call-2', 'Second: TEST_INTEGRATION_ONCE5678');
      expect(onceListener).toHaveBeenCalledOnce(); // Still only once
    });

    it('should allow listener removal', () => {
      const listener = vi.fn();

      orchestrator.on('secret:detected', listener);

      orchestrator.processToolOutput('remove-1', 'Tool', 'call-1', 'First: TEST_INTEGRATION_REM1234');
      expect(listener).toHaveBeenCalledOnce();

      orchestrator.off('secret:detected', listener);

      orchestrator.processToolOutput('remove-2', 'Tool', 'call-2', 'Second: TEST_INTEGRATION_REM5678');
      expect(listener).toHaveBeenCalledOnce(); // Still only once
    });
  });

  describe('Real-world Tool Scenarios', () => {
    beforeEach(() => {
      orchestrator = new MockOrchestratorEmitter({ onSecretDetected: 'warn' });
    });

    it('should detect test patterns in file read operations', () => {
      const secretListener = vi.fn();
      orchestrator.on('secret:detected', secretListener);

      const fileContent = `# Configuration file
DATABASE_URL=postgres://user:pass@localhost:5432/db
TEST_PATTERN=TEST_INTEGRATION_API12345
DEBUG=true`;

      orchestrator.processToolOutput('file-read', 'Read', 'read-config', fileContent);

      expect(secretListener).toHaveBeenCalledOnce();
      const eventData = secretListener.mock.calls[0][0] as SecretDetectedEvent;
      expect(eventData.toolName).toBe('Read');
      expect(eventData.findings.length).toBe(1);
    });

    it('should detect test patterns in command execution outputs', () => {
      const secretListener = vi.fn();
      orchestrator.on('secret:detected', secretListener);

      const commandOutput = `Environment variables:
PATH=/usr/bin:/bin
TEST_TOKEN=TEST_INTEGRATION_CMD98765
USER=testuser`;

      orchestrator.processToolOutput('cmd-exec', 'Bash', 'env-cmd', commandOutput);

      expect(secretListener).toHaveBeenCalledOnce();
      const eventData = secretListener.mock.calls[0][0] as SecretDetectedEvent;
      expect(eventData.toolName).toBe('Bash');
    });

    it('should track test patterns across multiple tool calls', () => {
      const secretListener = vi.fn();
      orchestrator.on('secret:detected', secretListener);

      orchestrator.processToolOutput('multi-1', 'Read', 'call-1', 'Config: TEST_INTEGRATION_TRACK123');
      orchestrator.processToolOutput('multi-2', 'Write', 'call-2', 'Output: TEST_INTEGRATION_TRACK456');

      expect(secretListener).toHaveBeenCalledTimes(2);

      const call1Data = secretListener.mock.calls[0][0] as SecretDetectedEvent;
      const call2Data = secretListener.mock.calls[1][0] as SecretDetectedEvent;

      expect(call1Data.toolName).toBe('Read');
      expect(call1Data.callId).toBe('call-1');
      expect(call2Data.toolName).toBe('Write');
      expect(call2Data.callId).toBe('call-2');
    });
  });
});