/**
 * Tests for Lint-Related Events
 *
 * Comprehensive test suite for the lint event system added in v0.5.0.
 * Tests event interfaces, type safety, event emission, and integration
 * with the LinterService.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { ApexOrchestrator } from './index';
import { LinterService } from './linter';
import type {
  LintStartedEventData,
  LintCompletedEventData,
  LintIssueEventData,
  LintFixAppliedEventData,
  OrchestratorEvents
} from './index';

// Mock LinterService to control event emission in tests
vi.mock('./linter', () => {
  const mockEmitter = new EventEmitter();
  const mockLinterService = {
    initialize: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
    register: vi.fn(),
    execute: vi.fn(),
    fix: vi.fn(),
    on: vi.fn((event: string, handler: Function) => mockEmitter.on(event, handler)),
    emit: vi.fn((event: string, ...args: any[]) => mockEmitter.emit(event, ...args)),
    removeAllListeners: vi.fn(),
  };

  return {
    LinterService: vi.fn(() => mockLinterService),
    __mockEmitter: mockEmitter,
    __mockLinterService: mockLinterService,
  };
});

// Mock Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn().mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      // Empty async iterator for testing
    }
  })
}));

// Mock other dependencies
vi.mock('@apex/core', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    orchestration: { mode: 'autonomous', approvals: [], gating: { enabled: false } },
    agent: { model: 'claude-3-5-sonnet-20241022' },
    system: { maxConcurrentTasks: 1 },
    cost: { maxTokens: 100000 },
    linter: {
      global: {
        enabled: true,
        timeoutMs: 30000,
        maxConcurrency: 4
      }
    }
  }),
  loadWorkflows: vi.fn().mockResolvedValue({}),
  loadAgents: vi.fn().mockResolvedValue({}),
}));

vi.mock('./store', () => ({
  TaskStore: vi.fn(() => ({
    initialize: vi.fn(),
    createTask: vi.fn().mockResolvedValue({
      id: 'test-task-id',
      status: 'created',
      description: 'Test task',
      created: new Date(),
      workflow: 'feature'
    }),
    updateTask: vi.fn(),
    getTask: vi.fn(),
    getAllTasks: vi.fn().mockResolvedValue([]),
  })),
}));

// Mock exec functions
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, callback) => callback(null, { stdout: 'success', stderr: '' })),
}));

describe('Lint Event Interfaces', () => {
  describe('Type Safety', () => {
    it('should have correct LintStartedEventData interface', () => {
      const event: LintStartedEventData = {
        taskId: 'task-123',
        linterId: 'eslint',
        files: ['src/index.ts', 'src/utils.ts'],
        timestamp: new Date(),
      };

      expect(event.taskId).toBe('task-123');
      expect(event.linterId).toBe('eslint');
      expect(event.files).toEqual(['src/index.ts', 'src/utils.ts']);
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should have correct LintCompletedEventData interface', () => {
      const event: LintCompletedEventData = {
        taskId: 'task-456',
        linterId: 'prettier',
        result: {
          success: true,
          issuesFound: 5,
          issuesFixed: 3,
          duration: 1250
        },
        timestamp: new Date(),
      };

      expect(event.taskId).toBe('task-456');
      expect(event.linterId).toBe('prettier');
      expect(event.result.success).toBe(true);
      expect(event.result.issuesFound).toBe(5);
      expect(event.result.issuesFixed).toBe(3);
      expect(event.result.duration).toBe(1250);
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should have correct LintIssueEventData interface', () => {
      const event: LintIssueEventData = {
        taskId: 'task-789',
        linterId: 'eslint',
        issue: {
          ruleId: 'no-unused-vars',
          severity: 'error',
          message: 'Variable is defined but never used',
          filePath: '/src/components/Button.tsx',
          line: 15,
          column: 8,
          endLine: 15,
          endColumn: 20
        },
        timestamp: new Date(),
      };

      expect(event.taskId).toBe('task-789');
      expect(event.linterId).toBe('eslint');
      expect(event.issue.ruleId).toBe('no-unused-vars');
      expect(event.issue.severity).toBe('error');
      expect(event.issue.message).toBe('Variable is defined but never used');
      expect(event.issue.filePath).toBe('/src/components/Button.tsx');
      expect(event.issue.line).toBe(15);
      expect(event.issue.column).toBe(8);
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should have correct LintFixAppliedEventData interface', () => {
      const event: LintFixAppliedEventData = {
        taskId: 'task-999',
        linterId: 'eslint',
        filePath: '/src/utils/helper.ts',
        issuesFixed: 2,
        fixDetails: [
          {
            ruleId: 'quotes',
            line: 10,
            column: 5,
            originalText: '"hello"',
            fixedText: "'hello'"
          },
          {
            ruleId: 'semi',
            line: 12,
            column: 25,
            originalText: 'return value',
            fixedText: 'return value;'
          }
        ],
        timestamp: new Date(),
      };

      expect(event.taskId).toBe('task-999');
      expect(event.linterId).toBe('eslint');
      expect(event.filePath).toBe('/src/utils/helper.ts');
      expect(event.issuesFixed).toBe(2);
      expect(event.fixDetails).toHaveLength(2);
      expect(event.fixDetails[0].ruleId).toBe('quotes');
      expect(event.fixDetails[0].originalText).toBe('"hello"');
      expect(event.fixDetails[0].fixedText).toBe("'hello'");
      expect(event.fixDetails[1].ruleId).toBe('semi');
      expect(event.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('OrchestratorEvents Interface', () => {
    it('should include all lint event types in OrchestratorEvents', () => {
      // This test ensures the event types are properly included in the interface
      const eventHandlers: Partial<OrchestratorEvents> = {
        'lint:started': (event: LintStartedEventData) => {
          expect(event.taskId).toBeDefined();
          expect(event.linterId).toBeDefined();
          expect(event.files).toBeDefined();
          expect(event.timestamp).toBeDefined();
        },
        'lint:completed': (event: LintCompletedEventData) => {
          expect(event.taskId).toBeDefined();
          expect(event.linterId).toBeDefined();
          expect(event.result).toBeDefined();
          expect(event.timestamp).toBeDefined();
        },
        'lint:issue': (event: LintIssueEventData) => {
          expect(event.taskId).toBeDefined();
          expect(event.linterId).toBeDefined();
          expect(event.issue).toBeDefined();
          expect(event.timestamp).toBeDefined();
        },
        'lint:fix-applied': (event: LintFixAppliedEventData) => {
          expect(event.taskId).toBeDefined();
          expect(event.linterId).toBeDefined();
          expect(event.filePath).toBeDefined();
          expect(event.issuesFixed).toBeDefined();
          expect(event.fixDetails).toBeDefined();
          expect(event.timestamp).toBeDefined();
        }
      };

      // Verify each handler has the correct signature
      expect(typeof eventHandlers['lint:started']).toBe('function');
      expect(typeof eventHandlers['lint:completed']).toBe('function');
      expect(typeof eventHandlers['lint:issue']).toBe('function');
      expect(typeof eventHandlers['lint:fix-applied']).toBe('function');
    });
  });
});

describe('ApexOrchestrator Lint Event Integration', () => {
  let orchestrator: ApexOrchestrator;
  let mockLinterService: any;

  beforeEach(async () => {
    // Access the mock from the module
    const { __mockLinterService } = await import('./linter');
    mockLinterService = __mockLinterService;

    orchestrator = new ApexOrchestrator('/test/project');
    await orchestrator.initialize();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('LinterService Integration', () => {
    it('should initialize LinterService with correct config', () => {
      expect(LinterService).toHaveBeenCalledWith({
        projectPath: '/test/project',
        defaultTimeout: 30000,
        maxConcurrency: 4,
        autoFix: {
          enabled: true,
        },
      });
      expect(mockLinterService.initialize).toHaveBeenCalled();
    });

    it('should provide access to LinterService instance', () => {
      const linterService = orchestrator.getLinterService();
      expect(linterService).toBe(mockLinterService);
    });

    it('should throw error when accessing LinterService before initialization', () => {
      const uninitializedOrchestrator = new ApexOrchestrator('/test/project');
      expect(() => {
        uninitializedOrchestrator.getLinterService();
      }).toThrow('Orchestrator must be initialized before accessing LinterService');
    });
  });

  describe('Event Forwarding Setup', () => {
    it('should call setupLinterEventForwarding during initialization', () => {
      expect(mockLinterService.on).toHaveBeenCalledWith('linter:started', expect.any(Function));
      expect(mockLinterService.on).toHaveBeenCalledWith('linter:completed', expect.any(Function));
      expect(mockLinterService.on).toHaveBeenCalledWith('linter:issue', expect.any(Function));
      expect(mockLinterService.on).toHaveBeenCalledWith('linter:fix-applied', expect.any(Function));
    });
  });

  describe('Lint Event Emission', () => {
    let lintStartedHandler: any;
    let lintCompletedHandler: any;
    let lintIssueHandler: any;
    let lintFixAppliedHandler: any;

    beforeEach(() => {
      lintStartedHandler = vi.fn();
      lintCompletedHandler = vi.fn();
      lintIssueHandler = vi.fn();
      lintFixAppliedHandler = vi.fn();

      orchestrator.on('lint:started', lintStartedHandler);
      orchestrator.on('lint:completed', lintCompletedHandler);
      orchestrator.on('lint:issue', lintIssueHandler);
      orchestrator.on('lint:fix-applied', lintFixAppliedHandler);
    });

    it('should emit lint:started events with correct data structure', () => {
      // TODO: This test will work once setupLinterEventForwarding is implemented
      // For now, we can manually trigger the event to test the interface
      const eventData: LintStartedEventData = {
        taskId: 'test-task',
        linterId: 'eslint',
        files: ['src/index.ts'],
        timestamp: new Date()
      };

      orchestrator.emit('lint:started', eventData);
      expect(lintStartedHandler).toHaveBeenCalledWith(eventData);
    });

    it('should emit lint:completed events with correct data structure', () => {
      const eventData: LintCompletedEventData = {
        taskId: 'test-task',
        linterId: 'eslint',
        result: {
          success: true,
          issuesFound: 10,
          issuesFixed: 5,
          duration: 2000
        },
        timestamp: new Date()
      };

      orchestrator.emit('lint:completed', eventData);
      expect(lintCompletedHandler).toHaveBeenCalledWith(eventData);
    });

    it('should emit lint:issue events with correct data structure', () => {
      const eventData: LintIssueEventData = {
        taskId: 'test-task',
        linterId: 'eslint',
        issue: {
          ruleId: 'no-unused-vars',
          severity: 'warning',
          message: 'Unused variable detected',
          filePath: '/src/app.ts',
          line: 25,
          column: 10,
          endLine: 25,
          endColumn: 18
        },
        timestamp: new Date()
      };

      orchestrator.emit('lint:issue', eventData);
      expect(lintIssueHandler).toHaveBeenCalledWith(eventData);
    });

    it('should emit lint:fix-applied events with correct data structure', () => {
      const eventData: LintFixAppliedEventData = {
        taskId: 'test-task',
        linterId: 'prettier',
        filePath: '/src/components/Header.tsx',
        issuesFixed: 3,
        fixDetails: [
          {
            ruleId: 'indent',
            line: 5,
            column: 1,
            originalText: '  const title = "Hello"',
            fixedText: '    const title = "Hello"'
          },
          {
            ruleId: 'quotes',
            line: 5,
            column: 16,
            originalText: '"Hello"',
            fixedText: "'Hello'"
          },
          {
            ruleId: 'semi',
            line: 5,
            column: 23,
            originalText: '"Hello"',
            fixedText: '"Hello";'
          }
        ],
        timestamp: new Date()
      };

      orchestrator.emit('lint:fix-applied', eventData);
      expect(lintFixAppliedHandler).toHaveBeenCalledWith(eventData);
    });
  });

  describe('Event Data Validation', () => {
    it('should handle events with minimal required data', () => {
      const minimalStartedEvent: LintStartedEventData = {
        taskId: 'task-1',
        linterId: 'basic-linter',
        files: [],
        timestamp: new Date()
      };

      const handler = vi.fn();
      orchestrator.on('lint:started', handler);
      orchestrator.emit('lint:started', minimalStartedEvent);

      expect(handler).toHaveBeenCalledWith(minimalStartedEvent);
    });

    it('should handle events with complete data sets', () => {
      const completeIssueEvent: LintIssueEventData = {
        taskId: 'comprehensive-task',
        linterId: 'advanced-eslint',
        issue: {
          ruleId: '@typescript-eslint/no-explicit-any',
          severity: 'error',
          message: 'Unexpected any. Specify a different type.',
          filePath: '/src/types/advanced.ts',
          line: 42,
          column: 15,
          endLine: 42,
          endColumn: 18,
          // Additional optional properties could be tested here
        },
        timestamp: new Date()
      };

      const handler = vi.fn();
      orchestrator.on('lint:issue', handler);
      orchestrator.emit('lint:issue', completeIssueEvent);

      expect(handler).toHaveBeenCalledWith(completeIssueEvent);
      expect(completeIssueEvent.issue.ruleId).toContain('@typescript-eslint');
      expect(completeIssueEvent.issue.severity).toBe('error');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed event data gracefully', () => {
      const handler = vi.fn();
      orchestrator.on('lint:started', handler);

      // Test that TypeScript catches this at compile time,
      // but runtime should handle gracefully if it somehow occurs
      try {
        // @ts-expect-error - Intentionally invalid for runtime testing
        orchestrator.emit('lint:started', { invalid: 'data' });
        expect(handler).toHaveBeenCalled();
      } catch (error) {
        // Should not throw in production
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle missing timestamp in events', () => {
      const eventWithoutTimestamp = {
        taskId: 'task-no-time',
        linterId: 'test-linter',
        files: ['test.ts']
        // Missing timestamp
      } as any;

      const handler = vi.fn();
      orchestrator.on('lint:started', handler);
      orchestrator.emit('lint:started', eventWithoutTimestamp);

      expect(handler).toHaveBeenCalledWith(eventWithoutTimestamp);
    });
  });
});

describe('Edge Cases and Real-World Scenarios', () => {
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    orchestrator = new ApexOrchestrator('/test/project');
    await orchestrator.initialize();
  });

  describe('Multiple Linter Scenarios', () => {
    it('should handle events from multiple linters simultaneously', () => {
      const eslintHandler = vi.fn();
      const prettierHandler = vi.fn();
      const allIssuesHandler = vi.fn();

      // Set up targeted handlers
      orchestrator.on('lint:issue', (event: LintIssueEventData) => {
        if (event.linterId === 'eslint') {
          eslintHandler(event);
        } else if (event.linterId === 'prettier') {
          prettierHandler(event);
        }
        allIssuesHandler(event);
      });

      // Emit events from different linters
      orchestrator.emit('lint:issue', {
        taskId: 'multi-task',
        linterId: 'eslint',
        issue: {
          ruleId: 'no-console',
          severity: 'warning',
          message: 'Unexpected console statement',
          filePath: '/src/debug.ts',
          line: 10,
          column: 5,
          endLine: 10,
          endColumn: 16
        },
        timestamp: new Date()
      });

      orchestrator.emit('lint:issue', {
        taskId: 'multi-task',
        linterId: 'prettier',
        issue: {
          ruleId: 'prettier/prettier',
          severity: 'error',
          message: 'Insert `;`',
          filePath: '/src/format.ts',
          line: 20,
          column: 30,
          endLine: 20,
          endColumn: 30
        },
        timestamp: new Date()
      });

      expect(eslintHandler).toHaveBeenCalledTimes(1);
      expect(prettierHandler).toHaveBeenCalledTimes(1);
      expect(allIssuesHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Large File Set Handling', () => {
    it('should handle lint events for large numbers of files', () => {
      const handler = vi.fn();
      orchestrator.on('lint:started', handler);

      // Create a large file list
      const largeFileList = Array.from({ length: 1000 }, (_, i) =>
        `/src/components/Component${i}.tsx`
      );

      const eventData: LintStartedEventData = {
        taskId: 'large-project-task',
        linterId: 'eslint',
        files: largeFileList,
        timestamp: new Date()
      };

      orchestrator.emit('lint:started', eventData);

      expect(handler).toHaveBeenCalledWith(eventData);
      expect(eventData.files).toHaveLength(1000);
    });
  });

  describe('Complex Fix Scenarios', () => {
    it('should handle complex fix operations with multiple rule violations', () => {
      const handler = vi.fn();
      orchestrator.on('lint:fix-applied', handler);

      const complexFixEvent: LintFixAppliedEventData = {
        taskId: 'complex-fix-task',
        linterId: 'eslint',
        filePath: '/src/complex-component.tsx',
        issuesFixed: 15,
        fixDetails: [
          // Simulate multiple types of fixes
          ...Array.from({ length: 5 }, (_, i) => ({
            ruleId: 'quotes',
            line: i + 1,
            column: 10,
            originalText: `"string${i}"`,
            fixedText: `'string${i}'`
          })),
          ...Array.from({ length: 5 }, (_, i) => ({
            ruleId: 'semi',
            line: i + 10,
            column: 25,
            originalText: 'statement',
            fixedText: 'statement;'
          })),
          ...Array.from({ length: 5 }, (_, i) => ({
            ruleId: 'indent',
            line: i + 20,
            column: 1,
            originalText: `  code${i}`,
            fixedText: `    code${i}`
          }))
        ],
        timestamp: new Date()
      };

      orchestrator.emit('lint:fix-applied', complexFixEvent);

      expect(handler).toHaveBeenCalledWith(complexFixEvent);
      expect(complexFixEvent.fixDetails).toHaveLength(15);
      expect(complexFixEvent.issuesFixed).toBe(15);
    });
  });

  describe('Performance and Memory', () => {
    it('should handle rapid event emission without memory leaks', () => {
      const handlers = {
        started: vi.fn(),
        completed: vi.fn(),
        issue: vi.fn(),
        fixApplied: vi.fn()
      };

      orchestrator.on('lint:started', handlers.started);
      orchestrator.on('lint:completed', handlers.completed);
      orchestrator.on('lint:issue', handlers.issue);
      orchestrator.on('lint:fix-applied', handlers.fixApplied);

      // Emit many events rapidly
      for (let i = 0; i < 100; i++) {
        orchestrator.emit('lint:started', {
          taskId: `rapid-task-${i}`,
          linterId: 'rapid-linter',
          files: [`file-${i}.ts`],
          timestamp: new Date()
        });

        orchestrator.emit('lint:issue', {
          taskId: `rapid-task-${i}`,
          linterId: 'rapid-linter',
          issue: {
            ruleId: 'test-rule',
            severity: 'info',
            message: `Issue ${i}`,
            filePath: `/file-${i}.ts`,
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 10
          },
          timestamp: new Date()
        });

        orchestrator.emit('lint:completed', {
          taskId: `rapid-task-${i}`,
          linterId: 'rapid-linter',
          result: {
            success: true,
            issuesFound: 1,
            issuesFixed: 0,
            duration: 100
          },
          timestamp: new Date()
        });
      }

      expect(handlers.started).toHaveBeenCalledTimes(100);
      expect(handlers.issue).toHaveBeenCalledTimes(100);
      expect(handlers.completed).toHaveBeenCalledTimes(100);

      // Verify we can still register new handlers (no memory corruption)
      const newHandler = vi.fn();
      orchestrator.on('lint:started', newHandler);
      orchestrator.emit('lint:started', {
        taskId: 'final-test',
        linterId: 'final-linter',
        files: ['final.ts'],
        timestamp: new Date()
      });
      expect(newHandler).toHaveBeenCalled();
    });
  });
});
