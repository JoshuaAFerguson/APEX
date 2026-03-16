import { describe, it, expect, vi } from 'vitest';
import {
  workflowToYaml,
  yamlToWorkflow,
  validateYamlSyntax,
  formatYaml,
  createYamlDownload,
  extractWorkflowMetadata,
} from '../serialization';
import type { WorkflowDefinition } from '@apexcli/core';

describe('serialization', () => {
  const mockWorkflow: WorkflowDefinition = {
    name: 'Test Workflow',
    description: 'A test workflow for serialization testing',
    stages: [
      {
        name: 'planning',
        agent: 'planner',
        description: 'Plan the implementation',
      },
      {
        name: 'development',
        agent: 'developer',
        description: 'Implement the feature',
        dependsOn: ['planning'],
        gate: {
          id: 'code-review',
          name: 'code-review',
          trigger: 'after_stage',
          approvers: ['senior-dev'],
        },
      },
      {
        name: 'testing',
        agent: 'tester',
        description: 'Test the implementation',
        dependsOn: ['development'],
      },
    ],
    gates: [
      {
        id: 'security-review',
        name: 'security-review',
        trigger: 'after_workflow',
        approvers: ['security-team'],
      },
    ],
  };

  describe('workflowToYaml', () => {
    it('converts workflow definition to YAML string', () => {
      const yaml = workflowToYaml(mockWorkflow);

      expect(yaml).toContain('"Test Workflow"');
      expect(yaml).toContain('A test workflow for serialization testing');
      expect(yaml).toContain('stages:');
      expect(yaml).toContain('"planning"');
      expect(yaml).toContain('"planner"');
    });

    it('handles workflows with dependencies', () => {
      const yaml = workflowToYaml(mockWorkflow);

      expect(yaml).toContain('"development"');
      expect(yaml).toContain('dependsOn:');
      expect(yaml).toContain('"planning"');
    });

    it('includes gates in YAML output', () => {
      const yaml = workflowToYaml(mockWorkflow);

      expect(yaml).toContain('gates:');
      expect(yaml).toContain('code-review');
      expect(yaml).toContain('approval');
      expect(yaml).toContain('senior-dev');
    });

    it('handles empty workflows', () => {
      const emptyWorkflow: WorkflowDefinition = {
        name: '',
        description: '',
        stages: [],
        gates: [],
      };

      const yaml = workflowToYaml(emptyWorkflow);

      expect(yaml).toContain('stages: []');
      expect(yaml).toContain('gates: []');
    });

    it('escapes special characters properly', () => {
      const workflowWithSpecialChars: WorkflowDefinition = {
        name: 'Workflow with "quotes" and special: chars',
        description: 'Description with\nmultiple lines',
        stages: [
          {
            name: 'stage-with-special@chars',
            agent: 'agent',
            description: 'Stage with special chars: @#$%',
            dependencies: [],
            gates: [],
          },
        ],
        gates: [],
      };

      const yaml = workflowToYaml(workflowWithSpecialChars);

      // Should not throw errors and should escape properly
      expect(yaml).toBeTruthy();
      expect(yaml).toContain('stage-with-special@chars');
    });
  });

  describe('yamlToWorkflow', () => {
    it('parses valid YAML to workflow definition', () => {
      const yaml = `
name: Parsed Workflow
description: A workflow parsed from YAML
stages:
  - name: stage1
    agent: agent1
    description: First stage
    dependencies: []
    gates: []
  - name: stage2
    agent: agent2
    description: Second stage
    dependencies:
      - stage1
    gates:
      - name: gate1
        type: approval
        approvers:
          - approver1
gates:
  - name: global-gate
    type: manual
    approvers: []
      `;

      const workflow = yamlToWorkflow(yaml);

      expect(workflow.name).toBe('Parsed Workflow');
      expect(workflow.description).toBe('A workflow parsed from YAML');
      expect(workflow.stages).toHaveLength(2);
      expect(workflow.stages[0].name).toBe('stage1');
      expect(workflow.stages[1].dependencies).toEqual(['stage1']);
      expect(workflow.gates).toHaveLength(1);
    });

    it('throws error for invalid YAML syntax', () => {
      const invalidYaml = `
name: Invalid Workflow
stages:
  - name: stage1
    agent: agent1
    description: Missing closing quote"
    dependencies: []
      `;

      expect(() => yamlToWorkflow(invalidYaml)).toThrow();
    });

    it('validates required fields', () => {
      const yamlMissingFields = `
name: Incomplete Workflow
stages:
  - name: stage1
    # Missing agent field
    description: Stage without agent
    dependencies: []
      `;

      expect(() => yamlToWorkflow(yamlMissingFields)).toThrow();
    });

    it('handles minimal valid workflows', () => {
      const minimalYaml = `
name: Minimal Workflow
description: ""
stages: []
gates: []
      `;

      const workflow = yamlToWorkflow(minimalYaml);

      expect(workflow.name).toBe('Minimal Workflow');
      expect(workflow.stages).toEqual([]);
      expect(workflow.gates).toEqual([]);
    });
  });

  describe('validateYamlSyntax', () => {
    it('returns true for valid YAML', () => {
      const validYaml = `
name: Valid Workflow
description: This is valid
stages: []
      `;

      expect(validateYamlSyntax(validYaml)).toBe(true);
    });

    it('returns false for invalid YAML', () => {
      const invalidYaml = `
name: Invalid Workflow
stages:
  - name: "unclosed quote
      `;

      expect(validateYamlSyntax(invalidYaml)).toBe(false);
    });

    it('handles empty input', () => {
      expect(validateYamlSyntax('')).toBe(true);
      expect(validateYamlSyntax('   ')).toBe(true);
    });
  });

  describe('formatYaml', () => {
    it('formats unformatted YAML', () => {
      const unformattedYaml = 'name:Test Workflow\nstages:[{name:stage1,agent:agent1}]';

      const formatted = formatYaml(unformattedYaml);

      expect(formatted).toContain('name: Test Workflow');
      expect(formatted).toMatch(/stages:\s*\n/);
    });

    it('preserves already formatted YAML', () => {
      const formattedYaml = `
name: Well Formatted
description: Already good
stages:
  - name: stage1
    agent: agent1
      `;

      const result = formatYaml(formattedYaml);

      expect(result).toContain('name: Well Formatted');
      expect(result).toContain('  - name: stage1');
    });

    it('handles formatting errors gracefully', () => {
      const invalidYaml = 'invalid: yaml: syntax: [[[';

      // Should not throw, should return original or empty string
      const result = formatYaml(invalidYaml);
      expect(typeof result).toBe('string');
    });
  });

  describe('createYamlDownload', () => {
    beforeEach(() => {
      // Mock URL.createObjectURL and revokeObjectURL
      global.URL = {
        createObjectURL: vi.fn(() => 'blob:mock-url'),
        revokeObjectURL: vi.fn(),
      } as any;

      // Mock document.createElement
      global.document = {
        ...document,
        createElement: vi.fn((tag: string) => {
          if (tag === 'a') {
            return {
              href: '',
              download: '',
              click: vi.fn(),
              style: {},
            };
          }
          return document.createElement(tag);
        }),
      } as any;
    });

    it('creates downloadable YAML file', () => {
      const yaml = 'name: Test Workflow\nstages: []';
      const filename = 'test-workflow.yaml';

      createYamlDownload(yaml, filename);

      expect(global.URL.createObjectURL).toHaveBeenCalledWith(
        expect.any(Blob)
      );
      expect(document.createElement).toHaveBeenCalledWith('a');
    });

    it('uses default filename when not provided', () => {
      const yaml = 'name: Test Workflow\nstages: []';

      createYamlDownload(yaml);

      expect(document.createElement).toHaveBeenCalledWith('a');
    });

    it('handles empty YAML content', () => {
      createYamlDownload('');

      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  describe('extractWorkflowMetadata', () => {
    it('extracts basic metadata from workflow', () => {
      const metadata = extractWorkflowMetadata(mockWorkflow);

      expect(metadata.name).toBe('Test Workflow');
      expect(metadata.description).toBe('A test workflow for serialization testing');
      expect(metadata.stageCount).toBe(3);
      expect(metadata.gateCount).toBe(1);
    });

    it('handles workflows with no stages or gates', () => {
      const emptyWorkflow: WorkflowDefinition = {
        name: 'Empty Workflow',
        description: 'No stages or gates',
        stages: [],
        gates: [],
      };

      const metadata = extractWorkflowMetadata(emptyWorkflow);

      expect(metadata.stageCount).toBe(0);
      expect(metadata.gateCount).toBe(0);
    });

    it('extracts dependency information', () => {
      const metadata = extractWorkflowMetadata(mockWorkflow);

      expect(metadata.hasDependencies).toBe(true);
      expect(metadata.hasGates).toBe(true);
    });

    it('identifies unique agents', () => {
      const metadata = extractWorkflowMetadata(mockWorkflow);

      expect(metadata.agents).toEqual(['planner', 'developer', 'tester']);
    });

    it('calculates complexity metrics', () => {
      const metadata = extractWorkflowMetadata(mockWorkflow);

      expect(metadata.complexity).toBeDefined();
      expect(metadata.complexity).toBeGreaterThan(0);
    });
  });

  describe('round-trip conversion', () => {
    it('maintains workflow integrity through YAML conversion', () => {
      const yaml = workflowToYaml(mockWorkflow);
      const parsedWorkflow = yamlToWorkflow(yaml);

      expect(parsedWorkflow.name).toBe(mockWorkflow.name);
      expect(parsedWorkflow.description).toBe(mockWorkflow.description);
      expect(parsedWorkflow.stages).toHaveLength(mockWorkflow.stages.length);
      expect(parsedWorkflow.gates).toHaveLength(mockWorkflow.gates.length);

      // Check stage details
      expect(parsedWorkflow.stages[0].name).toBe('planning');
      expect(parsedWorkflow.stages[1].dependencies).toEqual(['planning']);
    });

    it('preserves complex workflow structures', () => {
      const complexWorkflow: WorkflowDefinition = {
        name: 'Complex Workflow',
        description: 'A complex workflow with multiple dependencies and gates',
        stages: Array.from({ length: 10 }, (_, i) => ({
          name: `stage${i}`,
          agent: `agent${i % 3}`,
          description: `Stage ${i} description`,
          dependencies: i > 0 ? [`stage${i - 1}`] : [],
          gates: i % 3 === 0 ? [{
            name: `gate${i}`,
            type: 'approval' as const,
            approvers: [`approver${i}`],
          }] : [],
        })),
        gates: [],
      };

      const yaml = workflowToYaml(complexWorkflow);
      const parsed = yamlToWorkflow(yaml);

      expect(parsed.stages).toHaveLength(10);
      expect(parsed.stages[5].dependencies).toEqual(['stage4']);
      expect(parsed.stages[6].gates).toHaveLength(1);
    });
  });
});