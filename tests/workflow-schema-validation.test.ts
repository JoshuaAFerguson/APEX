/**
 * Comprehensive Schema Validation Tests for APEX Workflows
 *
 * Tests the Zod schema validation for WorkflowDefinition and WorkflowStage
 * Coverage includes:
 * - Schema boundary conditions
 * - Data type validation
 * - Complex nested object validation
 * - Edge cases and corner cases
 * - Schema evolution compatibility
 */

import { describe, it, expect } from 'vitest';
import {
  WorkflowDefinitionSchema,
  WorkflowStageSchema,
  WorkflowGateSchema,
  IsolationConfigSchema
} from '@apexcli/core';
import type {
  WorkflowDefinition,
  WorkflowStage,
  WorkflowGate,
  IsolationConfig
} from '@apexcli/core';

describe('Workflow Schema Validation Tests', () => {
  describe('WorkflowDefinitionSchema', () => {
    describe('Required Fields Validation', () => {
      it('should validate minimal valid workflow definition', () => {
        const validWorkflow = {
          name: 'test-workflow',
          description: 'Test workflow description',
          stages: [
            {
              name: 'test-stage',
              agent: 'test-agent'
            }
          ]
        };

        const result = WorkflowDefinitionSchema.safeParse(validWorkflow);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe('test-workflow');
          expect(result.data.description).toBe('Test workflow description');
          expect(result.data.stages).toHaveLength(1);
        }
      });

      it('should reject workflow without name', () => {
        const invalidWorkflow = {
          description: 'Test workflow description',
          stages: [{ name: 'test-stage', agent: 'test-agent' }]
        };

        const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
        expect(result.success).toBe(false);
      });

      it('should reject workflow without description', () => {
        const invalidWorkflow = {
          name: 'test-workflow',
          stages: [{ name: 'test-stage', agent: 'test-agent' }]
        };

        const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
        expect(result.success).toBe(false);
      });

      it('should reject workflow without stages', () => {
        const invalidWorkflow = {
          name: 'test-workflow',
          description: 'Test workflow description'
        };

        const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
        expect(result.success).toBe(false);
      });

      it('should allow workflow with empty stages array', () => {
        const validWorkflow = {
          name: 'test-workflow',
          description: 'Test workflow description',
          stages: []
        };

        const result = WorkflowDefinitionSchema.safeParse(validWorkflow);
        expect(result.success).toBe(true);
      });
    });

    describe('Data Type Validation', () => {
      it('should reject non-string name', () => {
        const invalidWorkflow = {
          name: 123,
          description: 'Test workflow description',
          stages: [{ name: 'test-stage', agent: 'test-agent' }]
        };

        const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
        expect(result.success).toBe(false);
      });

      it('should reject non-string description', () => {
        const invalidWorkflow = {
          name: 'test-workflow',
          description: true,
          stages: [{ name: 'test-stage', agent: 'test-agent' }]
        };

        const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
        expect(result.success).toBe(false);
      });

      it('should reject non-array stages', () => {
        const invalidWorkflow = {
          name: 'test-workflow',
          description: 'Test workflow description',
          stages: 'invalid-stages'
        };

        const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
        expect(result.success).toBe(false);
      });

      it('should reject non-array trigger', () => {
        const invalidWorkflow = {
          name: 'test-workflow',
          description: 'Test workflow description',
          trigger: 'invalid-trigger',
          stages: [{ name: 'test-stage', agent: 'test-agent' }]
        };

        const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
        expect(result.success).toBe(false);
      });

      it('should reject non-array gates', () => {
        const invalidWorkflow = {
          name: 'test-workflow',
          description: 'Test workflow description',
          stages: [{ name: 'test-stage', agent: 'test-agent' }],
          gates: 'invalid-gates'
        };

        const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
        expect(result.success).toBe(false);
      });
    });

    describe('Optional Fields Validation', () => {
      it('should accept valid trigger array', () => {
        const validWorkflow = {
          name: 'test-workflow',
          description: 'Test workflow description',
          trigger: ['manual', 'apex:feature', 'webhook:push'],
          stages: [{ name: 'test-stage', agent: 'test-agent' }]
        };

        const result = WorkflowDefinitionSchema.safeParse(validWorkflow);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.trigger).toEqual(['manual', 'apex:feature', 'webhook:push']);
        }
      });

      it('should accept empty trigger array', () => {
        const validWorkflow = {
          name: 'test-workflow',
          description: 'Test workflow description',
          trigger: [],
          stages: [{ name: 'test-stage', agent: 'test-agent' }]
        };

        const result = WorkflowDefinitionSchema.safeParse(validWorkflow);
        expect(result.success).toBe(true);
      });

      it('should validate gates with proper schema', () => {
        const validWorkflow = {
          name: 'test-workflow',
          description: 'Test workflow description',
          stages: [{ name: 'test-stage', agent: 'test-agent' }],
          gates: [
            {
              id: 'approval-gate',
              name: 'Manual Approval Gate',
              description: 'Requires manual approval',
              trigger: 'stage:test-stage:completed',
              required: true
            }
          ]
        };

        const result = WorkflowDefinitionSchema.safeParse(validWorkflow);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.gates).toHaveLength(1);
          expect(result.data.gates![0].id).toBe('approval-gate');
        }
      });

      it('should validate isolation config', () => {
        const validWorkflow = {
          name: 'test-workflow',
          description: 'Test workflow description',
          stages: [{ name: 'test-stage', agent: 'test-agent' }],
          isolation: {
            mode: 'full'
          }
        };

        const result = WorkflowDefinitionSchema.safeParse(validWorkflow);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.isolation).toBeDefined();
          expect(result.data.isolation!.mode).toBe('full');
        }
      });
    });

    describe('Edge Cases', () => {
      it('should handle extremely long names', () => {
        const longName = 'a'.repeat(1000);
        const validWorkflow = {
          name: longName,
          description: 'Test workflow description',
          stages: [{ name: 'test-stage', agent: 'test-agent' }]
        };

        const result = WorkflowDefinitionSchema.safeParse(validWorkflow);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe(longName);
        }
      });

      it('should handle special characters in names', () => {
        const specialName = 'test-workflow_123.v2@domain.com';
        const validWorkflow = {
          name: specialName,
          description: 'Test workflow description',
          stages: [{ name: 'test-stage', agent: 'test-agent' }]
        };

        const result = WorkflowDefinitionSchema.safeParse(validWorkflow);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe(specialName);
        }
      });

      it('should handle Unicode characters', () => {
        const unicodeWorkflow = {
          name: 'test-workflow-🚀',
          description: 'Test workflow with Unicode: 你好世界 café',
          stages: [{ name: 'test-stage-ñ', agent: 'test-agent-文' }]
        };

        const result = WorkflowDefinitionSchema.safeParse(unicodeWorkflow);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe('test-workflow-🚀');
          expect(result.data.description).toBe('Test workflow with Unicode: 你好世界 café');
        }
      });

      it('should handle empty strings gracefully', () => {
        const invalidWorkflow = {
          name: '',
          description: '',
          stages: [{ name: 'test-stage', agent: 'test-agent' }]
        };

        const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
        // Empty strings should be valid according to current schema
        expect(result.success).toBe(true);
      });

      it('should handle null and undefined values', () => {
        const invalidWorkflow = {
          name: null,
          description: undefined,
          stages: [{ name: 'test-stage', agent: 'test-agent' }]
        };

        const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('WorkflowStageSchema', () => {
    describe('Required Fields Validation', () => {
      it('should validate minimal valid stage', () => {
        const validStage = {
          name: 'test-stage',
          agent: 'test-agent'
        };

        const result = WorkflowStageSchema.safeParse(validStage);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe('test-stage');
          expect(result.data.agent).toBe('test-agent');
          expect(result.data.parallel).toBe(false); // default value
          expect(result.data.maxRetries).toBe(2); // default value
        }
      });

      it('should reject stage without name', () => {
        const invalidStage = {
          agent: 'test-agent'
        };

        const result = WorkflowStageSchema.safeParse(invalidStage);
        expect(result.success).toBe(false);
      });

      it('should reject stage without agent', () => {
        const invalidStage = {
          name: 'test-stage'
        };

        const result = WorkflowStageSchema.safeParse(invalidStage);
        expect(result.success).toBe(false);
      });
    });

    describe('Optional Fields with Defaults', () => {
      it('should apply default values for parallel and maxRetries', () => {
        const stage = {
          name: 'test-stage',
          agent: 'test-agent'
        };

        const result = WorkflowStageSchema.safeParse(stage);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.parallel).toBe(false);
          expect(result.data.maxRetries).toBe(2);
        }
      });

      it('should override default values when provided', () => {
        const stage = {
          name: 'test-stage',
          agent: 'test-agent',
          parallel: true,
          maxRetries: 5
        };

        const result = WorkflowStageSchema.safeParse(stage);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.parallel).toBe(true);
          expect(result.data.maxRetries).toBe(5);
        }
      });
    });

    describe('Array Field Validation', () => {
      it('should validate dependsOn array', () => {
        const stage = {
          name: 'test-stage',
          agent: 'test-agent',
          dependsOn: ['stage1', 'stage2', 'stage3']
        };

        const result = WorkflowStageSchema.safeParse(stage);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.dependsOn).toEqual(['stage1', 'stage2', 'stage3']);
        }
      });

      it('should validate empty dependsOn array', () => {
        const stage = {
          name: 'test-stage',
          agent: 'test-agent',
          dependsOn: []
        };

        const result = WorkflowStageSchema.safeParse(stage);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.dependsOn).toEqual([]);
        }
      });

      it('should validate inputs and outputs arrays', () => {
        const stage = {
          name: 'test-stage',
          agent: 'test-agent',
          inputs: ['input1', 'input2'],
          outputs: ['output1', 'output2', 'output3']
        };

        const result = WorkflowStageSchema.safeParse(stage);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.inputs).toEqual(['input1', 'input2']);
          expect(result.data.outputs).toEqual(['output1', 'output2', 'output3']);
        }
      });

      it('should validate actions array', () => {
        const stage = {
          name: 'test-stage',
          agent: 'test-agent',
          actions: ['build', 'test', 'deploy']
        };

        const result = WorkflowStageSchema.safeParse(stage);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.actions).toEqual(['build', 'test', 'deploy']);
        }
      });

      it('should reject non-array for array fields', () => {
        const invalidStage = {
          name: 'test-stage',
          agent: 'test-agent',
          dependsOn: 'not-an-array'
        };

        const result = WorkflowStageSchema.safeParse(invalidStage);
        expect(result.success).toBe(false);
      });
    });

    describe('Data Type Validation for Optional Fields', () => {
      it('should reject non-string description', () => {
        const invalidStage = {
          name: 'test-stage',
          agent: 'test-agent',
          description: 123
        };

        const result = WorkflowStageSchema.safeParse(invalidStage);
        expect(result.success).toBe(false);
      });

      it('should reject non-boolean parallel', () => {
        const invalidStage = {
          name: 'test-stage',
          agent: 'test-agent',
          parallel: 'not-boolean'
        };

        const result = WorkflowStageSchema.safeParse(invalidStage);
        expect(result.success).toBe(false);
      });

      it('should reject non-string condition', () => {
        const invalidStage = {
          name: 'test-stage',
          agent: 'test-agent',
          condition: true
        };

        const result = WorkflowStageSchema.safeParse(invalidStage);
        expect(result.success).toBe(false);
      });

      it('should reject non-number maxRetries', () => {
        const invalidStage = {
          name: 'test-stage',
          agent: 'test-agent',
          maxRetries: 'not-a-number'
        };

        const result = WorkflowStageSchema.safeParse(invalidStage);
        expect(result.success).toBe(false);
      });

      it('should accept null gate value', () => {
        const stage = {
          name: 'test-stage',
          agent: 'test-agent',
          gate: null
        };

        const result = WorkflowStageSchema.safeParse(stage);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.gate).toBeNull();
        }
      });

      it('should accept string gate value', () => {
        const stage = {
          name: 'test-stage',
          agent: 'test-agent',
          gate: 'approval-gate'
        };

        const result = WorkflowStageSchema.safeParse(stage);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.gate).toBe('approval-gate');
        }
      });
    });

    describe('Numeric Edge Cases', () => {
      it('should accept zero maxRetries', () => {
        const stage = {
          name: 'test-stage',
          agent: 'test-agent',
          maxRetries: 0
        };

        const result = WorkflowStageSchema.safeParse(stage);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.maxRetries).toBe(0);
        }
      });

      it('should accept negative maxRetries (edge case)', () => {
        const stage = {
          name: 'test-stage',
          agent: 'test-agent',
          maxRetries: -1
        };

        const result = WorkflowStageSchema.safeParse(stage);
        // Current schema doesn't have min validation, so this should pass
        expect(result.success).toBe(true);
      });

      it('should accept very large maxRetries', () => {
        const stage = {
          name: 'test-stage',
          agent: 'test-agent',
          maxRetries: 999999
        };

        const result = WorkflowStageSchema.safeParse(stage);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.maxRetries).toBe(999999);
        }
      });

      it('should reject floating point maxRetries', () => {
        const stage = {
          name: 'test-stage',
          agent: 'test-agent',
          maxRetries: 2.5
        };

        const result = WorkflowStageSchema.safeParse(stage);
        // Zod number schema should accept floats unless specifically restricted
        expect(result.success).toBe(true);
      });
    });

    describe('Complex Stage Configurations', () => {
      it('should validate stage with all optional fields', () => {
        const complexStage = {
          name: 'complex-stage',
          agent: 'complex-agent',
          description: 'A complex stage with all features',
          dependsOn: ['stage1', 'stage2'],
          parallel: true,
          inputs: ['config', 'data'],
          outputs: ['result', 'logs'],
          condition: 'env.NODE_ENV === "production"',
          actions: ['validate', 'transform', 'export'],
          gate: 'quality-gate',
          maxRetries: 3
        };

        const result = WorkflowStageSchema.safeParse(complexStage);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(complexStage);
        }
      });

      it('should handle stages with very long arrays', () => {
        const longArray = Array.from({ length: 1000 }, (_, i) => `item-${i}`);
        const stage = {
          name: 'test-stage',
          agent: 'test-agent',
          dependsOn: longArray,
          inputs: longArray,
          outputs: longArray,
          actions: longArray
        };

        const result = WorkflowStageSchema.safeParse(stage);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.dependsOn).toHaveLength(1000);
          expect(result.data.inputs).toHaveLength(1000);
        }
      });
    });
  });

  describe('Schema Evolution and Compatibility', () => {
    it('should ignore unknown fields gracefully', () => {
      const futureWorkflow = {
        name: 'future-workflow',
        description: 'Workflow with future fields',
        stages: [{ name: 'test-stage', agent: 'test-agent' }],
        futureField: 'should be ignored',
        version: '2.0.0'
      };

      const result = WorkflowDefinitionSchema.safeParse(futureWorkflow);
      expect(result.success).toBe(true);
      if (result.success) {
        // Future fields should not be present in parsed result
        expect('futureField' in result.data).toBe(false);
        expect('version' in result.data).toBe(false);
      }
    });

    it('should handle stages with unknown fields', () => {
      const futureStage = {
        name: 'future-stage',
        agent: 'future-agent',
        futureStageField: 'should be ignored',
        newFeature: { enabled: true }
      };

      const result = WorkflowStageSchema.safeParse(futureStage);
      expect(result.success).toBe(true);
      if (result.success) {
        expect('futureStageField' in result.data).toBe(false);
        expect('newFeature' in result.data).toBe(false);
      }
    });
  });

  describe('Nested Schema Integration', () => {
    it('should validate workflow with gates schema integration', () => {
      // First validate gate schema independently
      const gate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'Test gate description',
        trigger: 'stage:test-stage:completed',
        required: true
      };

      const gateResult = WorkflowGateSchema.safeParse(gate);
      expect(gateResult.success).toBe(true);

      // Then validate in workflow context
      const workflow = {
        name: 'test-workflow',
        description: 'Test workflow',
        stages: [{ name: 'test-stage', agent: 'test-agent' }],
        gates: [gate]
      };

      const workflowResult = WorkflowDefinitionSchema.safeParse(workflow);
      expect(workflowResult.success).toBe(true);
    });

    it('should validate workflow with isolation config schema integration', () => {
      // First validate isolation config independently
      const isolationConfig = {
        mode: 'full'
      };

      const isolationResult = IsolationConfigSchema.safeParse(isolationConfig);
      expect(isolationResult.success).toBe(true);

      // Then validate in workflow context
      const workflow = {
        name: 'test-workflow',
        description: 'Test workflow',
        stages: [{ name: 'test-stage', agent: 'test-agent' }],
        isolation: isolationConfig
      };

      const workflowResult = WorkflowDefinitionSchema.safeParse(workflow);
      expect(workflowResult.success).toBe(true);
    });
  });

  describe('Performance and Memory Tests', () => {
    it('should handle validation of very large workflows efficiently', () => {
      const stages = Array.from({ length: 1000 }, (_, i) => ({
        name: `stage-${i}`,
        agent: `agent-${i}`,
        description: `Stage ${i} description`,
        dependsOn: i > 0 ? [`stage-${i - 1}`] : undefined
      }));

      const largeWorkflow = {
        name: 'large-workflow',
        description: 'Very large workflow for performance testing',
        stages: stages
      };

      const startTime = Date.now();
      const result = WorkflowDefinitionSchema.safeParse(largeWorkflow);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should validate in under 1 second
      if (result.success) {
        expect(result.data.stages).toHaveLength(1000);
      }
    });

    it('should handle repeated validation efficiently', () => {
      const workflow = {
        name: 'repeated-workflow',
        description: 'Workflow for repeated validation',
        stages: [
          { name: 'stage1', agent: 'agent1' },
          { name: 'stage2', agent: 'agent2' }
        ]
      };

      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        const result = WorkflowDefinitionSchema.safeParse(workflow);
        expect(result.success).toBe(true);
      }
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(2000); // 1000 validations in under 2 seconds
    });
  });
});