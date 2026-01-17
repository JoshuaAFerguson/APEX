import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import * as yaml from 'yaml';

describe('TDD Workflow Agent Integration', () => {
  const agentsDir = join(process.cwd(), '.apex/agents');
  const workflowsDir = join(process.cwd(), '.apex/workflows');

  let verifyAgent: any;
  let regressionCheckAgent: any;
  let tddWorkflows: any[];

  beforeEach(() => {
    // Load verify agent
    const verifyPath = join(agentsDir, 'verify.md');
    if (existsSync(verifyPath)) {
      const content = readFileSync(verifyPath, 'utf-8');
      const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (frontMatterMatch) {
        verifyAgent = {
          metadata: yaml.parse(frontMatterMatch[1]),
          content: frontMatterMatch[2].trim()
        };
      }
    }

    // Load regression-check agent
    const regressionPath = join(agentsDir, 'regression-check.md');
    if (existsSync(regressionPath)) {
      const content = readFileSync(regressionPath, 'utf-8');
      const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (frontMatterMatch) {
        regressionCheckAgent = {
          metadata: yaml.parse(frontMatterMatch[1]),
          content: frontMatterMatch[2].trim()
        };
      }
    }

    // Load TDD workflows if they exist
    tddWorkflows = [];
    if (existsSync(workflowsDir)) {
      const workflowFiles = readdirSync(workflowsDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
      for (const file of workflowFiles) {
        const content = readFileSync(join(workflowsDir, file), 'utf-8');
        try {
          const workflow = yaml.parse(content);
          if (workflow.name && workflow.name.toLowerCase().includes('tdd')) {
            tddWorkflows.push(workflow);
          }
        } catch (e) {
          // Skip invalid YAML files
        }
      }
    }
  });

  describe('Agent Existence and Structure', () => {
    it('should have verify agent properly configured', () => {
      expect(verifyAgent).toBeDefined();
      expect(verifyAgent.metadata.name).toBe('verify');
      expect(verifyAgent.content).toBeDefined();
    });

    it('should have regression-check agent properly configured', () => {
      expect(regressionCheckAgent).toBeDefined();
      expect(regressionCheckAgent.metadata.name).toBe('regression-check');
      expect(regressionCheckAgent.content).toBeDefined();
    });

    it('should have complementary tools for both agents', () => {
      const verifyTools = verifyAgent?.metadata?.tools || [];
      const regressionTools = regressionCheckAgent?.metadata?.tools || [];

      // Both should have basic file and execution tools
      expect(verifyTools).toContain('Read');
      expect(verifyTools).toContain('Bash');
      expect(regressionTools).toContain('Read');
      expect(regressionTools).toContain('Bash');
    });
  });

  describe('TDD Workflow Integration', () => {
    it('should have agents that understand TDD context', () => {
      if (verifyAgent) {
        expect(verifyAgent.content).toContain('TDD');
        expect(verifyAgent.content).toContain('Test-Driven Development');
      }

      if (regressionCheckAgent) {
        expect(regressionCheckAgent.content).toContain('TDD');
        expect(regressionCheckAgent.content).toContain('Test-Driven Development');
      }
    });

    it('should have agents positioned correctly in workflow', () => {
      if (verifyAgent) {
        expect(verifyAgent.content).toContain('verify stage');
        expect(verifyAgent.content).toContain('after implementation');
      }

      if (regressionCheckAgent) {
        expect(regressionCheckAgent.content).toContain('regression-check stage');
        expect(regressionCheckAgent.content).toContain('after verify');
      }
    });

    it('should have sequential workflow logic', () => {
      if (verifyAgent && regressionCheckAgent) {
        // Verify focuses on new tests passing
        expect(verifyAgent.content).toContain('target tests pass');
        expect(verifyAgent.content).toContain('new tests pass');

        // Regression-check focuses on existing tests still passing
        expect(regressionCheckAgent.content).toContain('existing tests');
        expect(regressionCheckAgent.content).toContain('complete test suite');
      }
    });
  });

  describe('Agent Collaboration', () => {
    it('should have distinct but complementary responsibilities', () => {
      if (verifyAgent && regressionCheckAgent) {
        // Verify agent should focus on new functionality
        expect(verifyAgent.content).toContain('implementation meets acceptance criteria');
        expect(verifyAgent.content).toContain('tests now pass');

        // Regression-check should focus on existing functionality
        expect(regressionCheckAgent.content).toContain('existing functionality');
        expect(regressionCheckAgent.content).toContain('no regressions');
      }
    });

    it('should have proper error handling and feedback', () => {
      if (verifyAgent) {
        expect(verifyAgent.content).toContain('Failure Response');
        expect(verifyAgent.content).toContain('actionable feedback');
      }

      if (regressionCheckAgent) {
        expect(regressionCheckAgent.content).toContain('Failure Response');
        expect(regressionCheckAgent.content).toContain('Immediate feedback');
      }
    });

    it('should maintain consistent output formats', () => {
      if (verifyAgent && regressionCheckAgent) {
        expect(verifyAgent.content).toContain('Output Format');
        expect(regressionCheckAgent.content).toContain('Output Format');

        // Both should provide recommendations
        expect(verifyAgent.content).toContain('Recommendation');
        expect(regressionCheckAgent.content).toContain('Recommendation');
      }
    });
  });

  describe('Quality Assurance Integration', () => {
    it('should have comprehensive testing coverage', () => {
      if (verifyAgent) {
        expect(verifyAgent.content).toContain('Test Execution Verification');
        expect(verifyAgent.content).toContain('edge cases');
      }

      if (regressionCheckAgent) {
        expect(regressionCheckAgent.content).toContain('Comprehensive Test Execution');
        expect(regressionCheckAgent.content).toContain('full test suite');
      }
    });

    it('should prevent over-engineering', () => {
      if (verifyAgent) {
        expect(verifyAgent.content).toContain('Minimal implementation');
        expect(verifyAgent.content).toContain('No over-engineering');
      }
    });

    it('should maintain code quality standards', () => {
      if (verifyAgent) {
        expect(verifyAgent.content).toContain('Implementation Quality Check');
        expect(verifyAgent.content).toContain('Code coverage');
      }

      if (regressionCheckAgent) {
        expect(regressionCheckAgent.content).toContain('System Integration Verification');
        expect(regressionCheckAgent.content).toContain('module interfaces');
      }
    });
  });

  describe('Performance Considerations', () => {
    it('should maintain TDD momentum', () => {
      if (verifyAgent) {
        expect(verifyAgent.content).toContain('TDD momentum');
        expect(verifyAgent.content).toContain('efficient verification');
      }

      if (regressionCheckAgent) {
        expect(regressionCheckAgent.content).toContain('TDD workflow efficiency');
        expect(regressionCheckAgent.content).toContain('development cycle fast');
      }
    });

    it('should consider performance impact', () => {
      if (regressionCheckAgent) {
        expect(regressionCheckAgent.content).toContain('Performance Impact');
        expect(regressionCheckAgent.content).toContain('execution time');
      }
    });
  });

  describe('Deployment Readiness', () => {
    it('should assess deployment safety', () => {
      if (regressionCheckAgent) {
        expect(regressionCheckAgent.content).toContain('Deployment Safety');
        expect(regressionCheckAgent.content).toContain('readiness for deployment');
      }
    });

    it('should consider CI/CD integration', () => {
      if (regressionCheckAgent) {
        expect(regressionCheckAgent.content).toContain('CI/CD Integration');
        expect(regressionCheckAgent.content).toContain('continuous integration');
      }
    });
  });

  describe('Test Coverage and Quality', () => {
    it('should validate test coverage', () => {
      if (verifyAgent) {
        expect(verifyAgent.content).toContain('Coverage Analysis');
      }

      if (regressionCheckAgent) {
        expect(regressionCheckAgent.content).toContain('Coverage Analysis');
        expect(regressionCheckAgent.content).toContain('test coverage hasn\'t degraded');
      }
    });

    it('should detect false positives', () => {
      if (verifyAgent) {
        expect(verifyAgent.content).toContain('not false positives');
      }

      if (regressionCheckAgent) {
        expect(regressionCheckAgent.content).toContain('False positive filtering');
        expect(regressionCheckAgent.content).toContain('flaky tests');
      }
    });
  });
});