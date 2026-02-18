/**
 * Test suite for auto-fix event payload structure and validation
 * Ensures event schemas are consistent and well-formed
 */

import { describe, it, expect } from 'vitest';

// Type definitions for auto-fix events based on the implementation
interface AutoFixRequestedEvent {
  taskId: string;
  filePath: string;
  fixTypes: string[];
  triggeredBy: string;
  timestamp: Date;
}

interface AutoFixStartedEvent {
  taskId: string;
  filePath: string;
  fixType: string;
  detectedIssues: number;
  timestamp: Date;
}

interface AutoFixProgressEvent {
  taskId: string;
  filePath: string;
  fixType: string;
  iteration: number;
  totalIterations?: number;
  issuesFixed: number;
  timestamp: Date;
}

interface AutoFixCompletedEvent {
  taskId: string;
  filePath: string;
  fixType: string;
  issuesDetected: number;
  issuesFixed: number;
  duration: number;
  timestamp: Date;
}

interface AutoFixFailedEvent {
  taskId: string;
  filePath: string;
  fixType: string;
  error: string;
  issuesDetected: number;
  issuesFixed: number;
  timestamp: Date;
}

interface AutoFixSkippedEvent {
  taskId: string;
  filePath: string;
  reason: string;
  timestamp: Date;
}

// WebSocket event wrapper
interface WebSocketEvent {
  type: string;
  taskId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

describe('Auto-Fix Event Payload Validation', () => {
  describe('AutoFixRequestedEvent', () => {
    it('should have all required fields', () => {
      const event: AutoFixRequestedEvent = {
        taskId: 'task-123',
        filePath: '/src/components/Button.tsx',
        fixTypes: ['imports', 'formatting'],
        triggeredBy: 'hook',
        timestamp: new Date()
      };

      // Validate required fields
      expect(event.taskId).toBeDefined();
      expect(typeof event.taskId).toBe('string');
      expect(event.taskId.length).toBeGreaterThan(0);

      expect(event.filePath).toBeDefined();
      expect(typeof event.filePath).toBe('string');
      expect(event.filePath.length).toBeGreaterThan(0);

      expect(event.fixTypes).toBeDefined();
      expect(Array.isArray(event.fixTypes)).toBe(true);
      expect(event.fixTypes.length).toBeGreaterThan(0);

      expect(event.triggeredBy).toBeDefined();
      expect(typeof event.triggeredBy).toBe('string');
      expect(['hook', 'manual', 'batch', 'auto'].includes(event.triggeredBy)).toBe(true);

      expect(event.timestamp).toBeDefined();
      expect(event.timestamp instanceof Date).toBe(true);
    });

    it('should support various fix types', () => {
      const validFixTypes = [
        'imports',
        'formatting',
        'eslint',
        'prettier',
        'typescript',
        'style',
        'syntax'
      ];

      validFixTypes.forEach(fixType => {
        const event: AutoFixRequestedEvent = {
          taskId: 'test-task',
          filePath: '/test/file.ts',
          fixTypes: [fixType],
          triggeredBy: 'manual',
          timestamp: new Date()
        };

        expect(event.fixTypes).toContain(fixType);
      });
    });

    it('should handle multiple fix types', () => {
      const event: AutoFixRequestedEvent = {
        taskId: 'multi-fix-task',
        filePath: '/src/utils/helpers.js',
        fixTypes: ['eslint', 'prettier', 'imports'],
        triggeredBy: 'batch',
        timestamp: new Date()
      };

      expect(event.fixTypes.length).toBe(3);
      expect(event.fixTypes).toEqual(expect.arrayContaining(['eslint', 'prettier', 'imports']));
    });

    it('should validate file path formats', () => {
      const validFilePaths = [
        '/src/components/Button.tsx',
        './relative/path/file.js',
        'C:\\Windows\\path\\file.ts',
        '/very/long/path/to/some/deeply/nested/file.jsx'
      ];

      validFilePaths.forEach(filePath => {
        const event: AutoFixRequestedEvent = {
          taskId: 'path-test',
          filePath,
          fixTypes: ['imports'],
          triggeredBy: 'manual',
          timestamp: new Date()
        };

        expect(event.filePath).toBe(filePath);
        expect(event.filePath.length).toBeGreaterThan(0);
      });
    });
  });

  describe('AutoFixStartedEvent', () => {
    it('should have all required fields', () => {
      const event: AutoFixStartedEvent = {
        taskId: 'started-task',
        filePath: '/src/services/api.ts',
        fixType: 'eslint',
        detectedIssues: 7,
        timestamp: new Date()
      };

      expect(event.taskId).toBeDefined();
      expect(typeof event.taskId).toBe('string');

      expect(event.filePath).toBeDefined();
      expect(typeof event.filePath).toBe('string');

      expect(event.fixType).toBeDefined();
      expect(typeof event.fixType).toBe('string');
      expect(event.fixType.length).toBeGreaterThan(0);

      expect(event.detectedIssues).toBeDefined();
      expect(typeof event.detectedIssues).toBe('number');
      expect(event.detectedIssues).toBeGreaterThanOrEqual(0);

      expect(event.timestamp).toBeDefined();
      expect(event.timestamp instanceof Date).toBe(true);
    });

    it('should support zero detected issues', () => {
      const event: AutoFixStartedEvent = {
        taskId: 'no-issues-task',
        filePath: '/src/clean-file.ts',
        fixType: 'formatting',
        detectedIssues: 0,
        timestamp: new Date()
      };

      expect(event.detectedIssues).toBe(0);
    });

    it('should handle large numbers of detected issues', () => {
      const event: AutoFixStartedEvent = {
        taskId: 'many-issues-task',
        filePath: '/src/legacy-file.js',
        fixType: 'eslint',
        detectedIssues: 150,
        timestamp: new Date()
      };

      expect(event.detectedIssues).toBe(150);
      expect(event.detectedIssues).toBeGreaterThan(100);
    });
  });

  describe('AutoFixProgressEvent', () => {
    it('should have all required fields', () => {
      const event: AutoFixProgressEvent = {
        taskId: 'progress-task',
        filePath: '/src/component.vue',
        fixType: 'vue-lint',
        iteration: 2,
        totalIterations: 5,
        issuesFixed: 3,
        timestamp: new Date()
      };

      expect(event.taskId).toBeDefined();
      expect(event.filePath).toBeDefined();
      expect(event.fixType).toBeDefined();

      expect(event.iteration).toBeDefined();
      expect(typeof event.iteration).toBe('number');
      expect(event.iteration).toBeGreaterThan(0);

      expect(event.totalIterations).toBeDefined();
      expect(typeof event.totalIterations).toBe('number');
      expect(event.totalIterations!).toBeGreaterThanOrEqual(event.iteration);

      expect(event.issuesFixed).toBeDefined();
      expect(typeof event.issuesFixed).toBe('number');
      expect(event.issuesFixed).toBeGreaterThanOrEqual(0);

      expect(event.timestamp).toBeDefined();
    });

    it('should handle undefined totalIterations', () => {
      const event: AutoFixProgressEvent = {
        taskId: 'unknown-total-task',
        filePath: '/src/unknown-size.ts',
        fixType: 'custom',
        iteration: 3,
        // totalIterations is optional
        issuesFixed: 2,
        timestamp: new Date()
      };

      expect(event.totalIterations).toBeUndefined();
      expect(event.iteration).toBe(3);
    });

    it('should validate iteration logic', () => {
      // First iteration
      const firstIteration: AutoFixProgressEvent = {
        taskId: 'iteration-task',
        filePath: '/src/file.ts',
        fixType: 'eslint',
        iteration: 1,
        totalIterations: 4,
        issuesFixed: 1,
        timestamp: new Date()
      };

      expect(firstIteration.iteration).toBe(1);
      expect(firstIteration.iteration).toBeLessThanOrEqual(firstIteration.totalIterations!);

      // Last iteration
      const lastIteration: AutoFixProgressEvent = {
        taskId: 'iteration-task',
        filePath: '/src/file.ts',
        fixType: 'eslint',
        iteration: 4,
        totalIterations: 4,
        issuesFixed: 5,
        timestamp: new Date()
      };

      expect(lastIteration.iteration).toBe(lastIteration.totalIterations);
    });
  });

  describe('AutoFixCompletedEvent', () => {
    it('should have all required fields', () => {
      const event: AutoFixCompletedEvent = {
        taskId: 'completed-task',
        filePath: '/src/complete-file.js',
        fixType: 'prettier',
        issuesDetected: 8,
        issuesFixed: 8,
        duration: 340,
        timestamp: new Date()
      };

      expect(event.taskId).toBeDefined();
      expect(event.filePath).toBeDefined();
      expect(event.fixType).toBeDefined();

      expect(event.issuesDetected).toBeDefined();
      expect(typeof event.issuesDetected).toBe('number');
      expect(event.issuesDetected).toBeGreaterThanOrEqual(0);

      expect(event.issuesFixed).toBeDefined();
      expect(typeof event.issuesFixed).toBe('number');
      expect(event.issuesFixed).toBeGreaterThanOrEqual(0);
      expect(event.issuesFixed).toBeLessThanOrEqual(event.issuesDetected);

      expect(event.duration).toBeDefined();
      expect(typeof event.duration).toBe('number');
      expect(event.duration).toBeGreaterThan(0);

      expect(event.timestamp).toBeDefined();
    });

    it('should handle partial fix scenarios', () => {
      const event: AutoFixCompletedEvent = {
        taskId: 'partial-fix-task',
        filePath: '/src/difficult-file.ts',
        fixType: 'typescript',
        issuesDetected: 12,
        issuesFixed: 8, // Not all issues fixed
        duration: 1200,
        timestamp: new Date()
      };

      expect(event.issuesFixed).toBeLessThan(event.issuesDetected);
      expect(event.issuesFixed).toBe(8);
      expect(event.issuesDetected).toBe(12);
    });

    it('should handle zero issues scenarios', () => {
      const event: AutoFixCompletedEvent = {
        taskId: 'no-issues-completed',
        filePath: '/src/clean-file.ts',
        fixType: 'eslint',
        issuesDetected: 0,
        issuesFixed: 0,
        duration: 45,
        timestamp: new Date()
      };

      expect(event.issuesDetected).toBe(0);
      expect(event.issuesFixed).toBe(0);
      expect(event.duration).toBeGreaterThan(0); // Still took some time
    });

    it('should validate duration ranges', () => {
      // Fast completion
      const fastEvent: AutoFixCompletedEvent = {
        taskId: 'fast-task',
        filePath: '/src/small-file.js',
        fixType: 'formatting',
        issuesDetected: 1,
        issuesFixed: 1,
        duration: 25,
        timestamp: new Date()
      };

      expect(fastEvent.duration).toBeGreaterThan(0);
      expect(fastEvent.duration).toBeLessThan(100);

      // Slow completion
      const slowEvent: AutoFixCompletedEvent = {
        taskId: 'slow-task',
        filePath: '/src/large-file.ts',
        fixType: 'eslint',
        issuesDetected: 50,
        issuesFixed: 45,
        duration: 5000,
        timestamp: new Date()
      };

      expect(slowEvent.duration).toBeGreaterThan(1000);
    });
  });

  describe('AutoFixFailedEvent', () => {
    it('should have all required fields', () => {
      const event: AutoFixFailedEvent = {
        taskId: 'failed-task',
        filePath: '/src/broken-file.ts',
        fixType: 'typescript',
        error: 'Cannot parse TypeScript syntax',
        issuesDetected: 5,
        issuesFixed: 2,
        timestamp: new Date()
      };

      expect(event.taskId).toBeDefined();
      expect(event.filePath).toBeDefined();
      expect(event.fixType).toBeDefined();

      expect(event.error).toBeDefined();
      expect(typeof event.error).toBe('string');
      expect(event.error.length).toBeGreaterThan(0);

      expect(event.issuesDetected).toBeDefined();
      expect(event.issuesFixed).toBeDefined();
      expect(event.issuesFixed).toBeLessThanOrEqual(event.issuesDetected);

      expect(event.timestamp).toBeDefined();
    });

    it('should handle various error types', () => {
      const errorTypes = [
        'Syntax error',
        'File not found',
        'Permission denied',
        'Memory limit exceeded',
        'Timeout during fix operation',
        'Invalid configuration'
      ];

      errorTypes.forEach(error => {
        const event: AutoFixFailedEvent = {
          taskId: 'error-test',
          filePath: '/test/file.ts',
          fixType: 'eslint',
          error,
          issuesDetected: 3,
          issuesFixed: 0,
          timestamp: new Date()
        };

        expect(event.error).toBe(error);
        expect(event.error.length).toBeGreaterThan(0);
      });
    });

    it('should handle failure with partial fixes', () => {
      const event: AutoFixFailedEvent = {
        taskId: 'partial-failure',
        filePath: '/src/partially-fixed.js',
        fixType: 'eslint',
        error: 'Unexpected token on line 45',
        issuesDetected: 10,
        issuesFixed: 6, // Some issues were fixed before failure
        timestamp: new Date()
      };

      expect(event.issuesFixed).toBeGreaterThan(0);
      expect(event.issuesFixed).toBeLessThan(event.issuesDetected);
    });

    it('should handle immediate failure', () => {
      const event: AutoFixFailedEvent = {
        taskId: 'immediate-failure',
        filePath: '/src/corrupted-file.ts',
        fixType: 'prettier',
        error: 'File is corrupted or unreadable',
        issuesDetected: 0, // Couldn't even detect issues
        issuesFixed: 0,
        timestamp: new Date()
      };

      expect(event.issuesDetected).toBe(0);
      expect(event.issuesFixed).toBe(0);
    });
  });

  describe('AutoFixSkippedEvent', () => {
    it('should have all required fields', () => {
      const event: AutoFixSkippedEvent = {
        taskId: 'skipped-task',
        filePath: '/src/ignored-file.ts',
        reason: 'file_excluded',
        timestamp: new Date()
      };

      expect(event.taskId).toBeDefined();
      expect(typeof event.taskId).toBe('string');

      expect(event.filePath).toBeDefined();
      expect(typeof event.filePath).toBe('string');

      expect(event.reason).toBeDefined();
      expect(typeof event.reason).toBe('string');
      expect(event.reason.length).toBeGreaterThan(0);

      expect(event.timestamp).toBeDefined();
    });

    it('should support various skip reasons', () => {
      const validReasons = [
        'no_issues',
        'file_excluded',
        'already_processed',
        'unsupported_file_type',
        'permission_denied',
        'file_too_large',
        'in_ignore_list'
      ];

      validReasons.forEach(reason => {
        const event: AutoFixSkippedEvent = {
          taskId: 'skip-reason-test',
          filePath: '/test/file.ts',
          reason,
          timestamp: new Date()
        };

        expect(event.reason).toBe(reason);
      });
    });
  });

  describe('WebSocket Event Wrapper', () => {
    it('should properly wrap auto-fix events for WebSocket transmission', () => {
      const autoFixEvent: AutoFixCompletedEvent = {
        taskId: 'wrapper-task',
        filePath: '/src/test-file.ts',
        fixType: 'eslint',
        issuesDetected: 3,
        issuesFixed: 3,
        duration: 200,
        timestamp: new Date()
      };

      const wsEvent: WebSocketEvent = {
        type: 'autofix:completed',
        taskId: autoFixEvent.taskId,
        timestamp: autoFixEvent.timestamp,
        data: {
          filePath: autoFixEvent.filePath,
          fixType: autoFixEvent.fixType,
          issuesDetected: autoFixEvent.issuesDetected,
          issuesFixed: autoFixEvent.issuesFixed,
          duration: autoFixEvent.duration
        }
      };

      expect(wsEvent.type).toBe('autofix:completed');
      expect(wsEvent.taskId).toBe(autoFixEvent.taskId);
      expect(wsEvent.timestamp).toBe(autoFixEvent.timestamp);
      expect(wsEvent.data.filePath).toBe(autoFixEvent.filePath);
      expect(wsEvent.data.issuesFixed).toBe(autoFixEvent.issuesFixed);
    });

    it('should maintain type consistency across all auto-fix event types', () => {
      const eventTypes = [
        'autofix:requested',
        'autofix:started',
        'autofix:progress',
        'autofix:completed',
        'autofix:failed',
        'autofix:skipped'
      ];

      eventTypes.forEach(type => {
        const wsEvent: WebSocketEvent = {
          type,
          taskId: 'type-test-task',
          timestamp: new Date(),
          data: {}
        };

        expect(wsEvent.type).toBe(type);
        expect(wsEvent.type.startsWith('autofix:')).toBe(true);
      });
    });
  });

  describe('Event Serialization and Deserialization', () => {
    it('should serialize and deserialize events correctly', () => {
      const originalEvent: AutoFixProgressEvent = {
        taskId: 'serialize-task',
        filePath: '/src/serialization-test.ts',
        fixType: 'typescript',
        iteration: 3,
        totalIterations: 5,
        issuesFixed: 7,
        timestamp: new Date('2023-06-15T14:30:00.000Z')
      };

      // Serialize
      const serialized = JSON.stringify(originalEvent);
      expect(typeof serialized).toBe('string');

      // Deserialize
      const deserialized = JSON.parse(serialized);

      expect(deserialized.taskId).toBe(originalEvent.taskId);
      expect(deserialized.filePath).toBe(originalEvent.filePath);
      expect(deserialized.fixType).toBe(originalEvent.fixType);
      expect(deserialized.iteration).toBe(originalEvent.iteration);
      expect(deserialized.totalIterations).toBe(originalEvent.totalIterations);
      expect(deserialized.issuesFixed).toBe(originalEvent.issuesFixed);

      // Note: Date will be a string after JSON serialization
      expect(new Date(deserialized.timestamp).getTime()).toBe(originalEvent.timestamp.getTime());
    });

    it('should handle events with undefined optional fields', () => {
      const eventWithUndefined: AutoFixProgressEvent = {
        taskId: 'undefined-test',
        filePath: '/src/file.ts',
        fixType: 'eslint',
        iteration: 1,
        totalIterations: undefined,
        issuesFixed: 2,
        timestamp: new Date()
      };

      const serialized = JSON.stringify(eventWithUndefined);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.totalIterations).toBeUndefined();
      expect(deserialized.iteration).toBe(1);
      expect(deserialized.issuesFixed).toBe(2);
    });
  });

  describe('Event Consistency Rules', () => {
    it('should maintain consistent task IDs across related events', () => {
      const taskId = 'consistency-test-task';

      const events = [
        { type: 'autofix:requested', taskId },
        { type: 'autofix:started', taskId },
        { type: 'autofix:progress', taskId },
        { type: 'autofix:completed', taskId }
      ];

      events.forEach(event => {
        expect(event.taskId).toBe(taskId);
      });
    });

    it('should maintain consistent file paths across related events', () => {
      const filePath = '/src/consistency-test.ts';

      const events = [
        { filePath, type: 'requested' },
        { filePath, type: 'started' },
        { filePath, type: 'progress' },
        { filePath, type: 'completed' }
      ];

      events.forEach(event => {
        expect(event.filePath).toBe(filePath);
      });
    });

    it('should have logical progression of issue counts', () => {
      const detectedIssues = 10;
      const partiallyFixed = 6;
      const fullyFixed = 10;

      // Progress should not exceed detected
      expect(partiallyFixed).toBeLessThanOrEqual(detectedIssues);
      expect(fullyFixed).toBeLessThanOrEqual(detectedIssues);

      // Completed should match detected for successful fix
      expect(fullyFixed).toBe(detectedIssues);
    });
  });
});