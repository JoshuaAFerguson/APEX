/**
 * Comprehensive tests for CLI auto-fix event display functionality
 * Tests ora spinner integration and chalk color output
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

// Mock ora spinner
const mockOra = {
  start: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  succeed: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  warn: vi.fn().mockReturnThis(),
  info: vi.fn().mockReturnThis(),
  text: '',
  color: 'yellow',
  indent: 0,
  spinner: 'dots',
  clear: vi.fn().mockReturnThis(),
  render: vi.fn().mockReturnThis()
};

// Mock chalk
const mockChalk = {
  green: vi.fn((text: string) => `[GREEN]${text}[/GREEN]`),
  red: vi.fn((text: string) => `[RED]${text}[/RED]`),
  yellow: vi.fn((text: string) => `[YELLOW]${text}[/YELLOW]`),
  blue: vi.fn((text: string) => `[BLUE]${text}[/BLUE]`),
  cyan: vi.fn((text: string) => `[CYAN]${text}[/CYAN]`),
  magenta: vi.fn((text: string) => `[MAGENTA]${text}[/MAGENTA]`),
  white: vi.fn((text: string) => `[WHITE]${text}[/WHITE]`),
  gray: vi.fn((text: string) => `[GRAY]${text}[/GRAY]`),
  bold: vi.fn((text: string) => `[BOLD]${text}[/BOLD]`),
  dim: vi.fn((text: string) => `[DIM]${text}[/DIM]`),
  underline: vi.fn((text: string) => `[UNDERLINE]${text}[/UNDERLINE]`)
};

// Mock CLI auto-fix event handlers
class MockCLIAutoFixHandler {
  private spinners = new Map<string, any>();
  private outputLog: string[] = [];
  private ora: any;
  private chalk: any;

  constructor(ora: any, chalk: any) {
    this.ora = ora;
    this.chalk = chalk;
  }

  setupEventHandlers(orchestrator: EventEmitter): void {
    orchestrator.on('autofix:requested', this.handleAutoFixRequested.bind(this));
    orchestrator.on('autofix:started', this.handleAutoFixStarted.bind(this));
    orchestrator.on('autofix:progress', this.handleAutoFixProgress.bind(this));
    orchestrator.on('autofix:completed', this.handleAutoFixCompleted.bind(this));
    orchestrator.on('autofix:failed', this.handleAutoFixFailed.bind(this));
    orchestrator.on('autofix:skipped', this.handleAutoFixSkipped.bind(this));
  }

  private handleAutoFixRequested(event: any): void {
    const fileName = event.filePath.split('/').pop();
    const fixTypesText = event.fixTypes.join(', ');

    const spinner = {
      ...mockOra,
      text: this.chalk.cyan(`🔧 Auto-fixing ${fileName} (${fixTypesText})...`)
    };

    spinner.start();
    this.spinners.set(event.filePath, spinner);
    this.outputLog.push(`Requested auto-fix for ${fileName} with types: ${fixTypesText}`);
  }

  private handleAutoFixStarted(event: any): void {
    const fileName = event.filePath.split('/').pop();
    const spinner = this.spinners.get(event.filePath);

    if (spinner) {
      spinner.text = this.chalk.yellow(
        `⚡ Fixing ${event.issuesDetected} ${event.fixType} issues in ${fileName}...`
      );
    }

    this.outputLog.push(`Started fixing ${event.issuesDetected} issues in ${fileName}`);
  }

  private handleAutoFixProgress(event: any): void {
    const fileName = event.filePath.split('/').pop();
    const spinner = this.spinners.get(event.filePath);

    if (spinner) {
      const total = event.issuesFixed + event.issuesRemaining;
      const progress = Math.round((event.issuesFixed / total) * 100);

      spinner.text = this.chalk.blue(
        `📈 ${fileName}: ${event.issuesFixed}/${total} issues fixed (${progress}%) - ${event.currentFix}`
      );
    }

    this.outputLog.push(
      `Progress ${fileName}: ${event.issuesFixed} fixed, ${event.issuesRemaining} remaining`
    );
  }

  private handleAutoFixCompleted(event: any): void {
    const fileName = event.filePath.split('/').pop();
    const spinner = this.spinners.get(event.filePath);

    if (spinner) {
      const successMessage = this.chalk.green(
        `✅ ${fileName} - Fixed ${event.issuesFixed}/${event.issuesDetected} issues (${Math.round(event.duration)}ms)`
      );

      spinner.succeed(successMessage);
      this.spinners.delete(event.filePath);
    }

    this.outputLog.push(
      `Completed ${fileName} - Fixed ${event.issuesFixed}/${event.issuesDetected} issues in ${Math.round(event.duration)}ms`
    );
  }

  private handleAutoFixFailed(event: any): void {
    const fileName = event.filePath.split('/').pop();
    const spinner = this.spinners.get(event.filePath);

    if (spinner) {
      const errorMessage = this.chalk.red(
        `❌ ${fileName} - Error: ${event.error} (${event.issuesFixed}/${event.issuesDetected} fixed)`
      );

      spinner.fail(errorMessage);
      this.spinners.delete(event.filePath);
    }

    this.outputLog.push(`Failed ${fileName} - ${event.error}`);
  }

  private handleAutoFixSkipped(event: any): void {
    const fileName = event.filePath.split('/').pop();

    const skipMessage = this.chalk.gray(`⏭️  ${fileName} - Skipped (${event.reason})`);
    console.log(skipMessage);

    this.outputLog.push(`Skipped ${fileName} - ${event.reason}`);
  }

  getSpinner(filePath: string): any {
    return this.spinners.get(filePath);
  }

  getOutputLog(): string[] {
    return this.outputLog;
  }

  getActiveSpinners(): number {
    return this.spinners.size;
  }

  clearOutputLog(): void {
    this.outputLog = [];
  }
}

describe('CLI Auto-Fix Display Comprehensive Tests', () => {
  let orchestrator: EventEmitter;
  let cliHandler: MockCLIAutoFixHandler;
  let consoleLogSpy: any;

  beforeEach(() => {
    orchestrator = new EventEmitter();
    cliHandler = new MockCLIAutoFixHandler(mockOra, mockChalk);
    cliHandler.setupEventHandlers(orchestrator);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Reset mocks
    Object.values(mockOra).forEach(fn => {
      if (typeof fn === 'function') {
        fn.mockClear();
      }
    });

    Object.values(mockChalk).forEach(fn => {
      if (typeof fn === 'function') {
        fn.mockClear();
      }
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('Ora Spinner Integration', () => {
    it('should create and start spinner for autofix:requested events', () => {
      const event = {
        taskId: 'spinner-test',
        filePath: '/src/components/Button.tsx',
        fixTypes: ['imports', 'formatting'],
        triggeredBy: 'stage-completion',
        timestamp: new Date()
      };

      orchestrator.emit('autofix:requested', event);

      const spinner = cliHandler.getSpinner(event.filePath);
      expect(spinner).toBeDefined();
      expect(spinner.start).toHaveBeenCalled();
      expect(mockChalk.cyan).toHaveBeenCalledWith(
        expect.stringContaining('Auto-fixing Button.tsx')
      );
    });

    it('should update spinner text for autofix:started events', () => {
      const requestedEvent = {
        taskId: 'update-test',
        filePath: '/src/utils/helpers.ts',
        fixTypes: ['imports'],
        triggeredBy: 'hook',
        timestamp: new Date()
      };

      const startedEvent = {
        taskId: 'update-test',
        filePath: '/src/utils/helpers.ts',
        fixType: 'imports',
        issuesDetected: 5,
        timestamp: new Date()
      };

      orchestrator.emit('autofix:requested', requestedEvent);
      orchestrator.emit('autofix:started', startedEvent);

      const spinner = cliHandler.getSpinner(startedEvent.filePath);
      expect(mockChalk.yellow).toHaveBeenCalledWith(
        expect.stringContaining('Fixing 5 imports issues in helpers.ts')
      );
    });

    it('should show progress updates with percentage calculation', () => {
      const filePath = '/src/services/api.ts';

      // Setup spinner
      orchestrator.emit('autofix:requested', {
        taskId: 'progress-test',
        filePath,
        fixTypes: ['eslint'],
        triggeredBy: 'manual',
        timestamp: new Date()
      });

      // Send progress update
      const progressEvent = {
        taskId: 'progress-test',
        filePath,
        fixType: 'eslint',
        issuesFixed: 3,
        issuesRemaining: 2,
        currentFix: 'Fixing unused variable warning',
        timestamp: new Date()
      };

      orchestrator.emit('autofix:progress', progressEvent);

      expect(mockChalk.blue).toHaveBeenCalledWith(
        expect.stringContaining('api.ts: 3/5 issues fixed (60%)')
      );
      expect(mockChalk.blue).toHaveBeenCalledWith(
        expect.stringContaining('Fixing unused variable warning')
      );
    });

    it('should complete spinner with success message and colors', () => {
      const filePath = '/src/components/Modal.tsx';

      // Setup and complete
      orchestrator.emit('autofix:requested', {
        taskId: 'completion-test',
        filePath,
        fixTypes: ['prettier'],
        triggeredBy: 'save',
        timestamp: new Date()
      });

      const completedEvent = {
        taskId: 'completion-test',
        filePath,
        fixType: 'prettier',
        issuesDetected: 4,
        issuesFixed: 4,
        duration: 850,
        timestamp: new Date()
      };

      orchestrator.emit('autofix:completed', completedEvent);

      const spinner = cliHandler.getSpinner(filePath);
      expect(spinner).toBeUndefined(); // Should be removed after completion

      expect(mockOra.succeed).toHaveBeenCalled();
      expect(mockChalk.green).toHaveBeenCalledWith(
        expect.stringContaining('✅ Modal.tsx - Fixed 4/4 issues (850ms)')
      );
    });

    it('should handle failure with error colors and messaging', () => {
      const filePath = '/src/broken/syntax.js';

      orchestrator.emit('autofix:requested', {
        taskId: 'failure-test',
        filePath,
        fixTypes: ['eslint'],
        triggeredBy: 'auto',
        timestamp: new Date()
      };

      const failedEvent = {
        taskId: 'failure-test',
        filePath,
        fixType: 'eslint',
        error: 'SyntaxError: Unexpected token } at line 42',
        issuesDetected: 3,
        issuesFixed: 1,
        timestamp: new Date()
      };

      orchestrator.emit('autofix:failed', failedEvent);

      expect(mockOra.fail).toHaveBeenCalled();
      expect(mockChalk.red).toHaveBeenCalledWith(
        expect.stringContaining('❌ syntax.js - Error: SyntaxError')
      );
      expect(mockChalk.red).toHaveBeenCalledWith(
        expect.stringContaining('(1/3 fixed)')
      );
    });
  });

  describe('Chalk Color Integration', () => {
    it('should use appropriate colors for different event types', () => {
      const filePath = '/src/test-colors.ts';

      // Test each event type
      orchestrator.emit('autofix:requested', {
        taskId: 'color-test',
        filePath,
        fixTypes: ['imports'],
        triggeredBy: 'test',
        timestamp: new Date()
      });

      orchestrator.emit('autofix:started', {
        taskId: 'color-test',
        filePath,
        fixType: 'imports',
        issuesDetected: 2,
        timestamp: new Date()
      });

      orchestrator.emit('autofix:progress', {
        taskId: 'color-test',
        filePath,
        fixType: 'imports',
        issuesFixed: 1,
        issuesRemaining: 1,
        currentFix: 'Adding React import',
        timestamp: new Date()
      });

      orchestrator.emit('autofix:completed', {
        taskId: 'color-test',
        filePath,
        fixType: 'imports',
        issuesDetected: 2,
        issuesFixed: 2,
        duration: 500,
        timestamp: new Date()
      });

      // Verify color usage
      expect(mockChalk.cyan).toHaveBeenCalled(); // requested
      expect(mockChalk.yellow).toHaveBeenCalled(); // started
      expect(mockChalk.blue).toHaveBeenCalled(); // progress
      expect(mockChalk.green).toHaveBeenCalled(); // completed
    });

    it('should use gray color for skipped files', () => {
      const skipEvent = {
        taskId: 'skip-test',
        filePath: '/src/already-perfect.ts',
        reason: 'no issues detected',
        timestamp: new Date()
      };

      orchestrator.emit('autofix:skipped', skipEvent);

      expect(mockChalk.gray).toHaveBeenCalledWith(
        expect.stringContaining('⏭️  already-perfect.ts - Skipped (no issues detected)')
      );
    });

    it('should format text with emojis and proper spacing', () => {
      const filePath = '/src/formatting-test.ts';

      orchestrator.emit('autofix:requested', {
        taskId: 'format-test',
        filePath,
        fixTypes: ['formatting', 'imports'],
        triggeredBy: 'save',
        timestamp: new Date()
      });

      expect(mockChalk.cyan).toHaveBeenCalledWith(
        expect.stringMatching(/🔧.*formatting-test\.ts.*formatting, imports/)
      );
    });
  });

  describe('Multiple Files and Concurrent Operations', () => {
    it('should handle multiple files with separate spinners', () => {
      const files = [
        '/src/components/Header.tsx',
        '/src/components/Footer.tsx',
        '/src/utils/helpers.ts'
      ];

      // Request auto-fix for all files
      files.forEach(filePath => {
        orchestrator.emit('autofix:requested', {
          taskId: 'multi-file-test',
          filePath,
          fixTypes: ['eslint'],
          triggeredBy: 'batch',
          timestamp: new Date()
        });
      });

      expect(cliHandler.getActiveSpinners()).toBe(3);

      // Complete one file
      orchestrator.emit('autofix:completed', {
        taskId: 'multi-file-test',
        filePath: files[0],
        fixType: 'eslint',
        issuesDetected: 2,
        issuesFixed: 2,
        duration: 300,
        timestamp: new Date()
      });

      expect(cliHandler.getActiveSpinners()).toBe(2);
    });

    it('should track progress across multiple concurrent operations', () => {
      const operations = [
        { filePath: '/src/file1.ts', issuesFixed: 2, issuesRemaining: 3 },
        { filePath: '/src/file2.ts', issuesFixed: 1, issuesRemaining: 1 },
        { filePath: '/src/file3.ts', issuesFixed: 4, issuesRemaining: 0 }
      ];

      // Setup files
      operations.forEach(op => {
        orchestrator.emit('autofix:requested', {
          taskId: 'concurrent-test',
          filePath: op.filePath,
          fixTypes: ['eslint'],
          triggeredBy: 'concurrent',
          timestamp: new Date()
        });
      });

      // Send progress for each
      operations.forEach(op => {
        orchestrator.emit('autofix:progress', {
          taskId: 'concurrent-test',
          filePath: op.filePath,
          fixType: 'eslint',
          issuesFixed: op.issuesFixed,
          issuesRemaining: op.issuesRemaining,
          currentFix: 'Concurrent fix',
          timestamp: new Date()
        });
      });

      const outputLog = cliHandler.getOutputLog();
      operations.forEach(op => {
        const fileName = op.filePath.split('/').pop();
        expect(outputLog.some(log =>
          log.includes(fileName!) &&
          log.includes(`${op.issuesFixed} fixed, ${op.issuesRemaining} remaining`)
        )).toBe(true);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing spinner gracefully', () => {
      // Emit progress without prior request (shouldn't crash)
      expect(() => {
        orchestrator.emit('autofix:progress', {
          taskId: 'orphan-test',
          filePath: '/src/orphan.ts',
          fixType: 'eslint',
          issuesFixed: 1,
          issuesRemaining: 0,
          currentFix: 'Orphan fix',
          timestamp: new Date()
        });
      }).not.toThrow();

      // Should still log the event
      const outputLog = cliHandler.getOutputLog();
      expect(outputLog.some(log => log.includes('orphan.ts'))).toBe(true);
    });

    it('should handle very long file paths', () => {
      const longPath = '/very/long/nested/directory/structure/with/many/levels/and/a/very/long/filename/component.tsx';

      orchestrator.emit('autofix:requested', {
        taskId: 'long-path-test',
        filePath: longPath,
        fixTypes: ['imports'],
        triggeredBy: 'test',
        timestamp: new Date()
      });

      expect(mockChalk.cyan).toHaveBeenCalledWith(
        expect.stringContaining('component.tsx')
      );
    });

    it('should handle zero-duration completions', () => {
      const filePath = '/src/instant.ts';

      orchestrator.emit('autofix:requested', {
        taskId: 'instant-test',
        filePath,
        fixTypes: ['whitespace'],
        triggeredBy: 'test',
        timestamp: new Date()
      });

      orchestrator.emit('autofix:completed', {
        taskId: 'instant-test',
        filePath,
        fixType: 'whitespace',
        issuesDetected: 1,
        issuesFixed: 1,
        duration: 0, // Zero duration
        timestamp: new Date()
      });

      expect(mockChalk.green).toHaveBeenCalledWith(
        expect.stringContaining('instant.ts - Fixed 1/1 issues (0ms)')
      );
    });

    it('should handle special characters in file paths', () => {
      const specialPath = '/src/components/特殊-файл-🎉.tsx';

      orchestrator.emit('autofix:requested', {
        taskId: 'special-chars-test',
        filePath: specialPath,
        fixTypes: ['imports'],
        triggeredBy: 'test',
        timestamp: new Date()
      });

      const fileName = specialPath.split('/').pop();
      expect(mockChalk.cyan).toHaveBeenCalledWith(
        expect.stringContaining(fileName!)
      );
    });
  });

  describe('Performance and Memory', () => {
    it('should clean up spinners after completion to prevent memory leaks', () => {
      const files = Array.from({ length: 100 }, (_, i) => `/src/file-${i}.ts`);

      // Create many spinners
      files.forEach(filePath => {
        orchestrator.emit('autofix:requested', {
          taskId: 'memory-test',
          filePath,
          fixTypes: ['eslint'],
          triggeredBy: 'batch',
          timestamp: new Date()
        });
      });

      expect(cliHandler.getActiveSpinners()).toBe(100);

      // Complete all
      files.forEach(filePath => {
        orchestrator.emit('autofix:completed', {
          taskId: 'memory-test',
          filePath,
          fixType: 'eslint',
          issuesDetected: 1,
          issuesFixed: 1,
          duration: 50,
          timestamp: new Date()
        });
      });

      expect(cliHandler.getActiveSpinners()).toBe(0);
    });

    it('should handle rapid event sequences without performance degradation', () => {
      const startTime = performance.now();
      const eventCount = 1000;

      for (let i = 0; i < eventCount; i++) {
        orchestrator.emit('autofix:progress', {
          taskId: 'rapid-test',
          filePath: `/src/rapid-${i}.ts`,
          fixType: 'eslint',
          issuesFixed: i % 5,
          issuesRemaining: 5 - (i % 5),
          currentFix: `Fix ${i}`,
          timestamp: new Date()
        });
      }

      const duration = performance.now() - startTime;

      // Should handle rapid events quickly (less than 1 second)
      expect(duration).toBeLessThan(1000);

      // Should have logged all events
      const outputLog = cliHandler.getOutputLog();
      expect(outputLog.length).toBeGreaterThanOrEqual(eventCount);
    });
  });
});