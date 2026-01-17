/**
 * Comprehensive tests for TDD Developer Agent prompt
 *
 * This test file verifies that the TDD developer agent prompt:
 * - Contains all critical TDD implementation principles
 * - Provides proper guidance for the GREEN phase of Red-Green-Refactor
 * - Emphasizes minimal implementation and test-driven design
 * - Documents anti-patterns to avoid
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { initializeApex, loadAgents } from '@apexcli/core';

describe('TDD Developer Agent Prompt Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tdd-dev-agent-'));
    await initializeApex(testDir, {
      projectName: 'tdd-developer-test',
      language: 'typescript'
    });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Agent Configuration', () => {
    it('should have proper agent metadata', async () => {
      const agents = await loadAgents(testDir);
      const tddDeveloper = agents['tdd-developer'];

      expect(tddDeveloper).toBeDefined();
      expect(tddDeveloper.name).toBe('tdd-developer');
      expect(tddDeveloper.description).toContain('TDD-focused developer');
      expect(tddDeveloper.description).toContain('implement stage');
      expect(tddDeveloper.description).toContain('MINIMAL code');
      expect(tddDeveloper.model).toBe('sonnet');
    });

    it('should have appropriate tools for implementation', async () => {
      const agents = await loadAgents(testDir);
      const tddDeveloper = agents['tdd-developer'];

      // Should have core development tools
      expect(tddDeveloper.tools).toContain('Read');
      expect(tddDeveloper.tools).toContain('Write');
      expect(tddDeveloper.tools).toContain('Edit');
      expect(tddDeveloper.tools).toContain('MultiEdit');
      expect(tddDeveloper.tools).toContain('Bash');
      expect(tddDeveloper.tools).toContain('Grep');
      expect(tddDeveloper.tools).toContain('Glob');
    });
  });

  describe('TDD Implementation Principles', () => {
    it('should emphasize IMPLEMENT stage role and Green phase', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should clearly define the GREEN phase role
      expect(prompt).toContain('IMPLEMENT stage');
      expect(prompt).toContain('Green phase');
      expect(prompt).toContain('Red-Green-Refactor');
      expect(prompt).toContain('RED → 🟢 GREEN');
      expect(prompt).toContain('transition from RED to GREEN');
    });

    it('should mandate minimal implementation approach', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should emphasize minimal code
      expect(prompt).toContain('MINIMAL IMPLEMENTATION');
      expect(prompt).toContain('absolute minimum code');
      expect(prompt).toContain('nothing more, nothing less');
      expect(prompt).toContain('Write ONLY the code required');
      expect(prompt).toContain('Do NOT add any "future-proofing"');
      expect(prompt).toContain('Do NOT implement functionality that tests don\'t explicitly require');
    });

    it('should provide clear implement stage workflow', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should have structured workflow steps
      expect(prompt).toContain('IMPLEMENT STAGE WORKFLOW');
      expect(prompt).toContain('ANALYZE FAILING TESTS PRECISELY');
      expect(prompt).toContain('FIND THE MINIMAL CODE CHANGE');
      expect(prompt).toContain('IMPLEMENT THE MINIMAL SOLUTION');
      expect(prompt).toContain('VERIFY GREEN STATE');
    });
  });

  describe('TDD Implementation Patterns', () => {
    it('should document key TDD patterns', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should include essential TDD patterns
      expect(prompt).toContain('Fake It Till You Make It');
      expect(prompt).toContain('Triangulation');
      expect(prompt).toContain('Obvious Implementation');
    });

    it('should provide Fake It Till You Make It example', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should provide practical example
      expect(prompt).toContain('calculator.add(2, 3) === 5');
      expect(prompt).toContain('return 5;');
      expect(prompt).toContain('NOT: return a + b;');
      expect(prompt).toContain('until more tests require it');
    });

    it('should explain triangulation principle', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should explain triangulation
      expect(prompt).toContain('multiple test cases');
      expect(prompt).toContain('gradually reveal');
      expect(prompt).toContain('Don\'t generalize until forced');
    });
  });

  describe('Anti-Patterns Prevention', () => {
    it('should warn against over-engineering', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should explicitly warn against over-engineering
      expect(prompt).toContain('OVER-ENGINEERING');
      expect(prompt).toContain('configuration options not tested');
      expect(prompt).toContain('abstractions tests don\'t require');
      expect(prompt).toContain('error handling beyond test scenarios');
      expect(prompt).toContain('optimizing for performance not measured');
    });

    it('should warn against future-proofing', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should warn against premature optimization
      expect(prompt).toContain('FUTURE-PROOFING');
      expect(prompt).toContain('This might be useful later');
      expect(prompt).toContain('Extensibility mechanisms not driven by tests');
      expect(prompt).toContain('Design patterns not required by current tests');
    });

    it('should warn against perfectionist coding', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should warn against perfectionism
      expect(prompt).toContain('PERFECTIONIST CODING');
      expect(prompt).toContain('Beautiful code that exceeds test requirements');
      expect(prompt).toContain('Complete implementations when partial ones pass tests');
      expect(prompt).toContain('Robust error handling beyond test coverage');
    });
  });

  describe('Code Quality Within TDD Constraints', () => {
    it('should provide clean code guidance within TDD limits', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should balance clean code with TDD constraints
      expect(prompt).toContain('CODE QUALITY WITHIN TDD CONSTRAINTS');
      expect(prompt).toContain('meaningful names');
      expect(prompt).toContain('Keep methods focused and small');
      expect(prompt).toContain('self-documenting code');
      expect(prompt).toContain('existing project conventions');
    });

    it('should guide error handling within test scope', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should limit error handling to test requirements
      expect(prompt).toContain('Implement only error cases that tests explicitly verify');
      expect(prompt).toContain('Don\'t add defensive programming beyond test coverage');
      expect(prompt).toContain('appropriate error types as specified by tests');
    });
  });

  describe('Success Criteria and Metrics', () => {
    it('should define clear success criteria', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should provide clear success metrics
      expect(prompt).toContain('IMPLEMENT STAGE SUCCESS CRITERIA');
      expect(prompt).toContain('All previously failing tests now pass');
      expect(prompt).toContain('No existing tests were broken');
      expect(prompt).toContain('Minimal code was added to achieve GREEN state');
      expect(prompt).toContain('Implementation follows existing patterns');
    });

    it('should include secondary quality checks', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should include quality considerations
      expect(prompt).toContain('SECONDARY QUALITY CHECKS');
      expect(prompt).toContain('readable and maintainable');
      expect(prompt).toContain('project conventions');
      expect(prompt).toContain('security issues');
      expect(prompt).toContain('Performance is adequate');
    });
  });

  describe('Red-Green-Refactor Cycle Awareness', () => {
    it('should clearly define the Green phase role', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should clearly define phase boundaries
      expect(prompt).toContain('RED-GREEN-REFACTOR CYCLE AWARENESS');
      expect(prompt).toContain('You are NOT in RED phase');
      expect(prompt).toContain('You are NOT in REFACTOR phase');
      expect(prompt).toContain('You ARE in GREEN phase');
    });

    it('should guide handoff to next phase', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should guide proper handoff
      expect(prompt).toContain('Handoff to Next Phase');
      expect(prompt).toContain('implementation work is COMPLETE');
      expect(prompt).toContain('Do NOT refactor during this phase');
      expect(prompt).toContain('Do NOT add tests during this phase');
      expect(prompt).toContain('Pass clean, minimal, working code');
    });
  });

  describe('Debugging and Problem Resolution', () => {
    it('should provide debugging guidance', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should help with debugging
      expect(prompt).toContain('DEBUGGING FAILED IMPLEMENTATIONS');
      expect(prompt).toContain('When Tests Still Fail');
      expect(prompt).toContain('Re-read test expectations carefully');
      expect(prompt).toContain('Check for typos in implementation');
      expect(prompt).toContain('Verify you\'re implementing the right method');
    });

    it('should guide when tests pass but seem wrong', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should guide trust in tests
      expect(prompt).toContain('When Tests Pass But Seem Wrong');
      expect(prompt).toContain('Trust the tests');
      expect(prompt).toContain('Don\'t second-guess test intentions');
      expect(prompt).toContain('Resist urge to make it "better"');
    });
  });

  describe('Practical Example Implementation', () => {
    it('should provide complete implementation progression example', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should show evolution from simple to general
      expect(prompt).toContain('EXAMPLE IMPLEMENTATION PROGRESSION');
      expect(prompt).toContain('expect(calculator.add(2, 3)).toBe(5)');
      expect(prompt).toContain('add(a, b) {');
      expect(prompt).toContain('return 5; // Minimal');
      expect(prompt).toContain('return a + b;');
      expect(prompt).toContain('NOW generalize');
    });

    it('should demonstrate the discipline of minimal progress', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should emphasize discipline
      expect(prompt).toContain('success is measured by making tests pass');
      expect(prompt).toContain('least possible code');
      expect(prompt).toContain('not by writing clever, complete, or future-ready implementations');
      expect(prompt).toContain('Embrace the discipline of minimal progress');
    });
  });

  describe('Prompt Length and Comprehensiveness', () => {
    it('should provide substantial guidance (minimum length)', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should be comprehensive enough to guide development
      expect(prompt.length).toBeGreaterThan(3000);
    });

    it('should be well-structured with clear sections', async () => {
      const agents = await loadAgents(testDir);
      const prompt = agents['tdd-developer'].prompt;

      // Should have clear structure
      const sections = [
        'CRITICAL TDD IMPLEMENT PHASE PRINCIPLES',
        'IMPLEMENT STAGE WORKFLOW',
        'TDD IMPLEMENTATION PATTERNS',
        'ANTI-PATTERNS TO AVOID',
        'CODE QUALITY WITHIN TDD CONSTRAINTS',
        'IMPLEMENT STAGE SUCCESS CRITERIA',
        'RED-GREEN-REFACTOR CYCLE AWARENESS',
        'DEBUGGING FAILED IMPLEMENTATIONS',
        'EXAMPLE IMPLEMENTATION PROGRESSION'
      ];

      sections.forEach(section => {
        expect(prompt).toContain(section);
      });
    });
  });

  describe('Integration with TDD Workflow', () => {
    it('should align with the implement stage requirements', async () => {
      const agents = await loadAgents(testDir);
      const tddDeveloper = agents['tdd-developer'];

      // Should be designed for the implement stage
      expect(tddDeveloper.description).toContain('implement stage');
      expect(tddDeveloper.prompt).toContain('IMPLEMENT stage');
      expect(tddDeveloper.prompt).toContain('implement');
    });

    it('should complement the TDD tester agent', async () => {
      const agents = await loadAgents(testDir);
      const tddTester = agents['tdd-tester'];
      const tddDeveloper = agents['tdd-developer'];

      // Should work together as a cohesive pair
      expect(tddTester.description).toContain('TDD specialist');
      expect(tddTester.description).toContain('test');
      expect(tddDeveloper.description).toContain('TDD-focused developer');
      expect(tddDeveloper.description).toContain('implement');

      // Should reference the same methodology
      expect(tddTester.prompt).toContain('Red-Green-Refactor');
      expect(tddDeveloper.prompt).toContain('Red-Green-Refactor');
    });
  });
});