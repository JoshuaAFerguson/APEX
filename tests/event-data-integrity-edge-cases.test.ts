/**
 * Event Data Integrity Edge Cases and Boundary Tests
 *
 * Comprehensive testing of edge cases, boundary conditions, and error scenarios
 * for APEX event data integrity.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitter } from 'eventemitter3';
import { EventCapture, createEventCapture } from '../packages/orchestrator/tests/utils/event-capture';
import {
  ApprovalRequiredEventDataSchema,
  type ApprovalRequiredEventData,
  type ContainerEventDataBase,
  type ContainerCreatedEventData,
  type PermissionRequestEventData,
} from '../packages/core/src/types';
import {
  generateTestId,
  createTestTimestamp,
  validateJsonRoundTrip,
  validateRequiredFields,
  validateFieldTypes,
  validateStringConstraints,
  validateNumericConstraints,
  createSchemaTestHelper,
  EventSequenceValidator,
  CrossReferenceValidator,
  eventAssert,
} from './event-data-integrity/shared/event-test-utils';

describe('Event Data Integrity Edge Cases', () => {
  let emitter: EventEmitter;
  let eventCapture: EventCapture;

  beforeEach(() => {
    emitter = new EventEmitter();
    eventCapture = createEventCapture(emitter);
  });

  afterEach(() => {
    eventCapture?.dispose();
  });

  describe('Schema Validation Boundaries', () => {
    const approvalHelper = createSchemaTestHelper(ApprovalRequiredEventDataSchema);

    it('should handle minimum string lengths', () => {
      const dataWithMinLength: ApprovalRequiredEventData = {
        approvalId: 'a', // Minimum length (1 character)
        taskId: 'b',
        gateName: 'c',
        gateType: 'deployment',
        timestamp: createTestTimestamp(),
      };

      expect(() => approvalHelper.expectValid(dataWithMinLength)).not.toThrow();

      // Test below minimum
      const belowMin = {
        ...dataWithMinLength,
        approvalId: '', // Empty string should fail
      };

      expect(() => approvalHelper.expectInvalid(belowMin)).not.toThrow();
    });

    it('should handle unicode and special characters', () => {
      const unicodeData: ApprovalRequiredEventData = {
        approvalId: generateTestId('approval'),
        taskId: generateTestId('task'),
        gateName: 'test-gate-🔒-مفتاح-キー-кλειδί',
        gateType: 'deployment',
        timestamp: createTestTimestamp(),
        description: 'Unicode test: 🚀 Rocket launch with émojis and spéciał characters',
        context: {
          'unicode-key-🔑': 'unicode-value-🎯',
          'ключ': 'значение',
          'キー': 'バリュー'
        }
      };

      expect(() => approvalHelper.expectValid(unicodeData)).not.toThrow();

      // Test JSON round-trip with unicode
      const result = validateJsonRoundTrip(unicodeData, ['timestamp']);
      expect(result.isValid).toBe(true);
    });

    it('should handle extreme numeric values', () => {
      const extremeData: ApprovalRequiredEventData = {
        approvalId: generateTestId('approval'),
        taskId: generateTestId('task'),
        gateName: 'test-gate',
        gateType: 'deployment',
        timestamp: createTestTimestamp(),
        minApprovals: Number.MAX_SAFE_INTEGER,
        timeoutMinutes: 1, // Minimum allowed
      };

      expect(() => approvalHelper.expectValid(extremeData)).not.toThrow();

      // Test negative values (should fail for these fields)
      const negativeData = {
        ...extremeData,
        minApprovals: -1,
      };

      expect(() => approvalHelper.expectInvalid(negativeData)).not.toThrow();
    });

    it('should handle date edge cases', () => {
      const year1970 = new Date('1970-01-01T00:00:00.000Z');
      const year2038 = new Date('2038-01-19T03:14:07.000Z');
      const farFuture = new Date('2100-12-31T23:59:59.999Z');

      const dates = [year1970, year2038, farFuture];

      dates.forEach(date => {
        const dateData: ApprovalRequiredEventData = {
          approvalId: generateTestId('approval'),
          taskId: generateTestId('task'),
          gateName: 'test-gate',
          gateType: 'deployment',
          timestamp: date,
          expiresAt: new Date(date.getTime() + 3600000), // 1 hour later
        };

        expect(() => approvalHelper.expectValid(dateData)).not.toThrow();

        // Test JSON round-trip
        const result = validateJsonRoundTrip(dateData, ['timestamp', 'expiresAt']);
        expect(result.isValid).toBe(true);
      });
    });

    it('should handle deeply nested objects', () => {
      const deeplyNested: ApprovalRequiredEventData = {
        approvalId: generateTestId('approval'),
        taskId: generateTestId('task'),
        gateName: 'test-gate',
        gateType: 'deployment',
        timestamp: createTestTimestamp(),
        context: {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: {
                    data: 'deep value',
                    array: [1, 2, { nested: true }],
                    timestamp: createTestTimestamp(),
                  }
                }
              }
            }
          },
          metadata: {
            tags: ['tag1', 'tag2', 'tag3'],
            properties: {
              prop1: 'value1',
              prop2: 123,
              prop3: true,
              prop4: null,
              prop5: undefined,
            }
          }
        }
      };

      expect(() => approvalHelper.expectValid(deeplyNested)).not.toThrow();

      // Test JSON round-trip with deep nesting
      const result = validateJsonRoundTrip(deeplyNested, [
        'timestamp',
        'context.level1.level2.level3.level4.level5.timestamp'
      ]);
      expect(result.isValid).toBe(true);
    });

    it('should handle large arrays', () => {
      const largeArrayData: ApprovalRequiredEventData = {
        approvalId: generateTestId('approval'),
        taskId: generateTestId('task'),
        gateName: 'test-gate',
        gateType: 'deployment',
        timestamp: createTestTimestamp(),
        approvers: new Array(1000).fill(0).map((_, i) => `user${i}@example.com`),
        affectedFiles: new Array(500).fill(0).map((_, i) => `/path/to/file${i}.ts`),
      };

      expect(() => approvalHelper.expectValid(largeArrayData)).not.toThrow();

      // Verify array integrity
      expect(largeArrayData.approvers).toHaveLength(1000);
      expect(largeArrayData.affectedFiles).toHaveLength(500);
      expect(largeArrayData.approvers![999]).toBe('user999@example.com');
    });
  });

  describe('Concurrent Data Validation', () => {
    it('should validate data integrity with concurrent schema checks', async () => {
      const eventCount = 100; // Reduced for reliability
      const validationResults: boolean[] = [];
      const helper = createSchemaTestHelper(ApprovalRequiredEventDataSchema);

      // Create valid test data concurrently
      const promises = Array.from({ length: eventCount }, async (_, i) => {
        const data: ApprovalRequiredEventData = {
          approvalId: generateTestId(`concurrent-${i}`),
          taskId: generateTestId(`task-${i}`),
          gateName: `gate-${i}`,
          gateType: 'deployment',
          timestamp: createTestTimestamp(i * 10),
        };

        try {
          helper.expectValid(data);
          validationResults.push(true);
        } catch (error) {
          validationResults.push(false);
        }
      });

      await Promise.all(promises);

      expect(validationResults).toHaveLength(eventCount);
      expect(validationResults.every(result => result === true)).toBe(true);
    });

    it('should handle concurrent JSON serialization', async () => {
      const dataCount = 100;
      const serializationResults: boolean[] = [];

      const promises = Array.from({ length: dataCount }, async (_, i) => {
        const data: ApprovalRequiredEventData = {
          approvalId: generateTestId(`serial-${i}`),
          taskId: generateTestId(`task-${i}`),
          gateName: `gate-${i}`,
          gateType: 'deployment',
          timestamp: createTestTimestamp(i * 10),
          context: { index: i, metadata: { processed: true } }
        };

        try {
          const result = validateJsonRoundTrip(data, ['timestamp']);
          serializationResults.push(result.isValid);
        } catch (error) {
          serializationResults.push(false);
        }
      });

      await Promise.all(promises);

      expect(serializationResults).toHaveLength(dataCount);
      expect(serializationResults.every(result => result === true)).toBe(true);
    });
  });

  describe('Memory Management and Large Data', () => {
    it('should handle large approval data without corruption', () => {
      const largeData: ApprovalRequiredEventData = {
        approvalId: generateTestId('large'),
        taskId: generateTestId('task'),
        gateName: 'large-data-gate',
        gateType: 'deployment',
        timestamp: createTestTimestamp(),
        description: 'A'.repeat(10000), // 10KB description
        context: {
          largeArray: new Array(100).fill('data'),
          largeObject: Object.fromEntries(
            new Array(50).fill(0).map((_, i) => [
              `key${i}`,
              { value: `value${i}`, metadata: { created: `2024-01-01T00:00:00.000Z`, id: i } }
            ])
          )
        },
        affectedFiles: new Array(100).fill(0).map((_, i) => `/path/to/file${i}.ts`)
      };

      // Validate schema with large data
      const helper = createSchemaTestHelper(ApprovalRequiredEventDataSchema);
      expect(() => helper.expectValid(largeData)).not.toThrow();

      // Test JSON round-trip with large data
      const result = validateJsonRoundTrip(largeData, ['timestamp']);
      expect(result.isValid).toBe(true);

      // Verify data integrity
      expect(largeData.description).toHaveLength(10000);
      expect(largeData.affectedFiles).toHaveLength(100);
      expect(Object.keys(largeData.context?.largeObject || {})).toHaveLength(50);
    });

    it('should handle memory-intensive validation efficiently', () => {
      const memBefore = process.memoryUsage();
      const startTime = performance.now();

      // Create multiple large data objects and validate them
      for (let i = 0; i < 50; i++) {
        const data: ApprovalRequiredEventData = {
          approvalId: generateTestId(`mem-${i}`),
          taskId: generateTestId(`task-${i}`),
          gateName: `memory-test-gate-${i}`,
          gateType: 'deployment',
          timestamp: createTestTimestamp(i * 1000),
          context: {
            largeData: 'x'.repeat(1000), // 1KB per object
            index: i,
            metadata: Object.fromEntries(
              new Array(20).fill(0).map((_, j) => [`prop${j}`, `value${j}`])
            )
          }
        };

        // Validate each object
        const helper = createSchemaTestHelper(ApprovalRequiredEventDataSchema);
        expect(() => helper.expectValid(data)).not.toThrow();

        // Test serialization
        const result = validateJsonRoundTrip(data, ['timestamp']);
        expect(result.isValid).toBe(true);
      }

      const endTime = performance.now();
      const memAfter = process.memoryUsage();

      const processingTime = endTime - startTime;
      const memIncrease = memAfter.heapUsed - memBefore.heapUsed;

      // Should process efficiently
      expect(processingTime).toBeLessThan(1000); // < 1 second
      expect(memIncrease).toBeLessThan(20 * 1024 * 1024); // < 20MB
    });
  });

  describe('Error Conditions and Recovery', () => {
    it('should handle circular reference detection', () => {
      const circularData: any = {
        id: generateTestId('circular'),
        timestamp: createTestTimestamp(),
      };
      circularData.self = circularData; // Create circular reference

      // JSON.stringify should throw on circular reference
      expect(() => JSON.stringify(circularData)).toThrow('Converting circular structure to JSON');

      // Validation should handle this gracefully
      expect(() => {
        validateRequiredFields(circularData, ['id', 'timestamp']);
      }).not.toThrow();
    });

    it('should validate malformed event data correctly', () => {
      const malformedData = {
        // Missing required fields - only has partialId, missing id and timestamp
        partialId: 'incomplete',
        // Wrong types
        wrongTimestamp: 'not-a-date',
        // Unexpected fields
        unexpected: 'test-value',
      };

      // Validation should catch the issues
      const requiredFieldsResult = validateRequiredFields(malformedData as any, ['id', 'timestamp']);
      expect(requiredFieldsResult.isValid).toBe(false);
      expect(requiredFieldsResult.missingFields).toContain('id');
      expect(requiredFieldsResult.missingFields).toContain('timestamp');

      // Test with an object that has a wrongly typed field
      const wrongTypeData = {
        ...malformedData,
        timestamp: 'not-a-date', // Wrong type
      };

      const typeResult = validateFieldTypes(wrongTypeData as any, {
        timestamp: 'date'
      });
      expect(typeResult.isValid).toBe(false);
      expect(typeResult.typeErrors[0]).toContain('Expected date, got string');
    });

    it('should handle schema validation errors gracefully', () => {
      const invalidApprovalData = {
        approvalId: '', // Invalid: empty string
        taskId: null, // Invalid: null
        gateName: 123, // Invalid: number instead of string
        gateType: 'invalid-type', // Invalid: not in enum
        timestamp: 'not-a-date', // Invalid: string instead of Date
      };

      const helper = createSchemaTestHelper(ApprovalRequiredEventDataSchema);

      expect(() => {
        helper.expectInvalid(invalidApprovalData);
      }).not.toThrow();

      const errors = helper.getErrors(invalidApprovalData);
      expect(errors).not.toBeNull();
      expect(errors?.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should handle different timezone data', () => {
      const timezones = [
        'UTC',
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
      ];

      timezones.forEach(timezone => {
        const originalTZ = process.env.TZ;
        process.env.TZ = timezone;

        try {
          const data: ApprovalRequiredEventData = {
            approvalId: generateTestId('tz'),
            taskId: generateTestId('task'),
            gateName: 'timezone-test',
            gateType: 'deployment',
            timestamp: createTestTimestamp(),
            expiresAt: createTestTimestamp(3600000), // 1 hour
          };

          const helper = createSchemaTestHelper(ApprovalRequiredEventDataSchema);
          expect(() => helper.expectValid(data)).not.toThrow();

          // Test JSON round-trip preserves timezone info
          const result = validateJsonRoundTrip(data, ['timestamp', 'expiresAt']);
          expect(result.isValid).toBe(true);
        } finally {
          process.env.TZ = originalTZ;
        }
      });
    });

    it('should handle different number formats', () => {
      const numberFormats = [
        0,
        -0,
        1,
        -1,
        0.1,
        -0.1,
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
        Number.MAX_VALUE,
        Number.MIN_VALUE,
      ];

      numberFormats.forEach(num => {
        const result = validateNumericConstraints(num, {
          integer: false, // Allow all number types
        });

        expect(result.isValid).toBe(true);
      });

      // Test special values
      const specialNumbers = [
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NaN,
      ];

      specialNumbers.forEach(num => {
        const data = {
          id: 'test',
          value: num,
        };

        // JSON.stringify should handle these appropriately
        const serialized = JSON.stringify(data);
        const parsed = JSON.parse(serialized);

        if (Number.isNaN(num)) {
          expect(parsed.value).toBeNull(); // NaN becomes null in JSON
        } else {
          expect(parsed.value).toBeNull(); // Infinity becomes null in JSON
        }
      });
    });

    it('should handle path separators across platforms', () => {
      const windowsPaths = [
        'C:\\Windows\\System32\\config.json',
        'D:\\Users\\Test\\Documents\\file.txt',
      ];

      const unixPaths = [
        '/etc/config.json',
        '/home/test/documents/file.txt',
        '/var/log/app.log',
      ];

      const allPaths = [...windowsPaths, ...unixPaths];

      const data: ApprovalRequiredEventData = {
        approvalId: generateTestId('paths'),
        taskId: generateTestId('task'),
        gateName: 'path-test',
        gateType: 'deployment',
        timestamp: createTestTimestamp(),
        affectedFiles: allPaths,
      };

      const helper = createSchemaTestHelper(ApprovalRequiredEventDataSchema);
      expect(() => helper.expectValid(data)).not.toThrow();

      // Verify path integrity after serialization
      const result = validateJsonRoundTrip(data, ['timestamp']);
      expect(result.isValid).toBe(true);
      expect(result.deserialized.affectedFiles).toEqual(allPaths);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large-scale validation efficiently', () => {
      const startTime = performance.now();
      const helper = createSchemaTestHelper(ApprovalRequiredEventDataSchema);

      // Validate large number of events
      for (let i = 0; i < 1000; i++) {
        const data: ApprovalRequiredEventData = {
          approvalId: generateTestId(`perf-${i}`),
          taskId: generateTestId(`task-${i}`),
          gateName: `performance-gate-${i}`,
          gateType: 'deployment',
          timestamp: createTestTimestamp(i * 10),
          context: { index: i }
        };

        expect(() => helper.expectValid(data)).not.toThrow();
      }

      const validationTime = performance.now() - startTime;

      // Performance assertions (adjust thresholds as needed)
      expect(validationTime).toBeLessThan(1000); // Should validate 1k events in < 1 second
    });

    it('should handle complex data structures efficiently', () => {
      const complexData: ApprovalRequiredEventData = {
        approvalId: generateTestId('complex'),
        taskId: generateTestId('task'),
        gateName: 'complex-gate',
        gateType: 'deployment',
        timestamp: createTestTimestamp(),
        context: {
          level1: {
            level2: {
              level3: {
                arrays: [
                  new Array(100).fill('data'),
                  new Array(50).fill({ nested: true, id: Math.random() })
                ],
                objects: Object.fromEntries(
                  new Array(100).fill(0).map((_, i) => [
                    `key${i}`,
                    { value: i, metadata: { created: `2024-01-01T00:00:00.000Z`, processed: true } }
                  ])
                )
              }
            }
          }
        }
      };

      const startTime = performance.now();

      // Validate complex structure
      const helper = createSchemaTestHelper(ApprovalRequiredEventDataSchema);
      expect(() => helper.expectValid(complexData)).not.toThrow();

      // Test JSON serialization performance
      const serializationStart = performance.now();
      const result = validateJsonRoundTrip(complexData, ['timestamp']);
      const serializationTime = performance.now() - serializationStart;

      const totalTime = performance.now() - startTime;

      expect(result.isValid).toBe(true);
      expect(totalTime).toBeLessThan(100); // Should complete in < 100ms
      expect(serializationTime).toBeLessThan(50); // Serialization in < 50ms
    });
  });

  describe('Data Consistency Under Stress', () => {
    it('should maintain data integrity under concurrent modifications', async () => {
      const crossRef = new CrossReferenceValidator();
      const promises: Promise<void>[] = [];

      // Concurrent operations that modify shared state
      for (let i = 0; i < 100; i++) {
        promises.push(
          new Promise<void>(resolve => {
            setTimeout(() => {
              crossRef.registerReference('type1', `value-${i}`);
              crossRef.registerReference('type2', `value-${i * 2}`);
              resolve();
            }, Math.random() * 10);
          })
        );
      }

      await Promise.all(promises);

      // Verify all references were registered correctly
      const allRefs = crossRef.getAllReferences();
      expect(Object.keys(allRefs.type1)).toHaveLength(100);
      expect(Object.keys(allRefs.type2)).toHaveLength(100);

      // Verify specific references
      expect(crossRef.hasReference('type1', 'value-50')).toBe(true);
      expect(crossRef.hasReference('type2', 'value-100')).toBe(true);
    });

    it('should handle event sequence validation under load', () => {
      const validator = new EventSequenceValidator([
        'start',
        'process',
        'complete'
      ]);

      // Emit events out of order and in large quantities
      const eventSets = 1000;

      for (let set = 0; set < eventSets; set++) {
        // Sometimes emit in order, sometimes out of order
        if (set % 2 === 0) {
          validator.addEvent('start', { set });
          validator.addEvent('process', { set });
          validator.addEvent('complete', { set });
        } else {
          validator.addEvent('start', { set });
          validator.addEvent('complete', { set }); // Skip process
        }
      }

      // At least some sequences should be valid
      const allEvents = validator.getEvents();
      expect(allEvents.length).toBe(eventSets * 2.5); // Average 2.5 events per set

      // Validation should work correctly
      const result = validator.validate();
      expect(result.actualSequence.length).toBeGreaterThan(0);
    });
  });
});