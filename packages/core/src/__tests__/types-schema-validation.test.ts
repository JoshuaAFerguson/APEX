import { describe, it, expect } from 'vitest';
import {
  AgentModelSchema,
  AgentToolSchema,
  AgentDefinitionSchema,
  WorkflowDefinitionSchema,
  ApexConfigSchema,
  TaskStatusSchema,
  PermissionLevelSchema,
  PermissionPresetSchema,
  MCPServerConfigSchema,
  ApprovalStateSchema,
  RepairLoopConfigSchema,
  AgentModel,
  AgentTool,
  TaskStatus,
  PermissionLevel,
  PermissionPreset,
  ApprovalState,
} from '../types';
import { z } from 'zod';

describe('Core Types Schema Validation', () => {
  describe('AgentModelSchema', () => {
    it('should validate valid agent models', () => {
      expect(AgentModelSchema.parse('opus')).toBe('opus');
      expect(AgentModelSchema.parse('sonnet')).toBe('sonnet');
      expect(AgentModelSchema.parse('haiku')).toBe('haiku');
      expect(AgentModelSchema.parse('inherit')).toBe('inherit');
    });

    it('should reject invalid agent models', () => {
      expect(() => AgentModelSchema.parse('invalid')).toThrow();
      expect(() => AgentModelSchema.parse('')).toThrow();
      expect(() => AgentModelSchema.parse(123)).toThrow();
      expect(() => AgentModelSchema.parse(null)).toThrow();
    });
  });

  describe('AgentToolSchema', () => {
    const validTools: AgentTool[] = [
      'Read',
      'Write',
      'Edit',
      'MultiEdit',
      'NotebookEdit',
      'Bash',
      'Grep',
      'Glob',
      'WebFetch',
      'WebSearch',
      'TodoWrite',
      'Browser',
    ];

    it('should validate all valid agent tools', () => {
      validTools.forEach(tool => {
        expect(AgentToolSchema.parse(tool)).toBe(tool);
      });
    });

    it('should reject invalid tools', () => {
      expect(() => AgentToolSchema.parse('InvalidTool')).toThrow();
      expect(() => AgentToolSchema.parse('read')).toThrow(); // case sensitive
      expect(() => AgentToolSchema.parse('')).toThrow();
      expect(() => AgentToolSchema.parse(123)).toThrow();
    });
  });

  describe('TaskStatusSchema', () => {
    const validStatuses: TaskStatus[] = [
      'pending',
      'running',
      'completed',
      'failed',
      'cancelled',
      'approval-required',
      'paused',
      'archived',
    ];

    it('should validate all valid task statuses', () => {
      validStatuses.forEach(status => {
        expect(TaskStatusSchema.parse(status)).toBe(status);
      });
    });

    it('should reject invalid statuses', () => {
      expect(() => TaskStatusSchema.parse('invalid')).toThrow();
      expect(() => TaskStatusSchema.parse('PENDING')).toThrow(); // case sensitive
      expect(() => TaskStatusSchema.parse('')).toThrow();
    });
  });

  describe('PermissionLevelSchema', () => {
    const validLevels: PermissionLevel[] = [
      'none',
      'ask',
      'notify',
      'auto',
    ];

    it('should validate all valid permission levels', () => {
      validLevels.forEach(level => {
        expect(PermissionLevelSchema.parse(level)).toBe(level);
      });
    });

    it('should reject invalid permission levels', () => {
      expect(() => PermissionLevelSchema.parse('invalid')).toThrow();
      expect(() => PermissionLevelSchema.parse('AUTO')).toThrow();
      expect(() => PermissionLevelSchema.parse('')).toThrow();
    });
  });

  describe('PermissionPresetSchema', () => {
    const validPresets: PermissionPreset[] = [
      'locked-down',
      'cautious',
      'balanced',
      'trusting',
      'autonomous',
    ];

    it('should validate all valid permission presets', () => {
      validPresets.forEach(preset => {
        expect(PermissionPresetSchema.parse(preset)).toBe(preset);
      });
    });

    it('should reject invalid permission presets', () => {
      expect(() => PermissionPresetSchema.parse('invalid')).toThrow();
      expect(() => PermissionPresetSchema.parse('BALANCED')).toThrow();
      expect(() => PermissionPresetSchema.parse('')).toThrow();
    });
  });

  describe('ApprovalStateSchema', () => {
    const validStates: ApprovalState[] = [
      'pending',
      'approved',
      'denied',
    ];

    it('should validate all valid approval states', () => {
      validStates.forEach(state => {
        expect(ApprovalStateSchema.parse(state)).toBe(state);
      });
    });

    it('should reject invalid approval states', () => {
      expect(() => ApprovalStateSchema.parse('invalid')).toThrow();
      expect(() => ApprovalStateSchema.parse('APPROVED')).toThrow();
      expect(() => ApprovalStateSchema.parse('')).toThrow();
    });
  });

  describe('AgentDefinitionSchema', () => {
    it('should validate a valid agent definition', () => {
      const validAgent = {
        name: 'test-agent',
        description: 'A test agent for validation',
        prompt: 'You are a helpful assistant.',
        tools: ['Read', 'Write'] as AgentTool[],
        model: 'sonnet' as AgentModel,
      };

      const result = AgentDefinitionSchema.parse(validAgent);
      expect(result.name).toBe('test-agent');
      expect(result.tools).toEqual(['Read', 'Write']);
      expect(result.model).toBe('sonnet');
    });

    it('should handle optional fields', () => {
      const minimalAgent = {
        name: 'minimal-agent',
        description: 'A minimal agent',
        prompt: 'You are helpful.',
        tools: ['Read'] as AgentTool[],
      };

      const result = AgentDefinitionSchema.parse(minimalAgent);
      expect(result.name).toBe('minimal-agent');
      expect(result.model).toBeUndefined();
    });

    it('should reject invalid agent definitions', () => {
      expect(() => AgentDefinitionSchema.parse({
        // missing required fields
        name: 'incomplete',
      })).toThrow();

      expect(() => AgentDefinitionSchema.parse({
        name: 'invalid-tools',
        description: 'Test',
        prompt: 'Test',
        tools: ['InvalidTool'], // invalid tool
      })).toThrow();

      expect(() => AgentDefinitionSchema.parse({
        name: '', // empty name
        description: 'Test',
        prompt: 'Test',
        tools: ['Read'],
      })).toThrow();
    });
  });

  describe('WorkflowDefinitionSchema', () => {
    it('should validate a valid workflow definition', () => {
      const validWorkflow = {
        name: 'test-workflow',
        description: 'A test workflow',
        stages: [
          {
            name: 'planning',
            agent: 'planner',
            description: 'Plan the work',
          },
          {
            name: 'implementation',
            agent: 'developer',
            description: 'Implement the solution',
          },
        ],
      };

      const result = WorkflowDefinitionSchema.parse(validWorkflow);
      expect(result.name).toBe('test-workflow');
      expect(result.stages).toHaveLength(2);
    });

    it('should handle workflow with gates', () => {
      const workflowWithGates = {
        name: 'gated-workflow',
        description: 'A workflow with gates',
        stages: [
          {
            name: 'stage1',
            agent: 'agent1',
            description: 'First stage',
          },
        ],
        gates: [
          {
            type: 'approval' as const,
            stage: 'stage1',
            message: 'Please approve this stage',
          },
        ],
      };

      const result = WorkflowDefinitionSchema.parse(workflowWithGates);
      expect(result.gates).toHaveLength(1);
      expect(result.gates![0].type).toBe('approval');
    });

    it('should reject invalid workflow definitions', () => {
      expect(() => WorkflowDefinitionSchema.parse({
        name: 'invalid',
        description: 'Test',
        stages: [], // empty stages array
      })).toThrow();

      expect(() => WorkflowDefinitionSchema.parse({
        name: '',
        description: 'Test',
        stages: [{ name: 'test', agent: 'test', description: 'test' }],
      })).toThrow();
    });
  });

  describe('MCPServerConfigSchema', () => {
    it('should validate valid MCP server configurations', () => {
      const validConfig = {
        command: 'node',
        args: ['server.js'],
      };

      const result = MCPServerConfigSchema.parse(validConfig);
      expect(result.command).toBe('node');
      expect(result.args).toEqual(['server.js']);
    });

    it('should handle optional fields', () => {
      const configWithEnv = {
        command: 'python',
        args: ['-m', 'server'],
        env: {
          NODE_ENV: 'production',
        },
      };

      const result = MCPServerConfigSchema.parse(configWithEnv);
      expect(result.env).toEqual({ NODE_ENV: 'production' });
    });

    it('should reject invalid MCP configs', () => {
      expect(() => MCPServerConfigSchema.parse({
        // missing command
        args: ['test'],
      })).toThrow();

      expect(() => MCPServerConfigSchema.parse({
        command: '', // empty command
        args: ['test'],
      })).toThrow();
    });
  });

  describe('RepairLoopConfigSchema', () => {
    it('should validate valid repair loop configuration', () => {
      const validConfig = {
        maxAttempts: 3,
        backoffMultiplier: 2,
        initialDelayMs: 1000,
      };

      const result = RepairLoopConfigSchema.parse(validConfig);
      expect(result.maxAttempts).toBe(3);
      expect(result.backoffMultiplier).toBe(2);
    });

    it('should handle default values', () => {
      const minimal = {};
      const result = RepairLoopConfigSchema.parse(minimal);
      // Should not throw and should have defaults applied
      expect(typeof result.maxAttempts).toBe('undefined'); // Optional field
    });

    it('should reject invalid values', () => {
      expect(() => RepairLoopConfigSchema.parse({
        maxAttempts: -1, // negative value
      })).toThrow();

      expect(() => RepairLoopConfigSchema.parse({
        maxAttempts: 'invalid', // wrong type
      })).toThrow();
    });
  });

  describe('ApexConfigSchema', () => {
    it('should validate a minimal valid config', () => {
      const minimalConfig = {
        autonomyLevel: 'balanced' as const,
        maxConcurrentTasks: 2,
        limits: {
          maxTokens: 100000,
          maxCost: 10.0,
          maxDuration: 3600000,
        },
        permissions: {
          filesystem: {
            allowedPaths: ['/tmp'],
            deniedPaths: [],
          },
        },
      };

      const result = ApexConfigSchema.parse(minimalConfig);
      expect(result.autonomyLevel).toBe('balanced');
      expect(result.maxConcurrentTasks).toBe(2);
    });

    it('should handle complex config with all optional fields', () => {
      const complexConfig = {
        autonomyLevel: 'autonomous' as const,
        maxConcurrentTasks: 5,
        limits: {
          maxTokens: 200000,
          maxCost: 50.0,
          maxDuration: 7200000,
        },
        permissions: {
          filesystem: {
            allowedPaths: ['/workspace', '/tmp'],
            deniedPaths: ['/etc', '/root'],
          },
        },
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['server.js'],
          },
        },
        repairLoop: {
          maxAttempts: 5,
          backoffMultiplier: 1.5,
        },
      };

      const result = ApexConfigSchema.parse(complexConfig);
      expect(result.mcpServers).toBeDefined();
      expect(result.repairLoop).toBeDefined();
    });

    it('should reject invalid apex configurations', () => {
      expect(() => ApexConfigSchema.parse({
        // missing required fields
        autonomyLevel: 'balanced',
      })).toThrow();

      expect(() => ApexConfigSchema.parse({
        autonomyLevel: 'invalid', // invalid autonomy level
        maxConcurrentTasks: 1,
        limits: { maxTokens: 1000, maxCost: 1, maxDuration: 1000 },
        permissions: { filesystem: { allowedPaths: [], deniedPaths: [] } },
      })).toThrow();
    });
  });

  describe('Edge Cases and Type Safety', () => {
    it('should handle null and undefined properly', () => {
      expect(() => AgentModelSchema.parse(null)).toThrow();
      expect(() => AgentModelSchema.parse(undefined)).toThrow();
      expect(() => AgentToolSchema.parse(null)).toThrow();
      expect(() => TaskStatusSchema.parse(undefined)).toThrow();
    });

    it('should handle empty strings properly', () => {
      expect(() => AgentModelSchema.parse('')).toThrow();
      expect(() => AgentToolSchema.parse('')).toThrow();
      expect(() => TaskStatusSchema.parse('')).toThrow();
      expect(() => PermissionLevelSchema.parse('')).toThrow();
    });

    it('should handle array validation', () => {
      const validTools: AgentTool[] = ['Read', 'Write', 'Edit'];
      const schema = z.array(AgentToolSchema);

      expect(schema.parse(validTools)).toEqual(validTools);
      expect(() => schema.parse(['Read', 'InvalidTool'])).toThrow();
      expect(() => schema.parse([])).not.toThrow(); // Empty array is valid
    });

    it('should handle optional vs required field validation', () => {
      // Test that required fields throw when missing
      expect(() => AgentDefinitionSchema.parse({
        description: 'Test',
        prompt: 'Test',
        tools: ['Read'],
        // name is missing
      })).toThrow();

      // Test that optional fields don't throw when missing
      expect(() => AgentDefinitionSchema.parse({
        name: 'test',
        description: 'Test',
        prompt: 'Test',
        tools: ['Read'],
        // model is optional
      })).not.toThrow();
    });
  });
});