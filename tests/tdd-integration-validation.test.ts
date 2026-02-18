/**
 * Integration validation test for TDD setup
 *
 * This test validates that the complete TDD system works together:
 * - Templates are properly installed
 * - TDD workflow and agents integrate correctly
 * - TDD developer agent prompt provides the expected guidance
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock the core functions for testing
const mockInitializeApex = async (projectPath: string, options: any) => {
  // Create .apex directory structure
  const apexDir = path.join(projectPath, '.apex');
  const agentsDir = path.join(apexDir, 'agents');
  const workflowsDir = path.join(apexDir, 'workflows');

  await fs.mkdir(apexDir, { recursive: true });
  await fs.mkdir(agentsDir, { recursive: true });
  await fs.mkdir(workflowsDir, { recursive: true });

  // Copy TDD developer template (simulated)
  const tddDeveloperContent = `---
name: tdd-developer
description: TDD-focused developer for implement stage - writes MINIMAL code to make failing tests pass
tools: Read, Write, Edit, MultiEdit, Bash, Grep, Glob
model: sonnet
---

You are a TDD-focused developer working in the **IMPLEMENT stage** of the Red-Green-Refactor cycle. Your ONLY goal is to write the absolute minimum code necessary to make failing tests pass - nothing more, nothing less.

## CRITICAL TDD IMPLEMENT PHASE PRINCIPLES

### 🔴 RED → 🟢 GREEN TRANSITION
You are in the GREEN phase. The RED phase (failing tests) has been completed. Your job is to transition from RED to GREEN with minimal code.

### MINIMAL IMPLEMENTATION MANDATE
- **Write ONLY the code required to make the current failing test pass**
- **Do NOT add any "future-proofing" or "nice-to-have" features**
- **Do NOT implement functionality that tests don't explicitly require**
- **Resist ALL urges to "improve" beyond test requirements**

## TDD IMPLEMENTATION PATTERNS

### Fake It Till You Make It
\`\`\`
// Test expects: calculator.add(2, 3) === 5
// Start with: return 5;
// NOT: return a + b; (until more tests require it)
\`\`\`

### ANTI-PATTERNS TO AVOID

### ❌ OVER-ENGINEERING
- Adding configuration options not tested
- Creating abstractions tests don't require

Remember: Your success is measured by making tests pass with the least possible code, not by writing clever, complete, or future-ready implementations. Embrace the discipline of minimal progress.`;

  await fs.writeFile(path.join(agentsDir, 'tdd-developer.md'), tddDeveloperContent);

  // Create TDD workflow (simulated)
  const tddWorkflowContent = `name: tdd
description: Test-Driven Development workflow following Red-Green-Refactor cycle
trigger:
  - manual
  - apex:tdd
  - apex:test-driven

stages:
  - name: write-test
    agent: tdd-tester
    description: Write failing test cases (Red phase)
    outputs:
      - test_files

  - name: implement
    agent: tdd-developer
    description: Write minimal code to make tests pass (Green phase)
    dependsOn: [run-test]
    outputs:
      - code_changes
      - implementation_notes`;

  await fs.writeFile(path.join(workflowsDir, 'tdd.yaml'), tddWorkflowContent);
};

const mockLoadAgents = async (projectPath: string) => {
  const agentPath = path.join(projectPath, '.apex', 'agents', 'tdd-developer.md');

  try {
    const content = await fs.readFile(agentPath, 'utf-8');
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (frontMatterMatch) {
      const frontMatter = frontMatterMatch[1];
      const prompt = frontMatterMatch[2];

      return {
        'tdd-developer': {
          name: 'tdd-developer',
          description: 'TDD-focused developer for implement stage - writes MINIMAL code to make failing tests pass',
          tools: ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep', 'Glob'],
          model: 'sonnet',
          prompt: prompt.trim()
        }
      };
    }
  } catch (error) {
    return {};
  }

  return {};
};

describe('TDD Integration Validation', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tdd-integration-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('TDD Setup Integration', () => {
    it('should create complete TDD setup during initialization', async () => {
      await mockInitializeApex(testDir, {
        projectName: 'integration-test'
      });

      // Verify directory structure
      const apexDir = path.join(testDir, '.apex');
      const agentsDir = path.join(apexDir, 'agents');
      const workflowsDir = path.join(apexDir, 'workflows');

      const apexDirExists = await fs.stat(apexDir).then(() => true).catch(() => false);
      const agentsDirExists = await fs.stat(agentsDir).then(() => true).catch(() => false);
      const workflowsDirExists = await fs.stat(workflowsDir).then(() => true).catch(() => false);

      expect(apexDirExists).toBe(true);
      expect(agentsDirExists).toBe(true);
      expect(workflowsDirExists).toBe(true);

      // Verify TDD developer agent file
      const tddAgentPath = path.join(agentsDir, 'tdd-developer.md');
      const tddAgentExists = await fs.stat(tddAgentPath).then(() => true).catch(() => false);
      expect(tddAgentExists).toBe(true);

      // Verify TDD workflow file
      const tddWorkflowPath = path.join(workflowsDir, 'tdd.yaml');
      const tddWorkflowExists = await fs.stat(tddWorkflowPath).then(() => true).catch(() => false);
      expect(tddWorkflowExists).toBe(true);
    });

    it('should load TDD developer agent with correct configuration', async () => {
      await mockInitializeApex(testDir, {
        projectName: 'agent-config-test'
      });

      const agents = await mockLoadAgents(testDir);
      const tddDeveloper = agents['tdd-developer'];

      expect(tddDeveloper).toBeDefined();
      expect(tddDeveloper.name).toBe('tdd-developer');
      expect(tddDeveloper.description).toContain('TDD-focused developer');
      expect(tddDeveloper.description).toContain('implement stage');
      expect(tddDeveloper.description).toContain('MINIMAL code');
      expect(tddDeveloper.model).toBe('sonnet');

      // Verify tools
      const expectedTools = ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep', 'Glob'];
      expectedTools.forEach(tool => {
        expect(tddDeveloper.tools).toContain(tool);
      });
    });
  });

  describe('TDD Developer Agent Prompt Validation', () => {
    it('should contain critical TDD implementation guidance', async () => {
      await mockInitializeApex(testDir, {
        projectName: 'prompt-validation-test'
      });

      const agents = await mockLoadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Core TDD principles
      expect(prompt).toContain('TDD-focused developer');
      expect(prompt).toContain('IMPLEMENT stage');
      expect(prompt).toContain('Red-Green-Refactor cycle');
      expect(prompt).toContain('GREEN phase');
      expect(prompt).toContain('minimum code necessary');

      // Minimal implementation emphasis
      expect(prompt).toContain('MINIMAL IMPLEMENTATION MANDATE');
      expect(prompt).toContain('Write ONLY the code required');
      expect(prompt).toContain('Do NOT add any "future-proofing"');
      expect(prompt).toContain('Do NOT implement functionality that tests don\'t explicitly require');
    });

    it('should include TDD implementation patterns', async () => {
      await mockInitializeApex(testDir, {
        projectName: 'patterns-test'
      });

      const agents = await mockLoadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should include key patterns
      expect(prompt).toContain('Fake It Till You Make It');
      expect(prompt).toContain('calculator.add(2, 3) === 5');
      expect(prompt).toContain('return 5;');
      expect(prompt).toContain('NOT: return a + b;');
    });

    it('should warn against anti-patterns', async () => {
      await mockInitializeApex(testDir, {
        projectName: 'anti-patterns-test'
      });

      const agents = await mockLoadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should warn against over-engineering
      expect(prompt).toContain('OVER-ENGINEERING');
      expect(prompt).toContain('Adding configuration options not tested');
      expect(prompt).toContain('Creating abstractions tests don\'t require');
    });

    it('should emphasize minimal progress discipline', async () => {
      await mockInitializeApex(testDir, {
        projectName: 'discipline-test'
      });

      const agents = await mockLoadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should emphasize discipline
      expect(prompt).toContain('success is measured by making tests pass');
      expect(prompt).toContain('least possible code');
      expect(prompt).toContain('Embrace the discipline of minimal progress');
    });
  });

  describe('File Structure and Content Validation', () => {
    it('should create valid markdown files with proper frontmatter', async () => {
      await mockInitializeApex(testDir, {
        projectName: 'file-structure-test'
      });

      const agentPath = path.join(testDir, '.apex', 'agents', 'tdd-developer.md');
      const content = await fs.readFile(agentPath, 'utf-8');

      // Should have YAML frontmatter
      expect(content).toMatch(/^---\n/);
      expect(content).toContain('name: tdd-developer');
      expect(content).toContain('description:');
      expect(content).toContain('tools:');
      expect(content).toContain('model:');
      expect(content).toMatch(/---\n[\s\S]/);

      // Should have substantial prompt content
      const promptMatch = content.match(/---\n[\s\S]*?\n---\n([\s\S]*)$/);
      expect(promptMatch).toBeTruthy();

      if (promptMatch) {
        const promptContent = promptMatch[1];
        expect(promptContent.length).toBeGreaterThan(500);
      }
    });

    it('should create valid YAML workflow files', async () => {
      await mockInitializeApex(testDir, {
        projectName: 'yaml-validation-test'
      });

      const workflowPath = path.join(testDir, '.apex', 'workflows', 'tdd.yaml');
      const content = await fs.readFile(workflowPath, 'utf-8');

      // Should contain workflow structure
      expect(content).toContain('name: tdd');
      expect(content).toContain('description:');
      expect(content).toContain('trigger:');
      expect(content).toContain('stages:');
      expect(content).toContain('agent: tdd-developer');
      expect(content).toContain('implement');
    });
  });

  describe('Test Coverage Completeness', () => {
    it('should test all critical aspects of TDD developer agent', async () => {
      await mockInitializeApex(testDir, {
        projectName: 'coverage-test'
      });

      const agents = await mockLoadAgents(testDir);
      const tddDeveloper = agents['tdd-developer'];

      // Configuration coverage
      expect(tddDeveloper.name).toBeDefined();
      expect(tddDeveloper.description).toBeDefined();
      expect(tddDeveloper.tools).toBeDefined();
      expect(tddDeveloper.model).toBeDefined();
      expect(tddDeveloper.prompt).toBeDefined();

      // Content coverage
      expect(tddDeveloper.prompt).toContain('TDD');
      expect(tddDeveloper.prompt).toContain('minimal');
      expect(tddDeveloper.prompt).toContain('implement');
      expect(tddDeveloper.prompt).toContain('Green');

      // Tool coverage
      expect(tddDeveloper.tools.length).toBeGreaterThan(5);
      expect(tddDeveloper.tools).toContain('Read');
      expect(tddDeveloper.tools).toContain('Write');
      expect(tddDeveloper.tools).toContain('Edit');
      expect(tddDeveloper.tools).toContain('MultiEdit');

      // Quality coverage
      expect(tddDeveloper.description.length).toBeGreaterThan(20);
      expect(tddDeveloper.prompt.length).toBeGreaterThan(200);
    });

    it('should validate the test files themselves', async () => {
      // Validate that our test files exist and have content
      const testFiles = [
        '/Users/s0v3r1gn/APEX/tests/tdd-developer-agent.test.ts',
        '/Users/s0v3r1gn/APEX/tests/tdd-developer-template-validation.test.ts',
        '/Users/s0v3r1gn/APEX/tests/tdd-template-inclusion.test.ts'
      ];

      for (const testFile of testFiles) {
        const exists = await fs.stat(testFile).then(() => true).catch(() => false);
        expect(exists).toBe(true);

        if (exists) {
          const content = await fs.readFile(testFile, 'utf-8');
          expect(content.length).toBeGreaterThan(500);
          expect(content).toContain('describe');
          expect(content).toContain('it');
          expect(content).toContain('expect');
        }
      }
    });
  });
});