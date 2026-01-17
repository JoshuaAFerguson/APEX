/**
 * Template validation tests for TDD Developer Agent
 *
 * This test file validates that the TDD developer agent template:
 * - Is properly installed during project initialization
 * - Contains all required content for effective TDD implementation
 * - Integrates correctly with the TDD workflow
 * - Provides actionable guidance for developers
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { initializeApex, loadAgents, loadWorkflows } from '@apexcli/core';

describe('TDD Developer Agent Template Validation', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tdd-template-validation-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Template Installation', () => {
    it('should create TDD developer agent file during initialization', async () => {
      await initializeApex(testDir, {
        projectName: 'template-validation-test'
      });

      const agentPath = path.join(testDir, '.apex', 'agents', 'tdd-developer.md');
      const agentExists = await fs.stat(agentPath).then(() => true).catch(() => false);
      expect(agentExists).toBe(true);
    });

    it('should have correct frontmatter metadata', async () => {
      await initializeApex(testDir, {
        projectName: 'frontmatter-test'
      });

      const agentPath = path.join(testDir, '.apex', 'agents', 'tdd-developer.md');
      const content = await fs.readFile(agentPath, 'utf-8');

      // Should have proper YAML frontmatter
      expect(content).toMatch(/^---\n/);
      expect(content).toContain('name: tdd-developer');
      expect(content).toContain('description: TDD-focused developer');
      expect(content).toContain('tools: Read, Write, Edit, MultiEdit, Bash, Grep, Glob');
      expect(content).toContain('model: sonnet');
      expect(content).toMatch(/---\n/);
    });

    it('should be loadable by the agent loading system', async () => {
      await initializeApex(testDir, {
        projectName: 'loading-test'
      });

      const agents = await loadAgents(testDir);
      expect(agents['tdd-developer']).toBeDefined();
      expect(agents['tdd-developer'].name).toBe('tdd-developer');
    });
  });

  describe('Content Quality and Completeness', () => {
    it('should contain all critical TDD implementation sections', async () => {
      await initializeApex(testDir, {
        projectName: 'content-quality-test'
      });

      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      const requiredSections = [
        'CRITICAL TDD IMPLEMENT PHASE PRINCIPLES',
        'RED → 🟢 GREEN TRANSITION',
        'MINIMAL IMPLEMENTATION MANDATE',
        'IMPLEMENT STAGE WORKFLOW',
        'TDD IMPLEMENTATION PATTERNS',
        'ANTI-PATTERNS TO AVOID',
        'CODE QUALITY WITHIN TDD CONSTRAINTS',
        'IMPLEMENT STAGE SUCCESS CRITERIA',
        'RED-GREEN-REFACTOR CYCLE AWARENESS',
        'DEBUGGING FAILED IMPLEMENTATIONS',
        'EXAMPLE IMPLEMENTATION PROGRESSION'
      ];

      requiredSections.forEach(section => {
        expect(prompt).toContain(section);
      });
    });

    it('should provide specific, actionable workflow steps', async () => {
      await initializeApex(testDir, {
        projectName: 'workflow-steps-test'
      });

      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      const workflowSteps = [
        '1. ANALYZE FAILING TESTS PRECISELY',
        '2. FIND THE MINIMAL CODE CHANGE',
        '3. IMPLEMENT THE MINIMAL SOLUTION',
        '4. VERIFY GREEN STATE'
      ];

      workflowSteps.forEach(step => {
        expect(prompt).toContain(step);
      });
    });

    it('should include practical code examples', async () => {
      await initializeApex(testDir, {
        projectName: 'code-examples-test'
      });

      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should include specific code examples
      expect(prompt).toContain('calculator.add(2, 3) === 5');
      expect(prompt).toContain('return 5;');
      expect(prompt).toContain('return a + b;');

      // Should show progression
      expect(prompt).toContain('add(a, b) {');
      expect(prompt).toContain('Minimal - makes THIS test pass');
    });

    it('should emphasize minimal implementation with multiple reinforcements', async () => {
      await initializeApex(testDir, {
        projectName: 'minimal-implementation-test'
      });

      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should reinforce minimal implementation throughout
      const minimalTerms = [
        'minimal', 'minimum', 'MINIMAL', 'least possible',
        'nothing more, nothing less', 'absolute minimum',
        'ONLY the code required', 'simplest possible approach'
      ];

      minimalTerms.forEach(term => {
        expect(prompt.toLowerCase()).toContain(term.toLowerCase());
      });
    });
  });

  describe('TDD Methodology Adherence', () => {
    it('should strictly define Green phase boundaries', async () => {
      await initializeApex(testDir, {
        projectName: 'green-phase-test'
      });

      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should be very clear about phase responsibilities
      expect(prompt).toContain('You are NOT in RED phase');
      expect(prompt).toContain('You are NOT in REFACTOR phase');
      expect(prompt).toContain('You ARE in GREEN phase');
      expect(prompt).toContain('making tests pass minimally');
    });

    it('should prevent scope creep with explicit prohibitions', async () => {
      await initializeApex(testDir, {
        projectName: 'scope-creep-test'
      });

      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      const prohibitions = [
        'Do NOT add any "future-proofing"',
        'Do NOT implement functionality that tests don\'t explicitly require',
        'Do NOT refactor during this phase',
        'Do NOT add tests during this phase',
        'Resist ALL urges to "improve"'
      ];

      prohibitions.forEach(prohibition => {
        expect(prompt).toContain(prohibition);
      });
    });

    it('should guide proper handoff between phases', async () => {
      await initializeApex(testDir, {
        projectName: 'handoff-test'
      });

      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should guide clean handoff
      expect(prompt).toContain('Handoff to Next Phase');
      expect(prompt).toContain('implementation work is COMPLETE');
      expect(prompt).toContain('Pass clean, minimal, working code');
      expect(prompt).toContain('REFACTOR phase');
    });
  });

  describe('Integration with TDD Workflow', () => {
    it('should align with TDD workflow implement stage', async () => {
      await initializeApex(testDir, {
        projectName: 'workflow-integration-test'
      });

      const workflows = await loadWorkflows(testDir);
      const agents = await loadAgents(testDir);

      const tddWorkflow = workflows.tdd;
      const implementStage = tddWorkflow.stages.find(s => s.name === 'implement');

      expect(implementStage?.agent).toBe('tdd-developer');
      expect(implementStage?.description).toContain('minimal code');
      expect(implementStage?.description).toContain('Green phase');

      // Agent should reference the same stage
      const agent = agents['tdd-developer'];
      expect(agent.description).toContain('implement stage');
      expect(agent.prompt).toContain('IMPLEMENT stage');
    });

    it('should provide outputs that match workflow expectations', async () => {
      await initializeApex(testDir, {
        projectName: 'outputs-test'
      });

      const workflows = await loadWorkflows(testDir);
      const implementStage = workflows.tdd.stages.find(s => s.name === 'implement');

      const expectedOutputs = ['code_changes', 'implementation_notes', 'branch_name'];
      expectedOutputs.forEach(output => {
        expect(implementStage?.outputs).toContain(output);
      });
    });

    it('should have dependencies that align with Red-Green-Refactor', async () => {
      await initializeApex(testDir, {
        projectName: 'dependencies-test'
      });

      const workflows = await loadWorkflows(testDir);
      const implementStage = workflows.tdd.stages.find(s => s.name === 'implement');

      // Should depend on run-test (Red phase completion)
      expect(implementStage?.dependsOn).toContain('run-test');

      // Should be followed by verify (Green validation)
      const verifyStage = workflows.tdd.stages.find(s => s.name === 'verify');
      expect(verifyStage?.dependsOn).toContain('implement');
    });
  });

  describe('Error Prevention and Recovery', () => {
    it('should provide debugging guidance for common issues', async () => {
      await initializeApex(testDir, {
        projectName: 'debugging-test'
      });

      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      const debuggingGuidance = [
        'Re-read test expectations carefully',
        'Check for typos in implementation',
        'Verify you\'re implementing the right method/class',
        'Ensure return types match test expectations',
        'Check for missing edge cases'
      ];

      debuggingGuidance.forEach(guidance => {
        expect(prompt).toContain(guidance);
      });
    });

    it('should guide trust in tests over intuition', async () => {
      await initializeApex(testDir, {
        projectName: 'trust-tests-test'
      });

      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should encourage trust in tests
      expect(prompt).toContain('Trust the tests');
      expect(prompt).toContain('they define the requirements');
      expect(prompt).toContain('Don\'t second-guess test intentions');
      expect(prompt).toContain('Resist urge to make it "better"');
    });
  });

  describe('Anti-Pattern Documentation', () => {
    it('should document over-engineering anti-patterns with specific examples', async () => {
      await initializeApex(testDir, {
        projectName: 'anti-patterns-test'
      });

      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      const antiPatterns = [
        'Adding configuration options not tested',
        'Creating abstractions tests don\'t require',
        'Implementing error handling beyond test scenarios',
        'Adding logging, metrics, or monitoring not tested',
        'Optimizing for performance not measured in tests'
      ];

      antiPatterns.forEach(pattern => {
        expect(prompt).toContain(pattern);
      });
    });

    it('should warn against future-proofing with concrete examples', async () => {
      await initializeApex(testDir, {
        projectName: 'future-proofing-test'
      });

      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      const futureProofingExamples = [
        '"This might be useful later" functionality',
        'Extensibility mechanisms not driven by tests',
        'Flexible APIs when tests only need specific behavior',
        'Design patterns not required by current tests'
      ];

      futureProofingExamples.forEach(example => {
        expect(prompt).toContain(example);
      });
    });
  });

  describe('Prompt Effectiveness', () => {
    it('should be comprehensive enough for practical guidance', async () => {
      await initializeApex(testDir, {
        projectName: 'comprehensiveness-test'
      });

      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should be substantial
      expect(prompt.length).toBeGreaterThan(4000);

      // Should have good structure
      const sectionHeaders = prompt.match(/^##\s+.+$/gm);
      expect(sectionHeaders?.length).toBeGreaterThan(8);

      // Should have code examples
      const codeBlocks = prompt.match(/```[\s\S]*?```/g);
      expect(codeBlocks?.length).toBeGreaterThan(0);
    });

    it('should balance detail with readability', async () => {
      await initializeApex(testDir, {
        projectName: 'readability-test'
      });

      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should have clear structure with markdown
      expect(prompt).toMatch(/^##\s/gm); // Headers
      expect(prompt).toMatch(/^\*\*/gm);  // Bold text
      expect(prompt).toMatch(/^-\s/gm);   // Lists
      expect(prompt).toMatch(/^\d+\./gm); // Numbered lists

      // Should have visual emphasis
      expect(prompt).toContain('🔴');
      expect(prompt).toContain('🟢');
      expect(prompt).toContain('❌');
      expect(prompt).toContain('✅');
    });

    it('should end with memorable key message', async () => {
      await initializeApex(testDir, {
        projectName: 'key-message-test'
      });

      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should end with strong discipline message
      expect(prompt).toContain('success is measured by making tests pass');
      expect(prompt).toContain('least possible code');
      expect(prompt).toContain('Embrace the discipline of minimal progress');
    });
  });
});