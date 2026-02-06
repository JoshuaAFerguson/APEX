/**
 * @fileoverview Additional validation tests specifically for WorkflowDefinitionSchema
 *
 * This test file focuses on comprehensive validation of WorkflowDefinitionSchema
 * to ensure all JSDoc-documented features work correctly in isolation.
 */

import { describe, it, expect } from 'vitest';
import { WorkflowDefinitionSchema, type WorkflowDefinition } from '../types';

describe('WorkflowDefinitionSchema Validation', () => {
  describe('schema parsing and validation', () => {
    it('should parse minimal valid workflow', () => {
      const minimal = {
        name: 'test-workflow',
        description: 'Test description',
        stages: [
          {
            name: 'test-stage',
            agent: 'test-agent',
          },
        ],
      };

      const result = WorkflowDefinitionSchema.safeParse(minimal);
      expect(result.success).toBe(true);
    });

    it('should reject invalid workflow structure', () => {
      const invalid = {
        name: '',
        description: 'Test description',
        stages: [],
      };

      const result = WorkflowDefinitionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should validate complex workflow with all features', () => {
      const complex: WorkflowDefinition = {
        name: 'complex-workflow',
        description: 'Complex test workflow',
        trigger: ['pr:opened', 'manual'],
        stages: [
          {
            name: 'build',
            agent: 'builder',
            description: 'Build the application',
            outputs: ['artifacts'],
          },
          {
            name: 'test',
            agent: 'tester',
            dependsOn: ['build'],
            inputs: ['artifacts'],
            outputs: ['test-results'],
            gate: 'approval-gate',
          },
        ],
        gates: [
          {
            id: 'approval-gate',
            trigger: 'stage:test:completed',
            required: true,
          },
        ],
        isolation: {
          mode: 'process',
          cleanupOnComplete: true,
        },
      };

      const result = WorkflowDefinitionSchema.safeParse(complex);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stages).toHaveLength(2);
        expect(result.data.gates).toHaveLength(1);
        expect(result.data.trigger).toHaveLength(2);
      }
    });
  });

  describe('type inference', () => {
    it('should infer correct TypeScript types', () => {
      const workflow: WorkflowDefinition = {
        name: 'type-test',
        description: 'Type inference test',
        stages: [{ name: 'test', agent: 'test' }],
      };

      // TypeScript compilation validates these types
      expect(typeof workflow.name).toBe('string');
      expect(typeof workflow.description).toBe('string');
      expect(Array.isArray(workflow.stages)).toBe(true);
    });
  });
});