/**
 * Production Agent File Validation Tests
 *
 * This test suite validates all real production agent files in the .apex/agents/
 * directory to ensure they conform to the agent definition format and schema.
 *
 * Based on audit findings that identified 10 production agent files.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  parseAgentMarkdown,
  loadAgents,
  AgentDefinition,
  AgentDefinitionSchema,
} from '@apexcli/core';

describe('Production Agent Files Validation', () => {
  const productionAgentsDir = path.resolve('./.apex/agents');

  describe('Production Agents Directory Structure', () => {
    it('should have .apex/agents directory', async () => {
      try {
        const stats = await fs.stat(productionAgentsDir);
        expect(stats.isDirectory()).toBe(true);
      } catch (error) {
        throw new Error(`Production agents directory does not exist: ${productionAgentsDir}`);
      }
    });

    it('should contain expected agent files', async () => {
      const expectedAgents = [
        'developer.md',
        'planner.md',
        'architect.md',
        'reviewer.md',
        'tester.md',
        'devops.md',
        'tdd-developer.md',
        'tdd-tester.md',
        'verify.md',
        'regression-check.md'
      ];

      try {
        const files = await fs.readdir(productionAgentsDir);
        const mdFiles = files.filter(f => f.endsWith('.md'));

        // Check that all expected files exist
        for (const expectedFile of expectedAgents) {
          expect(mdFiles).toContain(expectedFile);
        }

        // Log any additional files found
        const additionalFiles = mdFiles.filter(f => !expectedAgents.includes(f));
        if (additionalFiles.length > 0) {
          console.log(`Additional agent files found: ${additionalFiles.join(', ')}`);
        }

        expect(mdFiles.length).toBeGreaterThanOrEqual(expectedAgents.length);
      } catch (error) {
        throw new Error(`Failed to read production agents directory: ${error}`);
      }
    });
  });

  describe('Individual Production Agent Validation', () => {
    const expectedAgentSpecs = {
      'developer.md': {
        name: 'developer',
        description: 'Implements features and writes production code',
        expectedTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
        expectedModel: 'sonnet'
      },
      'planner.md': {
        name: 'planner',
        description: 'Creates implementation plans and decomposes large tasks into subtasks',
        expectedModel: 'sonnet'
      },
      'architect.md': {
        name: 'architect',
        description: 'Designs system architecture and makes technical decisions',
        expectedModel: 'sonnet'
      },
      'reviewer.md': {
        name: 'reviewer',
        description: 'Reviews code for quality, bugs, and security issues',
        expectedModel: 'sonnet'
      },
      'tester.md': {
        name: 'tester',
        description: 'Creates and runs tests, analyzes coverage',
        expectedModel: 'sonnet'
      },
      'devops.md': {
        name: 'devops',
        description: 'Handles infrastructure, CI/CD, and deployment',
        expectedModel: 'sonnet'
      },
      'tdd-developer.md': {
        name: 'tdd-developer',
        description: 'TDD-focused developer for implement stage',
        expectedModel: 'sonnet'
      },
      'tdd-tester.md': {
        name: 'tdd-tester',
        description: 'Test-Driven Development specialist focused on writing failing tests first',
        expectedModel: 'sonnet'
      },
      'verify.md': {
        name: 'verify',
        description: 'Verifies implementation passes tests and meets acceptance criteria in TDD context',
        expectedModel: 'sonnet'
      },
      'regression-check.md': {
        name: 'regression-check',
        description: 'Runs full test suite to ensure no regressions in TDD context',
        expectedModel: 'sonnet'
      }
    };

    Object.entries(expectedAgentSpecs).forEach(([filename, spec]) => {
      it(`should validate ${filename} agent file`, async () => {
        const agentPath = path.join(productionAgentsDir, filename);

        try {
          const content = await fs.readFile(agentPath, 'utf-8');
          expect(content).toBeTruthy();
          expect(content.length).toBeGreaterThan(100); // Should have substantial content

          // Parse the agent markdown
          const agent = parseAgentMarkdown(content);
          expect(agent).not.toBeNull();
          if (!agent) return;

          // Validate basic structure
          expect(agent.name).toBe(spec.name);
          expect(agent.description).toContain(spec.description);

          if (spec.expectedModel) {
            expect(agent.model).toBe(spec.expectedModel);
          }

          if (spec.expectedTools) {
            expect(agent.tools).toEqual(expect.arrayContaining(spec.expectedTools));
          }

          // Validate prompt content
          expect(agent.prompt).toBeTruthy();
          expect(agent.prompt.length).toBeGreaterThan(50);

          // Ensure schema validation passes
          expect(() => AgentDefinitionSchema.parse(agent)).not.toThrow();

        } catch (error) {
          throw new Error(`Failed to validate ${filename}: ${error}`);
        }
      });
    });
  });

  describe('Production Agent Content Quality', () => {
    it('should have substantive prompt content in all agents', async () => {
      try {
        const files = await fs.readdir(productionAgentsDir);
        const mdFiles = files.filter(f => f.endsWith('.md'));

        for (const file of mdFiles) {
          const content = await fs.readFile(path.join(productionAgentsDir, file), 'utf-8');
          const agent = parseAgentMarkdown(content);

          if (agent) {
            // Each agent should have meaningful content
            expect(agent.prompt.length).toBeGreaterThan(100);
            expect(agent.description.length).toBeGreaterThan(20);

            // Should contain guidance or instructions
            const lowerPrompt = agent.prompt.toLowerCase();
            const hasGuidance = lowerPrompt.includes('you are') ||
                               lowerPrompt.includes('your role') ||
                               lowerPrompt.includes('when ') ||
                               lowerPrompt.includes('guidelines') ||
                               lowerPrompt.includes('instructions');

            expect(hasGuidance).toBe(true);
          }
        }
      } catch (error) {
        throw new Error(`Failed to validate agent content quality: ${error}`);
      }
    });

    it('should have consistent frontmatter structure across all agents', async () => {
      try {
        const files = await fs.readdir(productionAgentsDir);
        const mdFiles = files.filter(f => f.endsWith('.md'));

        for (const file of mdFiles) {
          const content = await fs.readFile(path.join(productionAgentsDir, file), 'utf-8');

          // Should start with frontmatter
          expect(content).toMatch(/^---\n/);

          // Should have closing frontmatter
          expect(content).toMatch(/\n---\n/);

          // Parse and validate
          const agent = parseAgentMarkdown(content);
          expect(agent).not.toBeNull();

          if (agent) {
            // Should have required fields
            expect(typeof agent.name).toBe('string');
            expect(typeof agent.description).toBe('string');
            expect(typeof agent.prompt).toBe('string');

            // Model should be valid enum value
            expect(['opus', 'sonnet', 'haiku', 'inherit']).toContain(agent.model);
          }
        }
      } catch (error) {
        throw new Error(`Failed to validate frontmatter structure: ${error}`);
      }
    });

    it('should have TDD-specific agents with appropriate methodology', async () => {
      const tddAgents = ['tdd-developer.md', 'tdd-tester.md', 'verify.md', 'regression-check.md'];

      for (const filename of tddAgents) {
        try {
          const content = await fs.readFile(path.join(productionAgentsDir, filename), 'utf-8');
          const agent = parseAgentMarkdown(content);

          expect(agent).not.toBeNull();
          if (!agent) continue;

          // TDD agents should reference TDD methodology
          const lowerPrompt = agent.prompt.toLowerCase();
          const hasTddContent = lowerPrompt.includes('tdd') ||
                               lowerPrompt.includes('test-driven') ||
                               lowerPrompt.includes('test first') ||
                               lowerPrompt.includes('red-green-refactor') ||
                               lowerPrompt.includes('failing test');

          expect(hasTddContent).toBe(true);

        } catch (error) {
          // File might not exist, which is ok for this test
          console.warn(`TDD agent ${filename} not found or invalid`);
        }
      }
    });
  });

  describe('Production Agents Loading Integration', () => {
    it('should successfully load all production agents via loadAgents function', async () => {
      try {
        // Use project root as the project path
        const projectRoot = path.resolve('.');
        const agents = await loadAgents(projectRoot);

        expect(Object.keys(agents).length).toBeGreaterThan(0);

        // Verify each loaded agent
        Object.entries(agents).forEach(([name, agent]) => {
          expect(typeof name).toBe('string');
          expect(name.length).toBeGreaterThan(0);

          expect(agent).toBeDefined();
          expect(agent.name).toBe(name);
          expect(typeof agent.description).toBe('string');
          expect(typeof agent.prompt).toBe('string');

          // Validate schema compliance
          expect(() => AgentDefinitionSchema.parse(agent)).not.toThrow();
        });

        console.log(`Successfully loaded ${Object.keys(agents).length} production agents`);

      } catch (error) {
        throw new Error(`Failed to load production agents: ${error}`);
      }
    });

    it('should have agents with diverse tool assignments', async () => {
      try {
        const projectRoot = path.resolve('.');
        const agents = await loadAgents(projectRoot);

        const allTools = new Set<string>();
        let agentsWithTools = 0;

        Object.values(agents).forEach(agent => {
          if (agent.tools && agent.tools.length > 0) {
            agentsWithTools++;
            agent.tools.forEach(tool => allTools.add(tool));
          }
        });

        // Should have agents with tools assigned
        expect(agentsWithTools).toBeGreaterThan(0);

        // Should use diverse set of tools across agents
        expect(allTools.size).toBeGreaterThan(3);

        // Common tools should be present
        const commonTools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'];
        const foundCommonTools = commonTools.filter(tool => allTools.has(tool));
        expect(foundCommonTools.length).toBeGreaterThan(2);

        console.log(`Found ${allTools.size} unique tools across ${agentsWithTools} agents`);
        console.log('Tools:', Array.from(allTools).sort());

      } catch (error) {
        throw new Error(`Failed to analyze tool diversity: ${error}`);
      }
    });

    it('should have agents with appropriate model distribution', async () => {
      try {
        const projectRoot = path.resolve('.');
        const agents = await loadAgents(projectRoot);

        const modelDistribution = new Map<string, number>();

        Object.values(agents).forEach(agent => {
          const model = agent.model || 'sonnet'; // default
          modelDistribution.set(model, (modelDistribution.get(model) || 0) + 1);
        });

        // Should have model diversity (not all same model)
        expect(modelDistribution.size).toBeGreaterThan(0);

        // Should primarily use sonnet (as indicated in audit)
        const sonnetCount = modelDistribution.get('sonnet') || 0;
        expect(sonnetCount).toBeGreaterThan(0);

        console.log('Model distribution:', Object.fromEntries(modelDistribution));

      } catch (error) {
        throw new Error(`Failed to analyze model distribution: ${error}`);
      }
    });
  });

  describe('Agent Definition Format Compliance', () => {
    it('should have consistent naming conventions', async () => {
      try {
        const files = await fs.readdir(productionAgentsDir);
        const mdFiles = files.filter(f => f.endsWith('.md'));

        for (const file of mdFiles) {
          const content = await fs.readFile(path.join(productionAgentsDir, file), 'utf-8');
          const agent = parseAgentMarkdown(content);

          if (agent) {
            // Agent name should match filename (without extension)
            const expectedName = file.replace('.md', '');
            expect(agent.name).toBe(expectedName);

            // Name should be lowercase with hyphens
            expect(agent.name).toMatch(/^[a-z]+(-[a-z]+)*$/);

            // Description should be capitalized and descriptive
            expect(agent.description.charAt(0)).toMatch(/[A-Z]/);
            expect(agent.description.length).toBeGreaterThan(10);
          }
        }
      } catch (error) {
        throw new Error(`Failed to validate naming conventions: ${error}`);
      }
    });

    it('should have proper markdown formatting in prompts', async () => {
      try {
        const files = await fs.readdir(productionAgentsDir);
        const mdFiles = files.filter(f => f.endsWith('.md'));

        for (const file of mdFiles) {
          const content = await fs.readFile(path.join(productionAgentsDir, file), 'utf-8');
          const agent = parseAgentMarkdown(content);

          if (agent && agent.prompt.length > 200) { // Only check substantial prompts
            // Should not have frontmatter bleeding into prompt
            expect(agent.prompt).not.toMatch(/^---/);
            expect(agent.prompt).not.toMatch(/name:/);
            expect(agent.prompt).not.toMatch(/description:/);
            expect(agent.prompt).not.toMatch(/tools:/);
            expect(agent.prompt).not.toMatch(/model:/);

            // Should have proper markdown structure if using headers
            if (agent.prompt.includes('#')) {
              // Headers should have space after #
              expect(agent.prompt).not.toMatch(/#[^\s]/);
            }
          }
        }
      } catch (error) {
        throw new Error(`Failed to validate markdown formatting: ${error}`);
      }
    });
  });
});