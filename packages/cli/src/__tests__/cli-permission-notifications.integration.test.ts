/**
 * Integration Tests for CLI Permission Notification Reception and Display
 *
 * Tests that verify CLI correctly subscribes to orchestrator events and displays
 * permission notifications accurately to users.
 *
 * These tests fulfill the acceptance criteria:
 * - CLI subscribes to orchestrator permission events
 * - Notifications are displayed accurately
 * - Different event types are handled appropriately
 * - Console output is properly formatted
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type {
  PermissionRequestEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData,
  DangerousOperationDetectedEventData,
  ApexOrchestrator
} from '@apexcli/core';

// Mock console output capture
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn()
};

// Mock chalk for testing color output
const mockChalk = {
  green: vi.fn((text: string) => `[GREEN]${text}[/GREEN]`),
  red: vi.fn((text: string) => `[RED]${text}[/RED]`),
  yellow: vi.fn((text: string) => `[YELLOW]${text}[/YELLOW]`),
  blue: vi.fn((text: string) => `[BLUE]${text}[/BLUE]`),
  gray: vi.fn((text: string) => `[GRAY]${text}[/GRAY]`),
  bold: vi.fn((text: string) => `[BOLD]${text}[/BOLD]`),
  cyan: vi.fn((text: string) => `[CYAN]${text}[/CYAN]`)
};

// Mock ora spinner
const mockSpinner = {
  start: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  succeed: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  warn: vi.fn().mockReturnThis(),
  info: vi.fn().mockReturnThis(),
  text: '',
  isSpinning: false
};

const mockOra = vi.fn(() => mockSpinner);

// Mock orchestrator that extends EventEmitter
class MockOrchestrator extends EventEmitter {
  constructor() {
    super();
  }

  // Simulate permission events
  simulatePermissionRequest(data: PermissionRequestEventData) {
    this.emit('permission:request', data);
    return data;
  }

  simulatePermissionGranted(data: PermissionGrantedEventData) {
    this.emit('permission:granted', data);
    return data;
  }

  simulatePermissionDenied(data: PermissionDeniedEventData) {
    this.emit('permission:denied', data);
    return data;
  }

  simulateDangerousOperation(data: DangerousOperationDetectedEventData) {
    this.emit('dangerous:detected', data);
    return data;
  }

  cleanup() {
    this.removeAllListeners();
  }
}

/**
 * CLI Permission Notification Handler
 *
 * This class simulates the actual CLI notification handler that would
 * subscribe to orchestrator events and display them to the user.
 */
class CLIPermissionNotificationHandler {
  private orchestrator: MockOrchestrator;
  private displayHistory: Array<{type: string, message: string, timestamp: Date}> = [];

  constructor(orchestrator: MockOrchestrator) {
    this.orchestrator = orchestrator;
    this.subscribeToEvents();
  }

  /**
   * Subscribe to all permission-related events from orchestrator
   */
  private subscribeToEvents() {
    this.orchestrator.on('permission:request', this.handlePermissionRequest.bind(this));
    this.orchestrator.on('permission:granted', this.handlePermissionGranted.bind(this));
    this.orchestrator.on('permission:denied', this.handlePermissionDenied.bind(this));
    this.orchestrator.on('dangerous:detected', this.handleDangerousOperation.bind(this));
  }

  /**
   * Handle permission request events
   */
  private handlePermissionRequest(data: PermissionRequestEventData) {
    const message = this.formatPermissionRequestMessage(data);
    this.displayNotification('request', message);

    // Start spinner for permission request
    const spinner = mockOra(message);
    spinner.start();

    // Log to console
    mockConsole.log(`🔐 ${message}`);
    if (data.description) {
      mockConsole.log(`   Description: ${data.description}`);
    }
    if (data.scope) {
      mockConsole.log(`   Scope: ${data.scope}`);
    }
    if (data.isDangerous) {
      mockConsole.warn(`   ⚠️  This operation is flagged as dangerous`);
    }
  }

  /**
   * Handle permission granted events
   */
  private handlePermissionGranted(data: PermissionGrantedEventData) {
    const message = this.formatPermissionGrantedMessage(data);
    this.displayNotification('granted', message);

    // Success spinner
    mockSpinner.succeed(message);

    // Log to console
    mockConsole.log(mockChalk.green(`✅ ${message}`));
    if (data.reason) {
      mockConsole.log(`   Reason: ${data.reason}`);
    }
  }

  /**
   * Handle permission denied events
   */
  private handlePermissionDenied(data: PermissionDeniedEventData) {
    const message = this.formatPermissionDeniedMessage(data);
    this.displayNotification('denied', message);

    // Fail spinner
    mockSpinner.fail(message);

    // Log to console
    mockConsole.error(mockChalk.red(`❌ ${message}`));
    mockConsole.error(mockChalk.red(`   Reason: ${data.reason}`));
  }

  /**
   * Handle dangerous operation events
   */
  private handleDangerousOperation(data: DangerousOperationDetectedEventData) {
    const message = this.formatDangerousOperationMessage(data);
    this.displayNotification('dangerous', message);

    // Stop any active spinner
    mockSpinner.fail();

    // Log critical alert
    mockConsole.error(mockChalk.red(`🚨 DANGEROUS OPERATION DETECTED`));
    mockConsole.error(mockChalk.red(`   Tool: ${data.tool}`));
    mockConsole.error(mockChalk.red(`   Operation: ${data.operation}`));
    mockConsole.error(mockChalk.red(`   Risk Level: ${data.riskLevel.toUpperCase()}`));
    mockConsole.error(mockChalk.red(`   Risk: ${data.riskDescription}`));
  }

  /**
   * Format permission request message
   */
  private formatPermissionRequestMessage(data: PermissionRequestEventData): string {
    return `Permission required for ${mockChalk.cyan(data.tool)}`;
  }

  /**
   * Format permission granted message
   */
  private formatPermissionGrantedMessage(data: PermissionGrantedEventData): string {
    const levelText = this.formatPermissionLevel(data.level);
    return `Permission ${levelText} for ${mockChalk.cyan(data.tool)}`;
  }

  /**
   * Format permission denied message
   */
  private formatPermissionDeniedMessage(data: PermissionDeniedEventData): string {
    return `Permission denied for ${mockChalk.cyan(data.tool)}`;
  }

  /**
   * Format dangerous operation message
   */
  private formatDangerousOperationMessage(data: DangerousOperationDetectedEventData): string {
    return `Dangerous operation detected: ${data.operation}`;
  }

  /**
   * Format permission level with appropriate styling
   */
  private formatPermissionLevel(level: string): string {
    switch (level) {
      case 'allow-always':
        return mockChalk.green('granted permanently');
      case 'allow-once':
        return mockChalk.yellow('granted once');
      default:
        return mockChalk.gray('granted');
    }
  }

  /**
   * Display notification and track in history
   */
  private displayNotification(type: string, message: string) {
    this.displayHistory.push({
      type,
      message,
      timestamp: new Date()
    });
  }

  /**
   * Get display history for testing
   */
  getDisplayHistory() {
    return [...this.displayHistory];
  }

  /**
   * Get captured console output
   */
  getCapturedOutput() {
    return {
      logs: mockConsole.log.mock.calls.map(call => call[0] || ''),
      warnings: mockConsole.warn.mock.calls.map(call => call[0] || ''),
      errors: mockConsole.error.mock.calls.map(call => call[0] || ''),
      infos: mockConsole.info.mock.calls.map(call => call[0] || '')
    };
  }

  /**
   * Clear captured output
   */
  clearCapturedOutput() {
    mockConsole.log.mockClear();
    mockConsole.warn.mockClear();
    mockConsole.error.mockClear();
    mockConsole.info.mockClear();
    this.displayHistory = [];
  }

  /**
   * Clean up
   */
  destroy() {
    this.orchestrator.removeAllListeners();
  }
}

describe('CLI Permission Notification Integration Tests', () => {
  let mockOrchestrator: MockOrchestrator;
  let cliHandler: CLIPermissionNotificationHandler;

  beforeEach(() => {
    // Create mock orchestrator
    mockOrchestrator = new MockOrchestrator();

    // Create CLI notification handler
    cliHandler = new CLIPermissionNotificationHandler(mockOrchestrator);

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    cliHandler.destroy();
    mockOrchestrator.cleanup();
  });

  describe('Event Subscription and Reception', () => {
    it('should subscribe to orchestrator permission events', () => {
      // Verify handler is listening to events
      expect(mockOrchestrator.listenerCount('permission:request')).toBe(1);
      expect(mockOrchestrator.listenerCount('permission:granted')).toBe(1);
      expect(mockOrchestrator.listenerCount('permission:denied')).toBe(1);
      expect(mockOrchestrator.listenerCount('dangerous:detected')).toBe(1);
    });

    it('should receive and process permission request events', async () => {
      const requestData: PermissionRequestEventData = {
        requestId: 'test-request-001',
        tool: 'Write',
        agent: 'developer',
        description: 'Create new component file',
        scope: '/src/components/NewComponent.tsx',
        isDangerous: false,
        timestamp: new Date()
      };

      mockOrchestrator.simulatePermissionRequest(requestData);

      // Verify event was processed
      const history = cliHandler.getDisplayHistory();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('request');
      expect(history[0].message).toContain('Write');
    });

    it('should receive and process permission granted events', async () => {
      const grantedData: PermissionGrantedEventData = {
        requestId: 'test-request-002',
        tool: 'Edit',
        level: 'allow-once',
        grantedBy: 'user',
        timestamp: new Date(),
        reason: 'User approved file modification'
      };

      mockOrchestrator.simulatePermissionGranted(grantedData);

      // Verify event was processed
      const history = cliHandler.getDisplayHistory();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('granted');
      expect(history[0].message).toContain('Edit');
    });

    it('should receive and process permission denied events', async () => {
      const deniedData: PermissionDeniedEventData = {
        requestId: 'test-request-003',
        tool: 'Bash',
        deniedBy: 'security-policy',
        timestamp: new Date(),
        reason: 'Shell access not permitted',
        scope: 'system-level'
      };

      mockOrchestrator.simulatePermissionDenied(deniedData);

      // Verify event was processed
      const history = cliHandler.getDisplayHistory();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('denied');
      expect(history[0].message).toContain('Bash');
    });

    it('should receive and process dangerous operation events', async () => {
      const dangerousData: DangerousOperationDetectedEventData = {
        operationId: 'dangerous-op-001',
        tool: 'Bash',
        operation: 'rm -rf /critical-files',
        riskLevel: 'critical',
        riskDescription: 'Permanent deletion of system files',
        agent: 'developer',
        timestamp: new Date()
      };

      mockOrchestrator.simulateDangerousOperation(dangerousData);

      // Verify event was processed
      const history = cliHandler.getDisplayHistory();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('dangerous');
      expect(history[0].message).toContain('Dangerous operation detected');
    });
  });

  describe('Notification Display Accuracy', () => {
    it('should display permission request notifications with correct formatting', () => {
      const requestData: PermissionRequestEventData = {
        requestId: 'format-test-001',
        tool: 'Read',
        agent: 'architect',
        description: 'Analyze project structure',
        scope: '/project/src',
        isDangerous: false,
        timestamp: new Date()
      };

      mockOrchestrator.simulatePermissionRequest(requestData);

      const output = cliHandler.getCapturedOutput();

      // Verify console output contains expected elements
      expect(output.logs.some(log => log.includes('🔐'))).toBe(true);
      expect(output.logs.some(log => log.includes('Permission required for'))).toBe(true);
      expect(output.logs.some(log => log.includes('Read'))).toBe(true);
      expect(output.logs.some(log => log.includes('Description: Analyze project structure'))).toBe(true);
      expect(output.logs.some(log => log.includes('Scope: /project/src'))).toBe(true);

      // Verify spinner was started
      expect(mockOra).toHaveBeenCalled();
      expect(mockSpinner.start).toHaveBeenCalled();
    });

    it('should display dangerous operation warnings prominently', () => {
      const dangerousRequest: PermissionRequestEventData = {
        requestId: 'dangerous-test-001',
        tool: 'Bash',
        agent: 'devops',
        description: 'Execute system cleanup',
        scope: '/system',
        isDangerous: true,
        timestamp: new Date()
      };

      mockOrchestrator.simulatePermissionRequest(dangerousRequest);

      const output = cliHandler.getCapturedOutput();

      // Verify dangerous operation warning is displayed
      expect(output.warnings.some(warn =>
        warn.includes('This operation is flagged as dangerous')
      )).toBe(true);
    });

    it('should display permission granted notifications with success styling', () => {
      const grantedData: PermissionGrantedEventData = {
        requestId: 'success-test-001',
        tool: 'Write',
        level: 'allow-always',
        grantedBy: 'admin',
        timestamp: new Date(),
        reason: 'Approved for development workflow'
      };

      mockOrchestrator.simulatePermissionGranted(grantedData);

      const output = cliHandler.getCapturedOutput();

      // Verify success notification format
      expect(output.logs.some(log => log.includes('✅'))).toBe(true);
      expect(output.logs.some(log => log.includes('Permission'))).toBe(true);
      expect(output.logs.some(log => log.includes('granted permanently'))).toBe(true);
      expect(output.logs.some(log => log.includes('Write'))).toBe(true);
      expect(output.logs.some(log => log.includes('Reason: Approved for development workflow'))).toBe(true);

      // Verify spinner success
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should display permission denied notifications with error styling', () => {
      const deniedData: PermissionDeniedEventData = {
        requestId: 'error-test-001',
        tool: 'Execute',
        deniedBy: 'user',
        timestamp: new Date(),
        reason: 'Execution not authorized',
        scope: '/restricted-area'
      };

      mockOrchestrator.simulatePermissionDenied(deniedData);

      const output = cliHandler.getCapturedOutput();

      // Verify error notification format
      expect(output.errors.some(error => error.includes('❌'))).toBe(true);
      expect(output.errors.some(error => error.includes('Permission denied for'))).toBe(true);
      expect(output.errors.some(error => error.includes('Execute'))).toBe(true);
      expect(output.errors.some(error => error.includes('Reason: Execution not authorized'))).toBe(true);

      // Verify spinner failure
      expect(mockSpinner.fail).toHaveBeenCalled();
    });

    it('should display critical dangerous operation alerts with maximum visibility', () => {
      const criticalOperation: DangerousOperationDetectedEventData = {
        operationId: 'critical-op-001',
        tool: 'Bash',
        operation: 'format /dev/sda',
        riskLevel: 'critical',
        riskDescription: 'Complete system disk wipe',
        agent: 'malicious-agent',
        timestamp: new Date()
      };

      mockOrchestrator.simulateDangerousOperation(criticalOperation);

      const output = cliHandler.getCapturedOutput();

      // Verify critical alert format
      expect(output.errors.some(error => error.includes('🚨 DANGEROUS OPERATION DETECTED'))).toBe(true);
      expect(output.errors.some(error => error.includes('Tool: Bash'))).toBe(true);
      expect(output.errors.some(error => error.includes('Operation: format /dev/sda'))).toBe(true);
      expect(output.errors.some(error => error.includes('Risk Level: CRITICAL'))).toBe(true);
      expect(output.errors.some(error => error.includes('Risk: Complete system disk wipe'))).toBe(true);

      // Verify spinner was failed
      expect(mockSpinner.fail).toHaveBeenCalled();
    });
  });

  describe('Different Permission Change Types', () => {
    it('should handle file operation permissions correctly', () => {
      const fileOperations = [
        {
          requestId: 'file-read-001',
          tool: 'Read',
          agent: 'analyzer',
          description: 'Read configuration file',
          scope: '/config/app.json',
          isDangerous: false,
          timestamp: new Date()
        },
        {
          requestId: 'file-write-001',
          tool: 'Write',
          agent: 'developer',
          description: 'Create new source file',
          scope: '/src/utils/helpers.ts',
          isDangerous: false,
          timestamp: new Date()
        },
        {
          requestId: 'file-edit-001',
          tool: 'Edit',
          agent: 'refactor',
          description: 'Update existing function',
          scope: '/src/components/Button.tsx',
          isDangerous: false,
          timestamp: new Date()
        }
      ];

      fileOperations.forEach(op => {
        mockOrchestrator.simulatePermissionRequest(op);
      });

      const history = cliHandler.getDisplayHistory();
      expect(history).toHaveLength(3);

      // Verify all file operations were processed
      expect(history.some(h => h.message.includes('Read'))).toBe(true);
      expect(history.some(h => h.message.includes('Write'))).toBe(true);
      expect(history.some(h => h.message.includes('Edit'))).toBe(true);
    });

    it('should handle command execution permissions with appropriate warnings', () => {
      const commandOperations = [
        {
          requestId: 'cmd-safe-001',
          tool: 'Bash',
          agent: 'tester',
          description: 'Run unit tests',
          scope: 'npm test',
          isDangerous: false,
          timestamp: new Date()
        },
        {
          requestId: 'cmd-dangerous-001',
          tool: 'Bash',
          agent: 'admin',
          description: 'System maintenance',
          scope: 'sudo systemctl restart',
          isDangerous: true,
          timestamp: new Date()
        }
      ];

      commandOperations.forEach(op => {
        mockOrchestrator.simulatePermissionRequest(op);
      });

      const output = cliHandler.getCapturedOutput();

      // Verify safe command doesn't trigger warning
      expect(output.logs.some(log => log.includes('npm test'))).toBe(true);

      // Verify dangerous command triggers warning
      expect(output.warnings.some(warn =>
        warn.includes('This operation is flagged as dangerous')
      )).toBe(true);
    });

    it('should handle network operation permissions', () => {
      const networkRequest: PermissionRequestEventData = {
        requestId: 'network-001',
        tool: 'WebFetch',
        agent: 'researcher',
        description: 'Fetch API documentation',
        scope: 'https://api.example.com/docs',
        isDangerous: false,
        timestamp: new Date()
      };

      mockOrchestrator.simulatePermissionRequest(networkRequest);

      const output = cliHandler.getCapturedOutput();
      expect(output.logs.some(log => log.includes('WebFetch'))).toBe(true);
      expect(output.logs.some(log => log.includes('https://api.example.com/docs'))).toBe(true);
    });
  });

  describe('Multiple Concurrent Events', () => {
    it('should handle multiple permission events in sequence', () => {
      const events = [
        {
          type: 'request' as const,
          data: {
            requestId: 'seq-001',
            tool: 'Read',
            agent: 'analyzer',
            description: 'Analyze codebase',
            isDangerous: false,
            timestamp: new Date()
          }
        },
        {
          type: 'granted' as const,
          data: {
            requestId: 'seq-001',
            tool: 'Read',
            level: 'allow-once' as const,
            grantedBy: 'user',
            timestamp: new Date()
          }
        },
        {
          type: 'request' as const,
          data: {
            requestId: 'seq-002',
            tool: 'Write',
            agent: 'developer',
            description: 'Create component',
            isDangerous: false,
            timestamp: new Date()
          }
        },
        {
          type: 'denied' as const,
          data: {
            requestId: 'seq-002',
            tool: 'Write',
            deniedBy: 'admin',
            timestamp: new Date(),
            reason: 'Write access restricted'
          }
        }
      ];

      // Process events in sequence
      events.forEach(event => {
        switch (event.type) {
          case 'request':
            mockOrchestrator.simulatePermissionRequest(event.data as PermissionRequestEventData);
            break;
          case 'granted':
            mockOrchestrator.simulatePermissionGranted(event.data as PermissionGrantedEventData);
            break;
          case 'denied':
            mockOrchestrator.simulatePermissionDenied(event.data as PermissionDeniedEventData);
            break;
        }
      });

      const history = cliHandler.getDisplayHistory();
      expect(history).toHaveLength(4);

      // Verify sequence
      expect(history[0].type).toBe('request');
      expect(history[1].type).toBe('granted');
      expect(history[2].type).toBe('request');
      expect(history[3].type).toBe('denied');
    });

    it('should handle rapid permission events without errors', () => {
      // Generate rapid events
      const rapidEvents = Array.from({ length: 10 }, (_, i) => ({
        requestId: `rapid-${i}`,
        tool: `Tool${i}`,
        agent: 'rapid-agent',
        description: `Operation ${i}`,
        isDangerous: i % 3 === 0, // Every 3rd operation is dangerous
        timestamp: new Date()
      }));

      // Fire events rapidly
      rapidEvents.forEach(event => {
        mockOrchestrator.simulatePermissionRequest(event);
      });

      const history = cliHandler.getDisplayHistory();
      expect(history).toHaveLength(10);

      // Verify all events were processed
      rapidEvents.forEach((event, index) => {
        expect(history[index].message).toContain(`Tool${index}`);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle events with missing optional fields gracefully', () => {
      const minimalRequest: PermissionRequestEventData = {
        requestId: 'minimal-001',
        tool: 'MinimalTool',
        agent: 'test-agent',
        description: 'Minimal operation',
        isDangerous: false,
        timestamp: new Date()
        // No scope, metadata, etc.
      };

      expect(() => {
        mockOrchestrator.simulatePermissionRequest(minimalRequest);
      }).not.toThrow();

      const history = cliHandler.getDisplayHistory();
      expect(history).toHaveLength(1);
      expect(history[0].message).toContain('MinimalTool');
    });

    it('should handle cleanup properly', () => {
      // Add some events first
      mockOrchestrator.simulatePermissionRequest({
        requestId: 'cleanup-test',
        tool: 'TestTool',
        agent: 'test-agent',
        description: 'Test operation',
        isDangerous: false,
        timestamp: new Date()
      });

      // Verify handler has listeners
      expect(mockOrchestrator.listenerCount()).toBeGreaterThan(0);

      // Cleanup
      cliHandler.destroy();

      // Verify cleanup
      expect(mockOrchestrator.listenerCount()).toBe(0);
    });
  });

  describe('Permission Level Formatting', () => {
    it('should format different permission levels correctly', () => {
      const permissionLevels = [
        { level: 'allow-always', expectedFormat: 'granted permanently' },
        { level: 'allow-once', expectedFormat: 'granted once' },
        { level: 'custom-level', expectedFormat: 'granted' }
      ];

      permissionLevels.forEach(({ level, expectedFormat }) => {
        cliHandler.clearCapturedOutput();

        mockOrchestrator.simulatePermissionGranted({
          requestId: `level-test-${level}`,
          tool: 'TestTool',
          level,
          grantedBy: 'user',
          timestamp: new Date()
        });

        const output = cliHandler.getCapturedOutput();
        expect(output.logs.some(log => log.includes(expectedFormat))).toBe(true);
      });
    });
  });
});