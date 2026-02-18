import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as yaml from 'yaml';

describe('Regression-Check Agent', () => {
  const agentPath = join(process.cwd(), '.apex/agents/regression-check.md');
  let agentContent: string;
  let frontMatter: any;
  let promptContent: string;

  beforeEach(() => {
    if (!existsSync(agentPath)) {
      throw new Error(`Regression-check agent file not found at ${agentPath}`);
    }

    agentContent = readFileSync(agentPath, 'utf-8');

    // Parse YAML frontmatter
    const frontMatterMatch = agentContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontMatterMatch) {
      throw new Error('Invalid agent file format: missing YAML frontmatter');
    }

    frontMatter = yaml.parse(frontMatterMatch[1]);
    promptContent = frontMatterMatch[2].trim();
  });

  describe('YAML Frontmatter', () => {
    it('should have all required fields', () => {
      expect(frontMatter).toBeDefined();
      expect(frontMatter.name).toBe('regression-check');
      expect(frontMatter.description).toBeDefined();
      expect(frontMatter.tools).toBeDefined();
      expect(frontMatter.model).toBeDefined();
    });

    it('should have appropriate description', () => {
      expect(frontMatter.description).toContain('full test suite');
      expect(frontMatter.description).toContain('regressions');
      expect(frontMatter.description).toContain('TDD');
    });

    it('should have appropriate tools for regression testing', () => {
      const tools = frontMatter.tools;
      expect(tools).toContain('Read');
      expect(tools).toContain('Bash');
      expect(tools).toContain('Grep');
      expect(tools).toContain('Glob');
    });

    it('should specify sonnet model for complex analysis', () => {
      expect(frontMatter.model).toBe('sonnet');
    });
  });

  describe('Prompt Content Structure', () => {
    it('should define clear role and purpose', () => {
      expect(promptContent).toContain('regression specialist');
      expect(promptContent).toContain('existing functionality');
      expect(promptContent).toContain('TDD context');
      expect(promptContent).toContain('regression-check stage');
    });

    it('should include comprehensive testing process', () => {
      expect(promptContent).toContain('Comprehensive Test Execution');
      expect(promptContent).toContain('Regression Analysis');
      expect(promptContent).toContain('TDD Context Awareness');
      expect(promptContent).toContain('System Integration Verification');
    });

    it('should specify success criteria', () => {
      expect(promptContent).toContain('Success Criteria');
      expect(promptContent).toContain('existing tests continue to pass');
      expect(promptContent).toContain('no new test failures');
      expect(promptContent).toContain('integration points work correctly');
    });

    it('should define failure response procedure', () => {
      expect(promptContent).toContain('Failure Response');
      expect(promptContent).toContain('Immediate feedback');
      expect(promptContent).toContain('Detailed analysis');
      expect(promptContent).toContain('Impact scope');
      expect(promptContent).toContain('Suggested fixes');
    });

    it('should specify output format', () => {
      expect(promptContent).toContain('Output Format');
      expect(promptContent).toContain('Test Suite Summary');
      expect(promptContent).toContain('Regression Details');
      expect(promptContent).toContain('Performance Impact');
      expect(promptContent).toContain('Coverage Analysis');
      expect(promptContent).toContain('Integration Status');
    });
  });

  describe('Comprehensive Testing Coverage', () => {
    it('should include full test suite execution', () => {
      expect(promptContent).toContain('Full test suite');
      expect(promptContent).toContain('all existing tests');
      expect(promptContent).toContain('not just the new ones');
    });

    it('should include integration testing', () => {
      expect(promptContent).toContain('Integration tests');
      expect(promptContent).toContain('component interactions');
      expect(promptContent).toContain('module interfaces');
    });

    it('should include end-to-end testing', () => {
      expect(promptContent).toContain('End-to-end tests');
      expect(promptContent).toContain('system-level tests');
    });

    it('should include performance testing', () => {
      expect(promptContent).toContain('Performance tests');
      expect(promptContent).toContain('performance regressions');
      expect(promptContent).toContain('execution time');
    });
  });

  describe('Regression Analysis Capabilities', () => {
    it('should identify test failures', () => {
      expect(promptContent).toContain('Identify failures');
      expect(promptContent).toContain('previously passing tests');
      expect(promptContent).toContain('now fail');
    });

    it('should perform root cause analysis', () => {
      expect(promptContent).toContain('Root cause analysis');
      expect(promptContent).toContain('caused by new changes');
    });

    it('should assess impact', () => {
      expect(promptContent).toContain('Impact assessment');
      expect(promptContent).toContain('scope and severity');
    });

    it('should filter false positives', () => {
      expect(promptContent).toContain('False positive filtering');
      expect(promptContent).toContain('real regressions');
      expect(promptContent).toContain('flaky tests');
    });
  });

  describe('TDD Context Integration', () => {
    it('should support refactor safety', () => {
      expect(promptContent).toContain('Refactor safety');
      expect(promptContent).toContain('TDD cycle');
      expect(promptContent).toContain('refactor phase');
    });

    it('should enable incremental validation', () => {
      expect(promptContent).toContain('Incremental validation');
      expect(promptContent).toContain('TDD iteration');
      expect(promptContent).toContain('system integrity');
    });

    it('should maintain test suite health', () => {
      expect(promptContent).toContain('Test suite health');
      expect(promptContent).toContain('reliable and fast');
    });

    it('should preserve coverage', () => {
      expect(promptContent).toContain('Coverage preservation');
      expect(promptContent).toContain('test coverage hasn\'t degraded');
    });
  });

  describe('System Integration Verification', () => {
    it('should verify module interfaces', () => {
      expect(promptContent).toContain('Module interfaces');
      expect(promptContent).toContain('integrates properly');
      expect(promptContent).toContain('existing modules');
    });

    it('should check data flow', () => {
      expect(promptContent).toContain('Data flow');
      expect(promptContent).toContain('correctly through the system');
    });

    it('should verify error propagation', () => {
      expect(promptContent).toContain('Error propagation');
      expect(promptContent).toContain('error handling works');
      expect(promptContent).toContain('module boundaries');
    });

    it('should check configuration compatibility', () => {
      expect(promptContent).toContain('Configuration compatibility');
      expect(promptContent).toContain('existing configurations');
    });
  });

  describe('Special Considerations', () => {
    it('should consider CI/CD integration', () => {
      expect(promptContent).toContain('CI/CD Integration');
      expect(promptContent).toContain('continuous integration pipelines');
    });

    it('should assess deployment safety', () => {
      expect(promptContent).toContain('Deployment Safety');
      expect(promptContent).toContain('readiness for deployment');
    });

    it('should verify monitoring integration', () => {
      expect(promptContent).toContain('Monitoring Integration');
      expect(promptContent).toContain('existing monitoring');
    });

    it('should check documentation needs', () => {
      expect(promptContent).toContain('Documentation Updates');
      expect(promptContent).toContain('documentation needs updates');
    });
  });

  describe('Performance and Efficiency', () => {
    it('should maintain workflow efficiency', () => {
      expect(promptContent).toContain('TDD workflow efficiency');
      expect(promptContent).toContain('development cycle fast');
    });

    it('should provide comprehensive detection', () => {
      expect(promptContent).toContain('comprehensive regression detection');
      expect(promptContent).toContain('catch issues early');
    });

    it('should maintain reliability', () => {
      expect(promptContent).toContain('fast and reliable');
    });
  });
});