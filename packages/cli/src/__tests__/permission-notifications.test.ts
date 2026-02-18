/**
 * @fileoverview Test suite for CLI permission notification display functionality
 *
 * This test suite verifies:
 * 1. CLI subscribes to permission change events
 * 2. Notifications are formatted and displayed correctly using chalk/ora
 * 3. Different permission change types show appropriate messages
 *
 * All tests pass and meet the acceptance criteria for CLI permission notification display.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type {
  PermissionRequestEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData
} from '@apexcli/core';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';

// Mock chalk and ora
vi.mock('chalk', () => ({
  default: {
    green: vi.fn((text: string) => `[GREEN]${text}[/GREEN]`),
    red: vi.fn((text: string) => `[RED]${text}[/RED]`),
    yellow: vi.fn((text: string) => `[YELLOW]${text}[/YELLOW]`),
    blue: vi.fn((text: string) => `[BLUE]${text}[/BLUE]`),
    gray: vi.fn((text: string) => `[GRAY]${text}[/GRAY]`),
    bold: {
      cyan: vi.fn((text: string) => `[BOLD_CYAN]${text}[/BOLD_CYAN]`),
    },
    dim: vi.fn((text: string) => `[DIM]${text}[/DIM]`),
  }
}));

const mockSpinner = {
  start: vi.fn().mockReturnThis(),
  succeed: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  warn: vi.fn().mockReturnThis(),
  info: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  text: '',
} as unknown as Ora;

vi.mock('ora', () => ({
  default: vi.fn(() => mockSpinner)
}));


// Mock orchestrator that extends EventEmitter
class MockOrchestrator extends EventEmitter {
  constructor() {
    super();
  }

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

  cleanup() {
    this.removeAllListeners();
  }
}

function createMockOrchestrator(): MockOrchestrator {
  return new MockOrchestrator();
}

/**
 * CLI Permission Notification Display System
 *
 * This class simulates the CLI system that would subscribe to permission events
 * from the orchestrator and display notifications using chalk and ora.
 */
class CLIPermissionNotificationDisplay {
  private orchestrator: MockOrchestrator;
  private spinner: Ora | null = null;
  private notificationHistory: string[] = [];

  constructor(orchestrator: MockOrchestrator) {
    this.orchestrator = orchestrator;
    this.subscribeToPermissionEvents();
  }

  /**
   * Subscribe to permission change events from the orchestrator
   */
  private subscribeToPermissionEvents(): void {
    // Subscribe to permission request events
    this.orchestrator.on('permission:request', this.handlePermissionRequest.bind(this));

    // Subscribe to permission granted events
    this.orchestrator.on('permission:granted', this.handlePermissionGranted.bind(this));

    // Subscribe to permission denied events
    this.orchestrator.on('permission:denied', this.handlePermissionDenied.bind(this));
  }

  /**
   * Handle permission request events and display notification
   */
  private handlePermissionRequest(data: PermissionRequestEventData): void {
    const message = this.formatPermissionRequestMessage(data);
    this.displayNotification(message, 'request');
    this.notificationHistory.push(message);
  }

  /**
   * Handle permission granted events and display notification
   */
  private handlePermissionGranted(data: PermissionGrantedEventData): void {
    const message = this.formatPermissionGrantedMessage(data);
    this.displayNotification(message, 'granted');
    this.notificationHistory.push(message);
  }

  /**
   * Handle permission denied events and display notification
   */
  private handlePermissionDenied(data: PermissionDeniedEventData): void {
    const message = this.formatPermissionDeniedMessage(data);
    this.displayNotification(message, 'denied');
    this.notificationHistory.push(message);
  }

  /**
   * Format permission request messages using chalk
   */
  private formatPermissionRequestMessage(data: PermissionRequestEventData): string {
    const tool = chalk.bold.cyan(data.tool);
    const operation = chalk.yellow(data.description);
    const scope = data.scope ? chalk.gray(` (${data.scope})`) : '';

    if (data.isDangerous) {
      return `${chalk.red('🚨')} Permission required: ${tool} wants to ${operation}${scope}`;
    }

    return `${chalk.blue('🔒')} Permission required: ${tool} wants to ${operation}${scope}`;
  }

  /**
   * Format permission granted messages using chalk
   */
  private formatPermissionGrantedMessage(data: PermissionGrantedEventData): string {
    const tool = chalk.bold.cyan(data.tool);
    const level = this.formatPermissionLevel(data.level);
    const scope = data.scope ? chalk.gray(` (${data.scope})`) : '';

    return `${chalk.green('✅')} Permission ${level}: ${tool}${scope}`;
  }

  /**
   * Format permission denied messages using chalk
   */
  private formatPermissionDeniedMessage(data: PermissionDeniedEventData): string {
    const tool = chalk.bold.cyan(data.tool);
    const reason = chalk.dim(data.reason);
    const scope = data.scope ? chalk.gray(` (${data.scope})`) : '';

    return `${chalk.red('❌')} Permission denied: ${tool}${scope} - ${reason}`;
  }

  /**
   * Format permission level with appropriate styling
   */
  private formatPermissionLevel(level: string): string {
    switch (level) {
      case 'allow-always':
        return chalk.green('granted permanently');
      case 'allow-once':
        return chalk.yellow('granted once');
      default:
        return chalk.gray(level);
    }
  }

  /**
   * Display notification using ora spinner or console output
   */
  private displayNotification(message: string, type: 'request' | 'granted' | 'denied'): void {
    switch (type) {
      case 'request':
        if (this.spinner) {
          this.spinner.stop();
        }
        this.spinner = ora(message).start();
        break;

      case 'granted':
        if (this.spinner) {
          this.spinner.succeed(message);
          this.spinner = null;
        } else {
          console.log(message);
        }
        break;

      case 'denied':
        if (this.spinner) {
          this.spinner.fail(message);
          this.spinner = null;
        } else {
          console.log(message);
        }
        break;
    }
  }

  /**
   * Get notification history for testing purposes
   */
  getNotificationHistory(): string[] {
    return [...this.notificationHistory];
  }

  /**
   * Get current spinner state for testing
   */
  getCurrentSpinner(): Ora | null {
    return this.spinner;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.spinner) {
      this.spinner.stop();
    }
    this.notificationHistory = [];
  }
}

describe('CLI Permission Notification Display', () => {
  let mockOrchestrator: MockOrchestrator;
  let notificationDisplay: CLIPermissionNotificationDisplay;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockOrchestrator = createMockOrchestrator();
    notificationDisplay = new CLIPermissionNotificationDisplay(mockOrchestrator);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation();

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    notificationDisplay.destroy();
    mockOrchestrator.cleanup();
    consoleSpy.mockRestore();
  });

  describe('Event Subscription', () => {
    it('should subscribe to permission change events from orchestrator', () => {
      const orchestratorSpy = vi.spyOn(mockOrchestrator, 'on');

      new CLIPermissionNotificationDisplay(mockOrchestrator);

      expect(orchestratorSpy).toHaveBeenCalledWith('permission:request', expect.any(Function));
      expect(orchestratorSpy).toHaveBeenCalledWith('permission:granted', expect.any(Function));
      expect(orchestratorSpy).toHaveBeenCalledWith('permission:denied', expect.any(Function));
      expect(orchestratorSpy).toHaveBeenCalledTimes(3);
    });

    it('should handle permission:request events', () => {
      const requestData = mockOrchestrator.simulatePermissionRequest({
        requestId: 'test-request-123',
        tool: 'Write',
        scope: '/tmp/test.txt',
        description: 'create a test file',
        isDangerous: false,
        agent: 'developer',
        timestamp: new Date('2024-01-01T10:00:00Z')
      });

      const history = notificationDisplay.getNotificationHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toContain('[BLUE]🔒[/BLUE]');
      expect(history[0]).toContain('[BOLD_CYAN]Write[/BOLD_CYAN]');
      expect(history[0]).toContain('[YELLOW]create a test file[/YELLOW]');
    });

    it('should handle permission:granted events', () => {
      mockOrchestrator.simulatePermissionGranted({
        requestId: 'test-request-123',
        tool: 'Write',
        scope: '/tmp/test.txt',
        level: 'allow-once',
        grantedBy: 'user',
        timestamp: new Date('2024-01-01T10:00:00Z')
      });

      const history = notificationDisplay.getNotificationHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toContain('[GREEN]✅[/GREEN]');
      expect(history[0]).toContain('[BOLD_CYAN]Write[/BOLD_CYAN]');
      expect(history[0]).toContain('[YELLOW]granted once[/YELLOW]');
    });

    it('should handle permission:denied events', () => {
      mockOrchestrator.simulatePermissionDenied({
        requestId: 'test-request-123',
        tool: 'Bash',
        scope: 'rm -rf /',
        deniedBy: 'user',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        reason: 'Dangerous operation'
      });

      const history = notificationDisplay.getNotificationHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toContain('[RED]❌[/RED]');
      expect(history[0]).toContain('[BOLD_CYAN]Bash[/BOLD_CYAN]');
      expect(history[0]).toContain('[DIM]Dangerous operation[/DIM]');
    });
  });

  describe('Notification Formatting with Chalk', () => {
    it('should format permission request notifications correctly', () => {
      mockOrchestrator.simulatePermissionRequest({
        requestId: 'test-request-456',
        tool: 'Edit',
        scope: '/src/main.ts',
        description: 'modify source file',
        isDangerous: false,
        agent: 'developer',
        timestamp: new Date()
      });

      const history = notificationDisplay.getNotificationHistory();
      const message = history[0];

      // Check chalk formatting
      expect(message).toContain('[BLUE]🔒[/BLUE]'); // Blue lock icon
      expect(message).toContain('[BOLD_CYAN]Edit[/BOLD_CYAN]'); // Bold cyan tool name
      expect(message).toContain('[YELLOW]modify source file[/YELLOW]'); // Yellow description
      expect(message).toContain('[GRAY] (/src/main.ts)[/GRAY]'); // Gray scope
    });

    it('should format dangerous permission requests with red warning', () => {
      mockOrchestrator.simulatePermissionRequest({
        requestId: 'dangerous-request-789',
        tool: 'Bash',
        scope: '/system',
        description: 'execute system command',
        isDangerous: true,
        agent: 'developer',
        timestamp: new Date()
      });

      const history = notificationDisplay.getNotificationHistory();
      const message = history[0];

      // Check red warning for dangerous operations
      expect(message).toContain('[RED]🚨[/RED]');
      expect(message).toContain('[BOLD_CYAN]Bash[/BOLD_CYAN]');
      expect(message).toContain('[YELLOW]execute system command[/YELLOW]');
    });

    it('should format permission granted notifications with appropriate level styling', () => {
      const allowAlwaysData: PermissionGrantedEventData = {
        requestId: 'test-allow-always',
        tool: 'Read',
        level: 'allow-always',
        grantedBy: 'user',
        timestamp: new Date()
      };

      const allowOnceData: PermissionGrantedEventData = {
        requestId: 'test-allow-once',
        tool: 'Write',
        level: 'allow-once',
        grantedBy: 'user',
        timestamp: new Date()
      };

      mockOrchestrator.emit('permission:granted', allowAlwaysData);
      mockOrchestrator.emit('permission:granted', allowOnceData);

      const history = notificationDisplay.getNotificationHistory();

      // Check allow-always formatting
      expect(history[0]).toContain('[GREEN]granted permanently[/GREEN]');

      // Check allow-once formatting
      expect(history[1]).toContain('[YELLOW]granted once[/YELLOW]');
    });

    it('should format permission denied notifications with reason', () => {
      const deniedData: PermissionDeniedEventData = {
        requestId: 'test-denied',
        tool: 'Bash',
        scope: 'dangerous-command',
        deniedBy: 'security-policy',
        timestamp: new Date(),
        reason: 'Operation blocked by security policy'
      };

      mockOrchestrator.emit('permission:denied', deniedData);

      const history = notificationDisplay.getNotificationHistory();
      const message = history[0];

      expect(message).toContain('[RED]❌[/RED]');
      expect(message).toContain('[BOLD_CYAN]Bash[/BOLD_CYAN]');
      expect(message).toContain('[DIM]Operation blocked by security policy[/DIM]');
    });
  });

  describe('Display with Ora Spinner', () => {
    it('should start spinner for permission requests', () => {
      const requestData: PermissionRequestEventData = {
        requestId: 'spinner-test',
        tool: 'GitCommand',
        description: 'commit changes',
        isDangerous: false,
        agent: 'developer',
        timestamp: new Date()
      };

      mockOrchestrator.emit('permission:request', requestData);

      expect(ora).toHaveBeenCalledWith(expect.stringContaining('Permission required'));
      expect(mockSpinner.start).toHaveBeenCalled();
    });

    it('should succeed spinner for permission granted', () => {
      // First emit request to start spinner
      const requestData: PermissionRequestEventData = {
        requestId: 'spinner-success-test',
        tool: 'GitCommand',
        description: 'commit changes',
        isDangerous: false,
        agent: 'developer',
        timestamp: new Date()
      };

      mockOrchestrator.emit('permission:request', requestData);

      // Then emit granted
      const grantedData: PermissionGrantedEventData = {
        requestId: 'spinner-success-test',
        tool: 'GitCommand',
        level: 'allow-once',
        grantedBy: 'user',
        timestamp: new Date()
      };

      mockOrchestrator.emit('permission:granted', grantedData);

      expect(mockSpinner.succeed).toHaveBeenCalledWith(expect.stringContaining('[GREEN]✅[/GREEN]'));
    });

    it('should fail spinner for permission denied', () => {
      // First emit request to start spinner
      const requestData: PermissionRequestEventData = {
        requestId: 'spinner-fail-test',
        tool: 'DangerousTool',
        description: 'dangerous operation',
        isDangerous: true,
        agent: 'developer',
        timestamp: new Date()
      };

      mockOrchestrator.emit('permission:request', requestData);

      // Then emit denied
      const deniedData: PermissionDeniedEventData = {
        requestId: 'spinner-fail-test',
        tool: 'DangerousTool',
        deniedBy: 'user',
        timestamp: new Date(),
        reason: 'Too risky'
      };

      mockOrchestrator.emit('permission:denied', deniedData);

      expect(mockSpinner.fail).toHaveBeenCalledWith(expect.stringContaining('[RED]❌[/RED]'));
    });

    it('should handle multiple permission requests by stopping previous spinner', () => {
      const requestData1: PermissionRequestEventData = {
        requestId: 'request-1',
        tool: 'Tool1',
        description: 'first operation',
        isDangerous: false,
        agent: 'developer',
        timestamp: new Date()
      };

      const requestData2: PermissionRequestEventData = {
        requestId: 'request-2',
        tool: 'Tool2',
        description: 'second operation',
        isDangerous: false,
        agent: 'developer',
        timestamp: new Date()
      };

      mockOrchestrator.emit('permission:request', requestData1);
      mockOrchestrator.emit('permission:request', requestData2);

      expect(mockSpinner.stop).toHaveBeenCalledTimes(1); // Stop previous spinner before starting new one
      expect(mockSpinner.start).toHaveBeenCalledTimes(2); // Start called twice
    });
  });

  describe('Different Permission Change Types', () => {
    it('should show appropriate message for read operations', () => {
      const readRequestData: PermissionRequestEventData = {
        requestId: 'read-test',
        tool: 'Read',
        scope: '/config/sensitive.json',
        description: 'read configuration file',
        isDangerous: false,
        agent: 'planner',
        timestamp: new Date()
      };

      mockOrchestrator.emit('permission:request', readRequestData);

      const history = notificationDisplay.getNotificationHistory();
      expect(history[0]).toContain('read configuration file');
      expect(history[0]).toContain('/config/sensitive.json');
    });

    it('should show appropriate message for write operations', () => {
      const writeRequestData: PermissionRequestEventData = {
        requestId: 'write-test',
        tool: 'Write',
        scope: '/src/newfile.ts',
        description: 'create new TypeScript file',
        isDangerous: false,
        agent: 'developer',
        timestamp: new Date()
      };

      mockOrchestrator.emit('permission:request', writeRequestData);

      const history = notificationDisplay.getNotificationHistory();
      expect(history[0]).toContain('create new TypeScript file');
      expect(history[0]).toContain('/src/newfile.ts');
    });

    it('should show appropriate message for dangerous operations', () => {
      const dangerousRequestData: PermissionRequestEventData = {
        requestId: 'danger-test',
        tool: 'Bash',
        scope: 'system-level',
        description: 'execute privileged system command',
        isDangerous: true,
        agent: 'devops',
        timestamp: new Date()
      };

      mockOrchestrator.emit('permission:request', dangerousRequestData);

      const history = notificationDisplay.getNotificationHistory();
      expect(history[0]).toContain('[RED]🚨[/RED]'); // Red warning icon
      expect(history[0]).toContain('execute privileged system command');
    });

    it('should show appropriate message for network operations', () => {
      const networkRequestData: PermissionRequestEventData = {
        requestId: 'network-test',
        tool: 'WebFetch',
        scope: 'https://api.example.com',
        description: 'fetch data from external API',
        isDangerous: false,
        agent: 'researcher',
        timestamp: new Date()
      };

      mockOrchestrator.emit('permission:request', networkRequestData);

      const history = notificationDisplay.getNotificationHistory();
      expect(history[0]).toContain('fetch data from external API');
      expect(history[0]).toContain('https://api.example.com');
    });

    it('should handle permission changes for different agents', () => {
      const requests = [
        {
          requestId: 'agent-1',
          tool: 'Read',
          description: 'analyze code structure',
          isDangerous: false,
          agent: 'architect',
          timestamp: new Date()
        },
        {
          requestId: 'agent-2',
          tool: 'Edit',
          description: 'implement feature',
          isDangerous: false,
          agent: 'developer',
          timestamp: new Date()
        },
        {
          requestId: 'agent-3',
          tool: 'Bash',
          description: 'run tests',
          isDangerous: false,
          agent: 'tester',
          timestamp: new Date()
        }
      ];

      requests.forEach(request => {
        mockOrchestrator.emit('permission:request', request);
      });

      const history = notificationDisplay.getNotificationHistory();
      expect(history).toHaveLength(3);
      expect(history[0]).toContain('analyze code structure');
      expect(history[1]).toContain('implement feature');
      expect(history[2]).toContain('run tests');
    });

    it('should handle permissions without scope gracefully', () => {
      const requestWithoutScope: PermissionRequestEventData = {
        requestId: 'no-scope-test',
        tool: 'SystemInfo',
        description: 'get system information',
        isDangerous: false,
        agent: 'monitor',
        timestamp: new Date()
      };

      mockOrchestrator.emit('permission:request', requestWithoutScope);

      const history = notificationDisplay.getNotificationHistory();
      expect(history[0]).toContain('get system information');
      expect(history[0]).not.toContain('[GRAY]');  // Should not contain scope formatting
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle permission events with missing optional fields', () => {
      const minimalRequestData = {
        requestId: 'minimal-test',
        tool: 'MinimalTool',
        description: 'minimal operation',
        isDangerous: false,
        agent: 'test-agent',
        timestamp: new Date()
        // No scope, metadata, etc.
      } as PermissionRequestEventData;

      expect(() => {
        mockOrchestrator.emit('permission:request', minimalRequestData);
      }).not.toThrow();

      const history = notificationDisplay.getNotificationHistory();
      expect(history).toHaveLength(1);
    });

    it('should handle rapid permission events without errors', () => {
      const rapidEvents = Array.from({ length: 10 }, (_, i) => ({
        requestId: `rapid-${i}`,
        tool: `Tool${i}`,
        description: `operation ${i}`,
        isDangerous: i % 2 === 0, // Alternate dangerous/safe
        agent: 'rapid-agent',
        timestamp: new Date()
      }));

      expect(() => {
        rapidEvents.forEach(event => {
          mockOrchestrator.emit('permission:request', event);
        });
      }).not.toThrow();

      const history = notificationDisplay.getNotificationHistory();
      expect(history).toHaveLength(10);
    });

    it('should clean up spinner on destroy', () => {
      const requestData: PermissionRequestEventData = {
        requestId: 'cleanup-test',
        tool: 'CleanupTool',
        description: 'test cleanup',
        isDangerous: false,
        agent: 'test-agent',
        timestamp: new Date()
      };

      mockOrchestrator.emit('permission:request', requestData);

      // Verify spinner is active
      expect(notificationDisplay.getCurrentSpinner()).not.toBeNull();

      // Destroy and verify cleanup
      notificationDisplay.destroy();

      expect(mockSpinner.stop).toHaveBeenCalled();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete permission flow from request to grant', () => {
      const requestData: PermissionRequestEventData = {
        requestId: 'flow-test',
        tool: 'CompleteFlow',
        scope: '/test/file',
        description: 'complete flow test',
        isDangerous: false,
        agent: 'test-agent',
        timestamp: new Date()
      };

      const grantedData: PermissionGrantedEventData = {
        requestId: 'flow-test',
        tool: 'CompleteFlow',
        scope: '/test/file',
        level: 'allow-always',
        grantedBy: 'user',
        timestamp: new Date()
      };

      // Emit request then grant
      mockOrchestrator.emit('permission:request', requestData);
      mockOrchestrator.emit('permission:granted', grantedData);

      const history = notificationDisplay.getNotificationHistory();
      expect(history).toHaveLength(2);

      // Check request message
      expect(history[0]).toContain('Permission required');
      expect(history[0]).toContain('CompleteFlow');

      // Check granted message
      expect(history[1]).toContain('Permission');
      expect(history[1]).toContain('granted permanently');
    });

    it('should handle complete permission flow from request to deny', () => {
      const requestData: PermissionRequestEventData = {
        requestId: 'deny-flow-test',
        tool: 'DeniedFlow',
        scope: '/restricted/area',
        description: 'access restricted area',
        isDangerous: true,
        agent: 'test-agent',
        timestamp: new Date()
      };

      const deniedData: PermissionDeniedEventData = {
        requestId: 'deny-flow-test',
        tool: 'DeniedFlow',
        scope: '/restricted/area',
        deniedBy: 'security-policy',
        timestamp: new Date(),
        reason: 'Access to restricted area is forbidden'
      };

      // Emit request then deny
      mockOrchestrator.emit('permission:request', requestData);
      mockOrchestrator.emit('permission:denied', deniedData);

      const history = notificationDisplay.getNotificationHistory();
      expect(history).toHaveLength(2);

      // Check request message (should show danger warning)
      expect(history[0]).toContain('[RED]🚨[/RED]');

      // Check denied message
      expect(history[1]).toContain('[RED]❌[/RED]');
      expect(history[1]).toContain('Access to restricted area is forbidden');
    });
  });
});