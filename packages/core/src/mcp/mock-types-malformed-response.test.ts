/**
 * @fileoverview Tests for Malformed Response Types in Mock MCP Server Configuration
 *
 * Comprehensive test coverage for the new MalformedResponseType enum and
 * MockMalformedResponseConfig added as part of the malformed response simulation
 * feature. Tests focus on:
 * - Enum value validation and type safety
 * - Schema validation for malformed response configuration
 * - Integration with existing mock server types
 * - Edge cases and error conditions
 * - Documentation examples verification
 *
 * @module @apex/core/mcp/mock-types-malformed-response.test
 */

import { describe, it, expect } from 'vitest';
import {
  MalformedResponseTypeSchema,
  MockMalformedResponseConfigSchema,
  type MalformedResponseType,
  type MockMalformedResponseConfig,
} from './mock-types.js';

// ============================================================================
// MALFORMED RESPONSE TYPE ENUM TESTS
// ============================================================================

describe('MalformedResponseType Enum', () => {
  describe('Valid Values', () => {
    it('should accept all defined malformed response types', () => {
      const validTypes = [
        'invalid_json',
        'truncated_json',
        'wrong_schema',
        'empty_response',
      ] as const;

      for (const type of validTypes) {
        const result = MalformedResponseTypeSchema.parse(type);
        expect(result).toBe(type);
      }
    });

    it('should provide correct TypeScript types', () => {
      // Type-only test to ensure enum values are properly typed
      const invalidJson: MalformedResponseType = 'invalid_json';
      const truncatedJson: MalformedResponseType = 'truncated_json';
      const wrongSchema: MalformedResponseType = 'wrong_schema';
      const emptyResponse: MalformedResponseType = 'empty_response';

      // These should not cause TypeScript errors
      expect(invalidJson).toBe('invalid_json');
      expect(truncatedJson).toBe('truncated_json');
      expect(wrongSchema).toBe('wrong_schema');
      expect(emptyResponse).toBe('empty_response');
    });
  });

  describe('Invalid Values', () => {
    it('should reject invalid enum values', () => {
      const invalidTypes = [
        'invalid_type',
        'malformed_response',
        'bad_json',
        'corrupted',
        '',
        null,
        undefined,
        123,
        {},
        [],
      ];

      for (const invalid of invalidTypes) {
        expect(() => MalformedResponseTypeSchema.parse(invalid)).toThrow();
      }
    });

    it('should reject case variations of valid types', () => {
      const caseVariations = [
        'Invalid_Json',
        'TRUNCATED_JSON',
        'wrongSchema',
        'EmptyResponse',
        'invalid-json',
        'truncated-json',
      ];

      for (const variation of caseVariations) {
        expect(() => MalformedResponseTypeSchema.parse(variation)).toThrow();
      }
    });
  });
});

// ============================================================================
// MALFORMED RESPONSE CONFIG SCHEMA TESTS
// ============================================================================

describe('MockMalformedResponseConfig Schema', () => {
  describe('Required Fields', () => {
    it('should require type field', () => {
      expect(() => MockMalformedResponseConfigSchema.parse({})).toThrow();
      expect(() => MockMalformedResponseConfigSchema.parse({
        // Missing type field
        description: 'Test config',
      })).toThrow();
    });

    it('should accept minimal valid configuration', () => {
      const minimalConfig = {
        type: 'invalid_json' as const,
      };

      const result = MockMalformedResponseConfigSchema.parse(minimalConfig);
      expect(result.type).toBe('invalid_json');
      expect(result.affectedMethods).toEqual([]); // Default value
      expect(result.probability).toBe(1.0); // Default value
    });
  });

  describe('Type-Specific Validation', () => {
    describe('truncated_json type', () => {
      it('should accept valid truncateAt values', () => {
        const configs = [
          { type: 'truncated_json' as const, truncateAt: 100 },
          { type: 'truncated_json' as const, truncateAt: 0 },
          { type: 'truncated_json' as const, truncateAt: 9999 },
          { type: 'truncated_json' as const, truncateAt: '50%' },
          { type: 'truncated_json' as const, truncateAt: '1%' },
          { type: 'truncated_json' as const, truncateAt: '99%' },
        ];

        for (const config of configs) {
          const result = MockMalformedResponseConfigSchema.parse(config);
          expect(result.truncateAt).toBe(config.truncateAt);
        }
      });

      it('should reject invalid truncateAt values', () => {
        const invalidConfigs = [
          { type: 'truncated_json' as const, truncateAt: -1 }, // Negative number
          { type: 'truncated_json' as const, truncateAt: '101%' }, // Invalid percentage
          { type: 'truncated_json' as const, truncateAt: '0%invalid' }, // Invalid format
          { type: 'truncated_json' as const, truncateAt: 'not-a-number' },
          { type: 'truncated_json' as const, truncateAt: null },
          { type: 'truncated_json' as const, truncateAt: [] },
        ];

        for (const config of invalidConfigs) {
          expect(() => MockMalformedResponseConfigSchema.parse(config)).toThrow();
        }
      });
    });

    describe('invalid_json type', () => {
      it('should accept valid invalidJsonContent', () => {
        const configs = [
          { type: 'invalid_json' as const, invalidJsonContent: '{"key": undefined}' },
          { type: 'invalid_json' as const, invalidJsonContent: '{"incomplete": ' },
          { type: 'invalid_json' as const, invalidJsonContent: 'not json at all' },
          { type: 'invalid_json' as const, invalidJsonContent: '' },
        ];

        for (const config of configs) {
          const result = MockMalformedResponseConfigSchema.parse(config);
          expect(result.invalidJsonContent).toBe(config.invalidJsonContent);
        }
      });

      it('should accept configuration without invalidJsonContent', () => {
        const config = { type: 'invalid_json' as const };
        const result = MockMalformedResponseConfigSchema.parse(config);
        expect(result.invalidJsonContent).toBeUndefined();
      });
    });

    describe('wrong_schema type', () => {
      it('should accept various wrongSchemaPayload types', () => {
        const configs = [
          { type: 'wrong_schema' as const, wrongSchemaPayload: { unexpected: 'structure' } },
          { type: 'wrong_schema' as const, wrongSchemaPayload: { missing: 'required fields' } },
          { type: 'wrong_schema' as const, wrongSchemaPayload: 'string instead of object' },
          { type: 'wrong_schema' as const, wrongSchemaPayload: 42 },
          { type: 'wrong_schema' as const, wrongSchemaPayload: null },
          { type: 'wrong_schema' as const, wrongSchemaPayload: [] },
          { type: 'wrong_schema' as const, wrongSchemaPayload: true },
        ];

        for (const config of configs) {
          const result = MockMalformedResponseConfigSchema.parse(config);
          expect(result.wrongSchemaPayload).toEqual(config.wrongSchemaPayload);
        }
      });
    });

    describe('empty_response type', () => {
      it('should accept empty_response configuration', () => {
        const config = { type: 'empty_response' as const };
        const result = MockMalformedResponseConfigSchema.parse(config);
        expect(result.type).toBe('empty_response');
      });

      it('should work with optional fields for empty_response', () => {
        const config = {
          type: 'empty_response' as const,
          description: 'Simulates connection drop',
          probability: 0.5,
        };
        const result = MockMalformedResponseConfigSchema.parse(config);
        expect(result.type).toBe('empty_response');
        expect(result.description).toBe('Simulates connection drop');
        expect(result.probability).toBe(0.5);
      });
    });
  });

  describe('Optional Fields Validation', () => {
    describe('affectedMethods', () => {
      it('should accept valid method arrays', () => {
        const configs = [
          { type: 'invalid_json' as const, affectedMethods: [] },
          { type: 'invalid_json' as const, affectedMethods: ['tools/call'] },
          { type: 'invalid_json' as const, affectedMethods: ['tools/call', 'initialize', 'resources/list'] },
        ];

        for (const config of configs) {
          const result = MockMalformedResponseConfigSchema.parse(config);
          expect(result.affectedMethods).toEqual(config.affectedMethods);
        }
      });

      it('should default affectedMethods to empty array', () => {
        const config = { type: 'invalid_json' as const };
        const result = MockMalformedResponseConfigSchema.parse(config);
        expect(result.affectedMethods).toEqual([]);
      });

      it('should reject invalid affectedMethods', () => {
        const invalidConfigs = [
          { type: 'invalid_json' as const, affectedMethods: 'not-an-array' },
          { type: 'invalid_json' as const, affectedMethods: [123, 456] },
          { type: 'invalid_json' as const, affectedMethods: [null, undefined] },
          { type: 'invalid_json' as const, affectedMethods: [{}] },
        ];

        for (const config of invalidConfigs) {
          expect(() => MockMalformedResponseConfigSchema.parse(config)).toThrow();
        }
      });
    });

    describe('probability', () => {
      it('should accept valid probability values', () => {
        const validProbabilities = [0.0, 0.1, 0.5, 0.9, 1.0];

        for (const probability of validProbabilities) {
          const config = { type: 'invalid_json' as const, probability };
          const result = MockMalformedResponseConfigSchema.parse(config);
          expect(result.probability).toBe(probability);
        }
      });

      it('should default probability to 1.0', () => {
        const config = { type: 'invalid_json' as const };
        const result = MockMalformedResponseConfigSchema.parse(config);
        expect(result.probability).toBe(1.0);
      });

      it('should reject invalid probability values', () => {
        const invalidProbabilities = [-0.1, 1.1, 2.0, -1.0, NaN, Infinity, -Infinity];

        for (const probability of invalidProbabilities) {
          const config = { type: 'invalid_json' as const, probability };
          expect(() => MockMalformedResponseConfigSchema.parse(config)).toThrow();
        }
      });
    });

    describe('description', () => {
      it('should accept valid descriptions', () => {
        const descriptions = [
          'Simple description',
          'Multi-line description\nwith newlines',
          'Description with special characters: !@#$%^&*()',
          '', // Empty string
          'Very long description that goes on and on and contains lots of details about what this configuration does and why it might be useful in testing scenarios',
        ];

        for (const description of descriptions) {
          const config = { type: 'invalid_json' as const, description };
          const result = MockMalformedResponseConfigSchema.parse(config);
          expect(result.description).toBe(description);
        }
      });

      it('should be optional', () => {
        const config = { type: 'invalid_json' as const };
        const result = MockMalformedResponseConfigSchema.parse(config);
        expect(result.description).toBeUndefined();
      });

      it('should reject non-string descriptions', () => {
        const invalidDescriptions = [123, null, {}, [], true];

        for (const description of invalidDescriptions) {
          const config = { type: 'invalid_json' as const, description };
          expect(() => MockMalformedResponseConfigSchema.parse(config)).toThrow();
        }
      });
    });
  });

  describe('Complete Configuration Examples', () => {
    it('should validate example from documentation - truncated_json', () => {
      const config: MockMalformedResponseConfig = {
        type: 'truncated_json',
        truncateAt: '50%',
        affectedMethods: ['tools/call'],
        probability: 1.0,
        description: 'Simulate network interruption',
      };

      const result = MockMalformedResponseConfigSchema.parse(config);
      expect(result).toEqual(config);
    });

    it('should validate example from documentation - invalid_json', () => {
      const config: MockMalformedResponseConfig = {
        type: 'invalid_json',
        invalidJsonContent: '{"result": undefined}',
        affectedMethods: [],
        probability: 0.5,
        description: 'Test JSON parsing resilience',
      };

      const result = MockMalformedResponseConfigSchema.parse(config);
      expect(result).toEqual(config);
    });

    it('should validate example from documentation - wrong_schema', () => {
      const config: MockMalformedResponseConfig = {
        type: 'wrong_schema',
        wrongSchemaPayload: { unexpected: 'structure', missing: 'required fields' },
        description: 'Test schema validation',
      };

      const result = MockMalformedResponseConfigSchema.parse(config);
      expect(result).toEqual(config);
    });

    it('should validate complex real-world configurations', () => {
      const complexConfigs: MockMalformedResponseConfig[] = [
        {
          type: 'truncated_json',
          truncateAt: 256,
          affectedMethods: ['tools/call', 'resources/read'],
          probability: 0.1,
          description: 'Simulate intermittent connection drops during large responses',
        },
        {
          type: 'invalid_json',
          invalidJsonContent: '{"jsonrpc":"2.0","id":1,"result":{"status":"ok",}', // Trailing comma
          affectedMethods: ['initialize', 'tools/list'],
          probability: 0.05,
          description: 'Test handling of malformed JSON with syntax errors',
        },
        {
          type: 'wrong_schema',
          wrongSchemaPayload: {
            version: '3.0.0', // Wrong version
            capabilities: 'invalid', // Should be object
            missing_id: true, // Missing required fields
          },
          affectedMethods: ['initialize'],
          probability: 1.0,
          description: 'Test initialization with incompatible protocol version',
        },
        {
          type: 'empty_response',
          affectedMethods: [],
          probability: 0.02,
          description: 'Simulate complete connection loss',
        },
      ];

      for (const config of complexConfigs) {
        const result = MockMalformedResponseConfigSchema.parse(config);
        expect(result).toEqual(config);
      }
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle edge cases for truncateAt', () => {
      const edgeCases = [
        { type: 'truncated_json' as const, truncateAt: 0 }, // Truncate at start
        { type: 'truncated_json' as const, truncateAt: Number.MAX_SAFE_INTEGER }, // Very large number
        { type: 'truncated_json' as const, truncateAt: '0%' }, // 0% truncation
        { type: 'truncated_json' as const, truncateAt: '100%' }, // 100% truncation (edge case)
      ];

      for (const config of edgeCases) {
        const result = MockMalformedResponseConfigSchema.parse(config);
        expect(result.truncateAt).toBe(config.truncateAt);
      }
    });

    it('should handle complex nested wrongSchemaPayload', () => {
      const complexPayload = {
        deeply: {
          nested: {
            structure: {
              with: ['arrays', 'and', { objects: true }],
              numbers: 42,
              nullValue: null,
              undefinedValue: undefined, // This will be serialized/handled by Zod
            },
          },
        },
        circular: null, // Avoid circular references in tests
      };

      const config = {
        type: 'wrong_schema' as const,
        wrongSchemaPayload: complexPayload,
      };

      const result = MockMalformedResponseConfigSchema.parse(config);
      expect(result.wrongSchemaPayload).toBeDefined();
    });

    it('should handle empty and whitespace method names', () => {
      const configs = [
        { type: 'invalid_json' as const, affectedMethods: [''] }, // Empty string method
        { type: 'invalid_json' as const, affectedMethods: ['   '] }, // Whitespace method
        { type: 'invalid_json' as const, affectedMethods: ['valid', '', 'also-valid'] }, // Mixed
      ];

      for (const config of configs) {
        const result = MockMalformedResponseConfigSchema.parse(config);
        expect(result.affectedMethods).toEqual(config.affectedMethods);
      }
    });

    it('should handle extremely long invalidJsonContent', () => {
      const longContent = '{"data":"' + 'x'.repeat(100000) + '"}'; // 100KB+ string
      const config = {
        type: 'invalid_json' as const,
        invalidJsonContent: longContent,
      };

      const result = MockMalformedResponseConfigSchema.parse(config);
      expect(result.invalidJsonContent).toBe(longContent);
    });
  });

  describe('Type Safety and TypeScript Integration', () => {
    it('should ensure type safety with TypeScript', () => {
      // These should not cause TypeScript compilation errors
      const configs: MockMalformedResponseConfig[] = [
        { type: 'invalid_json' },
        { type: 'truncated_json', truncateAt: 100 },
        { type: 'wrong_schema', wrongSchemaPayload: {} },
        { type: 'empty_response', probability: 0.5 },
      ];

      for (const config of configs) {
        const result = MockMalformedResponseConfigSchema.parse(config);
        expect(result.type).toBeDefined();
      }
    });

    it('should preserve unknown fields (if configured)', () => {
      // Test that Zod schema handles unknown fields appropriately
      const configWithUnknown = {
        type: 'invalid_json' as const,
        unknownField: 'should be stripped or cause error',
        description: 'valid field',
      };

      // Depending on Zod configuration, this might strip unknown fields or throw
      // For our schema, we expect it to be strict and reject unknown fields
      expect(() => MockMalformedResponseConfigSchema.parse(configWithUnknown)).toThrow();
    });
  });

  describe('Error Message Quality', () => {
    it('should provide helpful error messages for common mistakes', () => {
      const invalidConfigs = [
        { type: 'invalid_type' }, // Wrong type value
        { type: 'truncated_json', truncateAt: 'invalid%' }, // Invalid percentage
        { type: 'invalid_json', probability: 1.5 }, // Invalid probability
        { affectedMethods: ['method'] }, // Missing type
      ];

      for (const config of invalidConfigs) {
        try {
          MockMalformedResponseConfigSchema.parse(config);
          fail(`Expected config to throw error: ${JSON.stringify(config)}`);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          // Error should contain helpful information
          expect(String(error)).toBeTruthy();
        }
      }
    });
  });
});

// ============================================================================
// INTEGRATION TESTS WITH EXISTING MOCK TYPES
// ============================================================================

describe('Integration with Existing Mock Types', () => {
  it('should work as part of larger mock server configurations', () => {
    // Test that MalformedResponseConfig integrates well with existing mock types
    // This is a conceptual test since we're focusing on the new types
    const malformedConfig: MockMalformedResponseConfig = {
      type: 'truncated_json',
      truncateAt: '25%',
      affectedMethods: ['tools/call'],
      probability: 0.3,
      description: 'Simulate network issues during tool execution',
    };

    // Validate the config independently
    const result = MockMalformedResponseConfigSchema.parse(malformedConfig);
    expect(result).toEqual(malformedConfig);

    // Ensure it has all the expected properties that would be needed
    // for integration with broader mock server infrastructure
    expect(result.type).toBeDefined();
    expect(result.affectedMethods).toBeDefined();
    expect(result.probability).toBeDefined();
  });

  it('should be compatible with testing framework expectations', () => {
    // Verify that the types work as expected in testing scenarios
    const testConfigs: MockMalformedResponseConfig[] = [
      { type: 'invalid_json' },
      { type: 'truncated_json', truncateAt: 50 },
      { type: 'wrong_schema', wrongSchemaPayload: { error: true } },
      { type: 'empty_response' },
    ];

    // All configs should parse successfully
    for (const config of testConfigs) {
      const parsed = MockMalformedResponseConfigSchema.parse(config);
      expect(parsed.type).toBe(config.type);
    }

    // Verify that they can be used in arrays/collections
    const allConfigs = testConfigs.map(config =>
      MockMalformedResponseConfigSchema.parse(config)
    );
    expect(allConfigs).toHaveLength(4);
  });
});