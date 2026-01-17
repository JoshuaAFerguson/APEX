import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';
import { WorkflowDefinitionSchema } from '../types';

describe('TDD Workflow YAML Validation', () => {
  const templatePath = path.join(__dirname, '../../templates/workflows/tdd.yaml');

  describe('YAML Syntax', () => {
    it('should parse as valid YAML without syntax errors', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');

      expect(() => {
        yaml.parse(content);
      }).not.toThrow();
    });

    it('should have proper YAML indentation and structure', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');
      const lines = content.split('\n');

      // Check for consistent indentation (should be 2 spaces)
      const indentedLines = lines.filter(line => line.startsWith(' '));
      for (const line of indentedLines) {
        const leadingSpaces = line.match(/^ */)?.[0].length || 0;
        // Should be multiples of 2
        expect(leadingSpaces % 2).toBe(0);
      }
    });

    it('should not contain tabs or mixed indentation', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should not contain tab characters
      expect(content).not.toContain('\t');

      // Check for mixed indentation patterns
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.trim().length === 0) continue; // Skip empty lines

        const leadingWhitespace = line.match(/^[ ]*/)?.[0] || '';
        // Should only contain spaces, no other whitespace
        expect(leadingWhitespace).toMatch(/^ *$/);
      }
    });
  });

  describe('YAML Structure Validation', () => {
    let parsedYaml: any;

    beforeEach(async () => {
      const content = await fs.readFile(templatePath, 'utf-8');
      parsedYaml = yaml.parse(content);
    });

    it('should have all required top-level properties', () => {
      expect(parsedYaml).toHaveProperty('name');
      expect(parsedYaml).toHaveProperty('description');
      expect(parsedYaml).toHaveProperty('trigger');
      expect(parsedYaml).toHaveProperty('stages');
    });

    it('should have proper data types for all properties', () => {
      expect(typeof parsedYaml.name).toBe('string');
      expect(typeof parsedYaml.description).toBe('string');
      expect(Array.isArray(parsedYaml.trigger)).toBe(true);
      expect(Array.isArray(parsedYaml.stages)).toBe(true);
    });

    it('should have valid trigger array with string elements', () => {
      expect(parsedYaml.trigger.length).toBeGreaterThan(0);
      parsedYaml.trigger.forEach((trigger: any) => {
        expect(typeof trigger).toBe('string');
        expect(trigger.length).toBeGreaterThan(0);
      });
    });

    it('should have stages array with proper stage objects', () => {
      expect(parsedYaml.stages.length).toBeGreaterThan(0);

      parsedYaml.stages.forEach((stage: any) => {
        expect(stage).toHaveProperty('name');
        expect(stage).toHaveProperty('agent');
        expect(stage).toHaveProperty('description');
        expect(stage).toHaveProperty('outputs');

        expect(typeof stage.name).toBe('string');
        expect(typeof stage.agent).toBe('string');
        expect(typeof stage.description).toBe('string');
        expect(Array.isArray(stage.outputs)).toBe(true);
      });
    });

    it('should have valid dependsOn arrays where present', () => {
      parsedYaml.stages.forEach((stage: any) => {
        if (stage.dependsOn) {
          expect(Array.isArray(stage.dependsOn)).toBe(true);
          stage.dependsOn.forEach((dep: any) => {
            expect(typeof dep).toBe('string');
          });
        }
      });
    });
  });

  describe('Schema Compliance', () => {
    it('should pass WorkflowDefinitionSchema validation', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');
      const workflow = yaml.parse(content);

      const result = WorkflowDefinitionSchema.safeParse(workflow);

      if (!result.success) {
        console.error('Schema validation errors:');
        result.error.issues.forEach(issue => {
          console.error(`  ${issue.path.join('.')}: ${issue.message}`);
        });
      }

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should have valid stage dependency references', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');
      const workflow = yaml.parse(content);

      const stageNames = new Set(workflow.stages.map((s: any) => s.name));

      workflow.stages.forEach((stage: any) => {
        if (stage.dependsOn) {
          stage.dependsOn.forEach((dependency: string) => {
            expect(stageNames.has(dependency)).toBe(true);
          });
        }
      });
    });

    it('should have unique stage names', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');
      const workflow = yaml.parse(content);

      const stageNames = workflow.stages.map((s: any) => s.name);
      const uniqueNames = new Set(stageNames);

      expect(stageNames.length).toBe(uniqueNames.size);
    });
  });

  describe('TDD-Specific Structure', () => {
    let workflow: any;

    beforeEach(async () => {
      const content = await fs.readFile(templatePath, 'utf-8');
      workflow = yaml.parse(content);
    });

    it('should have correct TDD workflow name and triggers', () => {
      expect(workflow.name).toBe('tdd');
      expect(workflow.trigger).toContain('apex:tdd');
      expect(workflow.trigger).toContain('apex:test-driven');
    });

    it('should have exactly 5 TDD stages in correct order', () => {
      const expectedStages = [
        'planning',
        'test-first',
        'implementation',
        'refactor',
        'verification'
      ];

      const actualStages = workflow.stages.map((s: any) => s.name);
      expect(actualStages).toEqual(expectedStages);
    });

    it('should use correct agents for TDD methodology', () => {
      const stageAgentMapping = {
        'planning': 'planner',
        'test-first': 'tdd-tester',
        'implementation': 'tdd-developer',
        'refactor': 'developer',
        'verification': 'tdd-tester'
      };

      workflow.stages.forEach((stage: any) => {
        const expectedAgent = stageAgentMapping[stage.name as keyof typeof stageAgentMapping];
        expect(stage.agent).toBe(expectedAgent);
      });
    });

    it('should have proper Red-Green-Refactor cycle dependencies', () => {
      const stages = workflow.stages;

      // Planning should be independent
      const planning = stages.find((s: any) => s.name === 'planning');
      expect(planning.dependsOn).toBeUndefined();

      // Test-first (RED) depends on planning
      const testFirst = stages.find((s: any) => s.name === 'test-first');
      expect(testFirst.dependsOn).toEqual(['planning']);

      // Implementation (GREEN) depends on test-first
      const implementation = stages.find((s: any) => s.name === 'implementation');
      expect(implementation.dependsOn).toEqual(['test-first']);

      // Refactor depends on implementation
      const refactor = stages.find((s: any) => s.name === 'refactor');
      expect(refactor.dependsOn).toEqual(['implementation']);

      // Verification depends on refactor
      const verification = stages.find((s: any) => s.name === 'verification');
      expect(verification.dependsOn).toEqual(['refactor']);
    });

    it('should have appropriate outputs for each TDD stage', () => {
      const expectedOutputs = {
        'planning': ['implementation_plan', 'test_scenarios', 'acceptance_criteria'],
        'test-first': ['test_files', 'test_requirements', 'failure_confirmation'],
        'implementation': ['code_changes', 'implementation_notes', 'branch_name'],
        'refactor': ['refactored_code', 'design_improvements', 'refactor_notes'],
        'verification': ['final_test_results', 'coverage_report', 'quality_metrics']
      };

      workflow.stages.forEach((stage: any) => {
        const expected = expectedOutputs[stage.name as keyof typeof expectedOutputs];
        expect(stage.outputs).toEqual(expected);
      });
    });

    it('should have meaningful stage descriptions', () => {
      const requiredPhrases = {
        'planning': ['Plan', 'TDD', 'implementation approach'],
        'test-first': ['Write failing test', 'Red phase'],
        'implementation': ['minimal code', 'make tests pass', 'Green phase'],
        'refactor': ['Improve code design', 'keeping tests green', 'Refactor phase'],
        'verification': ['Run full test suite', 'validate final implementation']
      };

      workflow.stages.forEach((stage: any) => {
        const phrases = requiredPhrases[stage.name as keyof typeof requiredPhrases];
        phrases.forEach(phrase => {
          expect(stage.description).toContain(phrase);
        });
      });
    });
  });

  describe('YAML Best Practices', () => {
    it('should use consistent key ordering', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');
      const lines = content.split('\n');

      // Check that stages have consistent property ordering
      const stageBlocks: string[][] = [];
      let currentBlock: string[] = [];
      let inStage = false;

      for (const line of lines) {
        if (line.trim().startsWith('- name:')) {
          if (currentBlock.length > 0) {
            stageBlocks.push([...currentBlock]);
          }
          currentBlock = [line];
          inStage = true;
        } else if (inStage && line.trim().length > 0 && !line.startsWith(' ')) {
          stageBlocks.push([...currentBlock]);
          currentBlock = [];
          inStage = false;
        } else if (inStage) {
          currentBlock.push(line);
        }
      }

      if (currentBlock.length > 0) {
        stageBlocks.push(currentBlock);
      }

      // Each stage should have consistent property ordering
      const expectedOrder = ['name', 'agent', 'description', 'dependsOn', 'outputs'];

      stageBlocks.forEach((block, index) => {
        const properties: string[] = [];
        block.forEach(line => {
          const match = line.match(/^\s*-?\s*(\w+):/);
          if (match && match[1] !== 'name' && expectedOrder.includes(match[1])) {
            properties.push(match[1]);
          }
        });

        // Check that properties appear in expected order (allowing for optional properties)
        let lastSeenIndex = -1;
        properties.forEach(prop => {
          const currentIndex = expectedOrder.indexOf(prop);
          expect(currentIndex).toBeGreaterThan(lastSeenIndex);
          lastSeenIndex = currentIndex;
        });
      });
    });

    it('should use proper YAML scalar formatting', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should not have unnecessary quotes around simple strings
      expect(content).not.toMatch(/"(planning|implementation|tdd)"/);

      // Should use consistent array formatting
      const arrayPattern = /:\s*\[\s*[^\]]+\s*\]/;
      const lines = content.split('\n');
      const arrayLines = lines.filter(line => arrayPattern.test(line));

      arrayLines.forEach(line => {
        // Arrays should have proper spacing
        expect(line).not.toMatch(/:\[/); // Should have space after colon
        expect(line).not.toMatch(/,\]/); // Should not have trailing comma
      });
    });

    it('should have consistent string formatting', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');
      const lines = content.split('\n');

      // Descriptions should be properly formatted
      const descriptionLines = lines.filter(line => line.includes('description:'));

      descriptionLines.forEach(line => {
        const descMatch = line.match(/description:\s*(.+)/);
        if (descMatch) {
          const desc = descMatch[1];
          // Should start with capital letter
          expect(desc).toMatch(/^[A-Z]/);
          // Should not be unnecessarily quoted if it's a simple string
          if (!desc.includes(':') && !desc.includes('#')) {
            expect(desc).not.toMatch(/^["']/);
          }
        }
      });
    });
  });

  describe('File Content Validation', () => {
    it('should not contain TODO comments or placeholder text', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');

      expect(content.toLowerCase()).not.toContain('todo');
      expect(content.toLowerCase()).not.toContain('fixme');
      expect(content.toLowerCase()).not.toContain('placeholder');
      expect(content.toLowerCase()).not.toContain('example');
      expect(content.toLowerCase()).not.toContain('replace');
    });

    it('should have proper line endings', async () => {
      const buffer = await fs.readFile(templatePath);
      const content = buffer.toString();

      // Should use Unix-style line endings
      expect(content).not.toContain('\r\n'); // No Windows CRLF
      expect(content).not.toContain('\r'); // No Mac CR
    });

    it('should not have trailing whitespace', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Skip the last line if it's empty (acceptable)
        if (index === lines.length - 1 && line.length === 0) return;

        expect(line).not.toMatch(/\s+$/);
      });
    });

    it('should end with single newline', async () => {
      const buffer = await fs.readFile(templatePath);
      const content = buffer.toString();

      expect(content.endsWith('\n')).toBe(true);
      expect(content.endsWith('\n\n')).toBe(false);
    });
  });
});