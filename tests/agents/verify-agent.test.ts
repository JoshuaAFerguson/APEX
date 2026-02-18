import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as yaml from 'yaml';

describe('Verify Agent', () => {
  const agentPath = join(process.cwd(), '.apex/agents/verify.md');
  let agentContent: string;
  let frontMatter: any;
  let promptContent: string;

  beforeEach(() => {
    if (!existsSync(agentPath)) {
      throw new Error(`Verify agent file not found at ${agentPath}`);
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
      expect(frontMatter.name).toBe('verify');
      expect(frontMatter.description).toBeDefined();
      expect(frontMatter.tools).toBeDefined();
      expect(frontMatter.model).toBeDefined();
    });

    it('should have appropriate description', () => {
      expect(frontMatter.description).toContain('verification');
      expect(frontMatter.description).toContain('implementation');
      expect(frontMatter.description).toContain('tests');
      expect(frontMatter.description).toContain('acceptance criteria');
      expect(frontMatter.description).toContain('TDD');
    });

    it('should have appropriate tools for verification tasks', () => {
      const tools = frontMatter.tools;
      expect(tools).toContain('Read');
      expect(tools).toContain('Bash');
      expect(tools).toContain('Grep');
      expect(tools).toContain('Glob');
    });

    it('should specify sonnet model for complex reasoning', () => {
      expect(frontMatter.model).toBe('sonnet');
    });
  });

  describe('Prompt Content Structure', () => {
    it('should define clear role and purpose', () => {
      expect(promptContent).toContain('verification specialist');
      expect(promptContent).toContain('TDD');
      expect(promptContent).toContain('verify stage');
    });

    it('should include comprehensive verification process', () => {
      expect(promptContent).toContain('Test Execution Verification');
      expect(promptContent).toContain('Implementation Quality Check');
      expect(promptContent).toContain('TDD Compliance Verification');
    });

    it('should specify success criteria', () => {
      expect(promptContent).toContain('Success Criteria');
      expect(promptContent).toContain('target tests pass');
      expect(promptContent).toContain('acceptance criteria');
      expect(promptContent).toContain('TDD principles');
    });

    it('should define failure response procedure', () => {
      expect(promptContent).toContain('Failure Response');
      expect(promptContent).toContain('identify what is not working');
      expect(promptContent).toContain('actionable feedback');
    });

    it('should specify output format', () => {
      expect(promptContent).toContain('Output Format');
      expect(promptContent).toContain('Test Results');
      expect(promptContent).toContain('Coverage Analysis');
      expect(promptContent).toContain('Acceptance Criteria');
      expect(promptContent).toContain('Recommendation');
    });
  });

  describe('TDD Context Integration', () => {
    it('should emphasize TDD workflow integration', () => {
      expect(promptContent).toContain('Test-Driven Development');
      expect(promptContent).toContain('TDD workflow');
      expect(promptContent).toContain('implementation is complete');
    });

    it('should focus on test-driven validation', () => {
      expect(promptContent).toContain('failing tests pass');
      expect(promptContent).toContain('test scenarios');
      expect(promptContent).toContain('test expectations');
      expect(promptContent).toContain('test-driven design');
    });

    it('should prevent over-engineering', () => {
      expect(promptContent).toContain('Minimal implementation');
      expect(promptContent).toContain('No over-engineering');
      expect(promptContent).toContain('exactly what tests require');
    });

    it('should maintain TDD momentum', () => {
      expect(promptContent).toContain('efficient verification');
      expect(promptContent).toContain('TDD momentum');
      expect(promptContent).toContain('Incremental progress');
    });
  });

  describe('Verification Scope', () => {
    it('should include test execution verification', () => {
      expect(promptContent).toContain('Run target tests');
      expect(promptContent).toContain('Verify test passage');
      expect(promptContent).toContain('Check test behavior');
      expect(promptContent).toContain('Validate edge cases');
    });

    it('should include implementation quality checks', () => {
      expect(promptContent).toContain('Code coverage');
      expect(promptContent).toContain('Requirements alignment');
      expect(promptContent).toContain('Interface compliance');
      expect(promptContent).toContain('Error handling');
    });

    it('should validate TDD compliance', () => {
      expect(promptContent).toContain('TDD Compliance Verification');
      expect(promptContent).toContain('test requirements');
      expect(promptContent).toContain('test-driven approach');
    });
  });

  describe('Quality Assurance', () => {
    it('should check for false positives', () => {
      expect(promptContent).toContain('right reasons');
      expect(promptContent).toContain('not false positives');
    });

    it('should verify proper functionality', () => {
      expect(promptContent).toContain('expected functionality');
      expect(promptContent).toContain('test behavior');
      expect(promptContent).toContain('demonstrate the expected');
    });

    it('should ensure comprehensive coverage', () => {
      expect(promptContent).toContain('covers the test scenarios');
      expect(promptContent).toContain('adequately');
    });
  });
});