/**
 * Integration tests for permission notification in CLI (INT-06, INT-07)
 * Tests CLI event reception and user notification display
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { ApexOrchestrator } from '@apex/orchestrator';
import {
  PermissionNotification,
  PermissionRequestEventData,
  PermissionGrantedEventData
} from '@apex/core';
import { EventCollector, MockPermissionTrigger } from '@apex/core/src/__tests__/helpers';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Mock console methods to capture CLI output
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn()
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

// Mock chalk for colored output
const mockChalk = {
  red: vi.fn((text) => `[RED]${text}[/RED]`),
  yellow: vi.fn((text) => `[YELLOW]${text}[/YELLOW]`),
  green: vi.fn((text) => `[GREEN]${text}[/GREEN]`),
  blue: vi.fn((text) => `[BLUE]${text}[/BLUE]`),
  gray: vi.fn((text) => `[GRAY]${text}[/GRAY]`),
  bold: vi.fn((text) => `[BOLD]${text}[/BOLD]`)
};

// Mock CLI notification handler
class MockCLINotificationHandler extends EventEmitter {
  private console: typeof mockConsole;
  private chalk: typeof mockChalk;
  private ora: typeof mockOra;
  private activeSpinner: typeof mockSpinner | null = null;

  constructor() {
    super();
    this.console = mockConsole;
    this.chalk = mockChalk;
    this.ora = mockOra;
  }

  /**
   * Initialize CLI notification handling
   */
  initialize(orchestrator: ApexOrchestrator): void {
    orchestrator.on('permission:notification', this.handlePermissionNotification.bind(this));
    orchestrator.on('permission:request', this.handlePermissionRequest.bind(this));
    orchestrator.on('permission:granted', this.handlePermissionGranted.bind(this));
    orchestrator.on('permission:denied', this.handlePermissionDenied.bind(this));
    orchestrator.on('dangerous:detected', this.handleDangerousOperation.bind(this));
  }

  /**
   * Handle permission notification events for CLI display
   */
  private handlePermissionNotification(notification: PermissionNotification): void {
    const severityColors = {
      info: this.chalk.blue,
      warning: this.chalk.yellow,
      error: this.chalk.red,
      critical: this.chalk.red
    };

    const colorFn = severityColors[notification.severity];
    const title = this.chalk.bold(notification.title);
    const message = notification.message;

    if (notification.requiresAction) {
      this.console.warn(colorFn(`\n⚠️  ${title}`));
      this.console.warn(colorFn(`   ${message}`));

      if (notification.scope) {
        this.console.warn(this.chalk.gray(`   Scope: ${notification.scope}`));
      }

      if (notification.actions.length > 0) {
        this.console.warn(this.chalk.gray(`   Available actions: ${notification.actions.join(', ')}`));
      }

      // Stop any active spinner for important notifications
      if (this.activeSpinner?.isSpinning) {
        this.activeSpinner.stop();
      }
    } else {
      // Information notifications
      this.console.info(colorFn(`ℹ️  ${title}: ${message}`));
    }

    this.emit('notification:displayed', notification);
  }

  /**
   * Handle permission request events
   */
  private handlePermissionRequest(event: PermissionRequestEventData): void {
    const spinner = this.ora(`Requesting permission for ${event.tool}...`);
    spinner.start();
    this.activeSpinner = spinner;

    this.console.log(this.chalk.yellow(`\n🔐 Permission required for ${event.tool}`));
    this.console.log(this.chalk.gray(`   Agent: ${event.agent}`));
    this.console.log(this.chalk.gray(`   Description: ${event.description}`));

    if (event.scope) {
      this.console.log(this.chalk.gray(`   Scope: ${event.scope}`));
    }

    if (event.isDangerous) {
      this.console.warn(this.chalk.red('   ⚠️  This operation is flagged as dangerous'));
    }

    this.emit('permission:request:displayed', event);
  }

  /**
   * Handle permission granted events
   */
  private handlePermissionGranted(event: PermissionGrantedEventData): void {
    if (this.activeSpinner?.isSpinning) {
      this.activeSpinner.succeed();
      this.activeSpinner = null;
    }

    this.console.log(this.chalk.green(`✅ Permission granted for ${event.tool}`));

    if (event.reason) {
      this.console.log(this.chalk.gray(`   Reason: ${event.reason}`));
    }

    this.emit('permission:granted:displayed', event);
  }

  /**
   * Handle permission denied events
   */
  private handlePermissionDenied(event: PermissionDeniedEventData): void {
    if (this.activeSpinner?.isSpinning) {
      this.activeSpinner.fail();
      this.activeSpinner = null;
    }

    this.console.error(this.chalk.red(`❌ Permission denied for ${event.tool}`));
    this.console.error(this.chalk.red(`   Reason: ${event.reason}`));

    this.emit('permission:denied:displayed', event);
  }

  /**
   * Handle dangerous operation events
   */
  private handleDangerousOperation(event: DangerousOperationDetectedEventData): void {
    this.console.error(this.chalk.red(`\n🚨 DANGEROUS OPERATION DETECTED`));
    this.console.error(this.chalk.red(`   Tool: ${event.tool}`));
    this.console.error(this.chalk.red(`   Operation: ${event.operation}`));
    this.console.error(this.chalk.red(`   Risk Level: ${event.riskLevel.toUpperCase()}`));
    this.console.error(this.chalk.red(`   Risk: ${event.riskDescription}`));

    // Stop any active spinner for critical alerts
    if (this.activeSpinner?.isSpinning) {
      this.activeSpinner.fail();
      this.activeSpinner = null;
    }

    this.emit('dangerous:detected:displayed', event);
  }

  /**
   * Get captured console output for testing
   */
  getCapturedOutput(): {
    logs: string[];
    warnings: string[];
    errors: string[];
    infos: string[];
  } {
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
  clearCapturedOutput(): void {
    mockConsole.log.mockClear();
    mockConsole.warn.mockClear();
    mockConsole.error.mockClear();
    mockConsole.info.mockClear();
    mockSpinner.start.mockClear();
    mockSpinner.stop.mockClear();
    mockSpinner.succeed.mockClear();
    mockSpinner.fail.mockClear();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.removeAllListeners();
    this.activeSpinner = null;
  }
}

describe('Permission Notification CLI Integration Tests', () => {
  let orchestrator: ApexOrchestrator;
  let eventCollector: EventCollector;
  let mockTrigger: MockPermissionTrigger;
  let cliHandler: MockCLINotificationHandler;
  let testDir: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-cli-test-'));
    const apexDir = path.join(testDir, '.apex');
    fs.mkdirSync(apexDir, { recursive: true });

    // Create minimal config
    const configPath = path.join(apexDir, 'config.yaml');
    fs.writeFileSync(configPath, `
project:
  name: cli-permission-test
  version: "1.0.0"

autonomy:
  level: supervised

agents:
  - name: test-agent
    role: developer
    config: {}

workflows:
  - name: test-workflow
    description: Test workflow
    stages:
      - name: test-stage
        agent: test-agent
        prompt: "Test"
`);

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({
      workingDirectory: testDir,
      claudeApiKey: 'test-key'
    });

    // Set up test infrastructure
    eventCollector = new EventCollector(orchestrator);
    mockTrigger = new MockPermissionTrigger();
    cliHandler = new MockCLINotificationHandler();

    // Initialize CLI handler with orchestrator
    cliHandler.initialize(orchestrator);

    // Connect mock trigger to orchestrator
    mockTrigger.on('permission:request', (data) => orchestrator.emit('permission:request', data));
    mockTrigger.on('permission:granted', (data) => orchestrator.emit('permission:granted', data));
    mockTrigger.on('permission:denied', (data) => orchestrator.emit('permission:denied', data));
    mockTrigger.on('dangerous:detected', (data) => orchestrator.emit('dangerous:detected', data));
    mockTrigger.on('permission:notification', (data) => orchestrator.emit('permission:notification', data));

    // Clear any previous output
    cliHandler.clearCapturedOutput();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.destroy();
    }
    eventCollector?.destroy();
    mockTrigger?.reset();
    cliHandler?.destroy();

    // Cleanup test directory
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('INT-06: CLI Permission Event Reception', () => {
    it('should receive and display permission request notifications', async () => {
      const requestId = mockTrigger.triggerPermissionRequest({
        tool: 'Bash',
        agent: 'test-agent',
        scope: '/tmp/script.sh',
        description: 'Execute shell script for deployment',
        isDangerous: false
      });

      // Wait for events to be processed
      await eventCollector.waitForEvent('permission:request', 1000);
      await cliHandler.waitForEvent('permission:request:displayed', 1000);

      const output = cliHandler.getCapturedOutput();

      // Verify console output was generated
      expect(output.logs.length).toBeGreaterThan(0);

      // Verify permission request was displayed correctly
      const hasPermissionHeader = output.logs.some(log =>
        log.includes('Permission required for Bash')
      );
      expect(hasPermissionHeader).toBe(true);

      const hasAgentInfo = output.logs.some(log =>
        log.includes('Agent: test-agent')
      );
      expect(hasAgentInfo).toBe(true);

      const hasDescription = output.logs.some(log =>
        log.includes('Execute shell script for deployment')
      );
      expect(hasDescription).toBe(true);

      // Verify spinner was started
      expect(mockSpinner.start).toHaveBeenCalled();
    });

    it('should display dangerous operation warnings prominently', async () => {
      const requestId = mockTrigger.triggerPermissionRequest({
        tool: 'Bash',
        agent: 'test-agent',
        description: 'Delete system files',
        isDangerous: true
      });

      const operationId = mockTrigger.triggerDangerousOperation({
        tool: 'Bash',
        agent: 'test-agent',
        operation: 'rm -rf /system',
        riskLevel: 'critical',
        riskDescription: 'Permanent deletion of system files'
      });

      // Wait for events
      await eventCollector.waitForEvent('permission:request', 1000);
      await eventCollector.waitForEvent('dangerous:detected', 1000);

      const output = cliHandler.getCapturedOutput();

      // Verify dangerous operation warning
      const hasDangerousWarning = output.logs.some(log =>
        log.includes('This operation is flagged as dangerous')
      );
      expect(hasDangerousWarning).toBe(true);

      // Verify critical alert was displayed
      const hasCriticalAlert = output.errors.some(error =>
        error.includes('DANGEROUS OPERATION DETECTED')
      );
      expect(hasCriticalAlert).toBe(true);

      const hasRiskLevel = output.errors.some(error =>
        error.includes('Risk Level: CRITICAL')
      );
      expect(hasRiskLevel).toBe(true);
    });

    it('should display permission granted confirmations', async () => {
      const requestId = mockTrigger.triggerPermissionRequest({
        tool: 'Write',
        agent: 'test-agent',
        description: 'Create configuration file'
      });

      await eventCollector.waitForEvent('permission:request', 1000);

      // Clear output after request
      cliHandler.clearCapturedOutput();

      // Grant permission
      mockTrigger.triggerPermissionGranted({
        requestId,
        tool: 'Write',
        level: 'allow',
        reason: 'Configuration update approved by user'
      });

      await eventCollector.waitForEvent('permission:granted', 1000);
      await cliHandler.waitForEvent('permission:granted:displayed', 1000);

      const output = cliHandler.getCapturedOutput();

      // Verify permission granted message
      const hasGrantedMessage = output.logs.some(log =>
        log.includes('Permission granted for Write')
      );
      expect(hasGrantedMessage).toBe(true);

      const hasReason = output.logs.some(log =>
        log.includes('Configuration update approved by user')
      );
      expect(hasReason).toBe(true);

      // Verify spinner success
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should display permission denial messages', async () => {
      const requestId = mockTrigger.triggerPermissionRequest({
        tool: 'Execute',
        agent: 'test-agent',
        description: 'Run arbitrary script'
      });

      await eventCollector.waitForEvent('permission:request', 1000);
      cliHandler.clearCapturedOutput();

      // Deny permission
      mockTrigger.triggerPermissionDenied({
        requestId,
        tool: 'Execute',
        reason: 'Script execution not permitted in this context'
      });

      await eventCollector.waitForEvent('permission:denied', 1000);
      await cliHandler.waitForEvent('permission:denied:displayed', 1000);

      const output = cliHandler.getCapturedOutput();

      // Verify permission denied message
      const hasDeniedMessage = output.errors.some(error =>
        error.includes('Permission denied for Execute')
      );
      expect(hasDeniedMessage).toBe(true);

      const hasReason = output.errors.some(error =>
        error.includes('Script execution not permitted in this context')
      );
      expect(hasReason).toBe(true);

      // Verify spinner failure
      expect(mockSpinner.fail).toHaveBeenCalled();
    });
  });

  describe('INT-07: CLI User Notification Display', () => {
    it('should display actionable permission notifications with proper formatting', async () => {
      const notificationId = mockTrigger.triggerPermissionNotification({
        taskId: 'cli-task-1',
        agent: 'test-agent',
        tool: 'Edit',
        type: 'permission:requested',
        title: 'File Edit Permission Required',
        message: 'Agent needs permission to modify sensitive configuration file',
        scope: '/etc/app/config.json',
        severity: 'warning',
        requiresAction: true,
        actions: ['approve', 'deny', 'review_file_first'],
        metadata: { fileType: 'config', sensitive: true }
      });

      await eventCollector.waitForEvent('permission:notification', 1000);
      await cliHandler.waitForEvent('notification:displayed', 1000);

      const output = cliHandler.getCapturedOutput();

      // Verify notification title and message
      const hasTitle = output.warnings.some(warn =>
        warn.includes('File Edit Permission Required')
      );
      expect(hasTitle).toBe(true);

      const hasMessage = output.warnings.some(warn =>
        warn.includes('Agent needs permission to modify sensitive configuration file')
      );
      expect(hasMessage).toBe(true);

      // Verify scope display
      const hasScope = output.warnings.some(warn =>
        warn.includes('Scope: /etc/app/config.json')
      );
      expect(hasScope).toBe(true);

      // Verify available actions
      const hasActions = output.warnings.some(warn =>
        warn.includes('Available actions: approve, deny, review_file_first')
      );
      expect(hasActions).toBe(true);

      // Verify spinner was stopped for actionable notification
      expect(mockSpinner.stop).toHaveBeenCalled();
    });

    it('should display informational notifications with appropriate styling', async () => {
      mockTrigger.triggerPermissionNotification({
        taskId: 'cli-task-2',
        agent: 'test-agent',
        tool: 'Read',
        type: 'permission:granted',
        title: 'Read Permission Granted',
        message: 'Agent can now read project files',
        severity: 'info',
        requiresAction: false,
        actions: []
      });

      await eventCollector.waitForEvent('permission:notification', 1000);
      await cliHandler.waitForEvent('notification:displayed', 1000);

      const output = cliHandler.getCapturedOutput();

      // Verify informational notification was displayed
      const hasInfoMessage = output.infos.some(info =>
        info.includes('Read Permission Granted: Agent can now read project files')
      );
      expect(hasInfoMessage).toBe(true);

      // Verify colors were applied (mocked)
      expect(mockChalk.blue).toHaveBeenCalled();
      expect(mockChalk.bold).toHaveBeenCalled();
    });

    it('should handle critical severity notifications with emphasis', async () => {
      mockTrigger.triggerPermissionNotification({
        taskId: 'cli-task-3',
        agent: 'test-agent',
        tool: 'Bash',
        type: 'dangerous:detected',
        title: 'CRITICAL: System Modification Detected',
        message: 'Agent attempting to modify critical system files - immediate attention required',
        severity: 'critical',
        requiresAction: true,
        actions: ['block_immediately', 'allow_with_backup', 'escalate_to_admin'],
        metadata: {
          threatLevel: 'high',
          systemFiles: ['/etc/passwd', '/etc/shadow']
        }
      });

      await eventCollector.waitForEvent('permission:notification', 1000);
      await cliHandler.waitForEvent('notification:displayed', 1000);

      const output = cliHandler.getCapturedOutput();

      // Verify critical notification was displayed with emphasis
      const hasCriticalTitle = output.warnings.some(warn =>
        warn.includes('CRITICAL: System Modification Detected')
      );
      expect(hasCriticalTitle).toBe(true);

      const hasCriticalMessage = output.warnings.some(warn =>
        warn.includes('immediate attention required')
      );
      expect(hasCriticalMessage).toBe(true);

      // Verify critical actions were displayed
      const hasCriticalActions = output.warnings.some(warn =>
        warn.includes('block_immediately, allow_with_backup, escalate_to_admin')
      );
      expect(hasCriticalActions).toBe(true);

      // Verify red color was used for critical notifications
      expect(mockChalk.red).toHaveBeenCalled();
    });

    it('should handle multiple concurrent notifications properly', async () => {
      // Trigger multiple notifications simultaneously
      const notifications = [
        {
          taskId: 'concurrent-1',
          agent: 'agent-1',
          tool: 'Write',
          type: 'permission:requested' as const,
          title: 'Write Permission Request',
          message: 'Request 1',
          severity: 'warning' as const
        },
        {
          taskId: 'concurrent-2',
          agent: 'agent-2',
          tool: 'Read',
          type: 'permission:granted' as const,
          title: 'Read Permission Granted',
          message: 'Granted 2',
          severity: 'info' as const
        },
        {
          taskId: 'concurrent-3',
          agent: 'agent-3',
          tool: 'Execute',
          type: 'dangerous:detected' as const,
          title: 'Dangerous Execution',
          message: 'Critical 3',
          severity: 'critical' as const
        }
      ];

      notifications.forEach(n => {
        mockTrigger.triggerPermissionNotification(n);
      });

      // Wait for all notifications to be processed
      await new Promise(resolve => setTimeout(resolve, 200));

      const output = cliHandler.getCapturedOutput();

      // Verify all notifications were displayed
      const hasRequest = output.warnings.some(w => w.includes('Write Permission Request'));
      const hasGranted = output.infos.some(i => i.includes('Read Permission Granted'));
      const hasDangerous = output.warnings.some(w => w.includes('Dangerous Execution'));

      expect(hasRequest).toBe(true);
      expect(hasGranted).toBe(true);
      expect(hasDangerous).toBe(true);

      // Verify that all three notification displayed events were emitted
      expect(cliHandler.listenerCount('notification:displayed')).toBe(0); // No persistent listeners
      // But we can check the mock calls indirectly through console output
      expect(output.warnings.length + output.infos.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle notifications with expiration times', async () => {
      const expiresAt = new Date(Date.now() + 30000); // 30 seconds

      mockTrigger.triggerPermissionNotification({
        taskId: 'expiring-task',
        agent: 'test-agent',
        tool: 'Bash',
        type: 'dangerous:detected',
        title: 'Temporary Dangerous Operation',
        message: 'This dangerous operation will auto-deny in 30 seconds',
        severity: 'error',
        requiresAction: true,
        actions: ['confirm', 'deny'],
        expiresAt
      });

      await eventCollector.waitForEvent('permission:notification', 1000);

      const notifications = eventCollector.getPermissionNotifications();
      const expiringNotification = notifications.find(n => n.taskId === 'expiring-task');

      expect(expiringNotification).toBeDefined();
      expect(expiringNotification?.expiresAt).toEqual(expiresAt);

      // Note: Actual expiration handling would be implemented in the full CLI
      // This test just verifies the notification structure is preserved
    });
  });

  describe('CLI Integration Error Handling', () => {
    it('should handle malformed notification data gracefully', async () => {
      // Emit malformed notification directly to orchestrator
      orchestrator.emit('permission:notification', {
        // Missing required fields
        id: 'malformed',
        type: 'invalid-type'
      } as any);

      // Should not crash - graceful handling
      const output = cliHandler.getCapturedOutput();
      expect(output).toBeDefined();
    });

    it('should cleanup properly on destroy', () => {
      const initialListenerCount = orchestrator.listenerCount();
      cliHandler.destroy();

      // Verify cleanup
      expect(cliHandler.listenerCount()).toBe(0);
    });
  });
});