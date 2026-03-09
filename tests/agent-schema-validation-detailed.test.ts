/**
 * Detailed schema validation tests for APEX Agent Definition
 * Focuses on schema boundary conditions and validation edge cases
 */

import { describe, it, expect } from 'vitest';
import { AgentDefinitionSchema, AgentModelSchema, AgentTool } from '@apexcli/core';

describe('Agent Schema Validation - Detailed Tests', () => {
  describe('Required Fields Validation', () => {
    it('should accept minimal valid agent definition', () => {
      const validAgent = {
        name: 'test-agent',
        description: 'A test agent',
        prompt: 'You are a test agent.',
      };

      const result = AgentDefinitionSchema.safeParse(validAgent);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.name).toBe('test-agent');
        expect(result.data.description).toBe('A test agent');
        expect(result.data.prompt).toBe('You are a test agent.');
        expect(result.data.model).toBe('sonnet'); // default value
      }
    });

    it('should document current behavior with empty strings', () => {
      // This test documents the current behavior where empty strings are accepted
      // This may be a design decision or an issue to address in the future
      const emptyStringAgent = {
        name: '',
        description: '',
        prompt: '',
      };

      const result = AgentDefinitionSchema.safeParse(emptyStringAgent);

      // Current behavior: empty strings are accepted by z.string()
      // If this should fail, the schema needs to be updated to use .min(1) or .nonempty()
      expect(result.success).toBe(true);

      console.log('📋 Current schema behavior: empty strings are accepted for required fields');
      console.log('💡 Consider using z.string().min(1) for stricter validation if needed');
    });

    it('should reject null values for required fields', () => {
      const nullAgent = {
        name: null,
        description: 'Valid description',
        prompt: 'Valid prompt',
      };

      const result = AgentDefinitionSchema.safeParse(nullAgent);
      expect(result.success).toBe(false);
    });

    it('should reject undefined values for required fields', () => {
      const undefinedAgent = {
        name: 'valid-name',
        description: undefined,
        prompt: 'Valid prompt',
      };

      const result = AgentDefinitionSchema.safeParse(undefinedAgent);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const missingNameAgent = {
        description: 'Valid description',
        prompt: 'Valid prompt',
      };

      const result = AgentDefinitionSchema.safeParse(missingNameAgent);
      expect(result.success).toBe(false);
    });
  });

  describe('Model Field Validation', () => {
    it('should accept all valid model enum values', () => {
      const validModels = ['opus', 'sonnet', 'haiku', 'inherit'] as const;

      validModels.forEach(model => {
        const agent = {
          name: 'test-agent',
          description: 'Test agent',
          prompt: 'Test prompt',
          model,
        };

        const result = AgentDefinitionSchema.safeParse(agent);
        expect(result.success).toBe(true);

        if (result.success) {
          expect(result.data.model).toBe(model);
        }
      });
    });

    it('should reject invalid model enum values', () => {
      const invalidModels = ['gpt-4', 'claude', 'invalid', 123];

      invalidModels.forEach(model => {
        const agent = {
          name: 'test-agent',
          description: 'Test agent',
          prompt: 'Test prompt',
          model,
        };

        const result = AgentDefinitionSchema.safeParse(agent);
        expect(result.success).toBe(false);
      });
    });

    it('should handle empty string model value', () => {
      const agent = {
        name: 'test-agent',
        description: 'Test agent',
        prompt: 'Test prompt',
        model: '',
      };

      const result = AgentDefinitionSchema.safeParse(agent);
      // Empty string is not in the enum, so it should fail
      expect(result.success).toBe(false);
    });

    it('should handle null and undefined model values', () => {
      // Test null model (should fail)
      const agentWithNullModel = {
        name: 'test-agent',
        description: 'Test agent',
        prompt: 'Test prompt',
        model: null,
      };

      const nullResult = AgentDefinitionSchema.safeParse(agentWithNullModel);
      expect(nullResult.success).toBe(false);

      // Test undefined model (should pass with default)
      const agentWithUndefinedModel = {
        name: 'test-agent',
        description: 'Test agent',
        prompt: 'Test prompt',
        model: undefined,
      };

      const undefinedResult = AgentDefinitionSchema.safeParse(agentWithUndefinedModel);
      expect(undefinedResult.success).toBe(true);

      if (undefinedResult.success) {
        expect(undefinedResult.data.model).toBe('sonnet'); // should get default
      }
    });

    it('should use default model when not specified', () => {
      const agentWithoutModel = {
        name: 'test-agent',
        description: 'Test agent',
        prompt: 'Test prompt',
      };

      const result = AgentDefinitionSchema.safeParse(agentWithoutModel);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.model).toBe('sonnet');
      }
    });
  });

  describe('Tools Field Validation', () => {
    it('should accept valid tools as array', () => {
      const agent = {
        name: 'test-agent',
        description: 'Test agent',
        prompt: 'Test prompt',
        tools: ['Read', 'Write', 'Edit', 'Bash'],
      };

      const result = AgentDefinitionSchema.safeParse(agent);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.tools).toEqual(['Read', 'Write', 'Edit', 'Bash']);
      }
    });

    it('should accept empty tools array', () => {
      const agent = {
        name: 'test-agent',
        description: 'Test agent',
        prompt: 'Test prompt',
        tools: [],
      };

      const result = AgentDefinitionSchema.safeParse(agent);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.tools).toEqual([]);
      }
    });

    it('should handle undefined tools field', () => {
      const agent = {
        name: 'test-agent',
        description: 'Test agent',
        prompt: 'Test prompt',
        tools: undefined,
      };

      const result = AgentDefinitionSchema.safeParse(agent);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.tools).toBeUndefined();
      }
    });

    it('should accept any strings as tools (no enum validation)', () => {
      // Note: The schema uses z.array(z.string()) not z.array(AgentToolSchema)
      // This allows any strings, not just the predefined tool types
      const agent = {
        name: 'test-agent',
        description: 'Test agent',
        prompt: 'Test prompt',
        tools: ['CustomTool', 'AnotherCustomTool', 'Read'],
      };

      const result = AgentDefinitionSchema.safeParse(agent);
      expect(result.success).toBe(true);

      console.log('📋 Schema allows any strings as tools, not restricted to AgentTool enum');
    });

    it('should reject non-array tools', () => {
      const invalidToolsFormats = [
        'Read,Write,Edit', // string instead of array
        { Read: true, Write: true }, // object instead of array
        123, // number instead of array
        null, // null instead of array
      ];

      invalidToolsFormats.forEach(tools => {
        const agent = {
          name: 'test-agent',
          description: 'Test agent',
          prompt: 'Test prompt',
          tools,
        };

        const result = AgentDefinitionSchema.safeParse(agent);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Skills Field Validation', () => {
    it('should accept skills as array of strings', () => {
      const agent = {
        name: 'test-agent',
        description: 'Test agent',
        prompt: 'Test prompt',
        skills: ['typescript', 'react', 'nodejs'],
      };

      const result = AgentDefinitionSchema.safeParse(agent);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.skills).toEqual(['typescript', 'react', 'nodejs']);
      }
    });

    it('should accept empty skills array', () => {
      const agent = {
        name: 'test-agent',
        description: 'Test agent',
        prompt: 'Test prompt',
        skills: [],
      };

      const result = AgentDefinitionSchema.safeParse(agent);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.skills).toEqual([]);
      }
    });

    it('should handle undefined skills field', () => {
      const agent = {
        name: 'test-agent',
        description: 'Test agent',
        prompt: 'Test prompt',
        skills: undefined,
      };

      const result = AgentDefinitionSchema.safeParse(agent);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.skills).toBeUndefined();
      }
    });
  });

  describe('Extra Properties Handling', () => {
    it('should ignore extra properties not in schema', () => {
      const agentWithExtras = {
        name: 'test-agent',
        description: 'Test agent',
        prompt: 'Test prompt',
        // Extra properties that should be ignored
        extraField1: 'ignored',
        version: '1.0.0',
        metadata: { created: '2024-01-01' },
        unknownArray: [1, 2, 3],
      };

      const result = AgentDefinitionSchema.safeParse(agentWithExtras);
      expect(result.success).toBe(true);

      if (result.success) {
        // Extra properties should not exist in result
        expect((result.data as any).extraField1).toBeUndefined();
        expect((result.data as any).version).toBeUndefined();
        expect((result.data as any).metadata).toBeUndefined();
        expect((result.data as any).unknownArray).toBeUndefined();

        console.log('✅ Zod schema correctly strips unknown properties');
      }
    });
  });

  describe('Type Coercion and Validation', () => {
    it('should not coerce types (strict validation)', () => {
      const agentWithWrongTypes = {
        name: 123, // number instead of string
        description: true, // boolean instead of string
        prompt: { text: 'This is an object' }, // object instead of string
        tools: 'Read,Write', // string instead of array
        model: 'invalid-model', // invalid enum value
      };

      const result = AgentDefinitionSchema.safeParse(agentWithWrongTypes);
      expect(result.success).toBe(false);

      console.log('✅ Schema performs strict type validation without coercion');
    });
  });

  describe('Performance with Large Data', () => {
    it('should handle validation of large agent definitions efficiently', () => {
      const largeAgent = {
        name: 'large-agent-' + 'x'.repeat(1000),
        description: 'Large agent description ' + 'y'.repeat(5000),
        prompt: 'Large prompt content ' + 'z'.repeat(100000),
        tools: Array(1000).fill('Read'),
        skills: Array(1000).fill('skill-' + 'a'.repeat(100)),
      };

      const startTime = Date.now();
      const result = AgentDefinitionSchema.safeParse(largeAgent);
      const validationTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(validationTime).toBeLessThan(100); // Should validate in under 100ms

      console.log(`⚡ Large agent validation completed in ${validationTime}ms`);
    });
  });
});