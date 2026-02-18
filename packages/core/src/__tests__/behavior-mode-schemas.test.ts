import { describe, it, expect } from 'vitest';
import {
  BehaviorModeSchema,
  BehaviorEventDataSchema,
  PostHookResultSchema,
  type BehaviorMode,
  type BehaviorEventData,
  type PostHookResult,
} from '../types';

describe('Behavior Mode Schemas', () => {
  describe('BehaviorModeSchema', () => {
    it('should validate valid behavior modes', () => {
      const validModes: BehaviorMode[] = ['warn', 'block', 'redact'];

      validModes.forEach(mode => {
        expect(() => BehaviorModeSchema.parse(mode)).not.toThrow();
        const result = BehaviorModeSchema.parse(mode);
        expect(result).toBe(mode);
      });
    });

    it('should reject invalid behavior modes', () => {
      const invalidModes = ['invalid', 'warning', 'blocking', 'redaction', '', null, undefined, 123, true];

      invalidModes.forEach(mode => {
        expect(() => BehaviorModeSchema.parse(mode)).toThrow();
      });
    });

    it('should be case sensitive', () => {
      const caseSensitiveModes = ['WARN', 'Warn', 'BLOCK', 'Block', 'REDACT', 'Redact'];

      caseSensitiveModes.forEach(mode => {
        expect(() => BehaviorModeSchema.parse(mode)).toThrow();
      });
    });
  });

  describe('BehaviorEventDataSchema', () => {
    it('should validate complete valid event data', () => {
      const validEventData: BehaviorEventData = {
        behaviorMode: 'warn',
        toolName: 'test-tool',
        reason: 'Test warning message',
        originalOutput: { data: 'test' },
        modifiedOutput: { data: 'test' },
        timestamp: new Date(),
        taskId: 'task-123',
        metadata: { source: 'test-hook' },
      };

      expect(() => BehaviorEventDataSchema.parse(validEventData)).not.toThrow();
      const result = BehaviorEventDataSchema.parse(validEventData);
      expect(result).toEqual(validEventData);
    });

    it('should validate minimal required event data', () => {
      const minimalEventData = {
        behaviorMode: 'block',
        toolName: 'bash-tool',
        reason: 'Blocked for testing',
        timestamp: new Date(),
      };

      expect(() => BehaviorEventDataSchema.parse(minimalEventData)).not.toThrow();
    });

    it('should require behaviorMode field', () => {
      const eventDataWithoutBehaviorMode = {
        toolName: 'test-tool',
        reason: 'Test reason',
        timestamp: new Date(),
      };

      expect(() => BehaviorEventDataSchema.parse(eventDataWithoutBehaviorMode)).toThrow();
    });

    it('should require toolName field', () => {
      const eventDataWithoutToolName = {
        behaviorMode: 'warn',
        reason: 'Test reason',
        timestamp: new Date(),
      };

      expect(() => BehaviorEventDataSchema.parse(eventDataWithoutToolName)).toThrow();
    });

    it('should require reason field', () => {
      const eventDataWithoutReason = {
        behaviorMode: 'redact',
        toolName: 'test-tool',
        timestamp: new Date(),
      };

      expect(() => BehaviorEventDataSchema.parse(eventDataWithoutReason)).toThrow();
    });

    it('should require timestamp field', () => {
      const eventDataWithoutTimestamp = {
        behaviorMode: 'warn',
        toolName: 'test-tool',
        reason: 'Test reason',
      };

      expect(() => BehaviorEventDataSchema.parse(eventDataWithoutTimestamp)).toThrow();
    });

    it('should accept any type for originalOutput and modifiedOutput', () => {
      const testOutputs = [
        null,
        undefined,
        'string',
        123,
        true,
        [],
        {},
        { complex: { nested: 'object' } },
        [1, 2, { nested: 'array' }],
      ];

      testOutputs.forEach(output => {
        const eventData = {
          behaviorMode: 'redact',
          toolName: 'test-tool',
          reason: 'Test reason',
          originalOutput: output,
          modifiedOutput: output,
          timestamp: new Date(),
        };

        expect(() => BehaviorEventDataSchema.parse(eventData)).not.toThrow();
      });
    });

    it('should validate timestamp as Date object', () => {
      const invalidTimestamps = [
        '2023-01-01',
        1672531200000,
        'now',
        null,
        undefined,
      ];

      invalidTimestamps.forEach(timestamp => {
        const eventData = {
          behaviorMode: 'warn',
          toolName: 'test-tool',
          reason: 'Test reason',
          timestamp,
        };

        expect(() => BehaviorEventDataSchema.parse(eventData)).toThrow();
      });
    });

    it('should allow optional metadata as record', () => {
      const validMetadata = [
        { key: 'value' },
        { number: 123, string: 'test', boolean: true },
        { nested: { object: 'value' } },
        {},
      ];

      validMetadata.forEach(metadata => {
        const eventData = {
          behaviorMode: 'warn',
          toolName: 'test-tool',
          reason: 'Test reason',
          timestamp: new Date(),
          metadata,
        };

        expect(() => BehaviorEventDataSchema.parse(eventData)).not.toThrow();
      });
    });
  });

  describe('PostHookResultSchema', () => {
    it('should validate empty result', () => {
      const emptyResult = {};
      expect(() => PostHookResultSchema.parse(emptyResult)).not.toThrow();
    });

    it('should validate result with behavior mode', () => {
      const resultWithBehavior: PostHookResult = {
        behaviorMode: 'warn',
        behaviorReason: 'Test warning',
      };

      expect(() => PostHookResultSchema.parse(resultWithBehavior)).not.toThrow();
    });

    it('should validate result with modified result', () => {
      const resultWithModified = {
        modifyResult: true,
        modifiedResult: {
          success: true,
          output: { data: 'modified' },
        },
      };

      expect(() => PostHookResultSchema.parse(resultWithModified)).not.toThrow();
    });

    it('should validate result with error modification', () => {
      const resultWithError = {
        modifyResult: true,
        modifiedResult: {
          success: false,
          error: 'Operation failed',
        },
      };

      expect(() => PostHookResultSchema.parse(resultWithError)).not.toThrow();
    });

    it('should default modifyResult to false', () => {
      const result = PostHookResultSchema.parse({});
      expect(result.modifyResult).toBe(false);
    });

    it('should allow complex metadata', () => {
      const resultWithMetadata = {
        metadata: {
          hook: 'security-hook',
          priority: 100,
          settings: { strict: true },
          tags: ['security', 'validation'],
        },
      };

      expect(() => PostHookResultSchema.parse(resultWithMetadata)).not.toThrow();
    });

    it('should require success field in modifiedResult when present', () => {
      const invalidModifiedResult = {
        modifyResult: true,
        modifiedResult: {
          output: { data: 'test' },
          // missing success field
        },
      };

      expect(() => PostHookResultSchema.parse(invalidModifiedResult)).toThrow();
    });

    it('should allow optional output and error in modifiedResult', () => {
      const validResults = [
        {
          modifyResult: true,
          modifiedResult: {
            success: true,
            output: { data: 'test' },
          },
        },
        {
          modifyResult: true,
          modifiedResult: {
            success: false,
            error: 'Error message',
          },
        },
        {
          modifyResult: true,
          modifiedResult: {
            success: true,
            // both output and error omitted
          },
        },
      ];

      validResults.forEach(result => {
        expect(() => PostHookResultSchema.parse(result)).not.toThrow();
      });
    });

    it('should validate behaviorReason as string when present', () => {
      const invalidBehaviorReasons = [123, true, null, undefined, {}];

      invalidBehaviorReasons.forEach(reason => {
        const result = {
          behaviorMode: 'warn',
          behaviorReason: reason,
        };

        expect(() => PostHookResultSchema.parse(result)).toThrow();
      });
    });

    it('should allow behaviorMode without behaviorReason', () => {
      const result = {
        behaviorMode: 'block',
      };

      expect(() => PostHookResultSchema.parse(result)).not.toThrow();
    });
  });

  describe('Schema Integration', () => {
    it('should work together in a complete workflow', () => {
      // Simulate a complete behavior workflow
      const hookResult: PostHookResult = {
        modifyResult: true,
        modifiedResult: {
          success: true,
          output: { message: '[REDACTED]' },
        },
        behaviorMode: 'redact',
        behaviorReason: 'Sensitive data detected',
        metadata: { pattern: 'credit-card' },
      };

      const eventData: BehaviorEventData = {
        behaviorMode: hookResult.behaviorMode!,
        toolName: 'bash-tool',
        reason: hookResult.behaviorReason!,
        originalOutput: { message: '4111-1111-1111-1111' },
        modifiedOutput: hookResult.modifiedResult!.output,
        timestamp: new Date(),
        taskId: 'task-456',
        metadata: hookResult.metadata,
      };

      expect(() => PostHookResultSchema.parse(hookResult)).not.toThrow();
      expect(() => BehaviorEventDataSchema.parse(eventData)).not.toThrow();

      const parsedHookResult = PostHookResultSchema.parse(hookResult);
      const parsedEventData = BehaviorEventDataSchema.parse(eventData);

      expect(parsedHookResult.behaviorMode).toBe(parsedEventData.behaviorMode);
      expect(parsedHookResult.behaviorReason).toBe(parsedEventData.reason);
    });

    it('should handle all three behavior modes in schema validation', () => {
      const behaviorModes: BehaviorMode[] = ['warn', 'block', 'redact'];

      behaviorModes.forEach(mode => {
        const hookResult = {
          behaviorMode: mode,
          behaviorReason: `Test ${mode} behavior`,
        };

        const eventData = {
          behaviorMode: mode,
          toolName: 'test-tool',
          reason: `Test ${mode} behavior`,
          timestamp: new Date(),
        };

        expect(() => PostHookResultSchema.parse(hookResult)).not.toThrow();
        expect(() => BehaviorEventDataSchema.parse(eventData)).not.toThrow();
      });
    });
  });
});