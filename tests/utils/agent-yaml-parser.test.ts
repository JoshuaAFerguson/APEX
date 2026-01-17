import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import * as yaml from 'yaml';

describe('Agent YAML Frontmatter Parsing', () => {
  const agentsDir = join(process.cwd(), '.apex/agents');

  function parseAgentFile(filePath: string) {
    if (!existsSync(filePath)) {
      throw new Error(`Agent file not found: ${filePath}`);
    }

    const content = readFileSync(filePath, 'utf-8');
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!frontMatterMatch) {
      throw new Error(`Invalid agent file format: missing YAML frontmatter in ${filePath}`);
    }

    try {
      const metadata = yaml.parse(frontMatterMatch[1]);
      const promptContent = frontMatterMatch[2].trim();
      return { metadata, promptContent };
    } catch (error) {
      throw new Error(`Invalid YAML in ${filePath}: ${error}`);
    }
  }

  function getAllAgentFiles() {
    if (!existsSync(agentsDir)) {
      return [];
    }

    return readdirSync(agentsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => join(agentsDir, f));
  }

  describe('YAML Structure Validation', () => {
    it('should parse verify agent YAML correctly', () => {
      const verifyPath = join(agentsDir, 'verify.md');

      if (existsSync(verifyPath)) {
        const result = parseAgentFile(verifyPath);

        expect(result.metadata).toBeDefined();
        expect(result.metadata.name).toBe('verify');
        expect(result.metadata.description).toBeDefined();
        expect(result.metadata.tools).toBeDefined();
        expect(result.metadata.model).toBeDefined();
        expect(result.promptContent).toBeDefined();
        expect(result.promptContent.length).toBeGreaterThan(0);
      }
    });

    it('should parse regression-check agent YAML correctly', () => {
      const regressionPath = join(agentsDir, 'regression-check.md');

      if (existsSync(regressionPath)) {
        const result = parseAgentFile(regressionPath);

        expect(result.metadata).toBeDefined();
        expect(result.metadata.name).toBe('regression-check');
        expect(result.metadata.description).toBeDefined();
        expect(result.metadata.tools).toBeDefined();
        expect(result.metadata.model).toBeDefined();
        expect(result.promptContent).toBeDefined();
        expect(result.promptContent.length).toBeGreaterThan(0);
      }
    });

    it('should have consistent YAML structure across all agents', () => {
      const agentFiles = getAllAgentFiles();

      for (const filePath of agentFiles) {
        const result = parseAgentFile(filePath);

        // Required fields
        expect(result.metadata.name).toBeDefined();
        expect(typeof result.metadata.name).toBe('string');
        expect(result.metadata.name.length).toBeGreaterThan(0);

        expect(result.metadata.description).toBeDefined();
        expect(typeof result.metadata.description).toBe('string');
        expect(result.metadata.description.length).toBeGreaterThan(0);

        expect(result.metadata.tools).toBeDefined();
        expect(Array.isArray(result.metadata.tools)).toBe(true);
        expect(result.metadata.tools.length).toBeGreaterThan(0);

        expect(result.metadata.model).toBeDefined();
        expect(typeof result.metadata.model).toBe('string');
        expect(['sonnet', 'haiku', 'opus']).toContain(result.metadata.model);
      }
    });
  });

  describe('Tool Configuration Validation', () => {
    it('should have appropriate tools for verification agents', () => {
      const verifyPath = join(agentsDir, 'verify.md');
      const regressionPath = join(agentsDir, 'regression-check.md');

      if (existsSync(verifyPath)) {
        const verify = parseAgentFile(verifyPath);
        expect(verify.metadata.tools).toContain('Read');
        expect(verify.metadata.tools).toContain('Bash');
        expect(verify.metadata.tools).toContain('Grep');
        expect(verify.metadata.tools).toContain('Glob');
      }

      if (existsSync(regressionPath)) {
        const regression = parseAgentFile(regressionPath);
        expect(regression.metadata.tools).toContain('Read');
        expect(regression.metadata.tools).toContain('Bash');
        expect(regression.metadata.tools).toContain('Grep');
        expect(regression.metadata.tools).toContain('Glob');
      }
    });

    it('should not have duplicate tools', () => {
      const agentFiles = getAllAgentFiles();

      for (const filePath of agentFiles) {
        const result = parseAgentFile(filePath);
        const tools = result.metadata.tools;
        const uniqueTools = [...new Set(tools)];

        expect(tools.length).toBe(uniqueTools.length);
      }
    });

    it('should have valid tool names', () => {
      const validTools = [
        'Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch',
        'LSP', 'Task', 'TodoWrite', 'AskUserQuestion', 'NotebookEdit'
      ];

      const agentFiles = getAllAgentFiles();

      for (const filePath of agentFiles) {
        const result = parseAgentFile(filePath);

        for (const tool of result.metadata.tools) {
          expect(validTools).toContain(tool);
        }
      }
    });
  });

  describe('Model Configuration Validation', () => {
    it('should use appropriate models for complexity', () => {
      const verifyPath = join(agentsDir, 'verify.md');
      const regressionPath = join(agentsDir, 'regression-check.md');

      // Both verify and regression-check are complex reasoning tasks
      if (existsSync(verifyPath)) {
        const verify = parseAgentFile(verifyPath);
        expect(verify.metadata.model).toBe('sonnet');
      }

      if (existsSync(regressionPath)) {
        const regression = parseAgentFile(regressionPath);
        expect(regression.metadata.model).toBe('sonnet');
      }
    });

    it('should only use valid model names', () => {
      const validModels = ['sonnet', 'haiku', 'opus'];
      const agentFiles = getAllAgentFiles();

      for (const filePath of agentFiles) {
        const result = parseAgentFile(filePath);
        expect(validModels).toContain(result.metadata.model);
      }
    });
  });

  describe('Description Quality', () => {
    it('should have meaningful descriptions', () => {
      const agentFiles = getAllAgentFiles();

      for (const filePath of agentFiles) {
        const result = parseAgentFile(filePath);
        const description = result.metadata.description;

        // Should be at least 10 characters
        expect(description.length).toBeGreaterThan(10);

        // Should contain relevant keywords
        expect(description.toLowerCase()).toMatch(/test|verify|check|implement|analyze|review/);
      }
    });

    it('should have TDD-specific descriptions for TDD agents', () => {
      const verifyPath = join(agentsDir, 'verify.md');
      const regressionPath = join(agentsDir, 'regression-check.md');

      if (existsSync(verifyPath)) {
        const verify = parseAgentFile(verifyPath);
        expect(verify.metadata.description.toLowerCase()).toContain('tdd');
      }

      if (existsSync(regressionPath)) {
        const regression = parseAgentFile(regressionPath);
        expect(regression.metadata.description.toLowerCase()).toContain('tdd');
      }
    });
  });

  describe('Content Quality', () => {
    it('should have substantial prompt content', () => {
      const agentFiles = getAllAgentFiles();

      for (const filePath of agentFiles) {
        const result = parseAgentFile(filePath);

        // Should have substantial content (at least 500 characters)
        expect(result.promptContent.length).toBeGreaterThan(500);

        // Should contain section headers
        expect(result.promptContent).toMatch(/##\s+/);
      }
    });

    it('should have structured content with clear sections', () => {
      const verifyPath = join(agentsDir, 'verify.md');
      const regressionPath = join(agentsDir, 'regression-check.md');

      if (existsSync(verifyPath)) {
        const verify = parseAgentFile(verifyPath);
        expect(verify.promptContent).toMatch(/##.*Role/);
        expect(verify.promptContent).toMatch(/##.*Process/);
        expect(verify.promptContent).toMatch(/##.*Success.*Criteria/);
      }

      if (existsSync(regressionPath)) {
        const regression = parseAgentFile(regressionPath);
        expect(regression.promptContent).toMatch(/##.*Role/);
        expect(regression.promptContent).toMatch(/##.*Process/);
        expect(regression.promptContent).toMatch(/##.*Success.*Criteria/);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed YAML gracefully', () => {
      // Test with invalid YAML structure
      const mockInvalidContent = `---
name: test
description: test description
tools: [Read
model: sonnet
---
Test content`;

      expect(() => {
        yaml.parse('name: test\ndescription: test description\ntools: [Read\nmodel: sonnet');
      }).toThrow();
    });

    it('should handle missing frontmatter gracefully', () => {
      const mockContentNoFrontmatter = `# Test Agent
This is just content without frontmatter`;

      const frontMatterMatch = mockContentNoFrontmatter.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      expect(frontMatterMatch).toBeNull();
    });

    it('should handle empty files gracefully', () => {
      expect(() => {
        const frontMatterMatch = ''.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (!frontMatterMatch) {
          throw new Error('Invalid agent file format: missing YAML frontmatter');
        }
      }).toThrow('Invalid agent file format: missing YAML frontmatter');
    });
  });
});